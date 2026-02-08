import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup-utils';

test.describe('Dual-Mode Logic & Persistence Deep Validation', () => {
  test('Atomic Chain: Store -> Window -> LocalStorage -> Window', async ({ page }) => {
    await page.addInitScript(() => { (window as any).__E2E__ = true; });
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    
    // 1. 等待核心加载
    await page.waitForFunction(() => (window as any).__DEBUG__?.layoutStore !== undefined, { timeout: 45000 });

    // 2. [ACTION] 直接通过代码驱动模式切换 (证明 setEditorMode 包含物理同步)
    console.log('[E2E] Driving logic via Store...');
    await page.evaluate(() => {
      const dbg = (window as any).__DEBUG__;
      dbg.layoutStore.getState().setEditorMode('spec');
    });

    // 3. [VERIFY] 验证物理同步是否由于 setter 触发
    const mode = await page.evaluate(() => (window as any).__IFAI_EDITOR_MODE__);
    console.log('[E2E] Mode after store action:', mode);
    expect(mode).toBe('spec');

    // 4. [ACTION] 刷新页面验证持久化自愈
    console.log('[E2E] Reloading to verify auto-sync...');
    await page.reload();
    await page.waitForFunction(() => (window as any).__DEBUG__?.layoutStore !== undefined, { timeout: 30000 });

    // 5. [VERIFY] 终极断言：重启后 window 标志位是否由 onRehydrateStorage 补齐
    const modeAfterReload = await page.evaluate(() => (window as any).__IFAI_EDITOR_MODE__);
    console.log('[E2E] Mode after reload:', modeAfterReload);
    expect(modeAfterReload).toBe('spec');

    console.log('🎉 ATOMIC LOGIC CHAIN GREEN.');
  });
});