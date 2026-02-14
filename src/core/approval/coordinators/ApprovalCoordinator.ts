import { IExecutor, ApprovalItem, ApprovalStatus, ToolCallResult } from '../types';
import { useApprovalStore } from '../store/useApprovalStore';
import { RiskPolicy, RiskContext } from '../policies/RiskPolicy';

export class ApprovalCoordinator {
  private executors: Map<string, IExecutor> = new Map();
  private riskPolicy = new RiskPolicy();

  /**
   * 注册工具执行器
   */
  registerExecutor(toolName: string, executor: IExecutor) {
    this.executors.set(toolName, executor);
  }

  /**
   * 创建新的审批请求
   */
  async createApproval(messageId: string, toolCall: { id: string, tool: string, args: any }, context?: Partial<RiskContext>) {
    const editorMode = context?.editorMode || (window as any).__IFAI_EDITOR_MODE__ || 'standard';
    const riskLevel = this.riskPolicy.calculateRisk({
      toolName: toolCall.tool,
      args: toolCall.args,
      editorMode: editorMode as any
    });
    
    console.log(`[ApprovalEngine] 🆕 Created ApprovalItem:`, {
      id: toolCall.id,
      tool: toolCall.tool,
      risk: riskLevel,
      mode: editorMode
    });

    useApprovalStore.getState().addItem({
      id: toolCall.id,
      messageId,
      toolName: toolCall.tool,
      args: toolCall.args,
      riskLevel
    });

    // 🚀 异步生成预览数据
    const executor = this.executors.get(toolCall.tool);
    if (executor && executor.preview) {
      console.log(`[ApprovalEngine] 🔍 Generating preview for ${toolCall.tool}...`);
      executor.preview(toolCall.tool, toolCall.args).then(data => {
        if (data) {
          console.log(`[ApprovalEngine] ✨ Preview data ready for ${toolCall.id}`);
          useApprovalStore.getState().updateStatus(toolCall.id, 'preview', undefined, data);
        }
      });
    }
  }

  /**
   * 批准并执行工具调用
   */
  async approve(toolCallId: string): Promise<ToolCallResult> {
    const store = useApprovalStore.getState();
    const item = store.getItem(toolCallId);

    if (!item) {
      console.error(`[ApprovalEngine] ❌ Tool call ${toolCallId} not found in store`);
      throw new Error(`Tool call ${toolCallId} not found in store`);
    }

    const executor = this.executors.get(item.toolName);
    if (!executor) {
      console.error(`[ApprovalEngine] ❌ No executor registered for: ${item.toolName}`);
      const errorResult = { success: false, content: '', error: `No executor registered for tool: ${item.toolName}` };
      store.updateStatus(toolCallId, 'failed', errorResult);
      throw new Error(errorResult.error);
    }

    console.log(`[ApprovalEngine] ⚡ Executing ${item.toolName}...`, { id: toolCallId, args: item.args });
    store.updateStatus(toolCallId, 'executing');

    try {
      const startTime = performance.now();
      const result = await executor.execute(item.toolName, item.args);
      const duration = (performance.now() - startTime).toFixed(2);
      
      console.log(`[ApprovalEngine] ✅ Execution finished in ${duration}ms`, { 
        id: toolCallId, 
        success: result.success,
        outputSize: result.content?.length 
      });

      const status = result.success ? 'completed' : 'failed';
      store.updateStatus(toolCallId, status, result);
      return result;
    } catch (e) {
      console.error(`[ApprovalEngine] 💥 Critical error during execution:`, e);
      const errorResult = { success: false, content: '', error: String(e) };
      store.updateStatus(toolCallId, 'failed', errorResult);
      throw e;
    }
  }

  /**
   * 拒绝工具调用
   */
  async reject(toolCallId: string) {
    useApprovalStore.getState().updateStatus(toolCallId, 'rejected');
  }

  /**
   * 计算工具风险等级 (后续将移至 RiskPolicy)
   */
  private calculateRisk(toolName: string): 'low' | 'medium' | 'high' {
    const highRisk = ['agent_delete_file', 'agent_run_command'];
    const mediumRisk = ['agent_write_file'];
    
    if (highRisk.includes(toolName)) return 'high';
    if (mediumRisk.includes(toolName)) return 'medium';
    return 'low';
  }
}
