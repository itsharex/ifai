import { IExecutor, ToolCallResult } from '../types';

export abstract class BaseExecutor implements IExecutor {
  abstract type: string;
  
  protected backupData: any = null;

  abstract execute(toolName: string, args: any): Promise<ToolCallResult>;

  /**
   * 撤销操作 (由具体执行器实现)
   */
  async undo(): Promise<boolean> {
    console.warn(`Undo not implemented for executor: ${this.type}`);
    return false;
  }

  /**
   * 存储备份数据
   */
  protected saveBackup(data: any) {
    this.backupData = data;
  }
}
