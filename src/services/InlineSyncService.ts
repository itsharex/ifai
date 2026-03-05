import { IInlineEditStore, IStoreInstance } from '../interfaces/ICoreChatStore';

/**
 * Service to synchronize AI state to Inline Assistant UI
 * Implements PIVO 3.0 logic for task extraction and stage synchronization
 */
export class InlineSyncService {
  /**
   * Synchronizes AI progress to the Inline Edit Store
   */
  static syncState(toolName: string, content: string, textChunk?: string) {
    if (typeof window === 'undefined') return;

    const inlineStore = (window as any).__inlineEditStore as IStoreInstance<IInlineEditStore>;
    if (!inlineStore) return;

    const state = inlineStore.getState();
    if (!state.isInlineEditVisible) return;

    inlineStore.setState((prev: IInlineEditStore) => {
      const currentTasks = [...(prev.pivoTasks || [])];
      let pivoStage = prev.pivoStage;

      if (textChunk && (prev.pivoStage === 'plan' || prev.pivoStage === 'idle')) {
        const planMatch = textChunk.match(/(?:我将|首先|接着|然后|最后|开始)\s*(?:我将)?\s*(.*?)(?:。| |\n|$)/);
        if (planMatch && planMatch[1].length > 2) {
          const desc = planMatch[1].trim();
          if (!currentTasks.some(t => t.description.includes(desc))) {
            currentTasks.push({ 
              id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, 
              description: desc, 
              status: 'running', 
              stage: 'plan' 
            });
            pivoStage = 'plan';
          }
        }
      }

      if (toolName) {
        pivoStage = 'implement';
        const toolNameLower = toolName.toLowerCase();
        let desc = '';
        if (toolNameLower.includes('read')) desc = '读取关联上下文';
        else if (toolNameLower.includes('scan') || toolNameLower.includes('list')) desc = '分析项目结构';
        else if (toolNameLower.includes('write') || toolNameLower.includes('replace')) desc = '正在编写优化代码';
        
        if (desc && !currentTasks.some(t => t.description === desc)) {
          currentTasks.forEach(t => { if (t.status === 'running') t.status = 'success'; });
          currentTasks.push({ 
            id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, 
            description: desc, 
            status: 'running', 
            stage: 'implement' 
          });
        }
      }

      return {
        pivoStage: toolName ? 'implement' : (textChunk && pivoStage === 'idle' ? 'plan' : pivoStage),
        modifiedCode: (toolName && content !== undefined) ? content : prev.modifiedCode,
        pivoTasks: currentTasks
      };
    });
  }

  /**
   * Updates the status of an ongoing task based on tool call completion
   */
  static updateToolStatus(toolName: string, status: string) {
    if (typeof window === 'undefined') return;
    const inlineStore = (window as any).__inlineEditStore as IStoreInstance<IInlineEditStore>;
    if (!inlineStore) return;

    if (status === 'completed' || status === 'executed') {
      inlineStore.setState((prev: IInlineEditStore) => {
        const currentTasks = [...(prev.pivoTasks || [])];
        const toolNameLower = toolName.toLowerCase();
        const taskIndex = currentTasks.findIndex(t => {
          if (toolNameLower.includes('read') && t.description === '读取关联上下文') return true;
          if ((toolNameLower.includes('scan') || toolNameLower.includes('list')) && t.description === '分析项目结构') return true;
          if ((toolNameLower.includes('write') || toolNameLower.includes('replace')) && t.description === '正在编写优化代码') return true;
          return false;
        });
        if (taskIndex !== -1 && currentTasks[taskIndex].status === 'running') {
          currentTasks[taskIndex].status = 'success';
        }
        return { pivoTasks: currentTasks };
      });
    }
  }

  /**
   * 🏆 PIVO 3.0: 增强版收尾与自洁逻辑
   * @param options.isRealFinish 是否是真正的全链路结束。如果是 false（如触发了自动批准），则不启动关闭定时器。
   */
  static handleResponseFinish(options: { isRealFinish?: boolean } = { isRealFinish: true }) {
    if (typeof window === 'undefined') return;
    const { isRealFinish } = options;
    
    // 1. 同步旧版 InlineEditStore
    const inlineStore = (window as any).__inlineEditStore;
    if (inlineStore) {
        inlineStore.setState((state: any) => {
            const updatedTasks = (state.pivoTasks || []).map((t: any) => 
                (t.status === 'running' || t.status === 'pending') ? { ...t, status: 'success' as const } : t
            );
            return { pivoTasks: updatedTasks, pivoStage: isRealFinish ? 'complete' : state.pivoStage };
        });

        if (isRealFinish) {
            setTimeout(() => {
                const s = inlineStore.getState();
                if (s.hideInlineEdit) s.hideInlineEdit();
                inlineStore.setState({ pivoTasks: [], modifiedCode: '', pivoStage: 'idle' });
            }, 3000); // 延长到 3s 给用户确认
        }
    }

    // 2. 物理同步 PivoStore (Pivo 3.0 新版)
    const pivoStore = (window as any).__pivoStore;
    if (pivoStore) {
        const state = pivoStore.getState();
        const activeId = state.activeMessageId;
        if (activeId) {
            console.log(`[InlineSync] Processing finish for ${activeId}, isRealFinish: ${isRealFinish}`);
            const tasks = state.taskTrees[activeId] || [];
            tasks.forEach((t: any) => {
                if (t.status === 'pending' || t.status === 'running') {
                    state.updateTaskStatus(activeId, t.id, 'success');
                }
            });
            
            if (isRealFinish) {
                if (state.setPivoState) state.setPivoState('verify');
                setTimeout(() => {
                    pivoStore.setState((s: any) => {
                        const newTrees = { ...s.taskTrees };
                        delete newTrees[activeId]; 
                        return { activeMessageId: null, taskTrees: newTrees, pivoStage: 'idle' };
                    });
                }, 3000);
            }
        }
    }
  }

  static finalize() {
    this.handleResponseFinish({ isRealFinish: true });
  }
}
