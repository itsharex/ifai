import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PersistenceManager } from '../services/storage/PersistenceManager';
import i18n from '../i18n/config';

export type AIProtocol = 'openai' | 'anthropic' | 'gemini';

// 预设模板类型（用于自定义提供商）
export type PresetTemplate = 'ollama' | 'vllm' | 'localai' | 'lmstudio' | 'nvidia' | 'custom';

export interface ModelParamsConfig {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: string[];
  // 兼容旧版字段
  top_p?: number;
  max_tokens?: number;
}

// 预设参数模板
export const MODEL_PARAM_PRESETS: Record<string, ModelParamsConfig> = {
  fast: { temperature: 0.3, top_p: 0.9, max_tokens: 2048 },
  balanced: { temperature: 0.7, top_p: 0.9, max_tokens: 4096 },
  precise: { temperature: 0.1, top_p: 0.95, max_tokens: 8192 },
};

// 预设端点模板
export const PRESET_ENDPOINTS: Record<PresetTemplate, { baseUrl: string; defaultModels: string[] }> = {
  ollama: { baseUrl: 'http://localhost:11434/v1/chat/completions', defaultModels: ['qwen2.5-coder:latest', 'deepseek-coder:latest', 'llama3.2:latest', 'codellama:latest'] },
  vllm: { baseUrl: 'http://localhost:8000/v1/chat/completions', defaultModels: ['meta-llama/Llama-3.1-8B-Instruct'] },
  localai: { baseUrl: 'http://localhost:8080/v1/chat/completions', defaultModels: ['gpt-3.5-turbo'] },
  lmstudio: { baseUrl: 'http://localhost:1234/v1/chat/completions', defaultModels: ['local-model'] },
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1/chat/completions', defaultModels: ['meta/llama-3.1-405b-instruct', 'meta/llama-3.1-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct', 'z-ai/glm4.7'] },
  custom: { baseUrl: '', defaultModels: ['z-ai/glm5', 'z-ai/glm4.7', 'nv-tmp', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022'] },
};

export interface AIProviderConfig {
  id: string;
  name: string;
  protocol: AIProtocol;
  baseUrl: string;
  apiKey: string;
  models: string[];
  enabled: boolean;
  group?: 'cloud' | 'local' | 'custom';
  presetTemplate?: PresetTemplate;
  modelParams?: ModelParamsConfig;
  // 兼容旧版字段
  isCustom?: boolean;
  customEndpoint?: string;
  displayName?: string;
}

export interface SettingsState {
  // Appearance
  theme: 'vs-dark' | 'light';
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  fontLigatures: boolean;
  showMinimap: boolean;
  showLineNumbers: boolean;

  // Editor
  tabSize: number;
  wordWrap: 'on' | 'off';
  cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  cursorSmoothCaretAnimation: 'on' | 'off';
  smoothScrolling: boolean;
  bracketPairColorization: boolean;
  renderWhitespace: 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
  formatOnSave: boolean;

  // AI
  providers: AIProviderConfig[];
  currentProviderId: string;
  currentModel: string;
  enableAutocomplete: boolean;
  useLocalModelForCompletion: boolean;  // 优先使用本地模型进行代码补全
  maxContextMessages: number;           // 最大上下文消息数
  enableSmartContextSelection: boolean;  // 是否启用智能上下文选择
  maxContextTokens?: number;            // 可选的token限制（未来扩展）

  // 🔥 v0.3.4: Agent 审批模式
  agentApprovalMode: 'always' | 'session-once' | 'session-never' | 'per-tool';
  trustedSessions: Record<string, { approvedAt: number; expiresAt: number }>;

  // Agent (保留兼容性)
  agentAutoApprove: boolean;
  enableNewApprovalEngine: boolean; // 🔥 PIVO 2.0 新引擎开关
  enableNaturalLanguageAgentTrigger: boolean;
  agentTriggerConfidenceThreshold: number;

  // Tool Classification (v0.3.3)
  toolClassificationEnabled: boolean;
  toolClassificationConfidenceThreshold: number;
  toolClassificationFallbackStrategy: 'always' | 'on-low-confidence' | 'never';
  showToolClassificationIndicator: boolean;

  // RAG
  enableAutoRAG: boolean;
  enableSmartRAG: boolean;
  ragMode: 'auto' | 'manual' | 'always';

  // Performance
  performanceMode: 'auto' | 'high' | 'medium' | 'low';
  targetFPS: number;
  enableGPUAcceleration: boolean;
  showPerformanceMonitor: boolean;
  enableAutoDowngrade: boolean;
  language: string; // 🏆 PIVO 3.0: 统一语言托管

  // Actions
  setTheme: (theme: 'vs-dark' | 'light') => void;
  updateSettings: (settings: Partial<SettingsState>) => void;
  updateProviderConfig: (providerId: string, updates: Partial<AIProviderConfig>) => void;
  addProvider: (provider: AIProviderConfig) => void;
  removeProvider: (providerId: string) => void;
  setCurrentProviderAndModel: (providerId: string, modelName: string) => void;

  // v0.2.6 新增：自定义提供商管理
  addCustomProvider: (config: {
    name: string;
    presetTemplate: PresetTemplate;
    customEndpoint?: string;
    apiKey?: string;
    models?: string[]; // 🚀 新增：支持传入初始模型
    modelParams?: ModelParamsConfig;
  }) => string;  // 返回新提供商 ID
  updateModelParams: (providerId: string, modelParams: ModelParamsConfig) => void;
  getProvidersByGroup: (group: 'cloud' | 'local' | 'custom') => AIProviderConfig[];
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'vs-dark',
      fontSize: 16,
      fontFamily: "'Fira Code', Consolas, 'Courier New', monospace",
      lineHeight: 24,
      fontLigatures: true,
      showMinimap: false,
      showLineNumbers: true,
      tabSize: 2,
      wordWrap: 'on',
      cursorBlinking: 'expand',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      bracketPairColorization: true,
      renderWhitespace: 'selection',
      formatOnSave: true,

      providers: [
        {
          id: 'deepseek',
          name: 'DeepSeek',
          protocol: 'openai',
          baseUrl: 'https://api.deepseek.com/chat/completions',
          apiKey: '',
          models: ['deepseek-chat', 'deepseek-coder'],
          enabled: true,
        },
        {
          id: 'zhipu',
          name: 'Zhipu AI (BigModel)',
          protocol: 'openai',
          baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
          apiKey: '',
          models: ['glm-4.7', 'glm-4.7-flash', 'glm-4.6', 'glm-4.5v', 'glm-4.5-air', 'glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4', 'glm-4v', 'glm-3-turbo'],
          enabled: true,
        },
        {
          id: 'ollama',
          name: 'Ollama (Local)',
          protocol: 'openai',
          baseUrl: 'http://localhost:11434/v1/chat/completions',
          apiKey: 'ollama',
          models: ['qwen2.5-coder', 'llama3.1', 'mistral', 'codellama'],
          enabled: true,
          group: 'local',
        }
      ],
      currentProviderId: 'deepseek',
      currentModel: 'deepseek-chat',
      enableAutocomplete: true,
      useLocalModelForCompletion: false,
      maxContextMessages: 20,
      enableSmartContextSelection: true,

      agentApprovalMode: 'session-once',
      trustedSessions: {},
      agentAutoApprove: false,
      enableNewApprovalEngine: true,
      enableNaturalLanguageAgentTrigger: true,
      agentTriggerConfidenceThreshold: 0.7,

      toolClassificationEnabled: true,
      toolClassificationConfidenceThreshold: 0.8,
      toolClassificationFallbackStrategy: 'on-low-confidence',
      showToolClassificationIndicator: true,

      enableAutoRAG: true,
      enableSmartRAG: true,
      ragMode: 'auto',

      performanceMode: 'balanced' as any,
      targetFPS: 60,
      enableGPUAcceleration: true,
      showPerformanceMonitor: false,
      enableAutoDowngrade: true,
      language: i18n.language || 'zh-CN',

      setTheme: (theme) => set({ theme }),
      
      updateSettings: (newSettings) => {
        set((state) => {
          // 🏆 PIVO 3.0: 联动语言切换
          if (newSettings.language && newSettings.language !== state.language) {
            console.log(`[SettingsStore] 🌐 Language changed to: ${newSettings.language}`);
            i18n.changeLanguage(newSettings.language);
          }
          return { ...state, ...newSettings };
        });
      },

      updateProviderConfig: (providerId, updates) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === providerId ? { ...p, ...updates } : p
          ),
        }));
      },

      addProvider: (provider) => {
        set((state) => ({
          providers: [...state.providers, provider],
        }));
      },

      removeProvider: (providerId) => {
        set((state) => ({
          providers: state.providers.filter((p) => p.id !== providerId),
        }));
      },

      setCurrentProviderAndModel: (providerId, modelName) => {
        set({
          currentProviderId: providerId,
          currentModel: modelName,
        });
      },

      addCustomProvider: (config) => {
        const id = `custom-${uuidv4().slice(0, 8)}`;
        const preset = PRESET_ENDPOINTS[config.presetTemplate];
        
        const newProvider: AIProviderConfig = {
          id,
          name: config.name,
          protocol: 'openai',
          baseUrl: config.customEndpoint || preset?.baseUrl || '',
          apiKey: config.apiKey || '',
          // 🏆 PIVO 3.0: 影子补全 - 优先使用传入模型，否则使用预设，最后兜底为空
          models: config.models || preset?.defaultModels || [],
          enabled: true,
          group: 'custom',
          isCustom: true, // 🚀 物理兼容补丁：确保 UI 能识别
          presetTemplate: config.presetTemplate,
          modelParams: config.modelParams
        };
        set(state => ({ providers: [...state.providers, newProvider] }));
        return id;
      },

      updateModelParams: (providerId, modelParams) => {
        set(state => ({
          providers: state.providers.map(p => 
            p.id === providerId ? { ...p, modelParams } : p
          )
        }));
      },

      getProvidersByGroup: (group) => {
        const state = get();
        if (group === 'custom') return state.providers.filter(p => p.group === 'custom');
        if (group === 'local') return state.providers.filter(p => p.group === 'local');
        return state.providers.filter(p => p.group === group || (!p.group && group === 'cloud'));
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => PersistenceManager.getInstance()),
      version: 4,
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        lineHeight: state.lineHeight,
        fontLigatures: state.fontLigatures,
        showMinimap: state.showMinimap,
        showLineNumbers: state.showLineNumbers,
        tabSize: state.tabSize,
        wordWrap: state.wordWrap,
        cursorBlinking: state.cursorBlinking,
        cursorSmoothCaretAnimation: state.cursorSmoothCaretAnimation,
        smoothScrolling: state.smoothScrolling,
        bracketPairColorization: state.bracketPairColorization,
        renderWhitespace: state.renderWhitespace,
        formatOnSave: state.formatOnSave,
        language: state.language, // 🏆 持久化
        providers: state.providers.map(p => ({ ...p })),
        currentProviderId: state.currentProviderId,
        currentModel: state.currentModel,
        enableAutocomplete: state.enableAutocomplete,
        useLocalModelForCompletion: state.useLocalModelForCompletion,
        agentAutoApprove: state.agentAutoApprove,
        enableNaturalLanguageAgentTrigger: state.enableNaturalLanguageAgentTrigger,
        agentTriggerConfidenceThreshold: state.agentTriggerConfidenceThreshold,
        enableAutoRAG: state.enableAutoRAG,
        enableSmartRAG: state.enableSmartRAG,
        ragMode: state.ragMode,
        performanceMode: state.performanceMode,
        targetFPS: state.targetFPS,
        enableGPUAcceleration: state.enableGPUAcceleration,
        showPerformanceMonitor: state.showPerformanceMonitor,
        enableAutoDowngrade: state.enableAutoDowngrade,
        maxContextMessages: state.maxContextMessages,
        enableSmartContextSelection: state.enableSmartContextSelection,
        maxContextTokens: state.maxContextTokens,
        agentApprovalMode: state.agentApprovalMode,
        trustedSessions: state.trustedSessions,
      }),
      migrate: (persistedState: any, version: number) => {
        console.log(`[SettingsStore] Migrating from version ${version} to 4`);
        if (!persistedState.agentApprovalMode) persistedState.agentApprovalMode = 'session-once';
        if (!persistedState.trustedSessions) persistedState.trustedSessions = {};
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('[SettingsStore] ✅ Hydration complete');
          
          // 🏆 PIVO 3.0: 恢复语言设置
          if (state.language) {
            console.log(`[SettingsStore] 🌐 Restoring language: ${state.language}`);
            i18n.changeLanguage(state.language);
          }

          setTimeout(() => {
            const hasApiKey = state.providers.some(p => p.apiKey && p.apiKey.trim() !== '');
            if (!hasApiKey) {
              const zhipuProvider = state.providers.find(p => p.id === 'zhipu');
              if (zhipuProvider) {
                useSettingsStore.setState(s => ({
                  providers: s.providers.map(p =>
                    p.id === 'zhipu' ? { ...p, enabled: true, models: ['glm-4.7', 'glm-4.7-flash', 'glm-4.6', 'glm-4.5v', 'glm-4.5-air', 'glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4', 'glm-4v', 'glm-3-turbo'] } : p
                  ),
                  currentProviderId: 'zhipu',
                  currentModel: 'glm-4.6'
                }));
              }
            }
          }, 50);
        }
      },
    }
  )
);

import { v4 as uuidv4 } from 'uuid';

if (typeof window !== 'undefined') {
  (window as any).__settingsStore = useSettingsStore;
}
