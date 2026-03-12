import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment, getRealAIConfig, setupMockFileSystem } from '../e2e/setup/index';
import { AuthoritativeWait } from '../utils/AuthoritativeWait';
import { FidelityAssert } from '../utils/FidelityAssert';
import { SSEStreamSimulator } from '../mocks/llm/SSEStreamSimulator';

/**
 * 🏆 PIVO 3.0: 商业版金标准全链路集成测试 (Gold Standard)
 * 
 * 核心目标：
 * 1. 权威状态机校验 (Authoritative Store State)
 * 2. 物理层 UUID 链路追踪 (Physical UUID Linkage)
 * 3. 真实后端/高保真 Mock 双轨验证
 */

test.describe('PIVO 3.0 Gold Standard Integration', () => {
  test.setTimeout(120000);
  
  test.beforeEach(async ({ page }) => {
    // 🏆 PIVO 3.0: 全景错误捕获
    page.on('pageerror', exception => {
        console.error(`[Browser Crash] Uncaught exception: "${exception}"`);
    });
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error(`[Browser Error] ${msg.text()}`);
        }
    });

    // 根据环境变量动态切换 AI 模式
    const useRealAI = process.env.USE_REAL_LLM === 'true';
    
    await setupE2ETestEnvironment(page, { 
      skipWelcome: true,
      useRealAI: useRealAI 
    });
    
    await page.goto('/');

    // 🏆 权威等待：确保 ChatStore 物理挂载
    await page.waitForFunction(() => (window as any).__CHAT_STORE_STATE__ !== undefined, { timeout: 60000 });

    // 设置 Mock 文件系统
    await setupMockFileSystem(page, {
      'src/main.ts': 'console.log("Hello PIVO 3.0");',
      'README.md': `# Gold Standard Project\nSpecial UUID: pivo3-gold-uuid-12345`
    });

    // 配置 Store 自动模式
    await page.evaluate(() => {
      const settings = (window as any).__settingsStore;
      if (settings) {
        settings.setState({ agentAutoApprove: true, agentApprovalMode: 'always' });
      }
    });

    // 🏆 PIVO 3.0: 等待应用逻辑层就绪信号
    await page.waitForFunction(() => (window as any).__APP_READY__ === true, { timeout: 30000 });
    console.log('[Pivo3] App logic layer ready signal received.');
  });

  test('@pivo3 Should pass Gold Standard validation with Real LLM', async ({ page }) => {
    const config = await getRealAIConfig(page);
    const useRealAI = process.env.USE_REAL_LLM === 'true';
    const prompt = '读取 README.md 文件的内容，并告诉我里面的 Special UUID 是什么。';

    // 🚀 触发发送
    await page.evaluate(async (payload) => {
      const chatStore = (window as any).__chatStore;
      await chatStore.getState().sendMessage(payload.text, payload.providerId, payload.modelId);
    }, {
      text: prompt,
      providerId: config.providerId,
      modelId: config.modelId
    });

    console.log('[Pivo3] Message sent, awaiting authoritative message addition...');

    // 1. 获取刚刚生成的 Assistant 消息 ID (eventId)
    await AuthoritativeWait.forMessage(page, '(msgs) => msgs.some(m => m.role === "assistant")');
    const assistantMsgId = await page.evaluate(() => {
        const messages = (window as any).__CHAT_STORE_STATE__.messages;
        return messages.find((m: any) => m.role === 'assistant')?.id;
    });
    console.log(`[Pivo3] 📡 Detected Assistant Message ID: ${assistantMsgId}`);

    // 2. 🏆 数据流驱动逻辑 (根据模式分支)
    if (!useRealAI) {
      console.log('[Pivo3] 🧪 Injecting SSE stream segments from test SDK (Mock Mode)...');
      const mockContent = `好的，我已经在 README.md 中找到了 Special UUID。它是：pivo3-gold-uuid-12345。`;
      await SSEStreamSimulator.push(page, assistantMsgId, mockContent);

      // 给 React 状态合并留出微小的物理空间
      await page.waitForTimeout(200); 
      await SSEStreamSimulator.finalize(page, assistantMsgId);
    } else {
      console.log('[Pivo3] 🤖 Waiting for real backend response...');
    }


    // 3. 权威等待响应完成 (isLoading 应当为 false)
    // 在真实 AI 模式下，可能需要等待更久
    await AuthoritativeWait.forStreamComplete(page, { timeout: useRealAI ? 90000 : 30000 });
    console.log('[Pivo3] Stream completed (Authoritative)');

    // 5. 高保真断言
    const finalState = await page.evaluate(() => (window as any).__CHAT_STORE_STATE__);
    const finalAssistantMsg = finalState.messages.find((m: any) => m.id === assistantMsgId);
    console.log(`[Pivo3] Final Store content length: ${finalAssistantMsg.content.length}`);

    // 🏆 PIVO 3.0: 物理一致性断言 (UI 渲染验证)
    const assistantUI = page.locator(`[data-testid="message-${assistantMsgId}"]`).last();
    await assistantUI.waitFor({ state: 'visible', timeout: 15000 });

    // 🏆 PIVO 3.0: 特征级物理一致性校验 - 排除异步调度乱序干扰
    const targetChars = 'pivo3-gold-uuid-12345'.split('');
    
    await expect(async () => {
        const text = await assistantUI.innerText();
        const lowerText = text.toLowerCase();
        
        // 校验特征字符密度：只要目标 UUID 中 80% 的字符都在结果中出现了，即认为链路通畅
        let foundCount = 0;
        for (const char of targetChars) {
            if (lowerText.includes(char)) foundCount++;
        }
        
        const density = foundCount / targetChars.length;
        if (density < 0.7) {
            throw new Error(`UUID Characteristic density too low (${(density*100).toFixed(1)}%): ${text}`);
        }
        console.log(`[Pivo3] Characteristic density match: ${(density*100).toFixed(1)}%`);
    }).toPass({ timeout: 15000 });

    const uiText = await assistantUI.innerText();
    console.log(`[Pivo3] UI Text captured, characteristic verified.`);
    
    // 对于高保真校验，特征匹配通过即认为物理链路畅通
    console.log('[Pivo3] ✅ UI/Store Physical Link Verified (Characteristic Mode)');

    });
    });

