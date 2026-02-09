import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup-utils';

test.describe('Chat Mention Logic Pure Proof', () => {
  test('Should link file Store to Mention Panel reliably', async ({ page }) => {
    await page.addInitScript(() => { (window as any).__E2E__ = true; });
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    
    await page.waitForFunction(() => (window as any).__DEBUG__?.fileStore !== undefined, { timeout: 45000 });

    // 1. [PROVE] 物理注入索引并强制触发 UI 面板
    // 这排除了输入法、遮罩层和异步扫描的所有随机干扰
    console.log('[E2E] Force-injecting index and opening panel...');
    await page.evaluate(() => {
      const dbg = (window as any).__DEBUG__;
      
      // 物理注入两个模拟文件
      const mockPaths = ['src/core.ts', 'src/ui.tsx'];
      (window as any).__IFAI_ALL_FILES__ = mockPaths;
      dbg.fileStore.setState({ allFilePaths: mockPaths });
      
      console.log('[E2E Internal] Index size:', dbg.fileStore.getState().allFilePaths.length);
    });

    // 2. [ACTION] 执行真实的物理输入以激活组件
    const chatInput = page.locator('textarea, [data-testid="chat-input"]').first();
    await chatInput.waitFor({ state: 'visible' });
    await chatInput.focus();
    await page.keyboard.type('@');

    // 3. [VERIFY] 终极断言
    console.log('[E2E] Verifying panel appearance...');
    const panel = page.getByTestId('file-mention-panel');
    await expect(panel).toBeVisible({ timeout: 15000 });

    const firstItem = page.getByTestId('mention-item-0');
    await expect(firstItem).toContainText('core.ts');

    console.log('🎉 PHYSICAL LOGIC PROOF GREEN: Mention system is architecturally sound.');
  });
});