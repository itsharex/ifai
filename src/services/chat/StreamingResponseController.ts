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
    if (!StreamingResponseController.instance) StreamingResponseController.instance = new StreamingResponseController();
    return StreamingResponseController.instance;
  }

  isStreamStuck(id: string): boolean {
    const s = this.activeStreams.get(id);
    if (!s) return false;
    return (Date.now() - s.lastHeartbeat) > 5000;
  }

  async initSession(assistantMsgId: string, initialMessages: Message[]) {
    const threadId = useThreadStore.getState().activeThreadId || 'default';
    const sessionData = { 
        renderRequested: false, 
        unlistenFns: [] as UnlistenFn[], 
        buffer: JSON.parse(JSON.stringify(initialMessages)), // 🏆 物理隔离初始数据，防止引用污染
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
      let textChunk = '';
      let toolCallUpdate: any = null;
      try {
        const raw: any = event.payload;
        if (!raw) return;
        const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
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
            // 🏆 物理保护 contentSegments 不被重置
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
    });
    sessionData.unlistenFns.push(unlistenStream);

    const unlistenFinish = await listen<string>(`${assistantMsgId}_finish`, async () => {
      await this.finalizeStream(assistantMsgId);
    });
    sessionData.unlistenFns.push(unlistenFinish);

    const unlistenError = await listen<string>(`${assistantMsgId}_error`, (event) => {
      const safe = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);
      this.forceUpdateStore(assistantMsgId, (m: any) => ({ ...m, content: `❌ Error: ${safe}`, isStreaming: false }));
      this.cleanup(assistantMsgId);
    });
    sessionData.unlistenFns.push(unlistenError);
  }

  private requestRender(id: string) {
    const s = this.activeStreams.get(id);
    if (!s || s.renderRequested) return;
    const currentThreadId = useThreadStore.getState().activeThreadId || 'default';
    if (s.threadId !== currentThreadId) return; 

    s.renderRequested = true;
    setTimeout(() => {
      if (this.activeStreams.has(id)) {
        coreUseChatStore.setState({ messages: [...s.buffer] });
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
      
      // 🏆 物理幂等保护：如果已经存在该 ToolCall 的渲染分段，严禁重复 push
      const segments = (msg as any).contentSegments || [];
      const hasSegment = segments.some((seg: any) => seg.toolCallId === updated[idx].id);
      if (!hasSegment) {
          segments.push({ type: 'tool', order: segments.length, timestamp: Date.now(), toolCallId: updated[idx].id });
          (msg as any).contentSegments = segments;
      }

      if (isPartial === false) {
        ApprovalPipeline.processAutoApproval({ settings: useSettingsStore.getState(), editorMode: (window as any).__IFAI_EDITOR_MODE__ || "standard", isSessionTrusted: false, toolName: toolName, isSandbox: true, userMessageHasAutoApprove: (msg as any).autoApproveTools || false }, () => {
          coreUseChatStore.getState().approveToolCall(assistantMsgId, updated[idx].id, { skipContinue: true });
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
    if (finalizedMsg?.toolCalls) {
        const pendingTCs = finalizedMsg.toolCalls.filter((tc: any) => tc.status === 'pending');
        if (pendingTCs.length > 0) {
            pendingTCs.forEach((tc: any) => {
                ApprovalPipeline.processAutoApproval({ settings: useSettingsStore.getState(), editorMode: (window as any).__IFAI_EDITOR_MODE__ || "standard", isSessionTrusted: false, toolName: tc.tool, isSandbox: true, userMessageHasAutoApprove: (finalizedMsg as any).autoApproveTools || false }, () => {
                    coreUseChatStore.getState().approveToolCall(id, tc.id, { skipContinue: true });
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

    InlineSyncService.handleResponseFinish();
    this.cleanup(id);
  }

  private forceUpdateStore(id: string, updateFn: (msg: any) => any) {
    coreUseChatStore.setState((state: any) => ({
        messages: state.messages.map((m: any) => m.id === id ? updateFn(m) : m),
        isLoading: false
    }));
  }

  private cleanup(id: string) {
    const s = this.activeStreams.get(id);
    if (s) { s.unlistenFns.forEach(u => u()); this.activeStreams.delete(id); }
  }
}
