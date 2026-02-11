import { describe, it, expect } from 'vitest';
import { categorizeTool, shouldAutoApprove, ToolCategory, ApprovalContext } from '../approvalPolicy';
import type { SettingsState } from '../../stores/settingsStore';

/**
 * ============================================
 * 审批策略单元测试 (TDD)
 * ============================================
 *
 * 测试范围：
 * 1. 工具分类逻辑 (categorizeTool)
 * 2. 自动批准决策逻辑 (shouldAutoApprove)
 * 3. 不同审批模式的行为
 * 4. 边界条件和异常情况
 */

describe('approvalPolicy', () => {
  // ============================================
  // 工具分类测试
  // ============================================
  describe('categorizeTool', () => {
    describe('safe tools (只读操作)', () => {
      const safeTools = [
        'read_file',
        'agent_read_file',
        'list_dir',
        'agent_list_dir',
        'list_directory',
        'scan_directory',
        'get_file_tree',
        'search_file_content',
        'glob',
        'list_files'
      ];

      it.each(safeTools)('should categorize %s as safe', (toolName) => {
        expect(categorizeTool(toolName)).toBe('safe');
      });
    });

    describe('destructive tools (破坏性操作)', () => {
      const destructiveTools = [
        'bash',
        'agent_execute_command',
        'agent_run_shell_command',
        'execute_command',
        'run_shell_command',
        'delete_file',
        'agent_delete_file',
        'remove_file'
      ];

      it.each(destructiveTools)('should categorize %s as destructive', (toolName) => {
        expect(categorizeTool(toolName)).toBe('destructive');
      });
    });

    describe('dangerous tools (写入操作)', () => {
      const dangerousTools = [
        'write_file',
        'agent_write_file',
        'edit_file',
        'agent_edit_file'
      ];

      it.each(dangerousTools)('should categorize %s as dangerous', (toolName) => {
        expect(categorizeTool(toolName)).toBe('dangerous');
      });
    });

    describe('unknown tools', () => {
      it('should categorize unknown tools as dangerous by default', () => {
        expect(categorizeTool('unknown_tool')).toBe('dangerous');
        expect(categorizeTool('custom_tool')).toBe('dangerous');
        expect(categorizeTool('')).toBe('dangerous');
      });
    });

    describe('agent_ prefix normalization', () => {
      it('should normalize agent_ prefix', () => {
        expect(categorizeTool('agent_read_file')).toBe('safe');
        expect(categorizeTool('agent_bash')).toBe('destructive');
        expect(categorizeTool('agent_write_file')).toBe('dangerous');
      });
    });
  });

  // ============================================
  // 自动批准决策测试
  // ============================================
  describe('shouldAutoApprove', () => {
    // 基础上下文
    const createBaseContext = (overrides: Partial<ApprovalContext> = {}): ApprovalContext => ({
      settings: {},
      editorMode: 'standard',
      isSessionTrusted: false,
      toolName: 'read_file',
      isSandbox: true,
      userMessageHasAutoApprove: false,
      ...overrides
    });

    describe('global auto-approve setting', () => {
      it('should auto-approve when agentAutoApprove is true', () => {
        const context = createBaseContext({
          settings: { agentAutoApprove: true }
        });
        expect(shouldAutoApprove(context)).toBe(true);
      });

      it('should not auto-approve when agentAutoApprove is false', () => {
        const context = createBaseContext({
          settings: { agentAutoApprove: false, agentApprovalMode: 'session-never' }
        });
        expect(shouldAutoApprove(context)).toBe(false);
      });
    });

    describe('approval mode: always', () => {
      it('should auto-approve all tools in always mode', () => {
        const tools = ['read_file', 'write_file', 'bash'];
        tools.forEach(toolName => {
          const context = createBaseContext({
            settings: { agentApprovalMode: 'always' },
            toolName
          });
          expect(shouldAutoApprove(context)).toBe(true);
        });
      });
    });

    describe('approval mode: session-once', () => {
      it('should auto-approve when session is trusted', () => {
        const context = createBaseContext({
          settings: { agentApprovalMode: 'session-once' },
          isSessionTrusted: true
        });
        expect(shouldAutoApprove(context)).toBe(true);
      });

      it('should not auto-approve when session is not trusted', () => {
        const context = createBaseContext({
          settings: { agentApprovalMode: 'session-once' },
          isSessionTrusted: false
        });
        expect(shouldAutoApprove(context)).toBe(false);
      });
    });

    describe('approval mode: session-never', () => {
      it('should never auto-approve in session-never mode', () => {
        const context = createBaseContext({
          settings: { agentApprovalMode: 'session-never' },
          isSessionTrusted: true  // 即使有信任也不应该自动批准
        });
        expect(shouldAutoApprove(context)).toBe(false);
      });
    });

    describe('user message authorization', () => {
      it('should auto-approve when user message has auto-approve flag', () => {
        const context = createBaseContext({
          userMessageHasAutoApprove: true,
          settings: { agentApprovalMode: 'session-never' }  // 即使有严格模式
        });
        expect(shouldAutoApprove(context)).toBe(true);
      });
    });

    describe('editor mode privileges', () => {
      describe('vibe mode', () => {
        it('should auto-approve safe tools in vibe mode', () => {
          const context = createBaseContext({
            editorMode: 'vibe',
            toolName: 'read_file'
          });
          expect(shouldAutoApprove(context)).toBe(true);
        });

        it('should not auto-approve dangerous tools in vibe mode', () => {
          const context = createBaseContext({
            editorMode: 'vibe',
            toolName: 'write_file',
            settings: { agentApprovalMode: 'session-never' }
          });
          expect(shouldAutoApprove(context)).toBe(false);
        });
      });

      describe('spec mode', () => {
        it('should auto-approve safe tools in spec mode', () => {
          const context = createBaseContext({
            editorMode: 'spec',
            toolName: 'read_file'
          });
          expect(shouldAutoApprove(context)).toBe(true);
        });
      });
    });

    describe('sandbox safety', () => {
      it('should block destructive tools in non-sandbox environment', () => {
        const context = createBaseContext({
          isSandbox: false,
          toolName: 'bash',
          settings: { agentAutoApprove: true }  // 即使有全局自动批准
        });
        expect(shouldAutoApprove(context)).toBe(false);
      });

      it('should allow destructive tools in sandbox environment with auto-approve', () => {
        const context = createBaseContext({
          isSandbox: true,
          toolName: 'bash',
          settings: { agentAutoApprove: true }
        });
        expect(shouldAutoApprove(context)).toBe(true);
      });
    });

    describe('priority order', () => {
      it('should prioritize non-sandbox safety over all other factors', () => {
        const context = createBaseContext({
          isSandbox: false,
          toolName: 'bash',
          settings: {
            agentAutoApprove: true,
            agentApprovalMode: 'always'
          },
          userMessageHasAutoApprove: true
        });
        // 即使有所有其他批准因素，非沙箱环境下的破坏性操作也不应该批准
        expect(shouldAutoApprove(context)).toBe(false);
      });

      it('should prioritize user message authorization over global settings', () => {
        const context = createBaseContext({
          userMessageHasAutoApprove: true,
          settings: { agentAutoApprove: false }
        });
        expect(shouldAutoApprove(context)).toBe(true);
      });

      it('should prioritize mode privileges over approval mode for safe tools', () => {
        const context = createBaseContext({
          settings: { agentAutoApprove: false, agentApprovalMode: 'session-never' },
          editorMode: 'vibe',
          toolName: 'read_file'
        });
        // vibe 模式下 safe 工具会在检查 approvalMode 之前自动批准
        // 这是设计上的优先级：编辑器模式特权 > 审批模式
        expect(shouldAutoApprove(context)).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle empty settings gracefully', () => {
        const context = createBaseContext({
          settings: {}
        });
        expect(shouldAutoApprove(context)).toBe(false);
      });

      it('should handle undefined tool name', () => {
        // 测试 undefined 工具名会抛出错误，这是预期的行为
        expect(() => {
          const context = createBaseContext({
            toolName: undefined as any
          });
          shouldAutoApprove(context);
        }).toThrow();
      });

      it('should handle null settings gracefully', () => {
        // 测试 null settings 会抛出错误，这是预期的行为
        expect(() => {
          const context = createBaseContext({
            settings: null as any,
            editorMode: null as any
          });
          shouldAutoApprove(context);
        }).toThrow();
      });
    });
  });
});

/**
 * ============================================
 * 测试覆盖矩阵
 * ============================================
 *
 * | 条件 | 安全工具 | 危险工具 | 破坏性工具 |
 * |------|----------|----------|------------|
 * | always 模式 | ✅ | ✅ | ✅ (沙箱) |
 * | session-once + 信任 | ✅ | ✅ | ✅ (沙箱) |
 * | session-once + 不信任 | ❌ | ❌ | ❌ |
 * | session-never | ❌ | ❌ | ❌ |
 * | vibe/spec 模式 | ✅ | ❌ | ❌ |
 * | 全局自动批准 | ✅ | ✅ | ✅ (沙箱) |
 * | 用户显式授权 | ✅ | ✅ | ✅ |
 *
 * 非沙箱环境下的破坏性操作：始终 ❌（安全底线）
 */
