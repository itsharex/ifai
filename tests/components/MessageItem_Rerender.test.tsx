import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StreamingResponseController } from '../../src/services/chat/StreamingResponseController';

// Mock chat store to track reference updates
vi.mock('../../src/stores/useChatStore', () => ({
    useChatStore: {
        setState: vi.fn(),
        getState: () => ({ messages: [] })
    },
    toolCallDeduplicator: {
        getCanonicalId: (id: string) => id
    }
}));

describe('StreamingResponseController Performance (Red-Green)', () => {
    let controller: any;

    beforeEach(() => {
        controller = StreamingResponseController.getInstance();
    });

    it('should maintain stable object references for history messages during streaming', () => {
        const historyMsgId = 'history-1';
        const activeMsgId = 'active-1';
        
        const historyMsg = { id: historyMsgId, role: 'user', content: 'hello' };
        const activeMsg = { id: activeMsgId, role: 'assistant', content: '' };
        
        // 1. 初始化会话
        const sessionData = {
            buffer: [historyMsg, activeMsg],
            lastHeartbeat: Date.now(),
            hasReceivedChunk: false
        };

        // 2. 模拟收到新内容
        const payload = { type: 'content', content: 'AI reply' };
        
        // 我们需要直接调用私有方法 handleEventChunk 进行逻辑测试
        // @ts-ignore
        controller.handleEventChunk(activeMsgId, sessionData, payload);

        // 3. 🔴 关键物理断言：历史消息的对象引用必须绝对相等
        // 在老逻辑中，sessionData.buffer.map 会创建新对象，导致 historyMsg !== sessionData.buffer[0]
        expect(sessionData.buffer[0]).toBe(historyMsg);
        
        // 4. 活跃消息的对象引用必须改变（因为它更新了内容）
        expect(sessionData.buffer[1]).not.toBe(activeMsg);
        expect(sessionData.buffer[1].content).toBe('AI reply');
        
        console.log('[TDD] ✅ Reference pinning verified! History objects are static.');
    });
});
