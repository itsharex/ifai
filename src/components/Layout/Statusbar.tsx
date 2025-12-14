import React, { useEffect, useState } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { listen } from '@tauri-apps/api/event';

export const Statusbar = () => {
  const { activeFileId, openedFiles } = useFileStore();
  const activeFile = openedFiles.find(f => f.id === activeFileId);
  const [ragStatus, setRagStatus] = useState('');

  useEffect(() => {
    const unlisten = listen<string>('rag-status', (event) => {
      setRagStatus(event.payload);
    });
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  return (
    <div className="h-6 bg-blue-600 flex items-center px-4 text-xs text-white select-none justify-between">
      <div className="flex items-center space-x-4">
        <span>{activeFile ? activeFile.path : 'No file open'}</span>
        {ragStatus && <span className="opacity-80">| {ragStatus}</span>}
      </div>
      <div className="flex items-center space-x-4">
        <span>UTF-8</span>
        <span>{activeFile?.language || 'Plain Text'}</span>
      </div>
    </div>
  );
};