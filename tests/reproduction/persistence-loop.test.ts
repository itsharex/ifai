import { describe, it, expect, vi, beforeEach } from 'vitest';

// 🏆 核心：修正 Mock 缺失导出问题
vi.mock('ifainew-core', () => ({
    useChatStore: {
        getState: vi.fn(() => ({ messages: [] })),
        setState: vi.fn(),
        subscribe: vi.fn((cb) => vi.fn()) // 返回取消订阅函数
    },
    createToolCallDeduplicator: vi.fn(() => ({})),
    registerStores: vi.fn()
}));

// Mock useThreadStore
vi.mock('../../src/stores/threadStore', () => ({
    useThreadStore: {
        getState: () => ({ activeThreadId: 'thread-1' })
    }
}));

// Mock autoSaveThread
vi.mock('../../src/stores/persistence/threadPersistence', () => ({
    autoSaveThread: vi.fn()
}));

describe('Persistence Loop Defense (TDD)', () => {
    beforeEach(async () => {
        const { useChatStore } = await import('ifainew-core');
        vi.mocked(useChatStore.setState).mockClear();
    });

    it('should NOT trigger redundant setState when messages are identical', async () => {
        const { setThreadMessages } = await import('../../src/stores/useChatStore');
        const { useChatStore } = await import('ifainew-core');
        
        const testMessages = [{ id: '1', role: 'user', content: 'test' }];
        
        // 模拟 Store 当前已有这些消息
        vi.mocked(useChatStore.getState).mockReturnValue({ messages: testMessages } as any);
        vi.mocked(useChatStore.setState).mockClear();

        // 调用 setThreadMessages (传入相同数据)
        setThreadMessages('thread-1', [...testMessages] as any);
        
        // 🏆 核心断言：由于数据没变，setState 应该被跳过
        expect(useChatStore.setState).not.toHaveBeenCalled();
    });

    it('should trigger setState ONLY when messages change', async () => {
        const { setThreadMessages } = await import('../../src/stores/useChatStore');
        const { useChatStore } = await import('ifainew-core');
        
        const oldMessages = [{ id: '1', role: 'user', content: 'old' }];
        const newMessages = [{ id: '1', role: 'user', content: 'old' }, { id: '2', role: 'assistant', content: 'new' }];
        
        vi.mocked(useChatStore.getState).mockReturnValue({ messages: oldMessages } as any);

        // 调用 setThreadMessages (传入新数据)
        setThreadMessages('thread-1', newMessages as any);
        
        // 🏆 核心断言：数据变了，setState 必须被调用
        expect(useChatStore.setState).toHaveBeenCalled();
    });
});
