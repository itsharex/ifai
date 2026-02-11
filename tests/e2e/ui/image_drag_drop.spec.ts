
import { test, expect } from '@playwright/test';

test.describe('Chat Input Image Drag and Drop', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
      window.localStorage.setItem('joyride_finished', 'true');
      window.localStorage.setItem('onboarding_completed', 'true');
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    // 增加显式等待
    await page.waitForSelector('[data-testid="chat-input-area"]', { state: 'visible', timeout: 30000 });
  });

  test('should handle image file drop correctly', async ({ page }) => {
    const imagePreview = page.locator('[data-testid="image-attachment-item"]');
    await expect(imagePreview).toHaveCount(0);

    // 模拟拖拽逻辑
    await page.evaluate(() => {
      const dropZone = document.querySelector('[data-testid="chat-input-area"]');
      if (!dropZone) return; // 容错

      const dataTransfer = new DataTransfer();
      const file = new File([''], 'test-image.png', { type: 'image/png' });
      dataTransfer.items.add(file);

      const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer });
      const dragOverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer });

      dropZone.dispatchEvent(dragOverEvent);
      dropZone.dispatchEvent(dropEvent);
    });

    await expect(page.locator('[data-testid="image-attachment-item"]')).toHaveCount(1, { timeout: 15000 });
  });
});
