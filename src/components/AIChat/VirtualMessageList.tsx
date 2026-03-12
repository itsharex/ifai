/**
 * 虚拟滚动消息列表 - v0.2.6 性能优化
 * 使用 @tanstack/react-virtual 实现高性能长列表渲染
 * 仅渲染可见区域的消息，大幅提升长对话性能
 */

import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatStore } from '../../stores/useChatStore';
import { MessageItem } from './MessageItem';

interface VirtualMessageListProps {
  messages: ReturnType<typeof useChatStore.getState>['messages'];
  onApprove: (messageId: string, toolCallId: string) => void;
  onReject: (messageId: string, toolCallId: string) => void;
  onOpenFile: (path: string) => Promise<void>;
  onOpenComposer?: (messageId: string) => void; // v0.2.8: 打开 Composer 面板
  isLoading: boolean;
  parentRef?: React.RefObject<HTMLDivElement>; // 外部滚动容器引用
}

/**
 * 虚拟滚动消息列表组件
 * 使用 @tanstack/react-virtual 实现动态高度虚拟滚动
 * 支持外部滚动容器（避免嵌套滚动问题）
 */
export const VirtualMessageList: React.FC<VirtualMessageListProps> = ({
  messages,
  onApprove,
  onReject,
  onOpenFile,
  onOpenComposer,
  isLoading,
  parentRef,
}) => {
  const localRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = parentRef || localRef;

  // 🔥 FIX: 过滤掉 role === 'tool' 的消息，因为工具结果已经通过 ToolApproval 组件在 assistant 消息中显示
  // 这避免了重复输出（一次格式化显示，一次原始 JSON 字符串显示）
  // 注意：不过滤只有 toolCalls 的空 assistant 消息，因为它们需要在 MessageItem 中渲染 ToolApproval
  const visibleMessages = messages.filter(m => m.role !== 'tool');

  // 检测是否有待处理的工具调用
  const hasPendingToolCalls = messages.some(m =>
    m.toolCalls?.some(tc => tc.status === 'pending' || tc.isPartial)
  );

  // ⚠️ 重要：始终调用 hooks，不能在条件返回之前
  // 使用 @tanstack/react-virtual 创建虚拟化列表
  const virtualizer = useVirtualizer({
    count: visibleMessages.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 180, // 物理级初始估算
    overscan: 8, // 增加缓冲区以应对高频滚动
    // v0.3.9: 始终启用虚拟滚动，实现物理级结构一致性，根除闪屏
    enabled: true,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // 🏆 v0.3.9: 物理级智能粘性滚动 (Smart Sticky Scroll) - 优化对齐逻辑
  useEffect(() => {
    const el = scrollElementRef.current;
    if (!el || !isLoading) return;

    // 增加物理判定灵敏度
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;

    if (isAtBottom) {
      // 🏆 PIVO 3.0: 物理级强制对齐
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [visibleMessages.length, isLoading, hasPendingToolCalls]);

  // 虚拟滚动全量渲染（物理移除 length < 10 分支，保持 DOM 树静止）
  return (
    <div
      ref={localRef}
      style={{
        contain: 'layout style paint',
        willChange: 'transform',
        width: '100%',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
          contain: 'layout style paint',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const message = visibleMessages[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                willChange: 'transform',
                contain: 'layout style paint',
              }}
            >
              <MessageItem
                message={message as any}
                onApprove={onApprove}
                onReject={onReject}
                onOpenFile={onOpenFile}
                onOpenComposer={onOpenComposer}
                isStreaming={false}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualMessageList;
