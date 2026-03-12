import { Message, ToolCall } from '../../stores/chatStore';
import { useChatStore as coreUseChatStore, toolCallDeduplicator } from '../../stores/useChatStore';
import { useThreadStore } from '../../stores/threadStore';
import { InlineSyncService } from '../InlineSyncService';
import { SentinelService } from '../SentinelService';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { ApprovalPipeline } from '../../utils/approvalPipeline';
import { useSettingsStore } from '../../stores/settingsStore';

export class StreamingResponseController {
  private static instance: StreamingResponseController;
  private activeStreams: Map<string, {
    renderRequested: boolean;
    unlistenFns: UnlistenFn[];
    buffer: Message[];
    threadId: string;
    hasReceivedChunk: boolean;
    lastHeartbeat: number;
  }> = new Map();

  private constructor() {}

  static getInstance(): StreamingResponseController {
    if (!StreamingResponseController.instance) {
        StreamingResponseController.instance = new StreamingResponseController();
        // 🏆 PIVO 3.0: 建立物理直连桥 (Fidelity Bridge)
        if (typeof window !== 'undefined') {
            (window as any).__PIVO_BRIDGE__ = {
                push: (id: string, payload: any) => {
                    console.log(`[PIVO-BRIDGE] 📥 Direct Injection: ${id}`, payload);
                    window.dispatchEvent(new CustomEvent(`pivo:direct-chunk:${id}`, { detail: payload }));
                },
                finalize: (id: string) => {
                    console.log(`[PIVO-BRIDGE] 🏁 Direct Finalize: ${id}`);
                    window.dispatchEvent(new CustomEvent(`pivo:direct-finish:${id}`));
                }
            };
        }
    }
    return StreamingResponseController.instance;
  }

  // 🏆 PIVO 3.0: 哨兵权威判定接口
  isStreamStuck(id: string): boolean {
    const s = this.activeStreams.get(id);
    if (!s) return false;
    // 宽限期延长至 8s，给慢速模型留足物理空间
    return (Date.now() - s.lastHeartbeat) > 8000;
  }

  async initSession(assistantMsgId: string, initialMessages: Message[]) {
    const threadId = useThreadStore.getState().activeThreadId || 'default';
    const sessionData = { 
        renderRequested: false, 
        unlistenFns: [] as UnlistenFn[], 
        buffer: JSON.parse(JSON.stringify(initialMessages)),
        threadId,
        hasReceivedChunk: false,
        lastHeartbeat: Date.now()
    };
    this.activeStreams.set(assistantMsgId, sessionData);

    const unlistenStatus = await listen<string>(`${assistantMsgId}_status`, (event) => {
      const safe = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);
      sessionData.buffer = sessionData.buffer.map((m: any) => (m.id === assistantMsgId && !m.content) ? { ...m, content: `_(${safe})_\n\n` } : m);
      sessionData.lastHeartbeat = Date.now();
      this.requestRender(assistantMsgId);
    });
    sessionData.unlistenFns.push(unlistenStatus);

    const unlistenStream = await listen<string>(assistantMsgId, (event) => {
      this.handleEventChunk(assistantMsgId, sessionData, event.payload);
    });
    sessionData.unlistenFns.push(unlistenStream);

    // 🏆 PIVO 3.0 Bridge: 侧边信号直连 (E2E 环境极其稳定)
    const bridgeHandler = (e: any) => this.handleEventChunk(assistantMsgId, sessionData, e.detail);
    window.addEventListener(`pivo:direct-chunk:${assistantMsgId}`, bridgeHandler);
    sessionData.unlistenFns.push(() => window.removeEventListener(`pivo:direct-chunk:${assistantMsgId}`, bridgeHandler));

    const unlistenFinish = await listen<string>(`${assistantMsgId}_finish`, async () => {
      await this.finalizeStream(assistantMsgId);
    });
    sessionData.unlistenFns.push(unlistenFinish);

    const bridgeFinishHandler = () => this.finalizeStream(assistantMsgId);
    window.addEventListener(`pivo:direct-finish:${assistantMsgId}`, bridgeFinishHandler);
    sessionData.unlistenFns.push(() => window.removeEventListener(`pivo:direct-finish:${assistantMsgId}`, bridgeFinishHandler));

    const unlistenError = await listen<string>(`${assistantMsgId}_error`, (event) => {
      const safe = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);
      this.forceUpdateStore(assistantMsgId, (m: any) => ({ ...m, content: `❌ Error: ${safe}`, isStreaming: false }));
      this.cleanup(assistantMsgId);
    });
    sessionData.unlistenFns.push(unlistenError);
  }

  private handleEventChunk(assistantMsgId: string, sessionData: any, payload: any) {
    let textChunk = '';
    let toolCallUpdate: any = null;
    try {
      if (!payload) return;
      const p = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (p.type === 'content') textChunk = String(p.content);
      else if (p.type === 'tool_call') toolCallUpdate = p.toolCall;
    } catch (e) {}

    if (textChunk || toolCallUpdate) {
      sessionData.lastHeartbeat = Date.now();
      if (!sessionData.hasReceivedChunk) {
          sessionData.hasReceivedChunk = true;
          setTimeout(() => coreUseChatStore.setState({ isLoading: false }), 50);
      }

      sessionData.buffer = sessionData.buffer.map((m: any) => {
        if (m.id === assistantMsgId) {
          const newMsg: Message = { ...m, isStreaming: true };
          if (!(newMsg as any).contentSegments) (newMsg as any).contentSegments = [];
          
          if (textChunk) {
            const prevContent = String(newMsg.content || '');
            
            // 🏆 PIVO 3.0: 工业级消重算法 (物理级消除乱码)
            // A. 计算完全重叠部分
            let overlapIdx = 0;
            const checkLimit = Math.min(prevContent.length, textChunk.length, 50); 
            for (let i = 1; i <= checkLimit; i++) {
                if (prevContent.endsWith(textChunk.substring(0, i))) {
                    overlapIdx = i;
                }
            }
            
            let cleanChunk = textChunk.substring(overlapIdx);
            
            // B. 🚀 物理增强：检测“交叉错位叠加” (防突变乱码)
            // 如果 cleanChunk 的前几个字符在 prevContent 的末尾高频出现，则进一步截断
            if (cleanChunk.length > 3 && prevContent.length > 10) {
                const tail = prevContent.slice(-15);
                const chunkHead = cleanChunk.slice(0, 5);
                // 如果头部的 3 个字符在尾部都找得到，极大概率是错位重发
                let matchCount = 0;
                for (const char of chunkHead) {
                    if (tail.includes(char)) matchCount++;
                }
                if (matchCount >= 3) {
                    console.warn(`[Streaming] 🛡️ High-entropy overlap detected, potential garbled text blocked: "${cleanChunk}"`);
                    // 尝试寻找 cleanChunk 中第一个不在 tail 里的字符作为真实起点
                    let realStart = 0;
                    for (let j = 0; j < cleanChunk.length; j++) {
                        if (!tail.includes(cleanChunk[j])) {
                            realStart = j;
                            break;
                        }
                    }
                    cleanChunk = cleanChunk.substring(realStart);
                }
            }
            
            if (cleanChunk.length > 0) {
                newMsg.content = prevContent + cleanChunk;
                (newMsg as any).contentSegments.push({ 
                    type: 'text', 
                    order: (newMsg as any).contentSegments.length, 
                    timestamp: Date.now(), 
                    content: cleanChunk, 
                    startPos: prevContent.length, 
                    endPos: newMsg.content.length 
                });
                InlineSyncService.syncState("", "", cleanChunk);
            }
          }
          if (toolCallUpdate) this.processToolCallUpdate(newMsg, toolCallUpdate, assistantMsgId);
          return newMsg;
        }
        return m;
      });
      this.requestRender(assistantMsgId);
    }
  }

  private requestRender(id: string) {
    const s = this.activeStreams.get(id);
    if (!s || s.renderRequested) return;
    const currentThreadId = useThreadStore.getState().activeThreadId || 'default';
    if (s.threadId !== currentThreadId) return; 

    s.renderRequested = true;
    setTimeout(() => {
      if (this.activeStreams.has(id)) {
        coreUseChatStore.setState({ messages: [...s.buffer] as any });
        s.renderRequested = false;
      }
    }, 80);
  }

  private extractPartialArgs(argsStr: string): any {
    let parsed: any = {};
    try { 
      parsed = JSON.parse(argsStr); 
    } catch (e) {
      // 🏆 PIVO 3.0: 鲁棒性正则提取 (支持未闭合 JSON)
      const contentMatch = argsStr.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)/s);
      if (contentMatch) {
          parsed.content = contentMatch[1].replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
      }
      
      const pathMatch = argsStr.match(/"rel_path"\s*:\s*"((?:[^"\\]|\\.)*)/s);
      if (pathMatch) {
          let val = pathMatch[1];
          if (val.includes('"')) val = val.substring(0, val.indexOf('"'));
          parsed.rel_path = val;
      }
    }
    return parsed;
  }

  private processToolCallUpdate(msg: Message, update: any, assistantMsgId: string) {
    const deltaName = update.function?.name || update.tool || '';
    const newArgs = update.function?.arguments || '';
    const existingCalls = msg.toolCalls || [];
    let cid = update.id;
    if (update.id) cid = toolCallDeduplicator.getCanonicalId(update.id) || update.id;

    const idx = existingCalls.findIndex(tc => (cid && tc.id === cid) || (update.index !== undefined && (tc as any).index === update.index));
    const isPartial = update.isPartial ?? true;

    if (idx !== -1) {
      const tc = existingCalls[idx];
      // 🏆 PIVO 3.0: 支持碎片化名字拼接 (DeepSeek 风格)
      const toolName = (tc.tool || '') + deltaName;
      const argsStr = ((tc as any).function?.arguments || '') + newArgs;
      const parsed = this.extractPartialArgs(argsStr);
      
      const updated = [...existingCalls];
      updated[idx] = { ...tc, tool: toolName, args: parsed, function: { name: toolName, arguments: argsStr }, isPartial: isPartial } as any;
      msg.toolCalls = updated;
      if (parsed.content) InlineSyncService.syncState(toolName, parsed.content);
      
      const segments = (msg as any).contentSegments || [];
      const hasSegment = segments.some((seg: any) => seg.toolCallId === updated[idx].id);
      if (!hasSegment) {
          segments.push({ type: 'tool', order: segments.length, timestamp: Date.now(), toolCallId: updated[idx].id });
          (msg as any).contentSegments = segments;
      }

      if (isPartial === false) {
        ApprovalPipeline.processAutoApproval({ settings: useSettingsStore.getState(), editorMode: (window as any).__IFAI_EDITOR_MODE__ || "standard", isSessionTrusted: false, toolName: toolName, isSandbox: true, userMessageHasAutoApprove: (msg as any).autoApproveTools || false }, () => {
          (coreUseChatStore.getState() as any).approveToolCall(assistantMsgId, updated[idx].id, { skipContinue: true });
        });
      }
    } else {
      const tid = cid || `call_${crypto.randomUUID()}`;
      const iArgs = this.extractPartialArgs(newArgs);
      const tc = { id: tid, type: 'function', tool: deltaName, args: iArgs, function: { name: deltaName, arguments: newArgs }, status: 'pending', isPartial: isPartial, index: update.index } as any;
      msg.toolCalls = [...existingCalls, tc];
      if (!(msg as any).contentSegments) (msg as any).contentSegments = [];
      (msg as any).contentSegments.push({ type: 'tool', order: (msg as any).contentSegments.length, timestamp: Date.now(), toolCallId: tid });
      InlineSyncService.syncState(deltaName, iArgs.content || "");
    }
  }

  async finalizeStream(id: string) {
    const session = this.activeStreams.get(id);
    if (!session) return;

    this.forceUpdateStore(id, (m: any) => ({
        ...m, 
        isStreaming: false,
        toolCalls: m.toolCalls?.map((tc: any) => {
          let fArgs = tc.args || {};
          if ((!fArgs || Object.keys(fArgs).length === 0) && (tc as any).function?.arguments) {
            try { fArgs = JSON.parse((tc as any).function.arguments); } catch (e) {}
          }
          // 🏆 PIVO 3.0: 物理保留所有字段（包括 result），仅更新 isPartial 和 args
          return { ...tc, isPartial: false, args: fArgs };
        })
    }));

    const updatedState = coreUseChatStore.getState();
    const finalizedMsg = updatedState.messages.find(m => m.id === id);
    let hasFollowUp = false;

    if (finalizedMsg?.toolCalls) {
        const pendingTCs = finalizedMsg.toolCalls.filter((tc: any) => tc.status === 'pending');
        if (pendingTCs.length > 0) {
            hasFollowUp = true; // 🏆 关键：检测到有自动执行工具，标记为非终结态
            pendingTCs.forEach((tc: any) => {
                ApprovalPipeline.processAutoApproval({ settings: useSettingsStore.getState(), editorMode: (window as any).__IFAI_EDITOR_MODE__ || "standard", isSessionTrusted: false, toolName: tc.tool, isSandbox: true, userMessageHasAutoApprove: (finalizedMsg as any).autoApproveTools || false }, () => {
                    (coreUseChatStore.getState() as any).approveToolCall(id, tc.id, { skipContinue: true });
                });
            });
            setTimeout(async () => {
                const latestState = coreUseChatStore.getState();
                const latestMsg = latestState.messages.find(m => m.id === id);
                const anyRunning = latestMsg?.toolCalls?.some(tc => tc.status === 'pending' || tc.status === 'approved' || tc.status === 'executing' || tc.isPartial);
                if (!anyRunning) {
                    const settings = useSettingsStore.getState();
                    const providerConfig = settings.providers.find(p => p.id === settings.currentProviderId);
                    if (providerConfig) (window as any).__chatStore?.getState().generateResponse(latestState.messages, providerConfig);
                }
            }, 1000);
        }
    }

    // 🏆 PIVO 3.0: 物理闭环
    // 只有在没有后续任务且流真正结束时，才允许启动 UI 自洁
    console.log(`[PIVO-SIGNAL] 🏁 Stream Finalized: ${id}`);
    
    // 触发任务拆解 (PIVO 3.0 物理核心步进)
    try {
        const { MessageLifecycleService } = await import('./MessageLifecycleService');
        const state = coreUseChatStore.getState();
        const lastMsg = state.messages.find(m => m.id === id);
        if (lastMsg) {
            MessageLifecycleService.triggerTaskBreakdown(lastMsg, state.messages);
        }
    } catch (e) {
        console.error('[Streaming] ❌ Failed to trigger task breakdown:', e);
    }

    // 🏆 PIVO 3.0: 物理管线存根 (用于 E2E 消除竞态)
    if (!(window as any).__PIVO_SIGNALS__) (window as any).__PIVO_SIGNALS__ = {};
    (window as any).__PIVO_SIGNALS__['ifainew:stream-finished'] = { timestamp: Date.now(), id };

    window.dispatchEvent(new CustomEvent('ifainew:stream-finished', { detail: { id } }));
    // 发送旧版 finish 事件以保证兼容性
    window.dispatchEvent(new CustomEvent(`${id}_finish`, { detail: { payload: 'done' } }));
    
    InlineSyncService.handleResponseFinish({ isRealFinish: !hasFollowUp });
    this.cleanup(id);
  }

  private forceUpdateStore(id: string, updateFn: (msg: any) => any) {
    coreUseChatStore.setState((state: any) => ({
        messages: state.messages.map((m: any) => m.id === id ? updateFn(m) : m),
        isLoading: false
    }));
  }

  private cleanup(id: string) {
    console.log(`[PIVO-SIGNAL] 🧹 Cleaning up session: ${id}`);
    const s = this.activeStreams.get(id);
    if (s) { 
        s.unlistenFns.forEach(u => u()); 
        this.activeStreams.delete(id); 
    }
    window.dispatchEvent(new CustomEvent('ifainew:session-cleaned', { detail: { id } }));
  }
}
