/**
 * 🏆 PIVO 3.0: High-Fidelity Event Bus Mock
 * 支持 Tauri v2 的事件监听和广播。
 */

export async function listen<T = any>(
    event: string,
    handler: (event: { payload: T, id?: string }) => void
): Promise<() => void> {
    const listeners = (window as any).__TAURI_EVENT_LISTENERS__ || {};
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
    (window as any).__TAURI_EVENT_LISTENERS__ = listeners;

    console.log(`[PIVO3-Mock] 🛰️ Event Listening: ${event} (Current: ${listeners[event].length} listeners)`);

    return () => {
        const idx = listeners[event]?.indexOf(handler);
        if (idx > -1) listeners[event]?.splice(idx, 1);
    };
}

export async function emit(event: string, payload?: any): Promise<void> {
    const listeners = (window as any).__TAURI_EVENT_LISTENERS__?.[event] || [];
    listeners.forEach((fn: Function) => fn({ payload, id: event }));
}

export async function once<T = any>(
    event: string,
    handler: (event: { payload: T }) => void
): Promise<() => void> {
    const unlisten = await listen(event, (evt) => {
        handler(evt);
        unlisten();
    });
    return unlisten;
}
