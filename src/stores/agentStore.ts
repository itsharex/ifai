import { create } from 'zustand';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Agent, AgentEventPayload } from '../types/agent';
import { useFileStore } from './fileStore';
import { useSettingsStore } from './settingsStore';
import { useChatStore as coreUseChatStore } from 'ifainew-core';

interface AgentState {
  runningAgents: Agent[];
  activeListeners: Record<string, UnlistenFn>;
  agentToMessageMap: Record<string, string>;
  pendingStatusUpdates: Record<string, { status: string, progress: number }>; // Buffer for early events
  launchAgent: (agentType: string, task: string, chatMsgId?: string) => Promise<string>;
  removeAgent: (id: string) => void;
  initEventListeners: () => Promise<() => void>;
  approveAction: (id: string, approved: boolean) => Promise<void>;
}

function unescapeToolArguments(args: any): any {
    if (args && typeof args.content === 'string') {
        args.content = args.content.replace(/\\n/g, '\n').replace(/\\\"/g, '"');
    }
    return args;
}

// Remove module-level lock to ensure fresh listeners on every mount (React Strict Mode compatible)
// let initListenerPromise: Promise<() => void> | null = null; 

export const useAgentStore = create<AgentState>((set, get) => ({
  runningAgents: [],
  activeListeners: {},
  agentToMessageMap: {},
  pendingStatusUpdates: {},
  
  // ... (keep launchAgent and removeAgent as is) ...
  launchAgent: async (agentType: string, task: string, chatMsgId?: string) => {
    // ... (same as before) ...
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

    if (chatMsgId) {
        set(state => ({ agentToMessageMap: { ...state.agentToMessageMap, [id]: chatMsgId } }));
    }

    // Check for buffered status updates (race condition fix)
    const pendingUpdate = get().pendingStatusUpdates[id];
    
    const newAgent: Agent = {
        id,
        name: `${agentType} Task`,
        type: agentType,
        status: pendingUpdate ? pendingUpdate.status : 'idle',
        progress: pendingUpdate ? pendingUpdate.progress : 0,
        logs: [],
        content: ""
    };

    set(state => {
        // Clear consumed pending update
        const { [id]: _, ...remainingUpdates } = state.pendingStatusUpdates;
        return { 
            runningAgents: [newAgent, ...state.runningAgents],
            pendingStatusUpdates: remainingUpdates
        };
    });

    const eventId = `agent_${id}`;
    let thinkingBuffer = "";
    let lastFlush = 0;
    
    // ... (rest of launchAgent logic) ...

    const unlisten = await listen<AgentEventPayload>(eventId, (event) => {
        const payload = event.payload;
        if (!payload || typeof payload !== 'object') return;

        const chatState = coreUseChatStore.getState();
        const msgId = get().agentToMessageMap[id];
        if (!msgId) {
            console.error(`[AgentStore] No message ID mapping for agent ${id}! This will cause events to be ignored.`);
            return;
        }
        console.log(`[AgentStore] Received event for agent ${id}, type: ${payload.type}`);

        if (payload.type === 'thinking' || (payload as any).type === 'content') {
            const chunk = (payload.content || (payload as any).content) || "";
            thinkingBuffer += chunk;

            const now = Date.now();
            if (now - lastFlush > 100) {
                const currentBuffer = thinkingBuffer;
                set(state => ({
                    runningAgents: state.runningAgents.map(a => 
                        a.id === id ? { ...a, content: (a.content || "") + currentBuffer } : a
                    )
                }));
                thinkingBuffer = "";
                lastFlush = now;
            }
        } 
        else if (payload.type === 'tool_call') {
            const toolCall = payload.toolCall;
            if (!toolCall) return;

            const liveToolCall = {
                id: toolCall.id,
                tool: toolCall.tool,
                args: unescapeToolArguments(toolCall.args),
                status: 'pending' as const
            };

            const updatedMessages = chatState.messages.map(m => {
                if (m.id === msgId) {
                    const existing = m.toolCalls || [];
                    const isDuplicate = existing.some(tc => 
                        tc.id === liveToolCall.id || 
                        (tc.tool === liveToolCall.tool && JSON.stringify(tc.args) === JSON.stringify(liveToolCall.args))
                    );

                    if (!isDuplicate) {
                        return { ...m, toolCalls: [...existing, liveToolCall] };
                    }
                }
                return m;
            });

            coreUseChatStore.setState({ messages: updatedMessages });
        }
        else if (payload.type === 'result') {
            const result = payload.result || "";
            chatState.updateMessageContent(msgId, result);
        }
        else if (payload.type === 'error') {
            chatState.updateMessageContent(msgId, `❌ Agent Error: ${payload.error}`);
        }
    });

    set(state => ({ activeListeners: { ...state.activeListeners, [id]: unlisten } }));
    return id;
  },

  approveAction: async (id: string, approved: boolean) => {
      await invoke('approve_agent_action', { id, approved });
      set(state => ({
          runningAgents: state.runningAgents.map(a => 
              a.id === id ? { ...a, pendingApproval: undefined } : a
          )
      }));
  },

  removeAgent: (id: string) => {
      const { activeListeners } = get();
      if (activeListeners[id]) activeListeners[id]();
      set(state => {
          const { [id]: _, ...remainingListeners } = state.activeListeners;
          const { [id]: __, ...remainingMap } = state.agentToMessageMap;
          return {
              runningAgents: state.runningAgents.filter(a => a.id !== id),
              activeListeners: remainingListeners,
              agentToMessageMap: remainingMap
          };
      });
  },

  initEventListeners: async () => {
      console.log('[AgentStore] 🎯 Starting global event listeners initialization...');
      
      const unlisteners: UnlistenFn[] = [];

      const unlistenStatus = await listen('agent:status', (event: any) => {
        const { id, status, progress } = event.payload;
        console.log('[AgentStore] 📊 agent:status event:', { id, status, progress });
        
        useAgentStore.setState(state => {
            const agent = state.runningAgents.find(a => a.id === id);
            if (agent) {
                if (agent.status === status && agent.progress === progress) return state;
                return {
                    runningAgents: state.runningAgents.map(a => a.id === id ? { ...a, status, progress } : a)
                };
            } else {
                console.log(`[AgentStore] Buffering status for unknown agent ${id}: ${status}`);
                return {
                    pendingStatusUpdates: {
                        ...state.pendingStatusUpdates,
                        [id]: { status, progress }
                    }
                };
            }
        });
      });
      unlisteners.push(unlistenStatus);

      const unlistenLog = await listen('agent:log', (event: any) => {
        const { id, message } = event.payload;
        useAgentStore.setState(state => {
            const agent = state.runningAgents.find(a => a.id === id);
            if (!agent) return state;

            const needsStatusFix = agent.status === 'idle';
            if (!needsStatusFix && agent.logs[agent.logs.length - 1] === message) return state;

            return {
                runningAgents: state.runningAgents.map(a => a.id === id ? { 
                    ...a, 
                    logs: [...a.logs, message],
                    status: needsStatusFix ? 'running' : a.status 
                } : a)
            };
        });
      });
      unlisteners.push(unlistenLog);

      const unlistenApproval = await listen('agent:approval_required', (event: any) => {
          const { id, tool, path, content } = event.payload;
          useAgentStore.setState(state => ({
              runningAgents: state.runningAgents.map(a => 
                a.id === id ? { ...a, status: 'waitingfortool', pendingApproval: { tool, path, content } } : a
              )
          }));
      });
      unlisteners.push(unlistenApproval);

      const unlistenResult = await listen('agent:result', (event: any) => {
        console.log('[AgentStore] 🎉 agent:result event RECEIVED!', event);
        const { id, output } = event.payload;
        
        useAgentStore.setState(state => ({
            runningAgents: state.runningAgents.map(a =>
                a.id === id ? { ...a, status: 'completed', progress: 1.0, expiresAt: Date.now() + 10000 } : a)
        }));

        setTimeout(() => {
            const agent = useAgentStore.getState().runningAgents.find(a => a.id === id);
            if (agent) {
                console.log('[AgentStore] 🗑️ Auto-closing agent:', id);
                useAgentStore.getState().removeAgent(id);
            }
        }, 10000);
      });
      unlisteners.push(unlistenResult);

      console.log('[AgentStore] ✅ All global event listeners initialized!');

      return () => {
          console.log('[AgentStore] 🛑 Cleaning up global event listeners...');
          unlisteners.forEach(u => u());
      };
  }
}));