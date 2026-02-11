
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatUIStore } from '../../../src/stores/chatUIStore';

describe('Sidebar UI Store Logic', () => {
  beforeEach(() => {
    // 每个测试前重置状态
    const store = useChatUIStore.getState();
    if ((store as any).setSearchVisible) {
        (store as any).setSearchVisible(false);
    }
  });

  it('should have search hidden by default', () => {
    const state = useChatUIStore.getState();
    expect((state as any).isSearchVisible).toBe(false);
  });

  it('should toggle search visibility', () => {
    const store = useChatUIStore.getState();
    (store as any).toggleSearch();
    expect(useChatUIStore.getState().isSearchVisible).toBe(true);
    (store as any).toggleSearch();
    expect(useChatUIStore.getState().isSearchVisible).toBe(false);
  });

  it('should set density mode correctly', () => {
    const store = useChatUIStore.getState();
    (store as any).setDensityMode('compact');
    expect(useChatUIStore.getState().densityMode).toBe('compact');
  });
});
