
import { test, expect } from '@playwright/test';

test.describe('Chat Input Image Redundancy Check', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
      window.localStorage.setItem('joyride_finished', 'true');
      window.localStorage.setItem('onboarding_completed', 'true');
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="chat-input-area"]');
  });

  test('should only show one preview for each uploaded image', async ({ page }) => {
    // 1. 模拟上传一张图片
    await page.evaluate(() => {
      const dropZone = document.querySelector('[data-testid="chat-input-area"]');
      const dt = new DataTransfer();
      const file = new File([''], 'redundant-test.png', { type: 'image/png' });
      dt.items.add(file);
      dropZone?.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      dropZone?.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });

    // 2. 检查是否有多个图片渲染出来
    // 我们统计页面上所有的 img 标签（在输入框区域内的）
    const imageCount = await page.locator('[data-testid="chat-input-area"] img').count();
    
    // 如果存在冗余，这个值会 > 1
    // 我们期望只有 1 个（位于新的预览流中）
    expect(imageCount).toBe(1);
  });
});
