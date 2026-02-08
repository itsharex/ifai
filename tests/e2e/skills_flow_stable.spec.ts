import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup-utils';

test.describe('Skills Logic-Level Content Validation', () => {
  test('Verify Japanese content enters the Store when skill is active', async ({ page }) => {
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    
    await page.waitForFunction(() => (window as any).__DEBUG__ !== undefined, { timeout: 30000 });

    // 1. 注入模拟后端逻辑
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI__.core.invoke;
      (window as any).__TAURI__.core.invoke = async (cmd: string, args: any) => {
        if (cmd === 'ai_chat') {
          const { eventId, activeSkillIds } = args;
          const hasJpSkill = activeSkillIds && activeSkillIds.includes('japanese-translator');
          
          // ⚠️ 关键：根据技能 ID 决定回复语言
          const jpResponse = "こんにちは、テスト成功です！";
          const cnResponse = "你好，我是中文助手。";
          const text = hasJpSkill ? jpResponse : cnResponse;

          const emit = (window as any).__TAURI__.event.emit;
          // 模拟流式推送
          await emit(eventId, { type: 'content', content: text });
          setTimeout(() => emit(`${eventId}_finish`, "DONE"), 200);
          return Promise.resolve();
        }
        if (cmd === 'local_model_preprocess') return { should_use_local: false };
        return originalInvoke(cmd, args);
      };

      // 配置 Provider
      const settings = (window as any).__DEBUG__.settingsStore.getState();
      settings.updateSettings({
        providers: [{ id: 'e2e', name: 'E2E', protocol: 'openai', enabled: true, models: ['m'] }],
        currentProviderId: 'e2e',
        currentModel: 'm'
      });
    });

    // 2. 物理激活技能并发送消息
    await page.evaluate(async () => {
      (window as any).__IFAI_ACTIVE_SKILLS__ = ['japanese-translator'];
      const chat = (window as any).__DEBUG__.chatStore.getState();
      await chat.sendMessage('Hello', 'e2e', 'm');
    });

    // 3. 核心验证：等待 Store 更新并断言日文内容
    console.log('[E2E] Waiting for Store to receive Japanese content...');
    
    const content = await page.evaluate(async () => {
      const chat = (window as any).__DEBUG__.chatStore;
      // 轮询直到收到内容
      for (let i = 0; i < 50; i++) {
        const msgs = chat.getState().messages;
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'assistant' && last.content) {
          return last.content;
        }
        await new Promise(r => setTimeout(r, 200));
      }
      return "TIMEOUT";
    });

    console.log('[E2E Result] Store content:', content);

    // 终极断言：内容必须包含日文
    const jpRegex = /[\u3040-\u30ff\u31f0-\u31ff]/;
    expect(content).toMatch(jpRegex);
    expect(content).toContain('こんにちは');

    console.log('🎉 LOGIC-LEVEL E2E GREEN: Japanese successfully reached the Store.');
  });
});
