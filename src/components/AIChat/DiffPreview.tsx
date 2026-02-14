import React from 'react';
import { Eye, FileText, ChevronRight } from 'lucide-react';

interface DiffPreviewProps {
  oldContent: string | null;
  newContent: string;
  fileName: string;
}

export const DiffPreview: React.FC<DiffPreviewProps> = ({ oldContent, newContent, fileName }) => {
  const isNewFile = oldContent === null;
  
  // 基础统计
  const oldLines = oldContent ? oldContent.split('\n') : [];
  const newLines = (newContent || '').split('\n');
  
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-blue-500/20 bg-blue-500/5 transition-all">
      <div className="flex items-center justify-between border-b border-blue-500/10 bg-blue-500/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-blue-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300">
            {isNewFile ? '新建文件预览' : '语义化 Diff 预览'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-blue-950/30 px-2 py-0.5 border border-blue-500/20">
          <FileText size={12} className="text-blue-400/70" />
          <span className="text-[10px] font-mono text-blue-300/80">{fileName}</span>
        </div>
      </div>
      
      <div className="p-3 max-h-[300px] overflow-auto font-mono text-[11px] leading-relaxed">
        {isNewFile ? (
          <div className="space-y-0.5">
            {newLines.slice(0, 50).map((line, i) => (
              <div key={i} className="flex gap-3 group">
                <span className="w-8 text-right text-blue-500/40 select-none">{i + 1}</span>
                <span className="text-blue-200/90 whitespace-pre-wrap">{line}</span>
              </div>
            ))}
            {newLines.length > 50 && (
              <div className="pl-11 text-blue-500/40 italic">... 还有 {newLines.length - 50} 行</div>
            )}
          </div>
        ) : (
          <div className="space-y-1">
             <div className="flex items-center gap-2 text-blue-400/60 italic mb-2">
                <ChevronRight size={12} />
                <span>智能引擎正在分析代码变更...</span>
             </div>
             <div className="p-2 rounded bg-blue-900/20 border border-blue-500/10 text-blue-200/70">
                检测到原始内容共 {oldLines.length} 行，即将覆盖为新内容（共 {newLines.length} 行）。
             </div>
          </div>
        )}
      </div>
      
      <div className="px-4 py-1.5 bg-blue-500/5 border-t border-blue-500/10 flex justify-end">
         <span className="text-[9px] text-blue-400/50 uppercase tracking-tighter">Powered by PIVO 2.0 Engine</span>
      </div>
    </div>
  );
};
