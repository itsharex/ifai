import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from './fileStore';

export interface Skill {
    id: string;
    name: string;
    description: string;
    version: string;
}

interface SkillState {
    availableSkills: Skill[];
    activeSkillIds: string[];
    isLoading: boolean;
    error: string | null;

    fetchSkills: () => Promise<void>;
    toggleSkill: (id: string) => void;
    activateSkill: (id: string) => void;
    deactivateSkill: (id: string) => void;
    reset: () => void;
}

// 🔥 绝对全局同步逻辑
const syncToGlobal = (ids: string[]) => {
    if (typeof window !== 'undefined') {
        (window as any).__IFAI_ACTIVE_SKILLS__ = ids;
        console.log('[SkillStore] Persistent Global Sync:', ids);
    }
};

export const useSkillStore = create<SkillState>()(
    persist(
        (set, get) => ({
            availableSkills: [],
            activeSkillIds: [],
            isLoading: false,
            error: null,

            fetchSkills: async () => {
                const rootPath = useFileStore.getState().rootPath;
                if (!rootPath) return;
                set({ isLoading: true, error: null });
                try {
                    const skills = await invoke<Skill[]>('get_available_skills', { projectRoot: rootPath });
                    set({ availableSkills: [...skills], isLoading: false });
                } catch (e) {
                    set({ error: String(e), isLoading: false });
                }
            },

            toggleSkill: (id: string) => {
                const { activeSkillIds } = get();
                const next = activeSkillIds.includes(id) 
                    ? activeSkillIds.filter(sid => sid !== id)
                    : [...activeSkillIds, id];
                set({ activeSkillIds: next });
                syncToGlobal(next);
            },

            activateSkill: (id: string) => {
                const { activeSkillIds } = get();
                if (!activeSkillIds.includes(id)) {
                    const next = [...activeSkillIds, id];
                    set({ activeSkillIds: next });
                    syncToGlobal(next);
                }
            },

            deactivateSkill: (id: string) => {
                const next = get().activeSkillIds.filter(sid => sid !== id);
                set({ activeSkillIds: next });
                syncToGlobal(next);
            },

            reset: () => {
                set({ availableSkills: [], activeSkillIds: [], error: null });
                syncToGlobal([]);
            }
        }),
        {
            name: 'ifai-skill-storage', // localStorage 中的键名
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ activeSkillIds: state.activeSkillIds }), // 仅持久化已激活的 ID
            onRehydrateStorage: () => (state) => {
                // 当从本地恢复状态时，自动同步到全局 window 对象
                if (state) {
                    syncToGlobal(state.activeSkillIds);
                    console.log('[SkillStore] Rehydrated skills:', state.activeSkillIds);
                }
            }
        }
    )
);

// 挂载到全局，供 useChatStore 逻辑层在任何时刻访问
if (typeof window !== 'undefined') {
    (window as any).__IFAI_SKILL_STORE__ = useSkillStore;
}