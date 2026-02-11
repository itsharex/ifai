
import React from 'react';
import { motion } from 'framer-motion';
import { Settings, Check, ChevronRight } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

interface ModelCapsulePanelProps {
  onClose: () => void;
  setSettingsOpen: (open: boolean) => void;
}

export const ModelCapsulePanel: React.FC<ModelCapsulePanelProps> = ({ onClose, setSettingsOpen }) => {
  const providers = useSettingsStore(state => state.providers);
  const currentProviderId = useSettingsStore(state => state.currentProviderId);
  const currentModel = useSettingsStore(state => state.currentModel);
  const setCurrentProviderAndModel = useSettingsStore(state => state.setCurrentProviderAndModel);

  const currentProvider = providers.find(p => p.id === currentProviderId);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="absolute top-full left-4 right-4 mt-2 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden backdrop-blur-xl"
    >
      <div className="p-2 border-b border-white/5 bg-white/5">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">选择模型</span>
      </div>
      
      <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-1">
        {providers.filter(p => p.enabled).map(provider => (
          <div key={provider.id} className="space-y-1">
            <div className="px-2 py-1 text-[11px] font-bold text-blue-400/70 flex items-center gap-2">
              <span>{provider.name}</span>
              <div className="h-px flex-1 bg-blue-400/10" />
            </div>
            {provider.models.map(model => {
              const isActive = provider.id === currentProviderId && model === currentModel;
              return (
                <button
                  key={model}
                  onClick={() => {
                    setCurrentProviderAndModel(provider.id, model);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                    isActive 
                      ? 'bg-blue-600/20 text-blue-400' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  <span className="truncate">{model}</span>
                  {isActive && <Check size={12} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-1.5 border-t border-white/5 bg-gray-950/50">
        <button
          onClick={() => {
            setSettingsOpen(true);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-gray-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <Settings size={12} />
          <span>进阶模型设置</span>
          <ChevronRight size={10} className="ml-auto" />
        </button>
      </div>
    </motion.div>
  );
};
