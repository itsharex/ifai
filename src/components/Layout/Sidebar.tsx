import React, { useState, useEffect } from 'react';
import { FileTree } from '../FileTree/FileTree';
import { useFileStore } from '../../stores/fileStore';
import { openDirectory, readDirectory } from '../../utils/fileSystem';
import { FolderOpen, Files, Search as SearchIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { SearchPanel } from '../Search/SearchPanel';

export const Sidebar = () => {
  const { setFileTree, rootPath, fileTree } = useFileStore();
  const [activeTab, setActiveTab] = useState<'explorer' | 'search'>('explorer');

  useEffect(() => {
    // Restore file tree from rootPath if exists
    if (rootPath && !fileTree) {
      const loadRoot = async () => {
        try {
          const name = rootPath.split('/').pop() || 'Project';
          const children = await readDirectory(rootPath);
          setFileTree({
            id: uuidv4(),
            name,
            path: rootPath,
            kind: 'directory',
            children
          });
        } catch (e) {
          console.error("Failed to restore project:", e);
        }
      };
      loadRoot();
    }
  }, [rootPath, fileTree, setFileTree]);

  const handleOpenFolder = async () => {
    const tree = await openDirectory();
    if (tree) {
      setFileTree(tree);
    }
  };

  return (
    <div className="flex h-full border-r border-gray-700 bg-gray-900">
      {/* Activity Bar */}
      <div className="w-12 flex flex-col items-center py-2 border-r border-gray-700 bg-[#1e1e1e]">
        <button 
          className={`p-2 mb-2 rounded ${activeTab === 'explorer' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          onClick={() => setActiveTab('explorer')}
          title="Explorer"
        >
          <Files size={24} />
        </button>
        <button 
          className={`p-2 mb-2 rounded ${activeTab === 'search' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          onClick={() => setActiveTab('search')}
          title="Search"
        >
          <SearchIcon size={24} />
        </button>
      </div>

      {/* Side Panel Content */}
      <div className="w-64 flex flex-col h-full bg-gray-900">
        {activeTab === 'explorer' && (
          <>
            <div className="flex items-center justify-between p-2">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Explorer</span>
              <button 
                onClick={handleOpenFolder} 
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                title="Open Folder"
              >
                <FolderOpen size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <FileTree />
            </div>
          </>
        )}
        {activeTab === 'search' && (
          <SearchPanel />
        )}
      </div>
    </div>
  );
};