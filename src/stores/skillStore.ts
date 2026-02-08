import { create } from 'zustand';
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

// 🔥 建立绝对全局的同步容器
const syncToGlobal = (ids: string[]) => {
    if (typeof window !== 'undefined') {
        (window as any).__IFAI_ACTIVE_SKILLS__ = ids;
        console.log('[SkillStore] Global sync updated:', ids);
    }
};

const createSkillStore = () => create<SkillState>((set, get) => ({
    availableSkills: [],
    activeSkillIds: (typeof window !== 'undefined' ? (window as any).__IFAI_ACTIVE_SKILLS__ : []) || [],
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
}));

const GLOBAL_KEY = '__IFAI_SKILL_STORE__';
let storeInstance: any;

if (typeof window !== 'undefined') {
    if (!(window as any)[GLOBAL_KEY]) {
        (window as any)[GLOBAL_KEY] = createSkillStore();
    }
    storeInstance = (window as any)[GLOBAL_KEY];
} else {
    storeInstance = createSkillStore();
}

export const useSkillStore = storeInstance;
