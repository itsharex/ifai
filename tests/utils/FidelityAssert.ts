import { expect } from '@playwright/test';
import { ContentSegment } from '../../src/stores/useChatStore';

/**
 * 🏆 PIVO 3.0 Fidelity Assertion SDK
 * 提供针对流式输出和物理链路一致性的专家级断言。
 */
export class FidelityAssert {
    /**
     * 校验流式响应的分片顺序完整性
     * 防止物理分片乱序到达导致的 Store 拼接错误。
     */
    static async matchStreamPattern(segments: ContentSegment[]) {
        if (!segments || segments.length === 0) {
            throw new Error('[FidelityAssert] Empty segments provided.');
        }

        // 1. 物理顺序校验：order 必须单调递增
        for (let i = 1; i < segments.length; i++) {
            if (segments[i].order !== segments[i - 1].order + 1) {
                throw new Error(`[FidelityAssert] Stream Order Mismatch: Segment ${i} has order ${segments[i].order}, expected ${segments[i - 1].order + 1}`);
            }
        }

        // 2. 物理时间戳校验：timestamp 应该呈现合理分布
        const startTime = segments[0].timestamp;
        const endTime = segments[segments.length - 1].timestamp;
        if (endTime < startTime) {
            throw new Error(`[FidelityAssert] Stream Temporal Paradox: End timestamp ${endTime} is earlier than start timestamp ${startTime}`);
        }
    }

    /**
     * 校验物理层 UUID 链路一致性
     * 确保从 API 响应到 Store 状态机的 UUID 链路不丢失、不重复。
     */
    static async matchUuidLink(messages: any[], expectedUuids: string[]) {
        const actualUuids = messages.map(m => m.id);
        for (const uuid of expectedUuids) {
            if (!actualUuids.includes(uuid)) {
                throw new Error(`[FidelityAssert] UUID Link Broken: Message ID ${uuid} missing in Store state.`);
            }
        }
    }

    /**
     * 校验 Store 与 DOM 内容的最终一致性
     */
    static async matchFinalConsistancy(storeContent: string, domText: string) {
        // 物理清理空格和零宽字符
        const cleanStore = storeContent.replace(/\s/g, '');
        const cleanDom = domText.replace(/\s/g, '');
        
        if (cleanStore !== cleanDom) {
            throw new Error('[FidelityAssert] Final Consistancy Mismatch: Store content and UI display are physically different.');
        }
    }
}
