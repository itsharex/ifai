/**
 * PIVO v2.0 审批系统核心类型定义
 */

export type ApprovalStatus = 
  | 'pending'    // 等待中
  | 'preview'    // 预览中（Diff 生成后）
  | 'approved'   // 已批准
  | 'executing'  // 执行中
  | 'completed'  // 已完成
  | 'failed'     // 失败
  | 'rejected'   // 已拒绝
  | 'undone';    // 已撤销

export interface ToolCallResult {
  success: boolean;
  content: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface IExecutor {
  type: string;
  execute(toolName: string, args: any): Promise<ToolCallResult>;
  undo?(): Promise<boolean>;
}

export interface ApprovalItem {
  id: string;             // toolCallId
  messageId: string;
  toolName: string;
  args: any;
  status: ApprovalStatus;
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: number;
  updatedAt: number;
  result?: ToolCallResult;
}

export interface ApprovalCoordinatorOptions {
  autoApproveLowRisk?: boolean;
  enablePreview?: boolean;
}
