import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInlineEditStore } from '../inlineEditStore';

// 模拟全局对象，因为同步逻辑使用了 window.__inlineEditStore
const mockInlineStore = {
  getState: () => useInlineEditStore.getState(),
  setState: (state: any) => useInlineEditStore.setState(state),
};

if (typeof window !== 'undefined') {
  (window as any).__inlineEditStore = mockInlineStore;
}

// 模拟同步函数（我们刚才在 useChatStore 中实现的逻辑核心）
function simulateSyncLogic(message: any, toolName: string, content: string, textChunk?: string) {
  const inlineStore = (window as any).__inlineEditStore;
  if (inlineStore && inlineStore.getState().isInlineEditVisible) {
    const state = inlineStore.getState();
    const currentTasks = [...(state.pivoTasks || [])];

    // 模拟文本启发式提取
    if (textChunk && state.pivoStage === 'plan') {
      const planMatch = textChunk.match(/(?:我将|首先|接着|然后|最后|开始)\s*(.*?)(?:。| |\n|$)/);
      if (planMatch && planMatch[1].length > 2) {
        currentTasks.push({
          id: `task_${Date.now()}`,
          description: planMatch[1].trim(),
          status: 'running',
          stage: 'plan'
        });
      }
    }

    // 模拟工具映射
    if (toolName) {
      currentTasks.forEach(t => { if (t.status === 'running') t.status = 'success'; });
      currentTasks.push({
        id: `tool_${Date.now()}`,
        description: toolName.includes('read') ? '读取关联上下文' : '正在编写优化代码',
        status: 'running',
        stage: 'implement'
      });
    }

    inlineStore.setState({ 
      pivoStage: toolName ? 'implement' : (textChunk ? 'plan' : state.pivoStage),
      modifiedCode: content || state.modifiedCode,
      pivoTasks: currentTasks
    });
  }
}

describe('PIVO 流式同步逻辑 (红绿测试)', () => {
  beforeEach(() => {
    // 重置 Store 状态
    useInlineEditStore.setState({
      isInlineEditVisible: false,
      pivoStage: 'idle',
      modifiedCode: '',
    });
  });

  it('🔴 红：如果面板不可见，不应触发同步', () => {
    const mockMsg = { isInlineTask: true };
    simulateSyncLogic(mockMsg, 'agent_write_file', 'new code');
    
    expect(useInlineEditStore.getState().pivoStage).toBe('idle');
  });

  it('🟢 绿：如果面板可见且是 Inline 任务，应立即进入 Implement 阶段', () => {
    // 模拟用户按下 Cmd+K
    useInlineEditStore.setState({ isInlineEditVisible: true, pivoStage: 'plan' });
    
    const mockMsg = { isInlineTask: true };
    
    // 模拟 AI 开始调用工具（哪怕内容还是空的）
    simulateSyncLogic(mockMsg, 'agent_write_file', '');
    
    expect(useInlineEditStore.getState().pivoStage).toBe('implement');
  });

  it('🟢 绿：处理“阶段已进入但代码尚为空”的中间态', () => {
    useInlineEditStore.setState({ isInlineEditVisible: true, pivoStage: 'plan' });
    const mockMsg = { isInlineTask: true };
    
    // 模拟工具名刚解析出来，但 content 还是 undefined/empty
    simulateSyncLogic(mockMsg, 'agent_write_file', '');
    
    const state = useInlineEditStore.getState();
    expect(state.pivoStage).toBe('implement');
    expect(state.modifiedCode).toBe('');
  });

  it('🟢 绿：应能实时同步流式代码内容', () => {
    useInlineEditStore.setState({ isInlineEditVisible: true, pivoStage: 'implement' });
    
    const mockMsg = { isInlineTask: true };
    
    // 模拟代码流式增长
    simulateSyncLogic(mockMsg, 'agent_write_file', 'const a =');
    expect(useInlineEditStore.getState().modifiedCode).toBe('const a =');
    
    simulateSyncLogic(mockMsg, 'agent_write_file', 'const a = 1;');
    expect(useInlineEditStore.getState().modifiedCode).toBe('const a = 1;');
  });

  it('🟢 绿：应能从文本块中启发式提取 Plan 任务', () => {
    useInlineEditStore.setState({ isInlineEditVisible: true, pivoStage: 'plan', pivoTasks: [] });
    
    // 模拟 AI 说出规划
    simulateSyncLogic({ isInlineTask: true }, '', '', '首先 优化这段代码逻辑。');
    
    const state = useInlineEditStore.getState();
    expect(state.pivoTasks.length).toBe(1);
    expect(state.pivoTasks[0].description).toBe('优化这段代码逻辑');
    expect(state.pivoTasks[0].stage).toBe('plan');
  });

  it('🟢 绿：应能从工具调用中自动生成 Implement 任务', () => {
    useInlineEditStore.setState({ isInlineEditVisible: true, pivoStage: 'plan', pivoTasks: [] });
    
    // 模拟 AI 发起读取
    simulateSyncLogic({ isInlineTask: true }, 'agent_read_file', '');
    
    let state = useInlineEditStore.getState();
    expect(state.pivoStage).toBe('implement');
    expect(state.pivoTasks.find(t => t.description === '读取关联上下文')).toBeDefined();
    expect(state.pivoTasks[0].status).toBe('running');

    // 模拟 AI 发起写入（之前的读取应标记为 success）
    simulateSyncLogic({ isInlineTask: true }, 'agent_write_file', 'new content');
    
    state = useInlineEditStore.getState();
    expect(state.pivoTasks.length).toBe(2);
    expect(state.pivoTasks[0].status).toBe('success');
    expect(state.pivoTasks[1].description).toBe('正在编写优化代码');
    expect(state.pivoTasks[1].status).toBe('running');
  });
});
