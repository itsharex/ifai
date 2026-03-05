import { shouldAutoApprove as checkAutoApprove, ApprovalContext } from './approvalPolicy';

/**
 * PIVO 3.0 Approval Pipeline
 * Handles asynchronous execution of automatic approvals to ensure state consistency
 */
export class ApprovalPipeline {
  /**
   * Evaluates and potentially executes automatic approval for a tool call
   * @param context Context for approval decision
   * @param onApprove Callback to execute when auto-approved
   */
  static processAutoApproval(
    context: ApprovalContext,
    onApprove: () => void
  ) {
    const shouldAuto = checkAutoApprove(context);
    
    if (shouldAuto) {
      // 🏆 v0.3.8: 异步调度策略 - 确保 Store 状态已完全提交
      // 使用 setTimeout(0) 将任务推入下一个宏任务队列
      console.log(`[ApprovalPipeline] 🚀 Scheduled auto-approval for ${context.toolName}`);
      
      setTimeout(() => {
        onApprove();
      }, 0);
      
      return true;
    }
    
    return false;
  }
}
