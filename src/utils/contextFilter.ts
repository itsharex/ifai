import { Message } from '../stores/chatStore';
import { countMessagesTokens } from './tokenCounter';

/**
 * Intelligent message context selection (supports Token limits)
 * Retains system messages, recent messages, and historical messages containing critical content.
 * 100% Fidelity migration from useChatStore.ts
 */
export async function selectMessagesForContext(
    messages: Message[],
    maxMessages: number,
    model?: string,
    maxTokens?: number
): Promise<Message[]> {
    // 1. If total messages are within limit, return directly
    if (messages.length <= maxMessages) {
        return messages;
    }

    // 2. Calculate priority scores for each message
    interface ScoredMessage {
        message: Message;
        score: number;
        index: number;
        estimatedTokens: number;
    }

    // Token estimation function (avoids frequent backend calls)
    const estimateTokens = (msg: Message): number => {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        if (!content || typeof content !== 'string') return 0;
        const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
        const otherChars = content.length - chineseChars;
        return Math.ceil((chineseChars / 2) + (otherChars / 4));
    };

    const scored: ScoredMessage[] = messages.map((msg, idx) => {
        let score = 0;
        const positionFromEnd = messages.length - 1 - idx;
        const estimatedTokens = estimateTokens(msg);

        if (msg.role === 'system') {
            score = 1000;
        } else if (msg.toolCalls && msg.toolCalls.length > 0) {
            score = 500;
        } else if (msg.tool_call_id) {
            score = 450;
        } else if ((msg as any).references && (msg as any).references.length > 0) {
            score = 300;
        } else if (msg.role === 'user') {
            score = 100;
        } else if (msg.role === 'assistant') {
            score = 50;
        }

        const decayFactor = Math.pow(1.1, positionFromEnd);
        score = score * decayFactor;
        return { message: msg, score, index: idx, estimatedTokens };
    });

    // 3. Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    let selected = scored.slice(0, maxMessages);

    // 4. Integrity check: ensure tool_calls and tool_call_id pairs
    const selectedIndices = new Set(selected.map(s => s.index));

    // 4a. Check tool_calls responses
    selected.forEach(s => {
        if (s.message.toolCalls && s.message.toolCalls.length > 0) {
            for (let i = s.index + 1; i < messages.length; i++) {
                const responseMsg = messages[i];
                if (responseMsg.tool_call_id) {
                    const belongsToCurrent = s.message.toolCalls?.some(tc => tc.id === responseMsg.tool_call_id);
                    if (belongsToCurrent && !selectedIndices.has(i)) {
                        selectedIndices.add(i);
                        selected.push({
                            message: responseMsg,
                            score: 450,
                            index: i,
                            estimatedTokens: estimateTokens(responseMsg)
                        });
                    }
                }
            }
        }
    });

    // 4b. Check tool responses requests
    selected.forEach(s => {
        if (s.message.tool_call_id) {
            for (let i = s.index - 1; i >= 0; i--) {
                const requestMsg = messages[i];
                if (requestMsg.toolCalls && requestMsg.toolCalls.some(tc => tc.id === s.message.tool_call_id)) {
                    if (!selectedIndices.has(i)) {
                        selectedIndices.add(i);
                        selected.push({
                            message: requestMsg,
                            score: 500,
                            index: i,
                            estimatedTokens: estimateTokens(requestMsg)
                        });
                    }
                    break;
                }
            }
        }
    });

    // 5. Token limit check (sliding window)
    if (model && maxTokens) {
        const totalTokens = selected.reduce((sum, s) => sum + s.estimatedTokens, 0);
        if (totalTokens > maxTokens) {
            const maxTokenLimit = maxTokens * 0.9;
            selected.sort((a, b) => a.index - b.index);
            
            let windowSelected: typeof selected = [];
            let currentTokens = 0;
            
            const systemMessages = selected.filter(s => s.message.role === 'system');
            windowSelected.push(...systemMessages);
            currentTokens += systemMessages.reduce((sum, s) => sum + s.estimatedTokens, 0);

            const windowIndices = new Set(windowSelected.map(s => s.index));
            for (let i = selected.length - 1; i >= 0; i--) {
                const s = selected[i];
                if (s.message.role === 'system' || windowIndices.has(s.index)) continue;

                if (currentTokens + s.estimatedTokens <= maxTokenLimit) {
                    windowSelected.push(s);
                    windowIndices.add(s.index);
                    currentTokens += s.estimatedTokens;

                    if (s.message.tool_call_id) {
                        const partner = selected.find(p => p.message.toolCalls && p.message.toolCalls.some(tc => tc.id === s.message.tool_call_id));
                        if (partner && !windowIndices.has(partner.index)) {
                            windowSelected.push(partner);
                            windowIndices.add(partner.index);
                            currentTokens += partner.estimatedTokens;
                        }
                    }

                    if (s.message.toolCalls && s.message.toolCalls.length > 0) {
                        const partners = selected.filter(p => p.message.tool_call_id && s.message.toolCalls?.some(tc => tc.id === p.message.tool_call_id));
                        for (const p of partners) {
                            if (!windowIndices.has(p.index)) {
                                windowSelected.push(p);
                                windowIndices.add(p.index);
                                currentTokens += p.estimatedTokens;
                            }
                        }
                    }
                } else if (windowSelected.length < systemMessages.length + 3) {
                    windowSelected.push(s);
                    windowIndices.add(s.index);
                    currentTokens += s.estimatedTokens;
                }
            }
            windowSelected.sort((a, b) => a.index - b.index);
            selected = windowSelected;
        }
    }

    selected.sort((a, b) => a.index - b.index);
    return selected.map(s => s.message).filter(msg => {
        if (msg.role === 'tool' && (!msg.tool_call_id || msg.tool_call_id.trim() === '')) {
            return false;
        }
        return true;
    });
}
