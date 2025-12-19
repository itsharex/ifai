import React, { useEffect, useState } from 'react';
import { Search, ShieldCheck, TestTube, FileText, Zap } from 'lucide-react';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const COMMANDS: Command[] = [
  { id: '/explore', label: 'Explore', description: 'Deep codebase search & analysis', icon: <Search size={16} /> },
  { id: '/review', label: 'Review', description: 'Code review & security audit', icon: <ShieldCheck size={16} /> },
  { id: '/test', label: 'Test', description: 'Generate unit/integration tests', icon: <TestTube size={16} /> },
  { id: '/doc', label: 'Doc', description: 'Generate documentation', icon: <FileText size={16} /> },
  { id: '/refactor', label: 'Refactor', description: 'Code improvement suggestions', icon: <Zap size={16} /> },
];

interface Props {
  filter: string;
  onSelect: (cmd: string) => void;
  onClose: () => void;
}

export const SlashCommandList: React.FC<Props> = ({ filter, onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const filteredCommands = COMMANDS.filter(c => 
    c.id.toLowerCase().startsWith(filter.toLowerCase()) || 
    c.label.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

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
        // Prevent default only if we are handling the selection
        // But we need to be careful not to block normal Enter if list is hidden
        // This component is only mounted when visible, so we should block.
        e.preventDefault();
        e.stopPropagation();
        onSelect(filteredCommands[selectedIndex].id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true }); // Capture to intercept before InputArea
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [filteredCommands, selectedIndex, onSelect, onClose]);

  if (filteredCommands.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-[#252526] border border-gray-200 dark:border-[#3e3e42] rounded-lg shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-150">
      <div className="text-[10px] uppercase font-bold text-gray-400 px-3 py-2 bg-gray-50 dark:bg-[#2d2d2d] border-b border-gray-100 dark:border-[#3e3e42]">
        Available Agents
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {filteredCommands.map((cmd, index) => (
          <div
            key={cmd.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
              index === selectedIndex
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2d2d2d]'
            }`}
            onClick={() => onSelect(cmd.id)}
          >
            <div className={`flex items-center justify-center w-6 h-6 rounded ${index === selectedIndex ? 'bg-white/20' : 'bg-gray-100 dark:bg-[#333333]'}`}>
                {React.cloneElement(cmd.icon as React.ReactElement, { size: 14 })}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate leading-none mb-0.5 flex items-center">
                  {cmd.id}
                  {index === selectedIndex && <span className="ml-2 text-[10px] opacity-70 font-normal">↵</span>}
              </span>
              <span className={`text-[10px] truncate ${index === selectedIndex ? 'text-blue-100' : 'text-gray-500'}`}>
                {cmd.description}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
