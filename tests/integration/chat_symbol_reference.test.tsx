import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStore } from '../../src/stores/useChatStore';
import { invoke } from '@tauri-apps/api/core';

// 1. 模拟物理机环境
if (typeof window === 'undefined') {
  (global as any).window = {
    __IFAI_EDITOR_MODE__: 'spec',
    __IFAI_ACTIVE_SKILLS__: [],
    __DEBUG__: {
        settingsStore: { getState: () => ({ providers: [{id: 'e2e', enabled: true, models: ['m1']}] }) }
    }
  };
}

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd, args) => {
    if (cmd === 'get_file_symbols') {
      return [{ name: 'calculateTotal', kind: 'Function', line: 10 }];
    }
    return "OK";
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('../../src/utils/fileSystem', () => ({
  readFileContent: vi.fn(async (path) => {
    return "Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8
Line 9
Line 10
Line 11
Line 12
Line 13
Line 14
Line 15
Line 16
Line 17
Line 18
Line 19
Line 20";
  }),
  readDirectory: vi.fn(),
}));

describe('Chat Symbol Reference System (Logic Verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SHOULD inject precise symbol context into the prompt', async () => {
    const sendMessage = useChatStore.getState().sendMessage;
    const content = '分析下 [#calculateTotal](src/main.ts:10-15)';
    
    try {
      await sendMessage(content, 'e2e', 'm1');
    } catch (e) {}

    const call = (invoke as any).mock.calls.find((c: any) => c[0] === 'ai_chat');
    expect(call).toBeDefined();
    
    const finalContent = call[1].messages[call[1].messages.length - 1].content;
    
    expect(finalContent).toContain('--- SYMBOL: calculateTotal IN src/main.ts (Lines 10-15) ---');
    expect(finalContent).toContain('Line 10');
    expect(finalContent).toContain('Line 15');
  });
});
