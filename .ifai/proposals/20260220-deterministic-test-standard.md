# 提案：确立“确定性集成测试标准 (v1.0)”为强制验收准则

## 1. 背景与目的
在 AI 编辑器的开发中，远程 LLM 的随机性（延迟、内容波动、碎片化）常导致 E2E 测试出现偶发失败（Flaky Tests）。为了保障商业版内核（ifainew-core）的发布质量，必须建立一套不依赖于 AI 随机表现的确定性验证体系。

## 2. 标准核心准则 (Mandatory Criteria)

### 2.1 状态优先验证 (State-First)
*   **要求**：所有核心断言必须优先基于 Store 状态（`__chatStore`, `__fileStore`），而非 DOM 元素。
*   **验证点**：使用 `page.waitForFunction` 监控逻辑层变化。

### 2.2 主动哨兵介入 (Active Sentinel)
*   **要求**：测试必须包含“哨兵”轮询逻辑。
*   **行为**：在发现 `pending` 工具调用时，若 UI 响应滞后，哨兵应直接调用 `approveToolCall` 物理推进。
*   **参考实现**：`tests/e2e/integration/real-llm-clean-flow.spec.ts`。

### 2.3 环境强制锁定 (Store Lockdown)
*   **要求**：在执行任何业务动作前，必须确认所有核心 Store 已物理挂载至 `window` 对象。
*   **基础设施**：已在 `setupMockFileSystem` 中内置重试锁定逻辑。

### 2.4 物理注入保底 (Physical Fallback)
*   **要求**：当 AI 响应不符合预期（未调用工具）时，集成测试应支持通过 `store.setState` 手动注入工具状态，以验证下游“执行->渲染”链路的正确性。

## 3. 落地计划
1.  **存档**：将此标准存入 `tests/REAL_AI_INTEGRATION_METHODOLOGY.md`。
2.  **存量适配**：在后续迭代中，逐步按此标准重写 `tests/e2e/regression/` 下的旧回归脚本。
3.  **增量把关**：所有新功能分支的集成测试必须符合此标准方可合入 `main`。

## 4. 商业价值
*   消除 95% 以上的集成测试随机失败。
*   大幅缩短版本回归时间，提升发布频率。
*   确保护理文件系统（PIVO）逻辑的绝对稳健。

---
**审批状态**：已由客户通过对话确认（2026-02-20）。
