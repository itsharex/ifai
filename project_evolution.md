# IfAI Project Evolution: From Editor to Intelligent IDE

## Vision
将 IfAI 从一个“带有 AI 聊天功能的文本编辑器”进化为**“AI 原生驱动的智能 IDE”**。核心差异化在于 AI 不再仅仅是侧边栏的对话框，而是能够深入理解项目上下文、主动执行任务并与开发环境深度融合的 Agent。

## Roadmap Overview

### Phase 6: IDE 基础补完 (The "Solid Foundation" Update)
*目标：补齐作为专业编辑器缺失的核心能力，使其能替代轻量级 Coding 任务。*

1.  **LSP (Language Server Protocol) 集成**:
    *   支持 Go to Definition (跳转定义)。
    *   支持 Real-time Linting (实时错误检查)。
    *   支持 Advanced Autocomplete (基于类型的智能补全)。
    *   *技术路径*: Rust 后端运行 `rust-analyzer`, `tsserver` 等二进制，通过 JSON-RPC 与 Monaco 通信。
2.  **集成终端 (Integrated Terminal)**:
    *   内置 `xterm.js`。
    *   支持多终端标签页。
    *   *技术路径*: 使用 Rust `portable-pty` crate 管理伪终端进程。
3.  **全局搜索 (Global Search)**:
    *   实现“在文件中查找” (Cmd+Shift+F)。
    *   *技术路径*: 集成 `ripgrep` 到 Rust 后端，实现毫秒级全项目搜索。
4.  **Git 集成 (Basic)**:
    *   文件树显示 Git 状态颜色（新增、修改）。
    *   基础的 Diff 视图。

### Phase 7: AI Agent 进化 (The "Agentic" Update)
*目标：让 AI 具备“行动力”，从“建议者”变为“执行者”。*

1.  **AI Composer (多文件编辑)**:
    *   类似 Cursor 的 Composer 模式。
    *   用户输入一个需求（如“重构 Auth 模块并更新所有引用”），AI 分析依赖，生成多个文件的修改计划。
2.  **Inline AI Edit (内联编辑)**:
    *   Cmd+K 唤起行内输入框，直接用自然语言修改代码，通过 Diff 视图预览变更并 Accept/Reject。
3.  **Context Awareness (上下文感知)**:
    *   AI 自动读取当前打开的文件、Git Diff、终端报错信息作为上下文。
    *   支持 `@Codebase` 语义搜索（使用向量数据库或 RAG）。

---

## Next Steps: Phase 6 Detailed Plan

为了稳步推进，建议先执行 **Phase 6**，因为没有 LSP 和终端的编辑器很难在实际工作中留住用户。

### 6.1 集成终端 (Terminal)
*   **Why**: 开发者需要运行 `npm install`, `cargo run`, `git commit` 等命令。
*   **Tech**: Tauri v2 `shell` 插件 (受限) 或自定义 Rust `pty` 实现 (推荐)。

### 6.2 快速文件搜索 (Quick Open / Command Palette)
*   **Why**: 目前只能通过文件树打开文件，效率低。
*   **Feature**: 实现 `Cmd+P` 弹窗，模糊匹配文件名快速打开。

### 6.3 LSP 基础架构
*   **Why**: 语法高亮不够用，需要真正的代码智能。
*   **Plan**: 先跑通一个语言（如 TypeScript 或 Rust）的 LSP 流程。

---

## 提案建议

我建议**优先启动 Phase 6.2 (Command Palette & Quick Open)** 和 **Phase 6.1 (Terminal)**。这两个功能开发周期适中，但能极大地提升“专业感”。

**您希望先推进哪个方向？**
A. **增强 IDE 能力** (终端、LSP、搜索) —— *推荐，打好地基*
B. **增强 AI 能力** (内联编辑、上下文感知) —— *激进，直奔核心亮点*
