# Technical Design: 斜杠命令 UX 优化

## Context

当前系统中，用户使用斜杠命令（如 `/doc`、`/explore`）启动 agent 时，agent 的所有输出都被流式同步到两个地方：
1. 底部 Agent Card（显示 agent 卡片）
2. 聊天面板中的 assistant 消息

这导致内容重复显示，且缺少对"思考内容"和"操作反馈"的区分。用户希望：
- Agent Card 专注显示思考过程
- 聊天面板显示可交互的操作反馈（工具调用、文件操作等）

## Goals / Non-Goals

### Goals
- 清晰区分 agent 的思考内容和操作反馈
- 优化信息展示，避免冗余
- 统一斜杠命令和直接输入的交互体验
- 保持现有功能不受影响（向后兼容）

### Non-Goals
- 不改变现有的工具调用机制
- 不重构整个 agent 系统架构
- 不影响非斜杠命令的使用场景

## Decisions

### Decision 1: 事件类型分类

**决策**：在 agent 事件 payload 中增加 `eventType` 字段，标记内容类型。

**事件类型定义**：
```typescript
type AgentEventType =
  | 'thinking'     // 思考内容（分析、说明、总结等）
  | 'tool_call'    // 工具调用（读取文件、写入文件、搜索等）
  | 'tool_result'  // 工具调用结果
  | 'result'       // 最终结果
  | 'error';       // 错误信息
```

**Payload 结构**：
```typescript
interface AgentEventPayload {
  type: AgentEventType;
  content?: string;        // 思考内容（用于 thinking 类型）
  toolCall?: {             // 工具调用详情（用于 tool_call 类型）
    id: string;
    tool: string;
    args: any;
    status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  };
  result?: string;         // 最终结果（用于 result 类型）
  error?: string;          // 错误信息（用于 error 类型）
}
```

**理由**：
- 清晰的类型标记便于前端分流处理
- 兼容现有事件结构，只需增加字段
- 便于后续扩展更多事件类型

**备选方案**：
- 方案 A：使用不同的事件名称（如 `agent_thinking`、`agent_tool_call`）
  - 缺点：需要注册多个事件监听器，代码复杂度增加
- 方案 B：在内容中使用特殊标记（如 `[TOOL]`、`[THINKING]`）
  - 缺点：解析复杂，容易出错，不够优雅

### Decision 2: 内容分流策略

**决策**：在 `agentStore.ts` 的事件监听器中根据 `eventType` 进行分流。

**分流逻辑**：
```typescript
// 伪代码示意
listen(`agent_${id}`, (event) => {
  const payload = event.payload;

  switch (payload.type) {
    case 'thinking':
      // 仅更新 Agent Card
      updateAgentCard(id, payload.content);
      break;

    case 'tool_call':
      // 通知 chatStore 添加工具调用消息
      chatStore.addToolCallMessage({
        agentId: id,
        toolCall: payload.toolCall
      });
      break;

    case 'tool_result':
      // 更新聊天面板中的工具调用消息状态
      chatStore.updateToolCallStatus(payload.toolCall.id, payload.result);
      break;

    case 'result':
      // 更新 Agent Card 完成状态，并在聊天面板添加最终消息
      updateAgentCard(id, { status: 'completed' });
      chatStore.addMessage({ role: 'assistant', content: payload.result });
      break;

    case 'error':
      // 显示错误
      updateAgentCard(id, { status: 'failed', error: payload.error });
      chatStore.addMessage({ role: 'assistant', content: `❌ ${payload.error}` });
      break;
  }
});
```

**理由**：
- 集中处理，逻辑清晰
- 便于调试和维护
- 易于扩展新的事件类型

### Decision 3: Agent Card 内容隔离

**决策**：移除 Agent Card 中与聊天面板的同步逻辑（第 58-66 行）。

**当前代码（需要修改）**：
```typescript
// src/stores/agentStore.ts:58-66
// Sync to Main Chat Message
const { updateMessageContent, messages } = coreUseChatStore.getState();
const linkedMsg = messages.find(m => (m as any).agentId === id);
if (linkedMsg) {
    const newContent = (linkedMsg.content || "") + chunk;
    updateMessageContent(linkedMsg.id, newContent);
}
```

**修改后**：
```typescript
// 仅在 eventType === 'thinking' 时更新 Agent Card
if (payload.type === 'thinking') {
    updateAgentCard(id, payload.content);
}

// 不再同步到聊天面板的 assistant 消息
```

**理由**：
- 避免内容重复
- Agent Card 专注于思考内容
- 聊天面板通过 `tool_call` 事件获取操作反馈

### Decision 4: Chat Store 消息处理

**决策**：在 `useChatStore.ts` 中移除创建空 assistant 消息的逻辑（第 64-73 行）。

**当前代码（需要修改）**：
```typescript
// src/stores/useChatStore.ts:64-73
addMessage({
    id: crypto.randomUUID(),
    role: 'assistant',
    content: ``, // Start empty, will be filled by stream
    // @ts-ignore - custom property
    agentId: agentId,
    isAgentLive: true
});
```

**修改后**：
```typescript
// 不再创建空的 assistant 消息
// 工具调用和结果通过 agentStore 的事件分流添加
```

**新增方法**：
```typescript
// 在 chatStore 中新增方法
const addToolCallMessage = (data: { agentId: string; toolCall: ToolCall }) => {
  addMessage({
    id: crypto.randomUUID(),
    role: 'tool',
    content: formatToolCall(data.toolCall),
    toolCalls: [data.toolCall],
    // @ts-ignore
    agentId: data.agentId
  });
};
```

**理由**：
- 避免创建无意义的空消息
- 工具调用消息更具语义性
- 便于后续支持授权交互

## Risks / Trade-offs

### Risk 1: 事件分类不完整
**风险**：可能遗漏某些类型的 agent 输出，导致内容丢失。
**缓解措施**：
- 在后端添加默认分类逻辑（未标记的内容默认为 `thinking`）
- 充分测试各种 agent 类型（`/doc`、`/explore`、`/review` 等）
- 添加日志记录，监控未分类的事件

### Risk 2: 向后兼容性
**风险**：修改事件结构可能影响现有代码。
**缓解措施**：
- 保持事件字段向后兼容（新增字段，不删除旧字段）
- 在前端添加降级处理（如果没有 `eventType`，使用默认行为）
- 逐步迁移，确保每个步骤都可回滚

### Risk 3: UI 复杂度增加
**风险**：新增工具调用消息展示可能增加 UI 复杂度。
**缓解措施**：
- 复用现有的 `MessageItem` 组件，扩展支持工具调用类型
- 保持 UI 设计简洁，避免过度设计
- 参考现有的工具调用授权 UI（如果有）

## Migration Plan

### Phase 1: 后端事件分类（无破坏性）
1. 在 Rust 后端添加事件类型标记逻辑
2. 发送带有 `eventType` 的事件
3. 保持现有事件结构不变（向后兼容）

### Phase 2: 前端分流处理
1. 修改 `agentStore.ts` 的事件监听器，根据类型分流
2. 暂时保留旧的同步逻辑（作为降级方案）
3. 测试验证新流程

### Phase 3: 移除冗余逻辑
1. 移除 Agent Card 的聊天面板同步逻辑
2. 移除空 assistant 消息创建逻辑
3. 清理过时代码和注释

### Phase 4: UI 优化和测试
1. 优化工具调用消息展示
2. 完整测试各种场景
3. 修复发现的 bug

### Rollback Plan
如果发现严重问题，可以：
1. 恢复旧的同步逻辑（保留的降级代码）
2. 回滚后端事件类型标记（发送无类型事件）
3. Git revert 到修改前的提交

## Open Questions

1. **Q**: 是否需要在 Agent Card 中显示工具调用的摘要？
   **A**: 待讨论。建议初期仅显示思考内容，后续可根据用户反馈调整。

2. **Q**: 工具调用授权流程是否需要调整？
   **A**: 当前方案复用现有授权机制，无需调整。

3. **Q**: 是否需要支持用户自定义显示偏好（如"在 Agent Card 中也显示工具调用"）？
   **A**: 不在本次范围内，可作为后续优化。
