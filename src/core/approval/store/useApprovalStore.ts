import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApprovalItem, ApprovalStatus, ToolCallResult } from '../types';

interface ApprovalState {
  items: Record<string, ApprovalItem>;
  
  // Actions
  addItem: (item: Omit<ApprovalItem, 'createdAt' | 'updatedAt' | 'status'>) => void;
  updateStatus: (id: string, status: ApprovalStatus, result?: ToolCallResult, previewData?: any) => void;
  removeItem: (id: string) => void;
  getItem: (id: string) => ApprovalItem | undefined;
  clear: () => void;
}

export const useApprovalStore = create<ApprovalState>()(
  persist(
    (set, get) => ({
      items: {},

      addItem: (item) => set((state) => ({
        items: {
          ...state.items,
          [item.id]: {
            ...item,
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        }
      })),

      updateStatus: (id, status, result, previewData) => set((state) => {
        const item = state.items[id];
        if (!item) return state;

        return {
          items: {
            ...state.items,
            [id]: {
              ...item,
              status,
              result: result || item.result,
              previewData: previewData || item.previewData,
              updatedAt: Date.now(),
            }
          }
        };
      }),

      removeItem: (id) => set((state) => {
        const { [id]: _, ...rest } = state.items;
        return { items: rest };
      }),

      getItem: (id) => get().items[id],

      clear: () => set({ items: {} }),
    }),
    {
      name: 'ifai-approval-store',
      // 仅持久化关键状态，避免存储过大的执行结果
      partialize: (state) => ({ items: state.items }),
    }
  )
);
