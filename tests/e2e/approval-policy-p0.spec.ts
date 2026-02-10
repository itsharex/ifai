/**
 * P0 里程碑专项测试：统一审批策略与工具分类 (v4 - 高保真集成测试)
 */

import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup';

test.describe('P0 统一审批策略高保真验证', () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__chatStore !== undefined, { timeout: 45000 });
  });

  test('Vibe 模式：安全读取工具应全自动批准', async ({ page }) => {
    // 1. 设置为 Vibe 模式并初始化
    await page.evaluate(() => {
      (window as any).__IFAI_EDITOR_MODE__ = 'vibe';
      (window as any).__settingsStore.getState().updateSettings({
        agentApprovalMode: 'session-once',
        agentAutoApprove: false
      });
    });

    const assistantMsgId = 'msg-vibe-safe-' + Date.now();
    const toolCallId = 'tc-vibe-safe-' + Date.now();

    // 2. 模拟自然语言触发链路：直接调用暴露在 window 的意图处理函数模拟流程
    await page.evaluate(({msgId, tcId}) => {
      const chatStore = (window as any).__chatStore;
      
      // 模拟意图识别成功后注入一条带自动授权标志的消息
      chatStore.getState().addMessage({
        id: msgId,
        role: 'assistant',
        content: '_[自动识别意图: Explore]_',
        autoApproveTools: true,
        isAgentLive: true
      });

      // 模拟接收到 tool_call 事件
      const emitEvent = (window as any).__E2E_EMIT_EVENT__ || ((id: string, payload: any) => {
          const listeners = (globalThis as any).__TAURI_EVENT_LISTENERS__?.[id] || [];
          listeners.forEach((fn: any) => fn({ payload }));
      });

      emitEvent(msgId, {
        type: 'tool_call',
        toolCall: {
          id: tcId,
          tool: 'agent_read_file',
          args: { relPath: 'README.md' },
          isPartial: false
        }
      });

      // 模拟流结束，触发审批决策
      emitEvent(msgId + '_finish', 'DONE');
    }, {msgId: assistantMsgId, tcId: toolCallId});

    // 3. 轮询断言：状态应自动变更为 approved
    await page.waitForFunction(({msgId, tcId}) => {
      const messages = (window as any).__chatStore.getState().messages;
      const tc = messages.flatMap((m: any) => m.toolCalls || []).find((t: any) => t.id === tcId);
      return tc && (tc.status === 'approved' || tc.status === 'completed');
    }, {msgId: assistantMsgId, tcId: toolCallId}, { timeout: 10000 });

    const finalStatus = await page.evaluate(({msgId, tcId}) => {
      const messages = (window as any).__chatStore.getState().messages;
      const tc = messages.flatMap((m: any) => m.toolCalls || []).find((t: any) => t.id === tcId);
      return tc?.status;
    }, {msgId: assistantMsgId, tcId: toolCallId});

    console.log('[Vibe_P0_Test] Final status:', finalStatus);
    expect(['approved', 'completed']).toContain(finalStatus);
  });

  test('安全边界：即使是 Vibe 模式，破坏性操作也严禁自动批准', async ({ page }) => {
    // 1. 设置为 Vibe 模式
    await page.evaluate(() => {
      (window as any).__IFAI_EDITOR_MODE__ = 'vibe';
    });

    const assistantMsgId = 'msg-vibe-bash-' + Date.now();
    const toolCallId = 'tc-vibe-bash-' + Date.now();

    await page.evaluate(({msgId, tcId}) => {
      const chatStore = (window as any).__chatStore;
      
      chatStore.getState().addMessage({
        id: msgId,
        role: 'assistant',
        content: '_[自动识别意图: Bash]_',
        autoApproveTools: true,
        isAgentLive: true
      });

      const emitEvent = (window as any).__E2E_EMIT_EVENT__ || ((id: string, payload: any) => {
          const listeners = (globalThis as any).__TAURI_EVENT_LISTENERS__?.[id] || [];
          listeners.forEach((fn: any) => fn({ payload }));
      });

      // 注入破坏性工具
      emitEvent(msgId, {
        type: 'tool_call',
        toolCall: {
          id: tcId,
          tool: 'agent_bash',
          args: { command: 'rm -rf .' },
          isPartial: false
        }
      });

      emitEvent(msgId + '_finish', 'DONE');
    }, {msgId: assistantMsgId, tcId: toolCallId});

    // 等待一段时间，确认它保持 pending 状态
    await page.waitForTimeout(3000);

    const finalStatus = await page.evaluate(({msgId, tcId}) => {
      const messages = (window as any).__chatStore.getState().messages;
      const tc = messages.flatMap((m: any) => m.toolCalls || []).find((t: any) => t.id === tcId);
      return tc?.status;
    }, {msgId: assistantMsgId, tcId: toolCallId});

    console.log('[Vibe_P0_Test] Bash status (should be pending):', finalStatus);
    expect(finalStatus).toBe('pending');
  });
});
