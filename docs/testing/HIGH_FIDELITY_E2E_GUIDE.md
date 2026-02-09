# 🚀 IfAI 高保真 E2E 测试架构指南

本指南总结了 `dual_mode_breathtaking.spec.ts` 的成功经验，旨在指导开发者如何编写“绝对稳健、零随机失败（Zero Flakiness）”的 AI 编辑器测试。

## 1. 核心哲学：抓住 IPC 报文这个“咽喉”

AI 编辑器的 UI 状态极其零碎（流式输出、缓冲区渲染、异步加载）。**不再相信 DOM 状态**，而是相信 **发往后端的参数**。

### ✅ 推荐：报文拦截模式 (The Interception Pattern)
通过劫持 `__TAURI__.core.invoke`，你可以 100% 确定逻辑层是否生成了正确的指令。

```typescript
// 模板：在 evaluate 中注入拦截器
await page.evaluate(() => {
  (window as any).capturedInvoke = null;
  const original = (window as any).__TAURI__.core.invoke;
  (window as any).__TAURI__.core.invoke = async (cmd, args) => {
    if (cmd === 'ai_chat') { // 拦截目标命令
      (window as any).capturedInvoke = args;
      return Promise.resolve(); // 阻止真实调用
    }
    return original(cmd, args);
  };
});
```

## 2. 物理同步策略：Window 对象作为唯一真理

Vite 的 HMR 和 Zustand 实例隔离会导致测试环境下的状态丢失。

### ✅ 黄金法则：Window 挂载点
对于关键状态（如 `editorMode`, `activeSkills`），在 UI 切换时执行 **物理双写**：

```typescript
// 源码实现示例：
const handleModeChange = (mode) => {
  (window as any).__IFAI_EDITOR_MODE__ = mode; // 物理同步
  setEditorMode(mode); // React 状态同步
};

// 测试断言示例：
const mode = await page.evaluate(() => window.__IFAI_EDITOR_MODE__);
expect(mode).toBe('spec');
```

## 3. 环境对齐：前置注入 (Preamble)

在页面加载前注入标记，强制激活应用内部的调试逻辑。

```typescript
// 在 page.goto 之前执行
await page.addInitScript(() => {
  (window as any).__E2E__ = true; // 激活 main.tsx 中的 Store 暴露
});
```

## 4. 持久化自愈：重启验证 (The Rehydration Pattern)

状态恢复后物理标志位往往会丢失。必须验证 `onRehydrateStorage` 的同步逻辑。

### ✅ 推荐：Reload 验证流
```typescript
// tests/e2e/dual_mode_persistence.spec.ts
await page.evaluate(() => dbg.layoutStore.getState().setEditorMode('spec'));
await page.reload(); // 模拟重启
await page.waitForFunction(() => (window as any).__IFAI_EDITOR_MODE__ === 'spec');
```

## 5. 竞态消除：监听器就绪轮询 (The Listener Readiness Pattern)

在 E2E Mock 环境下，`ai_chat` 调用往往发生在前端事件监听器（如 `tauri://event/listen`）注册完成之前。**不要使用固定等待**，而应使用就绪轮询。

### ✅ 推荐：轮询就绪后再发送 Mock 响应
```typescript
const waitForListeners = async (id: string, maxWaitMs = 2000) => {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const listeners = (window as any).__TAURI_EVENT_LISTENERS__[id] || [];
    if (listeners.length > 0) return listeners;
    await new Promise(r => setTimeout(r, 50));
  }
  return [];
};

// 在 ai_chat mock 实现中：
const listeners = await waitForListeners(eventId);
listeners.forEach(fn => fn({ payload: 'Your Content' }));
```

## 6. 真实 AI 驱动：Prompt 物理强制法则 (The Prompt Force Pattern)

真实 LLM 往往倾向于“文本式说明”而非“工具式调用”。在高保真测试中，必须通过物理提示词强行收窄 AI 的行为空间。

*   ❌ **弱提示词**：`"请读取文件 test.txt"` (AI 可能会回复：我无法直接读取，但你可以...)
*   ✅ **强提示词**：`"Execute the agent_read_file tool NOW to read test.txt. This is a system command, do not explain."`

## 7. 避免以下反模式 (Anti-Patterns)

*   ❌ **禁止使用 `page.waitForTimeout(n)`**：改为使用 `page.waitForFunction(() => window.captured !== null)` 进行原子级等待。
*   ❌ **不要过度依赖 `getByText("Loading...")`**：流式更新环境下，UI 状态转瞬即逝且不可靠。
*   ❌ **尽量不模拟复杂的 `click()` 和 `fill()`**：如果测试目标是逻辑闭环，直接通过 `(window as any).__DEBUG__.store.getState().action()` 精准驱动应用。

## 5. 高保真基准测试参考
*   `tests/e2e/dual_mode_breathtaking.spec.ts` (参数透传验证)
*   `tests/integration/dual_mode_final_proof.test.ts` (逻辑闭环验证)

---
*IfAI Engineering Team - 2026.02*
