/**
 * ============================================
 * E2E 测试辅助函数 - 设置相关
 * ============================================
 *
 * 提供操作设置模态框的辅助函数
 */

import { Page, Locator } from '@playwright/test';

/**
 * 打开设置模态框
 */
export async function openSettings(page: Page): Promise<void> {
  await page.click('[data-testid="settings-button"]');
  await page.waitForSelector('[data-testid="settings-modal"]', { state: 'visible' });
}

/**
 * 关闭设置模态框
 */
export async function closeSettings(page: Page): Promise<void> {
  const closeButton = page.locator('[data-testid="close-settings"]');
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  } else {
    // 点击遮罩层关闭
    await page.click('[data-testid="settings-modal"] .fixed');
  }
  await page.waitForSelector('[data-testid="settings-modal"]', { state: 'hidden' });
}

/**
 * 切换到指定的设置标签
 */
export async function switchToSettingsTab(page: Page, tabName: 'general' | 'editor' | 'ai' | 'performance' | 'keybindings' | 'data' | 'localModel' | 'customProvider' | 'toolClassification' | 'skills'): Promise<void> {
  const tabMap: Record<string, string> = {
    'general': '通用',
    'editor': '编辑器',
    'ai': 'AI',
    'performance': '性能',
    'keybindings': '快捷键',
    'data': '数据',
    'localModel': '本地模型',
    'customProvider': '自定义提供商',
    'toolClassification': '工具分类',
    'skills': '技能中心'
  };

  const tabLabel = tabMap[tabName] || tabName;

  // 尝试通过 data-testid 定位
  const tabByTestId = page.locator(`[data-testid="settings-tab-${tabName}"]`);
  if (await tabByTestId.isVisible().catch(() => false)) {
    await tabByTestId.click();
    return;
  }

  // 尝试通过文本定位
  const tabByText = page.locator('text=' + tabLabel).first();
  if (await tabByText.isVisible().catch(() => false)) {
    await tabByText.click();
    return;
  }

  throw new Error(`Could not find settings tab: ${tabName}`);
}

/**
 * 启用/禁用自动批准工具调用
 */
export async function toggleAutoApprove(page: Page, enable: boolean): Promise<void> {
  await openSettings(page);
  await switchToSettingsTab(page, 'ai');

  // 查找自动批准复选框
  const checkbox = page.locator('[data-testid="auto-approve-checkbox"]')
    .or(page.locator('input[type="checkbox"]').nth(1));

  const isChecked = await checkbox.isChecked();

  if (enable !== isChecked) {
    await checkbox.click();
  }

  await closeSettings(page);
}

/**
 * 设置审批模式
 */
export async function setApprovalMode(page: Page, mode: 'always' | 'session-once' | 'session-never' | 'per-tool'): Promise<void> {
  await page.evaluate((approvalMode) => {
    const settings = (window as any).__settingsStore;
    if (settings) {
      settings.setState({ agentApprovalMode: approvalMode });
    }
  }, mode);
}

/**
 * 获取当前设置状态
 */
export async function getSettingsState(page: Page): Promise<{
  agentAutoApprove: boolean;
  agentApprovalMode: string;
  toolClassificationEnabled: boolean;
}> {
  return await page.evaluate(() => {
    const settings = (window as any).__settingsStore?.getState();
    return {
      agentAutoApprove: settings?.agentAutoApprove ?? false,
      agentApprovalMode: settings?.agentApprovalMode ?? 'session-once',
      toolClassificationEnabled: settings?.toolClassificationEnabled ?? false
    };
  });
}

/**
 * 设置会话信任状态（用于 session-once 模式测试）
 */
export async function setSessionTrust(page: Page, threadId: string, trusted: boolean): Promise<void> {
  await page.evaluate(({ threadId, trusted }) => {
    const settings = (window as any).__settingsStore;
    if (!settings) return;

    const now = Date.now();
    const trustedSessions = trusted
      ? {
          [threadId]: {
            approvedAt: now,
            expiresAt: now + 60 * 60 * 1000 // 1小时
          }
        }
      : {};

    settings.setState({ trustedSessions });
  }, { threadId, trusted });
}

/**
 * 清除会话信任
 */
export async function clearSessionTrust(page: Page): Promise<void> {
  await page.evaluate(() => {
    const settings = (window as any).__settingsStore;
    if (settings) {
      settings.setState({ trustedSessions: {} });
    }
  });
}

/**
 * 检查当前会话是否被信任
 */
export async function isSessionTrusted(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const settings = (window as any).__settingsStore?.getState();
    const threadId = (window as any).__threadStore?.getState()?.activeThreadId || 'default';
    const sessionTrust = settings?.trustedSessions?.[threadId];
    return sessionTrust && Date.now() < sessionTrust.expiresAt;
  });
}
