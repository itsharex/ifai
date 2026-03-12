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
    domNode.style.backgroundColor = 'rgba(23, 23, 23, 0.98)';
    domNode.style.borderLeft = '4px solid #3b82f6';
    domNode.style.borderTop = '1px solid rgba(59, 130, 246, 0.2)';
    domNode.style.borderBottom = '1px solid rgba(59, 130, 246, 0.2)';
    domNode.style.width = '100%';
    domNode.style.display = 'flex';
    domNode.style.flexDirection = 'column';
    domNode.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), inset 0 0 15px rgba(59, 130, 246, 0.05)';
    domNode.style.zIndex = '100';
    domNode.style.overflow = 'hidden';

    // 🏆 PIVO 3.0: 物理标题栏
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.padding = '6px 16px';
    header.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    header.style.borderBottom = '1px solid rgba(59, 130, 246, 0.1)';
    header.style.fontSize = '10px';
    header.style.textTransform = 'uppercase';
    header.style.letterSpacing = '1px';
    header.style.color = '#3b82f6';
    header.style.fontWeight = 'bold';
    header.innerHTML = '<span style="margin-right: 8px;">✦</span> AI 构思的代码建议';
    domNode.appendChild(header);

    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.style.padding = '16px 20px';
    pre.style.color = '#d1d5db';
    pre.style.fontSize = '13px';
    pre.style.fontFamily = 'var(--monaco-monospace-font, Menlo, Monaco, "Courier New", monospace)';
    pre.style.lineHeight = '1.6';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-all';
    pre.style.opacity = '0.9';
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
