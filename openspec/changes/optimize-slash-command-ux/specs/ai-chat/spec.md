# AI Chat - Spec Deltas

## ADDED Requirements

### Requirement: Agent Event Type Classification
系统必须（SHALL）支持区分不同类型的 agent 事件，包括"思考内容"和"操作反馈"，以便在不同的 UI 区域展示。

#### Scenario: Agent 发送思考内容
- **WHEN** agent 执行任务并生成思考过程内容（分析、说明、总结等）
- **THEN** 系统将该内容标记为 `thinking` 类型事件
- **AND** 该内容仅流式更新到底部 Agent Card，不发送到聊天面板

#### Scenario: Agent 执行工具调用
- **WHEN** agent 需要执行工具调用（如读取文件、写入文件、搜索代码等）
- **THEN** 系统将该操作标记为 `tool_call` 类型事件
- **AND** 在聊天面板中添加操作反馈消息，显示工具调用详情和状态
- **AND** 如需用户授权，显示批准/拒绝按钮

#### Scenario: Agent 任务完成
- **WHEN** agent 任务执行完成
- **THEN** 系统发送任务完成事件，包含最终输出和状态
- **AND** 在聊天面板中添加完成消息
- **AND** 底部 Agent Card 显示任务完成状态

### Requirement: Agent Card Content Filtering
底部 Agent Card 必须（SHALL）仅显示 agent 的思考内容和执行状态，不显示工具调用等操作反馈。

#### Scenario: 显示思考内容
- **WHEN** Agent Card 接收到 `thinking` 类型的流式内容
- **THEN** 流式追加到 Agent Card 的内容区域
- **AND** 实时更新显示

#### Scenario: 过滤操作反馈
- **WHEN** Agent Card 接收到 `tool_call` 类型的事件
- **THEN** 不在 Agent Card 中显示该事件内容
- **AND** 该事件应该被路由到聊天面板

### Requirement: Chat Panel Tool Feedback
聊天面板必须（SHALL）显示 agent 的所有工具调用和操作反馈，支持用户交互（授权、查看详情等）。

#### Scenario: 显示文件读取操作
- **WHEN** agent 执行文件读取操作
- **THEN** 在聊天面板添加文件读取操作消息
- **AND** 显示文件路径和读取状态
- **AND** 如需授权，显示批准/拒绝按钮

#### Scenario: 显示文件写入操作
- **WHEN** agent 执行文件写入操作
- **THEN** 在聊天面板添加文件写入操作消息
- **AND** 显示文件路径、写入内容预览和状态
- **AND** 如需授权，显示批准/拒绝按钮

#### Scenario: 显示工具调用结果
- **WHEN** 工具调用完成（成功或失败）
- **THEN** 更新对应消息的状态
- **AND** 显示执行结果或错误信息

## MODIFIED Requirements

### Requirement: Slash Command Agent Launch
用户使用斜杠命令（如 `/doc`、`/explore` 等）启动 agent 时，系统必须（SHALL）提供与直接输入文本一致的交互体验，包括消息分流和内容区分。

#### Scenario: 启动斜杠命令 agent
- **WHEN** 用户输入斜杠命令（如 `/doc 生成文档`）并发送
- **THEN** 系统识别并拦截斜杠命令
- **AND** 启动对应的 agent（如 Doc Agent）
- **AND** 在聊天面板添加用户消息和初始 assistant 消息
- **AND** 在底部显示 Agent Card，展示 agent 名称和状态

#### Scenario: Agent 输出内容分流
- **WHEN** agent 开始输出内容
- **THEN** 根据内容类型进行分流：
  - 思考内容（`thinking`）→ Agent Card
  - 工具调用（`tool_call`）→ 聊天面板
- **AND** 用户可以同时看到 agent 的思考过程（Card）和操作反馈（聊天面板）

#### Scenario: 与直接输入体验一致
- **WHEN** 用户直接输入文本（不使用斜杠命令）触发 AI 响应
- **THEN** AI 的工具调用和操作反馈显示在聊天面板中
- **AND** 与斜杠命令的操作反馈显示方式保持一致
- **AND** 用户感受到统一的交互体验
