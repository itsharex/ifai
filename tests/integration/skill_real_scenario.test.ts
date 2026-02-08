import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStore } from '../../src/stores/useChatStore';
import { useSkillStore } from '../../src/stores/skillStore';
import { useFileStore } from '../../src/stores/fileStore';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe('Skills Real-World Scenario (v0.5.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSkillStore.getState().reset();
    useFileStore.setState({ rootPath: '/mock/project' });
  });

  it('SHOULD NOT send empty activeSkillIds when a skill is activated', async () => {
    // 1. 模拟激活技能
    useSkillStore.setState({ activeSkillIds: ['japanese-translator'] });
    expect(useSkillStore.getState().activeSkillIds).toEqual(['japanese-translator']);

    // 2. 模拟发送消息
    try {
      await useChatStore.getState().sendMessage('test', 'openai', 'gpt-4o');
    } catch (e) {}

    // 3. 检查 invoke('ai_chat', ...) 的参数
    const call = (invoke as any).mock.calls.find((c: any) => c[0] === 'ai_chat');
    expect(call).toBeDefined();
    
    const args = call[1];
    // 如果这里失败（返回空数组或 undefined），说明执行的是旧代码副本
    expect(args.activeSkillIds).toEqual(['japanese-translator']);
  });
});
