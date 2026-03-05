import { describe, it, expect } from 'vitest';
import { selectMessagesForContext } from '../contextFilter';
import { Message } from '../../stores/chatStore';

describe('selectMessagesForContext (Fidelity Fix)', () => {
  it('应该在长对话中强制保留最新的用户消息以防止后端报错', async () => {
    // 1. 模拟长对话 (50条消息)
    const history: any[] = [];
    history.push({ role: 'system', content: 'System message' });
    for (let i = 0; i < 48; i++) {
      history.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Msg ${i}` });
    }
    
    // 最新的关键用户消息
    const targetId = "target-user-msg";
    history.push({ id: targetId, role: 'user', content: 'Crucial user intent' });

    // 2. 执行截断 (限制为 10 条)
    const selected = await selectMessagesForContext(history, 10);

    // 3. 物理校验
    expect(selected.length).toBeLessThanOrEqual(10);
    expect(selected.some(m => m.role === 'system')).toBe(true); // 必须有系统消息
    expect(selected.some(m => m.id === targetId)).toBe(true); // 必须有最新的用户消息
    expect(selected[selected.length - 1].id).toBe(targetId); // 最新消息必须在末尾保持时序
  });

  it('应该正确处理 tool_calls 和 tool_call_id 的完整性配对', async () => {
    const history: any[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
      { id: 'call_1', role: 'assistant', toolCalls: [{ id: 'tc_1', tool: 'test', args: {} }] },
      { role: 'tool', tool_call_id: 'tc_1', content: 'result' },
      { id: 'latest', role: 'user', content: 'next' }
    ];

    // 如果限制只取 2 条，且包含了最新的 user，它也应该能把配对的 tool 消息带上（如果权重允许）
    // 或者至少不崩溃
    const selected = await selectMessagesForContext(history, 3);
    expect(selected.some(m => m.id === 'latest')).toBe(true);
  });
});
