import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePivoStore } from '../pivoStore';

describe('usePivoStore', () => {
  beforeEach(() => {
    usePivoStore.setState({ taskTrees: {} });
  });

  it('应该能够正确初始化任务树', () => {
    const messageId = 'msg-1';
    const mockTasks: any[] = [
      { id: 'task-1', label: '任务 1', status: 'pending', children: [] }
    ];

    usePivoStore.getState().setTaskTree(messageId, mockTasks);
    
    expect(usePivoStore.getState().taskTrees[messageId]).toEqual(mockTasks);
  });

  it('应该能够递归更新任务状态', () => {
    const messageId = 'msg-1';
    const mockTasks: any[] = [
      { 
        id: 'parent-1', 
        label: '父任务', 
        status: 'pending', 
        children: [
          { id: 'child-1', label: '子任务', status: 'pending', children: [] }
        ] 
      }
    ];

    usePivoStore.getState().setTaskTree(messageId, mockTasks);
    
    // 更新子任务状态
    usePivoStore.getState().updateTaskStatus(messageId, 'child-1', 'success');
    
    const tasks = usePivoStore.getState().taskTrees[messageId];
    expect(tasks[0].children[0].status).toBe('success');
    // 父任务状态不应改变（除非后续有组合逻辑）
    expect(tasks[0].status).toBe('pending');
  });

  it('在任务不存在时，updateTaskStatus 不应报错', () => {
    expect(() => {
      usePivoStore.getState().updateTaskStatus('non-existent', 'any', 'success');
    }).not.toThrow();
  });
});
