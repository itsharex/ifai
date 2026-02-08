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

export const useSkillStore = create<SkillState>((set, get) => ({
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
            set({ availableSkills: skills, isLoading: false });
        } catch (e) {
            set({ error: String(e), isLoading: false });
            console.error('[SkillStore] Failed to fetch skills:', e);
        }
    },

    toggleSkill: (id: string) => {
        const { activeSkillIds } = get();
        if (activeSkillIds.includes(id)) {
            set({ activeSkillIds: activeSkillIds.filter(sid => sid !== id) });
        } else {
            set({ activeSkillIds: [...activeSkillIds, id] });
        }
    },

    activateSkill: (id: string) => {
        const { activeSkillIds } = get();
        if (!activeSkillIds.includes(id)) {
            set({ activeSkillIds: [...activeSkillIds, id] });
        }
    },

    deactivateSkill: (id: string) => {
        set({ activeSkillIds: get().activeSkillIds.filter(sid => sid !== id) });
    },

    reset: () => {
        set({ availableSkills: [], activeSkillIds: [], error: null });
    }
}));
