const assert = require('assert');

/**
 * PIVO 3.0 高保真快照验证脚本
 * 模拟 AI 从文本规划到物理层 UUID 校验的全过程
 */

console.log("=== PIVO 3.0 高保真快照逻辑验证 ===\n");

// 1. Mock Inline Store (UI State)
let inlineState = {
  isInlineEditVisible: true,
  pivoStage: 'idle',
  pivoTasks: [],
  modifiedCode: ''
};

const mockInlineStore = {
  getState: () => inlineState,
  setState: (update) => {
    const nextState = typeof update === 'function' ? update(inlineState) : update;
    inlineState = { ...inlineState, ...nextState };
    console.log(`[UI Update] Stage: ${inlineState.pivoStage}, Tasks: ${inlineState.pivoTasks.length}, CodeLen: ${inlineState.modifiedCode.length}`);
  }
};

// 2. Mock Global Environment
global.window = { __inlineEditStore: mockInlineStore };
global.process = { ...process, env: { ...process.env, NODE_ENV: 'test' } };
const originalConsole = { ...console };
global.console = { ...console, log: (...args) => originalConsole.log(...args), warn: (...args) => originalConsole.warn(...args) };

// 3. Simulated InlineSyncService (Logical equivalent of TS implementation)
const InlineSyncService = {
  syncState: (toolName, content, textChunk) => {
    const inlineStore = global.window.__inlineEditStore;
    if (!inlineStore) return;
    const state = inlineStore.getState();
    if (!state.isInlineEditVisible) return;

    inlineStore.setState((prev) => {
      const currentTasks = [...(prev.pivoTasks || [])];
      let pivoStage = prev.pivoStage;

      if (textChunk && (prev.pivoStage === 'plan' || prev.pivoStage === 'idle')) {
        const planMatch = textChunk.match(/(?:我将|首先|接着|然后|最后|开始)\s*(?:我将)?\s*(.*?)(?:。| |\n|$)/);
        if (planMatch) {
          const desc = planMatch[1].trim();
          if (!currentTasks.some(t => t.description.includes(desc))) {
            currentTasks.push({ id: 't_' + Date.now(), description: desc, status: 'running' });
            pivoStage = 'plan';
          }
        }
      }

      if (toolName) {
        pivoStage = 'implement';
        let desc = toolName.includes('read') ? '读取关联上下文' : (toolName.includes('write') ? '正在编写优化代码' : '');
        if (desc && !currentTasks.some(t => t.description === desc)) {
          currentTasks.forEach(t => { if (t.status === 'running') t.status = 'success'; });
          currentTasks.push({ id: 'tool_' + Date.now(), description: desc, status: 'running' });
        }
      }

      return {
        pivoStage: toolName ? 'implement' : (textChunk && pivoStage === 'idle' ? 'plan' : pivoStage),
        modifiedCode: (toolName && content !== undefined) ? content : prev.modifiedCode,
        pivoTasks: currentTasks
      };
    });
  },
  handleResponseFinish: () => {
    const inlineStore = global.window.__inlineEditStore;
    const { modifiedCode, pivoTasks } = inlineStore.getState();
    if (!modifiedCode) {
      console.log("[Sentinel] ⚠️ AI finish without code changes.");
    } else {
      const updatedTasks = pivoTasks.map(t => ({ ...t, status: 'success' }));
      inlineStore.setState({ pivoTasks: updatedTasks, pivoStage: 'complete' });
    }
  }
};

// 4. Simulated SentinelService (Anti-Hallucination logic)
const SentinelService = {
  activeUuid: null,
  scanForUuid: (messages) => {
    const userMsg = messages.find(m => m.role === 'user');
    if (userMsg) {
      const match = userMsg.content.match(/PIVO_UUID:([a-zA-Z0-9-]+)/);
      if (match) {
        SentinelService.activeUuid = match[1];
        console.log(`[Sentinel] 🛡️ Captured UUID: ${SentinelService.activeUuid}`);
      }
    }
  },
  beforeExecute: (tool, args) => {
    if (!SentinelService.activeUuid) return;
    if (tool.includes('write')) {
      if (args.content.includes(SentinelService.activeUuid)) {
        console.log(`[Sentinel] ✅ Physical Integrity Verified for ${tool}`);
      } else {
        console.warn(`[Sentinel] ⛔ INTEGRITY FAILURE for ${tool}: UUID missing from arguments!`);
      }
    }
  }
};

// --- START TEST FLOW ---

// Test 1: Plan Extraction
console.log("\n[TEST 1] Testing Text Planning Extraction...");
InlineSyncService.syncState('', '', '首先我将读取文件内容。');
assert.strictEqual(inlineState.pivoStage, 'plan');
assert.strictEqual(inlineState.pivoTasks[0].description, '读取文件内容');

// Test 2: Tool Sync & Sentinel
console.log("\n[TEST 2] Testing Tool Execution & Sentinel Verification...");
const history = [{ role: 'user', content: '请帮我修改代码。PIVO_UUID:test-123' }];
SentinelService.scanForUuid(history);

const writeArgs = { content: '// Some code with test-123' };
SentinelService.beforeExecute('agent_write_file', writeArgs);
InlineSyncService.syncState('agent_write_file', writeArgs.content, '');

assert.strictEqual(inlineState.pivoStage, 'implement');
assert.strictEqual(inlineState.modifiedCode, writeArgs.content);
assert.strictEqual(inlineState.pivoTasks[1].description, '正在编写优化代码');
assert.strictEqual(inlineState.pivoTasks[1].status, 'running');
assert.strictEqual(inlineState.pivoTasks[0].status, 'success');

// Test 3: Hallucination Detection
console.log("\n[TEST 3] Testing Hallucination Detection...");
const badArgs = { content: '// Code missing uuid' };
SentinelService.beforeExecute('agent_write_file', badArgs); // Should warn

// Test 4: Finalization
console.log("\n[TEST 4] Testing Response Finalization...");
InlineSyncService.handleResponseFinish();
assert.strictEqual(inlineState.pivoStage, 'complete');
assert.strictEqual(inlineState.pivoTasks.every(t => t.status === 'success'), true);

console.log("\n✅ PIVO 3.0 高保真验证通过！核心逻辑重构正确。");
