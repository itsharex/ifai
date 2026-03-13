/**
 * 虚拟滚动消息列表 - v0.2.6 性能优化
 * 使用 @tanstack/react-virtual 实现高性能长列表渲染
 * 仅渲染可见区域的消息，大幅提升长对话性能
 */

import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatStore } from '../../stores/useChatStore';
import { MessageItem } from './MessageItem';
import { eventBus } from '../../core/events/GlobalEventBus';

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

  // 🛡️ PIVO 3.4.1: 增强型物理防御 - 确保 messages 始终为数组
  const safeMessages = Array.isArray(messages) ? messages : [];

  // 🔥 FIX: 过滤掉 role === 'tool' 的消息
  const visibleMessages = safeMessages.filter(m => m && m.role !== 'tool');

  // 检测是否有待处理的工具调用
  const hasPendingToolCalls = safeMessages.some(m =>
    m && m.toolCalls && Array.isArray(m.toolCalls) && m.toolCalls.some(tc => tc.status === 'pending' || tc.isPartial)
  );

  // ⚠️ 重要：始终调用 hooks，不能在条件返回之前
  // 使用 @tanstack/react-virtual 创建虚拟化列表
  const virtualizer = useVirtualizer({
    count: visibleMessages.length || 0,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 180, // 物理级初始估算
    overscan: 8, // 增加缓冲区以应对高频滚动
    // v0.3.9: 始终启用虚拟滚动，实现物理级结构一致性，根除闪屏
    enabled: true,
    // PIVO 3.1: 禁用 react-virtual 内部的 flushSync，彻底避免 React 19 渲染周期的冲突
    useFlushSync: false,
  });

  // 🏆 PIVO 3.4.6: 物理镜像锁定 (Mirror Guard)
  // 使用 Ref 捕获最新的消息和 virtualizer，确保事件总线监听器永远保持稳定，不再随渲染频繁重订。
  // 这是根治高频 Chunk 场景下“闪屏”的终极手段。
  const stateRef = useRef({ messages, virtualizer, isLoading, hasPendingToolCalls });
  useEffect(() => {
    stateRef.current = { messages, virtualizer, isLoading, hasPendingToolCalls };
  }, [messages, virtualizer, isLoading, hasPendingToolCalls]);

  const virtualItems = virtualizer.getVirtualItems();

  // 🏆 PIVO 3.4.3: 物理级全量对齐闭环 (Total Fidelity Closure)
  useEffect(() => {
    const el = scrollElementRef.current;
    if (!el) return;

    const performSync = (force = false) => {
      const { messages: currentMessages, virtualizer: currentVirtualizer } = stateRef.current;
      const currentSafeMessages = currentMessages || [];
      const msgCount = currentSafeMessages.filter(m => m && m.role !== 'tool').length;
      if (msgCount === 0) return;

      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
      if (force || isAtBottom) {
        currentVirtualizer.scrollToIndex(msgCount - 1, { align: 'end' });
        requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
      }
    };

    // 主动订阅：只需订阅一次，通过 Ref 访问最新状态
    const offUpdate = eventBus.on('chat:content-updated', () => performSync(false));
    const offFinish = eventBus.on('ifainew:stream-finished', () => performSync(true));

    // 被动监听：布局变化
    let lastHeight = el.scrollHeight;
    const resizeObserver = new ResizeObserver(() => {
      if (el.scrollHeight !== lastHeight) {
        lastHeight = el.scrollHeight;
        const { isLoading: currentLoading, hasPendingToolCalls: currentPending } = stateRef.current;
        if (currentLoading || currentPending) {
            performSync(false);
        }
      }
    });
    resizeObserver.observe(el);

    return () => {
      offUpdate();
      offFinish();
      resizeObserver.disconnect();
    };
  }, [scrollElementRef]); // ⚠️ 物理静止：仅在容器变更时重订，绝不随数据抖动

  // 虚拟滚动全量渲染（物理移除 length < 10 分支，保持 DOM 树静止）

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
          if (!message) return null; // 🛡️ 终极对齐防御：如果索引越界或消息丢失，拒绝渲染，防止 length 报错

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
