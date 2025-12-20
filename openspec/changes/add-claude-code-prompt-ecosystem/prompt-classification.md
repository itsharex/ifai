# 提示词分层分类详细清单

## 概述

本文档详细列出每个提示词的分层归属、公开程度和理由。

---

## 🟢 公开层（Public Tier）- 80% 完全开放

### 理由
这些提示词是**工具性质**，不涉及核心算法，公开可以：
- 建立用户信任
- 激发社区创造力
- 形成插件生态
- 便于用户调试和优化

---

### 1. 智能体提示词（Agent Prompts）

所有官方智能体提示词**完全公开**，用户可编辑、分享、创建衍生版本。

#### 1.1 代码探索智能体
- **文件**: `.ifai/prompts/agents/explore.md`
- **来源**: `claude-code-system-prompts/agent-prompt-explore.md`
- **内容**:
  ```markdown
  ---
  name: "Explore Agent"
  description: "只读代码探索智能体，快速搜索和分析代码"
  version: "1.0.0"
  access_tier: "public"
  tools: ["glob", "grep", "read", "bash"]
  ---

  You are a file search specialist for IfAI.
  You excel at thoroughly navigating and exploring codebases.

  === CRITICAL: READ-ONLY MODE ===
  This is a READ-ONLY exploration task...
  ```
- **公开理由**: 用户需要定制搜索策略，如只搜索特定目录、调整搜索深度等

#### 1.2 代码审查智能体
- **文件**: `.ifai/prompts/agents/review.md`
- **来源**: 基于 `claude-code-system-prompts/agent-prompt-review-pr-slash-command.md`
- **内容**:
  ```markdown
  ---
  name: "Review Agent"
  description: "专业代码审查智能体"
  version: "1.0.0"
  access_tier: "public"
  variables:
    - LANGUAGE
    - FRAMEWORK
    - SEVERITY_LEVEL
  ---

  You are a professional code reviewer specializing in {{LANGUAGE}}.
  Focus on: security, performance, best practices, maintainability.
  ```
- **公开理由**: 用户可能需要针对特定语言、框架调整审查规则

#### 1.3 测试生成智能体
- **文件**: `.ifai/prompts/agents/test.md`
- **内容**:
  ```markdown
  ---
  name: "Test Agent"
  description: "自动生成单元测试和集成测试"
  version: "1.0.0"
  access_tier: "public"
  variables:
    - TEST_FRAMEWORK
    - COVERAGE_TARGET
  ---

  You are a test generation specialist.
  Generate comprehensive tests using {{TEST_FRAMEWORK}}.
  Target coverage: {{COVERAGE_TARGET}}%.
  ```
- **公开理由**: 测试风格差异大，用户需要定制（如 TDD vs BDD）

#### 1.4 文档生成智能体
- **文件**: `.ifai/prompts/agents/doc.md`
- **内容**:
  ```markdown
  ---
  name: "Doc Agent"
  description: "生成和更新代码文档"
  version: "1.0.0"
  access_tier: "public"
  variables:
    - DOC_STYLE
    - DOC_FORMAT
  ---

  You are a technical documentation specialist.
  Generate clear, comprehensive documentation in {{DOC_FORMAT}} format.
  Follow {{DOC_STYLE}} style guide.
  ```
- **公开理由**: 文档风格因公司而异，必须可定制

#### 1.5 重构智能体
- **文件**: `.ifai/prompts/agents/refactor.md`
- **内容**:
  ```markdown
  ---
  name: "Refactor Agent"
  description: "提供重构建议和自动重构"
  version: "1.0.0"
  access_tier: "public"
  ---

  You are a code refactoring specialist.
  Focus on: code smells, design patterns, SOLID principles.
  Always explain the reasoning behind refactoring suggestions.
  ```
- **公开理由**: 重构策略因项目而异，用户需要控制

#### 1.6 安全审查智能体
- **文件**: `.ifai/prompts/agents/security.md`
- **来源**: 基于 `claude-code-system-prompts/agent-prompt-security-review-slash.md`
- **内容**:
  ```markdown
  ---
  name: "Security Agent"
  description: "安全审查智能体，发现漏洞"
  version: "1.0.0"
  access_tier: "public"
  ---

  You are a security expert specializing in vulnerability detection.
  Focus on: OWASP Top 10, injection attacks, auth issues.
  ```
- **公开理由**: 安全规则公开不影响安全性（反而提高透明度）

---

### 2. 工具描述提示词（Tool Description Prompts）

所有工具描述**完全公开**。

#### 2.1 Read 工具
- **文件**: `.ifai/prompts/tools/read.md`
- **来源**: `claude-code-system-prompts/tool-description-readfile.md`
- **内容**:
  ```markdown
  ---
  name: "Read Tool"
  description: "读取文件内容"
  version: "1.0.0"
  access_tier: "public"
  ---

  Reads a file from the local filesystem.

  Parameters:
  - file_path (required): Absolute path to the file
  - offset (optional): Starting line number
  - limit (optional): Number of lines to read

  Examples:
  1. Read entire file: { "file_path": "src/main.rs" }
  2. Read specific lines: { "file_path": "src/lib.rs", "offset": 10, "limit": 50 }
  ```
- **公开理由**: 用户需要了解工具如何使用，才能调试智能体行为

#### 2.2 Write 工具
- **文件**: `.ifai/prompts/tools/write.md`
- **来源**: `claude-code-system-prompts/tool-description-write.md`
- **公开理由**: 同上

#### 2.3 Edit 工具
- **文件**: `.ifai/prompts/tools/edit.md`
- **来源**: `claude-code-system-prompts/tool-description-edit.md`
- **公开理由**: 同上

#### 2.4 Glob 工具
- **文件**: `.ifai/prompts/tools/glob.md`
- **来源**: `claude-code-system-prompts/tool-description-glob.md`
- **公开理由**: 同上

#### 2.5 Grep 工具
- **文件**: `.ifai/prompts/tools/grep.md`
- **来源**: `claude-code-system-prompts/tool-description-grep.md`
- **公开理由**: 同上

#### 2.6 Bash 工具
- **文件**: `.ifai/prompts/tools/bash.md`
- **来源**: `claude-code-system-prompts/tool-description-bash.md`
- **特别注意**: 不包含 Git 提交和 PR 创建的详细说明（这些在半透明层）
- **公开理由**: 基础命令执行说明，不涉及敏感操作

#### 2.7 LSP 工具
- **文件**: `.ifai/prompts/tools/lsp.md`
- **来源**: `claude-code-system-prompts/tool-description-lsp.md`
- **公开理由**: 同上

#### 2.8 WebFetch 工具
- **文件**: `.ifai/prompts/tools/webfetch.md`
- **来源**: `claude-code-system-prompts/tool-description-webfetch.md`
- **公开理由**: 同上

#### 2.9 WebSearch 工具
- **文件**: `.ifai/prompts/tools/websearch.md`
- **来源**: `claude-code-system-prompts/tool-description-websearch.md`
- **公开理由**: 同上

---

### 3. 示例和教程提示词

#### 3.1 提示词编写教程
- **文件**: `.ifai/prompts/examples/writing-prompts-guide.md`
- **内容**: 如何编写高质量提示词的教程
- **公开理由**: 帮助用户学习

#### 3.2 智能体创建示例
- **文件**: `.ifai/prompts/examples/creating-agents-example.md`
- **来源**: 基于 `claude-code-system-prompts/agent-prompt-agent-creation-architect.md`
- **内容**: 如何创建自定义智能体的示例
- **公开理由**: 培养社区生态

#### 3.3 工具集成示例
- **文件**: `.ifai/prompts/examples/tool-integration-example.md`
- **内容**: 如何为智能体集成工具的示例
- **公开理由**: 降低扩展门槛

---

### 4. 用户自定义提示词

#### 4.1 用户目录
- **目录**: `.ifai/prompts/custom/`
- **内容**: 用户创建的所有提示词
- **权限**: 完全由用户控制
- **公开理由**: 这是用户的私有财产

---

## 🟡 半透明层（Protected Tier）- 15% 可见但不可编辑

### 理由
这些提示词定义了 AI 的**核心行为规范**，需要保持稳定性：
- 确保 AI 行为一致
- 防止用户误操作导致系统不稳定
- 提供透明度（用户知道系统在做什么）
- 高级用户可通过专家模式覆盖

---

### 1. 系统主提示词

#### 1.1 核心系统提示词
- **文件**: `.ifai/prompts/system/main.md`
- **来源**: `claude-code-system-prompts/system-prompt-main-system-prompt.md`
- **内容概要**:
  ```markdown
  ---
  name: "Main System Prompt"
  description: "IfAI 核心系统提示词"
  version: "1.0.0"
  access_tier: "protected"
  ---

  You are IfAI (若爱), an AI-powered code editor.

  # Tone and style
  - Professional, helpful, and concise
  - Focus on code quality and best practices
  - Avoid emojis unless user requests

  # Core behavior
  - Always read files before modifying
  - Prefer editing existing files over creating new ones
  - Never execute dangerous commands without confirmation

  # Tool usage policy
  - Use specialized tools (Read, Write) instead of bash when possible
  - Maximize parallel tool calls for efficiency
  - Validate parameters before tool calls

  ...
  ```
- **为什么半透明**:
  - ✅ 用户需要知道 AI 的基本行为规范（透明度）
  - ❌ 但不应随意修改，避免破坏一致性
  - ⚠️ 专家用户可创建覆盖版本（高级定制）

#### 1.2 任务管理提示词
- **文件**: `.ifai/prompts/system/task-management.md`
- **来源**: `claude-code-system-prompts/tool-description-todowrite.md`
- **内容**: TodoWrite 工具的使用规范、何时创建任务、如何管理任务状态
- **为什么半透明**: 任务管理规则影响 AI 行为，需要保持一致性

---

### 2. 对话管理提示词

#### 2.1 对话总结提示词
- **文件**: `.ifai/prompts/system/conversation-summarization.md`
- **来源**: `claude-code-system-prompts/agent-prompt-conversation-summarization.md`
- **内容概要**:
  ```markdown
  ---
  name: "Conversation Summarization"
  description: "对话总结生成提示词"
  version: "1.0.0"
  access_tier: "protected"
  ---

  Your task is to create a detailed summary of the conversation.

  Summary should include:
  1. Primary Request and Intent
  2. Key Technical Concepts
  3. Files and Code Sections
  4. Errors and Fixes
  5. Problem Solving
  6. All User Messages
  7. Pending Tasks
  8. Current Work
  9. Next Step

  ...
  ```
- **为什么半透明**:
  - 总结质量直接影响上下文管理效果
  - 用户需要知道总结规则，但不应随意修改
  - 总结模板经过优化，改动可能降低质量

#### 2.2 会话笔记生成提示词
- **文件**: `.ifai/prompts/system/session-notes.md`
- **来源**: `claude-code-system-prompts/agent-prompt-session-notes-update-instructions.md`
- **内容**: 如何自动生成和维护会话笔记
- **为什么半透明**: 同上

---

### 3. 安全和权限提示词

#### 3.1 Git 操作规范
- **文件**: `.ifai/prompts/system/git-safety.md`
- **来源**: `claude-code-system-prompts/tool-description-bash-git-commit-and-pr-creation-instructions.md`
- **内容概要**:
  ```markdown
  ---
  name: "Git Safety Protocol"
  description: "Git 操作安全规范"
  version: "1.0.0"
  access_tier: "protected"
  ---

  # Git Safety Protocol
  - NEVER update git config
  - NEVER run destructive commands (push --force, hard reset)
  - NEVER skip hooks (--no-verify)
  - NEVER force push to main/master
  - Always check authorship before amending

  # Commit workflow
  1. Run git status and git diff
  2. Draft commit message
  3. Add relevant files
  4. Create commit
  5. Verify success

  ...
  ```
- **为什么半透明**:
  - 安全规则需要透明（用户知道不会破坏仓库）
  - 但不应轻易修改（防止用户误操作导致数据丢失）

#### 3.2 命令执行安全规范
- **文件**: `.ifai/prompts/system/bash-safety.md`
- **来源**: `claude-code-system-prompts/tool-description-bash-sandbox-note.md`
- **内容**: 哪些命令需要用户确认、哪些命令被禁止
- **为什么半透明**: 安全规则需要透明，但不应被绕过

---

### 4. 计划模式提示词

#### 4.1 计划模式系统提示词
- **文件**: `.ifai/prompts/system/plan-mode.md`
- **来源**: `claude-code-system-prompts/system-reminder-plan-mode-is-active.md`
- **内容**: 计划模式下 AI 的行为规范
- **为什么半透明**: 计划模式是核心功能，行为需要一致

---

## 🔴 隐藏层（Private Tier）- 5% 完全私有

### 理由
这些内容涉及**核心商业机密**和**安全防护**：
- 保护 IfAI 的核心竞争力
- 防止提示词注入攻击
- 防止恶意利用
- 符合商业化产品定位

---

### 1. ifainew-core 内部提示词

#### 1.1 核心 AI 行为优化
- **位置**: ifainew-core 包内部（嵌入代码）
- **内容**:
  - 专有的 AI 行为调优提示词
  - 上下文压缩和优化算法
  - RAG 检索增强策略
  - 多模型协调规则
- **为什么隐藏**:
  - 这是 IfAI 的核心技术优势
  - 包含大量实验和调优结果
  - 公开会被竞品直接抄袭

#### 1.2 性能优化提示词
- **位置**: ifainew-core 包内部
- **内容**:
  - Token 优化技巧
  - 响应速度优化策略
  - 成本控制算法
- **为什么隐藏**: 商业机密

---

### 2. 反滥用和安全防护

#### 2.1 提示词注入检测规则
- **位置**: ifainew-core 包内部
- **内容**:
  ```rust
  // 不在文件中，嵌入代码
  const INJECTION_PATTERNS: &[&str] = &[
      r"ignore\s+previous\s+instructions",
      r"forget\s+everything",
      r"you\s+are\s+now",
      r"system\s*:\s*",
      // ... 100+ 种攻击模式
  ];
  ```
- **为什么隐藏**:
  - 公开会让攻击者知道如何绕过检测
  - 安全规则公开 = 安全机制失效

#### 2.2 内容过滤规则
- **位置**: ifainew-core 包内部
- **内容**: 敏感内容检测和过滤规则
- **为什么隐藏**: 防止恶意利用

#### 2.3 速率限制和反滥用
- **位置**: ifainew-core 包内部
- **内容**:
  - 异常行为检测
  - 速率限制规则
  - 滥用模式识别
- **为什么隐藏**: 防止被绕过

---

### 3. 商业化相关

#### 3.1 许可证和授权验证
- **位置**: ifainew-core 包内部
- **内容**:
  - 许可证验证逻辑
  - 功能授权控制
  - 使用限额管理
- **为什么隐藏**: 防止破解

#### 3.2 遥测和使用统计
- **位置**: ifainew-core 包内部
- **内容**:
  - 使用数据收集（可选）
  - 错误报告
  - 性能指标
- **为什么隐藏**: 商业数据敏感

---

## 📊 分层统计

| 层级 | 提示词数量 | 占比 | 示例 |
|------|-----------|------|------|
| 🟢 公开层 | ~25 个 | 80% | 6 个智能体 + 10 个工具 + 9 个示例/用户自定义 |
| 🟡 半透明层 | ~5 个 | 15% | 主系统提示词 + 对话管理 + 安全规范 + 计划模式 |
| 🔴 隐藏层 | ~2 个 | 5% | ifainew-core 优化 + 反滥用规则 |
| **总计** | **~32 个** | **100%** |  |

---

## 🔄 专家模式覆盖示例

### 场景：用户想修改系统主提示词

```
1. 用户启用专家模式（设置 → 高级 → ☑ 专家模式）

2. 打开提示词管理器 → 系统提示词 → main.md
   - 显示黄色"只读"徽章
   - 显示警告："这是系统核心提示词，修改可能导致不稳定"
   - 显示按钮："创建覆盖版本"

3. 用户点击"创建覆盖版本"
   - 系统复制 main.md 到 main.override.md
   - 打开编辑器
   - 顶部显示警告注释

4. 用户修改并保存
   - 系统加载时优先使用 main.override.md
   - 状态栏显示：⚠️ 使用自定义系统提示词

5. 如需恢复默认
   - 删除 main.override.md
   - 系统自动回退到官方版本
```

---

## 🎯 设计原则总结

### 1. **默认透明**
- 95% 的提示词可见（公开 80% + 半透明 15%）
- 用户清楚知道 AI 在做什么

### 2. **分级保护**
- 公开层：完全开放，激发创造力
- 半透明层：透明但稳定，防止误操作
- 隐藏层：保护核心竞争力和安全

### 3. **平衡商业与开放**
- 不是简单的"全开源"或"全封闭"
- IfAI 作为商业产品，需要保护价值
- 但透明度是建立信任的关键

### 4. **专家友好**
- 高级用户可通过专家模式深度定制
- 但需要明确的警告和说明
- 保持默认行为稳定

---

## ✅ 结论

**公开的**（95% 可见）：
- ✅ 所有智能体提示词（6 个）
- ✅ 所有工具描述（10 个）
- ✅ 所有示例和教程
- ✅ 用户自定义的一切
- 👁️ 系统主提示词（可见但只读）
- 👁️ 对话管理提示词（可见但只读）
- 👁️ 安全规范（可见但只读）

**不公开的**（5% 隐藏）：
- 🔒 ifainew-core 内部优化
- 🔒 提示词注入检测规则
- 🔒 反滥用和速率限制
- 🔒 商业授权验证

这个设计让 IfAI 既享受开源透明度的优势，又保护核心商业价值！
