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

describe('Tool Call Streaming Regression (v0.4.0)', () => {
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
        baseUrl: 'https://api.test.com',
        models: ['test-model'],
        protocol: 'openai'
      }],
      currentProviderId: 'test-provider',
      currentModel: 'test-model',
      enableNaturalLanguageAgentTrigger: false
    });

    listenMock.mockResolvedValue(() => {});
    invokeMock.mockImplementation((cmd) => {
      if (cmd === 'local_model_preprocess') {
        return Promise.resolve({ should_use_local: false });
      }
      return Promise.resolve(undefined);
    });
  });

  it('SHOULD update tool call arguments incrementally during streaming', async () => {
    const messageContent = '重构 README.md';
    const providerId = 'test-provider';
    const modelId = 'test-model';

    const eventListeners: Record<string, (event: any) => void> = {};
    listenMock.mockImplementation((event, callback) => {
      eventListeners[event] = callback;
      return Promise.resolve(() => {});
    });

    // 🏆 PIVO 3.0: 必须使用 FakeTimers 以处理 StreamingResponseController 的节流
    vi.useFakeTimers();

    // 1. 发送消息
    await useChatStore.getState().sendMessage(messageContent, providerId, modelId);

    const messages = useChatStore.getState().messages;
    const assistantMsgId = messages[1].id;
    const streamCallback = eventListeners[assistantMsgId];

    try {
        // Chunk 1: 开始 tool_call
        streamCallback({ 
        payload: JSON.stringify({ 
            type: 'tool_call', 
            toolCall: { 
            index: 0, 
            id: 'call_123', 
            function: { name: 'agent_write_file', arguments: '{"rel_path":' } 
            } 
        }) 
        });

        vi.advanceTimersByTime(100);

        let currentMsg = useChatStore.getState().messages[1];
        expect(currentMsg.toolCalls).toBeDefined();
        expect(currentMsg.toolCalls![0].function?.arguments).toBe('{"rel_path":');

        // Chunk 2: 更多参数内容
        streamCallback({ 
        payload: JSON.stringify({ 
            type: 'tool_call', 
            toolCall: { 
            index: 0, 
            function: { arguments: '"README.md"' } 
            } 
        }) 
        });

        vi.advanceTimersByTime(100);

        currentMsg = useChatStore.getState().messages[1];
        expect(currentMsg.toolCalls![0].function?.arguments).toBe('{"rel_path":"README.md"');

        // Chunk 3: 结束参数
        streamCallback({ 
        payload: JSON.stringify({ 
            type: 'tool_call', 
            toolCall: { 
            index: 0, 
            function: { arguments: '}' } 
            } 
        }) 
        });

        vi.advanceTimersByTime(100);

        currentMsg = useChatStore.getState().messages[1];
        expect(currentMsg.toolCalls![0].function?.arguments).toBe('{"rel_path":"README.md"}');
        expect(currentMsg.toolCalls![0].args.rel_path).toBe('README.md');
    } finally {
        vi.useRealTimers();
    }
  });

  it('SHOULD extract partial content using regex when JSON is incomplete', async () => {
    const eventListeners: Record<string, (event: any) => void> = {};
    listenMock.mockImplementation((event, callback) => {
      eventListeners[event] = callback;
      return Promise.resolve(() => {});
    });

    await useChatStore.getState().sendMessage('test', 'test-provider', 'test-model');
    const assistantMsgId = useChatStore.getState().messages[1].id;
    const streamCallback = eventListeners[assistantMsgId];

    vi.useFakeTimers();

    try {
      // Chunk 1
      streamCallback({ 
        payload: JSON.stringify({ 
          type: 'tool_call', 
          toolCall: { 
            index: 0, id: 'call_regex', 
            function: { name: 'agent_write_file', arguments: '{"content": "Hello' } 
          } 
        }) 
      });

      vi.advanceTimersByTime(100);
      let msg = useChatStore.getState().messages[1];
      expect(msg.toolCalls![0].args.content).toBe('Hello');

      // Chunk 2
      streamCallback({ 
        payload: JSON.stringify({ 
          type: 'tool_call', 
          toolCall: { index: 0, function: { arguments: '\\nWorld' } } 
        }) 
      });

      vi.advanceTimersByTime(100);
      msg = useChatStore.getState().messages[1];
      expect(msg.toolCalls![0].args.content).toBe('Hello\nWorld');
    } finally {
      vi.useRealTimers();
    }
  });

  it('SHOULD handle HIGHLY FRAGMENTED chunks (DeepSeek style)', async () => {
    const eventListeners: Record<string, (event: any) => void> = {};
    listenMock.mockImplementation((event, callback) => {
      eventListeners[event] = callback;
      return Promise.resolve(() => {});
    });

    await useChatStore.getState().sendMessage('test', 'test-provider', 'test-model');
    const assistantMsgId = useChatStore.getState().messages[1].id;
    const streamCallback = eventListeners[assistantMsgId];

    vi.useFakeTimers();

    try {
      // Chunk 1: 只有 index 和 id
      streamCallback({ 
        payload: JSON.stringify({ 
          type: 'tool_call', toolCall: { index: 0, id: 'call_fragmented' } 
        }) 
      });
      vi.advanceTimersByTime(100);

      // Chunk 2: 名字的一半
      streamCallback({ 
        payload: JSON.stringify({ 
          type: 'tool_call', toolCall: { index: 0, function: { name: 'agent_write' } } 
        }) 
      });
      vi.advanceTimersByTime(100);

      // Chunk 3: 名字的另一半
      streamCallback({ 
        payload: JSON.stringify({ 
          type: 'tool_call', toolCall: { index: 0, function: { name: '_file' } } 
        }) 
      });
      vi.advanceTimersByTime(100);

      let msg = useChatStore.getState().messages[1];
      expect(msg.toolCalls![0].tool).toBe('agent_write_file');
      
      // Chunk 4: 参数
      streamCallback({ 
        payload: JSON.stringify({ 
          type: 'tool_call', 
          toolCall: { index: 0, function: { arguments: '{"rel_path": "test.txt"}' } } 
        }) 
      });
      vi.advanceTimersByTime(100);

      msg = useChatStore.getState().messages[1];
      expect(msg.toolCalls![0].args.rel_path).toBe('test.txt');
    } finally {
      vi.useRealTimers();
    }
  });
});
