import React, { useState, useEffect } from 'react';
import { usePromptStore } from '../../stores/promptStore';
import { useAgentStore } from '../../stores/agentStore';
import { Play } from 'lucide-react';

export const PromptEditor: React.FC = () => {
  const { selectedPrompt, updatePrompt, renderTemplate } = usePromptStore();
  const { launchAgent, runningAgents } = useAgentStore();
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  
  // Dummy variables for preview - in a real app these would be dynamic
  const [testVariables, setTestVariables] = useState<Record<string, string>>({
      "USER_NAME": "Developer",
      "TARGET_LANGUAGE": "Rust",
      "PROJECT_NAME": "ifainew",
      "CWD": "/Users/mac/project/aieditor"
  });

  useEffect(() => {
    if (selectedPrompt) {
      // In a real implementation we would split metadata and content
      // For now we assume content is the whole file including frontmatter
      setContent(selectedPrompt.content);
      
      // Update test variables based on metadata
      const newVars = { ...testVariables };
      selectedPrompt.metadata.variables.forEach(v => {
          if (!newVars[v]) newVars[v] = "TEST_VALUE";
      });
      setTestVariables(newVars);
    }
  }, [selectedPrompt]);

  const handleRender = async () => {
      const result = await renderTemplate(content, testVariables);
      setPreview(result);
  };

  useEffect(() => {
      if (activeTab === 'preview') {
          handleRender();
      }
  }, [content, activeTab, testVariables]); // Re-render when content or vars change

  const handleSave = async () => {
    if (selectedPrompt?.path) {
      await updatePrompt(selectedPrompt.path, content);
      alert('Saved!');
    }
  };

  const handleRun = async () => {
      if (selectedPrompt) {
          try {
              // Use the prompt name as agent type for testing
              await launchAgent(selectedPrompt.metadata.name, "Test task triggered from Prompt Manager");
          } catch (e) {
              alert(`Launch failed: ${e}`);
          }
      }
  };

  if (!selectedPrompt) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Select a prompt to edit</div>;
  }

  const isReadOnly = selectedPrompt.metadata.access_tier !== 'public';

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-4">
            <button 
                className={`px-3 py-1 text-sm font-medium ${activeTab === 'edit' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                onClick={() => setActiveTab('edit')}
            >
                Editor
            </button>
            <button 
                className={`px-3 py-1 text-sm font-medium ${activeTab === 'preview' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                onClick={() => setActiveTab('preview')}
            >
                Preview
            </button>
        </div>
        <div className="flex items-center space-x-2">
            {isReadOnly && (
                <span className="text-xs text-yellow-600 dark:text-yellow-400 mr-2">
                    ⚠️ Read-only
                </span>
            )}
            <button 
                onClick={handleRun}
                className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                title="Launch Agent"
            >
                <Play size={14} />
            </button>
            {!isReadOnly && (
                <button 
                    onClick={handleSave}
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                >
                    Save
                </button>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
          {/* Agent execution status overlay */}
          {runningAgents.length > 0 && (
              <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
                  {runningAgents.slice(0, 3).map(agent => (
                      <div key={agent.id} className="bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 p-3 w-64">
                          <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold truncate">{agent.type}</span>
                              <span className="text-[10px] text-gray-500 uppercase">{agent.status}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                              <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${(agent.progress || 0) * 100}%` }} />
                          </div>
                          {agent.logs.length > 0 && (
                              <div className="text-[10px] text-gray-400 mt-1 truncate">{agent.logs[agent.logs.length - 1]}</div>
                          )}
                      </div>
                  ))}
              </div>
          )}

          {activeTab === 'edit' ? (
              <textarea
                className="w-full h-full p-4 font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none outline-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                readOnly={isReadOnly}
              />
          ) : (
              <div className="flex flex-col h-full">
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex gap-2 overflow-x-auto">
                      {/* Variable inputs for testing */}
                      {Object.entries(testVariables).map(([key, val]) => (
                          <div key={key} className="flex flex-col min-w-[100px]">
                              <label className="text-xs text-gray-500 truncate" title={key}>{key}</label>
                              <input 
                                className="px-2 py-1 text-xs border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={val}
                                onChange={e => setTestVariables({...testVariables, [key]: e.target.value})}
                              />
                          </div>
                      ))}
                  </div>
                  <pre className="flex-1 p-4 overflow-auto whitespace-pre-wrap font-mono text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
                      {preview}
                  </pre>
              </div>
          )}
      </div>
    </div>
  );
};
