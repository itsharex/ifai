import * as monaco from 'monaco-editor';

/**
 * 实现 Monaco 原生 ZoneWidget 的包装
 * 备注：在 Monaco 中，ZoneWidget 需要手动管理其容器 DOM 的渲染
 */
export class InlineDiffZone {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private domNode: HTMLElement | null = null;
  private viewZoneId: string | null = null;
  private currentLineNumber: number = -1;

  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
  }

  public show(lineNumber: number, heightInLines: number, content: string) {
    // 🔥 优化：如果已经在当前行，执行原地更新
    if (this.viewZoneId !== null && this.currentLineNumber === lineNumber && this.domNode) {
      const pre = this.domNode.querySelector('pre');
      if (pre) {
        pre.innerText = content;
        // 动态更新高度
        this.editor.changeViewZones((changeAccessor) => {
          changeAccessor.layoutZone(this.viewZoneId!);
        });
        return;
      }
    }

    this.hide();
    this.currentLineNumber = lineNumber;

    const domNode = document.createElement('div');
    domNode.className = 'monaco-inline-diff-zone';
    domNode.style.backgroundColor = 'rgba(30, 30, 30, 0.95)';
    domNode.style.borderTop = '1px solid rgba(59, 130, 246, 0.3)';
    domNode.style.borderBottom = '1px solid rgba(59, 130, 246, 0.3)';
    domNode.style.width = '100%';
    domNode.style.display = 'flex';
    domNode.style.flexDirection = 'column';
    domNode.style.boxShadow = 'inset 0 0 20px rgba(0,0,0,0.5)';

    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.style.padding = '12px 40px';
    pre.style.color = '#4ec9b0';
    pre.style.fontSize = '12px';
    pre.style.fontFamily = 'var(--monaco-monospace-font, monospace)';
    pre.style.lineHeight = '1.5';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-all';
    pre.innerText = content;
    domNode.appendChild(pre);

    this.domNode = domNode;

    this.editor.changeViewZones((changeAccessor) => {
      this.viewZoneId = changeAccessor.addZone({
        afterLineNumber: lineNumber,
        heightInLines: heightInLines,
        domNode: this.domNode!
      });
    });
  }

  public hide() {
    if (this.viewZoneId !== null) {
      this.editor.changeViewZones((changeAccessor) => {
        changeAccessor.removeZone(this.viewZoneId!);
      });
      this.viewZoneId = null;
    }
    this.domNode = null;
    this.currentLineNumber = -1;
  }
}
