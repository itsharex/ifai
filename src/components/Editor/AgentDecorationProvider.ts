import * as monaco from 'monaco-editor';

/**
 * Agent 2.0 任务焦点追踪装饰器提供者
 */
export class AgentDecorationProvider {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private currentDecorations: string[] = [];
  private historyDecorations: string[] = [];

  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
  }

  /**
   * 更新当前活动焦点行
   * @param lineNumber 行号
   */
  public updateActiveFocus(lineNumber: number) {
    const model = this.editor.getModel();
    if (!model) return;

    // 1. 将之前的活动焦点转移到历史足迹中
    this.historyDecorations = this.editor.deltaDecorations(
      this.historyDecorations,
      this.currentDecorations.map(id => {
        const range = model.getDecorationRange(id);
        return {
          range: range || new monaco.Range(1, 1, 1, 1),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: 'agent-activity-finished-gutter',
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        };
      })
    );

    // 2. 创建新的活动焦点（带气泡和高亮）
    this.currentDecorations = this.editor.deltaDecorations(
      [],
      [{
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: 'agent-activity-line-decoration',
          glyphMarginClassName: 'agent-activity-glyph-decoration',
          glyphMarginHoverMessage: { value: 'AI 正在此处工作...' },
          stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
        }
      }]
    );

    // 3. 自动滚动到视野中心
    this.editor.revealLineInCenter(lineNumber, monaco.editor.ScrollType.Smooth);
  }

  /**
   * 清除所有任务装饰
   */
  public clearAll() {
    this.editor.deltaDecorations(this.currentDecorations, []);
    this.editor.deltaDecorations(this.historyDecorations, []);
    this.currentDecorations = [];
    this.historyDecorations = [];
  }
}
