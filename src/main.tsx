import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
import './i18n/config';

// v0.3.0: 启动调试日志
console.log('[Main] 🚀 App starting...');
console.log('[Main] Mode:', import.meta.env.MODE);
console.log('[Main] Dev:', import.meta.env.DEV);

// Import type extensions to apply module augmentation
import './types/chat';

// Import Monaco language contributions for syntax highlighting
import './utils/monacoLanguages';

// Monaco 环境延迟初始化函数
const initMonacoEnvironment = async () => {
  console.log('[Main] 🛠️  Initializing Monaco Environment...');
  
  // 动态导入 Worker (Vite 会将其处理为独立的 chunk)
  const [
    editorWorker, 
    jsonWorker, 
    cssWorker, 
    htmlWorker, 
    tsWorker
  ] = await Promise.all([
    import('monaco-editor/esm/vs/editor/editor.worker?worker'),
    import('monaco-editor/esm/vs/language/json/json.worker?worker'),
    import('monaco-editor/esm/vs/language/css/css.worker?worker'),
    import('monaco-editor/esm/vs/language/html/html.worker?worker'),
    import('monaco-editor/esm/vs/language/typescript/ts.worker?worker')
  ]);

  // @ts-ignore
  window.MonacoEnvironment = {
    getWorker(_: any, label: string) {
      if (label === 'json') return new jsonWorker.default();
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker.default();
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker.default();
      if (label === 'typescript' || label === 'javascript') return new tsWorker.default();
      return new editorWorker.default();
    },
  };
  
  // 动态加载语言贡献
  await import('./utils/monacoLanguages');
  console.log('[Main] ✅ Monaco Environment ready');
};

// 暴露 Store 到全局以便调试 (延迟执行)
const exposeDebugStores = () => {
  if (import.meta.env.DEV || (window as any).__E2E__) {
    // 使用 requestIdleCallback 确保在浏览器空闲时执行
    const runExpose = () => {
      Promise.all([
        import('./stores/skillStore'),
        import('./stores/fileStore'),
        import('./stores/useChatStore'),
        import('./stores/settingsStore'),
        import('./stores/layoutStore'),
        import('./stores/editorStore'),
        import('./utils/tokenCounter')
      ]).then(([skill, file, chat, settings, layout, editor, tokens]) => {
        (window as any).__DEBUG__ = {
          ...(window as any).__DEBUG__,
          skillStore: skill.useSkillStore,
          fileStore: file.useFileStore,
          chatStore: chat.useChatStore,
          settingsStore: settings.useSettingsStore,
          layoutStore: layout.useLayoutStore,
          editorStore: editor.useEditorStore,
          utils: {
            ...((window as any).__DEBUG__?.utils || {}),
            tokenCounter: tokens
          }
        };
        console.log('[Main] 🛠️  Core Stores and Utils exposed to window.__DEBUG__ (Idle)');
      });
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(runExpose);
    } else {
      setTimeout(runExpose, 1000);
    }
  }
};

// 启动流程
initMonacoEnvironment();
exposeDebugStores();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);

// v0.3.0: 渲染完成日志
console.log('[Main] ✅ App rendered successfully');
console.log('[Main] Root element:', document.getElementById("root"));
console.log('[Main] Document ready state:', document.readyState);
