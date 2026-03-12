import { Message } from '../stores/chatStore';
import { countMessagesTokens } from './tokenCounter';

/**
 * Intelligent message context selection (supports Token limits)
 * CORRECTED weight logic with System/Latest User exemption.
 */
export async function selectMessagesForContext(
    messages: Message[],
    maxMessages: number,
    model?: string,
    maxTokens?: number
): Promise<Message[]> {
    if (messages.length <= maxMessages && !maxTokens) {
        return messages;
    }

    interface ScoredMessage {
        message: Message;
        score: number;
        index: number;
        estimatedTokens: number;
    }

    const estimateTokens = (msg: Message): number => {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        if (!content || typeof content !== 'string') return 0;
        const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
        const otherChars = content.length - chineseChars;
        return Math.ceil((chineseChars / 2) + (otherChars / 4));
    };

    const scored: ScoredMessage[] = messages.map((msg, idx) => {
        let baseScore = 0;
        const positionFromEnd = messages.length - 1 - idx;
        const estimatedTokens = estimateTokens(msg);

        // 1. 基础分值
        if (msg.role === 'system') {
            baseScore = 5000; 
        } else if (msg.role === 'user' && positionFromEnd === 0) {
            baseScore = 4000; // 最新的用户消息
        } else if (msg.toolCalls && msg.toolCalls.length > 0) {
            baseScore = 800;
        } else if (msg.tool_call_id) {
            baseScore = 750;
        } else if ((msg as any).references && (msg as any).references.length > 0) {
            baseScore = 500;
        } else if (msg.role === 'user') {
            baseScore = 300;
        } else {
            baseScore = 100;
        }

        // 2. 衰减应用
        // 🏆 PIVO 3.0: 豁免机制 - System 和最新 User 消息严禁衰减
        let finalScore = baseScore;
        if (msg.role !== 'system' && positionFromEnd > 0) {
            const decayFactor = Math.pow(0.92, positionFromEnd);
            finalScore = baseScore * decayFactor;
        }
        
        return { message: msg, score: finalScore, index: idx, estimatedTokens };
    });

    // 排序并截断
    scored.sort((a, b) => b.score - a.score);
    let selected = scored.slice(0, maxMessages);

    // 完整性配对逻辑（保留）
    const selectedIndices = new Set(selected.map(s => s.index));
    const findAndAddPartner = (s: ScoredMessage) => {
        if (s.message.toolCalls) {
            for (let i = s.index + 1; i < messages.length; i++) {
                if (messages[i].tool_call_id && s.message.toolCalls?.some(tc => tc.id === messages[i].tool_call_id)) {
                    if (!selectedIndices.has(i)) {
                        selectedIndices.add(i);
                        selected.push({ message: messages[i], score: 750, index: i, estimatedTokens: estimateTokens(messages[i]) });
                    }
                }
            }
        }
        if (s.message.tool_call_id) {
            for (let i = s.index - 1; i >= 0; i--) {
                if (messages[i].toolCalls?.some(tc => tc.id === s.message.tool_call_id)) {
                    if (!selectedIndices.has(i)) {
                        selectedIndices.add(i);
                        selected.push({ message: messages[i], score: 800, index: i, estimatedTokens: estimateTokens(messages[i]) });
                    }
                    break;
                }
            }
        }
    };
    [...selected].forEach(findAndAddPartner);

    // Token 滑动窗口 (从后往前取)
    if (model && maxTokens) {
        let currentTokens = 0;
        selected.sort((a, b) => a.index - b.index);
        const windowSelected: typeof selected = [];
        
        // 🏆 PIVO 3.0: 必保系统消息和最后一条用户消息
        const systemMessages = selected.filter(s => s.message.role === 'system');
        windowSelected.push(...systemMessages);
        currentTokens += systemMessages.reduce((sum, s) => sum + s.estimatedTokens, 0);

        // 找回最后一条用户消息
        const userMessages = selected.filter(s => s.message.role === 'user');
        const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
        
        if (lastUserMessage && !windowSelected.some(s => s.index === lastUserMessage.index)) {
            windowSelected.push(lastUserMessage);
            currentTokens += lastUserMessage.estimatedTokens;
        }

        const windowIndices = new Set(windowSelected.map(s => s.index));
        for (let i = selected.length - 1; i >= 0; i--) {
            const s = selected[i];
            if (s.message.role === 'system' || windowIndices.has(s.index)) continue;
            if (currentTokens + s.estimatedTokens <= maxTokens * 0.95) {
                windowSelected.push(s);
                windowIndices.add(s.index);
                currentTokens += s.estimatedTokens;
            }
        }
        selected = windowSelected;
    }

    // 🏆 PIVO 3.0: 物理级安全检查
    // A. 确保工具调用配对完整 (防止 API 报错: Messages with role 'tool' must be a response to a preceding message with 'tool_calls')
    const toolResults = selected.filter(s => s.message.role === 'tool');
    for (const toolRes of toolResults) {
        const callId = toolRes.message.tool_call_id;
        const hasParent = selected.some(s => s.message.toolCalls?.some(tc => tc.id === callId));
        
        if (!hasParent) {
            // 强行找回对应的 Assistant 消息
            const parent = scored.find(s => s.message.toolCalls?.some(tc => tc.id === callId));
            if (parent) {
                console.log(`[ContextFilter] 🛡️ Pairing Recovery: Re-injecting assistant for tool_call_id ${callId}`);
                selected.push(parent);
            }
        }
    }

    // B. 确保最终结果中至少包含一条 User 消息 (如果有的话)
    const hasUser = selected.some(s => s.message.role === 'user');
    if (!hasUser) {
        const allUserMessages = scored.filter(s => s.message.role === 'user');
        if (allUserMessages.length > 0) {
            // 强行找回最后一条 User 消息
            const lastUser = allUserMessages[allUserMessages.length - 1];
            console.log(`[ContextFilter] 🛡️ Safety Recovery: Re-injecting last user message at index ${lastUser.index}`);
            selected.push(lastUser);
        }
    }

    return selected.sort((a, b) => a.index - b.index).map(s => s.message);
}
