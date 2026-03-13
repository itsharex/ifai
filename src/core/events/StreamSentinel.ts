import { GlobalEventBus } from './GlobalEventBus';

/**
 * 🏆 PIVO 3.0 流式链路哨兵 (Stream Sentinel)
 * 职责：实时监控流式响应的健康度，检测物理假死并分发自愈信号。
 */
export class StreamSentinel {
    private bus: GlobalEventBus;
    private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private readonly STALL_THRESHOLD = 5000; // 5秒物理阈值

    constructor(bus: GlobalEventBus) {
        this.bus = bus;
        this.init();
    }

    private init() {
        // 监听流开始
        this.bus.on('stream:start', (payload: { id: string }) => {
            this.resetTimer(payload.id);
        });

        // 监听活跃信号 (数据块或物理心跳)
        this.bus.on('stream:chunk', (payload: { id: string }) => {
            this.resetTimer(payload.id);
        });

        this.bus.on('stream:heartbeat', (payload: { id: string }) => {
            this.resetTimer(payload.id);
        });

        // 监听流终结
        this.bus.on('stream:finish', (payload: { id: string }) => {
            this.clearTimer(payload.id);
        });

        this.bus.on('stream:error', (payload: { id: string }) => {
            this.clearTimer(payload.id);
        });

        // 调试辅助
        this.bus.on('test:reset', () => {
            this.timers.forEach((_, id) => this.clearTimer(id));
            this.timers.clear();
        });
    }

    private resetTimer(id: string) {
        this.clearTimer(id);
        
        const timer = setTimeout(() => {
            console.warn(`[Sentinel] 🛡️ Stream physical stall detected: ${id}. No response for ${this.STALL_THRESHOLD}ms.`);
            
            // 🏆 PIVO 3.0: 物理信号存根 (用于 E2E 测试环境)
            if (typeof window !== 'undefined') {
                if (!(window as any).__PIVO_SIGNALS__) (window as any).__PIVO_SIGNALS__ = {};
                (window as any).__PIVO_SIGNALS__['stream:stalled'] = { id, timestamp: Date.now() };
            }

            this.bus.emit('stream:stalled', { 
                id, 
                timestamp: Date.now(),
                reason: 'timeout' 
            });
        }, this.STALL_THRESHOLD);

        this.timers.set(id, timer);
    }

    private clearTimer(id: string) {
        if (this.timers.has(id)) {
            clearTimeout(this.timers.get(id));
            this.timers.delete(id);
        }
    }
}
