import { test, expect } from '@playwright/test';

test.describe('AI Sidebar Optimization (Phase 1)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    
    // 注入 LocalStorage 跳过引导
    await page.addInitScript(() => {
      window.localStorage.setItem('joyride_finished', 'true');
      window.localStorage.setItem('onboarding_completed', 'true');
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="chat-panel"]', { timeout: 30000 });
  });

  test('header should have dual-line structure with Brand info', async ({ page }) => {
    const brandLine = page.locator('[data-testid="sidebar-header-brand"]');
    await expect(brandLine).toBeVisible();
    await expect(brandLine).toContainText('IfAI Editor');
  });

  test('search bar should be toggleable via header button', async ({ page }) => {
    const searchIcon = page.locator('[data-testid="toggle-search-button"]');
    await expect(searchIcon).toBeVisible();

    const searchBar = page.locator('[data-testid="thread-search-bar"]');
    
    // 1. 切换显示 (使用 force: true 绕过 Joyride 遮罩)
    await searchIcon.click({ force: true });
    await expect(searchBar).toBeVisible();

    // 2. 再次切换隐藏
    await searchIcon.click({ force: true });
    await expect(searchBar).not.toBeVisible();
  });
});