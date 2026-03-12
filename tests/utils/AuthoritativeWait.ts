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
        predicate: string | ((state: any) => boolean),
        options: { timeout?: number } = {}
    ) {
        const { timeout = 30000 } = options;
        const startTime = Date.now();
        
        // 🏆 PIVO 3.0: 物理级自动序列化
        const logicStr = typeof predicate === 'function' ? predicate.toString() : predicate;

        while (Date.now() - startTime < timeout) {
            const isMatch = await page.evaluate((logic) => {
                const state = (window as any).__CHAT_STORE_STATE__;
                if (!state) return false;
                
                try {
                    // 如果 logic 是函数字符串 (state => ...)，直接执行
                    if (logic.trim().startsWith('(') || logic.trim().startsWith('state') || logic.trim().startsWith('async') || logic.trim().includes('=>')) {
                        const fn = eval(logic);
                        return fn(state);
                    }
                    // 否则作为简易表达式执行
                    const fn = new Function('state', `return (${logic})`);
                    return fn(state);
                } catch (e) {
                    return false;
                }
            }, logicStr);

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
        
        const signalFound = await page.evaluate((name) => {
            return new Promise((resolve) => {
                if ((window as any).__PIVO_SIGNALS__?.[name]) return resolve(true);

                const handler = () => {
                    window.removeEventListener(name, handler);
                    resolve(true);
                };
                window.addEventListener(name, handler);
                setTimeout(() => resolve(false), 29000); 
            });
        }, signalName);

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
