import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Hash, Image as ImageIcon, AtSign, X, Code, Terminal, ChevronRight } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useFileStore } from '../../stores/fileStore';
import { ImageInput } from '../Multimodal/ImageInput';
import { FuzzyFileSearch } from './FuzzyFileSearch';
import { SymbolSearch } from './SymbolSearch';
import { SlashCommandList } from './SlashCommandList';
import { ContextHUD } from './ContextHUD';
import { ToolClassificationIndicator } from '../ToolClassification';
import type { ImageAttachment } from '../../types/multimodal';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatInputAreaProps {
  isLoading: boolean;
}

/**
 * v0.3.6: 顶级重构 - 沉浸式多模态输入框 (已修复拖拽逻辑)
 */
export const ChatInputArea: React.FC<ChatInputAreaProps> = ({ isLoading }) => {
  const [input, setInput] = useState('');
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [showSymbol, setShowSymbol] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, messages } = useChatStore();
  const { currentProviderId, currentModel } = useSettingsStore();
  const { allFilePaths, refreshFileTree } = useFileStore();

  const [historyIndex, setHistoryIndex] = useState(-1);
  const [originalInput, setOriginalInput] = useState('');

  const userHistory = React.useMemo(() => {
    return messages
      .filter(m => m.role === 'user' && typeof m.content === 'string')
      .map(m => m.content as string)
      .reverse();
  }, [messages]);

  useEffect(() => {
    if (allFilePaths.length === 0) refreshFileTree();
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // 💎 核心修复：必须阻止 dragover 默认行为
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有当离开整个输入区域时才重置
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX <= rect.left || e.clientX >= rect.right ||
      e.clientY <= rect.top || e.clientY >= rect.bottom
    ) {
      setIsDragging(false);
    }
  }, []);

  const processFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    for (const file of imageFiles) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const attachment: ImageAttachment = {
          id: crypto.randomUUID(),
          content: {
            data: base64.split(',')[1],
            mime_type: file.type,
            name: file.name,
            size: file.size,
          },
          previewUrl: base64,
          status: 'ready',
        };
        setImageAttachments(prev => [...prev, attachment]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  }, [processFiles]);

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
    
    if (imageAttachments.length > 0) {
      const contentParts: any[] = [{ type: 'text', text: input }];
      imageAttachments.forEach(img => {
        contentParts.push({
          type: 'image_url',
          image_url: { url: img.previewUrl }
        });
      });
      await sendMessage(contentParts, currentProviderId, currentModel);
    } else {
      await sendMessage(input, currentProviderId, currentModel);
    }

    setInput('');
    setImageAttachments([]);
    setHistoryIndex(-1);
    setOriginalInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isPanelOpen = showMention || showSymbol || showCommands;
    if (e.key === 'Enter' && !e.shiftKey && !isPanelOpen) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp' && !isPanelOpen && (input === '' || historyIndex !== -1)) {
      if (userHistory.length > 0 && historyIndex < userHistory.length - 1) {
        e.preventDefault();
        const newIndex = historyIndex + 1;
        if (historyIndex === -1) setOriginalInput(input);
        setHistoryIndex(newIndex);
        setInput(userHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown' && !isPanelOpen && historyIndex !== -1) {
      e.preventDefault();
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      if (newIndex === -1) setInput(originalInput);
      else setInput(userHistory[newIndex]);
    }
  };

  const activeReferences = React.useMemo(() => {
    const matches = [...input.matchAll(/\[#(.*?)\]\((.*?)\)/g)];
    return matches.map(m => ({ name: m[1], path: m[2], fullMatch: m[0] }));
  }, [input]);

  return (
    <div 
      className="relative group px-1" 
      data-testid="chat-input-area"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showMention && <FuzzyFileSearch filter={mentionFilter} onSelect={handleSelectFile} onClose={() => setShowMention(false)} />}
      {showSymbol && <SymbolSearch filter={symbolFilter} onSelect={handleSelectSymbol} onClose={() => setShowSymbol(false)} />}
      {showCommands && <SlashCommandList filter={input} onSelect={handleSelectCommand} onClose={() => setShowCommands(false)} />}

      {/* 💎 拖拽蒙层 - 优化视觉体验 */}
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-blue-600/30 backdrop-blur-md border-2 border-dashed border-blue-500 rounded-2xl flex flex-col items-center justify-center gap-3 text-white"
          >
            <div className="bg-blue-500 p-4 rounded-full shadow-2xl animate-bounce">
              <ImageIcon size={32} />
            </div>
            <span className="text-sm font-black tracking-wider">释放图片，AI 即刻读图</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        data-testid="chat-input-container"
        className={clsx(
        "relative flex flex-col w-full transition-all duration-500 rounded-2xl border bg-[#1e1e1e]/90 backdrop-blur-3xl border-white/5 shadow-2xl group-focus-within:border-blue-500/40 overflow-hidden",
        isLoading && "opacity-80"
      )}>
        {/* 🚀 沉浸式预览流 */}
        <AnimatePresence>
          {(imageAttachments.length > 0 || activeReferences.length > 0) && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap items-center gap-3 p-3 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent overflow-x-auto scrollbar-none"
            >
              {activeReferences.map(ref => (
                <div key={ref.path} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black group/chip hover:bg-blue-500/20 transition-all">
                  <Hash size={10} />
                  <span className="max-w-[120px] truncate">{ref.name}</span>
                  <button onClick={() => setInput(prev => prev.replace(ref.fullMatch, '').trim())} className="hover:text-blue-300 opacity-60 group-hover/chip:opacity-100 transition-opacity"><X size={10} /></button>
                </div>
              ))}
              {imageAttachments.map(img => (
                <motion.div layout key={img.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} data-testid="image-attachment-item" className="relative group/img">
                  <img src={img.previewUrl} className="w-14 h-14 rounded-xl object-cover border border-white/10 shadow-lg ring-2 ring-transparent group-hover/img:ring-blue-500/50 transition-all" />
                  <button onClick={() => setImageAttachments(prev => prev.filter(i => i.id !== img.id))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-all shadow-lg scale-75 group-hover/img:scale-100"><X size={10} /></button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2 p-2">
          <textarea
            ref={textareaRef}
            data-testid="chat-input"
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="问问 IfAI..."
            className="flex-1 max-h-48 min-h-[44px] py-2.5 px-3 bg-transparent outline-none text-gray-100 text-[13px] placeholder-gray-500 resize-none leading-relaxed font-semibold"
          />

          <div className="flex flex-col items-end gap-2 pb-1 pr-1">
            <div className="flex items-center gap-1.5">
              <ToolClassificationIndicator input={input} />
              <ContextHUD text={input} />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowMention(!showMention)} className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all" title="引用文件"><AtSign size={18} /></button>
              <button onClick={() => setShowSymbol(!showSymbol)} className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all" title="引用符号"><Hash size={18} /></button>
              <div className="w-px h-4 bg-white/5 mx-1" />
              <button 
                onClick={handleSend} 
                data-testid="chat-send-button" 
                disabled={(!input.trim() && imageAttachments.length === 0) || isLoading} 
                className={clsx(
                  "p-2 rounded-xl transition-all duration-300 relative overflow-hidden group/send",
                  (input.trim() || imageAttachments.length > 0) 
                    ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-105 active:scale-95" 
                    : "bg-gray-800 text-gray-600"
                )}
              >
                <motion.div
                  animate={(input.trim() || imageAttachments.length > 0) ? {
                    boxShadow: ["0 0 20px rgba(59,130,246,0.4)", "0 0 35px rgba(59,130,246,0.7)", "0 0 20px rgba(59,130,246,0.4)"]
                  } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-xl"
                />
                <Send size={18} className="relative z-10 group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
