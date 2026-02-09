import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatInputArea } from '../../src/components/AIChat/ChatInputArea';

if (typeof window === 'undefined') { (global as any).window = {}; }

vi.mock('../../src/stores/useChatStore', () => ({
  useChatStore: () => ({ sendMessage: vi.fn() }),
}));

vi.mock('../../src/stores/settingsStore', () => ({
  useSettingsStore: () => ({ currentProviderId: 'e2e', currentModel: 'm' }),
}));

vi.mock('../../src/stores/fileStore', () => ({
  useFileStore: {
    getState: () => ({ 
        allFilePaths: ['src/main.ts'], 
        activeFileId: 'src/main.ts',
        refreshFileTree: vi.fn() 
    }),
    subscribe: vi.fn(),
  }
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => [{ name: 'calculateTotal', kind: 'Function', line: 10 }]),
}));

describe('ChatInputArea Symbol Trigger (#) High-Fidelity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SHOULD trigger symbol search panel when user types #', async () => {
    render(<ChatInputArea isLoading={false} />);
    const textarea = screen.getByPlaceholderText(/问问 IfAI/i) as HTMLTextAreaElement;
    
    const val = 'help #';
    fireEvent.change(textarea, { target: { value: val, selectionStart: val.length } });
    
    const panel = await screen.findByTestId('symbol-mention-panel');
    expect(panel).toBeDefined();
    expect(screen.getByText(/引用符号/i)).toBeDefined();
  });
});
