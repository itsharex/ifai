import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from '../../stores/fileStore';
import { Loader2, Search } from 'lucide-react';
import { readFileContent } from '../../utils/fileSystem';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';

interface SearchResult {
  path: string;
  line_number: number;
  content: string;
}

export const SearchPanel = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { rootPath, openFile } = useFileStore();

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || !rootPath) return;

    setIsSearching(true);
    try {
      const matches = await invoke<SearchResult[]>('search_in_files', {
        rootPath,
        query
      });
      setResults(matches);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = async (result: SearchResult) => {
    try {
      const content = await readFileContent(result.path);
      openFile({
        id: uuidv4(),
        path: result.path,
        name: result.path.split('/').pop() || t('common.untitled'),
        content,
        isDirty: false,
        language: 'plaintext', 
        initialLine: Number(result.line_number)
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-r border-gray-700 w-64">
      <div className="p-2 border-b border-gray-700">
        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 block">{t('search.title')}</span>
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            className="w-full bg-[#3c3c3c] text-white rounded p-1 pl-2 text-sm focus:outline-none border border-transparent focus:border-blue-500"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button 
            type="submit" 
            className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            disabled={isSearching}
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto">
        {results.map((result, index) => (
          <div 
            key={index} 
            className="p-2 hover:bg-gray-800 cursor-pointer border-b border-gray-800"
            onClick={() => handleResultClick(result)}
          >
            <div className="text-xs text-blue-400 truncate mb-1" title={result.path}>
              {result.path.replace(rootPath || '', '').substring(1)}
            </div>
            <div className="text-xs text-gray-300 font-mono truncate">
              <span className="text-gray-500 mr-2">{result.line_number}:</span>
              {result.content.trim()}
            </div>
          </div>
        ))}
        {!isSearching && results.length === 0 && query && (
          <div className="p-4 text-center text-gray-500 text-xs">{t('search.noResults')}</div>
        )}
        {!rootPath && (
            <div className="p-4 text-center text-gray-500 text-xs">{t('search.openFolder')}</div>
        )}
      </div>
    </div>
  );
};
