import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup-utils';

test.describe('Dual-Engine Mode Logic Proof', () => {
  test('High-Fidelity State to IPC Verification', async ({ page }) => {
    // 1. 初始化
    await page.addInitScript(() => { (window as any).__E2E__ = true; });
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    
    // 2. 强力等待 Store
    await page.waitForFunction(() => (window as any).__DEBUG__?.chatStore !== undefined, { timeout: 45000 });

    // 3. 注入后端报文拦截器
    await page.evaluate(() => {
      (window as any).capturedAiChat = null;
      const originalInvoke = (window as any).__TAURI__.core.invoke;
      (window as any).__TAURI__.core.invoke = async (cmd: string, args: any) => {
        if (cmd === 'ai_chat') {
          (window as any).capturedAiChat = args;
          return Promise.resolve();
        }
        if (cmd === 'local_model_preprocess') return { should_use_local: false };
        return originalInvoke(cmd, args);
      };

      // 配置 Provider 环境
      const dbg = (window as any).__DEBUG__;
      dbg.settingsStore.getState().updateSettings({
        providers: [{ id: 'e2e', name: 'E', protocol: 'openai', enabled: true, models: ['m'] }],
        currentProviderId: 'e2e', currentModel: 'm'
      });
    });

    // --- PHASE 1: SPEC MODE ---
    console.log('[E2E] Testing SPEC propagation...');
    await page.evaluate(async () => {
      const dbg = (window as any).__DEBUG__;
      // 模拟按钮点击后的核心动作
      (window as any).__IFAI_EDITOR_MODE__ = 'spec';
      dbg.layoutStore.getState().setEditorMode('spec');
      
      await dbg.chatStore.getState().sendMessage('P1', 'e2e', 'm');
    });

    await page.waitForFunction(() => (window as any).capturedAiChat !== null, { timeout: 10000 });
    let res = await page.evaluate(() => (window as any).capturedAiChat);
    expect(res.mode).toBe('spec');

    // --- PHASE 2: VIBE MODE ---
    console.log('[E2E] Testing VIBE propagation...');
    await page.evaluate(() => { (window as any).capturedAiChat = null; }); // 重置
    await page.evaluate(async () => {
      const dbg = (window as any).__DEBUG__;
      (window as any).__IFAI_EDITOR_MODE__ = 'vibe';
      dbg.layoutStore.getState().setEditorMode('vibe');
      
      await dbg.chatStore.getState().sendMessage('P2', 'e2e', 'm');
    });

    await page.waitForFunction(() => (window as any).capturedAiChat !== null, { timeout: 10000 });
    res = await page.evaluate(() => (window as any).capturedAiChat);
    expect(res.mode).toBe('vibe');

    console.log('🎉 LOGIC-LEVEL E2E GREEN PASSED.');
  });
});