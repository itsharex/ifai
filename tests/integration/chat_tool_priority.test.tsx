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

describe('MessageItem Tool Priority (v0.4.0 Action-First)', () => {
  it('should force tool cards to the TOP of the message body in non-streaming mode', () => {
    const message = {
      id: 'msg-tool-priority-repro',
      role: 'assistant' as const,
      content: 'Summary text', // 这里的 content 是全量文本
      toolCalls: [{ id: 'tc-priority', tool: 'agent_write_file', status: 'completed', result: '{}', timestamp: 200 }],
      // 模拟片段：文本 order 为 0，工具 order 为 1
      contentSegments: [
        { type: 'text', order: 0, content: 'Intro explanation. ', timestamp: 100 },
        { type: 'tool', order: 1, toolCallId: 'tc-priority', timestamp: 200 },
        { type: 'text', order: 2, content: 'Final summary text.', timestamp: 300 }
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
    console.log(`[Test] Full Text Content: "${textContent}"`);
    
    const toolPos = textContent.indexOf('agent_write_file');
    const introPos = textContent.indexOf('Intro explanation');
    const summaryPos = textContent.indexOf('Final summary text');
    
    console.log(`[Test] Positions - Tool: ${toolPos}, Intro: ${introPos}, Summary: ${summaryPos}`);
    
    // 我们期望：由于是非流式状态，工具卡片必须被提到最前面
    expect(toolPos).toBeGreaterThan(-1);
    expect(introPos).toBeGreaterThan(-1);
    expect(summaryPos).toBeGreaterThan(-1);
    
    expect(toolPos).toBeLessThan(introPos);
    expect(introPos).toBeLessThan(summaryPos);
  });
});