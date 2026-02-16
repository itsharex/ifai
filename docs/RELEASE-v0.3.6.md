# IfAI v0.3.6 发布说明 - 推理模型深度适配与 NVIDIA NIM 极速集成

**发布日期**：2026-02-15
**版本号**：v0.3.6 (Stable)

IfAI v0.3.6 是一个专注于**模型生态扩展**与**推理体验对齐**的关键版本。我们深入优化了对 NVIDIA NIM 平台及 GLM-5 新一代推理模型的支持，解决了在复杂工业级网关下的连接稳定性与参数兼容性问题。

## 🌟 核心新特性

### 1. NVIDIA GLM-5 深度适配 (Reasoning Optimized)
针对 `z-ai/glm5` 等推理模型在云端平台（如 NVIDIA NIM）的特殊要求，v0.3.6 实现了全链路对齐：
- **专项路由**：后端增加特定路由逻辑，绕过通用 API 限制，支持 GLM5 独有的思维链输出格式。
- **思维链注入**：自动注入 `chat_template_kwargs: { enable_thinking: true }`，确保推理过程可见且不被截断。
- **协议对齐**：针对推理模型严禁携带采样参数（temperature/top_p）的特性，系统会自动识别模型意图并净化请求体。

### 2. NVIDIA NIM 预设模板
在“自定义提供商”设置中，新增了官方 NVIDIA NIM 预设。用户只需点击添加，系统将自动填充：
- **端点地址**：`https://integrate.api.nvidia.com/v1/chat/completions`
- **默认模型**：`z-ai/glm5`, `z-ai/glm4.7`, `gpt-4o-mini`, `claude-3-5-sonnet-20241022` 等。

### 3. Token 计数引擎扩展 (GLM-5 128K)
为了确保长文本 RAG 的精准性，Token 计数器现在支持：
- 识别 `glm-5` 及其各种服务商变体（如 `z-ai/glm5`）。
- 统一对齐 128,000 Token 的上下文限制。
- 增加了模糊匹配算法，能够从不同命名的端点中提取核心模型代号。

## 🛠 稳定性与修复

- **SSE 流程闭环**：优化了 Server-Sent Events (SSE) 的解析逻辑，增加了对 `[DONE]` 信号的优雅过滤，彻底消除了日志中的解析异常。
- **消息合并策略**：解决了推理模型不支持 `system` 角色的通病，自动将系统指令与首条用户消息合并，保证了复杂任务下的指令遵循。
- **连接兼容性**：移除了某些环境下可能导致握手失败的 HTTP/1.1 强制限制（针对 glm4.7），同时为 GLM5 保留了高兼容性的 Header 模拟。

## 📦 如何升级

1. 启动 IfAI，系统将自动检测更新并提示。
2. 或手动从 [GitHub Releases](https://github.com/ifai-editor/ifai/releases/tag/v0.3.6) 下载最新安装包。

---
*IfAI 团队 - 2026.02.15*
