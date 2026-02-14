import { BaseExecutor } from './BaseExecutor';
import { ToolCallResult } from '../types';

export class SymbolExecutor extends BaseExecutor {
  type = 'symbol';

  constructor(
    private invoker: (cmd: string, args?: any) => Promise<any>,
    private rootPath: string
  ) {
    super();
  }

  async execute(toolName: string, args: any): Promise<ToolCallResult> {
    const filePath = args.file_path || args.rel_path || args.path || '.';
    console.log(`[Wrapper] 🧩 Entry - Analyzing Symbols: '${filePath}'`);
    
    try {
      const startTime = performance.now();
      
      const output = await this.invoker(toolName, {
        rootPath: this.rootPath,
        relPath: filePath, // 后端可能期待 relPath
        file_path: filePath, // 也可能期待 file_path
        ...args
      });

      const duration = (performance.now() - startTime).toFixed(2);
      
      // 格式化输出供 AI 消费
      let content = typeof output === 'string' ? output : JSON.stringify(output);
      
      console.log(`[FS Tool] ✅ Symbol analysis finished in ${duration}ms`);

      return { 
        success: true, 
        content,
        metadata: { duration, tool: toolName }
      };
    } catch (e) {
      console.error(`[FS Tool] ❌ Symbol analysis failed:`, e);
      return { success: false, content: '', error: String(e) };
    }
  }

  async preview(toolName: string, args: any): Promise<any> {
    return {
      fileName: args.file_path || args.rel_path || args.path || '整个项目',
      toolType: toolName === 'get_file_symbols' ? '符号地图' : '函数索引'
    };
  }
}
