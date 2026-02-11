
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStore } from '../../src/stores/useChatStore';
import { useLayoutStore } from '../../src/stores/layoutStore';
import { useFileStore } from '../../src/stores/fileStore';
import { invoke } from '@tauri-apps/api/core';

// 模拟物理环境
if (typeof window === 'undefined') {
  (global as any).window = {
    __IFAI_EDITOR_MODE__: 'vibe',
    __IFAI_ACTIVE_SKILLS__: []
  };
}

// 追踪并发数
let activeInvokes = 0;
let maxConcurrentInvokes = 0;

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd, args) => {
    // 追踪并发
    activeInvokes++;
    maxConcurrentInvokes = Math.max(maxConcurrentInvokes, activeInvokes);
    
    if (cmd === 'ai_chat') {
        activeInvokes--;
        return { event_id: 'test-event' };
    }
    
    // 模拟工具执行耗时
    await new Promise(resolve => setTimeout(resolve, 50));
    activeInvokes--;
    return JSON.stringify({ status: 'success', content: 'File Content Result' });
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe('Vibe Mode Enhancements Concurrency (v0.5.0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeInvokes = 0;
    maxConcurrentInvokes = 0;
    useLayoutStore.getState().setEditorMode('vibe');
    (window as any).__IFAI_EDITOR_MODE__ = 'vibe';
    useFileStore.setState({ rootPath: '/test-project' });
  });

  it('SHOULD limit concurrent tool executions to 5', async () => {
    const chatStore = useChatStore.getState() as any;
    const messageId = 'msg-concurrent-test';
    
    const toolCalls = Array.from({ length: 10 }).map((_, i) => ({
        id: `call-${i}`,
        tool: 'agent_read_file',
        function: { name: 'agent_read_file', arguments: JSON.stringify({ path: `file-${i}.ts` }) },
        status: 'pending'
    }));

    useChatStore.setState({
      messages: [{
        id: messageId,
        role: 'assistant',
        content: 'Thinking...',
        toolCalls: toolCalls
      }]
    });

    const promises = toolCalls.map(tc => chatStore.approveToolCall(messageId, tc.id));
    await Promise.all(promises);

    expect(maxConcurrentInvokes).toBeLessThanOrEqual(5);
  });
});
