# Implementation Tasks

## 1. 类型定义和数据结构

- [ ] 1.1 在 `src/types/agent.ts` 中定义新的事件类型枚举（`thinking`、`tool_call`、`result` 等）
- [ ] 1.2 扩展 Agent 事件 payload 结构，支持类型标记
- [ ] 1.3 定义工具调用消息的数据结构（包含工具名称、参数、状态等）

## 2. 后端事件发送优化

- [ ] 2.1 审查 `src-tauri/src/commands/agent_commands.rs` 中的 agent 执行逻辑
- [ ] 2.2 在 agent 输出时标记内容类型（区分思考内容和工具调用）
- [ ] 2.3 发送带有类型标记的事件到前端
- [ ] 2.4 确保事件 payload 格式符合前端定义

## 3. Agent Store 事件处理

- [ ] 3.1 修改 `src/stores/agentStore.ts` 中的事件监听器
- [ ] 3.2 根据事件类型分流内容：
  - `thinking` 类型 → 仅更新 Agent Card
  - `tool_call` 类型 → 通知 chatStore 添加操作消息
  - `result` 类型 → 更新完成状态
- [ ] 3.3 移除重复的聊天面板同步逻辑（对于 thinking 类型）

## 4. Chat Store 消息处理

- [ ] 4.1 修改 `src/stores/useChatStore.ts` 的 `patchedSendMessage`
- [ ] 4.2 调整斜杠命令拦截逻辑，不再创建空的 assistant 消息
- [ ] 4.3 新增 `addToolCallMessage` 方法，用于添加工具调用操作消息
- [ ] 4.4 确保工具调用消息支持授权交互（批准/拒绝按钮）

## 5. UI 组件更新

- [ ] 5.1 确认 `src/components/AIChat/MessageItem.tsx` 支持工具调用消息展示
- [ ] 5.2 如需要，新增工具调用消息组件（显示工具名称、参数、状态、授权按钮）
- [ ] 5.3 优化 Agent Card 组件，确保仅显示思考内容和状态
- [ ] 5.4 测试 UI 展示效果，确保信息清晰不冗余

## 6. 测试和验证

- [ ] 6.1 测试斜杠命令（`/doc`、`/explore`、`/review` 等）的完整流程
- [ ] 6.2 验证思考内容仅显示在 Agent Card
- [ ] 6.3 验证工具调用仅显示在聊天面板，且支持授权交互
- [ ] 6.4 对比直接输入文本的交互流程，确保体验一致
- [ ] 6.5 测试边界情况（agent 失败、网络错误、用户取消等）

## 7. 文档和代码清理

- [ ] 7.1 更新代码注释，说明事件类型和分流逻辑
- [ ] 7.2 删除过时的同步逻辑代码
- [ ] 7.3 确保没有引入新的 bug 或回归问题
