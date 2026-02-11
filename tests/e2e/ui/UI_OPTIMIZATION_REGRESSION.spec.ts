import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from '../setup-utils';

/**
 * UI Optimization Regression Test Suite (High Fidelity)
 * 
 * 专门用于验证 Phase 1-4 的重构成果，确保工业级细节不丢失。
 * 遵循准则：物理清理、Store 优先、零随机性。
 */
test.describe('UI Optimization & Industrial Refinement Regression @regression', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);

    // 监听错误和日志
    page.on('pageerror', error => {
      console.log(`[Browser Error] ${error.message}`);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[Browser Console Error] ${msg.text()}`);
      }
    });
    
    // 1. 初始化环境 (Mock AI 以保证 UI 测试速度)
    await setupE2ETestEnvironment(page, { useRealAI: false });
    
    // 2. 🏆 基线：物理清理与状态对齐
    await page.addInitScript(() => {
      window.localStorage.setItem('joyride_finished', 'true');
      window.localStorage.setItem('onboarding_completed', 'true');
      window.localStorage.setItem('ifai_onboarding_state', JSON.stringify({
        completed: true, skipped: true, remindCount: 0, lastRemindDate: null
      }));
      // 锁定布局 Store 的初始状态
      const layout = { state: { sidebarWidth: 384, sidebarActiveTab: 'explorer' }, version: 1 };
      window.localStorage.setItem('layout-storage', JSON.stringify(layout));
    });

    await page.goto('/');
    
    // 3. 🏆 基线：等待 Store Ready 并注入必要状态
    await page.waitForFunction(() => (window as any).__chatStore !== undefined, { timeout: 30000 });
    
    // 🔥 等待 UI 挂载
    await page.waitForSelector('[data-testid="chat-panel"]', { timeout: 10000 });

    await page.evaluate(() => {
      // 注入 Mock Provider 确保 Header 渲染控制流
      const settingsStore = (window as any).__settingsStore;
      if (settingsStore) {
        settingsStore.setState({
          currentProviderId: 'mock-provider',
          currentModel: 'gpt-4',
          providers: [{
            id: 'mock-provider',
            name: 'Mock AI',
            enabled: true,
            apiKey: 'sk-123',
            baseUrl: 'http://localhost:11434',
            models: ['gpt-4']
          }]
        });
      }
      // 强制 AI 侧边栏可见
      const layoutStore = (window as any).__layoutStore;
      if (layoutStore) {
        layoutStore.setState({ isAIChatOpen: true, rightSidebarWidth: 384 });
      }
    });

    // 4. 🏆 基线：物理清理 UI 干扰层 (Joyride 永久清理)
    await page.evaluate(() => {
      const cleanup = () => {
        document.querySelectorAll('.react-joyride__overlay, .react-joyride__spotlight, #react-joyride-portal, .joyride-overlay').forEach(el => el.remove());
      };
      cleanup();
      const observer = new MutationObserver(cleanup);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  });

  /**
   * [验证点] 左侧活动栏 (Activity Bar) 胶囊化结构
   */
  test('Activity Bar should maintain floating capsule structure', async ({ page }) => {
    // 增加详细调试
    const debugInfo = await page.evaluate(() => {
        const layout = (window as any).__layoutStore?.getState();
        const settings = (window as any).__settingsStore?.getState();
        return { 
            activeTab: layout?.sidebarActiveTab,
            isPromptManagerOpen: layout?.isPromptManagerOpen,
            currentProvider: settings?.currentProviderId,
            bodyHtml: document.body.innerHTML.substring(0, 1000) // 采样
        };
    });
    console.log('[E2E-Debug] Current State:', debugInfo);

    const activityBar = page.locator('[data-testid="activity-bar-capsule"]');
    await activityBar.waitFor({ state: 'visible', timeout: 10000 });
    const box = await activityBar.boundingBox();
    
    // 断言：x 应为 8px，表明它是悬浮的，而非紧贴左边缘
    expect(box?.x).toBe(8);
    // 断言：宽度应为 48px
    expect(box?.width).toBe(48);
    
    // 2. 验证材质系统 (毛玻璃)
    const blur = await activityBar.evaluate(el => window.getComputedStyle(el).backdropFilter);
    expect(blur).toContain('blur');

    // 3. 验证选中态物理包裹
    const activePill = activityBar.locator('[data-testid="activity-active-pill"]');
    await expect(activePill).toBeVisible();
  });

  /**
   * [验证点] AI 侧边栏 Header 压缩与紧凑度
   */
  test('AI Chat Header should be compact and height-limited', async ({ page }) => {
    const header = page.locator('[data-testid="ai-chat-header"]');
    
    // 断言：总高度应为 68px (32px + 36px)
    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    expect(box?.height).toBeCloseTo(68, 0);
    
    // 验证品牌行 (Brand Line)
    const brandLine = header.locator('[data-testid="ai-brand-line"]');
    await expect(brandLine).toBeVisible();
    const brandBox = await brandLine.boundingBox();
    expect(brandBox?.height).toBeCloseTo(32, 0);
    
    // 验证控制胶囊 (Control Capsule)
    const controlCapsule = header.locator('[data-testid="ai-control-capsule"]');
    await expect(controlCapsule).toBeVisible();
    const controlBox = await controlCapsule.boundingBox();
    expect(controlBox?.height).toBeCloseTo(36, 0);

    // 验证搜索图标 (Search Icon) 应当存在且可点击
    const searchBtn = header.locator('[data-testid="ai-search-toggle"]');
    await expect(searchBtn).toBeVisible();
  });

  /**
   * [验证点] 按需搜索 (On-demand Search) 的 Slide-down 逻辑
   */
  test('Search panel should slide-down via toggle button', async ({ page }) => {
    const header = page.locator('[data-testid="ai-chat-header"]');
    const searchBtn = header.locator('[data-testid="ai-search-toggle"]');
    const searchPanel = page.locator('[data-testid="ai-search-panel"]');

    // 1. 验证初始状态：面板应隐藏或高度为 0
    // 注意：由于 AnimatePresence，它可能不在 DOM 中，或者 height 为 0
    const isVisibleInitial = await searchPanel.isVisible();
    if (isVisibleInitial) {
        const box = await searchPanel.boundingBox();
        expect(box?.height).toBe(0);
    }

    // 2. 点击切换按钮
    await searchBtn.click();
    
    // 3. 验证面板滑入并稳定 (使用 waitForFunction 消除动画竞态)
    await page.waitForFunction((panelSelector) => {
        const el = document.querySelector(panelSelector) as HTMLElement;
        if (!el) return false;
        const height = el.getBoundingClientRect().height;
        return height > 30; // 等待高度展开
    }, '[data-testid="ai-search-panel"]', { timeout: 5000 });

    const headerBox = await header.boundingBox();
    const box = await searchPanel.boundingBox();
    
    expect(box?.height).toBeGreaterThan(30);
    // 动态断言：搜索面板的 y 坐标应等于 Header 的 y + height
    if (headerBox && box) {
        expect(box.y).toBeCloseTo(headerBox.y + headerBox.height, 0);
    }

    // 4. 再次点击隐藏
    await searchBtn.click();
    await expect(searchPanel).not.toBeVisible();
  });

  /**
   * [验证点] 选中态物理包裹 (Active Pill Motion)
   */
  test('Tab active indicator should move physically', async ({ page }) => {
    // 确保 AI 侧边栏已展开 (通过 beforeEach 中的注入)
    const chatBtn = page.locator('[data-testid="view-mode-chat"]');
    const timelineBtn = page.locator('[data-testid="view-mode-timeline"]');
    
    // 1. 获取初始位置 (对话)
    await chatBtn.click();
    const pill = page.locator('[data-testid="tab-active-pill"]');
    await expect(pill).toBeVisible();
    const box1 = await pill.boundingBox();
    
    // 2. 切换到时间线
    await timelineBtn.click();
    
    // 3. 验证位置已发生物理偏移 (使用 waitForFunction 等待动画稳定)
    await page.waitForFunction((initialX) => {
        const el = document.querySelector('[data-testid="tab-active-pill"]') as HTMLElement;
        if (!el) return false;
        return Math.abs(el.getBoundingClientRect().x - initialX) > 10;
    }, box1?.x || 0, { timeout: 5000 });

    const box2 = await pill.boundingBox();
    expect(box2?.x).not.toBeCloseTo(box1?.x || 0, 1);
  });

  /**
   * [验证点] 持久化与重启自愈
   */
  test('UI density settings should persist after reload', async ({ page }) => {
    // 1. 物理更改为紧凑模式
    await page.evaluate(() => (window as any).__layoutStore?.getState().setDensity('compact'));
    
    // 2. 重启
    await page.reload();
    
    // 3. 验证 Store 恢复
    await page.waitForFunction(() => (window as any).__layoutStore?.getState().density === 'compact');
    
    // 4. 验证物理 Header 依然紧凑
    const header = page.locator('[data-testid="ai-chat-header"]');
    const box = await header.boundingBox();
    expect(box?.height).toBeLessThanOrEqual(68);
  });
});
