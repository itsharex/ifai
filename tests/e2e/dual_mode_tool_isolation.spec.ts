import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup-utils';

test.describe('Dual-Mode Tool Isolation (v0.9.20)', () => {
  test('Red-to-Green: Verify tool filtering in Vibe vs Spec', async ({ page }) => {
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    
    // 1. 等待应用就绪
    await page.waitForFunction(() => (window as any).__DEBUG__?.chatStore !== undefined, { timeout: 30000 });

    // 2. 注入报文拦截器
    await page.evaluate(() => {
      (window as any).capturedTools = null;
      const originalInvoke = (window as any).__TAURI__.core.invoke;
      (window as any).__TAURI__.core.invoke = async (cmd: string, args: any) => {
        if (cmd === 'ai_chat') {
          (window as any).capturedTools = args.tools || [];
          console.log('[E2E Intercept] ai_chat tools:', args.tools);
          return Promise.resolve(); // 拦截调用
        }
        if (cmd === 'local_model_preprocess') return { should_use_local: false };
        return originalInvoke(cmd, args);
      };

      // 配置模拟 Provider
      const dbg = (window as any).__DEBUG__;
      dbg.settingsStore.getState().updateSettings({
        providers: [{ id: 'e2e', name: 'E', protocol: 'openai', enabled: true, models: ['m'] }],
        currentProviderId: 'e2e', currentModel: 'm'
      });
    });

    // --- PHASE 1: SPEC MODE (Red Phase - Expect Tools) ---
    console.log('[E2E] Phase 1: Validating SPEC mode tools...');
    await page.evaluate(async () => {
      const dbg = (window as any).__DEBUG__;
      (window as any).__IFAI_EDITOR_MODE__ = 'spec';
      dbg.layoutStore.getState().setEditorMode('spec');
      await dbg.chatStore.getState().sendMessage('P1', 'e2e', 'm');
    });

    await page.waitForFunction(() => (window as any).capturedTools !== null, { timeout: 10000 });
    const p1Tools = await page.evaluate(() => (window as any).capturedTools);
    console.log('[E2E Result] SPEC Tools Count:', p1Tools.length);
    // 在 Spec 模式下，工具集应包含基础工具 (如 bash)
    expect(p1Tools.length).toBeGreaterThan(0);

    // --- PHASE 2: VIBE MODE (Green Phase - Expect NO Tools) ---
    console.log('[E2E] Phase 2: Validating VIBE mode isolation...');
    await page.evaluate(() => (window as any).capturedTools = null); // 重置
    await page.evaluate(async () => {
      const dbg = (window as any).__DEBUG__;
      (window as any).__IFAI_EDITOR_MODE__ = 'vibe';
      dbg.layoutStore.getState().setEditorMode('vibe');
      await dbg.chatStore.getState().sendMessage('P2', 'e2e', 'm');
    });

    await page.waitForFunction(() => (window as any).capturedTools !== null, { timeout: 10000 });
    const p2Tools = await page.evaluate(() => (window as any).capturedTools);
    console.log('[E2E Result] VIBE Tools Count:', p2Tools.length);
    
    // 终极断言：Vibe 模式下工具必须被物理移除
    expect(p2Tools).toHaveLength(0);

    console.log('🎉 TOOL ISOLATION E2E GREEN: Vibe mode is now a pure conversational environment.');
  });
});
