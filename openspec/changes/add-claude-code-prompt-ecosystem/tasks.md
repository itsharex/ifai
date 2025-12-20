# 实施任务清单：Claude Code 提示词生态系统

## 0. 前期准备

- [ ] 0.1 团队评审提案和设计文档
- [ ] 0.2 确认 ifainew-core 接口扩展方案
- [ ] 0.3 创建开发分支 `feature/prompt-ecosystem`
- [ ] 0.4 设置项目管理看板（GitHub Projects）
- [ ] 0.5 准备测试环境和测试数据

## 1. 基础架构

### 1.1 数据结构定义

- [ ] 1.1.1 定义 Rust 数据结构
  - [ ] `PromptTemplate`, `PromptMetadata`
  - [ ] `AgentDefinition`, `AgentStatus`, `AgentResult`
  - [ ] `ToolDescriptor`, `ToolCall`, `ToolResult`
  - [ ] `ConversationSummary`, `SessionNotes`
- [ ] 1.1.2 定义 TypeScript 类型
  - [ ] `src/types/prompt.ts`
  - [ ] `src/types/agent.ts`
  - [ ] `src/types/tool.ts`
  - [ ] `src/types/conversation.ts`
- [ ] 1.1.3 添加 Serde 序列化支持
- [ ] 1.1.4 编写单元测试

### 1.2 配置文件和目录结构

- [ ] 1.2.1 创建 `.ifai/` 目录结构
  - [ ] `.ifai/prompts/` (系统、智能体、工具)
  - [ ] `.ifai/agents/custom/`
  - [ ] `.ifai/tools/custom/`
  - [ ] `.ifai/sessions/` (笔记、总结)
- [ ] 1.2.2 创建默认配置文件
  - [ ] `.ifai/config.toml` (用户配置)
  - [ ] `.ifai/version.txt` (数据版本)
- [ ] 1.2.3 添加配置验证和错误处理

## 2. 提示词管理系统

### 2.1 后端实现

- [ ] 2.1.1 创建 `prompt_manager` 模块
  - [ ] `src-tauri/src/prompt_manager/mod.rs`
  - [ ] `storage.rs` - 提示词 CRUD
  - [ ] `template.rs` - Handlebars 模板渲染
  - [ ] `variables.rs` - 变量解析和注入
  - [ ] `versioning.rs` - 版本管理
- [ ] 2.1.2 实现提示词文件读写
  - [ ] 解析 YAML Front Matter
  - [ ] Markdown 内容处理
  - [ ] 文件监听和自动重载
- [ ] 2.1.3 实现模板渲染引擎
  - [ ] 集成 `handlebars` crate
  - [ ] 注册自定义 helper (如 `eq`, `ne`)
  - [ ] 变量收集（系统、用户、运行时）
- [ ] 2.1.4 实现版本管理
  - [ ] Git 集成（提示词变更追踪）
  - [ ] 版本对比 (diff)
  - [ ] 回滚功能
- [ ] 2.1.5 Tauri 命令实现
  - [ ] `list_prompts`
  - [ ] `get_prompt`
  - [ ] `update_prompt`
  - [ ] `render_prompt_template`
  - [ ] `get_prompt_versions`
  - [ ] `rollback_prompt`
- [ ] 2.1.6 编写单元测试和集成测试

### 2.2 前端实现

- [ ] 2.2.1 创建 `promptStore` (Zustand)
  - [ ] State: `prompts`, `selectedPrompt`, `isLoading`
  - [ ] Actions: `loadPrompts`, `selectPrompt`, `updatePrompt`
- [ ] 2.2.2 实现 `PromptManager` 组件
  - [ ] `PromptList.tsx` - 提示词列表（分类、搜索）
  - [ ] `PromptEditor.tsx` - Monaco Editor 编辑器
  - [ ] `TemplateViewer.tsx` - 实时预览
  - [ ] `VersionHistory.tsx` - 版本历史和对比
- [ ] 2.2.3 实现提示词编辑器功能
  - [ ] 语法高亮（Markdown + Handlebars）
  - [ ] 自动补全（变量名）
  - [ ] 实时预览（变量替换）
  - [ ] 保存和撤销
- [ ] 2.2.4 添加国际化（中英文）
- [ ] 2.2.5 编写组件测试

### 2.3 默认提示词库

- [ ] 2.3.1 从 claude-code-system-prompts 迁移核心提示词
  - [ ] `prompts/system/main.md` - 主系统提示词
  - [ ] `prompts/agents/explore.md`
  - [ ] `prompts/agents/review.md`
  - [ ] `prompts/agents/test.md`
  - [ ] `prompts/agents/doc.md`
  - [ ] `prompts/agents/refactor.md`
  - [ ] `prompts/tools/*.md` - 工具描述
- [ ] 2.3.2 适配到 IfAI 上下文
  - [ ] 替换 Claude Code 特定术语
  - [ ] 添加 IfAI 特定变量
  - [ ] 调整示例代码
- [ ] 2.3.3 打包为内置资源（嵌入到二进制）

## 3. 工具描述系统

### 3.1 后端实现

- [ ] 3.1.1 创建 `tool_registry` 模块
  - [ ] `src-tauri/src/tool_registry/mod.rs`
  - [ ] `registry.rs` - 工具注册表
  - [ ] `executor.rs` - 工具执行器
  - [ ] `descriptor.rs` - 工具描述
  - [ ] `sandbox.rs` - 沙箱和权限控制
- [ ] 3.1.2 定义 `Tool` trait
  ```rust
  #[async_trait]
  pub trait Tool: Send + Sync {
      fn descriptor(&self) -> &ToolDescriptor;
      async fn execute(&self, args: Value) -> Result<ToolResult>;
  }
  ```
- [ ] 3.1.3 实现核心工具
  - [ ] `tools/read.rs` - 读取文件
  - [ ] `tools/write.rs` - 写入文件
  - [ ] `tools/edit.rs` - 编辑文件
  - [ ] `tools/glob.rs` - 文件模式匹配
  - [ ] `tools/grep.rs` - 正则搜索
  - [ ] `tools/bash.rs` - 执行 Shell 命令
  - [ ] `tools/lsp.rs` - LSP 集成
- [ ] 3.1.4 实现工具权限系统
  - [ ] 定义权限级别（只读、读写、执行）
  - [ ] 工具白名单/黑名单
  - [ ] 用户确认机制（危险操作）
- [ ] 3.1.5 实现工具沙箱
  - [ ] 文件访问限制（项目目录内）
  - [ ] 命令执行白名单
  - [ ] 超时控制
- [ ] 3.1.6 Tauri 命令实现
  - [ ] `list_tools`
  - [ ] `get_tool_descriptor`
  - [ ] `execute_tool`
  - [ ] `get_tool_call_history`
- [ ] 3.1.7 编写单元测试

### 3.2 前端实现

- [ ] 3.2.1 创建 `toolStore` (Zustand)
  - [ ] State: `tools`, `callHistory`, `isExecuting`
  - [ ] Actions: `loadTools`, `executeTool`, `loadHistory`
- [ ] 3.2.2 实现 `ToolExplorer` 组件
  - [ ] `ToolList.tsx` - 工具列表（分类）
  - [ ] `ToolDetail.tsx` - 工具详情（参数、示例）
  - [ ] `ToolTester.tsx` - 工具测试界面
  - [ ] `CallHistory.tsx` - 调用历史
- [ ] 3.2.3 实现工具测试功能
  - [ ] 参数表单自动生成（基于 JSON Schema）
  - [ ] 执行按钮和结果显示
  - [ ] 错误处理和提示
- [ ] 3.2.4 添加国际化
- [ ] 3.2.5 编写组件测试

### 3.3 工具描述文档

- [ ] 3.3.1 为每个工具编写 Markdown 文档
  - [ ] 描述、参数、返回值、示例、注意事项
- [ ] 3.3.2 在 UI 中嵌入文档显示

## 4. 多智能体系统

### 4.1 后端实现

- [ ] 4.1.1 创建 `agent_system` 模块
  - [ ] `src-tauri/src/agent_system/mod.rs`
  - [ ] `supervisor.rs` - 智能体监督者
  - [ ] `router.rs` - 消息路由
  - [ ] `base.rs` - 智能体基类 trait
- [ ] 4.1.2 定义 `Agent` trait
  ```rust
  #[async_trait]
  pub trait Agent: Send + Sync {
      fn id(&self) -> &str;
      fn agent_type(&self) -> &str;
      async fn run(&mut self, ctx: AgentContext) -> Result<AgentResult>;
      fn available_tools(&self) -> Vec<String>;
  }
  ```
- [ ] 4.1.3 实现 `Supervisor`
  - [ ] 智能体生命周期管理（启动、停止、重启）
  - [ ] 任务队列和调度
  - [ ] 并发控制（最大并发数）
  - [ ] 资源限制（超时、内存）
- [ ] 4.1.4 实现 `MessageRouter`
  - [ ] 智能体间消息传递
  - [ ] 事件发送到前端（状态、日志、输出）
- [ ] 4.1.5 实现核心智能体
  - [ ] `agents/explore.rs` - 只读代码探索
    - [ ] 支持 Glob、Grep、Read 工具
    - [ ] 多层次搜索策略（文件名 → 内容 → 深度分析）
  - [ ] `agents/review.rs` - 代码审查
    - [ ] 支持 Read、Grep 工具
    - [ ] 审查清单（安全、性能、最佳实践）
  - [ ] `agents/test_gen.rs` - 测试生成
    - [ ] 支持 Read、Write 工具
    - [ ] 生成单元测试、集成测试
  - [ ] `agents/doc_gen.rs` - 文档生成
    - [ ] 支持 Read、Write 工具
    - [ ] 生成 README、API 文档、注释
  - [ ] `agents/refactor.rs` - 重构建议
    - [ ] 支持 Read、Edit 工具
    - [ ] 提供重构方案和自动执行
- [ ] 4.1.6 实现智能体与 ifainew-core 集成
  - [ ] 加载提示词
  - [ ] 注入工具描述
  - [ ] 流式响应处理
  - [ ] 工具调用解析和执行
- [ ] 4.1.7 Tauri 命令实现
  - [ ] `launch_agent`
  - [ ] `get_agent_status`
  - [ ] `stop_agent`
  - [ ] `get_agent_result`
  - [ ] `list_running_agents`
- [ ] 4.1.8 实现 Tauri 事件
  - [ ] `agent:status` - 状态更新
  - [ ] `agent:log` - 日志输出
  - [ ] `agent:output` - 流式输出
  - [ ] `agent:tool_call` - 工具调用事件
- [ ] 4.1.9 编写单元测试和集成测试

### 4.2 前端实现

- [ ] 4.2.1 创建 `agentStore` (Zustand)
  - [ ] State: `runningAgents`, `agentLogs`, `agentResults`
  - [ ] Actions: `launchAgent`, `stopAgent`, `updateStatus`
- [ ] 4.2.2 实现 `AgentPanel` 组件
  - [ ] `AgentList.tsx` - 运行中智能体列表
  - [ ] `AgentStatus.tsx` - 状态显示（进度条）
  - [ ] `AgentLogs.tsx` - 实时日志输出
  - [ ] `AgentControl.tsx` - 控制按钮（停止、恢复）
- [ ] 4.2.3 实现事件监听
  - [ ] 监听 `agent:status` 更新 UI
  - [ ] 监听 `agent:log` 追加日志
  - [ ] 监听 `agent:output` 显示输出
  - [ ] 监听 `agent:tool_call` 显示工具调用
- [ ] 4.2.4 在 `AIChat` 中集成智能体
  - [ ] 识别用户请求类型，推荐智能体
  - [ ] 一键启动智能体
  - [ ] 显示智能体输出在对话中
- [ ] 4.2.5 添加国际化
- [ ] 4.2.6 编写组件测试

### 4.3 智能体协作机制

- [ ] 4.3.1 定义智能体间消息协议
  - [ ] 请求调用其他智能体
  - [ ] 共享上下文
  - [ ] 传递中间结果
- [ ] 4.3.2 实现用户确认 UI（智能体请求调用其他智能体时）
- [ ] 4.3.3 实现工作流可视化（DAG 图）

## 5. 对话管理系统

### 5.1 对话总结

- [ ] 5.1.1 创建 `conversation` 模块
  - [ ] `src-tauri/src/conversation/mod.rs`
  - [ ] `summarizer.rs` - 对话总结
  - [ ] `notes.rs` - 会话笔记
  - [ ] `storage.rs` - 会话存储
- [ ] 5.1.2 实现对话总结逻辑
  - [ ] Token 计数（tiktoken-rs）
  - [ ] 触发条件检测（token > 150k 或消息 > 100）
  - [ ] 调用 AI 生成总结（使用 claude-code 的总结提示词）
  - [ ] 结构化总结解析
- [ ] 5.1.3 实现总结存储
  - [ ] 保存完整对话到归档
  - [ ] 注入总结为系统消息
  - [ ] 清理旧消息
- [ ] 5.1.4 Tauri 命令实现
  - [ ] `summarize_conversation`
  - [ ] `get_conversation_summary`
  - [ ] `get_archived_conversation`
- [ ] 5.1.5 编写单元测试

### 5.2 会话笔记

- [ ] 5.2.1 定义 `SessionNotes` 结构
  - [ ] 技术概念列表
  - [ ] 文件变更历史
  - [ ] 错误和修复记录
  - [ ] 待办任务列表
- [ ] 5.2.2 实现自动笔记生成
  - [ ] 从对话中提取关键信息
  - [ ] 追踪文件变更（工具调用历史）
  - [ ] 提取错误和修复
- [ ] 5.2.3 Tauri 命令实现
  - [ ] `get_session_notes`
  - [ ] `update_session_notes`
  - [ ] `export_session_notes` (Markdown 格式)
- [ ] 5.2.4 编写单元测试

### 5.3 前端实现

- [ ] 5.3.1 扩展 `conversationStore`
  - [ ] State: `summaries`, `sessionNotes`
  - [ ] Actions: `generateSummary`, `updateNotes`
- [ ] 5.3.2 实现 `SessionNotes` 组件
  - [ ] 笔记编辑器
  - [ ] 自动生成按钮
  - [ ] 导出功能
- [ ] 5.3.3 在 `AIChat` 中显示总结
  - [ ] 可折叠的总结卡片
  - [ ] 查看完整历史按钮
- [ ] 5.3.4 添加国际化
- [ ] 5.3.5 编写组件测试

## 6. AI 行为透明化

### 6.1 提示词显示

- [ ] 6.1.1 在消息中显示使用的提示词
  - [ ] 可折叠的提示词卡片
  - [ ] 高亮变量替换
- [ ] 6.1.2 实现"调试模式"开关
  - [ ] 显示完整提示词
  - [ ] 显示所有工具描述
  - [ ] 显示 AI 思考过程（thinking blocks）

### 6.2 工具调用显示

- [ ] 6.2.1 在消息中显示工具调用
  - [ ] 工具名、参数、结果
  - [ ] 可折叠详情
  - [ ] 执行时间和状态
- [ ] 6.2.2 实现工具调用时间线（按时间排序）

### 6.3 智能体状态可视化

- [ ] 6.3.1 实现智能体状态指示器
  - [ ] 运行中、等待工具、完成、失败
  - [ ] 进度百分比
  - [ ] 执行步骤列表
- [ ] 6.3.2 实现智能体日志查看器
  - [ ] 实时滚动
  - [ ] 日志级别过滤
  - [ ] 导出日志

## 7. ifainew-core 集成

### 7.1 接口扩展

- [ ] 7.1.1 扩展 `generate_response` 接口
  ```rust
  pub async fn generate_response(
      messages: Vec<Message>,
      system_prompt: String,        // 新增
      tools: Vec<ToolDescriptor>,   // 新增
      options: GenerateOptions,
  ) -> Result<GenerateResult>;
  ```
- [ ] 7.1.2 实现工具调用解析
  - [ ] 支持 OpenAI function calling 格式
  - [ ] 支持 Anthropic tool use 格式
- [ ] 7.1.3 实现流式响应中的事件分发
  - [ ] 区分文本输出和工具调用
  - [ ] 发送中间状态事件
- [ ] 7.1.4 编写集成测试

### 7.2 RAG 增强

- [ ] 7.2.1 根据任务类型自动检索相关提示词
  - [ ] 提示词向量化（fastembed）
  - [ ] 语义搜索
  - [ ] Top-K 检索
- [ ] 7.2.2 根据上下文自动检索相关示例
  - [ ] 示例库构建
  - [ ] 语义匹配

## 8. 数据迁移

### 8.1 迁移脚本

- [ ] 8.1.1 实现版本检测
  - [ ] 读取 `.ifai/version.txt`
  - [ ] 比较版本号
- [ ] 8.1.2 实现对话格式迁移
  - [ ] 读取旧格式对话（`messages[]`）
  - [ ] 转换为新格式（附加提示词、工具调用字段）
  - [ ] 备份旧数据到 `.ifai/backup-[timestamp]/`
  - [ ] 写入新格式
- [ ] 8.1.3 实现配置迁移
  - [ ] 添加新字段（默认值）
  - [ ] 保留旧配置
- [ ] 8.1.4 实现迁移进度 UI
  - [ ] 进度对话框
  - [ ] 错误处理和回滚
- [ ] 8.1.5 编写迁移测试

### 8.2 向后兼容

- [ ] 8.2.1 实现旧格式读取（只读）
  - [ ] 识别旧格式数据
  - [ ] 动态转换为新格式显示
- [ ] 8.2.2 提供手动迁移按钮
  - [ ] 设置 → 高级 → 迁移数据

## 9. 测试

### 9.1 单元测试

- [ ] 9.1.1 后端模块测试（Rust）
  - [ ] `prompt_manager` - 80% 覆盖率
  - [ ] `tool_registry` - 80% 覆盖率
  - [ ] `agent_system` - 80% 覆盖率
  - [ ] `conversation` - 80% 覆盖率
- [ ] 9.1.2 前端组件测试（React Testing Library）
  - [ ] `PromptManager` 组件
  - [ ] `AgentPanel` 组件
  - [ ] `ToolExplorer` 组件
  - [ ] Store 测试

### 9.2 集成测试

- [ ] 9.2.1 端到端测试（Tauri + Playwright）
  - [ ] 提示词编辑和渲染流程
  - [ ] 智能体启动和执行流程
  - [ ] 工具调用流程
  - [ ] 对话总结流程
- [ ] 9.2.2 性能测试
  - [ ] 智能体并发测试（3 个同时运行）
  - [ ] 大对话总结测试（500+ 消息）
  - [ ] 工具调用压力测试

### 9.3 用户测试

- [ ] 9.3.1 Alpha 测试（内部）
  - [ ] 功能完整性测试
  - [ ] Bug 收集和修复
- [ ] 9.3.2 Beta 测试（公开）
  - [ ] 用户反馈收集
  - [ ] 性能和稳定性优化

## 10. 文档

### 10.1 开发文档

- [ ] 10.1.1 架构文档
  - [ ] 系统架构图
  - [ ] 模块依赖图
  - [ ] 数据流图
- [ ] 10.1.2 API 文档
  - [ ] Tauri 命令文档
  - [ ] Tauri 事件文档
  - [ ] Rust API 文档（rustdoc）
  - [ ] TypeScript API 文档（TSDoc）
- [ ] 10.1.3 贡献指南
  - [ ] 如何添加自定义智能体
  - [ ] 如何添加自定义工具
  - [ ] 代码规范和 PR 流程

### 10.2 用户文档

- [ ] 10.2.1 用户手册
  - [ ] 提示词管理教程
  - [ ] 智能体使用指南
  - [ ] 工具系统说明
  - [ ] 对话管理技巧
- [ ] 10.2.2 视频教程
  - [ ] 快速入门（5 分钟）
  - [ ] 高级功能（15 分钟）
  - [ ] 自定义扩展（20 分钟）
- [ ] 10.2.3 FAQ
  - [ ] 常见问题和解答
  - [ ] 故障排查指南

### 10.3 发布说明

- [ ] 10.3.1 编写 CHANGELOG
  - [ ] 新功能列表
  - [ ] Breaking Changes
  - [ ] 迁移指南
- [ ] 10.3.2 编写发布博客文章
  - [ ] 技术媒体版（针对开发者）
  - [ ] 产品媒体版（针对普通用户）

## 11. 发布准备

### 11.1 性能优化

- [ ] 11.1.1 前端性能优化
  - [ ] 组件懒加载
  - [ ] 虚拟滚动（大列表）
  - [ ] 防抖和节流
- [ ] 11.1.2 后端性能优化
  - [ ] 缓存优化
  - [ ] 并发优化
  - [ ] 内存优化

### 11.2 稳定性改进

- [ ] 11.2.1 错误处理
  - [ ] 全局错误捕获
  - [ ] 用户友好的错误提示
  - [ ] 错误日志收集
- [ ] 11.2.2 边界条件测试
  - [ ] 空数据、大数据
  - [ ] 网络断开、API 失败
  - [ ] 权限不足、磁盘满

### 11.3 安全审查

- [ ] 11.3.1 代码安全审查
  - [ ] 命令注入防护
  - [ ] 路径遍历防护
  - [ ] 权限控制检查
- [ ] 11.3.2 依赖安全审查
  - [ ] `cargo audit`
  - [ ] `npm audit`

### 11.4 国际化完善

- [ ] 11.4.1 补全中文翻译
- [ ] 11.4.2 补全英文翻译
- [ ] 11.4.3 翻译审校

### 11.5 打包和分发

- [ ] 11.5.1 创建安装包
  - [ ] Windows (MSI, EXE)
  - [ ] macOS (DMG, Universal Binary)
  - [ ] Linux (AppImage, deb, rpm)
- [ ] 11.5.2 签名和公证
  - [ ] Windows 代码签名
  - [ ] macOS 公证
- [ ] 11.5.3 创建更新服务器
  - [ ] Tauri updater 配置
  - [ ] Release notes 服务

## 12. 发布和推广

### 12.1 发布

- [ ] 12.1.1 发布到 GitHub Releases
- [ ] 12.1.2 更新官网
- [ ] 12.1.3 更新文档站点

### 12.2 推广

- [ ] 12.2.1 社交媒体宣传
  - [ ] Twitter/X
  - [ ] Reddit (r/rust, r/programming)
  - [ ] Hacker News
  - [ ] V2EX
- [ ] 12.2.2 技术社区分享
  - [ ] 掘金
  - [ ] 知乎
  - [ ] CSDN
- [ ] 12.2.3 产品发布会（线上）

### 12.3 后续支持

- [ ] 12.3.1 监控用户反馈
  - [ ] GitHub Issues
  - [ ] Discord/QQ 群
  - [ ] 邮件
- [ ] 12.3.2 快速响应 Bug
  - [ ] 建立 Bug 修复流程
  - [ ] 发布 Patch 版本
- [ ] 12.3.3 规划下一版本
  - [ ] 收集功能需求
  - [ ] 制定 Roadmap

---

## 总结

**总任务数**: 约 200+ 个任务
**预估工作量**: 12-15 周（3-4 个月）
**关键里程碑**:
- Week 4: 提示词管理系统完成
- Week 8: 工具系统和智能体系统完成
- Week 11: 对话管理和透明化完成
- Week 13: 测试和优化完成
- Week 15: 文档和发布

**优先级**:
1. **P0** (必须完成): 基础架构、核心功能（智能体、工具、提示词）
2. **P1** (高优先级): 对话管理、透明化、测试
3. **P2** (中优先级): 文档、性能优化
4. **P3** (低优先级): 高级功能（智能体协作、工作流可视化）
