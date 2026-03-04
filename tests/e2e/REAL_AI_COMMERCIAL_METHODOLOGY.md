# 商业版全链路集成测试方法论 (PIVO 3.0 Commercial)

**状态：项目强制验收准则**
**生效日期：2026-03-04**

## 核心理念
旨在通过“真实大模型 (Real LLM) + 真实商业逻辑 (Real Core) + 物理自愈哨兵”的组合，验证 IfAI 商业版在极端真实环境下的鲁棒性。

## 测试标准范本
所有新增的商业版集成测试必须参考 `tests/e2e/integration/tauri-commercial-real-llm.spec.ts` 实现。

### 1. 运行环境配置
执行测试时必须携带以下环境变量以激活商业版链路：
```bash
APP_EDITION=commercial USE_REAL_CORE=true npx playwright test ...
```

### 2. 初始化准则 (BeforeEach)
*   **跳过引导**：必须设置 `skipWelcome: true` 避免 UI 遮挡。
*   **Store 锁定**：必须通过 `page.waitForFunction` 确保 `__chatStore`, `__fileStore` 等关键 Store 挂载完成。
*   **物理层 Mock**：使用 `setupMockFileSystem` 初始化物理文件，但需配合 **动态 UUID 校验**（见下文）。
*   **静默审批**：通过 Store 预设 `agentAutoApprove: true` 实现全自动执行。

### 3. 真实性校验 (Anti-Hallucination)
禁止仅验证 AI 回复了文字。必须通过以下手段验证 AI 真实调用了工具：
*   **动态注入**：在测试文件中写入随机 UUID（如 `test-uuid-${random}`）。
*   **工具强制**：在 Prompt 中明确要求“必须使用工具获取内容”。
*   **结果比对**：断言 AI 返回的内容中包含该动态 UUID，证明工具链物理打通。

### 4. 链路稳定性 (Sentinel Logic)
由于远程 LLM 可能存在延迟或“犹豫”，测试脚本需具备主动介入能力：
*   **主动批准**：若自动审批未触发，脚本应在等待循环中主动调用 `approveToolCall`。
*   **物理注入保底**：对于极不稳定的模型，允许在验证下游 UI 时手动注入 ToolCall 状态以完成闭环验证。

### 5. UI 定位规范
*   **CSS Modules 适配**：禁止使用固定的 class 名，应使用属性选择器或包含匹配（如 `[class*="_assistant"]`），以适配生产混淆环境。

---
*遵循此方法论可确保 IfAI 商业版核心功能在私有库更新后依然保持 P0 级可用性。*
