import { describe, it, expect } from 'vitest';

/**
 * 🏆 v0.3.6 全局单例聚合 - 最终逻辑验证
 * 对齐 MessageItem.tsx 中的物理提升 (Hoisting) 算法
 */
function realMessageItemLogic(currentMsg: any, allMessages: any[]) {
    // 1. 模拟 segment 结构
    const segments = (currentMsg.toolCalls || []).map((tc: any) => ({
        type: 'tool',
        toolCallId: tc.id,
        batchId: tc.batchId
    }));

    const finalSegments: any[] = [];
    const seenBatches = new Set<string>();

    for (const segment of segments) {
        if (segment.type === 'tool' && segment.batchId) {
            // 🏆 核心逻辑：跨消息寻找最后一条包含该批次的消息
            const lastMsgWithThisBatch = [...allMessages].reverse().find(m => 
                m.role === 'assistant' && 
                m.toolCalls?.some((tc: any) => tc.batchId === segment.batchId)
            );

            // 如果当前消息不是最后一条，物理隐藏（返回空数组元素）
            if (lastMsgWithThisBatch && lastMsgWithThisBatch.id !== currentMsg.id) {
                continue; 
            }

            if (seenBatches.has(segment.batchId)) continue;
            seenBatches.add(segment.batchId);
            
            // 提取全量批次（跨消息）
            const batchCalls = allMessages.flatMap(m => 
                (m.toolCalls || []).filter((tc: any) => tc.batchId === segment.batchId)
            );

            finalSegments.push({
                ...segment,
                isBatchAnchor: true,
                batchCalls
            });
        }
    }
    return finalSegments;
}

describe('v0.3.6 全局单例聚合物理验证', () => {
  it('应物理隐藏旧消息中的卡片，并仅在最新消息中渲染全量聚合', () => {
    const batchId = 'batch_terminal_123';
    
    const history: any[] = [
      {
        id: 'msg-old',
        role: 'assistant',
        toolCalls: [{ id: 'c1', batchId, tool: 'agent_list_dir' }]
      },
      {
        id: 'msg-latest',
        role: 'assistant',
        toolCalls: [{ id: 'c2', batchId, tool: 'agent_read_file' }]
      }
    ];

    // 1. 验证旧消息：卡片应被隐藏（Empty Segments）
    const oldSegments = realMessageItemLogic(history[0], history);
    expect(oldSegments.length).toBe(0);

    // 2. 验证新消息：应包含全量 2 个工具调用
    const latestSegments = realMessageItemLogic(history[1], history);
    expect(latestSegments.length).toBe(1);
    expect(latestSegments[0].isBatchAnchor).toBe(true);
    expect(latestSegments[0].batchCalls.length).toBe(2);
    expect(latestSegments[0].batchCalls[0].id).toBe('c1');
    expect(latestSegments[0].batchCalls[1].id).toBe('c2');
  });
});
