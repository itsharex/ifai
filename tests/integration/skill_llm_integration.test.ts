import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStore } from '../../src/stores/useChatStore';
import { useSkillStore } from '../../src/stores/skillStore';
import { useFileStore } from '../../src/stores/fileStore';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock listen
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe('Skill & LLM Integration (v0.5.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSkillStore.getState().reset();
    useFileStore.setState({ rootPath: '/mock/project' });
  });

  it('should include active skill IDs when calling ai_chat', async () => {
    // 1. 准备技能
    const mockSkills = [{ id: 'japanese-translator', name: 'Japanese', description: 'x', version: '1.0' }];
    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'get_available_skills') return Promise.resolve(mockSkills);
      return Promise.resolve();
    });

    // 2. 激活技能
    await useSkillStore.getState().fetchSkills();
    useSkillStore.getState().activateSkill('japanese-translator');
    
    expect(useSkillStore.getState().activeSkillIds).toContain('japanese-translator');

    // 3. 发送消息
    try {
      await useChatStore.getState().sendMessage('Hello', 'openai', 'gpt-4o');
    } catch (e) {
      // sendMessage might throw because of other missing mocks, but we only care about the invoke call
    }

    // 4. 验证 invoke('ai_chat', ...) 是否带有 active_skill_ids
    const aiChatCall = (invoke as any).mock.calls.find((call: any) => call[0] === 'ai_chat');
    expect(aiChatCall).toBeDefined();
    
    const args = aiChatCall[1];
    expect(args.active_skill_ids).toBeDefined();
    expect(args.active_skill_ids).toContain('japanese-translator');
    
    console.log('✅ Success: Active skill IDs were successfully passed to ai_chat invoke.');
  });
});
