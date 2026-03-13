import { Page } from '@playwright/test';

/**
 * 🏆 PIVO 3.0 Authoritative Wait SDK
 * 支持状态机轮询 (Store) 和 物理信号管线 (Pipeline) 双模等待。
 */
export class AuthoritativeWait {
    /**
     * [模式 1] 状态机轮询：等待 Store 进入特定状态
     */
    static async forChatStateInternal(
        page: Page,
        predicate: string | ((state: any, args?: any) => boolean),
        options: { timeout?: number, args?: any } = {}
    ) {
        const { timeout = 30000, args = {} } = options;
        const startTime = Date.now();
        
        // 🏆 PIVO 3.0: 物理级自动序列化
        const logicStr = typeof predicate === 'function' ? predicate.toString() : predicate;

        while (Date.now() - startTime < timeout) {
            const isMatch = await page.evaluate(({ logic, params }) => {
                const state = (window as any).__CHAT_STORE_STATE__;
                if (!state) return false;
                
                try {
                    // 如果 logic 是函数字符串，直接执行并传入参数
                    if (logic.trim().startsWith('(') || logic.trim().startsWith('state') || logic.trim().startsWith('async') || logic.trim().includes('=>')) {
                        const fn = eval(logic);
                        return fn(state, params);
                    }
                    const fn = new Function('state', 'args', `return (${logic})`);
                    return fn(state, params);
                } catch (e) {
                    return false;
                }
            }, { logic: logicStr, params: args });

            if (isMatch) return;
            await page.waitForTimeout(500);
        }

        throw new Error(`[AuthoritativeWait] Timeout waiting for Chat state: ${logicStr}`);
    }

    /**
     * [模式 2] 信号管线：等待特定的物理信号 (CustomEvent)
     */
    static async forPipelineSignal(
        page: Page,
        signalName: string,
        options: { timeout?: number } = {}
    ) {
        const { timeout = 30000 } = options;
        
        const signalFound = await page.evaluate(({ name, t }) => {
            return new Promise((resolve) => {
                if ((window as any).__PIVO_SIGNALS__?.[name]) return resolve(true);

                const handler = () => {
                    window.removeEventListener(name, handler);
                    resolve(true);
                };
                window.addEventListener(name, handler);
                setTimeout(() => resolve(false), t - 1000); 
            });
        }, { name: signalName, t: timeout });

        if (!signalFound) {
            throw new Error(`[AuthoritativeWait] Timeout waiting for pipeline signal: ${signalName}`);
        }
    }

    static async forPersistenceHydrated(page: Page, options?: { timeout?: number }) {
        await this.forPipelineSignal(page, 'ifainew:persistence-hydrated', options);
    }

    /**
     * 等待流式响应物理结束
     */
    static async forStreamComplete(page: Page, options?: { timeout?: number }) {
        await this.forPipelineSignal(page, 'ifainew:stream-finished', options);
    }

    /**
     * 🏆 PIVO 3.0: 等待任务树中出现特定任务
     */
    static async forPivoTask(page: Page, taskLabel: string, options: { timeout?: number } = {}) {
        const { timeout = 20000 } = options;
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const found = await page.evaluate((label) => {
                // 安全获取 Pivo Store
                const store = (window as any).__pivoStore;
                if (!store || typeof store.getState !== 'function') return false;
                
                const tasks = store.getState().taskTrees;
                if (!tasks) return false;

                return Object.values(tasks).some((tree: any) => {
                    if (!Array.isArray(tree)) return false;
                    return tree.some((t: any) => t && t.label && String(t.label).includes(label));
                });
            }, taskLabel);

            if (found) return;
            await page.waitForTimeout(500);
        }
        throw new Error(`[AuthoritativeWait] Timeout waiting for Pivo Task: ${taskLabel}`);
    }

    /**
     * 物理级消息匹配 (Authoritative)
     */
    static async forMessage(page: Page, predicate: string, options?: { timeout?: number }) {
        // 🏆 PIVO 3.0: 修正调用路径，使用字符串表达式以防止闭包丢失
        await this.forChatStateInternal(page, `(state) => {
            const messages = state.messages || [];
            const fn = ${predicate};
            return fn(messages);
        }`, options);
    }
}
