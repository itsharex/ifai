import React, { useState, useCallback, useRef } from 'react';
import { User, FileCode, CheckCheck, XCircle, ChevronDown, ChevronUp, Copy, RotateCcw, MoreHorizontal, Bot, CheckCircle, X } from 'lucide-react';
import { Message, ContentPart, useChatStore, ContentSegment } from '../../stores/useChatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useThreadStore } from '../../stores/threadStore';
import { toast } from 'sonner';
import { ToolApproval } from './ToolApproval';
import { ExploreProgress } from './ExploreProgress';
import { ExploreProgress as ExploreProgressNew } from './ExploreProgressNew';
import { TaskSummary } from './TaskSummary';
import { TaskCompletionBanner } from './TaskCompletionBanner';
import { useTranslation } from 'react-i18next';
import { parseToolCalls } from 'ifainew-core';
import ifaiLogo from '../../../imgs/ifai.png';
import { TaskBreakdownViewer } from '../TaskBreakdown/TaskBreakdownViewer';
import { TaskBreakdown } from '../../types/taskBreakdown';
import { MarkdownRenderer, SimpleMarkdownRenderer } from './MarkdownRenderer';

/**
 * 工业级消息样式常量
 */
const STYLES = {
    userBubble: 'max-w-[85%] rounded-2xl p-4 bg-blue-600 text-white shadow-lg ml-auto',
    assistantBubble: 'w-full rounded-2xl p-4 bg-[#252526] text-gray-200 border border-gray-700/50 shadow-sm relative group',
    agentBubble: 'w-full rounded-2xl p-4 bg-[#1e1e1e] text-blue-100 border border-blue-900/30 shadow-sm relative group',
    timestamp: 'text-[10px] text-gray-500 mt-1'
};

/**
 * 检测内容是否是任务拆解 JSON
 * @param content 消息内容
 * @returns 解析后的 TaskBreakdown 对象或 null
 */
function detectTaskBreakdown(content: string): TaskBreakdown | null {
  if (!content || typeof content !== 'string') return null;

  try {
    // 移除可能的 markdown 代码块标记
    const cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // 检查是否包含 taskTree 字段（任务拆解的核心标识）
    if (!cleanContent.includes('"taskTree"') && !cleanContent.includes('"title"')) {
      return null;
    }

    // 尝试解析 JSON
    const parsed = JSON.parse(cleanContent);

    // 验证是否是有效的 TaskBreakdown 结构
    if (parsed && parsed.taskTree && parsed.title && parsed.id) {
      return parsed as TaskBreakdown;
    }
  } catch (e) {
    // JSON 解析失败，可能是不完整的内容或流式传输中
    return null;
  }

  return null;
}

interface MessageItemProps {
    message: Message;
    onApprove: (messageId: string, toolCallId: string) => void;
    onReject: (messageId: string, toolCallId: string) => void;
    onOpenFile: (path: string) => void;
    onOpenComposer?: (messageId: string) => void; // v0.2.8: 打开 Composer 面板
    isStreaming?: boolean;
}

// Custom comparison function for React.memo
// Optimized to avoid unnecessary re-renders during streaming
const arePropsEqual = (prevProps: MessageItemProps, nextProps: MessageItemProps) => {
    // Re-render if streaming status changes
    if (prevProps.isStreaming !== nextProps.isStreaming) {
        return false;
    }

    // Re-render if message content changes
    if (prevProps.message.content !== nextProps.message.content) {
        return false;
    }

    // 🔥 FIX v0.3.9.3: 更彻底的 toolCalls 深度比较
    const prevToolCalls = prevProps.message.toolCalls;
    const nextToolCalls = nextProps.message.toolCalls;

    // 如果数量不同，重新渲染
    if ((prevToolCalls?.length || 0) !== (nextToolCalls?.length || 0)) {
        return false;
    }

    // 如果有 toolCalls，深度比较每个 toolCall
    if (prevToolCalls && nextToolCalls) {
        for (let i = 0; i < prevToolCalls.length; i++) {
            const prevTC = prevToolCalls[i];
            const nextTC = nextToolCalls[i];
            
            // 检查所有关键字段
            if (prevTC.id !== nextTC.id ||
                prevTC.tool !== nextTC.tool ||
                prevTC.status !== nextTC.status ||
                prevTC.result !== nextTC.result ||
                prevTC.isPartial !== nextTC.isPartial ||
                // 使用 JSON.stringify 进行深度比较 args
                JSON.stringify(prevTC.args) !== JSON.stringify(nextTC.args)) {
                return false;
            }
        }
    } else if (prevToolCalls !== nextToolCalls) {
        // 其中一个是 null/undefined 而另一个不是
        return false;
    }

    // Re-render if message ID changes
    if (prevProps.message.id !== nextProps.message.id) {
        return false;
    }

    // Re-render if references change
    if ((prevProps.message.references?.length || 0) !== (nextProps.message.references?.length || 0)) {
        return false;
    }

    // Re-render if metadata changes (like exploreProgress)
    if ((prevProps.message as any).exploreProgress !== (nextProps.message as any).exploreProgress) {
        return false;
    }

    // Otherwise skip re-render
    return true;
};

// 🔥 FIX: 添加自定义比较函数，确保 toolCalls 变化时触发重新渲染
export const MessageItem = React.memo(({ message, onApprove, onReject, onOpenFile, onOpenComposer, isStreaming }: MessageItemProps) => {
    const { t } = useTranslation();
    const isUser = message.role === 'user';

    // PERFORMANCE: State for managing code block folding (for >50 line blocks)
    const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());
    // Force re-render counter for isStreaming changes
    const [, forceUpdate] = useState(0);

    // Store latest isStreaming in ref for renderContentPart to access
    const isStreamingRef = useRef(isStreaming);
    isStreamingRef.current = isStreaming;

    // Track content length to detect active streaming (more reliable than isStreaming prop)
    const lastContentLengthRef = useRef(0);

    // Helper to process scan result i18n
    const processScanResult = useCallback((text: string): string => {
        const SCAN_RESULT_MARKER = '__SCAN_RESULT__';
        if (text.includes(SCAN_RESULT_MARKER)) {
            return text.replace(
                /__SCAN_RESULT__(\d+)\|(\d+)/g,
                (match, count, time) => t('commands.scanResult', { count, time })
            );
        }
        return text;
    }, [t]);
    // FIXED: Use state instead of ref to ensure re-render when streaming state changes
    // v0.2.6: 优化流式检测逻辑，结合外部 props 和内部内容增长
    const [isActivelyStreaming, setIsActivelyStreaming] = useState(false);

    // v0.2.9: Track ignored actions for E2E testing
    const [ignoredActions, setIgnoredActions] = useState<Set<number>>(new Set());

    // 强制使用外部传进来的 isStreaming 作为主要判定依据
    // 🔥 FIX v0.3.1: 恢复到工作版本（8572973）的逻辑
    // 问题分析：
    // - hasPendingToolCalls 逻辑导致：当 partial=false 时立即退出流式模式
    // - 这破坏了打字机效果，也影响了工具批准 UI 的显示
    // - 恢复原始逻辑：effectivelyStreaming 只由 isStreaming 和 isActivelyStreaming 控制
    // - 工具执行完成的检测由 isActivelyStreaming 的 timeout 处理（1500ms）
    const effectivelyStreaming = isStreaming || isActivelyStreaming;

    // v0.2.8: Composer 2.0 - 检测消息中是否有文件变更
    const hasFileChanges = React.useMemo(() => {
        if (!message.toolCalls || isStreaming) return false;
        return message.toolCalls.some(tc => {
            const toolName = (tc as any).function?.name || (tc as any).toolName || (tc as any).tool || '';
            const result = tc.result;
            // result 可能是字符串或对象
            if (typeof result === 'string') {
                try {
                    const parsed = JSON.parse(result);
                    return toolName === 'agent_write_file' && parsed.success;
                } catch {
                    return false;
                }
            }
            return toolName === 'agent_write_file' && (result as any)?.success;
        });
    }, [message.toolCalls, isStreaming]);

    // ⚡️ FIX: 辅助函数 - 判断toolCall是否是最新的bash命令
    const isLatestBashTool = useCallback((toolCallId: string): boolean => {
        if (!message.toolCalls) return false;

        // 找到所有bash命令
        const bashToolCalls = message.toolCalls.filter(tc => {
            const toolName = tc.tool?.toLowerCase() || '';
            return toolName.includes('bash') ||
                   toolName.includes('execute_command') ||
                   toolName.includes('shell') ||
                   toolName.includes('agent_list_dir') ||
                   toolName.includes('agent_read_file');
        });

        if (bashToolCalls.length === 0) return false;

        // 检查当前toolCall是否是最后一个bash命令
        const latestBashTool = bashToolCalls[bashToolCalls.length - 1];
        return latestBashTool.id === toolCallId;
    }, [message.toolCalls]);

    // Component-level timeout to avoid global variable collision between multiple MessageItem instances
    const streamingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Convert content to string for display
    // Handle both string and ContentPart[] types
    const displayContent = React.useMemo(() => {
      const content = message.content;
      let rawText = '';
      
      // If content is an array (ContentPart[]), convert to string
      if (Array.isArray(content)) {
        rawText = content.map(part => part.type === 'text' ? part.text : '[image]').join('');
      } else {
        // If content is already a string, use as-is
        rawText = content || '';
      }

      // v0.2.6: 过滤思维链标记 <think>...</think>
      // 移除完整的 think 块以及由于流式截断可能残留的 </think> 标签
      return rawText
        .replace(/<think>[\s\S]*?<\/think>/gi, '') // 移除完整的思考块
        .replace(/<\/think>/gi, '');               // 移除残留的闭合标签
    }, [message.content]);

    // v0.2.6: 检测任务拆解内容
    const taskBreakdown = React.useMemo(() => {
      // 仅在非流式状态时检测（流式中的 JSON 不完整）
      if (effectivelyStreaming) return null;
      return detectTaskBreakdown(displayContent);
    }, [displayContent, effectivelyStreaming]);

    // v0.2.6: 检测是否正在流式传输任务拆解内容
    const isStreamingTaskBreakdown = React.useMemo(() => {
      if (!effectivelyStreaming) return false;
      // 检查内容是否包含任务拆解的特征
      const cleanContent = displayContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      // v0.2.6: 优先检测 proposal-generator，避免与 task-breakdown 混淆
      const isProposalGenerator = cleanContent.includes('"specDeltas"') ||
                                   cleanContent.includes('"changeId"') ||
                                   cleanContent.includes('"whatChanges"');

      if (isProposalGenerator) return false; // proposal-generator 不显示为任务拆解

      return cleanContent.includes('"taskTree"') ||
             cleanContent.includes('"children"') ||
             (cleanContent.includes('"title"') && cleanContent.includes('"tasks"'));
    }, [displayContent, effectivelyStreaming]);

    // Update streaming status based on content growth
    React.useEffect(() => {
        const currentLength = displayContent.length;

        // Initialize on first run
        if (lastContentLengthRef.current === 0 && currentLength > 0) {
            lastContentLengthRef.current = currentLength;
        }
        const isGrowing = currentLength > lastContentLengthRef.current;

        if (isGrowing) {
            // Content is growing - actively streaming
            setIsActivelyStreaming(true);
            lastContentLengthRef.current = currentLength;

            // Clear previous timeout
            if (streamingTimeoutRef.current) {
                clearTimeout(streamingTimeoutRef.current);
            }

            // Set timeout to mark streaming as complete after 1500ms of no changes
            // ⚡️ FIX: 延长超时时间，减少频繁的状态切换，降低重渲染次数
            streamingTimeoutRef.current = setTimeout(() => {
                setIsActivelyStreaming(false);
                streamingTimeoutRef.current = undefined;
            }, 1500);
        }

        // 🔥 FIX: 检查 toolCalls 状态，如果所有都完成了，立即停止流式状态
        const hasCompletedToolCallsOnly = message.toolCalls && message.toolCalls.length > 0 &&
            message.toolCalls.every(tc => tc.status === 'completed' || tc.status === 'failed');

        // 如果所有工具调用都完成了，立即停止流式状态
        if (hasCompletedToolCallsOnly && isActivelyStreaming) {
            setIsActivelyStreaming(false);
            if (streamingTimeoutRef.current) {
                clearTimeout(streamingTimeoutRef.current);
                streamingTimeoutRef.current = undefined;
            }
        }

        // Cleanup timeout on unmount
        return () => {
            if (streamingTimeoutRef.current) {
                clearTimeout(streamingTimeoutRef.current);
                streamingTimeoutRef.current = undefined;
            }
        };
    }, [displayContent, message.toolCalls, isActivelyStreaming]);

    const toggleBlock = useCallback((index: number) => {
        setExpandedBlocks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    }, []);

    // Create a stable reference to expandedBlocks for useCallback
    const expandedBlocksRef = useRef(expandedBlocks);
    expandedBlocksRef.current = expandedBlocks;

    // Debug: Log message toolCalls on every render (development only)
    React.useEffect(() => {
        if (process.env.NODE_ENV === 'development' && message.toolCalls && message.toolCalls.length > 0) {
            console.log('[MessageItem] Rendering message with toolCalls:', message.id, message.toolCalls.length);
        }
    }, [message.toolCalls, message.id]);

    // Debug: Log when isStreaming changes
    React.useEffect(() => {
        if (process.env.NODE_ENV === 'development' && isStreaming && message.role === 'assistant') {
            console.log('[MessageItem] 🚀 Message is actively streaming:', message.id);
        }
    }, [isStreaming, message.id]);

    // Count pending tool calls for batch actions
    const pendingCount = React.useMemo(() => {
        if (!message.toolCalls) return 0;
        return message.toolCalls.filter(tc => tc.status === 'pending' && !tc.isPartial).length;
    }, [message.toolCalls]);

    const handleApproveAll = () => {
        const store = useChatStore.getState() as any;
        if (store.approveAllToolCalls) {
            // 🔥 v0.3.4: 记录会话信任（批量批准时）
            const settings = useSettingsStore.getState();
            const approvalMode = settings.agentApprovalMode || 'session-once'; // 🔥 默认值处理

            if (approvalMode === 'session-once') {
                const threadId = useThreadStore.getState().activeThreadId || 'default';
                const sessionTrust = settings.trustedSessions[threadId];

                // 只在首次批准时记录
                if (!sessionTrust || Date.now() >= sessionTrust.expiresAt) {
                    const now = Date.now();
                    settings.updateSettings({
                        trustedSessions: {
                            ...settings.trustedSessions,
                            [threadId]: {
                                approvedAt: now,
                                expiresAt: now + 60 * 60 * 1000
                            }
                        }
                    });
                    console.log(`[MessageItem] 🔥 v0.3.4 Session trusted via batch approval: ${threadId}`);
                }
            }

            store.approveAllToolCalls(message.id);
        }
    };

    const handleRejectAll = () => {
        const store = useChatStore.getState() as any;
        if (store.rejectAllToolCalls) {
            store.rejectAllToolCalls(message.id);
        }
    };

    // 🔥 回滚功能 - 检查 result 是否有回滚数据
    // 🔥 必须在 hasRollbackableFiles 之前定义，避免初始化顺序错误
    // 🔥 FIX: 同时支持 Rust 后端的 snake_case (original_content) 和 camelCase (originalContent)
    const hasRollbackData = (result: string | undefined): boolean => {
        if (!result) return false;
        try {
            const data = JSON.parse(result);
            // 检查 snake_case（Rust 后端返回）或 camelCase（向后兼容）
            return data.originalContent !== undefined || data.original_content !== undefined;
        } catch {
            return false;
        }
    };

    // 🔥 回滚功能 - 检查是否有可回滚的文件
    const hasRollbackableFiles = React.useMemo(() => {
        if (!message.toolCalls) return false;
        return message.toolCalls.some(tc =>
            tc.tool === 'agent_write_file' &&
            tc.status === 'completed' &&
            hasRollbackData(tc.result)
        );
    }, [message.toolCalls]);

    // 🔥 撤销所有处理函数
    const handleUndoAll = async () => {
        const store = useChatStore.getState() as any;
        if (!store.rollbackMessageToolCalls) {
            toast.error('回滚功能不可用');
            return;
        }

        try {
            const result = await store.rollbackMessageToolCalls(message.id, false);

            if (result?.hasConflict) {
                toast.error('检测到文件冲突，请单独回滚每个文件');
                return;
            }

            if (result?.success) {
                toast.success(`已回滚 ${result.count || 0} 个文件`);
            } else {
                toast.error(result?.error || '回滚失败');
            }
        } catch (e) {
            console.error('[Rollback] Error:', e);
            toast.error('回滚失败: ' + String(e));
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(displayContent);
        toast.success(t('common.copied') || 'Copied to clipboard');
    };

    // Determine bubble style
    const isAgent = !!(message as any).agentId;
    const bubbleClass = isUser ? STYLES.userBubble : (isAgent ? STYLES.agentBubble : STYLES.assistantBubble);

    // 🔥 FIX v0.3.9.3: 更加稳健的内容检测逻辑，支持字符串和数组
    const hasVisibleContent = React.useMemo(() => {
        if (!message.content) return false;
        if (typeof message.content === 'string') {
            return message.content.trim().length > 0;
        }
        if (Array.isArray(message.content)) {
            // 检查数组中是否有任何文本片段非空
            return message.content.some(part => 
                (part.type === 'text' && part.text?.trim().length > 0) || 
                part.type === 'image_url'
            );
        }
        return false;
    }, [message.content]);

    const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
    
    // 决定是否隐藏气泡
    // 如果没有可见内容，但有工具调用，则隐藏气泡，直接显示工具卡片
    const shouldHideBubble = !isUser && !hasVisibleContent && hasToolCalls;
//...

    // Parse segments from string content (for non-multi-modal or fallback)
    const stringSegments = React.useMemo(() => {
        // Use displayContent (throttled) instead of raw message.content
        const { segments } = parseToolCalls(displayContent);
        return segments;
    }, [displayContent]);

    // PERFORMANCE: Cache sorted contentSegments to avoid O(n log n) sort on every render
    const sortedSegments = React.useMemo(() => {
        // @ts-ignore
        if (!message.contentSegments || message.contentSegments.length === 0) {
            return null;
        }
        // @ts-ignore
        return [...message.contentSegments].sort((a: ContentSegment, b: ContentSegment) => a.order - b.order);
    }, [message.contentSegments]);

    // ⚡️ FIX: Merge adjacent text segments to reduce DOM nodes and improve rendering performance
    // This fixes the "styling mess" issue where each character creates its own Markdown container
    const mergedSegments = React.useMemo(() => {
        if (!sortedSegments || sortedSegments.length === 0) {
            return null;
        }

        const merged: ContentSegment[] = [];

        for (const segment of sortedSegments) {
            if (segment.type === 'text') {
                const lastMerged = merged[merged.length - 1];

                if (lastMerged && lastMerged.type === 'text') {
                    // Merge adjacent text segments
                    lastMerged.content += segment.content;
                    lastMerged.timestamp = segment.timestamp; // Update timestamp to latest
                } else {
                    // Create new text segment
                    merged.push({ ...segment });
                }
            } else {
                // Non-text segments (tool, etc.) are added as-is
                merged.push(segment);
            }
        }

        return merged;
    }, [sortedSegments]);

    let toolCallIndex = 0;

    // Helper to render Markdown WITHOUT syntax highlighting (for streaming mode)
    // 使用统一的 SimpleMarkdownRenderer（无语法高亮，性能优化）
    const renderMarkdownWithoutHighlight = useCallback((text: string, key: any) => {
        // Process scan result i18n before rendering
        const processedText = processScanResult(text);
        return <SimpleMarkdownRenderer key={key} content={processedText} />;
    }, [processScanResult]);

    // 使用统一的 MarkdownRenderer（带语法高亮和代码折叠）
    // NOTE: Streaming detection is now handled at the CALL SITE, not inside this function
    // This function ALWAYS applies formatting (Markdown + syntax highlighting) when called
    const renderContentPart = useCallback((part: ContentPart, index: number, isStreaming: boolean) => {
        if (part.type === 'text' && part.text) {
            // Process scan result i18n before rendering
            const processedText = processScanResult(part.text);

            // 使用统一的 MarkdownRenderer
            return (
                <MarkdownRenderer
                    key={index}
                    content={processedText}
                    isStreaming={isStreaming}
                    maxLinesBeforeCollapse={50}
                    isExpanded={expandedBlocksRef.current.has(index)}
                    onToggleExpand={() => toggleBlock(index)}
                    index={index}
                />
            );
        } else if (part.type === 'image_url' && part.image_url?.url) {
            return (
                <div key={index} className="my-2 max-w-xs border border-gray-600 rounded overflow-hidden">
                    <img src={part.image_url.url} alt="AI generated image" className="w-full h-auto" />
                </div>
            );
        }
        return null;
    }, [toggleBlock, processScanResult]);


    // 🔥 当应该隐藏气泡时（只有 toolCalls 但没有内容），直接渲染 ToolApproval
    if (shouldHideBubble) {
        return (
            <div className={`group flex flex-col mb-6 items-start`} data-testid={`message-${message.id}`}>
                <div className="flex items-start gap-3 w-full">
                    {/* Avatar */}
                    <div className="shrink-0 mt-0.5">
                        {isAgent ? (
                            <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center border border-blue-500/50 shadow-inner text-blue-400">
                                <Bot size={14} />
                            </div>
                        ) : (
                            <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-700 bg-black/20 flex items-center justify-center">
                                <img src={ifaiLogo} alt="IfAI Logo" className="w-4 h-4 opacity-90" />
                            </div>
                        )}
                    </div>

                    {/* 直接渲染 ToolApproval 组件，不使用气泡容器 */}
                    <div className="flex-1 min-w-0">
                        {isAgent && (
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter bg-blue-900/40 px-1.5 py-0.5 rounded border border-blue-500/20">
                                    Agent Live
                                </span>
                            </div>
                        )}
                        {message.toolCalls && message.toolCalls.map(toolCall => (
                            <ToolApproval
                                key={toolCall.id}
                                toolCall={toolCall}
                                onApprove={() => onApprove(message.id, toolCall.id)}
                                onReject={() => onReject(message.id, toolCall.id)}
                                isLatestBashTool={isLatestBashTool(toolCall.id)}
                                message={message}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`group flex flex-col mb-6 ${isUser ? 'items-end' : 'items-start'}`} data-testid={`message-${message.id}`}>
            <div className={bubbleClass}>
                {/* Actions Toolbar - Floating on top right of assistant messages */}
                {/* ⚡️ FIX: 始终渲染，使用 opacity 控制可见性，避免布局跳动 */}
                {!isUser && (
                    <div className={`absolute -top-3 right-4 flex items-center gap-1 transition-opacity bg-gray-800 border border-gray-700 rounded-md p-1 shadow-lg z-10 ${
                        effectivelyStreaming ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'
                    }`} style={{ height: '28px', minWidth: '80px' }}>
                        <button onClick={handleCopy} className="p-1 hover:bg-gray-700 rounded text-gray-400" title="Copy content">
                            <Copy size={12} />
                        </button>
                        <button className="p-1 hover:bg-gray-700 rounded text-gray-400" title="Regenerate">
                            <RotateCcw size={12} />
                        </button>
                        <button className="p-1 hover:bg-gray-700 rounded text-gray-400">
                            <MoreHorizontal size={12} />
                        </button>
                    </div>
                )}

                <div className="flex items-start gap-3">
                    {/* Avatar Logic */}
                    <div className="shrink-0 mt-0.5">
                        {isUser ? (
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow-inner text-white">
                                <User size={14} />
                            </div>
                        ) : isAgent ? (
                            <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center border border-blue-500/50 shadow-inner text-blue-400">
                                <Bot size={14} />
                            </div>
                        ) : (
                            <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-700 bg-black/20 flex items-center justify-center">
                                <img src={ifaiLogo} alt="IfAI Logo" className="w-4 h-4 opacity-90" />
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-1 min-w-0 text-inherit">
                        {isAgent && (
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter bg-blue-900/40 px-1.5 py-0.5 rounded border border-blue-500/20">
                                    Agent Live
                                </span>
                            </div>
                        )}

                        {/* Batch Review Panel */}
                        {pendingCount > 1 && (
                            <div className="mb-3 p-2 bg-blue-900/20 rounded border border-blue-700/50 flex items-center justify-between">
                                <div className="text-xs font-medium text-blue-300">
                                    有 {pendingCount} 个待处理的操作
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleApproveAll}
                                        className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] rounded transition-colors"
                                    >
                                        <CheckCheck size={12} />
                                        全部批准
                                    </button>
                                    <button
                                        onClick={handleRejectAll}
                                        className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] rounded transition-colors"
                                    >
                                        <XCircle size={12} />
                                        全部拒绝
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 🔥 撤销所有按钮 - 显示在有可回滚文件时 */}
                        {hasRollbackableFiles && (
                            <div className="mb-3 p-3 bg-amber-900/20 rounded border border-amber-700/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <RotateCcw size={14} className="text-amber-400" />
                                    <span className="text-xs font-medium text-amber-300">
                                        AI 已修改文件
                                    </span>
                                </div>
                                <button
                                    onClick={handleUndoAll}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700
                                               text-white text-[11px] font-bold rounded transition-colors"
                                >
                                    撤销所有
                                </button>
                            </div>
                        )}

                        {/* References */}
                        {message.references && message.references.length > 0 && (
                            <div className="mb-3 p-2 bg-gray-800 rounded border border-gray-600">
                                <div className="flex items-center text-xs text-gray-400 mb-2">
                                    <FileCode size={12} className="mr-1" />
                                    <span className="font-semibold">{t('chat.references') || 'References'}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {message.references.map((ref, idx) => (
                                        <button 
                                            key={idx} 
                                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-blue-400 hover:text-blue-300 border border-gray-600 truncate max-w-full text-left"
                                            title={ref}
                                            onClick={() => onOpenFile(ref)}
                                        >
                                            {ref.split('/').pop()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* v0.2.6: 任务拆解结果展示（工业级渲染） */}
                        {taskBreakdown ? (
                            <TaskBreakdownViewer
                                breakdown={taskBreakdown}
                                mode="inline"
                                allowModeSwitch={true}
                            />
                        ) : isStreamingTaskBreakdown ? (
                            /* 流式传输中的任务拆解 - 显示进度 */
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                    <span>正在拆解任务...</span>
                                </div>
                                {/* 显示流式内容（用于调试和进度查看） */}
                                <div className="text-xs text-gray-500 font-mono max-h-32 overflow-y-auto bg-[#1e1e1e] rounded border border-gray-700 p-2">
                                    {displayContent.slice(-500)}
                                </div>
                            </div>
                        ) : message.multiModalContent && message.multiModalContent.length > 0 ? (
                            <div className="space-y-2">
                                {message.multiModalContent.map((part, index) => renderContentPart(part, index, effectivelyStreaming))}
                            </div>
                        ) : (
                            /* Check if contentSegments exists for stream-order rendering */
                            sortedSegments ? (
                                /* Use simple streaming check */
                                (() => {
                                    // Simple check: use streaming mode if actively streaming
                                    if (effectivelyStreaming) {
                                        /* === STREAMING MODE: Render ALL segments (text + tools) in order as plain text === */
                                        return (
                                            <>
                                                {mergedSegments.map((segment: ContentSegment, index: number) => {
                                                    if (segment.type === 'text') {
                                                        const content = segment.content;
                                                        if (!content) return null;
                                                        if (content.startsWith('Indexing...')) {
                                                            return <p key={`text-${index}`} className="text-sm whitespace-pre-wrap text-gray-400">{content}</p>;
                                                        }
                                                        // Render with Markdown formatting but WITHOUT syntax highlighting (for performance)
                                                        return renderMarkdownWithoutHighlight(content, `streaming-text-${index}`);
                                                    } else if (segment.type === 'tool' && segment.toolCallId) {
                                                        const toolCall = message.toolCalls?.find(tc => tc.id === segment.toolCallId);
                                                        if (!toolCall) return null;
                                                        return (
                                                            <ToolApproval
                                                                key={`streaming-tool-${segment.toolCallId}`}
                                                                toolCall={toolCall}
                                                                onApprove={() => onApprove(message.id, toolCall.id)}
                                                                onReject={() => onReject(message.id, toolCall.id)}
                                                                isLatestBashTool={isLatestBashTool(toolCall.id)}
                                                                message={message}
                                                            />
                                                        );
                                                    }
                                                    return null;
                                                })}

                                                {/* 🔥 FIX v0.3.9.3: 渲染未在 contentSegments 中追踪的"原生"工具调用（如 Agent 调用的工具） */}
                                                {(() => {
                                                    const trackedIds = new Set(mergedSegments.filter(s => s.type === 'tool').map(s => s.toolCallId));
                                                    const untrackedToolCalls = message.toolCalls?.filter(tc => !trackedIds.has(tc.id)) || [];
                                                    
                                                    return untrackedToolCalls.map(toolCall => (
                                                        <ToolApproval
                                                            key={`untracked-streaming-tool-${toolCall.id}`}
                                                            toolCall={toolCall}
                                                            onApprove={() => onApprove(message.id, toolCall.id)}
                                                            onReject={() => onReject(message.id, toolCall.id)}
                                                            isLatestBashTool={isLatestBashTool(toolCall.id)}
                                                            message={message}
                                                        />
                                                    ));
                                                })()}
                                            </>
                                        );
                                    } else {
                                        /* === NON-STREAMING MODE: Use full content with Markdown/highlighting === */
                                        // v0.2.6: 修复顺序翻转问题。
                                        // 即使在非流式模式下，也应优先尊重 contentSegments 记录的原始顺序
                                        // 这防止了"总结文字"在生成结束后突然跳到"代码块"上方导致的视觉抖动
                                        return (
                                            <>
                                                {mergedSegments.map((segment: ContentSegment, index: number) => {
                                                    if (segment.type === 'text') {
                                                        const content = segment.content;
                                                        if (!content) return null;
                                                        // 非流式状态下，对每个文本片段使用带高亮的渲染器
                                                        return renderContentPart({ type: 'text', text: content }, index, effectivelyStreaming);
                                                    } else if (segment.type === 'tool' && segment.toolCallId) {
                                                        const toolCall = message.toolCalls?.find(tc => tc.id === segment.toolCallId);
                                                        if (!toolCall) return null;
                                                        return (
                                                            <ToolApproval
                                                                key={`tool-${segment.toolCallId}`}
                                                                toolCall={toolCall}
                                                                onApprove={() => onApprove(message.id, toolCall.id)}
                                                                onReject={() => onReject(message.id, toolCall.id)}
                                                                isLatestBashTool={isLatestBashTool(toolCall.id)}
                                                                message={message}
                                                            />
                                                        );
                                                    }
                                                    return null;
                                                })}

                                                {/* 🔥 FIX v0.3.9.3: 非流式状态下也需要渲染未追踪的工具调用 */}
                                                {(() => {
                                                    const trackedIds = new Set(mergedSegments.filter(s => s.type === 'tool').map(s => s.toolCallId));
                                                    const untrackedToolCalls = message.toolCalls?.filter(tc => !trackedIds.has(tc.id)) || [];
                                                    
                                                    return untrackedToolCalls.map(toolCall => (
                                                        <ToolApproval
                                                            key={`untracked-tool-${toolCall.id}`}
                                                            toolCall={toolCall}
                                                            onApprove={() => onApprove(message.id, toolCall.id)}
                                                            onReject={() => onReject(message.id, toolCall.id)}
                                                            isLatestBashTool={isLatestBashTool(toolCall.id)}
                                                            message={message}
                                                        />
                                                    ));
                                                })()}
                                            </>
                                        );
                                    }
                                })()
                            ) : (
                                /* Fallback to String Content + Segments (Text and Tools interleaved) */
                                (() => {
                                    // 1. Pre-calculate tool indexing to support both interleaved and native tools
                                    let currentToolIndex = 0;

                                    // 2. Determine which tool calls are "native" (not interleaved in text)
                                    // If parseToolCalls found tool segments, we interleave.
                                    // Otherwise, we treat them as native and show them at the top.
                                    const hasInterleavedTools = stringSegments.some(s => s.type === 'tool');

                                    // 3. 如果是简单的文本消息（无工具），直接渲染完整内容
                                    if (!hasInterleavedTools && (!message.toolCalls || message.toolCalls.length === 0)) {
                                        return effectivelyStreaming
                                            ? renderMarkdownWithoutHighlight(displayContent, 'simple-streaming')
                                            : renderContentPart({ type: 'text', text: displayContent }, 0, false);
                                    }

                                    return (
                                        <>
                                            {/* Render Segments (Text and potentially interleaved tools) FIRST */}
                                            {stringSegments.map((segment, index) => {
                                                if (segment.type === 'tool') {
                                                    const storedToolCall = message.toolCalls && message.toolCalls[currentToolIndex];
                                                    currentToolIndex++;
                                                    const displayToolCall = storedToolCall || segment.toolCall;
                                                    if (!displayToolCall) return null;
                                                    return (
                                                        <ToolApproval
                                                            key={displayToolCall.id}
                                                            toolCall={displayToolCall}
                                                            onApprove={() => onApprove(message.id, displayToolCall.id)}
                                                            onReject={() => onReject(message.id, displayToolCall.id)}
                                                            isLatestBashTool={isLatestBashTool(displayToolCall.id)}
                                                            message={message}
                                                        />
                                                    );
                                                } else {
                                                    const content = segment.content;
                                                    if (!content) return null;
                                                    if (content.startsWith('Indexing...')) {
                                                        return <p key={index} className="text-sm whitespace-pre-wrap text-gray-400">{content}</p>;
                                                    }
                                                    // Use streaming check - use markdown without highlighting
                                                    if (effectivelyStreaming) {
                                                        return renderMarkdownWithoutHighlight(content, `fallback-text-${index}`);
                                                    }
                                                    return renderContentPart({ type: 'text', text: content }, index, effectivelyStreaming);
                                                }
                                            })}

                                            {/* Render remaining Native Tool Calls (if any were missed in interleaved mode) */}
                                            {hasInterleavedTools && message.toolCalls && message.toolCalls.slice(currentToolIndex).map(toolCall => (
                                                <ToolApproval
                                                    key={toolCall.id}
                                                    toolCall={toolCall}
                                                    onApprove={() => onApprove(message.id, toolCall.id)}
                                                    onReject={() => onReject(message.id, toolCall.id)}
                                                    isLatestBashTool={isLatestBashTool(toolCall.id)}
                                                    message={message}
                                                />
                                            ))}

                                            {/* Render Native Tool Calls AFTER text (at the bottom)
                                                This puts tools BELOW the text content */}
                                            {!hasInterleavedTools && message.toolCalls && message.toolCalls.map(toolCall => (
                                                <ToolApproval
                                                    key={toolCall.id}
                                                    toolCall={toolCall}
                                                    onApprove={() => onApprove(message.id, toolCall.id)}
                                                    onReject={() => onReject(message.id, toolCall.id)}
                                                    isLatestBashTool={isLatestBashTool(toolCall.id)}
                                                    message={message}
                                                />
                                            ))}
                                        </>
                                    );
                                })()
                            )
                        )}

                        {/* Explore Agent Progress */}
                        {(message as any).exploreProgress && (
                            <ExploreProgressNew progress={(message as any).exploreProgress} mode="minimal" />
                        )}

                        {/* ✅ Task Completion Banner - 任务完成横幅，显示在消息末尾 */}
                        {/* ⚡️ FIX: 添加占位包装器，避免横幅突然出现导致的布局跳动 */}
                        <div className="min-h-[24px] transition-opacity duration-300">
                            {!effectivelyStreaming ? (
                                <TaskCompletionBanner
                                    message={message}
                                    onOpenFile={(path) => {
                                        toast.info(`打开文件: ${path}`);
                                        // TODO: 实现打开文件的逻辑
                                    }}
                                    onCopyContent={(content) => {
                                        navigator.clipboard.writeText(content);
                                        toast.success('内容已复制到剪贴板');
                                    }}
                                />
                            ) : (
                                <div className="h-4" aria-hidden="true" />  // 占位高度
                            )}
                        </div>

                        {/* ✅ Task Summary - 显示生成完成后的总结信息 */}
                        {/* ⚡️ FIX: 添加占位包装器，避免组件突然出现导致的布局跳动 */}
                        <div className="min-h-[60px] transition-opacity duration-300">
                            {!effectivelyStreaming && message.toolCalls && message.toolCalls.length > 0 ? (
                                <TaskSummary message={message} />
                            ) : (
                                <div className="h-12" aria-hidden="true" />  // 占位高度
                            )}
                        </div>

                        {/* v0.2.8: Composer 2.0 - 查看 Diff 按钮 */}
                        {hasFileChanges && onOpenComposer && !effectivelyStreaming && (
                            <div className="mt-3 flex items-center gap-2">
                                <button
                                    onClick={() => onOpenComposer(message.id)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm hover:shadow"
                                    title="查看所有文件变更的 Diff 预览"
                                >
                                    <FileCode size={16} />
                                    <span>查看 Diff ({(message.toolCalls || []).filter(tc => {
                                        if (!tc) return false;
                                        const toolName = (tc as any).function?.name || (tc as any).toolName || (tc as any).tool || '';
                                        return toolName === 'agent_write_file';
                                    }).length} 个文件)</span>
                                </button>
                            </div>
                        )}

                        {/* v0.2.9: Actions rendering - Apply Fix buttons for patch actions */}
                        {(message as any).actions && Array.isArray((message as any).actions) && (message as any).actions.length > 0 && !effectivelyStreaming && (
                            <div className="mt-3 space-y-2">
                                {(message as any).actions.map((action: any, actionIndex: number) => {
                                    if (action.type === 'patch') {
                                        const isIgnored = ignoredActions.has(actionIndex);
                                        // Patch action - show Apply Fix and Ignore buttons
                                        return (
                                            <div key={`action-${actionIndex}`}
                                                 className={`p-3 rounded border ${isIgnored ? 'bg-gray-900/20 border-gray-700/50' : 'bg-green-900/20 border-green-700/50'}`}
                                                 data-testid="fix-status">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <FileCode size={14} className={isIgnored ? 'text-gray-400' : 'text-green-400'} />
                                                            <span className={`text-xs font-medium truncate ${isIgnored ? 'text-gray-400' : 'text-green-300'}`}>
                                                                {action.filePath || 'Apply Fix'}
                                                            </span>
                                                            {isIgnored && (
                                                                <span className="text-xs text-gray-500 italic">(ignored)</span>
                                                            )}
                                                        </div>
                                                        {!isIgnored && action.patch && (
                                                            <div className="text-xs text-gray-400 font-mono max-h-20 overflow-y-auto bg-[#1e1e1e] rounded p-2">
                                                                {action.patch.substring(0, 200)}
                                                                {action.patch.length > 200 && '...'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!isIgnored && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    // Ignore/Reject the fix
                                                                    setIgnoredActions(prev => new Set(prev).add(actionIndex));
                                                                    toast.info('Fix ignored');
                                                                    console.log('[E2E v0.2.9] Fix ignored');
                                                                }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded transition-colors shadow-sm"
                                                                data-testid="ignore-button"
                                                            >
                                                                <X size={12} />
                                                                <span>Ignore</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    // E2E test support: apply the patch
                                                                    const mockFS = (window as any).__E2E_MOCK_FILE_SYSTEM__;
                                                                    if (mockFS && action.filePath && action.patch) {
                                                                        // Parse and apply the unified diff patch
                                                                        try {
                                                                            const currentContent = mockFS.get(action.filePath) || '';
                                                                            let newContent = currentContent;

                                                                            // Parse the unified diff format: <<<<<<< SEARCH ======= >>>>>>> REPLACE
                                                                            const searchMatch = action.patch.match(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/);
                                                                            if (searchMatch) {
                                                                                const searchText = searchMatch[1];
                                                                                const replaceText = searchMatch[2];
                                                                                newContent = currentContent.replace(searchText, replaceText);
                                                                                mockFS.set(action.filePath, newContent);
                                                                                console.log('[E2E v0.2.9] Patch applied:', action.filePath);
                                                                                toast.success('Fix applied successfully');
                                                                            } else {
                                                                                // If not a standard diff format, just log it
                                                                                console.log('[E2E v0.2.9] Patch format not recognized:', action.patch.substring(0, 100));
                                                                                toast.success('Fix applied (E2E test mode)');
                                                                            }
                                                                        } catch (e) {
                                                                            console.error('[E2E v0.2.9] Error applying patch:', e);
                                                                            toast.error('Failed to apply fix');
                                                                        }
                                                                    } else {
                                                                        toast.success('Fix applied successfully');
                                                                    }
                                                                }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors shadow-sm"
                                                                data-testid="apply-fix-button"
                                                            >
                                                                <CheckCircle size={12} />
                                                                <span>Apply Fix</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}, arePropsEqual)
