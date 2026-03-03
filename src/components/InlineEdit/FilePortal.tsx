import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ArrowRight, ExternalLink } from 'lucide-react';

interface FilePortalProps {
  files: string[];
  onNavigate: (path: string) => void;
}

export const FilePortal: React.FC<FilePortalProps> = ({ files, onNavigate }) => {
  if (files.length === 0) return null;

  return (
    <div className="file-portal mt-3 pt-2 border-t border-white/5">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
          Modified Files ({files.length})
        </span>
      </div>
      
      <div className="flex flex-col gap-1">
        {files.map((path) => (
          <motion.button
            key={path}
            whileHover={{ x: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            onClick={() => onNavigate(path)}
            className="flex items-center justify-between w-full px-2 py-1.5 rounded-md text-left transition-all group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={12} className="text-blue-400/60" />
              <span className="text-[11px] text-white/60 truncate font-mono">
                {path.split('/').pop()}
                <span className="text-white/20 ml-2 text-[9px]">
                  {path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : ''}
                </span>
              </span>
            </div>
            <ExternalLink size={10} className="text-white/0 group-hover:text-white/40 transition-colors" />
          </motion.button>
        ))}
      </div>
    </div>
  );
};
