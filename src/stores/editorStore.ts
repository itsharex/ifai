import { create } from 'zustand';
import { editor, Selection } from 'monaco-editor';

interface InlineEditState {
  isVisible: boolean;
  position: { lineNumber: number; column: number } | null;
  selection: Selection | null;
}

interface EditorState {
  editorInstance: editor.IStandaloneCodeEditor | null;
  theme: 'vs-dark' | 'light';
  inlineEdit: InlineEditState;
  
  setEditorInstance: (instance: editor.IStandaloneCodeEditor) => void;
  setTheme: (theme: 'vs-dark' | 'light') => void;
  setInlineEdit: (state: Partial<InlineEditState>) => void;
  closeInlineEdit: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  editorInstance: null,
  theme: 'vs-dark',
  inlineEdit: {
    isVisible: false,
    position: null,
    selection: null,
  },

  setEditorInstance: (instance) => set({ editorInstance: instance }),
  setTheme: (theme) => set({ theme }),
  setInlineEdit: (newState) => set((state) => ({
    inlineEdit: { ...state.inlineEdit, ...newState }
  })),
  closeInlineEdit: () => set((state) => ({
    inlineEdit: { ...state.inlineEdit, isVisible: false }
  })),
}));
