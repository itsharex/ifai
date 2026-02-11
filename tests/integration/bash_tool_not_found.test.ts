
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStore } from '../../src/stores/useChatStore';
import { useFileStore } from '../../src/stores/fileStore';
import { invoke } from '@tauri-apps/api/core';

// 模拟物理环境
if (typeof window === 'undefined') {
  (global as any).window = {
    __IFAI_EDITOR_MODE__: 'spec',
    __IFAI_ACTIVE_SKILLS__: []
  };
}

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd, args) => {
    console.log('[Mock Invoke] Command:', cmd, 'Args:', args);
    if (cmd === 'bash' || cmd === 'run_shell_command' || cmd === 'execute_command') {
        return { status: 'success', stdout: 'Output', exit_code: 0 };
    }
    // 如果收到了错误的命令名，抛出错误
    if (cmd === 'agent_bash') {
        throw new Error('Command agent_bash not found');
    }
    return {};
  }),
}));

describe('Bash Tool Routing Regression (v0.5.0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFileStore.setState({ rootPath: '/test-project' });
  });

  it('SHOULD NOT prefix bash command with agent_ when invoking backend', async () => {
    const chatStore = useChatStore.getState() as any;
    const messageId = 'msg-bash-test';
    
    // 1. 模拟收到一个 bash 工具调用
    const toolCall = {
        id: 'call-bash-1',
        tool: 'bash',
        function: { name: 'bash', arguments: JSON.stringify({ command: 'npm run dev' }) },
        status: 'pending'
    };

    useChatStore.setState({
      messages: [{
        id: messageId,
        role: 'assistant',
        content: 'Running dev...',
        toolCalls: [toolCall]
      }]
    });

    // 2. 触发审批执行
    try {
        await chatStore.approveToolCall(messageId, 'call-bash-1');
    } catch (e) {
        // 如果逻辑错误，这里会捕获到 "Command agent_bash not found"
    }

    // 3. 验证调用记录
    const callNames = (invoke as any).mock.calls.map((c: any) => c[0]);
    console.log('INVOKE CALLS:', callNames);
    
    // 预期：不应该包含 agent_bash
    expect(callNames).not.toContain('agent_bash');
    // 应该包含正确的后端命令名（通常是 bash）
    expect(callNames.some((n: string) => n === 'bash' || n === 'run_shell_command')).toBe(true);
  });
});
