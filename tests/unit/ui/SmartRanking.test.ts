
import { describe, it, expect } from 'vitest';

// 模拟排序逻辑函数 (稍后将移入 ThreadTabs 或 Store)
function computeSmartSort(threads: any[], activeFilePath: string | null) {
  return [...threads].sort((a, b) => {
    // 1. 强置顶依然优先
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    // 2. 上下文相关性评分 (Smart Score)
    if (activeFilePath) {
      const aRelated = a.tags.some((t: string) => activeFilePath.includes(t)) || a.title.includes(activeFilePath.split('/').pop()!);
      const bRelated = b.tags.some((t: string) => activeFilePath.includes(t)) || b.title.includes(activeFilePath.split('/').pop()!);
      
      if (aRelated && !bRelated) return -1;
      if (!aRelated && bRelated) return 1;
    }

    // 3. 最后活跃时间
    return b.lastActiveAt - a.lastActiveAt;
  });
}

describe('Smart Thread Ranking Logic', () => {
  const mockThreads = [
    { id: '1', title: 'Fix CSS bug', tags: ['App.css'], lastActiveAt: 100, pinned: false },
    { id: '2', title: 'Refactor Logic', tags: ['main.ts'], lastActiveAt: 200, pinned: false },
    { id: '3', title: 'Global Config', tags: [], lastActiveAt: 300, pinned: true },
  ];

  it('should keep pinned threads at top regardless of context', () => {
    const sorted = computeSmartSort(mockThreads, 'main.ts');
    expect(sorted[0].id).toBe('3'); // Pinned
  });

  it('should boost relevant thread when active file changes', () => {
    // 当打开 App.css 时，id: 1 应该排在 id: 2 前面（尽管 2 更晚活跃）
    const sorted = computeSmartSort(mockThreads, 'src/styles/App.css');
    expect(sorted[1].id).toBe('1'); // Related to App.css
    expect(sorted[2].id).toBe('2');
  });
});
