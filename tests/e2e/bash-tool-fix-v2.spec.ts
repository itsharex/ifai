/**
 * 高保真 Bug 还原：用户输入命令后工具执行错误 (v2)
 */

import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup';

test.describe('Bash 执行 Bug 最终修复验证', () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__chatStore !== undefined, { timeout: 45000 });
  });

  test('验证 1：拦截非法指令 "agent_bash"', async ({ page }) => {
    const messageId = await page.evaluate(() => {
      const chatStore = (window as any).__chatStore;
      const assistantId = crypto.randomUUID();
      
      chatStore.getState().addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        toolCalls: [{
          id: 'call_bad',
          type: 'function',
          tool: 'bash', 
          args: { command: 'agent_bash' }, // 注入导致问题的非法指令
          status: 'pending',
          isPartial: false
        }]
      });
      return assistantId;
    });

    await page.evaluate((msgId) => {
      (window as any).__chatStore.getState().approveToolCall(msgId, 'call_bad');
    }, messageId);

    await page.waitForTimeout(1000);

    const result = await page.evaluate((msgId) => {
      return (window as any).__chatStore.getState().messages.find(m => m.id === msgId).toolCalls[0].result;
    }, messageId);

    console.log('Bad Command Result:', result);
    // 应该被我们新增的逻辑拦截，报错信息应该是 Invalid command
    expect(result).toContain('Invalid command');
    expect(result).not.toContain('Command agent_bash not found');
  });

  test('验证 2：意图识别正则修复验证', async ({ page }) => {
    const intent = await page.evaluate(() => {
      // 直接使用挂载到 window 的工具函数
      const recognizeIntent = (window as any).recognizeIntent;
      if (typeof recognizeIntent !== 'function') {
        throw new Error('recognizeIntent not found on window');
      }
      return recognizeIntent("帮我运行命令 ls -la");
    });

    console.log('Recognized Intent:', intent);
    expect(intent).not.toBeNull();
    expect(intent.type).toBe('/bash');
    expect(intent.args).toBe('ls -la'); // 应该正确提取出 ls -la
  });
});
