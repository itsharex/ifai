import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillsSettings } from '../../src/components/Settings/SkillsSettings';
import { useSkillStore } from '../../src/stores/skillStore';

// Mock Lucide 图标
vi.mock('lucide-react', () => ({
  RefreshCw: () => <div data-testid="refresh-icon" />,
  Puzzle: () => <div data-testid="skill-icon" />,
  ExternalLink: () => <div data-testid="link-icon" />,
  ShieldCheck: () => <div data-testid="shield-icon" />,
}));

describe('SkillsSettings Component (TDD Phase 1 & 2)', () => {
  beforeEach(() => {
    // 重置 Store 状态
    useSkillStore.getState().reset();
  });

  it('should render the Skills Center title and refresh button', () => {
    // 强制设置初始状态，防止被 useEffect 的 fetch 覆盖导致加载状态
    useSkillStore.setState({ availableSkills: [], isLoading: false });
    render(<SkillsSettings />);
    expect(screen.getByText(/技能中心/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /刷新/i })).toBeDefined();
  });

  it('should display loading state when isLoading is true', () => {
    useSkillStore.setState({ isLoading: true });
    render(<SkillsSettings />);
    expect(screen.getByText(/正在扫描技能目录/i)).toBeDefined();
  });

  it('should render skill cards when availableSkills is not empty', () => {
    useSkillStore.setState({
      isLoading: false,
      availableSkills: [
        { id: 'test-skill-1', name: 'Test Skill', description: 'A test skill', version: '1.0.0' }
      ]
    });
    render(<SkillsSettings />);
    expect(screen.getByText('Test Skill')).toBeDefined();
    expect(screen.getByText('A test skill')).toBeDefined();
    expect(screen.getByText('v1.0.0')).toBeDefined();
  });

  it('should call toggleSkill when toggle button is clicked', () => {
    const toggleSpy = vi.spyOn(useSkillStore.getState(), 'toggleSkill');
    useSkillStore.setState({
      isLoading: false,
      availableSkills: [
        { id: 'test-skill-1', name: 'Test Skill', description: 'x', version: '1.0' }
      ],
      activeSkillIds: []
    });

    render(<SkillsSettings />);
    
    // 找到 Toggle 按钮 (relative inline-flex ...)
    const toggleBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(toggleBtn);

    expect(toggleSpy).toHaveBeenCalledWith('test-skill-1');
  });
});
