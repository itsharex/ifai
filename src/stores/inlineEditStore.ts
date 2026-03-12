import { create } from 'zustand';
import { IS_COMMERCIAL } from '../config/edition';

export interface InlineEditState {
  isInlineEditVisible: boolean;
  isDiffEditorVisible: boolean;
  instruction: string;
  selectedText: string;
  position: { lineNumber: number; column: number } | null;
  originalCode: string;
  modifiedCode: string;
  currentFilePath: string;
  pivoStage: 'plan' | 'implement' | 'complete' | 'idle' | 'verify';
  pivoTasks: any[];
  modifiedFiles: string[];
  editHistory: any[];
  historyIndex: number;
  isProcessing: boolean;

  showInlineEdit: (selectedText?: string, position?: { lineNumber: number; column: number }) => void;
  hideInlineEdit: () => void;
  setInstruction: (instruction: string) => void;
  submitRequest: () => Promise<void>;
  acceptChanges: () => void;
  rejectChanges: () => void;
  applyDiff: (modifiedCode: string) => void;
  setPivoState: (stage: InlineEditState['pivoStage'], tasks?: any[], files?: string[]) => void;
  undo: () => void;
  redo: () => void;
  
  submitInstruction: (text: string) => Promise<void>;
  showDiffEditor: (original?: string, modified?: string, filePath?: string, instruction?: string) => void;
  hideDiffEditor: () => void;
  acceptDiff: () => void;
  rejectDiff: () => void;
  clearHistory: () => void;
}

export const useInlineEditStore = create<InlineEditState>((set, get) => ({
  isInlineEditVisible: false,
  isDiffEditorVisible: false,
  instruction: '',
  selectedText: '',
  position: null,
  originalCode: '',
  modifiedCode: '',
  currentFilePath: '',
  pivoStage: 'idle',
  pivoTasks: [],
  modifiedFiles: [],
  editHistory: [],
  historyIndex: -1,
  isProcessing: false,

  showInlineEdit: (selectedText = '', position = null) => {
    const editor = (window as any).__activeEditor;
    const model = editor?.getModel();
    const filePath = model?.uri?.fsPath || model?.uri?.path || '';

    set({
      isInlineEditVisible: true,
      selectedText,
      originalCode: selectedText || editor?.getValue() || '',
      modifiedCode: '',
      instruction: '',
      position,
      currentFilePath: filePath,
      pivoStage: 'idle',
      pivoTasks: [],
      isProcessing: false
    });
  },

  hideInlineEdit: () => {
    set({ 
      isInlineEditVisible: false, 
      isDiffEditorVisible: false, 
      pivoStage: 'idle', 
      isProcessing: false,
      instruction: '',
      selectedText: '',
      originalCode: '',
      modifiedCode: '',
      position: null
    });
  },

  setInstruction: (instruction) => set({ instruction }),

  submitInstruction: async (instruction: string) => {
    if (!instruction.trim() || get().isProcessing) return;

    set({ instruction, isProcessing: true, pivoStage: 'plan' });

    // 🏆 PIVO 3.0: 触发 DOM 事件以便 Monaco 等编辑器监听
    const { selectedText, currentFilePath, position } = get();
    const event = new CustomEvent('inline-edit-submit', {
      detail: { instruction, selectedText, filePath: currentFilePath, position }
    });
    window.dispatchEvent(event);

    // 🏆 PIVO 3.0: 物理桥接逻辑 - 将 Inline 指令转发至 Chat Store
    try {
        const { useChatStore } = await import('./useChatStore');
        const { useSettingsStore } = await import('./settingsStore');
        
        const settings = useSettingsStore.getState();
        const providerId = settings.currentProviderId;
        const modelName = settings.currentModel;

        const pivoPrompt = `[TASK-EXECUTION] 在文件 \`${currentFilePath}\` 中执行以下指令：\n${instruction}\n\n${
            selectedText ? `**选中的代码快照：**\n\`\`\`\n${selectedText}\n\`\`\`` : ''
        }`;

        console.log('[InlineStore] 🚀 Bridging to ChatStore via PIVO 3.0 Pipe');
        await (useChatStore.getState() as any).sendMessage(pivoPrompt, providerId, modelName, {
            isInlineTask: true,
            displayLabel: instruction
        });
    } catch (error) {
        console.error('[InlineStore] ❌ Bridge failed:', error);
        set({ isProcessing: false, pivoStage: 'idle' });
    }
  },

  submitRequest: async () => {
    await get().submitInstruction(get().instruction);
  },

  applyDiff: (modifiedCode) => {
    set({ modifiedCode, isDiffEditorVisible: true });
  },

  showDiffEditor: (original, modified, filePath, instruction) => {
    const state = get();
    const newOriginal = original !== undefined ? original : state.originalCode;
    const newModified = modified !== undefined ? modified : state.modifiedCode;
    const newFilePath = filePath !== undefined ? filePath : state.currentFilePath;
    const newInstruction = instruction !== undefined ? instruction : state.instruction;

    const historyEntry = {
      timestamp: Date.now(),
      originalCode: newOriginal,
      modifiedCode: newModified,
      filePath: newFilePath,
      instruction: newInstruction
    };

    const newHistory = [...state.editHistory, historyEntry];
    
    set({ 
      isDiffEditorVisible: true,
      originalCode: newOriginal,
      modifiedCode: newModified,
      currentFilePath: newFilePath,
      instruction: newInstruction,
      editHistory: newHistory,
      historyIndex: newHistory.length - 1
    });
  },

  hideDiffEditor: () => set({ isDiffEditorVisible: false }),
  
  acceptDiff: () => {
    const { originalCode, modifiedCode, currentFilePath } = get();
    const event = new CustomEvent('inline-edit-accept', {
      detail: { originalCode, modifiedCode, filePath: currentFilePath }
    });
    window.dispatchEvent(event);
    get().acceptChanges();
  },

  rejectDiff: () => {
    const event = new CustomEvent('inline-edit-reject', {
      detail: { filePath: get().currentFilePath }
    });
    window.dispatchEvent(event);
    get().rejectChanges();
  },

  acceptChanges: () => get().hideInlineEdit(),
  rejectChanges: () => get().hideInlineEdit(),
  
  setPivoState: (stage, tasks, files) => set({ 
    pivoStage: stage, 
    pivoTasks: tasks || get().pivoTasks,
    modifiedFiles: files || get().modifiedFiles
  }),

  undo: () => {
    const { editHistory, historyIndex } = get();
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevState = editHistory[prevIndex];
      set({
        historyIndex: prevIndex,
        originalCode: prevState.originalCode,
        modifiedCode: prevState.modifiedCode,
        instruction: prevState.instruction
      });
      window.dispatchEvent(new CustomEvent('inline-edit-undo', { detail: prevState }));
    }
  },

  redo: () => {
    const { editHistory, historyIndex } = get();
    if (historyIndex < editHistory.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextState = editHistory[nextIndex];
      set({
        historyIndex: nextIndex,
        originalCode: nextState.originalCode,
        modifiedCode: nextState.modifiedCode,
        instruction: nextState.instruction
      });
      window.dispatchEvent(new CustomEvent('inline-edit-redo', { detail: nextState }));
    }
  },

  clearHistory: () => set({ editHistory: [], historyIndex: -1 })
}));
