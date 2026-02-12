import { describe, it, expect, beforeEach } from 'vitest';

// 模拟 MessageItem.tsx 中的核心聚合算法
function simulateMergedSegments(message: any, editorMode: string) {
    const aggregatableTools = ['agent_list_dir', 'agent_read_file', 'agent_search', 'list_dir', 'read_file', 'agent_list_directory', 'List Directory'];
    
    // A. 模拟 untracked 逻辑 (截图中的情况)
    const segments = (message.toolCalls || []).map((tc: any) => ({
        type: 'tool',
        toolCallId: tc.id,
        order: 999
    }));

    // B. 模拟聚合逻辑 (v0.3.6 G 步骤)
    const finalSegments: any[] = [];
    const seenBatches = new Set<string>();

    for (const segment of segments) {
        const toolCall = message.toolCalls?.find((tc: any) => tc.id === segment.toolCallId);
        const batchId = (toolCall as any)?.batchId;

        if (batchId) {
            if (seenBatches.has(batchId)) continue;
            seenBatches.add(batchId);
            finalSegments.push({ ...segment, isBatchAnchor: true, batchId });
        } else {
            finalSegments.push(segment);
        }
    }
    return finalSegments;
}

describe('v0.3.6 跨消息聚合 Bug 还原', () => {
  it('Bug 还原: 即使工具名称是 "List Directory"，也应该被正确分配 batchId 并聚合', () => {
    // 模拟第二轮消息的状态
    const toolNameFromScreenshot = "List Directory";
    
    const mockMessage = {
      id: 'msg-2',
      role: 'assistant',
      toolCalls: [
        { 
            id: 'c2', 
            tool: toolNameFromScreenshot, 
            status: 'pending', 
            // 模拟 Bug：如果这个字段因为名称不匹配没被分配 batchId
            batchId: undefined 
        }
      ]
    };

    const segments = simulateMergedSegments(mockMessage, 'vibe');
    
    // 验证 Bug 现场：如果没有 batchId，段落数量是 1，但 isBatchAnchor 是 false
    // 这将导致渲染独立的 ToolApproval 而非 ToolBatchApproval
    expect(segments[0].isBatchAnchor).toBeFalsy(); 
  });
});
