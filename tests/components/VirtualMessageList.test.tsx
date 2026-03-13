import React from 'react';
import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import VirtualMessageList from '../../src/components/AIChat/VirtualMessageList';
import { useVirtualizer } from '@tanstack/react-virtual';
import { eventBus } from '../../src/core/events/GlobalEventBus';

// Mock the child components
vi.mock('../../src/components/AIChat/MessageItem', () => ({
  MessageItem: () => <div data-testid="message-item" />,
}));

// Mock react-virtual
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(),
}));

describe('VirtualMessageList TDD - Event-Driven Scroll Sync', () => {
  let mockScrollToIndex = vi.fn();

  beforeEach(() => {
    mockScrollToIndex = vi.fn();
    (useVirtualizer as any).mockImplementation(() => ({
      getVirtualItems: () => [{ index: 0, start: 0, key: '0' }],
      getTotalSize: () => 1000,
      measureElement: vi.fn(),
      scrollToIndex: mockScrollToIndex,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call scrollToIndex when chat:content-updated event is emitted', () => {
    const messages = [{ id: '1', role: 'assistant', content: 'hello', toolCalls: [] }];
    
    render(
      <VirtualMessageList 
        messages={messages as any} 
        isLoading={true} 
        onApprove={vi.fn()} 
        onReject={vi.fn()} 
        onOpenFile={vi.fn()} 
      />
    );

    // Emit the event
    eventBus.emit('chat:content-updated', { messageId: '1' });

    // Should call scrollToIndex to align the bottom
    expect(mockScrollToIndex).toHaveBeenCalledWith(0, { align: 'end' });
  });

  it('should not cause infinite render loops during event handling', () => {
    let renderCount = 0;
    const Wrapper = (props: any) => {
      renderCount++;
      return <VirtualMessageList {...props} />;
    };

    const messages = [{ id: '1', role: 'assistant', content: 'hello', toolCalls: [] }];
    
    render(
      <Wrapper 
        messages={messages as any} 
        isLoading={true} 
        onApprove={vi.fn()} 
        onReject={vi.fn()} 
        onOpenFile={vi.fn()} 
      />
    );

    expect(renderCount).toBe(1);

    // Emit events rapidly
    eventBus.emit('chat:content-updated', { messageId: '1' });
    eventBus.emit('chat:content-updated', { messageId: '1' });
    eventBus.emit('chat:content-updated', { messageId: '1' });

    // The render count should NOT increase because event handling doesn't trigger re-renders
    // (unless props change, which we didn't do here)
    expect(renderCount).toBeLessThan(3);
  });
});
