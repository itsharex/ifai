import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SymbolExecutor } from '@/core/approval/executors/SymbolExecutor';

describe('SymbolExecutor (PIVO 2.0)', () => {
  const mockInvoker = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该能正确执行 get_file_symbols 并返回结构化符号', async () => {
    const executor = new SymbolExecutor(mockInvoker, '/test-root');
    
    mockInvoker.mockResolvedValue({
      symbols: [{ name: 'App', type: 'class', line: 1 }],
      language: 'typescript'
    });

    const result = await executor.execute('get_file_symbols', { 
      file_path: 'src/App.tsx' 
    });

    expect(mockInvoker).toHaveBeenCalledWith('get_file_symbols', expect.objectContaining({
      rootPath: '/test-root',
      file_path: 'src/App.tsx'
    }));
    expect(result.success).toBe(true);
    expect(result.content).toContain('App');
  });

  it('应该支持符号提取预览', async () => {
    const executor = new SymbolExecutor(mockInvoker, '/test-root');
    const preview = await executor.preview('get_file_symbols', { file_path: 'src/main.ts' });
    
    expect(preview.fileName).toBe('src/main.ts');
    expect(preview.toolType).toBe('符号地图');
  });
});
