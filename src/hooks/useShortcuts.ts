import { useEffect, useRef } from 'react';
import { useShortcutStore } from '../stores/shortcutStore';
import { matchesKeybinding } from '../utils/keyboard';

export const useShortcuts = (handlers: Record<string, (e: KeyboardEvent) => void>) => {
  const { keybindings } = useShortcutStore();
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Optional: Ignore inputs? 
      // const target = e.target as HTMLElement;
      // if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      
      for (const [commandId, handler] of Object.entries(handlersRef.current)) {
        const binding = keybindings.find(k => k.commandId === commandId);
        if (binding && matchesKeybinding(e, binding.keys)) {
          // e.preventDefault() is usually done by the handler if strictly needed, 
          // or we can do it here if matched?
          // Let's let the handler decide, but usually shortcuts prevent default.
          handler(e);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keybindings]);
};
