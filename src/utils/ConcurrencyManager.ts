
/**
 * 并发管理器 (Semaphore)
 * 用于限制同时进行的异步操作数量，防止 LLM API 限流 (429)
 */
export class ConcurrencyManager {
    private maxConcurrent: number;
    private runningCount: number = 0;
    private queue: (() => void)[] = [];

    constructor(maxConcurrent: number = 5) {
        this.maxConcurrent = maxConcurrent;
    }

    /**
     * 执行异步任务，如果达到并发限制则排队
     * @param task 异步任务函数
     */
    async run<T>(task: () => Promise<T>): Promise<T> {
        if (this.runningCount >= this.maxConcurrent) {
            // 达到限制，进入队列等待
            await new Promise<void>(resolve => {
                this.queue.push(resolve);
            });
        }

        this.runningCount++;
        try {
            return await task();
        } finally {
            this.runningCount--;
            // 处理队列中的下一个任务
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                if (next) next();
            }
        }
    }

    /**
     * 当前运行中的任务数
     */
    getRunningCount(): number {
        return this.runningCount;
    }

    /**
     * 等待队列中的任务数
     */
    getQueueLength(): number {
        return this.queue.length;
    }
}

// 全局单例，默认限制并发为 5
export const globalConcurrencyManager = new ConcurrencyManager(5);
