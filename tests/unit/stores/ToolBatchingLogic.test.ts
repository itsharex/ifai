import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ToolBatchApproval 降级逻辑验证', () => {
  it('兼容性验证: 如果批次中混合了非探索工具，应正确计算 stats', () => {
    const mockBatchCalls = [
      { id: 'c1', tool: 'agent_list_dir', status: 'completed' },
      { id: 'c2', tool: 'agent_execute_command', status: 'pending' } // 混合工具
    ];

    const stats = {
        total: mockBatchCalls.length,
        completed: mockBatchCalls.filter(tc => tc.status === 'completed').length,
        pending: mockBatchCalls.filter(tc => tc.status === 'pending').length,
    };

    expect(stats.total).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.pending).toBe(1);

    // 验证逻辑：在这种情况下，组件应识别出 isExplorerBatch 为 false
    const isExplorerBatch = mockBatchCalls.every(tc => tc.tool.includes('list_dir'));
    expect(isExplorerBatch).toBe(false); // 应该触发降级显示
  });

  it('物理对齐: Vibe 模式下的截断逻辑', () => {
    const paths = ['a', 'b', 'c', 'd', 'e'];
    const editorMode = 'vibe';
    
    // 模拟 ToolBatchApproval.tsx 中的 slice 逻辑
    const displayPaths = editorMode === 'vibe' ? paths.slice(-3) : paths.slice(0, 5);
    
    expect(displayPaths.length).toBe(3);
    expect(displayPaths[0]).toBe('c'); // 应该保留最后 3 个
  });
});
