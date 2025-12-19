import React from 'react';
import { PromptList } from './PromptList';
import { PromptEditor } from './PromptEditor';

export const PromptManager: React.FC = () => {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <PromptList />
      <PromptEditor />
    </div>
  );
};
