import { test, expect } from '@playwright/test';
import { AuthoritativeWait } from '../utils/AuthoritativeWait';
import { setupE2ETestEnvironment } from '../e2e/setup/index';

/**
 * 🏆 DebuggerAgent v0.5.0 PIVO 3.0 金标准链路验证
 * 物理级闭环：意图触发 -> 状态同步 -> 热更新校验
 */
test.describe('DebuggerAgent Fidelity (PIVO 3.0)', () => {
    
    test.beforeEach(async ({ page }) => {
        page.on('pageerror', err => console.error('[Pivo3-Crash] 🔴 Browser Exception:', err.message));
        
        await setupE2ETestEnvironment(page, { skipWelcome: true });
        await page.goto('/');
        
        // 🏆 PIVO 3.0: 权威等待应用逻辑层就绪
        await page.waitForFunction(() => (window as any).__APP_READY__ === true, { timeout: 60000 });
    });

    test('should update editor content dynamically after AI modification', async ({ page }) => {
        // 1. 物理级打开测试文件
        console.log('[Pivo3] 正在挂载测试文件并分配布局...');
        await page.evaluate(() => {
            const fs = (window as any).useFileStore;
            const ls = (window as any).useLayoutStore;
            const fileId = 'hot-update-test';
            
            fs.getState().openFile({
                id: fileId,
                path: '/hot-update-test.ts',
                name: 'hot-update-test.ts',
                content: 'const initial = "PIVO 3.0";',
                language: 'typescript',
                isDirty: false
            });
            
            if (ls && ls.getState().panes.length > 0) {
                const paneId = ls.getState().panes[0].id;
                ls.getState().assignFileToPane(paneId, fileId);
            }
        });

        // 权威等待编辑器渲染并显示初始内容
        const editor = page.locator('.monaco-editor');
        await expect(editor).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=PIVO 3.0')).toBeVisible({ timeout: 10000 });
        console.log('[Pivo3] Initial content verified in UI.');

        // 2. 模拟物理变更 (AI 写入场景)
        console.log('[Pivo3] 模拟 AI 物理写入 Store...');
        const updatedContent = 'const updated = "HOT UPDATE SUCCESS";';
        
        await page.evaluate((content) => {
            const fs = (window as any).useFileStore;
            const activeId = fs.getState().activeFileId;
            if (activeId) {
                // 🏆 PIVO 3.0: 触发物理同步核心逻辑
                fs.getState().updateFileContent(activeId, content);
                fs.getState().setFileDirty(activeId, false);
            }
        }, updatedContent);

        // 3. 🏆 核心断言：编辑器必须在没有用户干预的情况下物理刷新内容
        // 由于我们在 MonacoEditor.tsx 中加固了物理同步引擎，这里应该秒过
        await expect(page.locator('text=HOT UPDATE SUCCESS')).toBeVisible({ timeout: 15000 });
        
        console.log('[Pivo3] ✅ Hot Update Fidelity Verified: UI dynamically refreshed via Store Sync.');
    });
});
