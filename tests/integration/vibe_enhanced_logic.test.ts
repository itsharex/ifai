import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStore } from '../../src/stores/useChatStore';
import { useLayoutStore } from '../../src/stores/layoutStore';
import { useFileStore } from '../../src/stores/fileStore';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

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

// 用于捕获监听器回调
let listeners: Record<string, any> = {};
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (name, callback) => {
    listeners[name] = callback;
    return () => {};
  }),
}));

describe('Vibe Mode Enhancements (v0.5.0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners = {};
    activeInvokes = 0;
    maxConcurrentInvokes = 0;
    useLayoutStore.getState().setEditorMode('vibe');
    (window as any).__IFAI_EDITOR_MODE__ = 'vibe';
    useFileStore.setState({ rootPath: '/test-project' });
  });

  it('SHOULD limit concurrent tool executions to 5', async () => {
    const chatStore = useChatStore.getState() as any;
    const messageId = 'msg-concurrent-test';
    
    // 1. 预填 10 个工具调用
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

    // 2. 同时批准所有工具
    const promises = toolCalls.map(tc => {
        return chatStore.approveToolCall(messageId, tc.id);
    });

    await Promise.all(promises);

    console.log('MAX CONCURRENT INVOKES:', maxConcurrentInvokes);
    expect(maxConcurrentInvokes).toBeLessThanOrEqual(5);
  });

  it('SHOULD automatically trigger silent approval in Vibe mode on finish', async () => {
    const chatStore = useChatStore.getState() as any;
    const assistantMsgId = 'vibe-msg-1';
    
    // 1. 发送消息以注册监听器
    await chatStore.sendMessage('Hello', 'provider', 'model');
    
    // 2. 找到生成的 assistant 消息 ID (可能是 crypto.randomUUID 生成的，我们从 state 拿)
    const state = useChatStore.getState();
    const assistantMsg = state.messages.find(m => m.role === 'assistant');
    const realAssistantId = assistantMsg?.id;
    expect(realAssistantId).toBeDefined();

    // 3. 注入工具调用到该消息
    useChatStore.setState(s => ({
        messages: s.messages.map(m => m.id === realAssistantId ? {
            ...m,
            toolCalls: [{
                id: 'vibe-call-1',
                tool: 'agent_read_file',
                function: { name: 'agent_read_file', arguments: '{"path":"App.tsx"}' },
                status: 'pending'
            }]
        } : m)
    }));

    // 4. 触发 finish 监听器
    const finishKey = `${realAssistantId}_finish`;
    const onFinish = listeners[finishKey];
    expect(onFinish).toBeDefined();
    
    await onFinish({ payload: 'done' });

    // 5. 验证是否自动触发了工具执行
    const hasToolInvoke = (invoke as any).mock.calls.some((c: any) => c[0] === 'agent_read_file');
    expect(hasToolInvoke).toBe(true);
  });
});