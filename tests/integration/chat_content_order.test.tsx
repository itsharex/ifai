import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MessageItem } from '../../src/components/AIChat/MessageItem';
import React from 'react';

vi.mock('../../src/stores/settingsStore', () => ({
  useSettingsStore: Object.assign(() => ({
    agentAutoApprove: false,
    agentApprovalMode: 'always'
  }), {
    getState: () => ({ agentAutoApprove: false })
  })
}));

vi.mock('../../src/stores/useChatStore', () => ({
  useChatStore: Object.assign(() => ({}), {
    getState: () => ({})
  })
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('MessageItem Content Ordering (v0.4.0 Fix)', () => {
  it('should prioritize tools over intro text in non-streaming mode', () => {
    // 模拟场景：
    // 1. Text: "I will do X" (timestamp 100)
    // 2. Tool: write_file (timestamp 150)
    // 3. Text: "Finished X" (timestamp 300)
    
    const message = {
      id: 'msg-order-weighting',
      role: 'assistant' as const,
      content: 'I will do X. Finished X.',
      toolCalls: [{ id: 'tc-weight', tool: 'agent_write_file', status: 'completed', result: '{}', timestamp: 150 }],
      contentSegments: [
        { type: 'text', order: 0, content: 'I will do X. ', timestamp: 100 },
        { type: 'text', order: 1, content: 'Finished X.', timestamp: 300 }
      ]
    };

    const { container } = render(
      <MessageItem 
        message={message as any} 
        onApprove={() => {}} 
        onReject={() => {}}
        isStreaming={false}
      />
    );

    const textContent = container.textContent || '';
    const introPos = textContent.indexOf('I will do X');
    const toolPos = textContent.indexOf('agent_write_file');
    const summaryPos = textContent.indexOf('Finished X');
    
    console.log(`[Test] Intro: ${introPos}, Tool: ${toolPos}, Summary: ${summaryPos}`);
    
    // 我们期望：即使 Intro 时间稍早，但在工业级 UI 下，工具卡片应该排在正文顶端（或靠近顶端）
    // 按照我刚才写的逻辑：timeDiff < 5000 且 a=tool, b=text 时 return -1。
    // 所以 Tool 应该在 Intro 之前。
    expect(toolPos).toBeLessThan(introPos);
    expect(introPos).toBeLessThan(summaryPos);
  });
});