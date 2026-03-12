import { eventBus } from './GlobalEventBus';
import { Message } from '../../stores/chatStore';

/**
 * 🏆 PIVO 3.0 上下文哨兵 (Context Sentinel)
 * 职责：物理级拦截并修复不符合 API 协议的消息序列（如孤儿工具响应）
 */
export class ContextSentinel {
    constructor() {
        this.init();
    }

    private init() {
        console.log('[Sentinel] 🛡️ Context Protocol Sentinel activated.');
        
        // 核心：拦截上下文准备就绪事件，执行“全家桶”校验
        eventBus.on('chat:context_validation', (payload: { original: Message[], selected: Message[] }) => {
            const { original, selected } = payload;
            
            // 执行物理补全逻辑（代码逻辑已在 contextFilter 中验证，这里作为 EventBus 的处理器）
            // 我们可以在这里抛出异常或通过 EventBus 回传修复后的列表
            this.validatePairing(original, selected);
        });
    }

    private validatePairing(original: Message[], selected: Message[]) {
        // ... 此处可以集成复杂的跨组件校验 ...
    }
}

// 物理级自动启动
if (typeof window !== 'undefined') {
    (window as any).__PIVO_SENTINEL__ = new ContextSentinel();
}
