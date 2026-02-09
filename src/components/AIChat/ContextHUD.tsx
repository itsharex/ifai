import React, { useMemo } from 'react';
import { Cpu } from 'lucide-react';
import clsx from 'clsx';

interface ContextHUDProps {
  text: string;
  maxTokens?: number;
}

/**
 * v0.3.5: 上下文容量仪表盘 (Context HUD)
 */
export const ContextHUD: React.FC<ContextHUDProps> = ({ text, maxTokens = 32000 }) => {
  // 极速估算 Token (1 token ≈ 4 字符)
  const estimatedTokens = useMemo(() => {
    return Math.ceil(text.length / 4);
  }, [text]);

  const percentage = Math.min(100, (estimatedTokens / maxTokens) * 100);
  
  const statusColor = useMemo(() => {
    if (percentage > 80) return 'text-red-400 border-red-500/50';
    if (percentage > 50) return 'text-orange-400 border-orange-500/50';
    return 'text-blue-400 border-blue-500/50';
  }, [percentage]);

  if (text.length === 0) return null;

  return (
    <div className={clsx(
      "flex items-center gap-2 px-2 py-1 rounded-md border text-[10px] font-mono bg-gray-900/50 backdrop-blur-md transition-all duration-500 animate-in fade-in",
      statusColor
    )}>
      <Cpu size={10} className="animate-pulse" />
      <span>{estimatedTokens.toLocaleString()} / {maxTokens.toLocaleString()} TOKENS</span>
      <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={clsx("h-full transition-all duration-1000", percentage > 80 ? "bg-red-500" : "bg-blue-500")} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
    </div>
  );
};
