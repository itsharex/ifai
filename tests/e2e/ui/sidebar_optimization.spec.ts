
import { test, expect } from '@playwright/test';

test.describe('AI Sidebar Optimization Regression', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    
    // 注入 LocalStorage 跳过引导并 Mock 必要的环境
    await page.addInitScript(() => {
      window.localStorage.setItem('joyride_finished', 'true');
      window.localStorage.setItem('onboarding_completed', 'true');
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="chat-panel"]', { timeout: 30000 });
  });

  test('header dual-line and search toggle regression', async ({ page }) => {
    // 验证 Header 依然工作
    const brandLine = page.locator('[data-testid="sidebar-header-brand"]');
    await expect(brandLine).toBeVisible();

    const searchIcon = page.locator('[data-testid="toggle-search-button"]');
    const searchBar = page.locator('[data-testid="thread-search-bar"]');
    
    await searchIcon.click({ force: true });
    await expect(searchBar).toBeVisible();
    await searchIcon.click({ force: true });
    await expect(searchBar).not.toBeVisible();
  });

  test('thread tabs navigation regression (Fluid Pills)', async ({ page }) => {
    // 1. 验证 Tab 容器存在
    const tabs = page.locator('[data-thread-id]');
    const initialCount = await tabs.count();
    
    // 如果没有 Thread，先创建一个 (模拟点击新对话按钮)
    if (initialCount === 0) {
      const newThreadBtn = page.locator('button[title*="新建对话"]');
      await newThreadBtn.click({ force: true });
    }

    // 2. 验证第一个 Tab 是否可见并被选中 (胶囊样式)
    const firstTab = page.locator('[data-thread-id]').first();
    await expect(firstTab).toBeVisible();
    
    // 3. 点击 Tab 切换逻辑回归测试
    // 即使只有一个 Tab，点击它也不应报错
    await firstTab.click({ force: true });
    
    // 4. 验证意图图标是否存在
    const icon = firstTab.locator('span').first();
    await expect(icon).toBeVisible();
    const iconText = await icon.innerText();
    expect(['💬', '🐛', '✨', '🛠️', '🧪', '📌']).toContain(iconText);
  });
});
