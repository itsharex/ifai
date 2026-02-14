export interface DiffSummary {
  added: number;
  removed: number;
  lines: Array<{
    type: 'add' | 'remove' | 'context';
    content: string;
    lineNumber?: number;
  }>;
}

export class DiffProvider {
  /**
   * 生成简单的行级 Diff
   */
  generateDiff(oldContent: string | null, newContent: string): DiffSummary {
    const oldLines = oldContent ? oldContent.split('
') : [];
    const newLines = newContent.split('
');
    
    // 基础 Diff 算法 (此处暂用简化的全量对比，后续可引入更复杂的 library)
    const summary: DiffSummary = {
      added: 0,
      removed: 0,
      lines: []
    };

    if (oldContent === null) {
      // 新建文件
      summary.added = newLines.length;
      summary.lines = newLines.map((line, i) => ({ type: 'add', content: line, lineNumber: i + 1 }));
      return summary;
    }

    // 简单对比 (仅演示，后续可集成 fast-myers-diff 等)
    // 这里我们先返回一个“变更预览”标志
    summary.lines.push({ type: 'context', content: '--- 语义化预览加载中 ---' });
    
    return summary;
  }
}
