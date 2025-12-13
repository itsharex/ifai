import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useFileStore } from '../../stores/fileStore';
import { invoke } from '@tauri-apps/api/core';
import Fuse from 'fuse.js';

interface CommandPaletteProps {
  onSelect?: (path: string) => void;
}

export const CommandPalette = ({ onSelect }: CommandPaletteProps) => {
  const { isCommandPaletteOpen, setCommandPaletteOpen } = useLayoutStore();
  const { rootPath } = useFileStore();
  const [input, setInput] = useState('');
  const [allFilePaths, setAllFilePaths] = useState<string[]>([]);
  const [results, setResults] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fuse = useRef<Fuse<string> | null>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      inputRef.current?.focus();
      // Load all file paths when palette opens
      if (rootPath) {
        const loadFilePaths = async () => {
          try {
            const paths = await invoke<string[]>('get_all_file_paths', { rootDir: rootPath });
            setAllFilePaths(paths);
            fuse.current = new Fuse(paths, { includeScore: true, ignoreLocation: true, threshold: 0.4 });
            // Initial search (e.g., show recent or a few items)
            setResults(paths.slice(0, 10)); // Show first 10 for quick access
          } catch (e) {
            console.error("Failed to load file paths:", e);
          }
        };
        loadFilePaths();
      }
    } else {
      setInput('');
      setResults([]);
      setAllFilePaths([]);
    }
  }, [isCommandPaletteOpen, rootPath]);

  const handleClose = () => {
    setCommandPaletteOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setInput(query);

    if (query.trim() === '') {
      setResults(allFilePaths.slice(0, 10)); // Show initial set if empty
      return;
    }

    if (fuse.current) {
      const searchResults = fuse.current.search(query);
      setResults(searchResults.map(result => result.item));
    }
  };

  const handleSelect = (path: string) => {
    onSelect?.(path);
    handleClose();
  };

  // Handle keyboard navigation (up/down/enter) - basic for now
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter') {
      if (results.length > 0) {
        handleSelect(results[0]); // Select first result on Enter
      }
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-black bg-opacity-50"
      onClick={handleClose} // Close when clicking outside
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl w-[500px] flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="relative p-2 border-b border-gray-700">
          <input 
            ref={inputRef}
            type="text"
            className="w-full bg-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Go to file, symbol, or run command..."
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          <button 
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            onClick={handleClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {results.length > 0 ? (
            results.map((path, index) => (
              <div 
                key={path} // Use path as key since it's unique
                className="px-4 py-2 text-sm text-gray-200 hover:bg-blue-600 hover:text-white cursor-pointer"
                onClick={() => handleSelect(path)}
              >
                {path.replace(rootPath || '', '').substring(1) || path} {/* Show relative path */}
              </div>
            ))
          ) : (rootPath ? (
            <div className="px-4 py-2 text-sm text-gray-400">No matching files.</div>
          ) : (
            <div className="px-4 py-2 text-sm text-gray-400">Open a folder to search files.</div>
          ))}
        </div>
      </div>
    </div>
  );
};
