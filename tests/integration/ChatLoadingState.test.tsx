import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStore } from '../../src/stores/useChatStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useThreadStore } from '../../src/stores/threadStore';

// Mock Tauri APIs
const invokeMock = vi.fn();
const listenMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => invokeMock(...args)
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: any[]) => listenMock(...args)
}));

// Mock i18n
vi.mock('../../src/i18n/config', () => ({
  default: {
    t: (key: string) => key
  }
}));

// Mock dependencies
vi.mock('../../src/stores/fileStore', () => ({
  useFileStore: {
    getState: () => ({ rootPath: '/test/project' })
  }
}));

vi.mock('../../src/stores/agentStore', () => ({
  useAgentStore: {
    getState: () => ({ launchAgent: vi.fn() })
  }
}));

vi.mock('../../src/utils/intentRecognizer', () => ({
  recognizeIntent: () => ({ type: 'unknown', confidence: 0 }),
  shouldTriggerAgent: () => false,
  formatAgentName: (name: string) => name
}));

describe('Chat Loading State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({ messages: [], isLoading: false });
    useThreadStore.getState().activeThreadId = 'test-thread';
    
    useSettingsStore.setState({
      providers: [{
        id: 'test-provider',
        name: 'Test Provider',
        enabled: true,
        apiKey: 'test-key',
        models: ['test-model'],
        protocol: 'openai'
      }],
      currentProviderId: 'test-provider',
      currentModel: 'test-model',
      enableNaturalLanguageAgentTrigger: false
    });

    listenMock.mockResolvedValue(() => {});
    // Mock successful invoke for local_model_preprocess to avoid TypeError
    invokeMock.mockImplementation((cmd) => {
      if (cmd === 'local_model_preprocess') {
        return Promise.resolve({ should_use_local: false });
      }
      return Promise.resolve(undefined);
    });
  });

  it('should reset isLoading to false after stream finish', async () => {
    // Capture event listeners
    const eventListeners: Record<string, (event: any) => void> = {};
    listenMock.mockImplementation((event, callback) => {
      eventListeners[event] = callback;
      return Promise.resolve(() => {});
    });

    // 🏆 PIVO 3.0: 必须使用 FakeTimers
    vi.useFakeTimers();

    // 1. Start request
    const sendPromise = useChatStore.getState().sendMessage('你好', 'test-provider', 'test-model');
    
    // 允许异步初始化完成（拦截器等）
    await vi.advanceTimersByTimeAsync(10);
    
    // Check loading state
    expect(useChatStore.getState().isLoading).toBe(true);

    await sendPromise; // Wait for invoke to complete

    // Find assistant message ID
    const messages = useChatStore.getState().messages;
    const assistantMsg = messages[1];
    expect(assistantMsg).toBeDefined();

    // 2. Simulate Finish Event
    const finishEventName = `${assistantMsg.id}_finish`;
    const finishCallback = eventListeners[finishEventName];
    expect(finishCallback).toBeDefined();

    await finishCallback({ payload: 'done' });
    
    // 前进时间以触发自洁
    vi.advanceTimersByTime(200);

    // 3. Verify loading state is reset
    expect(useChatStore.getState().isLoading).toBe(false);
    
    vi.useRealTimers();
  });

  it('should reset isLoading to false after stream error', async () => {
    const eventListeners: Record<string, (event: any) => void> = {};
    listenMock.mockImplementation((event, callback) => {
      eventListeners[event] = callback;
      return Promise.resolve(() => {});
    });

    vi.useFakeTimers();

    const sendPromise = useChatStore.getState().sendMessage('你好', 'test-provider', 'test-model');
    await vi.advanceTimersByTimeAsync(10);
    
    expect(useChatStore.getState().isLoading).toBe(true);
    await sendPromise;

    const messages = useChatStore.getState().messages;
    const assistantMsg = messages[1];
    
    const errorEventName = `${assistantMsg.id}_error`;
    const errorCallback = eventListeners[errorEventName];
    expect(errorCallback).toBeDefined();

    await errorCallback({ payload: 'Some Error' });
    vi.advanceTimersByTime(200);

    expect(useChatStore.getState().isLoading).toBe(false);
    vi.useRealTimers();
  });
});
