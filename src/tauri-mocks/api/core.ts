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
    
    // 🏆 PIVO 3.0: 高保真探测模拟
    if (cmd === 'probe_symbols') {
        if (handler) {
            // 尝试从 E2E 环境获取文件的 Mock 内容并提取符号
            try {
                const content = await handler('agent_read_file', { rel_path: args.path });
                if (content && typeof content === 'string') {
                    return mockExtractSymbols(content) as any;
                }
            } catch (e) {}
        }
        // 默认返回基础符号（针对 settingsStore 等核心文件）
        if (args.path?.includes('settingsStore')) {
            return [
                { name: 'SettingsState', kind: 'interface', line: 50, context: 'export interface SettingsState' },
                { name: 'useSettingsStore', kind: 'variable', line: 150, context: 'export const useSettingsStore = ...' }
            ] as any;
        }
        return [] as any;
    }

    if (cmd === 'get_file_metadata') {
        return { size: 1024, mtime: Date.now(), fingerprint: `mock_${Date.now()}` } as any;
    }

    if (handler) return handler(cmd, args);
    
    // 默认兜底
    if (cmd.includes('get_config')) return { providers: [] } as any;
    if (cmd === 'get_git_statuses') return [] as any;
    return {} as T;
}

/**
 * 🏆 PIVO 3.0: JS 版高保真符号提取器 (仅用于 Mock)
 */
function mockExtractSymbols(content: string): any[] {
    const lines = content.split('\n');
    const symbols: any[] = [];
    const patterns = [
        { type: 'class', regex: /(?:export\s+)?class\s+([a-zA-Z0-9_]+)/ },
        { type: 'function', regex: /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/ },
        { type: 'interface', regex: /(?:export\s+)?interface\s+([a-zA-Z0-9_]+)/ },
        { type: 'variable', regex: /export\s+(?:const|let)\s+([a-zA-Z0-9_]+)/ }
    ];

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        for (const p of patterns) {
            const match = trimmed.match(p.regex);
            if (match) {
                symbols.push({
                    name: match[1],
                    kind: p.type,
                    line: i + 1,
                    context: trimmed
                });
                break;
            }
        }
    });
    return symbols;
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
