import { BaseExecutor } from './BaseExecutor';
import { ToolCallResult } from '../types';

export class SearchExecutor extends BaseExecutor {
  type = 'search';

  constructor(
    private invoker: (cmd: string, args?: any) => Promise<any>,
    private rootPath: string
  ) {
    super();
  }

  async execute(toolName: string, args: any): Promise<ToolCallResult> {
    const query = args.query || args.text || '';
    console.log(`[Wrapper] 🔍 Entry - Search Query: '${query}'`);
    
    try {
      const startTime = performance.now();
      
      const output = await this.invoker(toolName, {
        rootPath: this.rootPath,
        relPath: args.rel_path || args.path || '.',
        ...args
      });

      const duration = (performance.now() - startTime).toFixed(2);
      
      // 格式化输出供 AI 消费
      let content = typeof output === 'string' ? output : JSON.stringify(output);
      
      console.log(`[FS Tool] ✅ Search finished in ${duration}ms`);

      return { 
        success: true, 
        content,
        metadata: { duration, count: (output as any).total_matches ?? 0 }
      };
    } catch (e) {
      console.error(`[FS Tool] ❌ Search failed:`, e);
      return { success: false, content: '', error: String(e) };
    }
  }

  async preview(toolName: string, args: any): Promise<any> {
    return {
      query: args.query || args.text || 'unknown',
      scope: args.rel_path || args.path || '整个项目',
      toolType: toolName.includes('semantic') ? '语义搜索' : '全文搜索'
    };
  }
}
