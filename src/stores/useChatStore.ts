// ============================================================================
// 暴露工具函数给 E2E 环境
// ============================================================================
if (typeof window !== 'undefined') {
    (window as any).recognizeIntent = (await import('../utils/intentRecognizer')).recognizeIntent;
    (window as any).checkAutoApprove = (await import('../utils/approvalPolicy')).shouldAutoApprove;
}

// Wrapper for core library useChatStore
// Handles dependency injection of file and settings stores

import { useChatStore as coreUseChatStore, registerStores, createToolCallDeduplicator } from 'ifainew-core';
import type { Message, ContentPart, ToolCall } from './chatStore';

// 🏆 v0.3.8: 初始化 ToolCall 去重服务
export const toolCallDeduplicator = createToolCallDeduplicator();

export type { Message, ContentPart, ToolCall };

import { useFileStore } from './fileStore';
import { readFileContent } from '../utils/fileSystem';
import { useSettingsStore } from './settingsStore';
import { useAgentStore } from './agentStore';
import { globalConcurrencyManager } from '../utils/ConcurrencyManager';
import { useThreadStore } from './threadStore';
import { useSkillStore } from './skillStore';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { recognizeIntent, shouldTriggerAgent } from '../utils/intentRecognizer';
import { shouldAutoApprove as checkAutoApprove } from '../utils/approvalPolicy';
import { autoSaveThread } from './persistence/threadPersistence';
import i18n from '../i18n/config';

// 🔥 版本区分:根据版本显示不同的提示
import { IS_COMMERCIAL } from '../config/edition';

import { ApprovalPipeline } from '../utils/approvalPipeline';
import { SentinelService } from '../services/SentinelService';
import { InlineSyncService } from '../services/InlineSyncService';
import { StreamingResponseController } from '../services/chat/StreamingResponseController';
import { MessageLifecycleService } from '../services/chat/MessageLifecycleService';
import { ICoreChatStore } from '../interfaces/ICoreChatStore';

// ============================================================================
// 统一日志工具 - 规范化日志格式，便于调试和问题追踪
// ============================================================================

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

type LogCategory = 'Chat' | 'Thread' | 'Tool' | 'Agent' | 'Context' | 'Stream' | 'LocalModel' | 'Intent';

const LOG_EMOJIS: Record<LogLevel, string> = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  debug: '🔍'
};

function log(category: LogCategory, level: LogLevel, message: string, data?: any): void {
  const emoji = LOG_EMOJIS[level];
  const prefix = `[${category}] ${emoji}`;
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  const logMessage = `${timestamp} ${prefix} ${message}`;
  const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (data !== undefined) consoleMethod(logMessage, data);
  else consoleMethod(logMessage);
}

const logInfo = (category: LogCategory, message: string, data?: any) => log(category, 'info', message, data);
const logWarn = (category: LogCategory, message: string, data?: any) => log(category, 'warn', message, data);
const logError = (category: LogCategory, message: string, data?: any) => log(category, 'error', message, data);

// Content segment interface for tracking stream reception order
export interface ContentSegment {
  type: 'text' | 'tool';
  order: number;
  timestamp: number;
  content?: string;
  toolCallId?: string;
  startPos?: number;
  endPos?: number;
}

// ============================================================================
// Thread-Aware Message Management
// ============================================================================

const threadMessages: Map<string, Message[]> = new Map();

export function getThreadMessages(threadId: string): Message[] {
  return threadMessages.get(threadId) || [];
}

export function setThreadMessages(threadId: string, messages: Message[]): void {
  threadMessages.set(threadId, messages);
  autoSaveThread(threadId);
}

export function clearThreadMessages(): void {
  threadMessages.clear();
}

export function switchThread(threadId: string): void {
  const threadStore = useThreadStore.getState();
  const currentThreadId = threadStore.activeThreadId;

  if (currentThreadId) {
    const currentMessages = coreUseChatStore.getState().messages;
    setThreadMessages(currentThreadId, [...currentMessages] as any);
  }

  threadStore.switchThread(threadId);
  const targetMessages = getThreadMessages(threadId);
  coreUseChatStore.setState({ messages: [...targetMessages] });
}

registerStores(useFileStore.getState, useSettingsStore.getState, useThreadStore.getState);

// --- Store Adapter for Services ---
const getStoreAdapter = (): ICoreChatStore => {
    return {
        messages: coreUseChatStore.getState().messages,
        isLoading: coreUseChatStore.getState().isLoading,
        addMessage: (msg: any) => coreUseChatStore.getState().addMessage(msg),
        updateMessageContent: (id: string, content: string, toolCalls?: any[]) => coreUseChatStore.getState().updateMessageContent(id, content, toolCalls),
        setLoading: (loading: boolean) => coreUseChatStore.setState({ isLoading: loading }),
        approveToolCall: (messageId: string, toolCallId: string, options?: any) => (coreUseChatStore.getState() as any).approveToolCall(messageId, toolCallId, options),
        rejectToolCall: (messageId: string, toolCallId: string) => (coreUseChatStore.getState() as any).rejectToolCall(messageId, toolCallId),
        setState: (updater: any) => coreUseChatStore.setState(updater)
    } as any;
};

// --- Monkey-patching Core Store ---
const originalSendMessage = coreUseChatStore.getState().sendMessage;
const originalAddMessage = coreUseChatStore.getState().addMessage;
const originalApproveToolCall = coreUseChatStore.getState().approveToolCall;
const originalRejectToolCall = coreUseChatStore.getState().rejectToolCall;

const patchedAddMessage = async (message: Message) => {
    const interceptedMessage = await MessageLifecycleService.interceptAddMessage(message, getStoreAdapter());
    return originalAddMessage(interceptedMessage);
};

const patchedSendMessage = async (content: string | any[], providerId: string, modelName: string, options: any = {}) => {
    const store = getStoreAdapter();
    const settings = useSettingsStore.getState();
    const threadStore = useThreadStore.getState();

    // 1. Thread Management
    let activeThreadId = threadStore.activeThreadId;
    if (!activeThreadId) {
        activeThreadId = threadStore.createThread();
    }
    const currentThreadMessages = getThreadMessages(activeThreadId);
    if (currentThreadMessages.length > 0 && coreUseChatStore.getState().messages.length === 0) {
        coreUseChatStore.setState({ messages: currentThreadMessages });
    }

    // 2. Message Lifecycle Interception
    const lifecycleResult = await MessageLifecycleService.interceptSendMessage(content, options, store);
    if (lifecycleResult.shouldStop) return;

    const { enrichedContent, userMsgId, userMessageAdded } = lifecycleResult;

    // 3. Provider Config Prep
    const providerData = settings.providers.find((p: any) => p.id === providerId);
    const providerConfig = {
        ...providerData, provider: providerId, id: providerId,
        api_key: providerData?.apiKey || "", base_url: providerData?.baseUrl || "",
        models: [modelName], protocol: providerData?.protocol || "openai"
    };

    // 4. Add User Message
    if (!userMessageAdded) {
        const displayContent = typeof content === 'string'
            ? content.replace(/^\[(CHAT|TASK-EXECUTION)\]\s*/, '').replace(/\[TASK-EXECUTION\]\s*/g, '')
            : content;
        
        const autoApproveTools = typeof content === 'string' && content.includes('[TASK-EXECUTION]');
        
        coreUseChatStore.getState().addMessage({
            id: userMsgId,
            role: 'user',
            content: displayContent,
            // @ts-ignore
            autoApproveTools,
            isInlineTask: options.isInlineTask,
            displayLabel: options.displayLabel
        });

        const currentThread = threadStore.getThread(activeThreadId!);
        if (currentThread && /^(上午|下午|晚上)(的新对话|的对话 \d+)$/.test(currentThread.title)) {
            threadStore.updateThreadTitleFromMessage(activeThreadId!, displayContent);
        }
    }

    // 5. Generate Response
    await patchedGenerateResponse(coreUseChatStore.getState().messages, providerConfig, { ...options, userMsgId, enrichedContent, originalContent: content });
};

const patchedGenerateResponse = async (history: any[], providerConfig: any, options?: any) => {
    const store = getStoreAdapter();
    const settings = useSettingsStore.getState();
    const assistantMsgId = crypto.randomUUID();
    const { userMsgId, enrichedContent, originalContent } = options || {};

    // Sentinel Scan
    SentinelService.scanForUuid(history);

    // Context Selection
    const { maxContextMessages, enableSmartContextSelection, maxContextTokens } = settings;
    let messagesToContext = history;
    if (enableSmartContextSelection) {
        messagesToContext = await MessageLifecycleService.prepareContext(history, maxContextMessages, settings.currentModel, maxContextTokens);
    }

    // Add Assistant Placeholder
    coreUseChatStore.getState().addMessage({
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        // @ts-ignore
        contentSegments: [] as ContentSegment[],
        isInlineTask: options?.isInlineTask,
        displayLabel: options?.displayLabel
    });

    // Initialize Streaming Session
    await StreamingResponseController.getInstance().initSession(assistantMsgId);

    // Invoke Backend
    try {
        const currentMode = (window as any).__IFAI_EDITOR_MODE__;
        const shouldEnableTools = options?.isInlineTask || (options?.enableTools !== undefined ? options.enableTools : currentMode !== "vibe");

        const msgHistory = MessageLifecycleService.transformToApiHistory(messagesToContext, {
            isInlineTask: options?.isInlineTask,
            isChinese: i18n.language?.startsWith("zh"),
            msgId: options?.userMsgId,
            enrichedContent: options?.enrichedContent,
            content: options?.originalContent || ""
        });

        console.log(`[Chat] 📡 Invoking ai_chat for eventId: ${assistantMsgId}`);
        await invoke('ai_chat', {
            providerConfig: {
                ...providerConfig,
                api_key: providerConfig.apiKey || providerConfig.api_key || "",
                base_url: providerConfig.baseUrl || providerConfig.base_url || ""
            },
            messages: msgHistory,
            eventId: assistantMsgId,
            projectRoot: useFileStore.getState().rootPath,
            enableTools: shouldEnableTools,
            activeSkillIds: (window as any).__IFAI_ACTIVE_SKILLS__ || [],
            mode: currentMode || "vibe"
        });
        console.log(`[Chat] 📡 ai_chat invoked successfully for eventId: ${assistantMsgId}`);
    } catch (e) {
        console.error('[Chat] Invoke error:', e);
        coreUseChatStore.setState((s: any) => ({
            messages: s.messages.map((m: any) => m.id === assistantMsgId ? { ...m, content: `❌ Error: ${e}`, isStreaming: false } : m),
            isLoading: false
        }));
    }
};

// 🏆 v0.3.8: 终极哨兵 - 物理监测并回收僵死流状态
coreUseChatStore.subscribe((state, prevState) => {
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming && !state.isLoading) {
        console.log('[Sentinel] 🛡️ Detecting stuck streaming state, force finalizing:', lastMsg.id);
        coreUseChatStore.setState(s => ({
            messages: s.messages.map(m => m.id === lastMsg.id ? { ...m, isStreaming: false } : m)
        }));
    }
});

const patchedApproveToolCall = async (messageId: string, toolCallId: string, options?: { skipContinue?: boolean }) => {
    // Keep standard approval logic (as it requires heavy UI/Service integration)
    const settings = useSettingsStore.getState();
    const useNewEngine = settings.enableNewApprovalEngine !== false;
    const state = coreUseChatStore.getState();
    const message = state.messages.find(m => m.id === messageId);
    const toolCall = message?.toolCalls?.find(tc => tc.id === toolCallId);
    const toolName = toolCall?.tool || '';

    const isSupportedByNewEngine = [
        "agent_write_file", "agent_read_file", "agent_list_dir", 
        "agent_delete_file", "agent_list_functions", "agent_scan_project",
        "bash", "agent_bash", "agent_execute_command", "execute_bash_command", "agent_run_shell_command",
        "agent_search", "search_semantic", "agent_batch_read", "init_rag_index",
        "get_file_symbols"
    ].includes(toolName);

    if (useNewEngine && isSupportedByNewEngine && !(toolCall as any).agentId) {
        return await globalConcurrencyManager.run(async () => {
            const { getApprovalCoordinator } = await import('../core/approval');
            const coordinator = getApprovalCoordinator();
            
            const latestState = coreUseChatStore.getState();
            const latestMsg = latestState.messages.find(m => m.id === messageId);
            const latestToolCall = latestMsg?.toolCalls?.find(tc => tc.id === toolCallId);
            
            if (latestToolCall) {
                let finalArgs = latestToolCall.args || {};
                const rawArgsStr = (latestToolCall as any).function?.arguments || "";
                if (rawArgsStr) {
                    try { finalArgs = { ...finalArgs, ...JSON.parse(rawArgsStr) }; } catch {}
                }

                await coordinator.createApproval(messageId, { id: latestToolCall.id, tool: latestToolCall.tool, args: finalArgs });
                SentinelService.beforeExecute(latestToolCall.tool, finalArgs);
                const result = await coordinator.approve(toolCallId);
                SentinelService.afterExecute(latestToolCall.tool, result);

                coreUseChatStore.setState(s => ({
                    messages: s.messages.map(m => m.id === messageId ? {
                        ...m, toolCalls: m.toolCalls?.map(tc => tc.id === toolCallId ? { 
                            ...tc, status: result.success ? "completed" as const : "failed" as const, result: result.content || result.error 
                        } : tc)
                    } : m)
                }));

                coreUseChatStore.getState().addMessage({ id: crypto.randomUUID(), role: "tool", content: result.content || result.error || "", tool_call_id: toolCallId });

                if (!options?.skipContinue && result.success) {
                    const providerConfig = settings.providers.find(p => p.id === settings.currentProviderId);
                    if (providerConfig) setTimeout(async () => { await patchedGenerateResponse(coreUseChatStore.getState().messages, providerConfig); }, 300);
                }
                return;
            }
        });
    }
    return await originalApproveToolCall(messageId, toolCallId);
};

coreUseChatStore.setState({
    sendMessage: patchedSendMessage,
    addMessage: patchedAddMessage,
    generateResponse: patchedGenerateResponse,
    approveToolCall: patchedApproveToolCall,
    rejectToolCall: originalRejectToolCall,
    approveAllToolCalls: async (mid: string) => {
        const msg = coreUseChatStore.getState().messages.find(m => m.id === mid);
        if (!msg?.toolCalls) return;
        for (const tc of msg.toolCalls) if (tc.status === "pending") await (coreUseChatStore.getState() as any).approveToolCall(mid, tc.id);
    }
} as any);

// Auto-persistence subscription
let persistenceTimeout: any = null;
coreUseChatStore.subscribe((state, prevState) => {
    if (state.messages !== prevState.messages) {
        const threadId = useThreadStore.getState().activeThreadId;
        if (threadId) {
            if (persistenceTimeout) clearTimeout(persistenceTimeout);
            persistenceTimeout = setTimeout(async () => {
                setThreadMessages(threadId, state.messages as any);
            }, 2000);
        }
    }
});

// 🏆 v0.3.7: PIVO 自动触发与状态同步引擎 (Chat-Native Observer)
coreUseChatStore.subscribe((state, prevState) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const prevLastMessage = prevState.messages[prevState.messages.length - 1];

    if (!lastMessage || lastMessage.role !== 'assistant') return;

    if (!prevLastMessage || prevLastMessage.id !== lastMessage.id) {
        const userMessage = state.messages.slice().reverse().find(m => m.role === 'user');
        if (userMessage) {
            const textInput = typeof userMessage.content === 'string' ? userMessage.content : 
                             (userMessage.multiModalContent?.find((p: any) => p.type === 'text')?.text || '');
            
            const intentResult = recognizeIntent(textInput);
            if (intentResult && (intentResult.category === 'write' || intentResult.confidence > 0.8)) {
                invoke('pivo_generate_tasks', { intent: textInput })
                    .then((tasks: any) => {
                        const { usePivoStore } = (window as any).__pivoStore ? { usePivoStore: (window as any).__pivoStore } : { usePivoStore: null };
                        if (usePivoStore && tasks?.length > 0) {
                            usePivoStore.getState().setTaskTree(lastMessage.id, tasks);
                        }
                    }).catch(() => {});
            }
        }
    }

    const { usePivoStore } = (window as any).__pivoStore ? { usePivoStore: (window as any).__pivoStore } : { usePivoStore: null };
    if (!usePivoStore) return;

    const currentTasks = usePivoStore.getState().taskTrees[lastMessage.id];
    if (!currentTasks || currentTasks.length === 0) return;

    const hasSuccessfulWrite = lastMessage.toolCalls?.some(tc => 
        (tc.tool === 'agent_write_file' || tc.tool === 'agent_replace') && 
        (tc.status === 'completed' || tc.status === 'executed')
    );
    if (hasSuccessfulWrite) {
        const implTask = currentTasks.find((t: any) => t.task_type === 'Implement' && t.status !== 'success');
        if (implTask) usePivoStore.getState().updateTaskStatus(lastMessage.id, implTask.id, 'success');
    }

    const hasSuccessfulVerify = lastMessage.toolCalls?.some(tc => 
        tc.tool === 'agent_run_shell' && (tc.status === 'completed' || tc.status === 'executed')
    );
    if (hasSuccessfulVerify) {
        const verifyTask = currentTasks.find((t: any) => t.task_type === 'Verify' && t.status !== 'success');
        if (verifyTask) usePivoStore.getState().updateTaskStatus(lastMessage.id, verifyTask.id, 'success');
    }

    if (!(lastMessage as any).isStreaming) {
        const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';
        const completionKeywords = ['成功', '完成', '好了', '完善', '完毕', '结束', 'done', 'complete', 'success', 'ready'];
        const hasCompletionKeyword = completionKeywords.some(k => content.includes(k));
        const isLengthyEnough = content.length > 30;

        if (hasCompletionKeyword || isLengthyEnough) {
            currentTasks.forEach((t: any) => {
                if (t.status === 'pending' || t.status === 'running') {
                    usePivoStore.getState().updateTaskStatus(lastMessage.id, t.id, 'success');
                }
            });
        }
    }
});

// 🏆 v0.3.8: Inline Sync Service Observer - 监听工具状态变更
coreUseChatStore.subscribe((state, prevState) => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant' || !lastMessage.toolCalls) return;

    const prevLastMessage = prevState.messages.find(m => m.id === lastMessage.id);

    lastMessage.toolCalls.forEach(tc => {
        const prevTc = prevLastMessage?.toolCalls?.find(ptc => ptc.id === tc.id);
        if (tc.status !== prevTc?.status) {
            InlineSyncService.updateToolStatus(tc.tool, tc.status);
        }
    });
});

export const useChatStore = coreUseChatStore;

// 🏆 v0.4.1: 物理级 E2E 挂载 - 确保测试脚本能第一时间锁定 ChatStore
if (typeof window !== 'undefined') {
    (window as any).__chatStore = coreUseChatStore;
}
