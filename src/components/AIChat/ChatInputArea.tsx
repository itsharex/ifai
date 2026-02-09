import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Hash, Image as ImageIcon, AtSign, X, Code, Terminal } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useFileStore } from '../../stores/fileStore';
import { ImageInput } from '../Multimodal/ImageInput';
import { FuzzyFileSearch } from './FuzzyFileSearch';
import { SymbolSearch } from './SymbolSearch';
import { SlashCommandList } from './SlashCommandList';
import { ContextHUD } from './ContextHUD';
import type { ImageAttachment } from '../../types/multimodal';
import clsx from 'clsx';

interface ChatInputAreaProps {
  isLoading: boolean;
}

/**
 * v0.3.5: 顶级重构 - 工业级聊天输入框 (全功能集成版)
 */
export const ChatInputArea: React.FC<ChatInputAreaProps> = ({ isLoading }) => {
  const [input, setInput] = useState('');
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [showSymbol, setShowSymbol] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage } = useChatStore();
  const { currentProviderId, currentModel } = useSettingsStore();
  const { allFilePaths, refreshFileTree } = useFileStore();

  // v0.3.5: 索引自愈
  useEffect(() => {
    if (allFilePaths.length === 0) {
      refreshFileTree();
    }
  }, []);

  // 自动高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    const cursor = e.target.selectionStart || 0;
    const textBefore = value.slice(0, cursor);
    
    const mMatch = textBefore.match(/@([\w.-]*)$/);
    const sMatch = textBefore.match(/#([\w-]*)$/);
    const slashMatch = textBefore.match(/^\/(\w*)$/);

    if (mMatch) {
      setShowMention(true); setMentionFilter(mMatch[1]);
      setShowSymbol(false); setShowCommands(false);
    } else if (sMatch) {
      setShowSymbol(true); setSymbolFilter(sMatch[1]);
      setShowMention(false); setShowCommands(false);
    } else if (slashMatch) {
      setShowCommands(true);
      setShowMention(false); setShowSymbol(false);
    } else {
      setShowMention(false); setShowSymbol(false); setShowCommands(false);
    }
  };

  const handleSelectFile = (filePath: string) => {
    const cursor = textareaRef.current?.selectionStart || 0;
    const textBefore = input.slice(0, cursor).replace(/@[\w.-]*$/, '');
    const textAfter = input.slice(cursor);
    setInput(`${textBefore}[#${filePath.split('/').pop()}](${filePath}) ${textAfter}`);
    setShowMention(false);
    textareaRef.current?.focus();
  };

  const handleSelectSymbol = (symbol: any) => {
    const cursor = textareaRef.current?.selectionStart || 0;
    const textBefore = input.slice(0, cursor).replace(/#[\w-]*$/, '');
    const textAfter = input.slice(cursor);
    const activeFile = useFileStore.getState().activeFileId || '';
    setInput(`${textBefore}[#${symbol.name}](${activeFile}:${symbol.line}-${symbol.line + 15}) ${textAfter}`);
    setShowSymbol(false);
    textareaRef.current?.focus();
  };

  const handleSelectCommand = (cmd: string) => {
    setInput(cmd + ' ');
    setShowCommands(false);
    textareaRef.current?.focus();
  };

  const handleSend = async () => {
    if ((!input.trim() && imageAttachments.length === 0) || isLoading) return;
    await sendMessage(input, currentProviderId, currentModel);
    setInput('');
    setImageAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMention && !showSymbol && !showCommands) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeReferences = React.useMemo(() => {
    const matches = [...input.matchAll(/\[#(.*?)\]\((.*?)\)/g)];
    return matches.map(m => ({ name: m[1], path: m[2], fullMatch: m[0] }));
  }, [input]);

  return (
    <div className="relative group" data-testid="chat-input-area">
      {showMention && <FuzzyFileSearch filter={mentionFilter} onSelect={handleSelectFile} onClose={() => setShowMention(false)} />}
      {showSymbol && <SymbolSearch filter={symbolFilter} onSelect={handleSelectSymbol} onClose={() => setShowSymbol(false)} />}
      {showCommands && <SlashCommandList filter={input} onSelect={handleSelectCommand} onClose={() => setShowCommands(false)} />}

      <div className={clsx(
        "relative flex flex-col w-full transition-all duration-500 rounded-2xl border bg-[#1e1e1e]/60 backdrop-blur-xl border-gray-700/50 shadow-lg group-focus-within:border-blue-500/50",
        isLoading && "opacity-80"
      )}>
        {(imageAttachments.length > 0 || activeReferences.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-800/50">
            {activeReferences.map(ref => (
              <div key={ref.path} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-medium group/chip hover:bg-blue-500/20 transition-colors">
                <Hash size={10} />
                <span className="max-w-[120px] truncate">{ref.name}</span>
                <button onClick={() => setInput(prev => prev.replace(ref.fullMatch, '').trim())} className="hover:text-blue-300 opacity-60 group-hover/chip:opacity-100"><X size={10} /></button>
              </div>
            ))}
            {imageAttachments.map(img => (
              <div key={img.id} className="relative group/img">
                <img src={img.previewUrl} className="w-10 h-10 rounded-lg object-cover border border-gray-700 shadow-sm" />
                <button onClick={() => setImageAttachments(prev => prev.filter(i => i.id !== img.id))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100"><X size={10} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 p-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="问问 IfAI，输入 @ 引用文件, # 符号, / 命令..."
            className="flex-1 max-h-48 min-h-[40px] py-2 px-3 bg-transparent outline-none text-gray-200 text-sm placeholder-gray-500 resize-none leading-relaxed"
          />

          <div className="flex flex-col items-end gap-2">
            <ContextHUD text={input} />
            <div className="flex items-center gap-1.5 pb-1 pr-1">
              <ImageInput 
                attachments={imageAttachments}
                onAddAttachment={(a) => setImageAttachments(prev => [...prev, a])}
                onRemoveAttachment={(id) => setImageAttachments(prev => prev.filter(i => i.id !== id))}
                disabled={isLoading}
              />
              <button onClick={() => setShowMention(!showMention)} className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all" title="引用文件"><AtSign size={18} /></button>
              <button onClick={() => setShowSymbol(!showSymbol)} className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all" title="引用符号"><Hash size={18} /></button>
              <button onClick={handleSend} data-testid="send-button" disabled={(!input.trim() && imageAttachments.length === 0) || isLoading} className={clsx("p-2 rounded-xl transition-all", input.trim() ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)] scale-105 active:scale-95" : "bg-gray-800 text-gray-600")}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
