import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Hash, Image as ImageIcon, AtSign, X } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useFileStore } from '../../stores/fileStore';
import { ImageInput } from '../Multimodal/ImageInput';
import { FuzzyFileSearch } from './FuzzyFileSearch';
import type { ImageAttachment } from '../../types/multimodal';
import clsx from 'clsx';

interface ChatInputAreaProps {
  isLoading: boolean;
}

/**
 * v0.3.5: 顶级重构 - 工业级聊天输入框
 */
export const ChatInputArea: React.FC<ChatInputAreaProps> = ({ isLoading }) => {
  const [input, setInput] = useState('');
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionMentionFilter] = useState('');
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage } = useChatStore();
  const { currentProviderId, currentModel } = useSettingsStore();
  const { allFilePaths, refreshFileTree } = (window as any).__DEBUG__?.fileStore?.getState() || useFileStore.getState();

  // v0.3.5: 索引自愈
  useEffect(() => {
    const store = useFileStore.getState();
    if (store.allFilePaths.length === 0) {
      console.log('[ChatInput] File index empty, triggering self-healing refresh...');
      store.refreshFileTree();
    }
  }, []);

  // 自动调整高度
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

    // 检测 @ 触发
    const lastChar = value[value.length - 1];
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowMention(true);
      setMentionMentionFilter(mentionMatch[1]);
    } else {
      setShowMention(false);
    }
  };

  const handleSelectFile = (filePath: string) => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBefore = input.slice(0, cursorPosition).replace(/@\w*$/, '');
    const textAfter = input.slice(cursorPosition);
    
    // 以标记形式插入 (后续可以解析为 Chip)
    const fileName = filePath.split('/').pop();
    const newValue = `${textBefore}[#${fileName}](${filePath}) ${textAfter}`;
    
    setInput(newValue);
    setShowMention(false);
    textareaRef.current?.focus();
  };

  const handleSend = async () => {
    if ((!input.trim() && imageAttachments.length === 0) || isLoading) return;
    
    // 构建发送内容 (如果是多模态，目前逻辑在 useChatStore 处理)
    // 注意：这里我们优先支持 v0.3.4 的 sendMessage 协议
    await sendMessage(input, currentProviderId, currentModel);
    
    setInput('');
    setImageAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMention) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative group">
      {/* 文件搜索弹窗 */}
      {showMention && (
        <FuzzyFileSearch 
          filter={mentionFilter} 
          onSelect={handleSelectFile} 
          onClose={() => setShowMention(false)} 
        />
      )}

      {/* 主容器：Glassmorphism */}
      <div className={clsx(
        "relative flex flex-col w-full transition-all duration-500 rounded-2xl border bg-[#1e1e1e]/60 backdrop-blur-xl",
        "border-gray-700/50 shadow-lg group-focus-within:border-blue-500/50 group-focus-within:shadow-[0_0_20px_rgba(59,130,246,0.1)]",
        isLoading && "opacity-80"
      )}>
        
        {/* 图片预览区域 (紧凑型) */}
        {imageAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 border-b border-gray-800/50 animate-in slide-in-from-top-2 duration-300">
            {imageAttachments.map(img => (
              <div key={img.id} className="relative group/img">
                <img src={img.previewUrl} className="w-12 h-12 rounded-lg object-cover border border-gray-700 shadow-sm" />
                <button 
                  onClick={() => setImageAttachments(prev => prev.filter(i => i.id !== img.id))}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 p-2">
          {/* 文本输入区 */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="问问 IfAI，或者输入 @ 引用文件..."
            className="flex-1 max-h-48 min-h-[40px] py-2 px-3 bg-transparent outline-none text-gray-200 text-sm placeholder-gray-500 resize-none leading-relaxed"
          />

          {/* 操作轨道 (Interaction Rail) */}
          <div className="flex items-center gap-1.5 pb-1 pr-1">
            {/* 图片上传 */}
            <div className="relative">
               <ImageInput 
                 attachments={imageAttachments}
                 onAddAttachment={(a) => setImageAttachments(prev => [...prev, a])}
                 onRemoveAttachment={(id) => setImageAttachments(prev => prev.filter(i => i.id !== id))}
                 disabled={isLoading}
               />
            </div>

            {/* 文件引用快捷键 */}
            <button
              onClick={() => setShowMention(!showMention)}
              className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all duration-300"
              title="引用文件"
            >
              <Hash size={18} />
            </button>

            {/* 发送按钮 */}
            <button
              onClick={handleSend}
              data-testid="send-button"
              disabled={(!input.trim() && imageAttachments.length === 0) || isLoading}
              className={clsx(
                "p-2 rounded-xl transition-all duration-500 flex items-center justify-center",
                input.trim() 
                  ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)] scale-105 active:scale-95" 
                  : "bg-gray-800 text-gray-600 opacity-50"
              )}
            >
              <Send size={18} className={clsx(input.trim() && "animate-pulse-subtle")} />
            </button>
          </div>
        </div>
      </div>
      
      {/* 底部装饰：微光边框 */}
      <div className="absolute inset-x-4 -bottom-px h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
