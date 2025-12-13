import React, { useState, useEffect, useRef } from 'react';
import { Send, Settings, User, Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '../../stores/useChatStore';
import { v4 as uuidv4 } from 'uuid';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const AIChat = () => {
  const { messages, isLoading, apiKey, setApiKey, addMessage, updateMessageContent, setLoading } = useChatStore();
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !apiKey) return;
    if (isLoading) return;

    const userMsgId = uuidv4();
    const assistantMsgId = uuidv4();
    const eventId = `chat_${assistantMsgId}`;

    addMessage({ id: userMsgId, role: 'user', content: input });
    addMessage({ id: assistantMsgId, role: 'assistant', content: '' });
    setInput('');
    setLoading(true);

    try {
      // Setup listeners before invoking
      const unlistenData = await listen<string>(eventId, (event) => {
        useChatStore.getState().updateMessageContent(assistantMsgId, 
            useChatStore.getState().messages.find(m => m.id === assistantMsgId)?.content + event.payload
        );
      });
      
      const unlistenError = await listen<string>(`${eventId}_error`, (event) => {
        console.error('Chat error:', event.payload);
        setLoading(false);
        unlistenData();
        unlistenError();
        unlistenFinish();
      });

      const unlistenFinish = await listen<string>(`${eventId}_finish`, () => {
        setLoading(false);
        unlistenData();
        unlistenError();
        unlistenFinish();
      });

      // Invoke Rust command
      // Filter messages to send only role and content
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: input });

      await invoke('ai_chat', { 
        apiKey, 
        messages: history, 
        eventId 
      });

    } catch (e) {
      console.error('Failed to invoke ai_chat', e);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!apiKey || showSettings) {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-gray-700 p-4">
        <h2 className="text-lg font-bold mb-4 text-gray-200 flex items-center">
            <Settings className="mr-2" size={20}/> Settings
        </h2>
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">DeepSeek API Key</label>
            <input 
                type="password"
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
            />
        </div>
        <button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors"
            onClick={() => setShowSettings(false)}
            disabled={!apiKey}
        >
            Save & Start Chatting
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-gray-700 w-80">
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-[#252526]">
        <span className="font-bold text-gray-300 flex items-center"><Bot size={18} className="mr-2"/> AI Assistant</span>
        <button onClick={() => setShowSettings(true)} className="text-gray-400 hover:text-white">
            <Settings size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                msg.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-[#2d2d2d] text-gray-200'
            }`}>
                <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-[#2d2d2d] rounded-lg p-3">
                    <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-700 bg-[#252526]">
        <div className="relative">
            <textarea
                className="w-full bg-[#3c3c3c] text-white rounded p-2 pr-10 text-sm focus:outline-none resize-none h-20"
                placeholder="Ask DeepSeek..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
            />
            <button 
                className={`absolute bottom-2 right-2 p-1 rounded ${
                    input.trim() && !isLoading ? 'text-blue-400 hover:text-blue-300' : 'text-gray-500 cursor-not-allowed'
                }`}
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
            >
                <Send size={18} />
            </button>
        </div>
      </div>
    </div>
  );
};
