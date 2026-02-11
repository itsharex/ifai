/**
 * ============================================
 * 自动批准工具调用 - Mock 服务
 * ============================================
 *
 * 提供模拟的工具调用和批准流程，用于 E2E 测试
 */

export interface MockToolCall {
  id: string;
  tool: string;
  args: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  result?: any;
  isPartial?: boolean;
}

export interface MockApprovalSettings {
  agentAutoApprove: boolean;
  agentApprovalMode: 'always' | 'session-once' | 'session-never' | 'per-tool';
  trustedSessions: Record<string, { approvedAt: number; expiresAt: number }>;
}

/**
 * 创建模拟的工具调用
 */
export function createMockToolCall(
  tool: string,
  args: Record<string, any> = {},
  id?: string
): MockToolCall {
  return {
    id: id || `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    tool,
    args,
    status: 'pending',
    isPartial: false
  };
}

/**
 * 模拟工具分类
 */
export function mockCategorizeTool(toolName: string): 'safe' | 'dangerous' | 'destructive' {
  const baseName = toolName.replace(/^agent_/, '');

  const safeBaseNames = [
    'read_file', 'list_dir', 'list_directory', 'scan_directory',
    'get_file_tree', 'search_file_content', 'glob', 'list_files'
  ];

  const destructiveBaseNames = [
    'bash', 'execute_command', 'run_shell_command',
    'delete_file', 'remove_file'
  ];

  if (safeBaseNames.includes(baseName)) return 'safe';
  if (destructiveBaseNames.includes(baseName)) return 'destructive';

  return 'dangerous';
}

/**
 * 模拟自动批准决策
 */
export function mockShouldAutoApprove(
  settings: MockApprovalSettings,
  toolName: string,
  threadId: string = 'default',
  isSandbox: boolean = true
): boolean {
  const category = mockCategorizeTool(toolName);

  // 安全底线：非沙箱环境下的破坏性操作绝对禁止
  if (!isSandbox && category === 'destructive') {
    return false;
  }

  // 全局设置优先
  if (settings.agentAutoApprove) {
    return true;
  }

  // 根据审批模式判断
  const { agentApprovalMode } = settings;

  if (agentApprovalMode === 'always') {
    return true;
  }

  if (agentApprovalMode === 'session-once') {
    const sessionTrust = settings.trustedSessions[threadId];
    return sessionTrust && Date.now() < sessionTrust.expiresAt;
  }

  if (agentApprovalMode === 'session-never') {
    return false;
  }

  // per-tool 模式：安全工具自动批准
  if (agentApprovalMode === 'per-tool') {
    return category === 'safe';
  }

  return false;
}

/**
 * 模拟批准工具调用
 */
export function mockApproveToolCall(
  toolCall: MockToolCall,
  settings: MockApprovalSettings,
  threadId: string = 'default'
): MockToolCall {
  // 在 session-once 模式下，首次批准后建立信任
  if (settings.agentApprovalMode === 'session-once') {
    const now = Date.now();
    settings.trustedSessions[threadId] = {
      approvedAt: now,
      expiresAt: now + 60 * 60 * 1000 // 1小时
    };
  }

  return {
    ...toolCall,
    status: 'approved'
  };
}

/**
 * 模拟执行工具调用
 */
export function mockExecuteToolCall(toolCall: MockToolCall): MockToolCall {
  const tool = toolCall.tool;
  let result: any;

  switch (tool) {
    case 'read_file':
    case 'agent_read_file':
      result = { content: 'Mock file content for testing' };
      break;
    case 'list_dir':
    case 'agent_list_dir':
      result = ['file1.txt', 'file2.ts', 'directory/'];
      break;
    case 'write_file':
    case 'agent_write_file':
      result = { success: true, path: toolCall.args.path };
      break;
    case 'bash':
    case 'agent_execute_command':
      result = { stdout: 'Mock command output', exitCode: 0 };
      break;
    default:
      result = { success: true };
  }

  return {
    ...toolCall,
    status: 'completed',
    result
  };
}

/**
 * 模拟完整的工具调用流程
 */
export function mockToolCallFlow(
  toolName: string,
  args: Record<string, any>,
  settings: MockApprovalSettings,
  threadId: string = 'default',
  isSandbox: boolean = true
): { toolCall: MockToolCall; autoApproved: boolean } {
  // 1. 创建工具调用
  const toolCall = createMockToolCall(toolName, args);

  // 2. 决定是否自动批准
  const autoApproved = mockShouldAutoApprove(settings, toolName, threadId, isSandbox);

  // 3. 执行流程
  if (autoApproved) {
    // 自动批准并执行
    const approved = { ...toolCall, status: 'approved' as const };
    const executed = mockExecuteToolCall(approved);
    return { toolCall: executed, autoApproved: true };
  } else {
    // 等待手动批准（模拟）
    return { toolCall, autoApproved: false };
  }
}

/**
 * 测试数据工厂
 */
export const mockToolCallFactory = {
  /**
   * 创建安全的只读工具调用
   */
  createSafeToolCall(path: string = 'README.md'): MockToolCall {
    return createMockToolCall('read_file', { path });
  },

  /**
   * 创建危险的写入工具调用
   */
  createDangerousToolCall(path: string = 'test.txt', content: string = 'test'): MockToolCall {
    return createMockToolCall('write_file', { path, content });
  },

  /**
   * 创建破坏性的 bash 工具调用
   */
  createDestructiveToolCall(command: string = 'pwd'): MockToolCall {
    return createMockToolCall('bash', { command });
  },

  /**
   * 创建默认设置
   */
  createDefaultSettings(): MockApprovalSettings {
    return {
      agentAutoApprove: false,
      agentApprovalMode: 'session-once',
      trustedSessions: {}
    };
  },

  /**
   * 创建已启用自动批准的设置
   */
  createAutoApproveEnabledSettings(): MockApprovalSettings {
    return {
      agentAutoApprove: true,
      agentApprovalMode: 'always',
      trustedSessions: {}
    };
  },

  /**
   * 创建带会话信任的设置
   */
  createTrustedSessionSettings(threadId: string = 'default'): MockApprovalSettings {
    const now = Date.now();
    return {
      agentAutoApprove: false,
      agentApprovalMode: 'session-once',
      trustedSessions: {
        [threadId]: {
          approvedAt: now,
          expiresAt: now + 3600000
        }
      }
    };
  }
};
