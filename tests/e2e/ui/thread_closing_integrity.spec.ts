import { test, expect } from '@playwright/test';

test.describe('Thread Tabs Closing Integrity (Optimized)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
      window.localStorage.setItem('joyride_finished', 'true');
      window.localStorage.setItem('onboarding_completed', 'true');
      
      const mockSettings = {
        state: {
          providers: [{ id: 'zhipu', name: 'Zhipu', enabled: true, apiKey: 'test-key', models: ['glm-4'] }],
          currentProviderId: 'zhipu',
          currentModel: 'glm-4'
        },
        version: 1
      };
      window.localStorage.setItem('ifai-settings-storage', JSON.stringify(mockSettings));
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="chat-panel"]');
  });

  test('active thread content should remain correct after closing another thread', async ({ page }) => {
    // 1. 通过 evaluate 快速创建数据
    await page.evaluate(() => {
      const threadStore = (window as any).__threadStore.getState();
      const switchThread = (window as any).__switchThread;
      const chatStore = (window as any).__chatStore;

      // 创建 A 并设为活跃
      const idA = threadStore.createThread();
      threadStore.updateThread(idA, { title: 'THREAD_A' });
      switchThread(idA);
      chatStore.setState({ messages: [{ id: 'ma', role: 'user', content: 'CONTENT_OF_A' }] });

      // 创建 B 并设为活跃
      const idB = threadStore.createThread();
      threadStore.updateThread(idB, { title: 'THREAD_B' });
      switchThread(idB);
      chatStore.setState({ messages: [{ id: 'mb', role: 'user', content: 'CONTENT_OF_B' }] });
    });

    // 2. 验证当前在 B
    await expect(page.getByText('CONTENT_OF_B')).toBeVisible();

    // 3. 关闭 A (第一个 Tab)
    const tabA = page.locator('[data-thread-id]').filter({ hasText: 'THREAD_A' });
    await tabA.hover();
    await tabA.locator('button').click();

    // 4. 💎 核心断言：B 的内容不应该变
    await expect(page.getByText('CONTENT_OF_B')).toBeVisible();
    await expect(page.getByText('CONTENT_OF_A')).not.toBeVisible();
  });
});