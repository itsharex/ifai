import { Message, ToolCall } from '../../stores/chatStore';
import { useChatStore as coreUseChatStore, toolCallDeduplicator } from '../../stores/useChatStore';
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
    lastContent: string;
  }> = new Map();

  private constructor() {}

  static getInstance(): StreamingResponseController {
    if (!StreamingResponseController.instance) StreamingResponseController.instance = new StreamingResponseController();
    return StreamingResponseController.instance;
  }

  async initSession(assistantMsgId: string) {
    const sessionData = { renderRequested: false, unlistenFns: [] as UnlistenFn[], lastContent: "" };
    this.activeStreams.set(assistantMsgId, sessionData);

    const unlistenStatus = await listen<string>(`${assistantMsgId}_status`, (event) => {
      const safe = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);
      coreUseChatStore.setState((s: any) => ({
        messages: s.messages.map((m: any) => (m.id === assistantMsgId && !m.content) ? { ...m, content: `_(${safe})_\n\n` } : m)
      }));
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
        coreUseChatStore.setState((state: any) => {
          const updatedMessages = state.messages.map((m: any) => {
            if (m.id === assistantMsgId) {
              const newMsg: Message = { ...m, isStreaming: true }; // 🏆 强制保持 Streaming 状态
              (newMsg as any).contentSegments = (m as any).contentSegments ? [...(m as any).contentSegments] : [];
              
              if (textChunk) {
                newMsg.content = (newMsg.content || '') + textChunk;
                sessionData.lastContent = newMsg.content;
                (newMsg as any).contentSegments.push({ 
                  type: 'text', 
                  order: (newMsg as any).contentSegments.length, 
                  timestamp: Date.now(), 
                  content: textChunk, 
                  startPos: newMsg.content.length - textChunk.length, 
                  endPos: newMsg.content.length 
                });
                InlineSyncService.syncState("", "", textChunk);
              }
              
              if (toolCallUpdate) this.processToolCallUpdate(newMsg, toolCallUpdate, assistantMsgId);
              return newMsg;
            }
            return m;
          });
          return { messages: updatedMessages };
        });
      }
    });
    sessionData.unlistenFns.push(unlistenStream);

    const unlistenFinish = await listen<string>(`${assistantMsgId}_finish`, async () => {
      console.log(`[StreamingController] RECEIVED _finish EVENT for ${assistantMsgId}`);
      await this.finalizeStream(assistantMsgId);
    });
    sessionData.unlistenFns.push(unlistenFinish);

    const unlistenError = await listen<string>(`${assistantMsgId}_error`, (event) => {
      const safe = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);
      coreUseChatStore.setState((s: any) => ({
        messages: s.messages.map((m: any) => m.id === assistantMsgId ? { ...m, content: `❌ Error: ${safe}`, isStreaming: false } : m),
        isLoading: false
      }));
      this.cleanup(assistantMsgId);
    });
    sessionData.unlistenFns.push(unlistenError);
  }

  private processToolCallUpdate(msg: Message, update: any, assistantMsgId: string) {
    const toolName = update.function?.name || update.tool;
    const newArgs = update.function?.arguments || '';
    const existingCalls = msg.toolCalls || [];
    let cid = update.id;
    if (update.id) cid = toolCallDeduplicator.getCanonicalId(update.id) || update.id;

    const idx = existingCalls.findIndex(tc => (cid && tc.id === cid) || (update.index !== undefined && (tc as any).index === update.index));
    if (idx !== -1) {
      const tc = existingCalls[idx];
      const argsStr = ((tc as any).function?.arguments || '') + newArgs;
      let parsed = { ...tc.args };
      try { parsed = JSON.parse(argsStr); } catch (e) {
        const cMatch = String(argsStr).match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)(?:\\|"?$)/s);
        if (cMatch) parsed.content = cMatch[1].replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
      }
      const updated = [...existingCalls];
      updated[idx] = { ...tc, args: parsed, function: { name: toolName, arguments: argsStr }, isPartial: true } as any;
      msg.toolCalls = updated;
      InlineSyncService.syncState(toolName, parsed.content);
      
      if (updated[idx].isPartial === false) {
        ApprovalPipeline.processAutoApproval({ settings: useSettingsStore.getState(), editorMode: (window as any).__IFAI_EDITOR_MODE__ || "standard", isSessionTrusted: false, toolName: tc.tool, isSandbox: true, userMessageHasAutoApprove: false }, () => {
          (window as any).__chatStore?.getState().approveToolCall(assistantMsgId, tc.id, { skipContinue: true });
        });
      }
    } else {
      const tid = cid || `call_${crypto.randomUUID()}`;
      let iArgs: any = {};
      try { iArgs = newArgs ? JSON.parse(newArgs) : {}; } catch (e) {}
      const tc = { id: tid, type: 'function', tool: toolName, args: iArgs, function: { name: toolName, arguments: newArgs }, status: 'pending', isPartial: true, index: update.index } as any;
      msg.toolCalls = [...existingCalls, tc];
      (msg as any).contentSegments.push({ type: 'tool', order: (msg as any).contentSegments.length, timestamp: Date.now(), toolCallId: tid });
      InlineSyncService.syncState(toolName, "");
    }
  }

  async finalizeStream(id: string) {
    const session = this.activeStreams.get(id);
    if (!session) return;

    coreUseChatStore.setState((state: any) => ({
      messages: state.messages.map((m: any) => m.id === id ? {
        ...m, 
        isStreaming: false,
        toolCalls: m.toolCalls?.map((tc: any) => {
          let fArgs = tc.args || {};
          if (Object.keys(fArgs).length === 0 && (tc as any).function?.arguments) {
            try { fArgs = JSON.parse((tc as any).function.arguments); } catch (e) {}
          }
          return { ...tc, isPartial: false, args: fArgs };
        })
      } : m),
      isLoading: false
    }));

    InlineSyncService.handleResponseFinish();
    this.cleanup(id);
  }

  private cleanup(id: string) {
    const s = this.activeStreams.get(id);
    if (s) { s.unlistenFns.forEach(u => u()); this.activeStreams.delete(id); }
  }
}
