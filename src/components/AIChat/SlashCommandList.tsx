import React, { useEffect, useState, useRef } from 'react';
import { Search, ShieldCheck, TestTube, FileText, Zap, Terminal } from 'lucide-react';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const COMMANDS: Command[] = [
  { id: '/explore', label: 'Explore Agent', description: 'Deep codebase search & context gathering', icon: <Search size={16} />, color: 'bg-blue-500' },
  { id: '/review', label: 'Review Agent', description: 'Code review, security audit & best practices', icon: <ShieldCheck size={16} />, color: 'bg-purple-500' },
  { id: '/test', label: 'Test Agent', description: 'Generate unit tests & integration scenarios', icon: <TestTube size={16} />, color: 'bg-green-500' },
  { id: '/doc', label: 'Doc Agent', description: 'Generate documentation & comments', icon: <FileText size={16} />, color: 'bg-orange-500' },
  { id: '/refactor', label: 'Refactor Agent', description: 'Code improvement & architectural changes', icon: <Zap size={16} />, color: 'bg-yellow-500' },
];

interface Props {
  filter: string;
  onSelect: (cmd: string) => void;
  onClose: () => void;
}

export const SlashCommandList: React.FC<Props> = ({ filter, onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  
  const filteredCommands = COMMANDS.filter(c => 
    c.id.toLowerCase().startsWith(filter.toLowerCase()) || 
    c.label.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredCommands.length === 0) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        onSelect(filteredCommands[selectedIndex].id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [filteredCommands, selectedIndex, onSelect, onClose]);

  if (filteredCommands.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#3e3e42] rounded-lg shadow-2xl overflow-hidden z-[100] animate-in slide-in-from-bottom-2 fade-in duration-150 ring-1 ring-black/5">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50/80 dark:bg-[#252526] border-b border-gray-100 dark:border-[#3e3e42] backdrop-blur-sm">
        <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-1">
            <Terminal size={10} />
            Commands
        </span>
        <span className="text-[9px] text-gray-400 bg-gray-200 dark:bg-[#333] px-1.5 py-0.5 rounded">
            ↑↓ to navigate
        </span>
      </div>
      
      <div ref={listRef} className="max-h-72 overflow-y-auto p-1 custom-scrollbar">
        {filteredCommands.map((cmd, index) => (
          <div
            key={cmd.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all duration-75 group ${
              index === selectedIndex
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'hover:bg-gray-100 dark:hover:bg-[#2d2d2d]'
            }`}
            onClick={() => onSelect(cmd.id)}
          >
            {/* Icon Box */}
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg shadow-sm ${cmd.color} text-white`}>
                {React.cloneElement(cmd.icon as React.ReactElement, { size: 16, strokeWidth: 2.5 })}
            </div>
            
            {/* Content */}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold truncate ${index === selectedIndex ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}>
                      {cmd.id}
                  </span>
                  {index === selectedIndex && (
                      <span className="text-[10px] text-gray-400 bg-white dark:bg-black/20 px-1.5 rounded shadow-sm border border-gray-100 dark:border-white/5">
                          Enter
                      </span>
                  )}
              </div>
              <span className={`text-[11px] truncate ${index === selectedIndex ? 'text-blue-600/70 dark:text-blue-300/70' : 'text-gray-500'}`}>
                {cmd.description}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};