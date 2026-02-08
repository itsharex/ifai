import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup-utils';

test.describe('Dual-Engine High-Fidelity Validation', () => {
  test('Red-to-Green: Mode Switching and Parameter Propagation', async ({ page }) => {
    // 1. 初始化并注入 E2E 标记
    await page.addInitScript(() => {
      (window as any).__E2E__ = true;
    });
    
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    
    // 2. 等待 Debug 接口就绪 (对标 skills_flow_stable)
    await page.waitForFunction(() => {
      const dbg = (window as any).__DEBUG__;
      return dbg && dbg.chatStore && dbg.layoutStore && dbg.settingsStore;
    }, { timeout: 45000 });

    console.log('[E2E] All Stores are ready.');

    // 3. 注入后端拦截器并配置 Provider
    await page.evaluate(() => {
      (window as any).capturedAiChatArgs = null;
      const originalInvoke = (window as any).__TAURI__.core.invoke;
      (window as any).__TAURI__.core.invoke = async (cmd: string, args: any) => {
        if (cmd === 'ai_chat') {
          (window as any).capturedAiChatArgs = args;
          console.log('[E2E Intercept] captured:', args);
          return Promise.resolve();
        }
        if (cmd === 'local_model_preprocess') return { should_use_local: false };
        return originalInvoke(cmd, args);
      };

      // 配置 Provider 确保发送逻辑不中断
      const dbg = (window as any).__DEBUG__;
      dbg.settingsStore.getState().updateSettings({
        providers: [{
          id: 'e2e-provider', name: 'E2E', protocol: 'openai', 
          baseUrl: 'x', apiKey: 'x', enabled: true, models: ['test-model']
        }],
        currentProviderId: 'e2e-provider',
        currentModel: 'test-model'
      });
    });

    // --- PHASE 1: VIBE MODE ---
    console.log('[E2E] Phase 1: Testing VIBE...');
    await page.evaluate(async () => {
      const dbg = (window as any).__DEBUG__;
      // 物理注入模式状态
      (window as any).__IFAI_EDITOR_MODE__ = 'vibe';
      dbg.layoutStore.getState().setEditorMode('vibe');
      
      await dbg.chatStore.getState().sendMessage('Hello Vibe', 'e2e-provider', 'test-model');
    });

    await page.waitForFunction(() => (window as any).capturedAiChatArgs !== null, { timeout: 10000 });
    let finalArgs = await page.evaluate(() => (window as any).capturedAiChatArgs);
    console.log('[E2E Result] VIBE Mode Args:', finalArgs.mode);
    expect(finalArgs.mode).toBe('vibe');

    // --- PHASE 2: SPEC MODE ---
    console.log('[E2E] Phase 2: Testing SPEC...');
    await page.evaluate(async () => {
      const dbg = (window as any).__DEBUG__;
      (window as any).capturedAiChatArgs = null; // 重置
      
      // 物理注入模式状态
      (window as any).__IFAI_EDITOR_MODE__ = 'spec';
      dbg.layoutStore.getState().setEditorMode('spec');
      
      await dbg.chatStore.getState().sendMessage('Hello Spec', 'e2e-provider', 'test-model');
    });

    await page.waitForFunction(() => (window as any).capturedAiChatArgs !== null, { timeout: 10000 });
    finalArgs = await page.evaluate(() => (window as any).capturedAiChatArgs);
    console.log('[E2E Result] SPEC Mode Args:', finalArgs.mode);
    expect(finalArgs.mode).toBe('spec');

    console.log('🎉 HIGH-FIDELITY DUAL-ENGINE E2E GREEN PASSED.');
  });
});
