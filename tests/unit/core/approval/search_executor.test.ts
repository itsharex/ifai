import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchExecutor } from '@/core/approval/executors/SearchExecutor';

describe('SearchExecutor (PIVO 2.0)', () => {
  const mockInvoker = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该能正确执行 agent_search 并返回结构化结果', async () => {
    const executor = new SearchExecutor(mockInvoker, '/test-root');
    
    mockInvoker.mockResolvedValue({
      matches: [{ path: 'src/main.ts', line: 10, content: 'export class App' }],
      total_matches: 1
    });

    const result = await executor.execute('agent_search', { 
      query: 'class App', 
      rel_path: 'src' 
    });

    expect(mockInvoker).toHaveBeenCalledWith('agent_search', expect.objectContaining({
      rootPath: '/test-root',
      query: 'class App'
    }));
    expect(result.success).toBe(true);
    expect(result.content).toContain('src/main.ts');
  });

  it('应该支持搜索意图预览', async () => {
    const executor = new SearchExecutor(mockInvoker, '/test-root');
    const preview = await executor.preview('agent_search', { query: 'todo', rel_path: '.' });
    
    expect(preview.query).toBe('todo');
    expect(preview.scope).toBe('.');
  });
});
