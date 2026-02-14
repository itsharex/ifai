import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileSystemExecutor } from '@/core/approval/executors/FileSystemExecutor';

describe('FileSystemExecutor', () => {
  const mockInvoker = vi.fn();
  const rootPath = '/test-root';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('执行写操作前应该自动备份', async () => {
    const executor = new FileSystemExecutor(mockInvoker, rootPath);
    
    // 模拟读取旧文件成功
    mockInvoker.mockResolvedValueOnce({ content: 'old-content' }) // for backup
               .mockResolvedValueOnce({ content: 'success' });   // for actual write

    const result = await executor.execute('agent_write_file', {
      rel_path: 'test.ts',
      content: 'new-content'
    });

    expect(result.success).toBe(true);
    expect(mockInvoker).toHaveBeenCalledWith('agent_read_file', expect.objectContaining({ relPath: 'test.ts' }));
  });

  it('应该能够成功回滚 (Undo)', async () => {
    const executor = new FileSystemExecutor(mockInvoker, rootPath);
    
    // 1. 执行写操作，产生备份
    mockInvoker.mockResolvedValueOnce({ content: 'original-text' })
               .mockResolvedValueOnce('ok');
    
    await executor.execute('agent_write_file', { rel_path: 'todo.md', content: 'v2' });

    // 2. 执行 Undo
    mockInvoker.mockResolvedValueOnce('ok'); // for undo write
    const undoSuccess = await executor.undo();

    expect(undoSuccess).toBe(true);
    expect(mockInvoker).toHaveBeenLastCalledWith('agent_write_file', expect.objectContaining({
      relPath: 'todo.md',
      content: 'original-text'
    }));
  });

  it('如果文件原本不存在，Undo 应该删除文件', async () => {
    const executor = new FileSystemExecutor(mockInvoker, rootPath);
    
    // 1. 读取失败（文件不存在）
    mockInvoker.mockRejectedValueOnce(new Error('File not found'))
               .mockResolvedValueOnce('ok');
    
    await executor.execute('agent_write_file', { rel_path: 'new.ts', content: 'init' });

    // 2. 执行 Undo
    mockInvoker.mockResolvedValueOnce('ok');
    await executor.undo();

    expect(mockInvoker).toHaveBeenLastCalledWith('agent_delete_file', expect.objectContaining({
      relPath: 'new.ts'
    }));
  });
});
