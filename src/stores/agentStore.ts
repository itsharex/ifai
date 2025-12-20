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
  launchAgent: (agentType: string, task: string, chatMsgId?: string) => Promise<string>;
  removeAgent: (id: string) => void;
  initEventListeners: () => Promise<void>;
  approveAction: (id: string, approved: boolean) => Promise<void>;
}

function unescapeToolArguments(args: any): any {
    if (args && typeof args.content === 'string') {
        args.content = args.content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    return args;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  runningAgents: [],
  activeListeners: {},
  agentToMessageMap: {},
  
  launchAgent: async (agentType: string, task: string, chatMsgId?: string) => {
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

    const newAgent: Agent = {
        id,
        name: `${agentType} Task`,
        type: agentType,
        status: 'idle',
        progress: 0,
        logs: [],
        content: ""
    };

    set(state => ({ runningAgents: [newAgent, ...state.runningAgents] }));

    const eventId = `agent_${id}`;
    let thinkingBuffer = "";
    let lastFlush = 0;
    
    // Tools assembly state (for streaming tool calls if any, though runner.rs now sends them whole)
    const streamingTools: Record<number, any> = {};

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

        // --- CONTENT SPLITTING LOGIC (UX OPTIMIZATION) ---

        // 1. Handle THINKING (Analysis/Reasoning) -> Only update Agent Card
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
                
                // NO LONGER updating chat message content for thinking chunks!
                // This prevents redundant information in the chat panel.
                
                thinkingBuffer = "";
                lastFlush = now;
            }
        } 
        // 2. Handle TOOL CALLS -> Update Chat UI (Interactive)
        else if (payload.type === 'tool_call') {
            const toolCall = payload.toolCall;
            if (!toolCall) {
                console.warn('[AgentStore] Received tool_call event without toolCall data');
                return;
            }

            console.log(`[AgentStore] Processing tool_call: ${toolCall.tool}`, toolCall);

            // Injected into message toolCalls array to trigger ToolApproval UI in chat
            const liveToolCall = {
                id: toolCall.id,
                tool: toolCall.tool,
                args: unescapeToolArguments(toolCall.args),
                status: 'pending' as const
            };

            // ✅ Use map to create a new messages array for React reactivity
            const updatedMessages = chatState.messages.map(m => {
                if (m.id === msgId) {
                    const existing = m.toolCalls || [];
                    // Only add if not already present
                    if (!existing.find(tc => tc.id === liveToolCall.id)) {
                        console.log(`[AgentStore] Adding tool call to message ${msgId}`);
                        return {
                            ...m,
                            toolCalls: [...existing, liveToolCall]
                        };
                    } else {
                        console.log(`[AgentStore] Tool call ${liveToolCall.id} already exists in message`);
                    }
                }
                return m;
            });

            coreUseChatStore.setState({ messages: updatedMessages });
            console.log('[AgentStore] Updated chat messages with tool call');

            // Debug: Log the updated message to verify toolCalls were added
            const debugMsg = updatedMessages.find(m => m.id === msgId);
            console.log('[AgentStore] DEBUG: Message after update:', debugMsg);
            console.log('[AgentStore] DEBUG: Message toolCalls:', debugMsg?.toolCalls);
        }
        // 3. Handle RESULT -> Show Final Summary in Chat
        else if (payload.type === 'result') {
            console.log('[AgentStore] Received RESULT event for agent:', id);
            const result = payload.result || "";
            console.log('[AgentStore] Final result:', result.substring(0, 100) + '...');
            chatState.updateMessageContent(msgId, result);
        }
        // 4. Handle ERROR
        else if (payload.type === 'error') {
            console.log('[AgentStore] Received ERROR event for agent:', id, payload.error);
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
      console.log('[AgentStore] 🎯 Initializing global event listeners...');

      await listen('agent:status', (event: any) => {
        const { id, status, progress } = event.payload;
        console.log('[AgentStore] 📊 agent:status event:', { id, status, progress });
        console.log('[AgentStore] Current runningAgents:', useAgentStore.getState().runningAgents.map(a => ({ id: a.id, status: a.status })));
        useAgentStore.setState(state => ({
            runningAgents: state.runningAgents.map(a => a.id === id ? { ...a, status, progress } : a)
        }));
        console.log('[AgentStore] After update:', useAgentStore.getState().runningAgents.find(a => a.id === id));
      });

      await listen('agent:log', (event: any) => {
        const { id, message } = event.payload;
        console.log('[AgentStore] agent:log event:', { id, message });
        useAgentStore.setState(state => ({
            runningAgents: state.runningAgents.map(a => a.id === id ? { ...a, logs: [...a.logs, message] } : a)
        }));
      });

      // Keeping this for redundancy, but new flow uses agent_${id} stream
      await listen('agent:approval_required', (event: any) => {
          const { id, tool, path, content } = event.payload;
          useAgentStore.setState(state => ({
              runningAgents: state.runningAgents.map(a => 
                a.id === id ? { ...a, status: 'waitingfortool', pendingApproval: { tool, path, content } } : a
              )
          }));
      });

      await listen('agent:result', (event: any) => {
        console.log('[AgentStore] 🎉 agent:result event RECEIVED!', event);
        const { id, output } = event.payload;
        console.log('[AgentStore] 📝 Result details:', { id, outputLength: output?.length || 0, preview: output?.substring(0, 100) });
        console.log('[AgentStore] 📋 Current runningAgents before update:', useAgentStore.getState().runningAgents.map(a => ({ id: a.id, status: a.status, expiresAt: a.expiresAt })));

        useAgentStore.setState(state => ({
            runningAgents: state.runningAgents.map(a =>
                a.id === id ? { ...a, status: 'completed', progress: 1.0, expiresAt: Date.now() + 10000 } : a)
        }));

        const updatedAgent = useAgentStore.getState().runningAgents.find(a => a.id === id);
        console.log('[AgentStore] ✅ Agent after update:', updatedAgent);
        console.log('[AgentStore] ⏰ Setting 10s auto-close timer for agent:', id);

        setTimeout(() => {
            const agent = useAgentStore.getState().runningAgents.find(a => a.id === id);
            if (agent) {
                console.log('[AgentStore] 🗑️ Auto-closing agent:', id);
                useAgentStore.getState().removeAgent(id);
            } else {
                console.log('[AgentStore] ⚠️ Agent already removed:', id);
            }
        }, 10000);
      });

      console.log('[AgentStore] ✅ All global event listeners initialized!');
  }
}));