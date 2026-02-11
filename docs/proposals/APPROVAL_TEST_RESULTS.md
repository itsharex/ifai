# 审批流程E2E测试结果报告

## 测试执行摘要

**执行时间**: 2026-02-10
**测试文件**: `tests/e2e/approval-flow-optimization.spec.ts`
**总测试数**: 8
**通过**: 2
**失败**: 6
**执行时长**: ~1.2分钟

---

## 测试结果详情

### ✅ 通过的测试 (2/8)

#### 场景6: ID重定向机制验证
- **状态**: ✅ PASSED
- **验证点**: 去重器正确建立ID映射
- **结果**: 去重器功能正常工作

#### 场景7: 终端状态保护验证
- **状态**: ✅ PASSED
- **验证点**: 已完成的工具调用不能被重复审批
- **结果**: 终端状态保护机制生效

---

### ❌ 失败的测试 (6/8)

#### 场景1: 手动审批单个工具调用
- **状态**: ❌ FAILED
- **失败原因**: `expect(approvalState.hasToolCall).toBe(true)` → received `false`
- **根本原因**: DeepSeek API未返回预期的工具调用格式
- **分析**: LLM可能以文本形式响应，而非生成tool_calls

#### 场景2: 会话信任机制验证
- **状态**: ❌ FAILED
- **失败原因**: `expect(trustAfterApproval.hasTrust).toBe(true)` → received `false`
- **根本原因**: 依赖工具调用触发，但工具调用未生成

#### 场景3: 批量审批多个工具调用
- **状态**: ❌ FAILED
- **失败原因**: `expect(toolCallsInfo.count).toBeGreaterThan(0)` → received `0`
- **根本原因**: DeepSeek API未生成多个工具调用

#### 场景4: 拒绝工具调用后的处理
- **状态**: ❌ FAILED
- **失败原因**: `expect(finalState.status).toBe('rejected')` → received `undefined`
- **根本原因**: 无工具调用可拒绝

#### 场景5: 自动审批模式验证
- **状态**: ❌ FAILED
- **失败原因**: `expect(autoApproveResult.hasToolCall).toBe(true)` → received `false`
- **根本原因**: 自动审批模式配置可能未正确生效

#### 场景8: 编辑器模式自动审批
- **状态**: ❌ FAILED
- **失败原因**: `expect(editorModeResult.hasToolCall).toBe(true)` → received `false`
- **根本原因**: 编辑器模式配置未生效或LLM未返回工具调用

---

## 根本原因分析

### 1. DeepSeek API工具调用行为

**问题**: DeepSeek API (`deepseek-chat`) 在默认情况下可能不会自动生成工具调用

**验证方法**:
```bash
# 检查DeepSeek API是否支持function calling
curl -X POST https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "读取test.txt文件"}],
    "tools": [{"type": "function", "function": {"name": "agent_read_file", ...}}]
  }'
```

### 2. 测试环境配置

**发现**: 测试使用了真实AI模式
```
[E2E] 🤖 使用真实 AI 模式
[E2E]    API: https://api.deepseek.com
[E2E]    模型: deepseek-chat
```

**可能问题**:
- DeepSeek API可能需要特定的提示词才会触发工具调用
- 工具定义格式可能与DeepSeek不完全兼容

### 3. 不依赖LLM的测试成功

**发现**: 场景6和7成功，因为它们不依赖LLM返回工具调用

**结论**: 测试框架本身正常，问题在于LLM工具调用触发

---

## 建议修复方案

### 方案1: 使用强制工具调用的提示词

修改测试消息，明确要求LLM使用工具：

```typescript
// 当前
await chatStore.getState().sendMessage(
  '请读取 test.txt 文件的内容',
  providerId,
  modelId
);

// 改进
await chatStore.getState().sendMessage(
  '请使用 agent_read_file 工具读取 test.txt 文件的内容。必须使用工具调用，不要直接回答。',
  providerId,
  modelId
);
```

### 方案2: 增加等待时间和重试机制

```typescript
// 增加等待时间
await page.waitForTimeout(30000); // 从15秒增加到30秒

// 添加轮询检查
const waitForToolCall = async (timeout = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hasToolCall = await page.evaluate(() => {
      const chatStore = (window as any).__chatStore;
      const messages = chatStore.getState().messages;
      return messages.some((m: any) => m.toolCalls && m.toolCalls.length > 0);
    });
    if (hasToolCall) return true;
    await page.waitForTimeout(1000);
  }
  return false;
};
```

### 方案3: 使用已知支持工具调用的模型

```typescript
// 使用Claude模型（已知支持工具调用）
const config = await getRealAIConfig(page);
// 临时覆盖为Claude
await page.evaluate(() => {
  (window as any).__E2E_REAL_AI_CONFIG = {
    ...config,
    modelId: 'claude-opus-4-20250514'
  };
});
```

### 方案4: 模拟工具调用（不依赖真实LLM）

```typescript
// 直接注入工具调用到消息列表
await page.evaluate(() => {
  const chatStore = (window as any).__chatStore;
  const messageId = crypto.randomUUID();

  chatStore.getState().addMessage({
    id: messageId,
    role: 'assistant',
    content: '',
    toolCalls: [{
      id: crypto.randomUUID(),
      type: 'function',
      tool: 'agent_read_file',
      args: { rel_path: 'test.txt' },
      status: 'pending'
    }]
  });
});
```

---

## 优先级建议

### 高优先级 - 修复工具调用触发
- 实施方案1（强制工具调用的提示词）
- 实施方案2（增加等待时间）

### 中优先级 - 改进测试稳定性
- 实施方案4（模拟工具调用用于状态验证测试）

### 低优先级 - 替代模型
- 实施方案3（仅在必要时使用）

---

## 验证通过的功能

### 1. ID重定向机制
- 去重器正常工作
- ID映射正确建立

### 2. 终端状态保护
- 已完成的工具调用不能被重复审批
- 状态保护逻辑生效

### 3. 测试基础设施
- 真实AI模式配置正常
- E2E环境初始化成功
- Store访问机制正常

---

## 下一步行动

1. **立即行动**: 修复提示词，强制LLM使用工具调用
2. **验证**: 重新运行测试验证修复效果
3. **备选**: 如果真实AI仍不稳定，考虑使用模拟工具调用
4. **文档**: 更新测试最佳实践文档

---

**报告生成时间**: 2026-02-10
**测试执行者**: Claude Code
**状态**: 需要修复后重新验证
