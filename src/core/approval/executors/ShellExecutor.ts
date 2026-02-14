import { BaseExecutor } from './BaseExecutor';
import { ToolCallResult } from '../types';

/**
 * PhysicalBashExecutor (PIVO v2.0)
 * 遵循全栈指令开发方法论，实现标准化的物理 Shell 执行
 */
export class ShellExecutor extends BaseExecutor {
  type = 'shell';

  constructor(
    private invoker: (cmd: string, args?: any) => Promise<any>
  ) {
    super();
  }

  async execute(toolName: string, args: any): Promise<ToolCallResult> {
    // 1. 参数物理化过程 (Physical Trace)
    const command = args.command || args.script || args.args || args.cmd || '';
    
    // 2. 统一日志输出 (Unified Logging - Guide 8.2)
    console.log(`[Wrapper] 🐚 Entry - Physical Command: \`${command}\``);

    try {
      const startTime = performance.now();
      
      // 3. 物理转发至后端桥接层
      const output = await this.invoker('execute_bash_command', {
        command: command,
      });

      const duration = (performance.now() - startTime).toFixed(2);

      // 4. 结构化结果解析 (Integrated & Verified)
      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      if (typeof output === 'string') {
        stdout = output;
      } else if (typeof output === 'object') {
        stdout = output.stdout || '';
        stderr = output.stderr || '';
        exitCode = output.exit_code ?? 0;
      }

      // 遵循 Guide 8.3: 错误透传模式，不静默失败
      const combinedOutput = stderr 
        ? `${stdout}\n\n[Error Output]:\n${stderr}` 
        : stdout;

      console.log(`[FS Tool] ✅ Physical execution finished in ${duration}ms (Exit: ${exitCode})`);

      return { 
        success: true, 
        content: combinedOutput || `(Command finished with exit code ${exitCode})`,
        metadata: { exitCode, stdout, stderr, duration }
      };
    } catch (e) {
      // Guide 8.3: 不要后端静默失败
      console.error(`[FS Tool] ❌ Physical execution failed:`, e);
      return { success: false, content: '', error: String(e) };
    }
  }

  /**
   * PIVO 预览逻辑：基于风险等级的语义化检查
   */
  async preview(toolName: string, args: any): Promise<any> {
    const cmd = args.command || args.script || '';
    const dangerousKeywords = ['rm ', 'sudo', 'chmod', 'chown', 'mv ', '> /dev/null'];
    const isDestructive = dangerousKeywords.some(k => cmd.includes(k));

    return {
      command: cmd,
      isDestructive
    };
  }
}
