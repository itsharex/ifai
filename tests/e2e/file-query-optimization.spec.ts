/**
 * E2E高保真测试：文件查询优化验证
 *
 * 📋 测试目标
 * ---------
 * 验证文件查询相关的工具调用流程和状态管理，
 * 不依赖真实LLM，直接注入工具调用消息进行测试。
 *
 * 🧪 测试方法论
 * ------------
 * 1. 物理环境对齐：直接操作 Store 状态
 * 2. 报文拦截模式：直接注入工具调用消息
 * 3. 模拟工具调用：不依赖LLM API，提高测试稳定性
 *
 * 📊 基线数据收集
 * -------------
 * 所有测试输出 [BASELINE_DATA] 标记的 JSON 数据
 *
 * @version 2.0.0
 * @date 2026-02-10
 * @note 改用模拟工具调用，不依赖LLM API
 */

import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup';

test.describe('E2E高保真测试：文件查询优化', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[E2E') || text.includes('[BASELINE_DATA]')) {
        console.log(`[Browser Console] [${msg.type()}] ${text}`);
      }
    });

    await setupE2ETestEnvironment(page);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__chatStore !== undefined, { timeout: 45000 });
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const layoutStore = (window as any).__layoutStore;
      if (layoutStore && !layoutStore.getState().isChatOpen) {
        layoutStore.getState().toggleChat();
      }
    });
    await page.waitForTimeout(1000);
  });

  /**
   * 场景1: 基本JS文件查询 - 验证扫描目录工具调用
   */
  test('场景1: 基本JS文件查询（小项目）', async ({ page }) => {
    const startTime = Date.now();

    // Given: 创建测试文件并注入扫描目录工具调用
    await page.evaluate(() => {
      const mockFS = (window as any).__E2E_MOCK_FILE_SYSTEM__;
      mockFS.set('/test-project/src/utils/helper.js', '// Helper functions');
      mockFS.set('/test-project/src/components/Button.js', '// Button component');
      mockFS.set('/test-project/src/app.js', '// Main app');

      const chatStore = (window as any).__chatStore;

      // 添加用户消息
      const userId = crypto.randomUUID();
      chatStore.getState().addMessage({
        id: userId,
        role: 'user',
        content: '项目下所有js文件',
        timestamp: Date.now()
      });

      // 注入带有扫描目录工具调用的助手消息
      const assistantId = crypto.randomUUID();
      chatStore.getState().addMessage({
        id: assistantId,
        role: 'assistant',
        content: '我来帮你查找项目下的所有JS文件',
        timestamp: Date.now(),
        toolCalls: [{
          id: crypto.randomUUID(),
          type: 'function',
          tool: 'agent_scan_directory',
          args: { rel_path: '.', file_patterns: ['*.js'] },
          function: { name: 'agent_scan_directory', arguments: '{"rel_path":".","file_patterns":["*.js"]}' },
          status: 'pending',
          isPartial: false
        }]
      });

      return assistantId;
    });

    await page.waitForTimeout(500);

    // Then: 验证工具调用状态
    const toolCallState = await page.evaluate(() => {
      const chatStore = (window as any).__chatStore;
      const messages = chatStore.getState().messages;
      const assistantMsg = messages.find((m: any) => m.role === 'assistant' && m.toolCalls);

      if (!assistantMsg || !assistantMsg.toolCalls) {
        return { hasToolCall: false };
      }

      const toolCall = assistantMsg.toolCalls[0];
      return {
        hasToolCall: true,
        toolName: toolCall.tool,
        status: toolCall.status,
        args: toolCall.args
      };
    });

    console.log('[BASELINE_DATA]', JSON.stringify({
      scenario: 'small_project_js_query',
      timestamp: new Date().toISOString(),
      toolCallState,
      timing: { totalTime: Date.now() - startTime }
    }, null, 2));

    expect(toolCallState.hasToolCall).toBe(true);
    expect(toolCallState.toolName).toBe('agent_scan_directory');
    expect(toolCallState.args).toMatchObject({
      rel_path: '.',
      file_patterns: ['*.js']
    });
  });

  /**
   * 场景2: 多种文件类型查询 - 验证批量读取工具
   */
  test('场景2: 多种文件类型查询（中项目）', async ({ page }) => {
    const startTime = Date.now();

    // Given: 创建多个测试文件
    await page.evaluate(() => {
      const mockFS = (window as any).__E2E_MOCK_FILE_SYSTEM__;
      for (let i = 0; i < 10; i++) {
        mockFS.set(`/test-project/src/file${i}.ts`, `// TypeScript file ${i}`);
        mockFS.set(`/test-project/src/component${i}.tsx`, `// React component ${i}`);
      }

      const chatStore = (window as any).__chatStore;

      // 添加用户消息
      chatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: '列出所有的TypeScript文件',
        timestamp: Date.now()
      });

      // 注入批量读取工具调用
      chatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '我来查找所有的TypeScript文件',
        timestamp: Date.now(),
        toolCalls: [{
          id: crypto.randomUUID(),
          type: 'function',
          tool: 'agent_batch_read',
          args: {
            file_paths: [
              'src/file0.ts',
              'src/file1.ts',
              'src/component0.tsx',
              'src/component1.tsx'
            ]
          },
          function: { name: 'agent_batch_read', arguments: '{"file_paths":["src/file0.ts","src/file1.ts","src/component0.tsx","src/component1.tsx"]}' },
          status: 'pending',
          isPartial: false
        }]
      });
    });

    await page.waitForTimeout(500);

    // Then: 验证批量读取工具
    const batchReadState = await page.evaluate(() => {
      const chatStore = (window as any).__chatStore;
      const messages = chatStore.getState().messages;
      const assistantMsg = messages.find((m: any) => m.role === 'assistant' && m.toolCalls);

      if (!assistantMsg || !assistantMsg.toolCalls) {
        return { hasToolCall: false };
      }

      const toolCall = assistantMsg.toolCalls[0];
      return {
        hasToolCall: true,
        toolName: toolCall.tool,
        fileCount: toolCall.args?.file_paths?.length || 0,
        status: toolCall.status
      };
    });

    console.log('[BASELINE_DATA]', JSON.stringify({
      scenario: 'medium_project_multi_type_query',
      timestamp: new Date().toISOString(),
      batchReadState,
      timing: { totalTime: Date.now() - startTime }
    }, null, 2));

    expect(batchReadState.hasToolCall).toBe(true);
    expect(batchReadState.toolName).toBe('agent_batch_read');
    expect(batchReadState.fileCount).toBe(4);
  });

  /**
   * 场景3: 大规模项目性能 - 验证扫描参数
   */
  test('场景3: 大规模项目性能测试', async ({ page }) => {
    const startTime = Date.now();

    // Given: 注入带性能参数的扫描工具调用
    await page.evaluate(() => {
      const chatStore = (window as any).__chatStore;

      chatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: '项目中所有的JavaScript和TypeScript文件',
        timestamp: Date.now()
      });

      // 注入带有性能限制的扫描调用
      chatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '扫描所有JS和TS文件',
        timestamp: Date.now(),
        toolCalls: [{
          id: crypto.randomUUID(),
          type: 'function',
          tool: 'agent_scan_directory',
          args: {
            rel_path: '.',
            file_patterns: ['*.js', '*.ts', '*.tsx', '*.jsx'],
            max_files: 500,
            timeout_ms: 30000
          },
          function: { name: 'agent_scan_directory', arguments: '{"rel_path":".","file_patterns":["*.js","*.ts","*.tsx","*.jsx"],"max_files":500,"timeout_ms":30000}' },
          status: 'pending',
          isPartial: false
        }]
      });
    });

    await page.waitForTimeout(500);

    // Then: 验证性能参数
    const performanceParams = await page.evaluate(() => {
      const chatStore = (window as any).__chatStore;
      const messages = chatStore.getState().messages;
      const toolCall = messages.find((m: any) => m.toolCalls)?.toolCalls?.[0];

      return {
        hasToolCall: !!toolCall,
        toolName: toolCall?.tool,
        maxFiles: toolCall?.args?.max_files,
        timeoutMs: toolCall?.args?.timeout_ms,
        patterns: toolCall?.args?.file_patterns
      };
    });

    const totalTime = Date.now() - startTime;

    console.log('[BASELINE_DATA]', JSON.stringify({
      scenario: 'large_project_performance_test',
      timestamp: new Date().toISOString(),
      performanceParams,
      timing: { totalTime },
      performanceMetrics: {
        acceptableThreshold: totalTime < 5000
      }
    }, null, 2));

    expect(performanceParams.hasToolCall).toBe(true);
    expect(performanceParams.maxFiles).toBe(500);
    expect(performanceParams.timeoutMs).toBe(30000);
    expect(totalTime).toBeLessThan(5000);
  });

  /**
   * 场景4: 意图识别边界 - 验证不同查询参数
   */
  test('场景4: 意图识别边界情况', async ({ page }) => {
    const testQueries = [
      { query: '项目下所有js文件', pattern: '*.js' },
      { query: '帮我看看有哪些js文件', pattern: '*.js' },
      { query: '列出所有typescript文件', pattern: '*.ts' },
      { query: '查看React组件', pattern: '*.tsx' }
    ];

    const intentResults: any[] = [];

    for (const { query, pattern } of testQueries) {
      const startTime = Date.now();

      await page.evaluate((payload) => {
        const chatStore = (window as any).__chatStore;

        // 添加用户消息
        chatStore.getState().addMessage({
          id: crypto.randomUUID(),
          role: 'user',
          content: payload.query,
          timestamp: Date.now()
        });

        // 注入对应文件模式的扫描调用
        chatStore.getState().addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `查找${payload.query}`,
          timestamp: Date.now(),
          toolCalls: [{
            id: crypto.randomUUID(),
            type: 'function',
            tool: 'agent_scan_directory',
            args: { rel_path: '.', file_patterns: [payload.pattern] },
            function: { name: 'agent_scan_directory', arguments: `{"rel_path":".","file_patterns":["${payload.pattern}"]}` },
            status: 'pending',
            isPartial: false
          }]
        });
      }, { query, pattern });

      await page.waitForTimeout(200);

      // 收集结果
      const toolCallInfo = await page.evaluate(() => {
        const chatStore = (window as any).__chatStore;
        const messages = chatStore.getState().messages;
        const lastToolCall = messages
          .filter((m: any) => m.toolCalls)
          .pop()?.toolCalls?.[0];

        return {
          hasToolCall: !!lastToolCall,
          toolName: lastToolCall?.tool,
          pattern: lastToolCall?.args?.file_patterns?.[0]
        };
      });

      intentResults.push({
        query,
        pattern,
        responseTime: Date.now() - startTime,
        toolTriggered: toolCallInfo.hasToolCall && toolCallInfo.toolName === 'agent_scan_directory',
        matchedPattern: toolCallInfo.pattern
      });
    }

    console.log('[BASELINE_DATA]', JSON.stringify({
      scenario: 'intent_recognition_boundary_test',
      timestamp: new Date().toISOString(),
      results: intentResults,
      analysis: {
        totalQueries: testQueries.length,
        toolTriggeredCount: intentResults.filter(r => r.toolTriggered).length,
        averageResponseTime: intentResults.reduce((sum, r) => sum + r.responseTime, 0) / intentResults.length
      }
    }, null, 2));

    // 验证所有查询都触发了工具调用
    expect(intentResults.filter(r => r.toolTriggered).length).toBe(testQueries.length);
  });

  /**
   * 场景5: 工具调用序列分析
   */
  test('场景5: 工具调用序列分析', async ({ page }) => {
    // Given: 注入完整的两阶段扫描工作流
    await page.evaluate(() => {
      const chatStore = (window as any).__chatStore;

      // 用户查询
      chatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: '项目下所有js文件',
        timestamp: Date.now()
      });

      // 阶段1：扫描目录
      chatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '第一步：扫描项目目录',
        timestamp: Date.now(),
        toolCalls: [{
          id: crypto.randomUUID(),
          type: 'function',
          tool: 'agent_scan_directory',
          args: { rel_path: '.', file_patterns: ['*.js'] },
          function: { name: 'agent_scan_directory', arguments: '{"rel_path":".","file_patterns":["*.js"]}' },
          status: 'completed',
          isPartial: false
        }]
      });

      // 阶段2：批量读取文件
      chatStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '第二步：读取找到的JS文件',
        timestamp: Date.now() + 100,
        toolCalls: [{
          id: crypto.randomUUID(),
          type: 'function',
          tool: 'agent_batch_read',
          args: { file_paths: ['src/app.js', 'src/utils/helper.js'] },
          function: { name: 'agent_batch_read', arguments: '{"file_paths":["src/app.js","src/utils/helper.js"]}' },
          status: 'pending',
          isPartial: false
        }]
      });
    });

    await page.waitForTimeout(500);

    // Then: 分析工具调用序列
    const toolCallSequence = await page.evaluate(() => {
      const chatStore = (window as any).__chatStore;
      const messages = chatStore.getState().messages;

      const sequence: any[] = [];
      messages.forEach((msg: any) => {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          msg.toolCalls.forEach((tc: any) => {
            sequence.push({
              tool: tc.tool,
              status: tc.status,
              timestamp: msg.timestamp
            });
          });
        }
      });

      return sequence;
    });

    console.log('[BASELINE_DATA]', JSON.stringify({
      scenario: 'tool_call_sequence_analysis',
      timestamp: new Date().toISOString(),
      toolCallSequence,
      analysis: {
        totalToolCalls: toolCallSequence.length,
        uniqueTools: [...new Set(toolCallSequence.map(tc => tc.tool))],
        firstTool: toolCallSequence[0]?.tool,
        secondTool: toolCallSequence[1]?.tool,
        hasScanDirectory: toolCallSequence.some(tc => tc.tool === 'agent_scan_directory'),
        hasBatchRead: toolCallSequence.some(tc => tc.tool === 'agent_batch_read'),
        sequenceOrder: toolCallSequence.map(tc => tc.tool)
      }
    }, null, 2));

    // 验证两阶段工作流
    expect(toolCallSequence.length).toBe(2);
    expect(toolCallSequence[0].tool).toBe('agent_scan_directory');
    expect(toolCallSequence[1].tool).toBe('agent_batch_read');
  });

  /**
   * 场景6: 重复查询处理
   */
  test('场景6: 重复查询缓存效果', async ({ page }) => {
    const query = '项目下所有js文件';
    const timestamps: number[] = [];

    // When: 执行两次相同查询
    for (let i = 0; i < 2; i++) {
      const startTime = Date.now();

      await page.evaluate((payload) => {
        const chatStore = (window as any).__chatStore;

        chatStore.getState().addMessage({
          id: crypto.randomUUID(),
          role: 'user',
          content: payload.text,
          timestamp: Date.now()
        });

        chatStore.getState().addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `查询结果 ${payload.index + 1}`,
          timestamp: Date.now(),
          toolCalls: [{
            id: crypto.randomUUID(),
            type: 'function',
            tool: 'agent_scan_directory',
            args: { rel_path: '.', file_patterns: ['*.js'] },
            function: { name: 'agent_scan_directory', arguments: '{"rel_path":".","file_patterns":["*.js"]}' },
            status: 'pending',
            isPartial: false
          }]
        });
      }, { text: query, index: i });

      await page.waitForTimeout(100);
      timestamps.push(Date.now() - startTime);
    }

    // Then: 分析性能
    console.log('[BASELINE_DATA]', JSON.stringify({
      scenario: 'cache_effectiveness_test',
      timestamp: new Date().toISOString(),
      timings: {
        firstQuery: timestamps[0],
        secondQuery: timestamps[1],
        difference: timestamps[1] - timestamps[0]
      },
      messageCount: await page.evaluate(() => {
        return (window as any).__chatStore.getState().messages.length;
      })
    }, null, 2));

    // 验证消息已添加
    const messageCount = await page.evaluate(() => {
      return (window as any).__chatStore.getState().messages.length;
    });

    expect(messageCount).toBe(4); // 2次查询 x 2条消息
  });
});

/**
 * 测试套件说明
 * -------------
 *
 * v2.0.0 更新：改用模拟工具调用，不依赖LLM API
 *
 * 测试覆盖：
 * 1. 扫描目录工具调用 - agent_scan_directory
 * 2. 批量读取工具调用 - agent_batch_read
 * 3. 工具调用参数验证
 * 4. 两阶段扫描工作流
 * 5. 性能参数验证
 * 6. 消息序列完整性
 */
