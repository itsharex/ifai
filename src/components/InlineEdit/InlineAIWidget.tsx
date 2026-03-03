import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, CornerDownLeft, Loader2, Zap, ShieldCheck, Search } from 'lucide-react';
import { PivoStage } from '../../stores/types';
import { GhostTaskList, GhostTask } from './GhostTaskList';
import { FilePortal } from './FilePortal';

interface InlineAIWidgetProps {
  onClose: () => void;
  onSubmit: (text: string) => void;
  onNavigate?: (path: string) => void;
  stage?: PivoStage;
  isLoading?: boolean;
  tasks?: GhostTask[];
  modifiedFiles?: string[];
}

export const InlineAIWidget: React.FC<InlineAIWidgetProps> = ({ 
  onClose, 
  onSubmit, 
  onNavigate,
  stage = 'idle',
  isLoading = false,
  tasks = [],
  modifiedFiles = []
}) => {
  const [inputValue, setInputValue] = useState('');

  // 快捷键处理：Cmd+Enter 接受修改
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (stage !== 'idle' && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onSubmit('__ACCEPT_ALL__');
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [stage, onSubmit]);

  // PIVO 进度条颜色映射
  const getStageColor = (s: PivoStage) => {
    switch (s) {
      case 'plan': return 'bg-blue-500';
      case 'implement': return 'bg-purple-500';
      case 'verify': return 'bg-emerald-500';
      case 'optimize': return 'bg-amber-500';
      default: return 'bg-gray-600';
    }
  };

  const getStageLabel = (s: PivoStage) => {
    switch (s) {
      case 'plan': return '🔍 规划中...';
      case 'implement': return '✍️ 实施中...';
      case 'verify': return '🧪 验证中...';
      case 'optimize': return '🛡️ 优化中...';
      default: return '';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      className="inline-ai-widget relative overflow-hidden min-w-[480px] max-w-[600px] rounded-xl border border-white/10 bg-[#1e1e1e]/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] ring-1 ring-white/5"
    >
      {/* PIVO 进度线 */}
      <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden bg-white/5">
        <motion.div 
          initial={{ x: '-100%' }}
          animate={{ x: stage === 'idle' ? '-100%' : '0%' }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          className={`h-full w-full ${getStageColor(stage)} shadow-[0_0_8px_rgba(0,0,0,0.5)]`}
        />
      </div>

      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-md ${stage === 'idle' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white/70'}`}>
              <Sparkles size={14} className={isLoading ? "animate-pulse" : ""} />
            </div>
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
              {stage !== 'idle' ? getStageLabel(stage) : 'Inline Assistant'}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-white/30 hover:text-white/80 hover:bg-white/5 p-1 rounded-md transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Input Area */}
        <div className="relative group">
          <textarea
            autoFocus
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none overflow-hidden"
            placeholder="Describe changes or ask questions about this code..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (inputValue.trim()) onSubmit(inputValue);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
          
          <div className="absolute right-2 bottom-2 flex items-center gap-2">
            <span className="text-[10px] text-white/20 font-medium hidden group-focus-within:block animate-in fade-in duration-300">
              Shift + Enter for new line
            </span>
            <div className="p-1.5 rounded-md bg-white/5 text-white/20 border border-white/5">
              <CornerDownLeft size={12} />
            </div>
          </div>
        </div>

        {/* 👻 Ghost Task List */}
        <GhostTaskList tasks={tasks} />

        {/* 🚪 File Portal (Cross-file Navigation) */}
        {onNavigate && <FilePortal files={modifiedFiles} onNavigate={onNavigate} />}

        {/* Action Footer */}
        <AnimatePresence>
          {(isLoading || stage !== 'idle') && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-3"
            >
              {isLoading ? (
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-blue-500/10 text-[10px] font-bold text-blue-400">
                    <Loader2 size={10} className="animate-spin" />
                    Processing
                  </div>
                  <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      className="h-full w-1/3 bg-blue-500/40 rounded-full"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-[10px] text-white/30 font-medium">
                    <Zap size={10} />
                    Changes ready to apply
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={onClose}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-white/50 hover:text-red-400 text-xs font-bold transition-all border border-white/5"
                    >
                      Discard
                    </button>
                    <button 
                      onClick={() => onSubmit('__ACCEPT_ALL__')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={12} />
                      Accept <span className="opacity-50 text-[10px]">⌘↵</span>
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
