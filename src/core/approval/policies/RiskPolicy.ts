export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskContext {
  toolName: string;
  args: any;
  editorMode: 'vibe' | 'spec' | 'standard';
}

export class RiskPolicy {
  private highRiskTools = new Set(['agent_delete_file', 'agent_run_command', 'delete_file']);
  private mediumRiskTools = new Set(['agent_write_file', 'write_file', 'agent_replace_text']);

  /**
   * 计算工具调用的风险等级
   */
  calculateRisk(context: RiskContext): RiskLevel {
    const { toolName, editorMode } = context;

    // 1. 如果是删除或运行命令，始终为高风险
    if (this.highRiskTools.has(toolName)) {
      return 'high';
    }

    // 2. 如果是修改文件
    if (this.mediumRiskTools.has(toolName)) {
      // 在 Vibe 模式下，写文件也被视为高风险（因为 Vibe 强调非侵入性）
      if (editorMode === 'vibe') return 'high';
      return 'medium';
    }

    // 3. 其他只读操作
    return 'low';
  }

  /**
   * 判断是否应该自动批准
   */
  shouldAutoApprove(level: RiskLevel, editorMode: string): boolean {
    if (level === 'low') return true;
    
    // 在特定模式下，中等风险也可以自动批准（如果用户设置了）
    // 这里可以接入 SettingsStore
    return false;
  }
}
