import { Message, ToolCall } from '../../stores/chatStore';
import { useChatStore as coreUseChatStore, toolCallDeduplicator } from '../../stores/useChatStore';
import { useThreadStore } from '../../stores/threadStore';
import { InlineSyncService } from '../InlineSyncService';
import { listen } from '@tauri-apps/api/event';

interface StreamSession {
    id: string;
    messageId: string;
    unlistenFns: (() => void)[];
    fullResponse: string;
    lastUpdate: number;
    streamingTools: Record<number, { id: string; name: string; arguments: string }>;
}

/**
 * 🏆 PIVO 3.0 Streaming Response Controller
 * 
 * 物理层流式响应控制器，负责 Buffer 对齐、状态机同步与 UI 削峰。
 */
export class StreamingResponseController {
  private static instance: StreamingResponseController;
  private activeStreams: Map<string, StreamSession> = new Map();
  private RENDER_THROTTLE = 80; // 物理削峰：80ms 渲染缓冲区

  private constructor() {}

  static getInstance() {
    if (!StreamingResponseController.instance) {
      StreamingResponseController.instance = new StreamingResponseController();
    }
    return StreamingResponseController.instance;
  }

  /**
   * 初始化流式会话物理 Buffer
   */
  async initSession(assistantMsgId: string, history: Message[]) {
    const eventId = assistantMsgId;
    console.log(`[StreamingController] 🌊 Initializing physical buffer for: ${eventId}`);

    const session: StreamSession = {
        id: eventId,
        messageId: assistantMsgId,
        unlistenFns: [],
        fullResponse: "",
        lastUpdate: 0,
        streamingTools: {}
    };

    // 1. 物理链路监听：Debug SSE
    const unlistenDebug = await listen<string>(`${eventId}_debug`, (event) => {
        // console.log("[RAW SSE]", event.payload);
    });
    session.unlistenFns.push(unlistenDebug);

    // 2. 物理链路监听：Data SSE (核心状态机)
    const unlistenData = await listen<any>(eventId, (event) => {
        this.handleStreamChunk(eventId, event.payload);
    });
    session.unlistenFns.push(unlistenData);

    this.activeStreams.set(eventId, session);
    return eventId;
  }

  /**
   * 处理物理 Chunk 片段
   */
  private handleStreamChunk(id: string, payload: any) {
    const session = this.activeStreams.get(id);
    if (!session) return;

    if (payload.type === 'content') {
        session.fullResponse += payload.content;
        this.throttledUpdate(id);
    } else if (payload.type === 'tool_call') {
        const chunk = payload.tool_call;
        // 🏆 PIVO 3.0: 物理级索引安全加固
        const idx = chunk.index !== undefined ? chunk.index : 0;
        if (!session.streamingTools[idx]) {
            session.streamingTools[idx] = { id: '', name: '', arguments: '' };
        }
        
        if (chunk.id) session.streamingTools[idx].id = chunk.id;
        
        // 🔥 核心修复：防止 undefined 累加为 "undefined" 字符串 (同步 ifainew-core 修复)
        if (chunk.function?.name) {
            session.streamingTools[idx].name = (session.streamingTools[idx].name || '') + chunk.function.name;
        }
        if (chunk.function?.arguments) {
            session.streamingTools[idx].arguments = (session.streamingTools[idx].arguments || '') + chunk.function.arguments;
        }
        
        this.throttledUpdate(id);
    } else if (payload.type === 'done') {
        this.finalFlush(id, payload.has_follow_up);
    }
  }

  /**
   * 物理渲染削峰器
   */
  private throttledUpdate(id: string) {
    const session = this.activeStreams.get(id);
    if (!session) return;

    const now = Date.now();
    if (now - session.lastUpdate < this.RENDER_THROTTLE) return;

    this.syncToStore(id);
    session.lastUpdate = now;
  }

  /**
   * 同步物理状态至 Store
   */
  private syncToStore(id: string) {
    const session = this.activeStreams.get(id);
    if (!session) return;

    const liveToolCalls: ToolCall[] = Object.values(session.streamingTools).map(st => ({
        id: st.id || `call_${Math.random().toString(36).slice(2, 9)}`,
        tool: st.name,
        args: {}, // 运行时由 JSON 解析补充
        function: { name: st.name, arguments: st.arguments },
        status: 'pending' as const,
        isPartial: true
    }));

    coreUseChatStore.getState().updateMessageContent(
        session.messageId, 
        session.fullResponse, 
        liveToolCalls.length > 0 ? liveToolCalls : undefined
    );
  }

  /**
   * 物理流终结刷新
   */
  private finalFlush(id: string, hasFollowUp: boolean) {
    const session = this.activeStreams.get(id);
    if (!session) return;

    // 🏆 PIVO 3.0: 物理闭环
    // 只有在没有后续任务且流真正结束时，才允许启动 UI 自洁
    console.log(`[PIVO-SIGNAL] 🏁 Stream Finalized: ${id}`);
    window.dispatchEvent(new CustomEvent('ifainew:stream-finished', { detail: { id } }));

    this.syncToStore(id);
    InlineSyncService.handleResponseFinish({ isRealFinish: !hasFollowUp });
    this.cleanup(id);
  }

  private cleanup(id: string) {
    const session = this.activeStreams.get(id);
    if (session) {
        session.unlistenFns.forEach(u => u());
        this.activeStreams.delete(id);
    }
    window.dispatchEvent(new CustomEvent('ifainew:session-cleaned', { detail: { id } }));
  }
}
