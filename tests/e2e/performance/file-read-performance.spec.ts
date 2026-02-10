/**
 * 性能基准测试：文件读取耗时
 */

import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from '../setup';

test.describe('P1 文件缓存性能基准测试', () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ETestEnvironment(page);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__chatStore !== undefined, { timeout: 45000 });
  });

  test('基准验证：连续重复读取文件耗时', async ({ page }) => {
    // 1. 准备一个相对较大的文件内容
    const targetFile = 'large-mock-file.json';
    const readCount = 20;
    const contentSize = 1024 * 500; // 500KB
    const mockContent = 'a'.repeat(contentSize);

    // 注入文件到模拟系统
    await page.evaluate(({ fileName, content }) => {
      const mockFS = (window as any).__E2E_MOCK_FILE_SYSTEM__;
      if (mockFS) {
        mockFS.set('/Users/mac/mock-project/' + fileName, content);
      }
    }, { fileName: targetFile, content: mockContent });

    console.log(`[Perf] 开始连续读取 ${targetFile} 共 ${readCount} 次...`);

    const metrics = await page.evaluate(async ({ fileName, count }) => {
      const results = [];
      const rootPath = (window as any).__fileStore.getState().rootPath;

      for (let i = 0; i < count; i++) {
        const start = performance.now();
        // 直接调用 Tauri invoke 模拟 Agent 读取行为
        await (window as any).__TAURI__.core.invoke('agent_read_file', {
          rootPath: rootPath,
          relPath: fileName
        });
        results.push(performance.now() - start);
      }

      return {
        avg: results.reduce((a, b) => a + b, 0) / count,
        min: Math.min(...results),
        max: Math.max(...results),
        all: results
      };
    }, { fileName: targetFile, count: readCount });

    console.log(`[PERF_BASELINE_DATA] 平均耗时: ${metrics.avg.toFixed(2)}ms`);
    console.log(`[PERF_BASELINE_DATA] 最小耗时: ${metrics.min.toFixed(2)}ms`);
    console.log(`[PERF_BASELINE_DATA] 最大耗时: ${metrics.max.toFixed(2)}ms`);

    expect(metrics.avg).toBeLessThan(500); // 基础断言，磁盘IO不应慢得离谱
  });
});
