import { BaseExecutor } from './BaseExecutor';
import { ToolCallResult } from '../types';

export class FileSystemExecutor extends BaseExecutor {
  type = 'filesystem';

  constructor(
    private invoker: (cmd: string, args?: any) => Promise<any>,
    private rootPath: string
  ) {
    super();
  }

  async execute(toolName: string, args: any): Promise<ToolCallResult> {
    const relPath = args.rel_path || args.path || (toolName === "agent_list_dir" ? "." : "");
    
    // 1. 自动备份逻辑 (仅针对写/删操作)
    if (toolName === 'agent_write_file' || toolName === 'agent_delete_file') {
      await this.prepareBackup(relPath);
    }

    try {
      let outputContent: any;
      const rootPath = this.rootPath;

      // 🏆 同步旧版特殊逻辑
      if (toolName === "agent_scan_project") {
        outputContent = await this.invoker("agent_scan_project", { 
          rootPath, 
          relPath, 
          maxDepth: args.max_depth || args.maxDepth || 3 
        });
      } else if (toolName === "agent_list_functions") {
        outputContent = await this.invoker("agent_list_functions", { rootPath, relPath });
      } else {
        const tauriArgs = { rootPath, relPath, ...args };
        outputContent = await this.invoker(toolName, tauriArgs);
      }

      // 解析结果
      let stringResult: string;
      if (outputContent && typeof outputContent === "object" && "content" in outputContent) {
        stringResult = String((outputContent as any).content);
      } else {
        stringResult = typeof outputContent === "object" ? JSON.stringify(outputContent) : String(outputContent);
      }

      return { success: true, content: stringResult };
    } catch (e) {
      console.error(`[FileSystemExecutor] ${toolName} failed:`, e);
      return { success: false, content: '', error: String(e) };
    }
  }

  private async prepareBackup(relPath: string) {
    try {
      // 尝试读取现有内容作为备份
      const content = await this.invoker('agent_read_file', {
        rootPath: this.rootPath,
        relPath
      });
      this.saveBackup({ relPath, content: content.content || content });
    } catch (e) {
      // 文件可能不存在，这在新建文件时是正常的
      this.saveBackup({ relPath, content: null });
    }
  }

  async undo(): Promise<boolean> {
    if (!this.backupData) return false;

    const { relPath, content } = this.backupData;
    try {
      if (content === null) {
        // 原本不存在，则删除
        await this.invoker('agent_delete_file', { rootPath: this.rootPath, relPath });
      } else {
        // 恢复内容
        await this.invoker('agent_write_file', { 
          rootPath: this.rootPath, 
          relPath, 
          content 
        });
      }
      return true;
    } catch (e) {
      console.error(`Undo failed for ${relPath}:`, e);
      return false;
    }
  }
}
