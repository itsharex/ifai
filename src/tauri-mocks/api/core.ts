/**
 * 🏆 PIVO 3.0: Tauri v2 Protocol Fidelity Layer (Enhanced)
 * 
 * 全面补全 Tauri v2 的内部契约，防止 React 生命周期中的清理函数报错。
 */

console.log('[PIVO3-Mock] 🛡️ Initializing Enhanced Tauri v2 Protocol Fidelity Layer...');

export const SERIALIZE_TO_IPC_FN = Symbol('SERIALIZE_TO_IPC_FN');

/**
 * 核心：模拟 Tauri v2 的 transformCallback
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
    
    // 基础物理返回兜底
    if (cmd.includes('get_config')) return { providers: [] } as any;
    if (cmd === 'get_git_statuses') return [] as any;
    return {} as T;
}

/**
 * 核心：模拟 Tauri v2 的 unregisterListener (关键修复)
 */
export async function unregisterListener(id: number): Promise<void> {
    console.log(`[PIVO3-Mock] 🧹 Unregistering listener: ${id}`);
    if (typeof window !== 'undefined') {
        delete (window as any).__TAURI_EVENT_LISTENERS__?.[`callback_${id}`];
    }
}

// 🏆 物理欺骗层 (Environment Spoofing)
if (typeof window !== 'undefined') {
    (window as any).__TAURI_INTERNALS__ = {
        transformCallback,
        invoke,
        unregisterListener, // 注入关键方法
        metadata: {
            app: { name: 'IfAI', version: '0.3.8' },
            os: { name: 'darwin' }
        },
        // 伪造 currentWindow
        window: {
            label: 'main',
            currentWindow: () => (window as any).__TAURI_INTERNALS__.window
        }
    };

    (window as any).__TAURI__ = {
        core: { invoke, transformCallback, unregisterListener },
        window: (window as any).__TAURI_INTERNALS__.window,
        event: {
            listen: (event: string, handler: any) => {
                const listeners = (window as any).__TAURI_EVENT_LISTENERS__ || {};
                if (!listeners[event]) listeners[event] = [];
                listeners[event].push(handler);
                (window as any).__TAURI_EVENT_LISTENERS__ = listeners;
                return Promise.resolve(() => unregisterListener(0));
            }
        }
    };
    
    console.log('[PIVO3-Mock] ✅ window.__TAURI_INTERNALS__ full spoofing complete.');
}

export class Channel<T = unknown> {
    id: number;
    constructor(onmessage?: (response: T) => void) { this.id = transformCallback(onmessage); }
    [SERIALIZE_TO_IPC_FN](): string { return String(this.id); }
    toJSON(): string { return String(this.id); }
}

export function isTauri(): boolean { return true; }
export function convertFileSrc(p: string): string { return p; }
