import { create } from 'zustand';
import { MockInlineEditor } from '../core/mock-core/v0.2.9/MockInlineEditor';
import { RealInlineEditor } from '../core/real-core/v0.2.9/RealInlineEditor';
import type { IInlineEditor, InlineEditorRequest } from '../core/interfaces/v0.2.9/IInlineEditor';
import { IS_COMMERCIAL } from '../config/edition';

function createEditorService(): IInlineEditor {
  if (IS_COMMERCIAL) return new RealInlineEditor();
  return new MockInlineEditor({ delay: 100 });
}

let editorService: IInlineEditor = createEditorService();

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
  showDiffEditor: () => void;
  hideDiffEditor: () => void;
  acceptDiff: () => void;
  rejectDiff: () => void;
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
    const filePath = model?.uri.fsPath || model?.uri.path || '';

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
    set({ isInlineEditVisible: false, isDiffEditorVisible: false, pivoStage: 'idle', isProcessing: false });
  },

  setInstruction: (instruction) => set({ instruction }),

  submitInstruction: async (instruction: string) => {
    if (!instruction.trim() || get().isProcessing) return;

    set({ instruction, isProcessing: true, pivoStage: 'plan' });

    // 🏆 PIVO 3.0: 物理桥接逻辑 - 将 Inline 指令转发至 Chat Store
    // 这确保了对话区有内容，且能触发响应式任务拆解
    const { selectedText, currentFilePath } = get();
    const { useChatStore } = await import('./useChatStore');
    const { useSettingsStore } = await import('./settingsStore');
    
    const settings = useSettingsStore.getState();
    const providerId = settings.currentProviderId;
    const modelName = settings.currentModel;

    // 构造 PIVO 专用 Prompt 包装
    const pivoPrompt = `[TASK-EXECUTION] 在文件 \`${currentFilePath}\` 中执行以下指令：\n${instruction}\n\n${
        selectedText ? `**选中的代码快照：**\n\`\`\`\n${selectedText}\n\`\`\`` : ''
    }`;

    try {
        console.log('[InlineStore] 🚀 Bridging to ChatStore via PIVO 3.0 Pipe');
        await (useChatStore.getState() as any).sendMessage(pivoPrompt, providerId, modelName, {
            isInlineTask: true,
            displayLabel: instruction // 保持 UI 显示原始简洁指令
        });
    } catch (error) {
        console.error('[InlineStore] ❌ Bridge failed:', error);
        set({ isProcessing: false, pivoStage: 'idle' });
    }
  },

  // 保留直接执行能力（作为兜底）
  submitRequest: async () => {
    await get().submitInstruction(get().instruction);
  },

  applyDiff: (modifiedCode) => {
    set({ modifiedCode, isDiffEditorVisible: true });
  },

  showDiffEditor: () => set({ isDiffEditorVisible: true }),
  hideDiffEditor: () => set({ isDiffEditorVisible: false }),
  acceptDiff: () => get().acceptChanges(),
  rejectDiff: () => get().rejectChanges(),
  acceptChanges: () => get().hideInlineEdit(),
  rejectChanges: () => get().hideInlineEdit(),
  setPivoState: (stage, tasks, files) => set({ 
    pivoStage: stage, 
    pivoTasks: tasks || get().pivoTasks,
    modifiedFiles: files || get().modifiedFiles
  }),
  undo: () => {},
  redo: () => {}
}));
