import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShellExecutor } from '@/core/approval/executors/ShellExecutor';

describe('PhysicalBashExecutor (PIVO Standard)', () => {
  const mockInvoker = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该遵循 PIVO 规范物理转发 bash 指令并映射正确的参数', async () => {
    const executor = new ShellExecutor(mockInvoker);
    
    // 模拟后端成功返回结构化结果
    mockInvoker.mockResolvedValue({ 
      stdout: '2026-02-14', 
      stderr: '', 
      exit_code: 0 
    });

    const result = await executor.execute('bash', { command: 'date' });

    // 1. 验证物理转发：必须调用真实的后端指令名
    expect(mockInvoker).toHaveBeenCalledWith('execute_bash_command', expect.objectContaining({
      command: 'date'
    }));

    // 2. 验证结果封装
    expect(result.success).toBe(true);
    expect(result.content).toContain('2026-02-14');
  });

  it('当指令执行失败时，应该物理透传 stderr 给 AI 诊断', async () => {
    const executor = new ShellExecutor(mockInvoker);
    
    mockInvoker.mockResolvedValue({ 
      stdout: '', 
      stderr: 'permission denied', 
      exit_code: 1 
    });

    const result = await executor.execute('bash', { command: 'sudo rm -rf /' });

    expect(result.success).toBe(true); // 注意：PIVO 规范下，即便命令失败，调用本身是成功的，内容包含错误信息供 AI 学习
    expect(result.content).toContain('permission denied');
  });
});
