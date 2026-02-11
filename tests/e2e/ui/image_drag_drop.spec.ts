import { test, expect } from '@playwright/test';

test.describe('Chat Input Image Logic (Fix)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
      window.localStorage.setItem('joyride_finished', 'true');
      window.localStorage.setItem('onboarding_completed', 'true');
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="chat-panel"]');
  });

  test('image upload button must exist', async ({ page }) => {
    // 搜索 ImageInput 组件渲染出的按钮
    const uploadBtn = page.locator('button[title*="图片"]'); 
    await expect(uploadBtn).toBeVisible();
  });

  test('drag and drop must trigger image attachment', async ({ page }) => {
    const imagePreview = page.locator('[data-testid="image-attachment-item"]');
    await expect(imagePreview).toHaveCount(0);

    await page.evaluate(() => {
      const dropZone = document.querySelector('[data-testid="chat-input-area"]');
      if (!dropZone) return;

      const dataTransfer = new DataTransfer();
      const file = new File([''], 'test-image.png', { type: 'image/png' });
      dataTransfer.items.add(file);

      const dragOverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer });
      const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer });

      dropZone.dispatchEvent(dragOverEvent);
      dropZone.dispatchEvent(dropEvent);
    });

    // 验证图片预览出现
    await expect(page.locator('[data-testid="image-attachment-item"]')).toHaveCount(1, { timeout: 15000 });
  });
});