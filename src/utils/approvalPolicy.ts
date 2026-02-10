import { SettingsState } from '../stores/settingsStore';

export type ToolCategory = 'safe' | 'dangerous' | 'destructive';

export interface ApprovalContext {
  settings: Partial<SettingsState>;
  editorMode: 'vibe' | 'spec' | 'standard';
  isSessionTrusted: boolean;
  toolName: string;
  isSandbox: boolean;
  userMessageHasAutoApprove?: boolean;
}

/**
 * 统一的工具调用分类逻辑
 */
export function categorizeTool(toolName: string): ToolCategory {
  const safeTools = [
    'agent_read_file',
    'agent_list_dir',
    'agent_scan_directory',
    'agent_get_file_tree',
    'agent_search_file_content',
    'agent_glob'
  ];

  const destructiveTools = [
    'agent_bash',
    'agent_delete_file'
  ];

  if (safeTools.includes(toolName)) return 'safe';
  if (destructiveTools.includes(toolName)) return 'destructive';
  return 'dangerous'; // 默认：写入操作等
}

/**
 * 统一的审批策略判断逻辑 (P0 里程碑核心)
 */
export function shouldAutoApprove(context: ApprovalContext): boolean {
  const {
    settings,
    editorMode,
    isSessionTrusted,
    toolName,
    isSandbox,
    userMessageHasAutoApprove
  } = context;

  const category = categorizeTool(toolName);

  // 1. 安全底线：非沙箱环境下的破坏性操作绝对禁止自动审批
  if (!isSandbox && category === 'destructive') {
    return false;
  }

  // 2. 用户显式授权优先 (例如在 Prompt 中包含了 @auto-approve)
  if (userMessageHasAutoApprove) {
    return true;
  }

  // 3. 全局设置优先
  if (settings.agentAutoApprove) {
    return true;
  }

  const approvalMode = settings.agentApprovalMode || 'session-once';

  // 4. 根据审批模式判断
  if (approvalMode === 'always') {
    return true;
  }

  if (approvalMode === 'session-once' && isSessionTrusted) {
    return true;
  }

  // 5. 编辑器模式特权 (Vibe/Spec 模式)
  if (editorMode === 'vibe' || editorMode === 'spec') {
    // 在这两种模式下，安全读取类工具自动批准
    if (category === 'safe') {
      return true;
    }
  }

  return false;
}
