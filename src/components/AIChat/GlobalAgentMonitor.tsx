import React, { useState, useEffect } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { X, Clock } from 'lucide-react';

export const GlobalAgentMonitor: React.FC = () => {
  const { runningAgents, removeAgent } = useAgentStore();
  const [, setTick] = useState(0);

  // Force re-render every second to update countdowns
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Debug: Track renders and agent status
  useEffect(() => {
      console.log('[GlobalAgentMonitor] Rendered with agents:', runningAgents.map(a => ({ id: a.id, status: a.status, progress: a.progress })));
  }, [runningAgents]);

  if (runningAgents.length === 0) return null;

  return (
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 max-h-[80vh] overflow-y-auto pr-2 pointer-events-none">
          {runningAgents.map(agent => {
              const remaining = agent.expiresAt ? Math.max(0, Math.ceil((agent.expiresAt - Date.now()) / 1000)) : null;

              return (
                  <div key={agent.id} className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-4 w-80 flex flex-col gap-3 group pointer-events-auto animate-in slide-in-from-bottom-4">
                      <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black truncate max-w-[140px] uppercase">{agent.type}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                agent.status === 'completed' ? 'bg-green-100 text-green-700' :
                                agent.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700 animate-pulse'
                            }`}>
                                {agent.status}
                            </span>
                            {remaining !== null && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                                    <Clock size={10} />
                                    {remaining}s
                                </span>
                            )}
                          </div>
                          <button 
                            onClick={() => removeAgent(agent.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <X size={16} />
                          </button>
                      </div>
                      
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full transition-all duration-500 ease-out ${agent.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${(agent.progress || 0) * 100}%` }} />
                      </div>

                      {agent.content && (
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-[10px] font-mono text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto border border-gray-100 dark:border-gray-800 leading-relaxed scrollbar-hide">
                              {agent.content.length > 500 ? '...' + agent.content.slice(-500) : agent.content}
                          </div>
                      )}
                      
                      {agent.logs.length > 0 && !agent.content && (
                          <div className="text-[10px] text-gray-400 truncate italic px-1 flex items-center gap-2">
                              <div className="w-1 h-1 bg-gray-400 rounded-full animate-ping" />
                              {agent.logs[agent.logs.length - 1]}
                          </div>
                      )}
                  </div>
              );
          })}
      </div>
  );
};
