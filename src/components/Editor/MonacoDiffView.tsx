import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';

interface MonacoDiffViewProps {
  oldValue: string;
  newValue: string;
  language?: string;
  theme?: string;
  height?: string | number;
}

export const MonacoDiffView: React.FC<MonacoDiffViewProps> = ({ 
  oldValue, 
  newValue, 
  language = 'plaintext',
  theme = 'vs-dark',
  height = 300 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Create models
      const originalModel = monaco.editor.createModel(oldValue, language);
      const modifiedModel = monaco.editor.createModel(newValue, language);

      // Create Diff Editor
      const diffEditor = monaco.editor.createDiffEditor(containerRef.current, {
        originalEditable: false,
        readOnly: true,
        renderSideBySide: true,
        automaticLayout: true,
        theme: theme,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        renderIndicators: true,
        useInlineViewWhenSpaceIsLimited: true,
        scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            useShadows: false,
            verticalHasArrows: false,
            horizontalHasArrows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
        }
      });

      diffEditor.setModel({
        original: originalModel,
        modified: modifiedModel,
      });

      editorRef.current = diffEditor;

      return () => {
        // Critical fix: Detach models from editor BEFORE disposing them to prevent "TextModel got disposed" error
        if (diffEditor) {
            diffEditor.setModel(null);
        }
        originalModel.dispose();
        modifiedModel.dispose();
        diffEditor.dispose();
      };
    }
  }, [oldValue, newValue, language, theme]);

  return (
    <div 
      ref={containerRef} 
      style={{ height, width: '100%', borderRadius: '4px', overflow: 'hidden', border: '1px solid #333' }} 
    />
  );
};
