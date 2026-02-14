import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApprovalCoordinator } from '@/core/approval/coordinators/ApprovalCoordinator';
import { useApprovalStore } from '@/core/approval/store/useApprovalStore';

// Mock Executor
const mockExecutor = {
  type: 'test-tool',
  execute: vi.fn().mockResolvedValue({ success: true, content: 'test-result' }),
};

describe('ApprovalCoordinator', () => {
  beforeEach(() => {
    useApprovalStore.getState().clear();
    vi.clearAllMocks();
  });

  it('应该能够注册执行器并处理工具调用', async () => {
    const coordinator = new ApprovalCoordinator();
    coordinator.registerExecutor('test-tool', mockExecutor);

    const toolCallId = 'call-1';
    const messageId = 'msg-1';

    // 1. 创建审批项
    await coordinator.createApproval(messageId, {
      id: toolCallId,
      tool: 'test-tool',
      args: { input: 'hello' }
    });

    const item = useApprovalStore.getState().getItem(toolCallId);
    expect(item).toBeDefined();
    expect(item?.status).toBe('pending');

    // 2. 批准并执行
    const result = await coordinator.approve(toolCallId);

    expect(result.success).toBe(true);
    expect(result.content).toBe('test-result');
    
    const updatedItem = useApprovalStore.getState().getItem(toolCallId);
    expect(updatedItem?.status).toBe('completed');
    expect(mockExecutor.execute).toHaveBeenCalledWith({ input: 'hello' });
  });

  it('当执行器不存在时应该抛出错误', async () => {
    const coordinator = new ApprovalCoordinator();
    const toolCallId = 'call-err';

    await coordinator.createApproval('msg-err', {
      id: toolCallId,
      tool: 'unknown-tool',
      args: {}
    });

    await expect(coordinator.approve(toolCallId)).rejects.toThrow('No executor registered for tool: unknown-tool');
    
    const item = useApprovalStore.getState().getItem(toolCallId);
    expect(item?.status).toBe('failed');
  });
});
