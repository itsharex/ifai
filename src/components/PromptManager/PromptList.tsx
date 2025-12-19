import React, { useEffect } from 'react';
import { usePromptStore } from '../../stores/promptStore';

export const PromptList: React.FC = () => {
  const { prompts, loadPrompts, selectPrompt, selectedPrompt } = usePromptStore();

  useEffect(() => {
    loadPrompts();
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 w-64">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold text-gray-700 dark:text-gray-200">Prompts</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {prompts.map((prompt) => (
          <div
            key={prompt.path}
            onClick={() => prompt.path && selectPrompt(prompt.path)}
            className={`p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
              selectedPrompt?.path === prompt.path ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''
            }`}
          >
            <div className="font-medium text-gray-800 dark:text-gray-200">{prompt.metadata.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{prompt.metadata.description}</div>
            <div className="mt-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    prompt.metadata.access_tier === 'public' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    prompt.metadata.access_tier === 'protected' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                    {prompt.metadata.access_tier}
                </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
