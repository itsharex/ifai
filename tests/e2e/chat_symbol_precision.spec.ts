import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup-utils';

test.describe('Milestone 3: Symbol Precision Proof', () => {
  test('Verified: Symbol selection (#) correctly injects range text into input', async ({ page }) => {
    await page.addInitScript(() => { (window as any).__E2E__ = true; });
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    
    await page.waitForFunction(() => (window as any).__DEBUG__?.chatStore !== undefined, { timeout: 45000 });

    await page.evaluate(() => {
      document.querySelectorAll('.react-joyride__overlay').forEach(o => (o as HTMLElement).style.display = 'none');
      const dbg = (window as any).__DEBUG__;
      const originalInvoke = (window as any).__TAURI__.core.invoke;
      (window as any).__TAURI__.core.invoke = async (cmd: string, args: any) => {
        if (cmd === 'get_file_symbols') {
          return [{ name: 'testFunc', kind: 'Function', line: 42 }];
        }
        return originalInvoke(cmd, args);
      };
      // Mock active file
      dbg.fileStore.setState({ activeFileId: 'src/mock.ts' });
    });

    const chatInput = page.locator('textarea, [data-testid="chat-input"]').first();
    await chatInput.waitFor({ state: 'visible' });
    await chatInput.focus();
    await page.keyboard.type('#');

    const panel = page.getByTestId('symbol-mention-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });

    const item = page.getByTestId('mention-item-0');
    await expect(item).toContainText('testFunc');
    await item.click({ force: true });

    const finalValue = await chatInput.inputValue();
    expect(finalValue).toContain('[#testFunc]');
    expect(finalValue).toContain(':42-57'); // 42 + 15 default range

    console.log('🎉 SYMBOL PRECISION E2E GREEN.');
  });
});
