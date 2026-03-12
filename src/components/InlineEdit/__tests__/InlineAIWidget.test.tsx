import { render, screen, fireEvent } from '@testing-library/react';
import { InlineAIWidget } from '../InlineAIWidget';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

describe('InlineAIWidget', () => {
  it('should render correctly', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    
    render(<InlineAIWidget onClose={onClose} onSubmit={onSubmit} />);
    
    expect(screen.getByPlaceholderText(/Optimize this, add comments, or ask questions/i)).toBeInTheDocument();
    expect(screen.getByText(/Inline Assistant/i)).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    
    render(<InlineAIWidget onClose={onClose} onSubmit={onSubmit} />);
    
    // 找到关闭按钮（通常是带有 X 图标的第一个按钮，或者通过其父容器定位）
    const closeButton = screen.getByRole('button', { name: '' }); // X 图标按钮通常没有 accessible name
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onSubmit when Enter is pressed', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    
    render(<InlineAIWidget onClose={onClose} onSubmit={onSubmit} />);
    
    const input = screen.getByPlaceholderText(/Optimize this, add comments, or ask questions/i);
    fireEvent.change(input, { target: { value: 'Refactor this' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    expect(onSubmit).toHaveBeenCalledWith('Refactor this');
  });
});
