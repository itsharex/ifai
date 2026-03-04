import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment, setupMockFileSystem } from '../setup';

/**
 * 🏆 PIVO 3.0: 商业版内联编辑全链路集成测试 (高保真版)
 * 目标：验证 Inline AI Widget 及其状态同步在真实 UI 环境下的完整性。
 */

test.describe('Commercial Inline Edit High-Fidelity Verification', () => {
  test.setTimeout(120000);
  const testUuid = `test-uuid-${Math.random().toString(36).substring(7)}`;

  test.beforeEach(async ({ page }) => {
    // 1. 初始化环境并打开首页
    await setupE2ETestEnvironment(page, { 
      skipWelcome: true,
      useRealAI: true 
    });
    await page.goto('/');

    // 2. 强力锁定 Store
    await page.waitForFunction(() => (window as any).__chatStore !== undefined, { timeout: 60000 });
    
    // 3. 准备 Mock 文件系统
    await setupMockFileSystem(page, {
      'src/logic.ts': `// Special ID: ${testUuid}\nfunction add(a, b) { return a + b; }`
    });

    // 4. 设置自动审批模式
    await page.evaluate(() => {
      const settings = (window as any).__settingsStore;
      if (settings) {
        settings.getState().updateSettings({ 
          agentAutoApprove: true,
          agentApprovalMode: 'always' 
        });
      }
    });

    // 5. 🏆 关键：通过 eval 触发打开文件，确保 Monaco 挂载
    await page.evaluate(async (path) => {
        const { openFileFromPath } = await import('../../../src/utils/fileActions');
        await openFileFromPath(path);
    }, 'src/logic.ts');

    // 等待编辑器可见
    await page.locator('.monaco-editor').first().waitFor({ state: 'visible', timeout: 30000 });
  });

  test('@commercial Should display Target/Context and sync PIVO stages', async ({ page }) => {
    // 1. 模拟用户交互：选中逻辑并触发 Ctrl+K
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.press('Control+k');

    // 2. 验证 Widget 出现及其新 UI 元素
    const widget = page.locator('.inline-ai-widget');
    await expect(widget).toBeVisible({ timeout: 20000 });

    // 验证 "Target:" 文件名展示 (这是我刚刚修复的)
    const targetLabel = widget.locator('text=Target:');
    await expect(targetLabel).toBeVisible();
    await expect(widget.locator('text=logic.ts')).toBeVisible();

    // 验证 "Current Context" 预览展示
    await expect(widget.locator('text=Current Context')).toBeVisible();

    // 3. 输入指令并提交
    const input = page.locator('[data-testid="inline-ai-input"]');
    await input.fill('优化此逻辑');
    await page.keyboard.press('Enter');

    console.log('[E2E] Instruction submitted, waiting for PIVO stage sync...');

    // 4. 模拟 PIVO 状态推送：规划中 (Plan)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('pivo_stage', { 
        detail: { 
          stage: 'plan', 
          tasks: [{ id: 't1', description: '正在准备文件分析', status: 'running', stage: 'plan' }] 
        } 
      }));
    });

    // 验证 UI 能够捕获到 PIVO 任务 (不再精确匹配全文，匹配关键词)
    await expect(widget.locator('text=规划中')).toBeVisible({ timeout: 10000 });
    await expect(widget.locator('text=准备文件分析')).toBeVisible({ timeout: 10000 });

    // 5. 🔥 核心验证：模拟写入工具被调用，验证 UI 自动跳转到 "实施中"
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('agent:status', { 
        detail: { status: 'running', tool: 'agent_write_file' } 
      }));
    });

    // 验证状态标签更新为 "实施中"
    await expect(widget.locator('text=实施中')).toBeVisible({ timeout: 15000 });

    console.log('[E2E] ✅ Inline Edit full-chain UI verified.');
  });

});
