import { test, expect } from '@playwright/test';
import { setupE2ETestEnvironment } from './setup-utils';

test.describe('IfAI Cold Start & Initialization Performance', () => {
  test.setTimeout(180000); // 给 3 分钟，因为物理机编译/加载可能很慢

  test('Load Phase Performance Analysis', async ({ page }) => {
    // 1. 注入早期监控
    await page.addInitScript(() => {
      (window as any).perfData = {
        domInteractive: 0,
        loadEvent: 0,
        longTasks: [] as any[]
      };
      
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).perfData.longTasks.push(entry.duration);
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    });

    const start = Date.now();
    await setupE2ETestEnvironment(page);
    await page.goto('/', { waitUntil: 'load' });
    const end = Date.now();

    // 2. 采集 LCP 和 导航指标
    const metrics = await page.evaluate(() => {
      const t = performance.timing;
      return {
        dns: t.domainLookupEnd - t.dnsStart,
        tcp: t.connectEnd - t.connectStart,
        ttfb: t.responseStart - t.requestStart,
        domContent: t.domContentLoadedEventEnd - t.navigationStart,
        load: t.loadEventEnd - t.navigationStart,
        longTasks: (window as any).perfData.longTasks
      };
    });

    console.log('\n--- 📊 IFAI SYSTEM LOAD REPORT ---');
    console.log(`Total Wall Clock Time: ${end - start}ms`);
    console.log(`Time to First Byte (TTFB): ${metrics.ttfb}ms`);
    console.log(`DOM Content Loaded: ${metrics.domContent}ms`);
    console.log(`Full Page Load: ${metrics.load}ms`);
    console.log(`Main Thread Long Tasks (>50ms): ${metrics.longTasks.length}`);
    if (metrics.longTasks.length > 0) {
      console.log(`Max JS Block: ${Math.max(...metrics.longTasks).toFixed(2)}ms`);
      const totalBlock = metrics.longTasks.reduce((a:number, b:number) => a + b, 0);
      console.log(`Total JS Blocking Time: ${totalBlock.toFixed(2)}ms`);
    }
    console.log('------------------------------------\n');

    // 断言：DOM 加载不应超过 15 秒 (针对 E2E 开发环境)
    expect(metrics.domContent).toBeLessThan(15000);
  });
});