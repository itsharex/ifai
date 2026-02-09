# 🏆 IfAI 高保真测试基线 (High-Fidelity Baseline)

本文件定义了 IfAI 项目 E2E 测试的“黄金标准”。所有核心回归测试必须符合以下物理级准则，以消除 UI 随机性（Flakiness）。

## 1. 物理环境对齐 (Physical State Alignment)
**准则**：严禁等待 UI 自动加载配置。
**基线实现**：
```typescript
await page.evaluate(() => {
  const dbg = (window as any).__DEBUG__;
  dbg.settingsStore.setState({
    currentProviderId: 'baseline-provider',
    providers: [{ id: 'baseline-provider', enabled: true, ... }]
  });
});
```

## 2. 暴力路径清理 (UI Path Clearing)
**准则**：在执行任何 `click()` 或 `fill()` 之前，必须物理移除可能干扰点击的遮罩层。
**基线实现**：
```typescript
await page.evaluate(() => {
  document.querySelectorAll('.react-joyride__overlay, .react-joyride__spotlight').forEach(o => o.remove());
});
```

## 3. 物理驱动交互 (Physical Interaction)
**准则**：若元素被遮挡或点击无效，优先使用物理注入而非模拟点击。
**基线实现**：
```typescript
await page.evaluate(() => {
  const el = document.querySelector('textarea[data-testid="chat-input"]') as HTMLTextAreaElement;
  el.focus();
  el.value = '#'; // 物理设值
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
```

## 4. 以 Store 为唯一真理 (Store as Source of Truth)
**准则**：断言必须优先检查底层数据状态（Zustand Store），其次才是 DOM 文本。
**基线实现**：
```typescript
await page.waitForFunction(() => {
  return (window as any).__chatStore.getState().messages.some(m => m.role === 'tool');
}, { timeout: 15000 });
```

## 5. 标杆测试参考
- **物理注入模板**: `tests/e2e/v0_3_3/golden-llm-tool-usage.spec.ts`
- **提及/符号系统**: `tests/e2e/chat_symbol_precision.spec.ts`
- **Agent 核心链路**: `tests/e2e/agent_tools_regression.spec.ts`

---
*IfAI Engineering Baseline - v0.3.5*
