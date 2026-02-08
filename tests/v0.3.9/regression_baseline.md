# E2E 回归测试基线 (v0.3.9)

日期: 2026-02-08
状态: ✅ 128 Passed, 0 Failed, 6 Skipped

## 核心修复验证

### 1. 批准按钮可见性
- **问题**: 在流式传输状态下，Agent 触发的工具调用由于未在 `contentSegments` 中记录而被隐藏。
- **修复**: 在 `MessageItem.tsx` 的排序渲染块中添加了对未追踪工具调用的兜底渲染。
- **验证**: `tests/e2e/regression/agent-tool-approval-repro.spec.ts` 及其相关测试全部通过。

### 2. Bash 命令输出样式
- **问题**: Bash 工具结果在 `useChatStore.ts` 中被存储为 JSON 字符串，导致 `ToolApproval.tsx` 渲染异常或显示为 `(no output)`。
- **修复**: 统一了 Bash 结果的对象存储格式，并在 `ToolApproval.tsx` 中添加了智能 JSON 解析逻辑。
- **验证**: `tests/e2e/regression/command-execution.spec.ts` 全部通过。

### 3. 稳定性与崩溃修复
- **问题**: 存在多处 `<span>` 嵌套错误及对 `undefined` 对象的 `.length` 访问风险。
- **修复**: 加固了 `MessageItem.tsx` 和 `TaskSummary.tsx` 中的类型检查和渲染逻辑。
- **验证**: 控制台无 React 渲染错误，`toolapproval-display.spec.ts` 通过。

### 4. E2E Mock 环境增强
- **问题**: `launch_agent` 模拟逻辑在开启真实 AI 模式时会提前返回，导致流式事件丢失。
- **修复**: 修正了 `setup-utils.ts`，确保 Mock 环境下始终能发送模拟事件；补全了 `agent_bash` 指令的模拟。
- **验证**: `tests/e2e/regression/agent-streaming-verification.spec.ts` 通过。

## 测试运行摘要
- 总测试数: 134
- 通过: 128
- 跳过: 6 (通常为环境特定测试)
- 失败: 0
