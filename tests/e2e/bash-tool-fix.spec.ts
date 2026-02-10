/**
 * 高保真 Bug 还原：用户输入命令后工具执行错误
 * 场景：AI 返回工具名为 'bash'，命令参数为 'ls -la'
 */

import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup';

test.describe('Bash 执行 Bug 高保真还原', () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__chatStore !== undefined, { timeout: 45000 });
  });

  test('还原：工具名为 bash 时应执行参数中的命令而非工具名', async ({ page }) => {
    const messageId = await page.evaluate(() => {
      const chatStore = (window as any).__chatStore;
      const assistantId = crypto.randomUUID();
      const toolCallId = 'call_test_123';

      // 模拟日志中的状态：工具名是 'bash'
      chatStore.getState().addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        toolCalls: [{
          id: toolCallId,
          type: 'function',
          tool: 'bash', 
          args: { command: 'ls -la' },
          function: { name: 'bash', arguments: '{"command":"ls -la"}' },
          status: 'pending',
          isPartial: false
        }]
      });
      return assistantId;
    });

    // 触发审批（这会调用 patchedApproveToolCall）
    await page.evaluate((msgId) => {
      const chatStore = (window as any).__chatStore;
      const tc = chatStore.getState().messages.find(m => m.id === msgId).toolCalls[0];
      chatStore.getState().approveToolCall(msgId, tc.id);
    }, messageId);

    // 等待执行并获取结果
    await page.waitForTimeout(1000);

    const result = await page.evaluate((msgId) => {
      const chatStore = (window as any).__chatStore;
      const msg = chatStore.getState().messages.find(m => m.id === msgId);
      return msg.toolCalls[0].result;
    }, messageId);

    console.log('Test Execution Result:', result);

    // 核心断言：结果不应包含 "Command agent_bash not found"
    // 如果 Bug 存在，result 会包含该错误信息
    expect(result).not.toContain('Command agent_bash not found');
  });
});