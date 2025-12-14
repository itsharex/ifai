import React, { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useChatStore } from '../../stores/useChatStore';
import { Sparkles, X, ArrowUp } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { v4 as uuidv4 } from 'uuid';
import { Range } from 'monaco-editor';

export const InlineEditWidget = () => {
  const { editorInstance, inlineEdit, closeInlineEdit } = useEditorStore();
  const { apiKey } = useChatStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ display: 'none' });

  useEffect(() => {
    if (inlineEdit.isVisible && editorInstance && inlineEdit.position) {
      const coords = editorInstance.getScrolledVisiblePosition(inlineEdit.position);
      if (coords) {
        setStyle({
          display: 'flex',
          top: coords.top + 30, // Position below the cursor line
          left: coords.left + 50, // Slight offset
        });
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } else {
      setStyle({ display: 'none' });
      setInput('');
    }
  }, [inlineEdit.isVisible, inlineEdit.position, editorInstance]);

  const handleSubmit = async () => {
    if (!input.trim() || !apiKey || !editorInstance || !inlineEdit.selection) return;
    
    setIsLoading(true);
    const selection = inlineEdit.selection;
    const model = editorInstance.getModel();
    if (!model) return;

    const originalCode = model.getValueInRange(selection);
    
    // Construct Prompt
    const prompt = `You are a coding assistant. Rewrite the following code based on the user's instruction.
IMPORTANT: Output ONLY the code. Do NOT wrap in markdown blocks. Do NOT add explanations.

Code:
${originalCode}

Instruction:
${input}`;

    const eventId = `inline_edit_${uuidv4()}`;
    let generatedCode = '';

    try {
        const unlistenData = await listen<string>(eventId, (event) => {
            generatedCode += event.payload;
            // Real-time replacement? No, let's buffer or stream replace.
            // Stream replacing whole block is tricky because we need to track end position.
            // For MVP, let's accumulate and replace at the end, OR 
            // Replace the selection continuously? 
            // Let's Replace continuously!
            
            // To do this properly without messing up cursor, we usually replace the whole range.
            // But streaming updates to a range is hard.
            // EASIER MVP: Show loading, wait for full response, then replace.
            // STREAMING MVP: Use a separate decoration or "Ghost text".
            
            // Let's stick to: Wait for full response -> Replace. Safer.
        });

        const cleanup = () => {
            setIsLoading(false);
            unlistenData();
            unlistenError();
            unlistenFinish();
            closeInlineEdit();
        };

        const unlistenError = await listen<string>(`${eventId}_error`, (event) => {
            console.error('Inline Edit Error:', event.payload);
            cleanup();
        });

        const unlistenFinish = await listen<string>(`${eventId}_finish`, () => {
            // Apply edit
            if (generatedCode) {
                // Ensure we replace the correct range (it might have moved, but we assume user didn't type)
                editorInstance.executeEdits('inline-ai', [{
                    range: selection,
                    text: generatedCode,
                    forceMoveMarkers: true
                }]);
            }
            cleanup();
        });

        const history = [{ role: 'user', content: prompt }];
        await invoke('ai_chat', { 
            apiKey, 
            messages: history, 
            eventId 
        });

    } catch (e) {
        console.error(e);
        setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleSubmit();
    } else if (e.key === 'Escape') {
        closeInlineEdit();
    }
  };

  if (!inlineEdit.isVisible) return null;

  return (
    <div 
        className="absolute z-50 bg-[#252526] border border-gray-600 rounded-lg shadow-2xl p-2 w-[400px] flex items-center gap-2"
        style={style}
    >
        <div className="text-blue-400">
            {isLoading ? <span className="animate-spin text-lg">⟳</span> : <Sparkles size={16} />}
        </div>
        <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder-gray-500"
            placeholder="Edit with AI (e.g. 'Add comments')..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
        />
        {isLoading ? null : (
            <button onClick={closeInlineEdit} className="text-gray-400 hover:text-white">
                <X size={14} />
            </button>
        )}
    </div>
  );
};
