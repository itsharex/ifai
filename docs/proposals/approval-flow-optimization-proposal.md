# IfAI 审批流程优化提案

## 📋 概述

本提案针对 IfAI 项目中的工具调用审批流程进行全面审视，分析当前系统的处理逻辑、识别潜在问题和优化机会，并提出改进方案。

## 🎯 业务场景

### 典型审批场景
1. **首次工具调用**：用户首次使用 AI 时，需要审批所有工具调用
2. **会话信任**：首次批准后，同一会话内后续调用自动批准
3. **批量审批**：一次性批准多个工具调用
4. **拒绝处理**：用户拒绝某个工具调用后的流程处理
5. **超时处理**：长时间未响应的超时机制

### 用户期望
- 清晰的审批界面，易于理解工具调用意图
- 合理的信任机制，减少重复审批
- 安全的默认行为，防止意外操作
- 便捷的批量操作

## 🔍 现有流程分析

### 1. 审批流程路径图

```
┌─────────────────────────────────────────────────────────────────┐
│                    工具调用审批完整流程                            │
└─────────────────────────────────────────────────────────────────┘

1. LLM 生成工具调用
   ↓
2. runner.rs 发送 tool_call 事件到前端
   ↓
3. agentStore.ts 接收事件，更新消息的 toolCalls
   ↓
4. 前端检查自动审批条件：
   ├── editor mode (spec/vibe) → 自动批准
   ├── agentAutoApprove=true → 自动批准
   ├── userMessage.autoApproveTools=true → 自动批准
   ├── agentApprovalMode='always' → 自动批准
   ├── agentApprovalMode='session-once' + isSessionTrusted → 自动批准
   └── 否则显示审批界面
   ↓
5a. 自动批准路径：
   ├── 自动调用 approveToolCall
   ├── 记录会话信任（session-once 模式）
   └── 继续执行
   ↓
5b. 手动审批路径：
   ├── 用户查看 ToolApproval 组件
   ├── 用户点击批准或拒绝
   └── 调用 approveToolCall/rejectToolCall
   ↓
6. useChatStore 处理批准：
   ├── 终端状态保护（不覆盖 completed/failed/rejected）
   ├── ID 重定向（去重器映射）
   ├── Agent 工具：调用 agentStore.approveAction
   ├── 文件工具：直接执行
   └── Bash 工具：调用 agent_bash
   ↓
7. Agent 审批路径（如果工具属于 Agent）：
   ├── agentStore.approveAction(agentId, approved)
   ├── 调用后端 approve_agent_action 命令
   ├── supervisor.notify_approval(id, approved)
   └── runner.rs 的 wait_for_approval 返回
   ↓
8. 工具执行结果：
   ├── 发送 tool_result 事件
   ├── 更新 toolCall.status 为 completed/failed
   └── 在 ToolApproval 组件中显示结果
```

### 2. 审批模式配置

| 模式 | 说明 | 行为 |
|------|------|------|
| `always` | 完全自动 | 所有工具调用自动批准 |
| `session-once` | 会话信任 | 首次批准后1小时内自动批准 |
| `session-never` | 完全手动 | 每次都要求用户批准 |
| `per-tool` | 逐工具批准 | 兼容模式，不自动批准 |

### 3. 自动审批触发条件（优先级）

```typescript
// useChatStore.ts 第2184-2192行
const shouldAutoApprove =
    // 1. 编辑器模式（最高优先级）
    (window.__IFAI_EDITOR_MODE__ === 'spec' || window.__IFAI_EDITOR_MODE__ === 'vibe') ||
    // 2. 全局自动批准（兼容老版本）
    settings.agentAutoApprove ||
    // 3. 消息级别标志
    userMessageHasAutoApprove ||
    // 4. 审批模式为 always
    (approvalMode === 'always') ||
    // 5. 会话信任模式 + 会话已信任
    (approvalMode === 'session-once' && isSessionTrusted);
```

### 4. 核心代码位置

| 功能 | 文件路径 | 关键代码行 |
|------|----------|-----------|
| 前端审批逻辑 | `src/stores/useChatStore.ts` | 第2830-3886行 |
| Agent审批 | `src/stores/agentStore.ts` | 第1289-1303行 |
| 审批组件 | `src/components/AIChat/ToolApproval.tsx` | 全文件 |
| 批量审批 | `src/components/AIChat/MessageItem.tsx` | 第301-327行 |
| 设置存储 | `src/stores/settingsStore.ts` | 第81-83行 |
| 后端Supervisor | `src-tauri/src/agent_system/supervisor.rs` | 第55-80行 |
| 后端Runner | `src-tauri/src/agent_system/runner.rs`` | 第308-368行 |

## ⚠️ 识别的问题

### 问题1: 审批超时机制缺失

**现状**：
- Supervisor 使用 `oneshot::channel` 等待审批
- 没有超时机制，可能永久阻塞
- 用户关闭窗口后，Agent 无法收到响应

**影响**：
- Agent 任务永久挂起
- 用户需要刷新页面才能恢复

**代码位置**：`supervisor.rs` 第55-68行

```rust
pub async fn wait_for_approval(&self, id: String) -> bool {
    let (tx, rx) = oneshot::channel();
    {
        let mut txs = self.approval_txs.lock().await;
        txs.insert(id.clone(), tx);
    }

    // ❌ 没有超时机制
    let result = rx.await.unwrap_or(false);
    result
}
```

### 问题2: ID重定向的时序问题

**现状**：
- ID 重定向依赖去重器映射
- 映射在 `agentStore.ts` 中异步建立
- 可能存在竞态条件：用户点击批准时映射还未建立

**影响**：
- 点击批准按钮无效
- 控制台错误："Message or ToolCall not found"

**代码位置**：`useChatStore.ts` 第2872-2928行

### 问题3: 会话信任过期提醒缺失

**现状**：
- 会话信任1小时后自动过期
- 没有视觉提醒告知用户
- 用户可能不知道为什么需要重新批准

**影响**：
- 用户体验困惑
- 感觉系统行为不一致

### 问题4: 批量审批的确认机制

**现状**：
- 批量批准直接执行所有工具
- 没有二次确认或预览
- 可能误操作导致多个文件被修改

**影响**：
- 安全风险
- 用户需要逐个撤销

### 问题5: Agent工具调用的状态同步

**现状**：
- Agent 工具调用状态由 AgentStore 管理
- ChatStore 中的 toolCall 状态可能不同步
- 批准后状态更新顺序不明确

**影响**：
- UI 显示不一致
- 可能出现重复审批按钮

## 💡 优化方案

### 方案1: 审批超时机制

**目标**：防止永久阻塞，提供超时恢复

**实现**：

```rust
// supervisor.rs 优化
pub async fn wait_for_approval(&self, id: String) -> bool {
    let (tx, rx) = oneshot::channel();
    {
        let mut txs = self.approval_txs.lock().await;
        txs.insert(id.clone(), tx);
    }

    // 使用 tokio::time::timeout 添加超时
    const APPROVAL_TIMEOUT: Duration = Duration::from_secs(300); // 5分钟

    match tokio::time::timeout(APPROVAL_TIMEOUT, rx).await {
        Ok(Ok(approved)) => approved,
        Ok(Err(_)) => {
            println!("[Supervisor] Approval channel closed for id={}", id);
            false // 默认拒绝
        },
        Err(_) => {
            println!("[Supervisor] Approval timeout for id={}", id);
            // 清理悬挂的通道
            let mut txs = self.approval_txs.lock().await;
            txs.remove(&id);
            false // 超时默认拒绝
        }
    }
}
```

**预期收益**：
- 防止永久挂起
- 自动清理资源

### 方案2: ID重定向时序保护

**目标**：解决竞态条件，确保映射建立

**实现**：

```typescript
// useChatStore.ts 优化
const patchedApproveToolCall = async (
    messageId: string,
    toolCallId: string,
    options?: { skipContinue?: boolean }
) => {
    // ... 现有逻辑 ...

    // 🔥 新增：等待去重映射建立（最多500ms）
    let message = coreUseChatStore.getState().messages.find(m => m.id === messageId);
    let toolCall = message?.toolCalls?.find(tc => tc.id === toolCallId);

    let retries = 0;
    while (!toolCall && retries < 5) {
        await new Promise(resolve => setTimeout(resolve, 100));
        message = coreUseChatStore.getState().messages.find(m => m.id === messageId);
        toolCall = message?.toolCalls?.find(tc => tc.id === toolCallId);
        retries++;
    }

    // ... 后续逻辑 ...
};
```

**预期收益**：
- 消除竞态条件
- 提高审批成功率

### 方案3: 会话信任过期提醒

**目标**：视觉提示用户信任即将过期

**实现**：

```typescript
// ToolApproval.tsx 新增
const [trustExpiringSoon, setTrustExpiringSoon] = useState(false);

useEffect(() => {
    const checkTrustExpiry = () => {
        const settings = useSettingsStore.getState();
        const threadId = useThreadStore.getState().activeThreadId;
        const sessionTrust = settings.trustedSessions?.[threadId];

        if (sessionTrust) {
            const timeLeft = sessionTrust.expiresAt - Date.now();
            const tenMinutes = 10 * 60 * 1000;

            setTrustExpiringSoon(timeLeft < tenMinutes && timeLeft > 0);
        }
    };

    checkTrustExpiry();
    const interval = setInterval(checkTrustExpiry, 60000); // 每分钟检查

    return () => clearInterval(interval);
}, []);

// UI 显示
{trustExpiringSoon && (
    <div className="px-5 py-2 bg-amber-500/10 border-t border-amber-500/20">
        <div className="flex items-center gap-2 text-[10px] text-amber-400">
            <AlertTriangle size={12} />
            <span>会话信任即将过期，后续操作需要重新批准</span>
        </div>
    </div>
)}
```

**预期收益**：
- 用户清晰了解信任状态
- 减少困惑

### 方案4: 批量审批确认对话框

**目标**：防止误操作，提供预览

**实现**：

```typescript
// MessageItem.tsx 优化
const handleApproveAll = () => {
    const store = useChatStore.getState();
    const message = messages.find(m => m.id => m.id === messageId);

    if (!message || !message.toolCalls) return;

    // 显示确认对话框
    const pendingTools = message.toolCalls.filter(
        tc => tc.status === 'pending' && !tc.isPartial
    );

    if (pendingTools.length > 1) {
        // 使用 shadcn/ui Dialog 或类似组件
        setShowApprovalDialog({
            title: '批量批准工具调用',
            message: `即将批准 ${pendingTools.length} 个工具调用：`,
            tools: pendingTools.map(tc => ({
                name: tc.tool,
                args: tc.args
            })),
            onConfirm: () => {
                store.approveAllToolCalls(messageId);
                setShowApprovalDialog(null);
            }
        });
    } else {
        store.approveAllToolCalls(messageId);
    }
};
```

**预期收益**：
- 防止误操作
- 提高安全性

### 方案5: Agent工具状态同步优化

**目标**：确保状态一致性

**实现**：

```typescript
// agentStore.ts 优化
approveAction: async (id: string, approved: boolean) => {
    try {
        // 🔥 新增：发送状态更新事件
        set(state => ({
            runningAgents: state.runningAgents.map(a =>
                a.id === id
                    ? { ...a, pendingApproval: undefined, lastAction: approved ? 'approved' : 'rejected' }
                    : a
            )
        }));

        // 调用后端
        await invoke('approve_agent_action', { id, approved });

        // 🔥 新增：等待Agent状态更新完成
        await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
        // 回滚状态
        set(state => ({
            runningAgents: state.runningAgents.map(a =>
                a.id === id ? { ...a, pendingApproval: { approved: false } } : a
            )
        }));
        throw error;
    }
}
```

**预期收益**：
- 状态同步更可靠
- UI 显示一致

## 📊 问题优先级矩阵

| 问题 | 严重性 | 频率 | 优先级 |
|------|--------|------|--------|
| 审批超时机制缺失 | 高 | 低 | **P1** |
| ID重定向时序问题 | 高 | 中 | **P1** |
| 会话信任过期提醒缺失 | 中 | 高 | P2 |
| 批量审批确认机制 | 中 | 低 | P2 |
| Agent状态同步 | 低 | 中 | P3 |

## 🗺️ 实施路线图

### Phase 1: 关键问题修复（1-2周）
- [ ] 实现审批超时机制
- [ ] 修复ID重定向时序问题
- [ ] 单元测试和E2E验证

### Phase 2: 用户体验改进（1-2周）
- [ ] 会话信任过期提醒
- [ ] 批量审批确认对话框
- [ ] UI/UX优化

### Phase 3: 状态同步优化（1周）
- [ ] Agent状态同步改进
- [ ] 状态一致性测试
- [ ] 文档更新

## 📈 成功指标

1. **可靠性**：审批成功率 >99%
2. **响应性**：审批响应时间 <500ms
3. **安全性**：零误操作导致的文件修改
4. **用户满意度**：用户反馈评分 >4.5/5

## 🧪 测试策略

### 单元测试
- 超时机制测试
- ID重定向测试
- 状态同步测试

### E2E测试
- 各种审批模式测试
- 超时场景测试
- 批量审批测试
- 边界条件测试

### 性能测试
- 并发审批压力测试
- 内存泄漏检测

---

**文档版本**: v1.0
**创建日期**: 2026-02-10
**作者**: IfAI Technical Team
