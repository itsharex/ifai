# 🏆 IfAI 高保真测试方法论 (PIVO 3.0 Standard)

## 一、 核心准则：物理层意识 (Physical Layer Awareness)

在 PIVO 3.0 体系中，测试不再仅仅是“点击并检查 UI”，而是对**物理链路完整性**的深度验证。

1.  **禁令：弃用随机等待**：严禁使用 `page.waitForTimeout`。物理时间是不可信的，只有状态机的变迁才是权威的。
2.  **准则：权威状态驱动**：必须通过 `AuthoritativeWait` 轮询 Store 状态机或监听物理管线信号（Pipeline Signal）。
3.  **准则：数据直连桥接**：在 Playwright 环境下，优先使用 `__PIVO_BRIDGE__` 进行驱动式数据注入，绕过不稳定的系统级事件总线。

## 二、 目录职责隔离规范 (Structural Methodology)

所有新编写的测试资产必须严格遵循物理隔离原则：

*   **`tests/core/` (金标准区)**：全链路、高保真集成测试。这些测试必须具备“双轨能力”：同时支持 Mock 仿真和 Real AI 验证。
*   **`tests/mocks/` (仿真逻辑区)**：存放如 `SSEStreamSimulator` 等物理模拟逻辑。禁止在测试脚本中 Hardcode 业务 Mock 数据。
*   **`tests/utils/` (SDK 区)**：存放跨框架的通用断言、权威等待工具及物理 IO 仿真器。
*   **`tests/fixtures/` (静态资产区)**：存放测试用的 JSON Snapshot、配置文件及 Mock 代码块。
*   **`tests/legacy/` (缓冲区)**：存放尚未按 PIVO 3.0 规范重构的旧脚本，直至其被迁移或删除。

## 三、 关键技术路径 (Technical Methodology)

### 1. 权威等待 (Authoritative Wait)
*   **Store 轮询**：使用 `AuthoritativeWait.forChatState` 直接监控 Zustand 状态机的内部原子变迁。
*   **信号管线**：使用 `AuthoritativeWait.forPipelineSignal` 监听服务层通过 `CustomEvent` 发出的物理终态信号。

### 2. 环境欺骗 (Environment Spoofing)
*   在非真实的 Tauri 运行时（如 Playwright 独立浏览器）中，必须通过劫持 `window.__TAURI_INTERNALS__` 伪造协议层，防止 React 组件在挂载期因调用原生 API 而崩溃（白屏）。

### 3. 高保真断言 (Fidelity Assertion)
*   **UUID 链路一致性**：断言消息 ID 在物理全链路（API -> Service -> Store -> UI）中不丢失、不篡改。
*   **分片物理顺序**：验证 `contentSegments` 的 `order` 属性呈物理单调递增，防止流式响应乱序拼接。
*   **最终物理一致性**：利用 `FidelityAssert.matchFinalConsistancy` 确保 Store 内存数据与 DOM 渲染文本在物理上完全对齐。

## 四、 标准开发工作流 (Workflow)

1.  **预留桥接**：在目标 Service 初始化时挂载 `__PIVO_BRIDGE__`（参考 `StreamingResponseController`）。
2.  **状态暴露**：在 Store 层通过 `Object.defineProperty` 暴露 `__CHAT_STORE_STATE__`。
3.  **编写测试**：
    *   `beforeEach`: 等待 `__APP_READY__` 逻辑信号。
    *   `Act`: 触发业务动作并捕获物理 ID。
    *   `Simulate`: 通过 Bridge 注入物理分片。
    *   `Wait`: 调用 `AuthoritativeWait.forStreamComplete`。
    *   `Assert`: 执行高保真链路校验。

## 五、 验收清单 (Review Checklist)

- [ ] 是否存在任何显式或隐式的硬编码等待（Timeout）？
- [ ] 状态机是否已通过 `window` 权威挂载？
- [ ] 针对流式响应，是否验证了分片的物理顺序（Order）？
- [ ] 是否在浏览器控制台注入了 `[PIVO-SIGNAL]` 调试信号？
- [ ] 是否能够在 `USE_REAL_LLM=true` 环境下零修改运行？

---
*本方法论是 IfAI PIVO 3.0 架构重构的质量基石，所有后续 PR 必须遵循。*
