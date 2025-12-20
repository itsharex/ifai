# 优化斜杠命令用户体验

## Why

当前用户使用斜杠命令（如 `/doc`、`/explore`、`/review` 等）启动 agent 时，agent 的所有输出内容都被流式同步到聊天面板和底部 Agent Card，导致两处显示重复内容，用户体验与直接输入文本时的交互流程不一致。这种重复显示使得界面信息冗余，且缺少对 agent "思考内容"和"操作反馈"的清晰区分。

## What Changes

- **分离内容流**：区分 agent 的"思考内容"（思维过程、分析说明）和"操作反馈"（工具调用、文件读写、授权请求）
- **优化 Agent Card 显示**：底部 Agent Card 专注显示 agent 的思考过程、执行状态和进度
- **优化聊天面板显示**：聊天面板显示可交互的操作反馈（如文件读取、写入、工具调用授权等）
- **统一交互体验**：使斜杠命令的执行流程与直接输入文本时的体验保持一致

**影响范围**：
- 不涉及 **BREAKING CHANGE**
- 这是一个用户体验优化，不改变现有 API

## Impact

### Affected specs
- `ai-chat` - AI 聊天交互能力（新增事件类型和消息分流逻辑）

### Affected code
- `src/stores/agentStore.ts` - Agent 事件监听器，需要区分事件类型
- `src/stores/useChatStore.ts` - 消息添加逻辑，需要支持操作反馈消息
- `src/components/AIChat/MessageItem.tsx` - 消息展示组件（可能需要支持新的消息类型）
- `src-tauri/src/commands/agent_commands.rs` - Agent 命令处理（可能需要发送不同类型的事件）

### User Benefits
- 清晰的信息展示：思考和操作分离，减少冗余
- 一致的交互体验：斜杠命令和直接输入体验统一
- 更好的可操作性：聊天面板中的操作反馈可以直接交互

### Technical Risks
- 需要精心设计事件类型，避免遗漏或分类错误
- 需要保持向后兼容，确保现有功能不受影响
