import { selectMessagesForContext } from '../src/utils/contextFilter.js';
import assert from 'assert';

async function testContextFidelity() {
    console.log("🧪 TDD: 验证上下文截断逻辑的物理保真度...");

    // 1. 模拟长对话 (50条消息)
    const history = [];
    history.push({ role: 'system', content: 'You are an AI.' });
    for (let i = 0; i < 48; i++) {
        history.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i}` });
    }
    
    // 最新的用户消息（绝对不能丢）
    const targetUserMsgId = "crucial-user-msg";
    history.push({ id: targetUserMsgId, role: 'user', content: 'Please refactor my code.' });

    // 2. 执行截断 (限制为 10 条)
    console.log("   -> 尝试将 50 条消息截断至 10 条...");
    const selected = await selectMessagesForContext(history, 10);

    // 3. 物理校验
    console.log(`   -> 截断后剩余消息数: ${selected.length}`);
    
    const hasSystem = selected.some(m => m.role === 'system');
    const hasLatestUser = selected.some(m => m.id === targetUserMsgId);
    const lastMsgIsLatestUser = selected[selected.length - 1].id === targetUserMsgId;

    console.log(`   -> System 消息是否存在: ${hasSystem}`);
    console.log(`   -> 最新用户消息是否存在: ${hasLatestUser}`);
    console.log(`   -> 最新消息是否在末尾: ${lastMsgIsLatestUser}`);

    assert.strictEqual(hasSystem, true, "System 消息物理丢失！");
    assert.strictEqual(hasLatestUser, true, "最新用户消息被错误截断！导致后端报错 No user message to process");
    assert.strictEqual(lastMsgIsLatestUser, true, "消息序列物理乱序！");

    console.log("\n✅ TDD 验证通过！上下文过滤逻辑已恢复物理高保真。");
}

testContextFidelity().catch(e => {
    console.error("❌ TDD 验证失败:", e.message);
    process.exit(1);
});
