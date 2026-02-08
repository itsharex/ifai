import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup-utils';

test.describe('Dual-Engine Mode Propagation', () => {
  test('Should pass correct mode to backend when toggled', async ({ page }) => {
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    
    await page.waitForFunction(() => (window as any).__DEBUG__ !== undefined, { timeout: 30000 });

    // 1. 注入拦截器
    await page.evaluate(() => {
      (window as any).capturedCalls = [];
      const originalInvoke = (window as any).__TAURI__.core.invoke;
      (window as any).__TAURI__.core.invoke = async (cmd: string, args: any) => {
        if (cmd === 'ai_chat') {
          (window as any).capturedCalls.push(args);
          return Promise.resolve();
        }
        return originalInvoke(cmd, args);
      };
    });

    // --- PHASE 1: VIBE ---
    console.log('[E2E] Testing VIBE mode...');
    await page.evaluate(async () => {
      const { setEditorMode } = (window as any).__layoutStore.getState();
      const chat = (window as any).__DEBUG__.chatStore.getState();
      setEditorMode('vibe');
      await chat.sendMessage('Hello Vibe', 'e2e', 'm');
    });

    await page.waitForFunction(() => (window as any).capturedCalls.length > 0);
    const vCall = await page.evaluate(() => (window as any).capturedCalls[0]);
    expect(vCall.mode).toBe('vibe');

    // --- PHASE 2: SPEC ---
    console.log('[E2E] Testing SPEC mode...');
    await page.evaluate(async () => {
      const { setEditorMode } = (window as any).__layoutStore.getState();
      const chat = (window as any).__DEBUG__.chatStore.getState();
      setEditorMode('spec');
      await chat.sendMessage('Hello Spec', 'e2e', 'm');
    });

    await page.waitForFunction(() => (window as any).capturedCalls.length >= 2);
    const sCall = await page.evaluate(() => (window as any).capturedCalls[1]);
    expect(sCall.mode).toBe('spec');

    console.log('🎉 DUAL-ENGINE E2E GREEN: Mode state is successfully synchronized to backend.');
  });
});
