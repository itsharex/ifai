import { vi, describe, it, expect, beforeEach } from 'vitest';
import { InlineSyncService } from '../InlineSyncService';
import { IInlineEditStore, IStoreInstance } from '../../interfaces/ICoreChatStore';

describe('InlineSyncService', () => {
  let mockInlineEditStore: IStoreInstance<IInlineEditStore>;
  let mockState: IInlineEditStore;

  beforeEach(() => {
    mockState = {
      isInlineEditVisible: true,
      pivoStage: 'idle',
      modifiedCode: '',
      pivoTasks: []
    };

    mockInlineEditStore = {
      getState: vi.fn(() => mockState),
      setState: vi.fn((updateFn) => {
        const update = typeof updateFn === 'function' ? updateFn(mockState) : updateFn;
        mockState = { ...mockState, ...update };
      }),
      subscribe: vi.fn()
    };

    // Mock global window object
    (window as any).__inlineEditStore = mockInlineEditStore;
  });

  it('应该在规划阶段从文本分片中提取任务', () => {
    mockState.pivoStage = 'plan';
    
    InlineSyncService.syncState('', '', '首先我将读取文件内容。');
    
    expect(mockInlineEditStore.setState).toHaveBeenCalled();
    expect(mockState.pivoTasks.length).toBe(1);
    expect(mockState.pivoTasks[0].description).toBe('读取文件内容');
    expect(mockState.pivoStage).toBe('plan');
  });

  it('应该在工具调用时切换到执行阶段并添加任务', () => {
    InlineSyncService.syncState('agent_read_file', '', '');
    
    expect(mockState.pivoStage).toBe('implement');
    expect(mockState.pivoTasks.length).toBe(1);
    expect(mockState.pivoTasks[0].description).toBe('读取关联上下文');
    expect(mockState.pivoTasks[0].status).toBe('running');
  });

  it('应该在工具执行时同步代码', () => {
    InlineSyncService.syncState('agent_write_file', 'const a = 1;', '');
    
    expect(mockState.modifiedCode).toBe('const a = 1;');
    expect(mockState.pivoStage).toBe('implement');
  });

  it('应该标记之前的运行任务为成功并添加新工具任务', () => {
    mockState.pivoTasks = [{ id: 'task_1', description: '旧任务', status: 'running', stage: 'implement' }];
    
    InlineSyncService.syncState('agent_write_file', '', '');
    
    expect(mockState.pivoTasks.length).toBe(2);
    expect(mockState.pivoTasks[0].status).toBe('success');
    expect(mockState.pivoTasks[1].description).toBe('正在编写优化代码');
    expect(mockState.pivoTasks[1].status).toBe('running');
  });

  it('如果 Inline Widget 不可见，则不应该更新状态', () => {
    mockState.isInlineEditVisible = false;
    
    InlineSyncService.syncState('', '', '我将执行任务');
    
    expect(mockInlineEditStore.setState).not.toHaveBeenCalled();
  });
});
