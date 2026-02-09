import React, { useState, useEffect, useRef } from 'react';
import { File, Hash, Search } from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import clsx from 'clsx';

interface FuzzyFileSearchProps {
  filter: string;
  onSelect: (filePath: string) => void;
  onClose: () => void;
}

/**
 * v0.3.5: 顶级文件引用系统 - 模糊搜索列表
 */
export const FuzzyFileSearch: React.FC<FuzzyFileSearchProps> = ({ filter, onSelect, onClose }) => {
  const [results, setResults] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 从 fileStore 响应式获取所有文件
  const allFilePaths = useFileStore(s => s.allFilePaths);
  
  useEffect(() => {
    const searchStr = filter.startsWith('@') ? filter.slice(1).toLowerCase() : filter.toLowerCase();
    
    // 如果 store 为空，尝试回退到物理全局变量
    const sourceList = allFilePaths.length > 0 ? allFilePaths : ((window as any).__IFAI_ALL_FILES__ || []);
    
    console.log(`[Mention] Searching "${searchStr}" in ${sourceList.length} files`);
    
    const filtered = sourceList
      .filter((f: string) => f.toLowerCase().includes(searchStr))
      .slice(0, 10);
      
    setResults(filtered);
    setSelectedIndex(0);
  }, [filter, allFilePaths]);

  // 处理键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, results.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % Math.max(1, results.length));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        onSelect(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex, onSelect, onClose]);

  if (results.length === 0 && filter.length > 1) {
    return (
      <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-2xl p-3 text-xs text-gray-500 italic animate-in fade-in slide-in-from-bottom-2">
        未找到匹配文件...
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div 
      ref={containerRef}
      data-testid="file-mention-panel"
      className="absolute bottom-full left-0 mb-2 w-80 bg-[#1e1e1e]/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 z-50"
    >
      <div className="p-2 border-b border-gray-800 bg-gray-900/50 flex items-center gap-2">
        <Search size={12} className="text-blue-400" />
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">引用文件 (@)</span>
      </div>
      <div className="max-h-60 overflow-y-auto py-1">
        {results.map((file, index) => (
          <div
            key={file}
            data-testid={`mention-item-${index}`}
            onClick={() => onSelect(file)}
            className={clsx(
              "px-3 py-2 flex items-center gap-3 cursor-pointer transition-all duration-200",
              index === selectedIndex ? "bg-blue-600/20 border-l-2 border-blue-500" : "hover:bg-white/5 border-l-2 border-transparent"
            )}
          >
            <div className={clsx(
              "p-1.5 rounded-lg",
              index === selectedIndex ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-400"
            )}>
              <File size={14} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={clsx(
                "text-sm truncate",
                index === selectedIndex ? "text-blue-100 font-medium" : "text-gray-300"
              )}>
                {file.split('/').pop()}
              </span>
              <span className="text-[10px] text-gray-500 truncate">{file}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
