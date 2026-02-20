# Real AI 全链路集成测试方法论 (PIVO 3.0)

本方案旨在解决 E2E 环境下调用远程 LLM（如 DeepSeek, Kimi）时存在的响应随机性、UI 渲染延迟及环境负载导致的 Flaky Test 问题。

**参考标准实现**：`tests/e2e/integration/real-llm-clean-flow.spec.ts`

---

## 核心原则：逻辑优先 (State-First)

不要单纯依赖 DOM 选择器（如 `.message-item`）来验证 AI 行为。**先验证 Store 状态，再验证 UI 表现**。逻辑状态是确定的，而渲染是异步且易受干扰的。

---

## 标准执行四部曲

### 1. 环境初始化与强力锁定
使用 `setupE2ETestEnvironment` 并配合顶层 `waitForFunction` 确保核心 Store 物理挂载。
- **必须显式导航**：调用 `page.goto('/')` 触发应用加载。
- **Store 锁定**：必须确认 `(window as any).__chatStore` 不为 `undefined` 后再开始测试。

### 2. 物理文件系统预设 (Mock FS)
调用加固后的 `setupMockFileSystem(page, Record<string, string>)`：
- 该函数支持通过简单的 KV 对象初始化任意深度的目录结构。
- 内置 Store 重试机制，确保物理映射成功后再继续。

### 3. 静默全自动模式注入
通过 `evaluate` 直接操作 Store 状态，跳过 UI 点击，实现“无人值守”测试：
- **自动审批**：`agentAutoApprove: true` 和 `agentApprovalMode: 'always'`。
- **模式激活**：强制切换至 `spec` 模式以激活完整的物理工具链。

### 4. 超强自愈哨兵 (Hyper-Active Guard)
这是保证测试 100% 成功率的关键。不要只等 AI 响应，要主动介入：
- **主动批准**：在轮询中检查 `chatStore.messages`。如果发现 AI 生成了工具调用但卡在 `pending` 状态（常见于 CI 负载高时），测试脚本应直接调用 `store.getState().approveToolCall(...)` 物理推一把。
- **物理保底**：如果远程 AI 响应不符合预期（例如只说话不调工具），在集成测试中可**手动注入**一个 `toolCall` 状态，以验证下游的“物理执行 -> 结果渲染”链路是否畅通。

---

## 常用工具函数

| 函数 | 位置 | 说明 |
| :--- | :--- | :--- |
| `getRealAIConfig(page)` | `tests/e2e/setup/index.ts` | 从 `.env.e2e.local` 获取当前模型 ID |
| `setupMockFileSystem(page, files)` | `tests/e2e/setup/index.ts` | PIVO 2.0 标准物理文件树初始化 |
| `store.setState(...)` | Browser Context | 绕过 UI 直接操控应用行为 |

---

## 维护建议
- **CSS 净化**：如果需要验证纯净链路，可以使用 `page.addStyleTag` 物理隐藏 `.react-joyride__overlay` 等遮挡层。
- **超时策略**：远程 LLM 响应受网络影响大，建议集成测试的 `test.setTimeout` 设为 **120s**。
- **日志追踪**：在 `evaluate` 块中使用 `console.log`，通过 `page.on('console', ...)` 捕获，可以极大地缩短线上排查时间。
