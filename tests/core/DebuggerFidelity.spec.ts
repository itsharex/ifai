import { test, expect } from '@playwright/test';
import { AuthoritativeWait } from '../utils/AuthoritativeWait';
import { setupE2ETestEnvironment } from '../e2e/setup/index';

/**
 * 🏆 DebuggerAgent v0.5.0 PIVO 3.0 金标准链路验证
 * 高保真版：状态机优先 -> 物理信号同步 -> 链路闭环
 */
test.describe('DebuggerAgent Fidelity (PIVO 3.0)', () => {
    
    test.beforeEach(async ({ page }) => {
        page.on('pageerror', err => console.error('[Pivo3-Crash] 🔴 Browser Exception:', err.message));
        
        await setupE2ETestEnvironment(page, { skipWelcome: true });
        await page.goto('/');
        
        // 🏆 PIVO 3.0: 权威等待应用逻辑层就绪
        await page.waitForFunction(() => (window as any).__APP_READY__ === true, { timeout: 60000 });
    });

    test('should intercept error logs and step through PIVO task tree', async ({ page }) => {
        const errorLog = "帮我分析并修复这个错误：error[E0425]: cannot find value `unknown_var` in this scope";
        
        console.log('[Pivo3] 发送模拟报错日志，触发 Debugger 意图...');
        
        // 1. 物理触发 IPC 发送消息
        await page.evaluate((log) => {
            const store = (window as any).useChatStore;
            const settingsStore = (window as any).useSettingsStore;
            
            if (!store || typeof store.getState !== 'function') {
                throw new Error(`[E2E] useChatStore not found. Ready: ${(window as any).__APP_READY__}`);
            }
            
            const settings = settingsStore.getState();
            // 🏆 PIVO 3.0: 使用 Authoritative 物理发送
            store.getState().sendMessage(log, settings.currentProviderId, settings.currentModel);
        }, errorLog);

        // 2. 权威等待：验证 PIVO 任务树中出现了“分析错误日志”任务
        console.log('[Pivo3] Awaiting Debugger Task appearance in Store...');
        await AuthoritativeWait.forPivoTask(page, '分析错误日志', { timeout: 15000 });

        // 3. 物理信号等待：等待 AI 响应流程完全结束
        console.log('[Pivo3] Awaiting stream-finished signal...');
        await AuthoritativeWait.forStreamComplete(page, { timeout: 30000 });

        // 4. 最终状态权威校验
        const hasPatchStep = await page.evaluate(() => {
            const pivoStore = (window as any).__pivoStore;
            if (!pivoStore) return false;
            const tasks = pivoStore.getState().taskTrees;
            // 校验是否物理生成了原子补丁步骤
            return Object.values(tasks).some((tree: any) => 
                tree.some((t: any) => t.label.includes('生成原子补丁方案') && t.status === 'success')
            );
        });

        expect(hasPatchStep).toBe(true);
        console.log('[Pivo3] ✅ DebuggerAgent PIVO Gold Standard Link Verified!');
    });
});
