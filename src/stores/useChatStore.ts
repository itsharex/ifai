// Wrapper for core library useChatStore

// Handles dependency injection of file and settings stores

import { useChatStore as coreUseChatStore, registerStores, type Message } from 'ifainew-core';

import { useFileStore } from './fileStore';

import { useSettingsStore } from './settingsStore';

import { useAgentStore } from './agentStore';

import { useThreadStore } from './threadStore';
import { useSkillStore } from './skillStore';

import { invoke } from '@tauri-apps/api/core';

import { listen } from '@tauri-apps/api/event';

import { recognizeIntent, shouldTriggerAgent, formatAgentName } from '../utils/intentRecognizer';

import { autoSaveThread } from './persistence/threadPersistence';

import { countMessagesTokens, getModelMaxTokens, calculateTokenUsagePercentage } from '../utils/tokenCounter';

import i18n from '../i18n/config';

// 🔥 版本区分:根据版本显示不同的提示

import { IS_COMMERCIAL } from '../config/edition';

// 🔥 工具注册表

import { toolRegistry } from './tool/builtinTools';

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

const LOG_COLORS: Record<LogLevel, string> = {

  info: '#3498db',   // 蓝色

  warn: '#f39c12',   // 橙色

  error: '#e74c3c',  // 红色

  debug: '#95a5a6'   // 灰色

};

/**

 * 统一的日志输出函数

 * @param category 日志分类

 * @param level 日志级别

 * @param message 日志消息

 * @param data 附加数据（可选）

 */

function log(category: LogCategory, level: LogLevel, message: string, data?: any): void {

  const emoji = LOG_EMOJIS[level];

  const prefix = `[${category}] ${emoji}`;

  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12); // HH:MM:SS.mmm

  const logMessage = `${timestamp} ${prefix} ${message}`;

  // 根据日志级别选择输出方法

  const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (data !== undefined) {

    consoleMethod(logMessage, data);

  } else {

    consoleMethod(logMessage);

  }

}

/**

 * 便捷的日志函数

 */

const logInfo = (category: LogCategory, message: string, data?: any) => log(category, 'info', message, data);

const logWarn = (category: LogCategory, message: string, data?: any) => log(category, 'warn', message, data);

const logError = (category: LogCategory, message: string, data?: any) => log(category, 'error', message, data);

const logDebug = (category: LogCategory, message: string, data?: any) => log(category, 'debug', message, data);

// Content segment interface for tracking stream reception order

export interface ContentSegment {

  type: 'text' | 'tool';

  order: number;

  timestamp: number;

  content?: string;

  toolCallId?: string;  // Reference to toolCall by ID

  startPos?: number;    // Character position in full content (for precise tool interleaving)

  endPos?: number;      // End position in full content

}

// ============================================================================

// Thread-Aware Message Management

// ============================================================================

/**

 * Per-thread message storage.

 * Messages are stored per thread to enable quick switching between threads.

 * The core store's messages array is updated when switching threads.

 */

const threadMessages: Map<string, Message[]> = new Map();

/**

 * Get messages for a specific thread

 */

export function getThreadMessages(threadId: string): Message[] {

  return threadMessages.get(threadId) || [];

}

/**

 * Set messages for a specific thread

 */

export function setThreadMessages(threadId: string, messages: Message[]): void {

  threadMessages.set(threadId, messages);

  // Trigger auto-save

  autoSaveThread(threadId);

}

/**

 * Clear all thread messages (for testing/reset)

 */

export function clearThreadMessages(): void {

  threadMessages.clear();

}

/**

 * Generate thread title from message content

 */

function generateTitleFromMessage(content: string | any[]): string {

  let textContent = '';

  if (typeof content === 'string') {

    textContent = content;

  } else if (Array.isArray(content)) {

    textContent = content

      .filter(p => p.type === 'text')

      .map(p => p.text)

      .join(' ');

  }

  // Take first 30 characters as title

  const maxLength = 30;

  if (textContent.length > maxLength) {

    return textContent.slice(0, maxLength) + '...';

  }

  return textContent || '新对话';

}

/**

 * Switch to a different thread

 * Saves current messages to thread and loads the target thread's messages

 */

export function switchThread(threadId: string): void {

  const threadStore = useThreadStore.getState();

  const currentThreadId = threadStore.activeThreadId;

  // Save current thread messages before switching

  if (currentThreadId) {

    const currentMessages = coreUseChatStore.getState().messages;

    setThreadMessages(currentThreadId, [...currentMessages]);

  }

  // Switch to target thread

  threadStore.switchThread(threadId);

  // Load target thread messages

  const targetMessages = getThreadMessages(threadId);

  coreUseChatStore.setState({ messages: [...targetMessages] });

  console.log(`[Thread] Switched from ${currentThreadId} to ${threadId}, loaded ${targetMessages.length} messages`);

}

// Register stores on first import

// Pass getState functions so core library can access current state

registerStores(useFileStore.getState, useSettingsStore.getState, useThreadStore.getState);

// --- Monkey-patching Core Store ---

// Fixes for API errors and UI updates that reside in the core library

// =============================================================================

// Frontend Wrapper - Message Sanitization Removed

// =============================================================================

// Message sanitization is now handled authoritatively in the Rust backend

// (src-tauri/src/lib.rs in ai_chat function) to ensure consistency and avoid

// duplicate logic. The backend sanitizes messages immediately before sending

// to the AI API, which is the optimal place for this validation.

// =============================================================================

const originalSendMessage = coreUseChatStore.getState().sendMessage;

const originalApproveToolCall = coreUseChatStore.getState().approveToolCall;

const originalRejectToolCall = coreUseChatStore.getState().rejectToolCall;

/**

 * 智能消息上下文选择（支持 Token 限制）

 * 保留系统消息、最近消息、以及包含关键内容（tool_calls、references等）的历史消息

 * v0.2.6 新增：支持基于 Token 的上下文窗口管理

 *

 * @param messages - 所有历史消息

 * @param maxMessages - 最大保留消息数

 * @param model - 模型名称（用于 Token 计算）

 * @param maxTokens - 最大 Token 数（可选）

 * @returns - 过滤后的消息（保持原始顺序）

 */

async function selectMessagesForContext(

    messages: Message[],

    maxMessages: number,

    model?: string,

    maxTokens?: number

): Promise<Message[]> {

    // 1. 如果消息总数小于限制，直接返回

    if (messages.length <= maxMessages) {

        return messages;

    }

    // 2. 为每条消息计算优先级分数

    interface ScoredMessage {

        message: Message;

        score: number;

        index: number;  // 原始索引

        estimatedTokens: number;  // 估算的 Token 数

    }

    // 简单的 Token 估算函数（避免频繁调用后端）

    const estimateTokens = (msg: Message): number => {

        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

        if (!content || typeof content !== 'string') return 0;

        // 英文约 4 字符 = 1 Token，中文约 2 字符 = 1 Token

        const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;

        const otherChars = content.length - chineseChars;

        return Math.ceil((chineseChars / 2) + (otherChars / 4));

    };

    const scored: ScoredMessage[] = messages.map((msg, idx) => {

        let score = 0;

        const positionFromEnd = messages.length - 1 - idx;

        const estimatedTokens = estimateTokens(msg);

        // 规则1: 系统消息 - 最高优先级

        if (msg.role === 'system') {

            score = 1000;

        }

        // 规则2: 有 tool_calls 的消息

        else if (msg.toolCalls && msg.toolCalls.length > 0) {

            score = 500;

        }

        // 规则3: Tool 响应消息

        else if (msg.tool_call_id) {

            score = 450;

        }

        // 规则4: 有 RAG references 的消息

        else if ((msg as any).references && (msg as any).references.length > 0) {

            score = 300;

        }

        // 规则5: 用户消息

        else if (msg.role === 'user') {

            score = 100;

        }

        // 规则6: 助手消息

        else if (msg.role === 'assistant') {

            score = 50;

        }

        // 应用时间衰减：越近的消息权重越高

        const decayFactor = Math.pow(1.1, positionFromEnd);

        score = score * decayFactor;

        return { message: msg, score, index: idx, estimatedTokens };

    });

    // 3. 按分数降序排序，取前 maxMessages 条

    scored.sort((a, b) => b.score - a.score);

    let selected = scored.slice(0, maxMessages);

    // 4. 完整性检查：确保 tool_calls 和 tool_call_id 配对

    const selectedIndices = new Set(selected.map(s => s.index));

    // 4a. 检查 tool_calls 是否有对应的响应

    selected.forEach(s => {

        if (s.message.toolCalls && s.message.toolCalls.length > 0) {

            // 找到这条消息之后的所有 tool 响应

            for (let i = s.index + 1; i < messages.length; i++) {

                const responseMsg = messages[i];

                if (responseMsg.tool_call_id) {

                    // 检查这个响应是否属于当前的 tool_calls

                    const belongsToCurrent = s.message.toolCalls?.some(tc => tc.id === responseMsg.tool_call_id);

                    if (belongsToCurrent && !selectedIndices.has(i)) {

                        selectedIndices.add(i);

                        selected.push({

                            message: responseMsg,

                            score: 450,  // tool响应分数

                            index: i,

                            estimatedTokens: estimateTokens(responseMsg)

                        });

                    }

                }

            }

        }

    });

    // 4b. 检查 tool 响应是否有对应的 tool_calls

    selected.forEach(s => {

        if (s.message.tool_call_id) {

            // 向前查找对应的 tool_calls

            for (let i = s.index - 1; i >= 0; i--) {

                const requestMsg = messages[i];

                if (requestMsg.toolCalls && requestMsg.toolCalls.some(tc => tc.id === s.message.tool_call_id)) {

                    if (!selectedIndices.has(i)) {

                        selectedIndices.add(i);

                        selected.push({

                            message: requestMsg,

                            score: 500,  // tool_call分数

                            index: i,

                            estimatedTokens: estimateTokens(requestMsg)

                        });

                    }

                    break;

                }

            }

        }

    });

    // 5. v0.2.6 新增：Token 限制检查（滑动窗口策略）

    if (model && maxTokens) {

        const totalTokens = selected.reduce((sum, s) => sum + s.estimatedTokens, 0);

        if (totalTokens > maxTokens) {

            console.log(`[Context] Token limit exceeded: ${totalTokens} > ${maxTokens}, applying sliding window`);

            // 滑动窗口：保留最近的高优先级消息

            const maxTokenLimit = maxTokens * 0.9;  // 留 10% 余量

            // 按原始索引排序（时间顺序）

            selected.sort((a, b) => a.index - b.index);

            // 从最近的消息开始，向前累加 Token

            const windowSelected: typeof selected = [];

            let currentTokens = 0;

            // 首先保留所有系统消息

            const systemMessages = selected.filter(s => s.message.role === 'system');

            windowSelected.push(...systemMessages);

            currentTokens += systemMessages.reduce((sum, s) => sum + s.estimatedTokens, 0);

            // 然后从最近的消息开始添加

            for (let i = selected.length - 1; i >= 0; i--) {

                const s = selected[i];

                if (s.message.role === 'system') continue;  // 已添加

                if (currentTokens + s.estimatedTokens <= maxTokenLimit) {

                    windowSelected.push(s);

                    currentTokens += s.estimatedTokens;

                } else if (windowSelected.length < systemMessages.length + 3) {

                    // 至少保留系统消息 + 最后 3 条消息

                    windowSelected.push(s);

                    currentTokens += s.estimatedTokens;

                }

            }

            // 按时间顺序重新排序

            windowSelected.sort((a, b) => a.index - b.index);

            selected = windowSelected;

            console.log(`[Context] Sliding window applied: ${selected.length} messages, ~${currentTokens} tokens`);

        }

    }

    // 6. 按原始索引排序，保持时间顺序

    selected.sort((a, b) => a.index - b.index);

    // 7. 返回消息（去重后的）

    return selected.map(s => s.message);

}

const patchedSendMessage = async (content: string | any[], providerId: string, modelName: string) => {

    const callId = crypto.randomUUID().slice(0, 8);

    console.log(`>>> [${callId}] patchedSendMessage called:`, typeof content === 'string' ? content.slice(0, 50) : 'array');

    // 追踪用户消息是否已添加，防止双气泡问题

    let userMessageAdded = false;

    // 🔥 用户消息 ID（用于 RAG 引用监听器）

    let userMsgId: string;

    // Set loading state immediately to provide UI feedback

    coreUseChatStore.setState({ isLoading: true });

    // ========================================================================

    // Thread-Aware Message Management

    // ========================================================================

    const threadStore = useThreadStore.getState();

    let activeThreadId = threadStore.activeThreadId;

    // Create a new thread if none exists

    if (!activeThreadId) {

      activeThreadId = threadStore.createThread();

      console.log(`[Thread] Auto-created thread: ${activeThreadId}`);

    }

    // Load current thread messages into the core store

    const currentThreadMessages = getThreadMessages(activeThreadId);

    if (currentThreadMessages.length > 0) {

      coreUseChatStore.setState({ messages: currentThreadMessages });

    }

    // Get settings at the beginning (needed for both intent recognition and provider config)

    const settings = useSettingsStore.getState();

    // Slash Command Interception

    let textInput = "";

    if (typeof content === 'string') {

        textInput = content.trim();

    } else if (Array.isArray(content)) {

        textInput = content.map(p => p.type === 'text' ? p.text : '').join(' ').trim();

    }

    if (textInput.startsWith('/')) {

        const parts = textInput.split(' ');

        const command = parts[0].toLowerCase();

        const args = parts.slice(1).join(' ');

        const supportedAgents = ['/explore', '/review', '/test', '/doc', '/refactor'];

        if (supportedAgents.includes(command)) {

            const agentTypeBase = command.slice(1);

            const agentName = agentTypeBase.charAt(0).toUpperCase() + agentTypeBase.slice(1) + " Agent";

            const { addMessage } = coreUseChatStore.getState();

            userMsgId = crypto.randomUUID();

            addMessage({

                id: userMsgId,

                role: 'user',

                content: textInput,

                multiModalContent: typeof content === 'string' ? [{type: 'text', text: content}] : content

            });

            // 🔥 自动更新线程标题（斜杠命令也触发）

            const currentThread = threadStore.getThread(activeThreadId!);

            if (currentThread) {

                const isDefaultTitle = /^(上午|下午|晚上)(的新对话|的对话 \d+)$/.test(currentThread.title);

                if (isDefaultTitle) {

                    console.log('[ChatStore] Auto-updating thread title from slash command:', textInput);

                    threadStore.updateThreadTitleFromMessage(activeThreadId!, textInput);

                }

            }

            try {

                const assistantMsgId = crypto.randomUUID();

                addMessage({

                    id: assistantMsgId,

                    role: 'assistant',

                    content: ``,

                    // @ts-ignore - custom property

                    agentId: undefined,

                    isAgentLive: true

                });

                const agentId = await useAgentStore.getState().launchAgent(

                    agentName,

                    args || "No specific task provided",

                    assistantMsgId

                );

                const messages = coreUseChatStore.getState().messages;

                const msg = messages.find(m => m.id === assistantMsgId);

                if (msg) {

                    // @ts-ignore

                    msg.agentId = agentId;

                    coreUseChatStore.setState({ messages: [...messages] });

                }

            } catch (e) {

                addMessage({

                    id: crypto.randomUUID(),

                    role: 'assistant',

                    content: `❌ **Failed to launch agent**\n\nError: ${String(e)}`

                });

            }

            coreUseChatStore.setState({ isLoading: false });

            return;

        }

    }

    // 🔥 v0.3.0 多模态检测：如果当前消息包含图片，跳过意图识别和本地模型预处理

    // 因为本地模型不支持 Vision，必须路由到云端 Vision LLM

    // 并且图片识别应该由云端 LLM 处理，而不是 Agent

    const currentContentHasImages = Array.isArray(content) &&

        content.some((part: any) => part.type === 'image_url');

    if (currentContentHasImages) {

        console.log('[AI Chat] 🖼️ Image detected in current message, skipping intent recognition and local model preprocessing');

    }

    // --- Natural Language Intent Recognition ---

    // Check if settings enable natural language agent triggering

    const enableNaturalLanguageTrigger = settings.enableNaturalLanguageAgentTrigger !== false; // Default to true

    const confidenceThreshold = settings.agentTriggerConfidenceThreshold || 0.7;

    // 🔥 如果包含图片，跳过意图识别（图片识别应该由云端 LLM 处理）

    const editorMode = (window as any).__IFAI_EDITOR_MODE__ || "vibe";
    if (enableNaturalLanguageTrigger && textInput && !currentContentHasImages && editorMode !== "vibe") {

        const intentResult = recognizeIntent(textInput);

        // Log intent recognition result for debugging

        console.log('[NaturalLanguageTrigger] Intent recognized:', intentResult);

        if (shouldTriggerAgent(intentResult, confidenceThreshold)) {

            const agentType = intentResult.type;

            const agentTypeBase = agentType.slice(1); // Remove '/' prefix

            // 意图类型到 Agent 名称的映射

            // 默认规则：首字母大写 + " Agent"

            // 特殊映射：proposal -> proposal-generator

            const agentNameMap: Record<string, string> = {

                'proposal': 'proposal-generator',

                // 可以添加更多映射

            };

            const agentName = agentNameMap[agentTypeBase] ||

                (agentTypeBase.charAt(0).toUpperCase() + agentTypeBase.slice(1) + " Agent");

            console.log('[NaturalLanguageTrigger] Mapped agent:', {

                intentType: agentType,

                agentTypeBase,

                agentName,

                originalIntent: intentResult

            });

            const args = intentResult.args || textInput;

            const { addMessage } = coreUseChatStore.getState();

            userMsgId = crypto.randomUUID();

            addMessage({

                id: userMsgId,

                role: 'user',

                content: textInput,

                multiModalContent: typeof content === 'string' ? [{type: 'text', text: content}] : content

            });

            userMessageAdded = true;

            try {

                const assistantMsgId = crypto.randomUUID();

                addMessage({

                    id: assistantMsgId,

                    role: 'assistant',

                    content: `_[自动识别意图: ${formatAgentName(agentType)}，置信度: ${(intentResult.confidence * 100).toFixed(0)}%]_\n\n`,

                    // @ts-ignore - custom property

                    agentId: undefined,

                    isAgentLive: true

                });

                const agentId = await useAgentStore.getState().launchAgent(

                    agentName,

                    args,

                    assistantMsgId

                );

                const messages = coreUseChatStore.getState().messages;

                const msg = messages.find(m => m.id === assistantMsgId);

                if (msg) {

                    // @ts-ignore

                    msg.agentId = agentId;

                    coreUseChatStore.setState({ messages: [...messages] });

                }

                console.log('[NaturalLanguageTrigger] Agent launched successfully:', agentId);

            } catch (e) {

                addMessage({

                    id: crypto.randomUUID(),

                    role: 'assistant',

                    content: `❌ **无法启动Agent**\n\n错误: ${String(e)}`

                });

                console.error('[NaturalLanguageTrigger] Failed to launch agent:', e);

            }

            coreUseChatStore.setState({ isLoading: false });

            return;

        } else if (intentResult && intentResult.confidence > 0.5) {

            // Medium confidence: Log for future improvement

            console.log('[NaturalLanguageTrigger] Medium confidence intent detected but not triggered:', intentResult);

        }

    }

    // --- Local Model Preprocessing (Simple Q&A) ---

    // Check if local model should handle this request

    // 🔥 v0.3.0 多模态检测：如果当前消息包含图片，跳过本地模型预处理

    // 因为本地模型不支持 Vision，必须路由到云端 Vision LLM

    //（图片检测已在意图识别之前完成）

    // Get current messages for preprocessing

    const allCurrentMessages = coreUseChatStore.getState().messages;

    // 🔥 如果包含图片，跳过本地模型预处理

    if (!currentContentHasImages) {

    try {

        // Prepare simplified message history for local model (last 10 messages)

        const messagesForLocal = allCurrentMessages.slice(-10).map(m => ({

            role: m.role,

            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)

        }));

        // Add current user message

        messagesForLocal.push({

            role: 'user',

            content: textInput

        });

        // Add timeout for local model preprocessing (2 seconds)

        // This prevents the UI from hanging if the local model check takes too long

        const preprocessPromise = invoke<any>('local_model_preprocess', {

            messages: messagesForLocal

        });

        const timeoutPromise = new Promise((_, reject) => 

            setTimeout(() => reject(new Error('Local model preprocess timeout')), 2000)

        );

        const preprocessResult = await Promise.race([preprocessPromise, timeoutPromise]) as any;

        console.log('[LocalModel] Preprocess result:', preprocessResult);

        // If local model can handle this

        if (preprocessResult && preprocessResult.should_use_local) {

            const { addMessage } = coreUseChatStore.getState();

            // 🔥 v0.3.0 修复：先检查是否有实际的本地响应或工具调用

            // 如果没有，说明本地模型实际上无法处理，应该回退到云端 API

            const hasLocalContent = preprocessResult.local_response ||

                (preprocessResult.has_tool_calls && preprocessResult.tool_calls && preprocessResult.tool_calls.length > 0);

            if (!hasLocalContent) {

                console.log('[LocalModel] should_use_local=true but no local_response/tool_calls, falling back to cloud API');

                // 不添加用户消息，跳过本地处理，让后续云端 API 逻辑处理

            } else {

                // 有本地内容，执行本地处理逻辑...

            // Add user message

            const userMsgId = crypto.randomUUID();

            addMessage({

                id: userMsgId,

                role: 'user',

                content: textInput,

                multiModalContent: typeof content === 'string' ? [{type: 'text', text: content}] : content

            });

            userMessageAdded = true;

            // 🔥 自动更新线程标题（本地模型路径也触发）

            const currentThread = threadStore.getThread(activeThreadId!);

            if (currentThread) {

                const isDefaultTitle = /^(上午|下午|晚上)(的新对话|的对话 \d+)$/.test(currentThread.title);

                if (isDefaultTitle) {

                    console.log('[ChatStore] Auto-updating thread title from local model:', textInput);

                    threadStore.updateThreadTitleFromMessage(activeThreadId!, textInput);

                }

            }

            // If tool calls were parsed locally

            if (preprocessResult.has_tool_calls && preprocessResult.tool_calls.length > 0) {

                const assistantMsgId = crypto.randomUUID();

                // Convert local tool calls to our format

                const toolCalls = preprocessResult.tool_calls.map((tc: any) => ({

                    id: crypto.randomUUID(),

                    type: 'function' as const,

                    tool: tc.name,

                    args: tc.arguments,

                    function: {

                        name: tc.name,

                        arguments: JSON.stringify(tc.arguments)

                    },

                    status: 'pending' as const,

                    isLocalModel: true  // 标记为本地模型执行的工具调用

                }));

                addMessage({

                    id: assistantMsgId,

                    role: 'assistant',

                    content: '',

                    toolCalls

                });

                // Save thread

                const finalMessages = coreUseChatStore.getState().messages;

                const currentThreadId = useThreadStore.getState().activeThreadId;

                if (currentThreadId) {

                    setThreadMessages(currentThreadId, [...finalMessages]);

                }

                // Auto-approve tool calls

                for (const tc of toolCalls) {

                    await coreUseChatStore.getState().approveToolCall(assistantMsgId, tc.id);

                }

                coreUseChatStore.setState({ isLoading: false });

                return;

            }

            // If local response available (simple Q&A)

            else if (preprocessResult.local_response) {

                addMessage({

                    id: crypto.randomUUID(),

                    role: 'assistant',

                    content: `🤖 **本地模型回复**\n\n${preprocessResult.local_response}`

                });

                // Save thread messages

                const finalMessages = coreUseChatStore.getState().messages;

                const currentThreadId = useThreadStore.getState().activeThreadId;

                if (currentThreadId) {

                    setThreadMessages(currentThreadId, [...finalMessages]);

                    useThreadStore.getState().updateThreadTimestamp(currentThreadId);

                    useThreadStore.getState().incrementMessageCount(currentThreadId);

                }

                coreUseChatStore.setState({ isLoading: false });

                return;

            }

            }  // 🔥 关闭 else 分支（hasLocalContent === true）

        }

    } catch (e) {

        console.log('[LocalModel] Preprocess failed, falling back to cloud:', e);

        // Continue to cloud API

    }

    }  // 🔥 关闭 if (!currentContentHasImages) 分支

    // --- Direct Backend Invocation Logic ---

    // ✅ 修复：检查是否有正在流式传输的消息，避免重复创建占位符

    const { messages: currentMessages } = coreUseChatStore.getState();

    const lastAssistantMsg = currentMessages.filter(m => m.role === 'assistant').pop() as any;

    const isLastMessageStreaming = lastAssistantMsg && (

        !lastAssistantMsg.content ||

        (typeof lastAssistantMsg.content === 'string' && lastAssistantMsg.content.trim() === '') ||

        (lastAssistantMsg.contentSegments && lastAssistantMsg.contentSegments.length > 0)

    );

    if (isLastMessageStreaming) {

        console.warn('[Chat] Detected streaming assistant message, user wants to send new message');

        console.log('[Chat] Edition:', IS_COMMERCIAL ? 'Commercial (PRO)' : 'Community');

        // 🔥 版本区分处理:根据版本显示不同提示

        if (!IS_COMMERCIAL) {

          // 社区版:显示友好提示

          console.log('[Chat] Community Edition: Showing feature limitation message');

          coreUseChatStore.setState({ isLoading: false });

          const { addMessage } = coreUseChatStore.getState();

          addMessage({

            id: crypto.randomUUID(),

            role: 'assistant',

            content: '💡 **提示**: 快速连续发送消息功能仅在 PRO 版本中可用。\n\n请等待当前响应完成后,再发送下一条消息。升级到 PRO 版本可体验更流畅的对话体验。'

          });

          return;  // 社区版:停止处理新请求

        } else {

          // 商业版:自动取消前一个响应

          console.log('[Chat] Commercial Edition: Auto-cancelling previous response');

          coreUseChatStore.setState({

            messages: coreUseChatStore.getState().messages.map(m =>

                m.id === lastAssistantMsg.id

                    ? { ...m, content: lastAssistantMsg.content || '⏸️ 响应已取消' }

                    : m

            ),

            isLoading: false  // 重置加载状态

          });

          // 不显示警告,继续处理新请求

          // 用户发送新消息意味着他们想要放弃前一个响应

        }

    }

    // 1. Prepare Provider Config

    // Note: settings already retrieved above for intent recognition

    const providerData = settings.providers.find((p: any) => p.id === providerId);

    const providerConfig = {

        ...providerData,

        provider: providerId, 

        id: providerId,

        api_key: providerData?.apiKey || "",

        base_url: providerData?.baseUrl || "",

        apiKey: providerData?.apiKey || "",

        baseUrl: providerData?.baseUrl || "",

        models: [modelName],

        protocol: providerData?.protocol || "openai"

    };

    coreUseChatStore.setState({ isLoading: true });

    // 2. Add User Message (if not already added by slash commands or local model)

    if (!userMessageAdded) {

        // 移除特殊标记（如 [CHAT]、[TASK-EXECUTION]）用于显示，但保留原始 content 用于意图识别

        const displayContent = typeof content === 'string'

            ? content.replace(/^\[(CHAT|TASK-EXECUTION)\]\s*/, '').replace(/\[TASK-EXECUTION\]\s*/g, '')

            : content;

        // 检测是否为任务执行上下文（使用原始 content）

        const autoApproveTools = typeof content === 'string' && content.includes('[TASK-EXECUTION]');

        const userMsg = {

            id: crypto.randomUUID(),

            role: 'user' as const,

            content: displayContent,  // 使用清理后的内容显示

            // @ts-ignore - 添加自动审批标志

            autoApproveTools

        };

        // @ts-ignore

        coreUseChatStore.getState().addMessage(userMsg);

        userMessageAdded = true;

        // 🔥 自动更新线程标题（类似豆包，使用首条消息内容作为标题）

        // 检查是否是默认标题，如果是则更新为消息内容

        const currentThread = threadStore.getThread(activeThreadId!);

        if (currentThread) {

            const isDefaultTitle = /^(上午|下午|晚上)(的新对话|的对话 \d+)$/.test(currentThread.title);

            if (isDefaultTitle) {

                console.log('[ChatStore] Auto-updating thread title from first message:', displayContent);

                threadStore.updateThreadTitleFromMessage(activeThreadId!, displayContent);

            }

        }

    }

    // 3. Add Assistant Placeholder

    const assistantMsgId = crypto.randomUUID();

    const assistantMsgPlaceholder = {

        id: assistantMsgId,

        role: 'assistant' as const,

        content: '',

        // @ts-ignore - custom property for tracking stream order

        contentSegments: [] as ContentSegment[]

    };

    // @ts-ignore

    coreUseChatStore.getState().addMessage(assistantMsgPlaceholder);

    // 4. Prepare History with Smart Context Selection

    const allMessages = coreUseChatStore.getState().messages;

    const assistantPlaceholder = allMessages[allMessages.length - 1];  // 刚添加的占位符

    // 获取上下文配置

    const { maxContextMessages, enableSmartContextSelection, maxContextTokens } = useSettingsStore.getState();

    // 选择要发送的消息

    let messagesToSend: Message[];

    if (enableSmartContextSelection) {

        // v0.2.6 智能选择：支持 Token 限制

        const messagesWithoutPlaceholder = allMessages.slice(0, -1);

        messagesToSend = await selectMessagesForContext(

            messagesWithoutPlaceholder,

            maxContextMessages,

            modelName,  // 模型名称

            maxContextTokens  // Token 限制

        );

        // 调试日志：简化输出避免刷屏

        const selectedSummary = {

            total: messagesToSend.length,

            system: messagesToSend.filter(m => m.role === 'system').length,

            user: messagesToSend.filter(m => m.role === 'user').length,

            assistant: messagesToSend.filter(m => m.role === 'assistant').length,

            tools: messagesToSend.filter(m => m.toolCalls?.length).length,

        };

        console.log(`[Context] Selected ${messagesToSend.length}/${messagesWithoutPlaceholder.length} messages:`, selectedSummary);

        // 强制包含最后一条用户消息（防止被智能选择过滤）

        const userMessages = messagesWithoutPlaceholder.filter(m => m.role === 'user');

        if (userMessages.length > 0) {

            const lastUserMsg = userMessages[userMessages.length - 1];

            if (!messagesToSend.includes(lastUserMsg)) {

                console.log('[Chat Debug] Force-adding last user message that was filtered');

                messagesToSend.push(lastUserMsg);

            }

        }

    } else {

        // 传统模式：发送所有消息

        messagesToSend = allMessages.slice(0, -1);

    }

    // 🔥 v0.3.0 多模态修复：辅助函数处理消息内容

    // 如果 content 是 ContentPart[] 数组，保持原样发送给后端

    // 如果 content 是字符串，清理特殊标记

    const prepareMessageContent = (content: any): any => {

        // 如果是 ContentPart[] 数组，直接返回（包含图片）

        if (Array.isArray(content)) {

            return content;

        }

        // 如果是字符串，清理特殊标记

        let contentStr = content || '';

        if (typeof contentStr === 'string') {

            contentStr = contentStr.replace(/^\[(CHAT|TASK-EXECUTION)\]\s*/, '');

        }

        return contentStr;

    };

    // 转换为API格式

    const msgHistory = messagesToSend.map(m => {

        const toolCalls = m.toolCalls

            ? m.toolCalls

                .filter(tc => tc.tool) // 过滤掉没有 tool 名称的

                .map(tc => {

                    // 🔥 FIX: 使用 tc.function.arguments（流式累积的完整 JSON 字符串）而不是 tc.args

                    // tc.args 可能在 JSON.parse 失败时是空对象 {}，导致参数丢失

                    const argsString = (tc as any).function?.arguments || '{}';

                    return {

                        id: tc.id,

                        type: 'function',

                        function: {

                            name: tc.tool,

                            arguments: typeof argsString === 'string' ? argsString : JSON.stringify(argsString || {})

                        }

                    };

                })

            : undefined;

        // 🔥 v0.3.0: 使用 prepareMessageContent 保持 ContentPart[] 格式

        const content = prepareMessageContent(m.content);

        return {

            role: m.role,

            content: content,

            tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,

            tool_call_id: m.tool_call_id

        };

    });

    // 5. Setup Listeners

    // const { listen } = await import('@tauri-apps/api/event');

    // Status Listener

    const unlistenStatus = await listen<string>(`${assistantMsgId}_status`, (event) => {

        const { messages } = coreUseChatStore.getState();

        const lastAssistantMsg = messages.find(m => m.id === assistantMsgId);

        if (lastAssistantMsg) {

            // Safety check for payload type

            const safePayload = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);

            console.log(`[Chat] Status update: ${safePayload}`);

            if (!lastAssistantMsg.content) {

                const updatedMessages = messages.map(m => 

                    m.id === assistantMsgId ? { ...m, content: `_(${safePayload})_ \n\n` } : m

                );

                coreUseChatStore.setState({ messages: updatedMessages });

            }

        }

    });

    // Stream Content Listener - 接收流式消息内容

    // 🔥 FIX v0.4.0: 引入高性能缓冲渲染机制

    let renderRequested = false;

    let localMessagesBuffer: Message[] = [...coreUseChatStore.getState().messages];

    // 强制同步更新函数（用于关键时刻如 finish）

    const flushUpdates = () => {

        const { messages } = coreUseChatStore.getState();

        // 这里的逻辑在 unlistenStream 外部已经处理好了 updatedMessages

        // 所以我们只需要在这里触发最终的同步更新即可

    };

    const unlistenStream = await listen<string>(assistantMsgId, (event) => {

        // [v3 Robust Stream Listener] - 彻底防御 event.payload.match 崩溃

        let textChunk = '';

        let toolCallUpdate: any = null;

        try {

            const rawPayload: any = event.payload;

            if (rawPayload === null || rawPayload === undefined) return;

            // 策略 A: payload 已经是对象

            if (typeof rawPayload === 'object') {

                if (rawPayload.type === 'content' && rawPayload.content) {

                    const content = String(rawPayload.content);

                    // 🔥 FIX: 过滤掉本地模型工具执行摘要

                    const isLocalModelToolSummary =

                        content.includes('[Local Model] Completed in') ||

                        (content.includes('[OK] ') && content.includes('ms)\n{')) ||

                        (rawPayload.metadata?.source === 'local_model' && content.includes('[OK]'));

                    if (isLocalModelToolSummary) {

                        console.log('[Chat] 🚫 过滤掉本地模型工具执行摘要，避免重复显示');

                        return;

                    }

                    textChunk = content;

                } else if (rawPayload.type === 'tool_call' && rawPayload.toolCall) {
                    // 🔥 v0.9.25: 前端渲染断路器 - Vibe 模式禁止渲染工具卡片
                    const editorMode = (window as any).__IFAI_EDITOR_MODE__ || "vibe";
                    if (editorMode === "vibe") {
                        return;
                    }
                    toolCallUpdate = rawPayload.toolCall;

                } else if (rawPayload.type === 'thinking' || rawPayload.type === 'tool-result' || rawPayload.type === 'done') {

                    return;

                }

            } 

            // 策略 B: payload 是字符串

            else if (typeof rawPayload === 'string') {

                try {

                    const parsed = JSON.parse(rawPayload);

                    if (parsed && parsed.type === 'content' && parsed.content) {

                        const content = String(parsed.content);

                        const isLocalModelToolSummary =

                            content.includes('[Local Model] Completed in') ||

                            (content.includes('[OK] ') && content.includes('ms)\n{')) ||

                            (parsed.metadata?.source === 'local_model' && content.includes('[OK]'));

                        if (isLocalModelToolSummary) return;

                        textChunk = content;

                    } else if (parsed && parsed.type === 'tool_call' && parsed.toolCall) {

                        toolCallUpdate = parsed.toolCall;

                    }

                } catch (jsonErr) {

                    if (typeof rawPayload.match === 'function') {

                        const objects = rawPayload.match(/\{[^{}]+\}/g);

                        if (objects) {

                            for (let i = objects.length - 1; i >= 0; i--) {

                                try {

                                    const obj = JSON.parse(objects[i]);

                                    if (obj && obj.type === 'content' && obj.content) {

                                        const content = String(obj.content);

                                        const isLocalModelToolSummary =

                                            content.includes('[Local Model] Completed in') ||

                                            (content.includes('[OK] ') && content.includes('ms)\n{')) ||

                                            (obj.metadata?.source === 'local_model' && content.includes('[OK]'));

                                        if (isLocalModelToolSummary) continue;

                                        textChunk = content;

                                        break;

                                    }

                                } catch (e2) {}

                            }

                        }

                    }

                }

            }

        } catch (fatalErr) {

            console.error('[Fatal] Robust stream listener error:', fatalErr);

        }

        if (textChunk || toolCallUpdate) {

            // 🔥 v0.4.0: 批量处理逻辑

            // 并不是在这里直接更新 updatedMessages，而是先计算出结果

            // 由于 Zustand 的特性，我们直接对当前状态进行计算

            if (renderRequested) {

                // 已经调度了渲染，我们只需更新 buffer 即可（这里通过 closure 共享 messages 变量）

                // 但是 useChatStore.setState 是外部调用的，所以我们需要在内部维护一个最新的 messages

            }

            // 我们执行逻辑计算，更新本地缓冲区

            localMessagesBuffer = localMessagesBuffer.map(m => {

                if (m.id === assistantMsgId) {

                    const newMsg = { ...m };

                    // @ts-ignore

                    if (!newMsg.contentSegments) newMsg.contentSegments = [];

                    if (textChunk) {

                        const safeTextChunk = typeof textChunk === 'string' ? textChunk : JSON.stringify(textChunk);

                        newMsg.content = (newMsg.content || '') + safeTextChunk;

                        // 🔥 FIX: 不可变更新 contentSegments，防止黑屏

                        const order = (newMsg.contentSegments || []).length;

                        const startPos = (newMsg.content || '').length - textChunk.length;

                        // @ts-ignore

                        newMsg.contentSegments = [...(newMsg.contentSegments || []), {

                            type: 'text' as const, order, timestamp: Date.now(),

                            content: textChunk, startPos, endPos: newMsg.content.length

                        }];

                    }

                    if (toolCallUpdate) {

                        const toolName = toolCallUpdate.function?.name || toolCallUpdate.tool;

                        const newArgsChunk = toolCallUpdate.function?.arguments || '';

                        const existingCalls = newMsg.toolCalls || [];

                        const existingIndex = existingCalls.findIndex(tc => {

                            if (toolCallUpdate.id && tc.id === toolCallUpdate.id) return true;

                            if (toolCallUpdate.id === null && toolCallUpdate.index !== null) {

                                return (tc as any).index === toolCallUpdate.index;

                            }

                            return false;

                        });

                        if (existingIndex !== -1) {

                            const existingCall = existingCalls[existingIndex];

                            const updatedCalls = [...existingCalls];

                            const updatedArgsString = ((existingCall as any).function?.arguments || '') + newArgsChunk;

                            let parsedArgs: any;

                            try {

                                parsedArgs = JSON.parse(updatedArgsString);

                            } catch (e) {

                                parsedArgs = { ...existingCall.args };

                                const safeArgsString = String(updatedArgsString);

                                const contentMatch = safeArgsString.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);

                                if (contentMatch) {

                                    let content = contentMatch[1];

                                    content = content.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

                                    parsedArgs.content = content;

                                }

                                const relPathMatch = safeArgsString.match(/"rel_path"\s*:\s*"([^"]*)"/);

                                if (relPathMatch) parsedArgs.rel_path = relPathMatch[1];

                            }

                            updatedCalls[existingIndex] = {

                                ...existingCall,

                                id: toolCallUpdate.id || existingCall.id,

                                tool: toolName || (existingCall as any).tool,

                                args: parsedArgs,

                                function: { name: toolName || (existingCall as any).function?.name, arguments: updatedArgsString },

                                isPartial: true

                            } as any;

                            newMsg.toolCalls = updatedCalls;

                        } else {

                            const isValidToolName = toolName && toolName !== 'unknown' && toolName.trim().length > 0;

                            if (isValidToolName) {

                                let initialArgs: any;

                                try { initialArgs = newArgsChunk ? JSON.parse(newArgsChunk) : {}; } catch (e) { initialArgs = {}; }

                                const newToolCallId = toolCallUpdate.id || crypto.randomUUID();

                                const newToolCall = {

                                    id: newToolCallId, type: 'function' as const, tool: toolName, args: initialArgs,

                                    function: { name: toolName, arguments: newArgsChunk },

                                    status: 'pending' as const, isPartial: true, index: toolCallUpdate.index

                                };

                                // @ts-ignore

                                newMsg.toolCalls = [...existingCalls, newToolCall];

                                // 🔥 FIX: 不可变更新 contentSegments

                                const order = (newMsg.contentSegments || []).length;

                                // @ts-ignore

                                newMsg.contentSegments = [...(newMsg.contentSegments || []), { type: 'tool' as const, order, timestamp: Date.now(), toolCallId: newToolCallId }];

                            }

                        }

                    }

                    return newMsg;

                }

                return m;

            });

            // 🔥 v0.4.0 高性能渲染：使用 requestAnimationFrame 进行节流

            if (!renderRequested) {

                renderRequested = true;

                requestAnimationFrame(() => {

                    // 在下一帧触发真正的 UI 更新，使用最新的本地缓冲区

                    coreUseChatStore.setState({ messages: [...localMessagesBuffer] });

                    renderRequested = false;

                });

            }

        }

    });

    // References Listener (RAG)

    const unlistenRefs = await listen<string[]>("codebase-references", (event) => {

        coreUseChatStore.setState(state => ({

            messages: state.messages.map(m =>

                m.id === userMsgId ? { ...m, references: event.payload } : m

            )

        }));

    });

    // History Compaction Listener (Auto-summarization Fix)

    const unlistenCompacted = await listen<any[]>(`${assistantMsgId}_compacted`, (event) => {

        console.log("[Chat] History compacted event received", event.payload);

        const compactedMessages = event.payload.map((m: any, index: number) => {

            // Try to preserve original message IDs by matching with existing messages

            const existingMsg = coreUseChatStore.getState().messages.find(existing =>

                existing.role === m.role &&

                existing.content === m.content &&

                (!existing.toolCalls && !m.tool_calls ||

                 existing.toolCalls?.length === m.tool_calls?.length)

            );

            // Use existing ID if found, otherwise generate new one

            const id = existingMsg?.id || crypto.randomUUID();

            return {

                id,

                role: m.role,

                content: m.content,

                toolCalls: m.tool_calls,

                tool_call_id: m.tool_call_id,

                // Preserve other properties from existing message

                ...(existingMsg ? { agentId: (existingMsg as any).agentId, isAgentLive: (existingMsg as any).isAgentLive } : {})

            };

        });

        // Replace history but keep the currently streaming assistant message

        coreUseChatStore.setState({ messages: [...compactedMessages, assistantMsgPlaceholder] });

    });

    // Finish Listener - Finalize tool calls when streaming completes

    // Increase timeout for local LLMs (Ollama) which may be slower

    const finishTimeout = setTimeout(() => {

        console.warn(`[Chat] WARNING: _finish event timeout for ${assistantMsgId}_finish after 60 seconds`);

        console.warn(`[Chat] This suggests the backend stream did not complete properly`);

        // Timeout: cleanup all listeners including unlistenFinish to prevent leaks

        console.log(`[Chat] Cleaning up all listeners due to timeout`);

        unlistenStatus();

        unlistenStream();

        unlistenRefs();

        unlistenCompacted();

        unlistenFinish();  // Clean up finish listener to prevent memory leaks

        unlistenError();

        // Also set isLoading to false to allow user to send new messages

        coreUseChatStore.setState({ isLoading: false });

    }, 60000);  // Increased to 60 seconds for commercial version with ifainew-core

    const unlistenFinish = await listen<string>(`${assistantMsgId}_finish`, async (event) => {

        clearTimeout(finishTimeout);

        console.log("[Chat] Stream finished event received", event.payload); // Updated log message

        // 🔥 v0.4.0: 最终刷新缓冲区，确保没有任何残余更新未应用

        localMessagesBuffer = localMessagesBuffer.map(m => {

            if (m.id === assistantMsgId && m.toolCalls) {

                return {

                    ...m,

                    toolCalls: m.toolCalls.map(tc => ({

                        ...tc,

                        isPartial: false  // Mark as complete

                    }))

                };

            }

            return m;

        });

        coreUseChatStore.setState({ messages: [...localMessagesBuffer] });

        // Finalize all partial tool calls

        const finalizedMessages = coreUseChatStore.getState().messages;

        const assistantMsg = finalizedMessages.find(m => m.id === assistantMsgId);

        console.log(`[Chat] Assistant message toolCalls:`, assistantMsg?.toolCalls?.length || 0);

        if (assistantMsg?.toolCalls) {

            console.log(`[Chat] Tool calls:`, assistantMsg.toolCalls.map(tc => ({

                id: tc.id,

                tool: tc.tool,

                status: tc.status,

                isPartial: tc.isPartial

            })));

        }

        // ✨ NEW: Auto-approve tool calls (same logic as in patchedSendMessage)

        const settings = useSettingsStore.getState();

        const assistantIndex = coreUseChatStore.getState().messages.findIndex(m => m.id === assistantMsgId);

        // Find the user message that triggered this assistant message

        let userMessageHasAutoApprove = false;

        const currentMessages = coreUseChatStore.getState().messages;
        if (assistantIndex > 0) {
            for (let i = assistantIndex - 1; i >= 0; i--) {
                if (currentMessages[i].role === 'user') {
                    userMessageHasAutoApprove = (currentMessages[i] as any).autoApproveTools === true;
                    console.log(`[Chat] User message autoApproveTools: ${userMessageHasAutoApprove}`);

                    break;

                }

            }

        }

        // Check both global setting and message-level flag

        // 🔥 v0.3.4: 添加会话信任检查

        const approvalMode = settings.agentApprovalMode || 'session-once';

        const sessionId = useThreadStore.getState().activeThreadId || 'default';

        const sessionTrust = settings.trustedSessions?.[sessionId];

        // 🔥 修复：确保返回布尔值而不是 undefined

        const isSessionTrusted = sessionTrust ? Date.now() < sessionTrust.expiresAt : false;

        const shouldAutoApprove =

            settings.agentAutoApprove ||

            userMessageHasAutoApprove ||

            (approvalMode === 'always') ||

            (approvalMode === 'session-once' && isSessionTrusted) || (window.__IFAI_EDITOR_MODE__ === 'spec');

        console.log(`[Chat] 🔥 v0.3.4 Auto-approve check:`, {

            global: settings.agentAutoApprove,

            message: userMessageHasAutoApprove,

            approvalMode,

            sessionId,

            isSessionTrusted,

            result: shouldAutoApprove

        });

        if (shouldAutoApprove) {

            const message = coreUseChatStore.getState().messages.find(m => m.id === assistantMsgId);

            if (message && message.toolCalls) {

                const pendingToolCalls = message.toolCalls.filter(tc => tc.status === 'pending' && !tc.isPartial);

                if (pendingToolCalls.length > 0) {

                    console.log(`[Chat] Auto-approving ${pendingToolCalls.length} tool calls from patchedSendMessage`);

                    // 检查是否在自动工具调用循环中（防止无限循环）

                    const { messages } = coreUseChatStore.getState();

                    const recentToolCalls = messages

                        .slice(-5)  // 检查最近 5 条消息

                        .filter(m => m.toolCalls && m.toolCalls.length > 0);

                    // 如果最近有太多工具调用，可能是陷入了循环，停止自动继续

                    if (recentToolCalls.length >= 5) { // v0.2.6: 稍微放宽限制但增加严谨性

                        console.warn(`[Chat] Detected potential tool call loop, stopping auto-continue`);

                        coreUseChatStore.setState({ isLoading: false });

                    } else {

                        // 保持 isLoading 为 true，直到下一个响应生成

                        coreUseChatStore.setState({ isLoading: true });

                        // Execute all tool calls

                        for (const tc of pendingToolCalls) {

                            // @ts-ignore - third parameter not in type definition yet

                            await coreUseChatStore.getState().approveToolCall(assistantMsgId, tc.id, { skipContinue: true });

                        }

                        console.log(`[Chat] All tool calls executed from patchedSendMessage`);

                        // After all tools are executed, continue the conversation

                        const providerConfig = settings.providers.find(p => p.id === settings.currentProviderId);

                        if (providerConfig) {

                            console.log(`[Chat] Continuing conversation after tool execution (scheduled in 300ms)`);

                            // 使用 setTimeout 延迟调用

                            setTimeout(async () => {

                                console.log(`[Chat] Executing delayed continuation`);

                                // 手动清理当前函数的监听器

                                unlistenStatus();

                                unlistenStream();

                                unlistenRefs();

                                unlistenCompacted();

                                unlistenFinish();

                                unlistenError();

                                // Get updated messages with tool results

                                const finalMessages = coreUseChatStore.getState().messages;

                                // Continue the conversation - patchedGenerateResponse will keep isLoading: true

                                await patchedGenerateResponse(

                                    finalMessages,

                                    providerConfig,

                                    { enableTools: (window.__IFAI_EDITOR_MODE__ !== "vibe") }

                                );

                            }, 300);

                            // 重要：不在这里设置 isLoading: false，也不清理监听器（由延迟任务处理）

                            return;

                        } else {

                            coreUseChatStore.setState({ isLoading: false });

                        }

                    }

                }

            }

        }

        // Cleanup listeners (normal completion)

        console.log(`[Chat] Cleaning up listeners (normal completion)`);

        unlistenStatus();

        unlistenStream();

        unlistenRefs();

        unlistenCompacted();

        unlistenFinish();

        unlistenError();

        coreUseChatStore.setState({ isLoading: false });

    });

    // Error Listener - Handle stream errors

    const unlistenError = await listen<string>(`${assistantMsgId}_error`, (event) => {

        // Safety check for payload type

        const safePayload = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);

        console.error("[Chat] Stream error", safePayload);

        const { messages } = coreUseChatStore.getState();

        coreUseChatStore.setState({

            messages: messages.map(m =>

                m.id === assistantMsgId ? { ...m, content: `❌ Error: ${safePayload}` } : m

            )

        });

        // Error: cleanup listeners

        unlistenStatus();

        unlistenStream();

        unlistenRefs();

        unlistenCompacted();

        unlistenFinish();

        unlistenError();

        coreUseChatStore.setState({ isLoading: false });

    });

    // 6. Invoke Backend

    try {

        await invoke('ai_chat', {
            providerConfig,
            messages: msgHistory,
            eventId: assistantMsgId,
            projectRoot: useFileStore.getState().rootPath,
            enableTools: (window.__IFAI_EDITOR_MODE__ !== "vibe"),
            activeSkillIds: (window as any).__IFAI_ACTIVE_SKILLS__ || [],
            mode: (window as any).__IFAI_EDITOR_MODE__ || "vibe"
        });

    } catch (e) {

        console.error('[Chat] Invoke error:', e);

        const { messages } = coreUseChatStore.getState();

        const errorMsg = e instanceof Error ? e.message : String(e);

        coreUseChatStore.setState({

            messages: messages.map(m => m.id === assistantMsgId ? {

                ...m,

                content: `❌ 发送失败: ${errorMsg}\n\n请检查：\n1. API Key 是否配置正确\n2. 网络连接是否正常\n3. 控制台是否有详细错误信息`

            } : m)

        });

        // Error: cleanup listeners

        unlistenStatus();

        unlistenStream();

        unlistenRefs();

        unlistenCompacted();

        unlistenFinish();

        unlistenError();

        coreUseChatStore.setState({ isLoading: false });

    }

    // Note: Listener cleanup is now handled in the _finish handler

    // This ensures listeners are not cleaned up before _finish event is received

};

const patchedGenerateResponse = async (history: any[], providerConfig: any, options?: { enableTools?: boolean }) => {

    console.log(">>> patchedGenerateResponse called");

    const settings = useSettingsStore.getState();

    const fullProviderConfig = settings.providers.find((p: any) => p.id === providerConfig.id) || providerConfig;

    const backendConfig = {

        ...fullProviderConfig, provider: fullProviderConfig.id, id: fullProviderConfig.id,

        api_key: fullProviderConfig.apiKey || "", base_url: fullProviderConfig.baseUrl || "",

        models: [settings.currentModel], protocol: fullProviderConfig.protocol || "openai"

    };

    coreUseChatStore.setState({ isLoading: true });

    const currentMessages = coreUseChatStore.getState().messages;

    let reusableAssistantMsgId: string | null = null;

    for (let i = currentMessages.length - 1; i >= 0; i--) {

        const msg = currentMessages[i];

        if (msg.role === 'assistant' && (!msg.content || (typeof msg.content === 'string' && msg.content.trim().length === 0)) && msg.toolCalls && msg.toolCalls.length > 0) {

            reusableAssistantMsgId = msg.id;

            break;

        }

    }

    let assistantMsgId: string;

    if (reusableAssistantMsgId) {

        assistantMsgId = reusableAssistantMsgId;

        console.log('[patchedGenerateResponse] 复用 assistant 消息:', assistantMsgId);

    } else {

        assistantMsgId = crypto.randomUUID();

        const assistantMsgPlaceholder = {

            id: assistantMsgId, role: 'assistant' as const, content: '', contentSegments: [] as ContentSegment[]

        };

        // @ts-ignore

        coreUseChatStore.getState().addMessage(assistantMsgPlaceholder);

    }

    const messages = coreUseChatStore.getState().messages;

    let messagesForHistory = messages;

    const lastMsg = messages[messages.length - 1];

    if (lastMsg && lastMsg.id === assistantMsgId && lastMsg.role === 'assistant' && (!lastMsg.content || lastMsg.content === '')) {

        messagesForHistory = messages.slice(0, -1);

    }

    const msgHistory = messagesForHistory.map(m => {

        const toolCalls = m.toolCalls?.filter(tc => tc.tool).map(tc => {

            const argsString = (tc as any).function?.arguments || (typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args || {}));

            return { id: tc.id, type: 'function', function: { name: tc.tool, arguments: argsString } };

        });

        return {

            role: m.role,

            content: Array.isArray(m.content) ? m.content : (m.content || ''),

            tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,

            tool_call_id: m.tool_call_id

        };

    });

    let renderRequested = false;

    let localMessagesBuffer: Message[] = [...coreUseChatStore.getState().messages];

    const unlistenStatus = await listen<string>(`${assistantMsgId}_status`, (event) => {

        const safe = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);

        localMessagesBuffer = localMessagesBuffer.map(m => (m.id === assistantMsgId && !m.content) ? { ...m, content: `_(${safe})_ 

` } : m);

        if (!renderRequested) {

            renderRequested = true;

            requestAnimationFrame(() => { coreUseChatStore.setState({ messages: [...localMessagesBuffer] }); renderRequested = false; });

        }

    });

    const unlistenStream = await listen<string>(assistantMsgId, (event) => {

        let textChunk = '';

        let toolCallUpdate: any = null;

        try {

            const raw: any = event.payload;

            if (!raw) return;

            if (typeof raw === 'object') {

                if (raw.type === 'content') textChunk = String(raw.content);

                else if (raw.type === 'tool_call') toolCallUpdate = raw.toolCall;

            } else if (typeof raw === 'string') {

                try {

                    const p = JSON.parse(raw);

                    if (p.type === 'content') textChunk = String(p.content);

                    else if (p.type === 'tool_call') toolCallUpdate = p.toolCall;

                } catch {

                    const objs = raw.match(/\{[^{}]+\}/g);

                    if (objs) {

                        const p = JSON.parse(objs[objs.length-1]);

                        if (p.type === 'content') textChunk = String(p.content);

                    }

                }

            }

        } catch (e) { console.error('[Stream] Parse error', e); }

        if (textChunk || toolCallUpdate) {

            localMessagesBuffer = localMessagesBuffer.map(m => {

                if (m.id === assistantMsgId) {

                    const newMsg = { ...m };

                    newMsg.contentSegments = m.contentSegments ? [...m.contentSegments] : [];

                    if (textChunk) {

                        newMsg.content = (newMsg.content || '') + textChunk;

                        const order = newMsg.contentSegments.length;

                        const startPos = (newMsg.content || '').length - textChunk.length;

                        newMsg.contentSegments = [...newMsg.contentSegments, { type: 'text' as const, order, timestamp: Date.now(), content: textChunk, startPos, endPos: newMsg.content.length }];

                    }

                    if (toolCallUpdate) {

                        const toolName = toolCallUpdate.function?.name || toolCallUpdate.tool;

                        const newArgs = toolCallUpdate.function?.arguments || '';

                        const existingCalls = newMsg.toolCalls || [];

                        const idx = existingCalls.findIndex(tc => (toolCallUpdate.id && tc.id === toolCallUpdate.id) || (toolCallUpdate.id === null && (tc as any).index === toolCallUpdate.index));

                        if (idx !== -1) {

                            const tc = existingCalls[idx];

                            const argsStr = ((tc as any).function?.arguments || '') + newArgs;

                            let parsed = { ...tc.args };

                            try { parsed = JSON.parse(argsStr); } catch {
                                const match = argsStr.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                                if (match) parsed.content = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                            }

                            const updated = [...existingCalls];

                            updated[idx] = { ...tc, args: parsed, function: { name: toolName, arguments: argsStr }, isPartial: true };

                            newMsg.toolCalls = updated;

                        } else {

                            const tid = toolCallUpdate.id || crypto.randomUUID();

                            const tc = { id: tid, type: 'function' as const, tool: toolName, args: {}, function: { name: toolName, arguments: newArgs }, status: 'pending' as const, isPartial: true, index: toolCallUpdate.index };

                            newMsg.toolCalls = [...existingCalls, tc];

                            const order = newMsg.contentSegments.length;

                            newMsg.contentSegments = [...newMsg.contentSegments, { type: 'tool' as const, order, timestamp: Date.now(), toolCallId: tid }];

                        }

                    }

                    return newMsg;

                }

                return m;

            });

            if (!renderRequested) {

                renderRequested = true;

                requestAnimationFrame(() => { coreUseChatStore.setState({ messages: [...localMessagesBuffer] }); renderRequested = false; });

            }

        }

    });

    const unlistenFinish = await listen<string>(`${assistantMsgId}_finish`, async (event) => {

        console.log("[Chat/GenerateResponse] Stream finished");

        localMessagesBuffer = localMessagesBuffer.map(m => (m.id === assistantMsgId && m.toolCalls) ? { ...m, toolCalls: m.toolCalls.map(tc => ({ ...tc, isPartial: false })) } : m);

        coreUseChatStore.setState({ messages: [...localMessagesBuffer] });

        const settings = useSettingsStore.getState();

        const finalizedMessages = coreUseChatStore.getState().messages;

        const assistantIndex = finalizedMessages.findIndex(m => m.id === assistantMsgId);

        let userMessageHasAutoApprove = false;

        if (assistantIndex > 0) {

            for (let i = assistantIndex - 1; i >= 0; i--) {

                if (finalizedMessages[i].role === 'user') {

                    userMessageHasAutoApprove = (finalizedMessages[i] as any).autoApproveTools === true;

                    break;

                }

            }

        }

        const approvalMode = settings.agentApprovalMode || 'session-once';

        const sessionId = useThreadStore.getState().activeThreadId || 'default';

        const sessionTrust = settings.trustedSessions?.[sessionId];

        const isSessionTrusted = sessionTrust ? Date.now() < sessionTrust.expiresAt : false;

        const shouldAutoApprove = settings.agentAutoApprove || userMessageHasAutoApprove || (approvalMode === 'always') || (approvalMode === 'session-once' && isSessionTrusted) || (window.__IFAI_EDITOR_MODE__ === 'spec');

        if (shouldAutoApprove) {

            const message = finalizedMessages.find(m => m.id === assistantMsgId);

            if (message && message.toolCalls) {

                const pendingToolCalls = message.toolCalls.filter(tc => tc.status === 'pending' && !tc.isPartial);

                if (pendingToolCalls.length > 0) {

                    for (const tc of pendingToolCalls) {

                        // @ts-ignore

                        await coreUseChatStore.getState().approveToolCall(assistantMsgId, tc.id, { skipContinue: true });

                    }

                    const providerConfig = settings.providers.find(p => p.id === settings.currentProviderId);

                    if (providerConfig) {

                        setTimeout(async () => {

                            unlistenStatus(); unlistenStream(); unlistenFinish(); unlistenError();

                            await patchedGenerateResponse(coreUseChatStore.getState().messages, providerConfig, { enableTools: (window.__IFAI_EDITOR_MODE__ !== "vibe") });

                        }, 500);

                        return;

                    }

                }

            }

        }

        unlistenStatus(); unlistenStream(); unlistenFinish(); unlistenError();

        coreUseChatStore.setState({ isLoading: false });

    });

    const unlistenError = await listen<string>(`${assistantMsgId}_error`, (event) => {

        const safe = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);

        coreUseChatStore.setState(s => ({ messages: s.messages.map(m => m.id === assistantMsgId ? { ...m, content: `❌ Error: ${safe}` } : m), isLoading: false }));

        unlistenStatus(); unlistenStream(); unlistenFinish(); unlistenError();

    });

        try {

            await invoke('ai_chat', { 

                providerConfig: backendConfig, 

                messages: msgHistory, 

                eventId: assistantMsgId, 

                projectRoot: useFileStore.getState().rootPath, 

                enableTools: (window.__IFAI_EDITOR_MODE__ !== "vibe"),

                                activeSkillIds: (window as any).__IFAI_ACTIVE_SKILLS__ || [],

                                mode: (window as any).__IFAI_EDITOR_MODE__ || "vibe"

                            });

                

        } catch (e) {

    

        coreUseChatStore.setState(s => ({ messages: s.messages.map(m => m.id === assistantMsgId ? { ...m, content: `❌ Error: ${e}` } : m), isLoading: false }));

        unlistenStatus(); unlistenStream(); unlistenFinish(); unlistenError();

    }

};

const autoApprovedIds = new Set();
const patchedApproveToolCall = async (

    messageId: string,

    toolCallId: string,

    options?: { skipContinue?: boolean }

) => {

    console.log(`[useChatStore] patchedApproveToolCall called - messageId: ${messageId}, toolCallId: ${toolCallId}, options:`, options);

    const state = coreUseChatStore.getState();

    let message = state.messages.find(m => m.id === messageId);

    let toolCall = message?.toolCalls?.find(tc => tc.id === toolCallId);

    // 🔥 FIX: 终端状态保护 - 防止覆盖已完成/失败/拒绝的工具调用

    // 与 agentStore.ts 中的保护逻辑保持一致

    const TERMINAL_STATES = ['completed', 'failed', 'rejected'] as const;

    if (toolCall && TERMINAL_STATES.includes(toolCall.status as any)) {

        console.warn(`[useChatStore] ⚠️ ToolCall already in terminal state: ${toolCall.status}, skipping approval`, {

            toolCallId,

            currentStatus: toolCall.status,

            toolName: toolCall.tool

        });

        return;

    }

    // 🔥 FIX v0.3.7: ID 重定向逻辑 - 处理智谱 API 重复 tool_call 导致的 ID 不匹配

    if (!message || !toolCall) {

        const agentStore = useAgentStore.getState();

        const canonicalId = agentStore.deduplicator.getCanonicalId(toolCallId);

        // 🔥 FIX v0.3.8.2: 添加详细诊断日志

        const threadStore = useThreadStore.getState();

        console.error(`[useChatStore] ❌ Message or ToolCall not found`, {

            messageId,

            toolCallId,

            messageFound: !!message,

            toolCallFound: !!toolCall,

            currentThreadId: threadStore.activeThreadId,

            totalMessages: state.messages.length,

            allMessageIds: state.messages.map(m => m.id).slice(0, 5), // 显示前5个消息ID

        });

        if (canonicalId) {

            console.log(`[useChatStore] 🔄 ID Redirect: ${toolCallId} -> ${canonicalId}`);

            message = state.messages.find(m => m.id === messageId);

            toolCall = message?.toolCalls?.find(tc => tc.id === canonicalId);

            if (toolCall) {

                console.log(`[useChatStore] ✅ ID Redirect successful: found tool_call with canonical ID`);

            } else {

                console.error(`[useChatStore] ❌ ID Redirect failed: canonical ID ${canonicalId} also not found`);

                return;

            }

        } else {

            console.error("[useChatStore] ❌ No redirect mapping found. This message might belong to a different thread or has been deleted.");

            return;

        }

    }

    // 1. Handle Agent Tool Calls (delegated to AgentStore)

    if ((toolCall as any).agentId) {

        const agentId = (toolCall as any).agentId;

        console.log(`[useChatStore] Using Agent approval flow for agent ${agentId}`);

        coreUseChatStore.setState(state => ({

            messages: state.messages.map(m =>

                m.id === messageId ? {

                    ...m,

                    toolCalls: m.toolCalls?.map(tc =>

                        tc.id === toolCallId ? { ...tc, status: 'approved' as const } : tc

                    )

                } : m

            )

        }));

        console.log(`[useChatStore] Calling approveAction for agent ${agentId}`);

        await useAgentStore.getState().approveAction(agentId, true);

        console.log(`[useChatStore] approveAction completed for agent ${agentId}`);

        // 🐛 FIX: Agent 执行完成后，更新工具状态为 completed

        const agentStore = useAgentStore.getState();

        const agent = agentStore.runningAgents.find(a => a.id === agentId);

        if (agent && agent.status === 'completed') {

            console.log(`[useChatStore] Agent completed, updating tool status to completed`);

            coreUseChatStore.setState(state => ({

                messages: state.messages.map(m =>

                    m.id === messageId ? {

                        ...m,

                        toolCalls: m.toolCalls?.map(tc =>

                            tc.id === toolCallId ? { ...tc, status: 'completed' as const } : tc

                        )

                    } : m

                )

            }));

        }

        useFileStore.getState().refreshFileTree();

        return;

    }

    // 2. Handle File System Tools (Manual Invocation to fix snake_case args)

    // 🔥 包含所有使用 snake_case 参数的 agent 工具，确保 DeepSeek 流式调用正确解析

    const fsTools = [

        'agent_write_file',

        'agent_read_file',

        'agent_list_dir',

        'agent_delete_file',

        'agent_list_functions',

        'agent_read_file_range'

    ];

    const toolName = toolCall.tool || (toolCall as any).function?.name;

    let relPath = '';  // 在 try 块外声明，以便 catch 块也能访问

    if (fsTools.includes(toolName)) {

        console.log(`[useChatStore] Intercepting FS tool: ${toolName}`);

        // 🔥 DEBUG: 输出 toolCall 的完整状态以便诊断

        console.log('[FS Tool] toolCall.id:', toolCall.id);

        console.log('[FS Tool] toolCall.tool:', toolCall.tool);

        console.log('[FS Tool] toolCall.args:', JSON.stringify(toolCall.args));

        console.log('[FS Tool] toolCall.function:', JSON.stringify((toolCall as any).function));

        console.log('[FS Tool] toolCall keys:', Object.keys(toolCall));

        // Update status to approved

        coreUseChatStore.setState(state => ({

            messages: state.messages.map(m =>

                m.id === messageId ? {

                    ...m,

                    toolCalls: m.toolCalls?.map(tc =>

                        tc.id === toolCallId ? { ...tc, status: 'approved' as const } : tc

                    )

                } : m

            )

        }));

        try {

            const rootPath = useFileStore.getState().rootPath;

            if (!rootPath) throw new Error("No project root opened");

            // 🔥 FIX: 优先使用 tc.function.arguments（流式累积的完整 JSON 字符串）

            // tc.args 可能在流式解析过程中是空对象，导致参数丢失

            let args: any = toolCall.args || {};

            // 如果 args 是空对象，尝试从 function.arguments 中解析

            if (Object.keys(args).length === 0) {

                const argsString = (toolCall as any).function?.arguments;

                if (argsString && typeof argsString === 'string') {

                    try {

                        args = JSON.parse(argsString);

                        console.log('[FS Tool] Parsed args from function.arguments:', args);

                    } catch (e) {

                        console.warn('[FS Tool] Failed to parse function.arguments:', e);

                        args = {};

                    }

                }

            }

            console.log('[FS Tool] Final args:', JSON.stringify(args));

            console.log('[FS Tool] args keys:', Object.keys(args));

            // Get default relPath based on tool type

            const getDefaultRelPath = () => {

                if (toolName === 'agent_list_dir') return '.';

                return '';

            };

            // Fix arguments: snake_case (LLM) -> camelCase (Tauri)

            relPath = args.rel_path || args.relPath || getDefaultRelPath();

            let content: string = args.content || "";

            // 🔥 agent_read_file_range 额外参数

            const startLine = args.start_line ?? args.startLine ?? 1;

            const endLine = args.end_line ?? args.endLine ?? 100;

            console.log('[FS Tool] Final relPath:', relPath);

            console.log('[FS Tool] Final content length:', content.length);

            console.log('[FS Tool] Final content preview:', content.substring(0, 100));

            console.log('[FS Tool] Start line:', startLine, 'End line:', endLine);

            // Debug: log content before unescaping

            console.log('[FS Tool] Content preview (first 200 chars):', content.substring(0, 200));

            console.log('[FS Tool] Has literal \\n:', content.includes('\\n'));

            console.log('[FS Tool] Has literal \\r\\n:', content.includes('\\r\\n'));

            console.log('[FS Tool] Has actual newline:', content.includes('\n'));

            // Content unescaping fix: if content is stringified with escaped newlines, restore them

            // Handle multiple escape formats

            if (typeof content === 'string' && (content.includes('\\n') || content.includes('\\r') || content.includes('\\t'))) {

                console.log('[FS Tool] Unescaping content...');

                content = content

                    .replace(/\\r\\n/g, '\n')   // Windows-style CRLF

                    .replace(/\\n/g, '\n')       // Unix-style LF

                    .replace(/\\r/g, '\r')       // CR

                    .replace(/\\t/g, '\t')       // Tab

                    .replace(/\\"/g, '"')        // Escaped quotes

                    .replace(/\\\\/g, '\\');     // Escaped backslashes (must be last)

                console.log('[FS Tool] Unescaped content preview:', content.substring(0, 200));

            }

            // 🔥 构建参数对象，根据工具类型包含不同的参数

            const tauriArgs: any = {

                rootPath,

                relPath,

            };

            // 根据工具类型添加特定参数

            if (toolName === 'agent_write_file') {

                tauriArgs.content = content;

            } else if (toolName === 'agent_read_file_range') {

                tauriArgs.startLine = startLine;

                tauriArgs.endLine = endLine;

            }

            console.log(`[useChatStore] Invoking ${toolName} with`, tauriArgs);

            // 🔥 回滚功能：对于 agent_write_file，先捕获原始内容

            let originalContent = '';

            if (toolName === 'agent_write_file') {

                try {

                    originalContent = await invoke('agent_read_file', {

                        rootPath,

                        relPath

                    });

                    console.log('[Rollback] Captured original content for:', relPath);

                } catch (e) {

                    // 文件不存在，这是新建文件，originalContent 保持空字符串

                    console.log('[Rollback] New file detected:', relPath);

                }

            }

            const result = await invoke(toolName, tauriArgs);

            // 🔥 回滚功能：包装 result 以包含回滚数据和 diff 所需数据

            let stringResult: string;

            if (toolName === 'agent_write_file') {

                console.log('[Rollback] Building enhancedResult with content length:', content.length);

                console.log('[Rollback] content preview:', content.substring(0, 100));

                const enhancedResult = {

                    success: true,

                    message: typeof result === 'string' ? result : JSON.stringify(result),

                    originalContent: originalContent || '',  // 空字符串表示新建文件

                    newContent: content,  // 🔥 新增：保存新写入的内容，用于 diff 显示

                    filePath: `${rootPath}/${relPath}`.replace(/\/\//g, '/'),

                    timestamp: Date.now()

                };

                console.log('[Rollback] enhancedResult.newContent length:', enhancedResult.newContent.length);

                stringResult = JSON.stringify(enhancedResult);

                console.log('[Rollback] Enhanced result with rollback data and newContent');

            } else {

                // 🔥 FIX: 处理 ifainew_core 返回的字符数组问题

                // agent_read_file 可能返回字符数组而不是字符串

                if (typeof result === 'string') {

                    stringResult = result;

                } else if (Array.isArray(result)) {

                    // 检查是否是字符数组（每个元素都是字符串）

                    // 🔥 v0.3.4 修复：放宽长度限制，只检查是否都是字符串

                    const isStringArray = result.length > 0 &&

                                         result.every((item: any) => typeof item === 'string');

                    // 🔥 v0.3.4 FIX: 检查是否是字符数组（每个元素长度 <= 1）

                    const isCharArray = result.length > 10 &&

                                       result.every((item: any) => typeof item === 'string' && item.length <= 1);

                    if (isStringArray) {

                        // 字符串数组：拼接成字符串

                        // 适用于 agent_read_file 返回字符数组的情况

                        console.log(`[useChatStore] 🔥 Detected string array, joining ${result.length} elements`);

                        // 🔥 v0.3.4 FIX: 对于 agent_read_file，包装成对象格式以便简洁显示

                        if (toolName === 'agent_read_file') {

                            const fileContent = result.join('');

                            const wrappedResult = {

                                path: relPath,

                                content: fileContent

                            };

                            stringResult = JSON.stringify(wrappedResult);

                            console.log(`[useChatStore] 🔥 Wrapped agent_read_file result with path: ${relPath}, content length: ${fileContent.length}`);

                        }

                        // 🔥 v0.3.4 FIX: 对于 agent_list_dir，保留数组格式

                        // 不拼接字符数组，让 formatToolResultToMarkdown 能够正确处理

                        else if (toolName === 'agent_list_dir') {

                            // 直接用 JSON.stringify 保留数组结构

                            stringResult = JSON.stringify(result);

                            console.log(`[useChatStore] 🔥 agent_list_dir: keeping array format (${result.length} elements)`);

                        } else {

                            // 其他工具：拼接成字符串

                            stringResult = result.join('');

                        }

                    } else {

                        // 普通数组：使用 JSON.stringify

                        stringResult = JSON.stringify(result);

                    }

                } else {

                    // 对象或其他类型：使用 JSON.stringify

                    stringResult = JSON.stringify(result);

                }

            }

            // Update status to completed

            coreUseChatStore.setState(state => ({

                messages: state.messages.map(m =>

                    m.id === messageId ? {

                        ...m,

                        toolCalls: m.toolCalls?.map(tc =>

                            tc.id === toolCallId ? { ...tc, status: 'completed' as const, result: stringResult } : tc

                        )

                    } : m

                )

            }));

            // Sync with editor if the file is open

            const fileStore = useFileStore.getState();

            const openedFile = fileStore.openedFiles.find(f => f.path.endsWith(relPath));

            if (openedFile) {

                await fileStore.reloadFileContent(openedFile.id);

            }

            // 🔥 FIX: 对于 agent_read_file 和 agent_list_dir，tool 消息应该包含实际内容

            let toolMessageContent = i18n.t('tool.success', { toolName: `${toolName} > ${relPath}` });

            // agent_read_file: 返回文件内容

            if (toolName === 'agent_read_file' && stringResult !== undefined) {

                // 🔥 v0.3.4 FIX: 解析 JSON 格式的结果，提取文件内容

                let fileContent = stringResult;

                try {

                    const parsed = JSON.parse(stringResult);

                    if (parsed.content) {

                        fileContent = parsed.content;

                    }

                } catch (e) {

                    // 不是 JSON，使用原始字符串

                }

                // 对于文件读取，将文件内容作为 tool 消息发送给 LLM

                // 限制内容长度避免超出 token 限制

                const maxContentLength = 50000; // 50KB 限制

                if (fileContent.length > maxContentLength) {

                    toolMessageContent = `[文件内容过长，已截取前 ${maxContentLength} 字符]\n\n` + fileContent.substring(0, maxContentLength) + `\n\n... (省略剩余 ${fileContent.length - maxContentLength} 字符)`;

                } else {

                    toolMessageContent = fileContent;

                }

                console.log(`[useChatStore] File read result: ${fileContent.length} chars, truncated to ${toolMessageContent.length} chars`);

            }

            // agent_list_dir: 返回目录列表

            if (toolName === 'agent_list_dir' && stringResult !== undefined) {

                // 对于目录列表，将文件/目录列表作为 tool 消息发送给 LLM

                // 限制列表长度避免超出 token 限制

                const maxListLength = 10000; // 10KB 限制

                if (stringResult.length > maxListLength) {

                    toolMessageContent = `[目录列表过长，已截取前 ${maxListLength} 字符]\n\n` + stringResult.substring(0, maxListLength) + `\n\n... (省略剩余 ${stringResult.length - maxListLength} 字符)`;

                } else {

                    toolMessageContent = stringResult;

                }

                console.log(`[useChatStore] Dir list result: ${stringResult.length} chars, truncated to ${toolMessageContent.length} chars`);

            }

            // Add Tool Output Message

            coreUseChatStore.getState().addMessage({

                id: crypto.randomUUID(),

                role: 'tool',

                content: toolMessageContent,

                tool_call_id: toolCallId

            });

            // Continue Conversation - 但对于本地模型执行的工具调用，不需要继续调用云端 API

            // 因为后端已经通过 content 事件发送了格式化的结果

            // 如果 skipContinue 选项为 true，也不自动继续（由调用者控制）

            const settings = useSettingsStore.getState();

            const providerConfig = settings.providers.find(p => p.id === settings.currentProviderId);

            if (providerConfig && !(toolCall as any).isLocalModel && !options?.skipContinue) {

                await patchedGenerateResponse(

                    coreUseChatStore.getState().messages,

                    providerConfig,

                    { enableTools: (window.__IFAI_EDITOR_MODE__ !== "vibe") }

                );

            }

        } catch (e) {

            console.error(`[useChatStore] Tool execution failed:`, e);

            // Update status to failed

            coreUseChatStore.setState(state => ({

                messages: state.messages.map(m =>

                    m.id === messageId ? {

                        ...m,

                        toolCalls: m.toolCalls?.map(tc =>

                            tc.id === toolCallId ? { ...tc, status: 'failed' as const, result: String(e) } : tc

                        )

                    } : m

                )

            }));

            // Add Error Output

            coreUseChatStore.getState().addMessage({

                id: crypto.randomUUID(),

                role: 'tool',

                content: i18n.t('tool.error', { toolName: `${toolName} > ${relPath}`, error: String(e) }),

                tool_call_id: toolCallId

            });

             // Still continue to let AI know it failed? 

             // Yes, usually better to let AI retry or apologize.

             const settings = useSettingsStore.getState();

             const providerConfig = settings.providers.find(p => p.id === settings.currentProviderId);

             if (providerConfig) {

                 await patchedGenerateResponse(

                     coreUseChatStore.getState().messages, 

                     providerConfig, 

                     { enableTools: (window.__IFAI_EDITOR_MODE__ !== "vibe") }

                 );

             }

        }

        useFileStore.getState().refreshFileTree();

        return;

    }

    // 3. Handle Bash Tools - 🔥 FIX v0.3.4: 直接执行，避免 originalApproveToolCall 创建额外的 assistant 消息

    const bashTools = ['bash', 'execute_bash_command', 'bash_execute_streaming'];

    if (bashTools.includes(toolName)) {

        console.log(`[useChatStore] Bash tool detected: ${toolName}`);

        // 🔥 修复：确保工作目录是项目根目录

        const rootPath = useFileStore.getState().rootPath;

        const args = toolCall.args || {};

        const providedCwd = args.cwd || args.working_dir;

        let workingDir = providedCwd;

        // 检查是否需要修正工作目录

        if (!workingDir || (workingDir && !workingDir.startsWith(rootPath))) {

            console.warn(`[useChatStore] ⚠️ Auto-correcting working_dir to project root: ${rootPath}`);

            workingDir = rootPath;

        }

        // 🔥 先更新状态为 'approved'，让 UI 立即反馈

        coreUseChatStore.setState(state => ({

            messages: state.messages.map(m =>

                m.id === messageId ? {

                    ...m,

                    toolCalls: m.toolCalls?.map(tc =>

                        tc.id === toolCallId ? {

                            ...tc,

                            status: 'approved' as const,

                            args: {

                                ...args,

                                working_dir: workingDir,

                                cwd: workingDir

                            }

                        } : tc

                    )

                } : m

            )

        }));

        // 🔥 FIX v0.3.4: 直接执行 bash 命令，不调用 originalApproveToolCall

        // 原因：originalApproveToolCall 会创建新的 assistant 消息（没有 tool_calls），

        // 导致 API 错误："Messages with role 'tool' must be a response to a preceding message with 'tool_calls'"

        let bashResult: any;

        try {

            bashResult = await invoke('agent_bash', {

                messageId,

                command: args.command,

                cwd: workingDir,

                env: args.env

            });

            console.log(`[useChatStore] Bash command executed, result type: ${typeof bashResult}`);

        } catch (error) {

            console.error(`[useChatStore] Bash execution error:`, error);

            bashResult = {

                success: false,

                stdout: '',

                stderr: error instanceof Error ? error.message : String(error),

                exitCode: -1

            };

        }

        // 解析结果

        let stdout = '';

        let stderr = '';

        let exitCode = 0;

        let success = false;

        let elapsed_ms = 0; // 🔥 定义变量

        if (typeof bashResult === 'string') {

            try {

                const parsed = JSON.parse(bashResult);

                stdout = parsed.stdout || '';

                stderr = parsed.stderr || '';

                exitCode = parsed.exitCode !== undefined ? parsed.exitCode : parsed.exit_code || 0;

                success = parsed.success !== undefined ? parsed.success : exitCode === 0;

                elapsed_ms = parsed.elapsed_ms || 0; // 🔥 提取时间

            } catch {

                // 不是 JSON，可能是原始输出

                stdout = bashResult;

                success = true;

            }

        } else {

            stdout = bashResult.stdout || '';

            stderr = bashResult.stderr || '';

            exitCode = bashResult.exitCode !== undefined ? bashResult.exitCode : bashResult.exit_code || 0;

            success = bashResult.success !== undefined ? bashResult.success : exitCode === 0;

            elapsed_ms = bashResult.elapsed_ms || 0; // 🔥 提取时间

        }

        // 更新 toolCall 状态为 completed 并保存结果

        // 🔥 FIX v0.3.9.3: 存储对象而不是字符串，与 agentStore.ts 保持一致

        const resultObj = {

            success,

            stdout,

            stderr,

            exitCode,

            elapsed_ms,

            command: args.command // 🔥 使用 args.command

        };

        coreUseChatStore.setState(state => ({

            messages: state.messages.map(m =>

                m.id === messageId ? {

                    ...m,

                    toolCalls: m.toolCalls?.map(tc =>

                        tc.id === toolCallId ? {

                            ...tc,

                            status: 'completed' as const,

                            result: JSON.stringify(resultObj) // 保持字符串序列化，但确保结构完整

                        } : tc

                    )

                } : m

            )

        }));

        // 构建输出内容 (用于 tool 角色消息)

        const outputParts = [];

        if (success) {

            outputParts.push(`✅ Command executed successfully (exit code: ${exitCode})`);

            // ... (keep server startup check)

            const stdoutLower = stdout.toLowerCase();

            const isServerStartup =

                stdoutLower.includes('local:') ||

                stdoutLower.includes('network:') ||

                stdoutLower.includes('ready in') ||

                stdoutLower.includes('vite') ||

                stdoutLower.includes('compiled successfully') ||

                stdoutLower.includes('server running') ||

                stdoutLower.includes('listening on') ||

                stdoutLower.includes('running on') ||

                stdout.includes('Server started successfully');

            if (isServerStartup) {

                outputParts.push(`\n📢 IMPORTANT: The development server has been successfully started and is now running in the background.`);

                outputParts.push(`The server is ready to accept requests. Do NOT attempt to run this command again.`);

                outputParts.push(`The user can now access the application in their browser.`);

            }

        } else if (exitCode === -1) {

            outputParts.push(`⚠️ Command executed but timed out (exit code: -1)`);

        } else {

            outputParts.push(`❌ Command executed but failed (exit code: ${exitCode})`);

        }

        if (stdout) {

            outputParts.push(`\nStdout:\n${stdout.trim()}`);

        }

        if (stderr) {

            outputParts.push(`\nStderr:\n${stderr.trim()}`);

        }

        // 如果没有任何输出，提供更友好的提示

        if (!stdout && !stderr) {

            if (success) {

                outputParts.push('\n(Command completed with no output)');

            } else {

                outputParts.push('\n(Command failed with no output)');

            }

        }

        const outputContent = outputParts.join('\n');

        // 创建 tool 消息

        coreUseChatStore.getState().addMessage({

            id: crypto.randomUUID(),

            role: 'tool',

            content: outputContent,

            tool_call_id: toolCallId

        });

        console.log(`[useChatStore] Bash tool completed, created tool message`);

        useFileStore.getState().refreshFileTree();

        return;

    }

    // 4. Fallback to Original Flow (for other tools)

    console.log(`[useChatStore] Using original approval flow for: ${toolName}`);

    await originalApproveToolCall(messageId, toolCallId);

    useFileStore.getState().refreshFileTree();

};

const patchedRejectToolCall = async (messageId: string, toolCallId: string) => {

    console.log(`[useChatStore] patchedRejectToolCall called - messageId: ${messageId}, toolCallId: ${toolCallId}`);

    // 🔥 FIX v0.3.7: ID 重定向逻辑 - 处理智谱 API 重复 tool_call 导致的 ID 不匹配

    let message = coreUseChatStore.getState().messages.find(m => m.id === messageId);

    let toolCall = message?.toolCalls?.find(tc => tc.id === toolCallId);

    // 🔥 FIX: 终端状态保护 - 防止拒绝已完成/失败的工具调用

    // 与 approveToolCall 和 agentStore.ts 中的保护逻辑保持一致

    const TERMINAL_STATES = ['completed', 'failed', 'rejected'] as const;

    if (toolCall && TERMINAL_STATES.includes(toolCall.status as any)) {

        console.warn(`[useChatStore] ⚠️ ToolCall already in terminal state: ${toolCall.status}, skipping rejection`, {

            toolCallId,

            currentStatus: toolCall.status,

            toolName: toolCall.tool

        });

        return;

    }

    if (!message || !toolCall) {

        const agentStore = useAgentStore.getState();

        const canonicalId = agentStore.deduplicator.getCanonicalId(toolCallId);

        if (canonicalId) {

            console.log(`[useChatStore] 🔄 ID Redirect (reject): ${toolCallId} -> ${canonicalId}`);

            message = coreUseChatStore.getState().messages.find(m => m.id === messageId);

            toolCall = message?.toolCalls?.find(tc => tc.id === canonicalId);

            if (!toolCall) {

                console.error(`[useChatStore] ❌ ID Redirect failed: canonical ID ${canonicalId} also not found`);

                return;

            }

        } else {

            console.error("Message or ToolCall not found");

            return;

        }

    }

    if (toolCall && (toolCall as any).agentId) {

        // Agent tool call: use Agent rejection flow

        const agentId = (toolCall as any).agentId;

        // Update tool call status to rejected

        coreUseChatStore.setState(state => ({

            messages: state.messages.map(m =>

                m.id === messageId ? {

                    ...m,

                    toolCalls: m.toolCalls?.map(tc =>

                        tc.id === toolCallId ? { ...tc, status: 'rejected' as const } : tc

                    )

                } : m

            )

        }));

        await useAgentStore.getState().approveAction(agentId, false);

    } else {

        // Regular tool call: use original flow

        await originalRejectToolCall(messageId, toolCallId);

    }

    // Refresh file tree after tool execution

    useFileStore.getState().refreshFileTree();

};

const approveAllToolCalls = async (messageId: string) => {

    const state = coreUseChatStore.getState();

    const message = state.messages.find(m => m.id === messageId);

    if (!message || !message.toolCalls) return;

    for (const toolCall of message.toolCalls) {

        if (toolCall.status === 'pending' && !toolCall.isPartial) {

            await coreUseChatStore.getState().approveToolCall(messageId, toolCall.id);

        }

    }

};

const rejectAllToolCalls = async (messageId: string) => {

    const state = coreUseChatStore.getState();

    const message = state.messages.find(m => m.id === messageId);

    if (!message || !message.toolCalls) return;

    for (const toolCall of message.toolCalls) {

        if (toolCall.status === 'pending' && !toolCall.isPartial) {

            await coreUseChatStore.getState().rejectToolCall(messageId, toolCall.id);

        }

    }

};

// Apply patches to the store

coreUseChatStore.setState({

    sendMessage: patchedSendMessage,

    // @ts-ignore - patching generateResponse

    generateResponse: patchedGenerateResponse,

    approveToolCall: patchedApproveToolCall,

    rejectToolCall: patchedRejectToolCall,

    // @ts-ignore - adding new methods to store

    approveAllToolCalls,

    // @ts-ignore - adding new methods to store

    rejectAllToolCalls,

    // @ts-ignore - adding history state

    inputHistory: [],

    // @ts-ignore

    historyIndex: -1

});

// ----------------------------------

// Re-export the core chatStore

export const useChatStore = coreUseChatStore;

// Re-export types

export type { ChatState, ToolCall, Message, ContentPart, ImageUrl, BackendMessage, AIProviderConfig } from 'ifainew-core';

// @ts-ignore

if (typeof window !== 'undefined') {

  (window as any).__chatStore = useChatStore;

  // 🔥 E2E 测试支持：暴露 thread 辅助函数

  (window as any).__switchThread = switchThread;

  (window as any).__getThreadMessages = getThreadMessages;

  (window as any).__setThreadMessages = setThreadMessages;

  // 🔥 确保在 DOM 加载后再次设置（应对模块加载时机问题）

  if (typeof document !== 'undefined') {

    const setStore = () => {

      (window as any).__chatStore = useChatStore;

      (window as any).__switchThread = switchThread;

      (window as any).__getThreadMessages = getThreadMessages;

      (window as any).__setThreadMessages = setThreadMessages;

    };

    if (document.readyState === 'loading') {

      document.addEventListener('DOMContentLoaded', setStore);

    } else {

      // DOM 已经加载完成，立即设置

      setTimeout(setStore, 0);

    }

  }

}

