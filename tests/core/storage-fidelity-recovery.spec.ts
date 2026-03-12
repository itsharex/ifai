import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from '../e2e/setup/index';
import { AuthoritativeWait } from '../utils/AuthoritativeWait';

/**
 * 🏆 PIVO 3.0: 存储物理恢复一致性测试 (Signal Pipeline Edition)
 * 验证应用重启后数据能否通过物理信号管线 100% 恢复。
 */

test.describe('PIVO 3.0 Storage Recovery Fidelity', () => {
  test.beforeEach(async ({ page }) => {
    // 开启错误捕捉
    page.on('pageerror', err => console.error('[Pivo3-Crash] 🔴 Browser Exception:', err.message));
    
    await setupE2ETestEnvironment(page, { skipWelcome: true });
    await page.goto('/');
    
    // 🏆 PIVO 3.0: 等待应用逻辑层就绪
    await page.waitForFunction(() => (window as any).__APP_READY__ === true, { timeout: 60000 });
  });

  test('@fidelity Should persist and recover Thread History via Physical Signal', async ({ page }) => {
    const uniqueTitle = 'Thread-Recovery-' + Math.random().toString(36).substring(7);
    
    // 1. 模拟生成数据
    await page.evaluate(async (title) => {
        const { useThreadStore } = await import('../../src/stores/threadStore');
        // 创建一个 Thread
        useThreadStore.getState().createThread({ title });
    }, uniqueTitle);

    console.log(`[Pivo3] Thread "${uniqueTitle}" created, awaiting persistence...`);
    await page.waitForTimeout(2000); 

    // 2. 🚀 刷新页面 (模拟重启)
    console.log('[Pivo3] Refreshing page...');
    await page.reload();
    await page.waitForFunction(() => (window as any).__APP_READY__ === true, { timeout: 30000 });

    // 3. 🏆 关键：等待持久化信号管线 (Authoritative Wait)
    console.log(`[Pivo3] Waiting for persistence-hydrated signal...`);
    await AuthoritativeWait.forPersistenceHydrated(page, { timeout: 20000 });

    // 4. 🏆 PIVO 3.0: 物理级状态机验证 - 只要 Store 里有数据，逻辑就是通的
    const recoveredThreads = await page.evaluate(() => {
        const { useThreadStore } = (window as any);
        return useThreadStore?.getState().threads || [];
    });
    
    console.log(`[Pivo3] Recovered thread count from Store: ${recoveredThreads.length}`);
    const foundInStore = recoveredThreads.some((t: any) => t.title === uniqueTitle);
    expect(foundInStore).toBe(true);

    // 5. 辅助性 UI 验证 (物理强制展开)
    await page.evaluate(() => {
        const { useLayoutStore } = (window as any);
        if (useLayoutStore) useLayoutStore.setState({ isSidebarOpen: true });
    });
    
    const threadItem = page.locator(`text=${uniqueTitle}`);
    await expect(threadItem).toBeVisible({ timeout: 10000 });
    
    console.log('[Pivo3] ✅ High-Fidelity Persistence Recovery Verified Successfully!');
  });
});
