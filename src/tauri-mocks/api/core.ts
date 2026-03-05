/**
 * 🏆 PIVO 3.0: Tauri v2 Protocol Fidelity Layer
 * 
 * 此模块不仅是 Mock，它通过伪造 window.__TAURI_INTERNALS__ 协议层，
 * 能够欺骗真实的 @tauri-apps/api/v2 库在 Playwright 环境下正常运行。
 */

console.log('[PIVO3-Mock] 🛡️ Initializing Tauri v2 Protocol Fidelity Layer...');

/**
 * 核心：模拟 Tauri v2 的 transformCallback
 * 这是 @tauri-apps/api 内部调用的关键函数
 */
export function transformCallback<T = unknown>(callback?: (response: T) => void, once?: boolean): number {
    const id = Math.floor(Math.random() * 1000000);
    if (callback && typeof window !== 'undefined') {
        const listeners = (window as any).__TAURI_EVENT_LISTENERS__ || {};
        listeners[`callback_${id}`] = [callback];
        (window as any).__TAURI_EVENT_LISTENERS__ = listeners;
    }
    return id;
}

/**
 * 核心：模拟 Tauri v2 的 invoke
 */
export async function invoke<T = any>(cmd: string, args?: any): Promise<T> {
    console.log(`[PIVO3-Mock] 📞 IPC Invoke: ${cmd}`, args);
    const handler = (window as any).__E2E_INVOKE_HANDLER__;
    if (handler) return handler(cmd, args);
    
    // 默认兜底：有些命令需要特定的物理返回
    if (cmd === 'get_git_statuses') return [] as any;
    return {} as T;
}

// 🏆 物理欺骗层 (Environment Spoofing)
if (typeof window !== 'undefined') {
    // 1. 伪造 Tauri Internals (针对 v2)
    (window as any).__TAURI_INTERNALS__ = {
        transformCallback,
        invoke,
        metadata: {
            app: { name: 'IfAI', version: '0.3.8' },
            os: { name: 'darwin', version: '15.0' }
        }
    };

    // 2. 伪造 Tauri Namespace (兼容旧版或第三方库)
    (window as any).__TAURI__ = {
        core: { invoke, transformCallback },
        event: {
            listen: (event: string, handler: any) => {
                const listeners = (window as any).__TAURI_EVENT_LISTENERS__ || {};
                if (!listeners[event]) listeners[event] = [];
                listeners[event].push(handler);
                (window as any).__TAURI_EVENT_LISTENERS__ = listeners;
                return Promise.resolve(() => {});
            }
        }
    };
    
    console.log('[PIVO3-Mock] ✅ window.__TAURI_INTERNALS__ and __TAURI__ spoofed.');
}

export const SERIALIZE_TO_IPC_FN = Symbol('SERIALIZE_TO_IPC_FN');

export class Channel<T = unknown> {
    id: number;
    constructor(onmessage?: (response: T) => void) { this.id = transformCallback(onmessage); }
    [SERIALIZE_TO_IPC_FN](): string { return String(this.id); }
    toJSON(): string { return String(this.id); }
}

export function isTauri(): boolean { return true; } // 欺骗库认为这是 Tauri 环境
export function convertFileSrc(p: string): string { return p; }
