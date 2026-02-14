import { describe, it, expect, vi } from 'vitest';

// 模拟自愈逻辑的纯函数版本（用于测试逻辑本身）
function simulateSelfHealing(messages: any[], assistantMsgId: string) {
  return messages.map(m => {
    if (m.id === assistantMsgId && m.toolCalls) {
      return {
        ...m,
        toolCalls: m.toolCalls.map((tc: any) => {
          let finalArgs = tc.args || {};
          // 🏆 PIVO 2.0 恢复逻辑
          if (Object.keys(finalArgs).length === 0 && tc.function?.arguments) {
            try {
              finalArgs = JSON.parse(tc.function.arguments);
            } catch (e) {
              // 解析失败逻辑
            }
          }
          return { ...tc, isPartial: false, args: finalArgs };
        })
      };
    }
    return m;
  });
}

describe('Chat Parameter Recovery (PIVO 2.0)', () => {
  it('应该在流结束时从原始字符串物理还原丢失的参数', () => {
    const assistantMsgId = 'msg-123';
    const mockMessages = [
      {
        id: assistantMsgId,
        role: 'assistant',
        toolCalls: [
          {
            id: 'call-1',
            tool: 'agent_write_file',
            isPartial: true,
            args: {}, // 😱 模拟竞态条件：此处为空对象
            function: {
              name: 'agent_write_file',
              arguments: '{"rel_path": "test.ts", "content": "hello world"}' // ✅ 源码是完整的
            }
          }
        ]
      }
    ];

    // 执行自愈逻辑
    const updatedMessages = simulateSelfHealing(mockMessages, assistantMsgId);
    const recoveredArgs = updatedMessages[0].toolCalls[0].args;

    // 验证
    expect(updatedMessages[0].toolCalls[0].isPartial).toBe(false);
    expect(recoveredArgs).toHaveProperty('rel_path', 'test.ts');
    expect(recoveredArgs).toHaveProperty('content', 'hello world');
    console.log('✅ 参数恢复测试通过：', recoveredArgs);
  });

  it('如果参数已经存在，则不应破坏现有数据', () => {
    const assistantMsgId = 'msg-456';
    const mockMessages = [
      {
        id: assistantMsgId,
        toolCalls: [
          {
            id: 'call-2',
            args: { existing: true },
            function: { arguments: '{"new": "data"}' }
          }
        ]
      }
    ];

    const updated = simulateSelfHealing(mockMessages, assistantMsgId);
    expect(updated[0].toolCalls[0].args).toHaveProperty('existing', true);
  });
});
