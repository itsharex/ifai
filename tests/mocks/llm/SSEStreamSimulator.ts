import { Page } from '@playwright/test';

/**
 * 🏆 PIVO 3.0 SSE Stream Simulator
 * 高保真模拟大模型 SSE 分片输出，支持物理延迟抖动。
 */
export interface SSESegment {
    content: string;
    delay?: number;
}

export class SSEStreamSimulator {
    /**
     * 将完整文本切割为随机大小的分片 (Token 级仿真)
     */
    static segmentize(text: string, minSize: number = 1, maxSize: number = 8): SSESegment[] {
        const segments: SSESegment[] = [];
        let remaining = text;

        while (remaining.length > 0) {
            const size = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
            segments.push({
                content: remaining.substring(0, size),
                delay: Math.random() * 20 + 5 // 5ms-25ms 的网络抖动
            });
            remaining = remaining.substring(size);
        }

        return segments;
    }

    /**
     * 🏆 核心：向浏览器物理层直接注入分片
     * 绕过复杂的 invoke 拦截，直接通过全局监听器列表发送数据。
     */
    static async push(page: Page, eventId: string, content: string) {
        const segments = this.segmentize(content);
        
        for (const seg of segments) {
            if (seg.delay) await new Promise(r => setTimeout(r, seg.delay));
            
            await page.evaluate(({ id, text }) => {
                const bridge = (window as any).__PIVO_BRIDGE__;
                if (bridge) {
                    // 🏆 直接注入控制器，绕过 Tauri 事件总线
                    bridge.push(id, { type: 'content', content: text });
                } else {
                    console.error('[Pivo3-Mock] ❌ Bridge not found!');
                }
            }, { id: eventId, text: seg.content });
        }
    }

    /**
     * 🏆 核心：发送结束信号
     */
    static async finalize(page: Page, eventId: string) {
        await page.evaluate(({ id }) => {
            const bridge = (window as any).__PIVO_BRIDGE__;
            if (bridge) bridge.finalize(id);
        }, { id: eventId });
    }
}
