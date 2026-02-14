import { BaseExecutor } from './BaseExecutor';
import { ToolCallResult } from '../types';

export class ShellExecutor extends BaseExecutor {
  type = 'shell';

  constructor(
    private invoker: (cmd: string, args?: any) => Promise<any>
  ) {
    super();
  }

  async execute(toolName: string, args: any): Promise<ToolCallResult> {
    try {
      // 🏆 修复：后端真实的指令名是 execute_bash_command
      const command = args.command || args.script || args.args || '';
      console.log(`[Shell Tool] 🐚 Executing physical command: \`${command}\``);
      
      const output = await this.invoker('execute_bash_command', {
        command: command, // 后端代码预期参数名为 command
      });

      // 解析输出
      let content = '';
      if (typeof output === 'string') {
        content = output;
      } else if (typeof output === 'object') {
        content = output.output || JSON.stringify(output);
      }

      return { 
        success: true, 
        content,
        metadata: { exitCode: (output as any).exit_code ?? 0 }
      };
    } catch (e) {
      return { success: false, content: '', error: String(e) };
    }
  }

  /**
   * 🚀 Shell 命令通常不可逆，但我们可以提供一些“安全建议”预览
   */
  async preview(toolName: string, args: any): Promise<any> {
    return {
      command: args.command || args.script || args.args,
      isDestructive: this.detectDestructiveCommand(args.command || '')
    };
  }

  private detectDestructiveCommand(cmd: string): boolean {
    const dangerousKeywords = ['rm ', 'sudo', 'chmod', 'chown', 'mv ', '> /dev/null'];
    return dangerousKeywords.some(k => cmd.includes(k));
  }
}
