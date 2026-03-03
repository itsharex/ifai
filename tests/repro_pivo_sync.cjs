const assert = require('assert');

/**
 * E2E Repro: PIVO 任务流同步验证
 * 模拟 AI 从文本规划到工具执行的全过程，验证 Inline Store 状态机。
 */

console.log("=== PIVO 2.0 全链路状态同步测试 ===\n");

// 1. 模拟状态容器
let storeState = {
    isInlineEditVisible: true,
    pivoStage: 'plan',
    pivoTasks: [],
    modifiedCode: ''
};

const inlineStore = {
    getState: () => storeState,
    setState: (newState) => {
        storeState = { ...storeState, ...newState };
        console.log(`[Store Update] Stage: ${storeState.pivoStage}, Tasks: ${storeState.pivoTasks.length}, CodeLen: ${storeState.modifiedCode.length}`);
    }
};

// 2. 实现待测函数 (基于 useChatStore.ts 里的真实逻辑)
function syncToInlineAssistant(name, content, textChunk) {
    if (inlineStore.getState().isInlineEditVisible) {
        const state = inlineStore.getState();
        const currentTasks = [...(state.pivoTasks || [])];
        
        // 提取规划
        if (textChunk && state.pivoStage === 'plan') {
            const planMatch = textChunk.match(/(?:我将|首先|接着|然后|最后|开始)\s*(.*?)(?:。| |\n|$)/);
            if (planMatch && planMatch[1].length > 2) {
                const desc = planMatch[1].trim();
                if (!currentTasks.some(t => t.description.includes(desc))) {
                    currentTasks.push({ id: 't1', description: desc, status: 'running', stage: 'plan' });
                }
            }
        }

        // 处理工具
        if (name) {
            const toolNameLower = name.toLowerCase();
            let desc = '';
            if (toolNameLower.includes('read')) desc = '读取关联上下文';
            else if (toolNameLower.includes('write')) desc = '正在编写优化代码';
            
            if (desc) {
                const isExisting = currentTasks.some(t => t.description === desc);
                if (!isExisting) {
                    // 贪婪清理
                    currentTasks.forEach(t => { if (t.status === 'running') t.status = 'success'; });
                    currentTasks.push({ id: 't2', description: desc, status: 'running', stage: 'implement' });
                }
            }
        }

        inlineStore.setState({ 
            pivoStage: name ? 'implement' : (textChunk ? 'plan' : state.pivoStage),
            modifiedCode: (name && content !== undefined) ? content : state.modifiedCode,
            pivoTasks: currentTasks
        });
    }
}

// 3. 执行测试序列
try {
    console.log("步骤 1: AI 开始说话...");
    syncToInlineAssistant("", "", "首先 优化这段代码结构。");
    assert.strictEqual(storeState.pivoStage, 'plan');
    assert.strictEqual(storeState.pivoTasks[0].description, '优化这段代码结构');
    assert.strictEqual(storeState.pivoTasks[0].status, 'running');

    console.log("步骤 2: AI 发起读取操作...");
    syncToInlineAssistant("agent_read_file", "", "");
    assert.strictEqual(storeState.pivoStage, 'implement');
    assert.strictEqual(storeState.pivoTasks[0].status, 'success');
    assert.strictEqual(storeState.pivoTasks[1].description, '读取关联上下文');

    console.log("步骤 3: AI 开始生成写入代码...");
    syncToInlineAssistant("agent_write_file", "const clock = ...", "");
    assert.strictEqual(storeState.pivoTasks[1].status, 'success');
    assert.strictEqual(storeState.pivoTasks[2].description, '正在编写优化代码');
    assert.strictEqual(storeState.modifiedCode, 'const clock = ...');

    console.log("\n✅ E2E 逻辑仿真验证成功！逻辑完全闭环。");
} catch (e) {
    console.error("\n❌ 测试失败:", e.message);
    process.exit(1);
}
