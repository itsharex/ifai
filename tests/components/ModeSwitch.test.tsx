import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModeSwitch } from '../../src/components/Layout/ModeSwitch';
import { useLayoutStore } from '../../src/stores/layoutStore';

describe('ModeSwitch Component (TDD Phase 1)', () => {
  beforeEach(() => {
    // 重置为 vibe 模式
    useLayoutStore.getState().setEditorMode('vibe');
  });

  it('should render Vibe and Spec options', () => {
    render(<ModeSwitch />);
    expect(screen.getByText(/Vibe/i)).toBeDefined();
    expect(screen.getByText(/Spec/i)).toBeDefined();
  });

  it('should toggle editorMode in layoutStore when clicked', () => {
    render(<ModeSwitch />);
    const specBtn = screen.getByText(/Spec/i);
    
    fireEvent.click(specBtn);
    expect(useLayoutStore.getState().editorMode).toBe('spec');

    const vibeBtn = screen.getByText(/Vibe/i);
    fireEvent.click(vibeBtn);
    expect(useLayoutStore.getState().editorMode).toBe('vibe');
  });
});
