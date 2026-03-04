import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';

export interface TaskNode {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'healing';
  task_type: 'Plan' | 'Implement' | 'Verify' | 'Optimize';
  children: TaskNode[];
}

interface PivoState {
  taskTrees: Record<string, TaskNode[]>; // messageId -> tasks
  setTaskTree: (messageId: string, tasks: TaskNode[]) => void;
  updateTaskStatus: (messageId: string, taskId: string, status: TaskNode['status']) => void;
  initEventListener: () => Promise<() => void>;
}

export const usePivoStore = create<PivoState>((set, get) => ({
  taskTrees: {},

  setTaskTree: (messageId, tasks) => {
    set((state) => ({
      taskTrees: {
        ...state.taskTrees,
        [messageId]: tasks,
      },
    }));
  },

  updateTaskStatus: (messageId, taskId, status) => {
    set((state) => {
      const tasks = state.taskTrees[messageId];
      if (!tasks) return state;

      const updateNode = (nodes: TaskNode[]): TaskNode[] => {
        return nodes.map((node) => {
          if (node.id === taskId) {
            return { ...node, status };
          }
          if (node.children.length > 0) {
            return { ...node, children: updateNode(node.children) };
          }
          return node;
        });
      };

      return {
        taskTrees: {
          ...state.taskTrees,
          [messageId]: updateNode(tasks),
        },
      };
    });
  },

  initEventListener: async () => {
    const unlisten = await listen<{ messageId: string; taskId: string; status: TaskNode['status'] }>(
      'pivo-task-updated',
      (event) => {
        const { messageId, taskId, status } = event.payload;
        get().updateTaskStatus(messageId, taskId, status);
      }
    );
    return unlisten;
  },
}));

// 🏆 v0.4.1: 物理级 E2E 挂载 - 确保测试脚本能第一时间锁定 Store
if (typeof window !== 'undefined') {
  const isE2E = (window as any).__E2E__ || 
                location.search.includes('e2e=true') || 
                (window as any).process?.env?.NODE_ENV === 'test';
  
  if (isE2E || import.meta.env.DEV) {
    (window as any).__pivoStore = usePivoStore;
  }
}
