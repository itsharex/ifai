import React, { useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useEditorStore } from '../../stores/editorStore';
import { useFileStore } from '../../stores/fileStore';
import { useChatStore } from '../../stores/useChatStore';
import { useLayoutStore } from '../../stores/layoutStore';

export const MonacoEditor = () => {
  const { setEditorInstance, theme } = useEditorStore();
  const { activeFileId, openedFiles, updateFileContent } = useFileStore();
  const { sendMessage } = useChatStore();
  const { setChatOpen } = useLayoutStore();

  const activeFile = openedFiles.find(f => f.id === activeFileId);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    setEditorInstance(editor);

    // Add "Explain Code" Action
    editor.addAction({
        id: 'explain-code',
        label: 'AI: Explain Code',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run: async (ed) => {
            const selection = ed.getSelection();
            const text = selection ? ed.getModel()?.getValueInRange(selection) : '';
            if (text && text.trim().length > 0) {
                setChatOpen(true);
                const prompt = `Explain the following code:\n\n\`\`\`${activeFile?.language || ''}\n${text}\n\`\`\``;
                await sendMessage(prompt);
            }
        }
    });

    // Add "Refactor Code" Action
    editor.addAction({
        id: 'refactor-code',
        label: 'AI: Refactor Code',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.6,
        run: async (ed) => {
            const selection = ed.getSelection();
            const text = selection ? ed.getModel()?.getValueInRange(selection) : '';
            if (text && text.trim().length > 0) {
                setChatOpen(true);
                const prompt = `Refactor the following code to be more efficient and readable:\n\n\`\`\`${activeFile?.language || ''}\n${text}\n\`\`\``;
                await sendMessage(prompt);
            }
        }
    });
  };

  const handleChange = (value: string | undefined) => {
    if (activeFileId && value !== undefined) {
      updateFileContent(activeFileId, value);
    }
  };

  if (!activeFile) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 bg-[#1e1e1e]">
        <div className="text-center">
          <p className="mb-2">No file is open</p>
          <p className="text-xs">Use Cmd+O to open a file</p>
        </div>
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      path={activeFile.path} // Unique key for model caching
      defaultLanguage={activeFile.language || 'plaintext'}
      language={activeFile.language}
      value={activeFile.content}
      theme={theme}
      onChange={handleChange}
      onMount={handleEditorDidMount}
      options={{
        minimap: { enabled: true },
        fontSize: 14,
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
    />
  );
};
