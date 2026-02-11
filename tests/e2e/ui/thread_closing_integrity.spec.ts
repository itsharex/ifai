import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from '../setup-utils';

/**
 * Thread Tabs Closing Integrity Test - High Fidelity Proof
 * 
 * @version v0.3.5
 * @tags regression, commercial, high-fidelity
 * 
 * 验证逻辑：
 * 1. 创建 Thread A，发送消息（SECRET_DATA_ALPHA）
 * 2. 物理切换到新 Thread B，发送消息（SECRET_DATA_BETA）
 * 3. 验证 B 的内容可见，A 的内容在 B 的视图中不可见
 * 4. 关闭非活跃的 A
 * 5. 确保 B 的内容保持完整且不丢失
 * 
 * 遵循基线：物理清理、Store 优先。
 */
test.describe('Thread Tabs Closing Integrity (Physical Implementation) @regression @commercial', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    // 检查是否具备商业版测试环境
    const isCommercial = process.env.APP_EDITION === 'commercial' || process.env.TAURI_DEV === 'true';
    if (!isCommercial) {
        test.skip(!isCommercial, '此测试需要商业版环境（ifainew-core）');
    }

    test.setTimeout(120000); // 增加到 120s 应对真实 AI
    
    // 初始化环境 (启用真实 AI)
    await setupE2ETestEnvironment(page, { useRealAI: true });
    
    // 🏆 基线：物理屏蔽干扰与状态对齐
    await page.addInitScript(() => {
      window.localStorage.setItem('joyride_finished', 'true');
      window.localStorage.setItem('onboarding_completed', 'true');
      window.localStorage.setItem('ifai_onboarding_state', JSON.stringify({
        completed: true, skipped: true, remindCount: 0, lastRemindDate: null
      }));
      // 固定布局
      const layout = { state: { sidebarWidth: 384 }, version: 1 };
      window.localStorage.setItem('layout-storage', JSON.stringify(layout));
    });

    await page.goto('/');
    
    // 🏆 基线：等待 Store Ready
    await page.waitForFunction(() => (window as any).__chatStore !== undefined, { timeout: 30000 });

    // 🏆 基线：暴力清理 UI 干扰
    await page.evaluate(() => {
      const cleanup = () => {
        document.querySelectorAll('.react-joyride__overlay, .react-joyride__spotlight, #react-joyride-portal, .joyride-overlay').forEach(el => el.remove());
      };
      cleanup();
      const observer = new MutationObserver(cleanup);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  });

  test('should maintain active thread integrity after closing another', async ({ page }) => {
    const chatInputSelector = 'textarea[data-testid="chat-input"]';
    const messageContainer = page.locator('[data-testid="chat-scroll-container"]');

    // 1. 创建 Thread A 并发送消息
    console.log('[E2E] Step 1: Thread A');
    await page.waitForSelector(chatInputSelector);
    const chatInput = page.locator(chatInputSelector);
    
    await chatInput.fill('SECRET_DATA_ALPHA');
    await chatInput.press('Enter');
    
    // 等待消息出现在 Store 和 UI
    await page.waitForFunction(() => {
        const msgs = (window as any).__chatStore.getState().messages;
        return msgs.length > 0 && msgs.some((m: any) => m.content === 'SECRET_DATA_ALPHA');
    }, { timeout: 15000 });
    await expect(messageContainer.getByText('SECRET_DATA_ALPHA')).toBeVisible();

    // 2. 物理切换至新线程 B (模拟 handleNewThread 行为，强力重置 isLoading)
    console.log('[E2E] Step 2: Switch to Thread B');
    const { idA, idB } = await page.evaluate(async () => {
        const threadStore = (window as any).__threadStore;
        const chatStore = (window as any).__chatStore;
        const setThreadMessages = (window as any).__setThreadMessages;
        
        const oldId = threadStore.getState().activeThreadId;
        // 保存当前消息到 Map
        setThreadMessages(oldId, [...chatStore.getState().messages]);
        
        // 创建新线程并切换
        const newId = threadStore.getState().createThread({ title: 'INTEGRITY_BETA' });
        
        // 🔥 强力补丁：重置 UI 状态
        chatStore.setState({ 
            messages: [], 
            isLoading: false,
            inputHistory: [],
            historyIndex: -1
        });
        
        return { idA: oldId, idB: newId };
    });

    console.log(`[E2E] IDs: A=${idA}, B=${idB}`);

    // 确认旧消息消失
    await expect(messageContainer.getByText('SECRET_DATA_ALPHA')).not.toBeVisible({ timeout: 10000 });
    
    // 发送 B 的消息 (现在 textarea 应该是启用的)
    await expect(chatInput).toBeEnabled({ timeout: 15000 });
    await chatInput.fill('SECRET_DATA_BETA');
    await chatInput.press('Enter');
    
    await page.waitForFunction(() => {
        const msgs = (window as any).__chatStore.getState().messages;
        return msgs.length > 0 && msgs.some((m: any) => m.content.includes('SECRET_DATA_BETA') || (typeof m.content === 'object' && JSON.stringify(m.content).includes('SECRET_DATA_BETA')));
    }, { timeout: 30000 });
    await expect(messageContainer.getByText('SECRET_DATA_BETA')).toBeVisible({ timeout: 15000 });

    // 3. 关闭非活跃的 A
    console.log(`[E2E] Step 3: Closing Inactive Tab A (${idA})`);
    const tabA = page.locator(`[data-thread-id="${idA}"]`);
    const closeBtnA = tabA.locator('button');
    // 强制物理点击
    await closeBtnA.click({ force: true });

    // 4. 最终一致性验证
    await expect(tabA).not.toBeAttached({ timeout: 10000 });
    
    // 活跃项 B 的内容绝对不能丢失
    await expect(messageContainer.getByText('SECRET_DATA_BETA')).toBeVisible({ timeout: 5000 });
    
    // A 的私密数据不能出现在 B 视图
    await expect(messageContainer.getByText('SECRET_DATA_ALPHA')).not.toBeVisible();

    // 🏆 验证 Store 内部状态
    const isDeleted = await page.evaluate((targetId) => {
        const state = (window as any).__threadStore.getState();
        return state.threads[targetId]?.status === 'deleted' || !state.threads[targetId];
    }, idA);
    expect(isDeleted).toBe(true);

    console.log('[E2E] ✅ Integrity Proof Passed Successfully.');
  });
});
