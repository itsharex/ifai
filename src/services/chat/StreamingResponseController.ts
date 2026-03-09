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
            const prevContent = newMsg.content || '';
            newMsg.content = prevContent + textChunk;
            (newMsg as any).contentSegments.push({ type: 'text', order: (newMsg as any).contentSegments.length, timestamp: Date.now(), content: textChunk, startPos: prevContent.length, endPos: newMsg.content.length });
            InlineSyncService.syncState("", "", textChunk);
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

  private processToolCallUpdate(msg: Message, update: any, assistantMsgId: string) {
    const toolName = update.function?.name || update.tool;
    const newArgs = update.function?.arguments || '';
    const existingCalls = msg.toolCalls || [];
    let cid = update.id;
    if (update.id) cid = toolCallDeduplicator.getCanonicalId(update.id) || update.id;

    const idx = existingCalls.findIndex(tc => (cid && tc.id === cid) || (update.index !== undefined && (tc as any).index === update.index));
    const isPartial = update.isPartial ?? true;

    if (idx !== -1) {
      const tc = existingCalls[idx];
      const argsStr = ((tc as any).function?.arguments || '') + newArgs;
      let parsed = { ...tc.args };
      try { parsed = JSON.parse(argsStr); } catch (e) {
        const cMatch = String(argsStr).match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)(?:\\|"?$)/s);
        if (cMatch) parsed.content = cMatch[1].replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
      }
      const updated = [...existingCalls];
      updated[idx] = { ...tc, args: parsed, function: { name: toolName, arguments: argsStr }, isPartial: isPartial } as any;
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
          coreUseChatStore.getState().approveToolCall(assistantMsgId, updated[idx].id);
        });
      }
    } else {
      const tid = cid || `call_${crypto.randomUUID()}`;
      let iArgs: any = {};
      try { iArgs = newArgs ? JSON.parse(newArgs) : {}; } catch (e) {}
      const tc = { id: tid, type: 'function', tool: toolName, args: iArgs, function: { name: toolName, arguments: newArgs }, status: 'pending', isPartial: isPartial, index: update.index } as any;
      msg.toolCalls = [...existingCalls, tc];
      if (!(msg as any).contentSegments) (msg as any).contentSegments = [];
      (msg as any).contentSegments.push({ type: 'tool', order: (msg as any).contentSegments.length, timestamp: Date.now(), toolCallId: tid });
      InlineSyncService.syncState(toolName, "");
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
          if (Object.keys(fArgs).length === 0 && (tc as any).function?.arguments) {
            try { fArgs = JSON.parse((tc as any).function.arguments); } catch (e) {}
          }
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
                    coreUseChatStore.getState().approveToolCall(id, tc.id);
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
    window.dispatchEvent(new CustomEvent('ifainew:stream-finished', { detail: { id } }));
    
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
