import React from 'react';
import { PromptList } from './PromptList';
import { PromptEditor } from './PromptEditor';
import { usePromptStore } from '../../stores/promptStore';

export const PromptManager: React.FC = () => {
  const selectedPrompt = usePromptStore(state => state.selectedPrompt);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <PromptList />
      {/* Force remount on path change to ensure fresh editor state */}
      <PromptEditor key={selectedPrompt?.path || 'empty'} />
    </div>
  );
};
