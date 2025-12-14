import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { FileNode, OpenedFile, GitStatus } from './types';

interface FileState {
  fileTree: FileNode | null;
  rootPath: string | null;
  openedFiles: OpenedFile[];
  activeFileId: string | null;
  gitStatuses: Map<string, GitStatus>; // Map from file path to GitStatus
  
  setFileTree: (tree: FileNode) => void;
  setRootPath: (path: string | null) => void;
  openFile: (file: OpenedFile) => void;
  closeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  setFileDirty: (id: string, isDirty: boolean) => void;
  setGitStatuses: (statuses: Map<string, GitStatus>) => void;
}

// Helper to recursively update git status in file tree
const updateGitStatusRecursive = (node: FileNode, statuses: Map<string, GitStatus>): FileNode => {
    const newNode = { ...node, gitStatus: statuses.get(node.path) };
    if (newNode.children) {
        newNode.children = newNode.children.map(child => updateGitStatusRecursive(child, statuses));
    }
    return newNode;
};

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      fileTree: null,
      rootPath: null,
      openedFiles: [],
      activeFileId: null,
      gitStatuses: new Map(),

      setFileTree: (tree) => set((state) => {
        const treeWithStatus = tree ? updateGitStatusRecursive(tree, state.gitStatuses) : null;
        return { fileTree: treeWithStatus, rootPath: tree ? tree.path : null };
      }),
      setRootPath: (path) => set({ rootPath: path }),

      openFile: (file) => set((state) => {
        const existing = state.openedFiles.find(f => f.path === file.path);
        if (existing) {
          const updatedFiles = state.openedFiles.map(f => 
            f.id === existing.id ? { ...f, initialLine: file.initialLine } : f
          );
          return { activeFileId: existing.id, openedFiles: updatedFiles };
        }
        return {
          openedFiles: [...state.openedFiles, file],
          activeFileId: file.id,
        };
      }),

      closeFile: (id) => set((state) => {
        const newFiles = state.openedFiles.filter(f => f.id !== id);
        let newActiveId = state.activeFileId;
        if (state.activeFileId === id) {
          newActiveId = newFiles.length > 0 ? newFiles[newFiles.length - 1].id : null;
        }
        return {
          openedFiles: newFiles,
          activeFileId: newActiveId,
        };
      }),

      setActiveFile: (id) => set({ activeFileId: id }),

      updateFileContent: (id, content) => set((state) => ({
        openedFiles: state.openedFiles.map(f => 
          f.id === id ? { ...f, content, isDirty: true } : f
        ),
      })),

      setFileDirty: (id, isDirty) => set((state) => ({
        openedFiles: state.openedFiles.map(f => 
          f.id === id ? { ...f, isDirty } : f
        ),
      })),
      
      setGitStatuses: (statuses) => set((state) => {
        // Re-apply statuses to existing fileTree if any
        const updatedTree = state.fileTree ? updateGitStatusRecursive(state.fileTree, statuses) : null;
        return { gitStatuses: statuses, fileTree: updatedTree };
      }),

    }),
    {
      name: 'file-storage',
      partialize: (state) => ({ 
        openedFiles: state.openedFiles.map(f => ({ ...f, content: '' })), // Don't persist content
        activeFileId: state.activeFileId,
        rootPath: state.rootPath 
      }),
      // Custom merge function for deep merge on hydration if needed. For now default is fine.
      // Since we reconstruct fileTree from rootPath, we don't really need to persist fileTree.
      // And openedFiles content will be re-read anyway. So partialize above is good.
    }
  )
);
