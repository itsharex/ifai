import * as monaco from 'monaco-editor';

/**
 * 实现 Monaco 原生 ZoneWidget 的包装
 * 备注：在 Monaco 中，ZoneWidget 需要手动管理其容器 DOM 的渲染
 */
export class InlineDiffZone {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private domNode: HTMLElement | null = null;
  private viewZoneId: string | null = null;

  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
  }

  /**
   * 显示内联区域
   */
  public show(lineNumber: number, heightInLines: number, content: string | HTMLElement) {
    this.hide();

    const domNode = document.createElement('div');
    domNode.className = 'monaco-inline-diff-zone';
    domNode.style.backgroundColor = 'rgba(30, 30, 30, 0.8)';
    domNode.style.backdropFilter = 'blur(10px)';
    domNode.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
    domNode.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
    domNode.style.width = '100%';
    domNode.style.display = 'flex';
    domNode.style.flexDirection = 'column';

    if (typeof content === 'string') {
      domNode.innerText = content;
    } else {
      domNode.appendChild(content);
    }

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
  }
}
