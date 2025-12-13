import React, { useEffect } from 'react';
import { Titlebar } from './components/Layout/Titlebar';
import { Sidebar } from './components/Layout/Sidebar';
import { Statusbar } from './components/Layout/Statusbar';
import { MonacoEditor } from './components/Editor/MonacoEditor';
import { TabBar } from './components/Editor/TabBar';
import { AIChat } from './components/AIChat/AIChat';
import { useFileStore } from './stores/fileStore';
import { useEditorStore } from './stores/editorStore';
import { useLayoutStore } from './stores/layoutStore';
import { writeFileContent } from './utils/fileSystem';
import { Toaster, toast } from 'sonner';

function App() {
  const { activeFileId, openedFiles, setFileDirty } = useFileStore();
  const { editorInstance } = useEditorStore();
  const { isChatOpen, toggleChat } = useLayoutStore();

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        const activeFile = openedFiles.find(f => f.id === activeFileId);
        if (activeFile) {
          try {
            await writeFileContent(activeFile.path, activeFile.content);
            setFileDirty(activeFile.id, false);
            toast.success('File saved');
          } catch (error) {
            console.error('Failed to save file:', error);
            toast.error('Failed to save file');
          }
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        if (editorInstance) {
          editorInstance.getAction('actions.find')?.run();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        // Toggle Chat with Cmd+L
        e.preventDefault();
        toggleChat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileId, openedFiles, setFileDirty, editorInstance, toggleChat]);

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white overflow-hidden">
      <Toaster position="bottom-right" theme="dark" />
      <Titlebar onToggleChat={toggleChat} isChatOpen={isChatOpen} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
          <TabBar />
          <div className="flex-1 relative">
            <MonacoEditor />
          </div>
        </div>

        {isChatOpen && <AIChat />}
      </div>
      
      <Statusbar />
    </div>
  );
}

export default App;