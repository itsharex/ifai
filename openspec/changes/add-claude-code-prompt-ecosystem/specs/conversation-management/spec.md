# 对话管理 (Conversation Management) - 规格说明

## ADDED Requirements

### Requirement: 对话自动总结

系统 SHALL 在对话达到阈值时自动触发总结。

#### Scenario: Token 阈值触发
- **GIVEN** 当前对话的总 token 数达到 150,000
- **WHEN** 系统检测到阈值
- **THEN** 系统 SHALL 自动触发对话总结流程
- **AND** 系统 SHALL 在 UI 中显示"正在生成总结..."提示

#### Scenario: 消息数量触发
- **GIVEN** 当前对话的消息数量达到 100 条
- **WHEN** 系统检测到阈值
- **THEN** 系统 SHALL 自动触发对话总结流程

#### Scenario: 用户手动触发
- **GIVEN** 用户在对话界面
- **WHEN** 用户点击"生成总结"按钮
- **THEN** 系统 SHALL 立即开始总结流程
- **AND** 系统 SHALL 显示总结进度

### Requirement: 总结内容结构

对话总结 SHALL 遵循结构化模板。

#### Scenario: 总结模板
- **GIVEN** 系统生成对话总结
- **WHEN** 总结完成
- **THEN** 总结 SHALL 包含以下部分：
  1. 主要请求和意图
  2. 关键技术概念列表
  3. 文件和代码变更（文件路径、变更摘要、关键代码片段）
  4. 错误和修复记录
  5. 问题解决过程
  6. 所有用户消息列表
  7. 待办任务列表
  8. 当前工作状态
  9. 建议的下一步

#### Scenario: 总结质量
- **GIVEN** 总结生成完成
- **WHEN** 验证总结质量
- **THEN** 总结 SHALL 满足：
  - 准确性：技术细节准确，文件路径正确
  - 完整性：涵盖所有重要信息，无遗漏
  - 简洁性：去除冗余，突出重点
  - 可操作性：待办任务清晰，下一步明确

#### Scenario: 总结生成时间
- **GIVEN** 一个包含 100 条消息的对话
- **WHEN** 执行总结
- **THEN** 总结生成时间 SHALL < 10 秒

### Requirement: 总结后的处理

系统 SHALL 在总结后优化对话上下文。

#### Scenario: 完整对话归档
- **GIVEN** 对话总结完成
- **WHEN** 系统处理总结
- **THEN** 系统 SHALL 将完整对话保存到 `.ifai/sessions/archive/[session_id]-[timestamp].json`
- **AND** 归档文件 SHALL 包含所有原始消息和元数据

#### Scenario: 总结注入
- **GIVEN** 对话总结完成
- **WHEN** 系统处理总结
- **THEN** 系统 SHALL 将总结作为系统消息注入到对话历史开头
- **AND** 系统消息 SHALL 标记类型为 "conversation_summary"

#### Scenario: 旧消息清理
- **GIVEN** 总结注入完成
- **WHEN** 系统清理对话
- **THEN** 系统 SHALL 保留最近 10 条消息
- **AND** 系统 SHALL 删除中间的旧消息（已归档）
- **AND** 对话 token 数 SHALL 降低至少 80%

### Requirement: 会话笔记

系统 SHALL 自动生成和维护会话笔记。

#### Scenario: 笔记结构
- **GIVEN** 会话正在进行
- **WHEN** 查询会话笔记
- **THEN** 笔记 SHALL 包含：
  - **技术概念**: 讨论的技术、框架、模式列表
  - **文件变更历史**: 每个被修改文件的变更记录
  - **错误和修复**: 遇到的错误及解决方案
  - **待办任务**: 未完成的任务清单
  - **关键决策**: 重要的技术决策和理由

#### Scenario: 自动提取技术概念
- **GIVEN** 对话中提到 "React Hooks" 和 "Zustand state management"
- **WHEN** 更新会话笔记
- **THEN** 技术概念列表 SHALL 包含：
  - React Hooks
  - Zustand state management
- **AND** 每个概念 SHALL 附带首次提及的上下文

#### Scenario: 追踪文件变更
- **GIVEN** 智能体调用 Write 工具修改了 `src/App.tsx`
- **WHEN** 更新会话笔记
- **THEN** 文件变更历史 SHALL 添加记录：
  ```json
  {
    "file": "src/App.tsx",
    "action": "modified",
    "timestamp": "2025-12-19T10:30:00Z",
    "summary": "添加了用户认证逻辑",
    "tool_used": "write"
  }
  ```

#### Scenario: 记录错误和修复
- **GIVEN** 对话中出现错误："TypeError: Cannot read property 'user' of undefined"
- **AND** 后续消息中修复了错误
- **WHEN** 更新会话笔记
- **THEN** 错误和修复记录 SHALL 添加：
  ```json
  {
    "error": "TypeError: Cannot read property 'user' of undefined",
    "location": "src/auth.ts:42",
    "fix": "添加了 null 检查：if (state?.user) {...}",
    "timestamp": "2025-12-19T10:35:00Z"
  }
  ```

### Requirement: 笔记编辑和导出

用户 SHALL 可以编辑和导出会话笔记。

#### Scenario: 手动编辑笔记
- **GIVEN** 会话笔记显示在侧边栏
- **WHEN** 用户编辑笔记内容（如添加待办任务）
- **THEN** 系统 SHALL 保存用户的修改
- **AND** 系统 SHALL 合并用户编辑和自动生成的内容

#### Scenario: 导出为 Markdown
- **GIVEN** 用户需要导出会话笔记
- **WHEN** 用户点击"导出笔记"
- **THEN** 系统 SHALL 生成 Markdown 文件
- **AND** Markdown SHALL 包含所有笔记部分，格式化良好
- **AND** 用户 SHALL 可以保存到任意位置

#### Scenario: 分享笔记
- **GIVEN** 用户导出了笔记
- **WHEN** 用户分享给团队成员
- **THEN** 笔记 SHALL 包含足够的上下文，使他人能理解工作内容
- **AND** 笔记 SHALL 不包含敏感信息（如 API 密钥）

### Requirement: 会话恢复

系统 SHALL 支持从总结恢复会话。

#### Scenario: 恢复上下文
- **GIVEN** 用户打开一个之前总结过的会话
- **WHEN** 系统加载会话
- **THEN** 系统 SHALL 显示总结内容
- **AND** 用户 SHALL 可以查看完整归档历史（点击"查看完整历史"）

#### Scenario: 继续对话
- **GIVEN** 用户在总结后的会话中
- **WHEN** 用户继续提问
- **THEN** AI SHALL 能够基于总结理解上下文
- **AND** AI SHALL 能够引用总结中的信息

#### Scenario: 查看归档历史
- **GIVEN** 用户点击"查看完整历史"
- **WHEN** 系统加载归档文件
- **THEN** 系统 SHALL 显示所有原始消息（只读模式）
- **AND** 用户 SHALL 可以搜索和定位特定消息

### Requirement: 多会话管理

系统 SHALL 支持管理多个会话。

#### Scenario: 会话列表
- **GIVEN** 用户有多个会话
- **WHEN** 用户查看会话列表
- **THEN** 系统 SHALL 显示：
  - 会话标题（自动生成或用户设置）
  - 最后更新时间
  - 消息数量
  - 标签（如 "bugfix", "feature", "refactor"）

#### Scenario: 会话搜索
- **GIVEN** 用户有 50 个会话
- **WHEN** 用户搜索关键词 "authentication"
- **THEN** 系统 SHALL 返回包含该关键词的会话列表
- **AND** 系统 SHALL 高亮匹配的内容

#### Scenario: 会话分组
- **GIVEN** 用户为会话添加标签
- **WHEN** 用户按标签分组
- **THEN** 系统 SHALL 按标签分组显示会话
- **AND** 用户 SHALL 可以折叠/展开分组

### Requirement: Token 计数

系统 SHALL 准确计算对话的 token 数量。

#### Scenario: Token 计数
- **GIVEN** 对话包含文本消息和代码
- **WHEN** 系统计算 token 数
- **THEN** 系统 SHALL 使用 tiktoken 算法（与 OpenAI 一致）
- **AND** 计数 SHALL 包括：
  - 用户消息
  - AI 消息
  - 系统提示词
  - 工具调用和结果

#### Scenario: Token 实时显示
- **GIVEN** 用户正在对话
- **WHEN** 发送新消息
- **THEN** 系统 SHALL 在 UI 中实时更新 token 数量
- **AND** 系统 SHALL 显示距离阈值的剩余 token 数

#### Scenario: Token 警告
- **GIVEN** 对话 token 数接近阈值（如 140,000 / 150,000）
- **WHEN** 系统检测到
- **THEN** 系统 SHALL 显示警告："对话即将自动总结，剩余 10,000 tokens"
- **AND** 用户 SHALL 可以选择立即总结或继续对话

### Requirement: 总结提示词

系统 SHALL 使用高质量的总结提示词。

#### Scenario: 提示词模板
- **GIVEN** 系统执行对话总结
- **WHEN** 调用 AI 生成总结
- **THEN** 系统 SHALL 使用基于 claude-code-system-prompts 的总结提示词
- **AND** 提示词 SHALL 指导 AI 生成结构化、详细、准确的总结

#### Scenario: 提示词自定义
- **GIVEN** 用户需要自定义总结风格
- **WHEN** 用户编辑总结提示词
- **THEN** 系统 SHALL 允许用户修改提示词模板
- **AND** 系统 SHALL 使用自定义提示词生成总结

### Requirement: 总结缓存

系统 SHALL 缓存总结结果以提高性能。

#### Scenario: 总结缓存
- **GIVEN** 对话已经生成过总结
- **WHEN** 用户再次查看总结
- **THEN** 系统 SHALL 直接返回缓存的总结，不重新生成
- **AND** 响应时间 SHALL < 100ms

#### Scenario: 缓存失效
- **GIVEN** 总结生成后，对话继续进行
- **AND** 新消息数量 > 20 条
- **WHEN** 用户查看总结
- **THEN** 系统 SHALL 提示："总结可能已过时，是否重新生成？"
- **AND** 用户确认后，系统 SHALL 重新生成总结

### Requirement: 总结质量验证

系统 SHALL 验证总结的质量。

#### Scenario: 结构完整性检查
- **GIVEN** 总结生成完成
- **WHEN** 系统验证总结
- **THEN** 系统 SHALL 检查所有必需部分是否存在
- **AND** 如果缺少部分，系统 SHALL 记录警告并提示用户

#### Scenario: 准确性验证
- **GIVEN** 总结中提到文件路径
- **WHEN** 系统验证总结
- **THEN** 系统 SHALL 检查文件路径是否存在于对话历史中
- **AND** 如果发现不一致，系统 SHALL 标记为可疑内容

#### Scenario: 用户反馈
- **GIVEN** 用户查看总结
- **WHEN** 用户发现总结不准确
- **THEN** 用户 SHALL 可以点击"重新生成"
- **AND** 用户 SHALL 可以提供反馈（如"缺少关键信息"）
- **AND** 系统 SHALL 使用反馈改进提示词
