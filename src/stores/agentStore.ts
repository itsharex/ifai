import { create } from 'zustand';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Agent } from '../types/agent';
import { useFileStore } from './fileStore';
import { useSettingsStore } from './settingsStore';

interface AgentState {
  runningAgents: Agent[];
  activeListeners: Record<string, UnlistenFn>;
  launchAgent: (agentType: string, task: string) => Promise<string>;
  removeAgent: (id: string) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  runningAgents: [],
  activeListeners: {},
  
  launchAgent: async (agentType: string, task: string) => {
    const projectRoot = useFileStore.getState().rootPath;
    if (!projectRoot) throw new Error("No project root available");

    const settingsStore = useSettingsStore.getState();
    const providerConfig = settingsStore.providers.find(p => p.id === settingsStore.currentProviderId);
    if (!providerConfig) throw new Error("No AI provider configured");

    const id = await invoke<string>('launch_agent', {
        agentType,
        task,
        projectRoot,
        providerConfig
    });

    // 1. Add to local list
    const newAgent: Agent = {
        id,
        name: `${agentType} Task`,
        type: agentType,
        status: 'idle',
        progress: 0,
        logs: [],
        content: "" // Initialize content
    };

    set(state => ({ runningAgents: [newAgent, ...state.runningAgents] }));

    // 2. Setup dynamic AI stream listener
    const eventId = `agent_${id}`;
    const unlisten = await listen<any>(eventId, (event) => {
        const payload = event.payload;
        
        // Handle structured object payload (from our new runner.rs)
        if (payload && typeof payload === 'object' && payload.type === 'content') {
            set(state => ({
                runningAgents: state.runningAgents.map(a => 
                    a.id === id ? { ...a, content: (a.content || "") + (payload.content || "") } : a
                )
            }));
        } 
        // Handle raw string fallback
        else if (typeof payload === 'string') {
            set(state => ({
                runningAgents: state.runningAgents.map(a => 
                    a.id === id ? { ...a, content: (a.content || "") + payload } : a
                )
            }));
        }
    });

    set(state => ({
        activeListeners: { ...state.activeListeners, [id]: unlisten }
    }));

    return id;
  },

  removeAgent: (id: string) => {
      const { activeListeners } = get();
      if (activeListeners[id]) {
          activeListeners[id](); // Unsubscribe
      }
      set(state => {
          const { [id]: _, ...remainingListeners } = state.activeListeners;
          return {
              runningAgents: state.runningAgents.filter(a => a.id !== id),
              activeListeners: remainingListeners
          };
      });
  }
}));

// Global Status Listeners
listen('agent:status', (event: any) => {
    const { id, status, progress } = event.payload;
    useAgentStore.setState(state => ({
        runningAgents: state.runningAgents.map(a => a.id === id ? { ...a, status, progress } : a)
    }));
});

listen('agent:log', (event: any) => {
    const { id, message } = event.payload;
    useAgentStore.setState(state => ({
        runningAgents: state.runningAgents.map(a => 
            a.id === id ? { ...a, logs: [...a.logs, message] } : a
        )
    }));
});

listen('agent:result', (event: any) => {
    const payload = event.payload;
    const id = payload.id;
    const output = payload.output;
    
    useAgentStore.setState(state => ({
        runningAgents: state.runningAgents.map(a => 
            a.id === id ? { ...a, status: 'completed', logs: [...a.logs, `RESULT: ${output}`] } : a
        )
    }));
});