
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStore } from '../../src/stores/useChatStore';
import { useLayoutStore } from '../../src/stores/layoutStore';
import { useSettingsStore } from '../../src/stores/settingsStore';

// Mock Tauri APIs
const invokeMock = vi.fn();
const listenMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => invokeMock(...args)
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: any[]) => listenMock(...args)
}));

describe('Mode Switching Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({ messages: [], isLoading: false });
    
    useSettingsStore.setState({
      providers: [{
        id: 'test-provider',
        name: 'Test Provider',
        enabled: true,
        apiKey: 'test-key',
        baseUrl: 'https://api.test.com',
        models: ['test-model'],
        protocol: 'openai'
      }],
      currentProviderId: 'test-provider',
      currentModel: 'test-model'
    });

    // Reset window mode
    (window as any).__IFAI_EDITOR_MODE__ = undefined;
  });

  it('SHOULD disable tools when switching to Vibe mode', async () => {
    // 1. Start in Spec mode
    useLayoutStore.getState().setEditorMode('spec');
    expect((window as any).__IFAI_EDITOR_MODE__).toBe('spec');

    // 2. Mock invoke for chat
    invokeMock.mockResolvedValue({ 
      should_use_local: false 
    });

    // 3. Switch to Vibe mode
    useLayoutStore.getState().setEditorMode('vibe');
    expect((window as any).__IFAI_EDITOR_MODE__).toBe('vibe');

    // 4. Send a message and check if tools are disabled in the request
    let chatOptions: any = null;
    
    // 模拟 ai_chat 触发结束事件，防止挂起
    invokeMock.mockImplementation(async (cmd, args) => {
      console.log('MOCK INVOKE:', cmd);
      if (cmd === 'ai_chat') {
        chatOptions = args; // Capture all args
        return { event_id: 'test-event' };
      }
      if (cmd === 'local_model_preprocess') {
        return { should_use_local: false };
      }
      return {};
    });

    await useChatStore.getState().sendMessage('Hello', 'test-provider', 'test-model');

    // 5. 等待异步处理完成 (patchedSendMessage 会触发异步生成)
    // 我们需要给它一点时间来触发 ai_chat
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(chatOptions).toBeDefined();
    // 关键点：在 Vibe 模式下，传递给后端的 enableTools 必须为 false
    expect(chatOptions.enableTools).toBe(false);
  });

  it('SHOULD respect explicit enableTools option even if global mode is spec', async () => {
    useLayoutStore.getState().setEditorMode('spec');
    
    let chatOptions: any = null;
    invokeMock.mockImplementation(async (cmd, args) => {
      if (cmd === 'ai_chat') {
        chatOptions = args;
        return { event_id: 'test-event' };
      }
      return {};
    });

    // 显式传入 enableTools: false
    // @ts-ignore
    await useChatStore.getState().generateResponse([], {}, { enableTools: false });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(chatOptions).toBeDefined();
    // 即使全局是 spec，如果 options 显式要求关闭工具，也应该关闭
    expect(chatOptions.enableTools).toBe(false);
  });

  it('SHOULD NOT enable tools if mode is undefined (defense)', async () => {
    (window as any).__IFAI_EDITOR_MODE__ = undefined;
    
    let chatOptions: any = null;
    invokeMock.mockImplementation(async (cmd, args) => {
      if (cmd === 'ai_chat') {
        chatOptions = args;
        return { event_id: 'test-event' };
      }
      return {};
    });

    await useChatStore.getState().sendMessage('Hello', 'test-provider', 'test-model');
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(chatOptions).toBeDefined();
    // 🚀 v0.5.0: 为了 E2E 兼容性，undefined 模式现在默认开启工具
    expect(chatOptions.enableTools).toBe(true);
  });
});
