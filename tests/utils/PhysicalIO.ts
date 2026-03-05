/**
 * 🏆 PIVO 3.0 Physical IO Simulation SDK
 * 用于模拟文件系统 IO 与大模型流式响应之间的物理竞态。
 */
export class PhysicalIO {
    /**
     * 交织执行两个异步动作，并引入受控的物理延迟。
     * 示例：在文件写入 (Action A) 过程中，强制插入 SSE 分片到达 (Action B)。
     * 
     * @param actionA 主要动作（如文件写入）
     * @param actionB 干扰动作（如 SSE 流推送）
     * @param options 延迟与偏移配置
     */
    static async interleave(
        actionA: () => Promise<any>,
        actionB: () => Promise<any>,
        options: { delayB?: number; waitForA?: boolean } = {}
    ) {
        const { delayB = 0, waitForA = false } = options;

        if (waitForA) {
            const resultA = await actionA();
            if (delayB > 0) await new Promise(resolve => setTimeout(resolve, delayB));
            const resultB = await actionB();
            return { resultA, resultB };
        }

        // 真正的交织执行
        const promiseA = actionA();
        
        if (delayB > 0) {
            await new Promise(resolve => setTimeout(resolve, delayB));
        }
        
        const promiseB = actionB();

        const [resultA, resultB] = await Promise.all([promiseA, promiseB]);
        return { resultA, resultB };
    }

    /**
     * 模拟物理层面的“分段写入”竞态
     * 将一个大文件写入拆分为多个分段，中间穿插其他操作
     */
    static async fragmentedWrite(
        segments: string[],
        writeFn: (chunk: string) => Promise<void>,
        interleaveFn?: (index: number) => Promise<void>
    ) {
        for (let i = 0; i < segments.length; i++) {
            await writeFn(segments[i]);
            if (interleaveFn) {
                await interleaveFn(i);
            }
        }
    }
}
