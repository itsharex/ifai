import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from '../setup';

test.describe('Smart Scroll Stability (v0.4.0 UX)', () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    await page.waitForSelector('[data-testid="chat-scroll-container"]', { timeout: 15000 });
  });

  test('should disable auto-scroll when user manually scrolls up during streaming', async ({ page }) => {
    console.log('[Test] Starting scroll stability test');
    
    // 1. 模拟一个非常长的流式输出
    await page.evaluate(() => {
      const chatStore = (window as any).__chatStore;
      const msgId = 'long-scroll-msg';
      chatStore.getState().addMessage({
        id: msgId,
        role: 'assistant',
        content: 'Initial content...'
      });
      
      // 启动一个持续的流
      let count = 0;
      const interval = setInterval(() => {
        count++;
        // 使用 window.__chatStore 模拟核心流式更新
        // 注意：useChatStore 已经被我们 patch 了，所以这里直接模拟 ai_stream 事件
        window.dispatchEvent(new CustomEvent('tauri://event', {
          detail: {
            event: msgId,
            payload: { type: 'content', content: `\nLine ${count}: This is a long response...` }
          }
        }));
        if (count > 100) clearInterval(interval);
      }, 50);
    });

    // 2. 等待内容增长
    await page.waitForTimeout(1000);
    
    // 3. 模拟用户手动向上滚动
    const scrollContainer = page.getByTestId('chat-scroll-container');
    await scrollContainer.evaluate(node => {
      node.scrollTop = 100; // 向上滚一点，而不是 0 (底部很大)
    });
    console.log('[Test] Manually scrolled up');

    // 获取手动滚动后的位置
    const scrollTopAfterManual = await scrollContainer.evaluate(node => node.scrollTop);

    // 4. 等待更多内容到来
    await page.waitForTimeout(2000);

    // 5. 验证：由于用户手动滚动了，此时不应该被拉回到底部
    // 如果自动置底逻辑还在运行，scrollTop 会变得非常大
    const finalScrollTop = await scrollContainer.evaluate(node => node.scrollTop);
    console.log(`[Test] Manual position: ${scrollTopAfterManual}, Final position: ${finalScrollTop}`);
    
    // 我们期望 finalScrollTop 保持在手动滚动的位置附近，而不是飞到底部
    // 如果 finalScrollTop 显著大于手动滚动后的位置（说明发生了自动置底），则测试失败
    expect(finalScrollTop).toBeLessThan(scrollTopAfterManual + 500);
  });
});