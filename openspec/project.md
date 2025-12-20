# Project Context

## Purpose
若爱 (IfAI) is a modern cross-platform AI code editor that seamlessly integrates powerful AI assistance with traditional code editing capabilities. The project aims to make AI a developer's most caring programming companion, combining smooth editing experience with intelligent coding support.

**Core Philosophy:**
- Focus on developer experience with zero-latency response
- Deep AI integration that understands code intent
- Lightweight and efficient (Rust + Tauri architecture)
- Cross-platform consistency (Windows, macOS, Linux)
- Local-first with controllable data privacy

## Tech Stack

### Frontend
- **React 19** - UI framework with latest features (Server Components, concurrent rendering)
- **TypeScript 5.8** - Type safety and developer experience
- **Zustand** - Lightweight state management
- **TailwindCSS** - Utility-first styling
- **Monaco Editor** - VSCode-grade code editor engine
- **Vite 7** - Fast build tool with HMR
- **react-i18next** - Internationalization (Chinese/English)

### Backend (Rust/Tauri)
- **Tauri 2.0** - Cross-platform desktop framework
- **tokio** - Async runtime for concurrent operations
- **serde/serde_json** - Serialization/deserialization
- **reqwest** - HTTP client for AI model APIs (with streaming support)
- **git2** - Git integration for version control
- **portable-pty** - Terminal emulation
- **walkdir** - File system traversal
- **fastembed** - Vector embeddings for RAG
- **text-splitter** - Document chunking for semantic search
- **notify** - File system watching

### Core Capabilities (Private Extension)
- **ifainew-core** - Private package providing AI model integration, agent toolchain, and RAG retrieval

## Project Conventions

### Code Style
- **Frontend**: TypeScript strict mode, React Hooks best practices, functional components
- **Backend**: Rust official style guide, run `cargo fmt` and `cargo clippy` before commits
- **Commits**: Follow Conventional Commits specification
  - `feat:` - New features
  - `fix:` - Bug fixes
  - `refactor:` - Code refactoring
  - `docs:` - Documentation updates
  - `test:` - Test additions/updates
  - `chore:` - Build/tooling changes

### Naming Conventions
- **Files**: kebab-case for file names (e.g., `file-tree.tsx`, `chat-store.ts`)
- **Components**: PascalCase for React components (e.g., `FileTree`, `AIChat`)
- **Functions/Variables**: camelCase (e.g., `handleFileOpen`, `currentFile`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`)
- **Rust**: snake_case for functions/variables, PascalCase for types/structs

### Architecture Patterns

**Frontend Architecture:**
- Component-based with clear separation of concerns
- Store-based state management using Zustand
- Tauri commands for backend communication
- Event-driven architecture for real-time updates

**Backend Architecture:**
- Event-driven async operations using tokio
- Tauri command handlers for frontend-backend bridge
- Service layer pattern for business logic
- Dependency injection pattern for core package access

**Communication Pattern:**
```
Frontend (React)
  ↕ Tauri Commands (invoke)
  ↕ Tauri Events (emit/listen)
Backend (Rust)
  ↕ Core Package Registration
ifainew-core (AI capabilities)
```

**Directory Structure:**
```
src/
├── components/          # React UI components
│   ├── Editor/         # Monaco editor wrapper
│   ├── FileTree/       # File browser
│   ├── AIChat/         # AI conversation UI
│   └── Terminal/       # Terminal emulator
├── stores/             # Zustand state stores
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
└── i18n/               # Internationalization

src-tauri/src/
├── lib.rs              # Main entry and command registration
├── file_walker.rs      # File system operations
├── terminal.rs         # Terminal session management
├── git.rs              # Git integration
├── lsp.rs              # Language Server Protocol client
└── search.rs           # File content search
```

### Testing Strategy
- **Unit Tests**: Test core business logic and utilities
- **Integration Tests**: Located in `tests/` directory
  - `spec_agent_flow.cjs` - Agent workflow tests
  - `spec_escape_fix.cjs` - Escape sequence handling
  - `spec_tool_history.cjs` - Tool history tracking
- **Manual Testing**: Required for UI/UX changes
- **Run Tests**: `node tests/spec_*.cjs`

### Git Workflow
- **Main Branch**: `main` (production-ready code)
- **Feature Branches**: `feature/[feature-name]` (e.g., `feature/0.2.0plan`)
- **Bugfix Branches**: `fix/[bug-description]`
- **Release Strategy**: Semantic versioning (v0.1.0, v0.2.0, etc.)
- **PR Review**: Required before merging to main
- **Commit Hygiene**: Squash commits for cleaner history

## Domain Context

### AI Integration Patterns
- **Multi-Model Support**: OpenAI, Anthropic Claude, Zhipu AI (智谱 AI)
- **Streaming Responses**: Real-time token streaming using Server-Sent Events (SSE)
- **RAG (Retrieval-Augmented Generation)**: Vector embeddings with fastembed for context-aware responses
- **Context Building**: Intelligent code context extraction and relevance ranking

### File Management
- **Large Project Support**: Efficient file tree rendering with virtual scrolling
- **Git Status Tracking**: Real-time file status indicators (modified, added, deleted)
- **Multi-Tab Editing**: Manage multiple files with tab switching
- **File Watching**: Auto-refresh on external file changes

### Terminal Integration
- **PTY Emulation**: Full terminal emulation using portable-pty
- **ANSI Support**: Complete ANSI escape sequence rendering
- **Multi-Session**: Support multiple concurrent terminal sessions
- **Shell Integration**: Platform-specific shell detection (bash, zsh, pwsh)

## Important Constraints

### Technical Constraints
- **Tauri 2.0 API**: Must use Tauri 2.0 APIs (not v1.x)
- **Bundle Size**: Keep bundle size minimal (<10MB compressed)
- **Memory Efficiency**: Optimize for low memory usage (vs Electron)
- **Startup Performance**: Target <3s cold start time
- **Cross-Platform**: Must work on Windows 10+, macOS 11+, Linux (Debian/Ubuntu/Fedora)

### Business Constraints
- **Core AI Module**: Private/commercial - not open source
- **Open Source Scope**: Editor framework and extension interfaces only
- **License**: MIT for open source parts
- **Privacy**: Local-first architecture, no forced cloud sync

### Regulatory Constraints
- **Data Privacy**: User code never sent to servers without explicit consent
- **AI Model Usage**: Support for local models to comply with strict privacy requirements
- **Export Control**: Careful with bundling certain cryptographic libraries

## External Dependencies

### AI Model Services (External APIs)
- **OpenAI API**: GPT-4, GPT-3.5 for code generation and chat
- **Anthropic Claude API**: Claude 3 Opus/Sonnet for advanced reasoning
- **Zhipu AI (智谱 AI)**: Local Chinese AI service provider
- **Configuration**: API keys stored in user settings, not in codebase

### Development Tools
- **Language Servers**: External LSP servers for various languages
  - TypeScript: `typescript-language-server`
  - Rust: `rust-analyzer`
  - Python: `pyright`
  - Configure via user settings

### System Dependencies
- **Git**: System git binary for version control operations
- **Shell**: Platform shell (bash, zsh, cmd, pwsh) for terminal
- **WebKit/WebView**: System webview for rendering UI
  - Windows: WebView2 (Edge)
  - macOS: WKWebView (Safari)
  - Linux: WebKitGTK

### Build Dependencies
- **Node.js >= 18**: Frontend build and package management
- **Rust >= 1.70**: Backend compilation
- **Platform Build Tools**:
  - Windows: Visual Studio Build Tools
  - macOS: Xcode Command Line Tools
  - Linux: build-essential, libgtk-3-dev, libwebkit2gtk-4.0-dev

## Current Development Phase

**Version**: v0.1.0 (MVP - Basic functionality complete)
**Current Branch**: feature/0.2.0plan (Planning v0.2.0 enhancements)

**Recent Work** (from git commits):
- Rust backend compilation fixes
- File management enhancements
- Editor functionality improvements
- AI chat integration
- macOS Universal Build cross-compilation
- fastembed model caching in Tauri app

**Next Milestone**: v0.2.0 - Enhanced experience
- Plugin system
- Custom keyboard shortcuts
- Code snippet management
- Markdown preview
- Multi-cursor editing
- File history comparison
