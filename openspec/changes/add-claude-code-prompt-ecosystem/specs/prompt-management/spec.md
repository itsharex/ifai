# 提示词管理 (Prompt Management) - 规格说明

## ADDED Requirements

### Requirement: 提示词分层访问控制

系统 SHALL 实现三层提示词访问控制架构（公开层、半透明层、隐藏层）。

#### Scenario: 公开层提示词访问
- **GIVEN** 用户在提示词管理器中
- **WHEN** 选择一个公开层提示词（如 "Review Agent"）
- **THEN** 系统 SHALL 显示完整的提示词内容
- **AND** 系统 SHALL 允许用户编辑、保存、导出、版本控制
- **AND** 系统 SHALL 显示绿色"可编辑"徽章

#### Scenario: 半透明层提示词访问
- **GIVEN** 用户在提示词管理器中
- **WHEN** 选择一个半透明层提示词（如 "系统主提示词"）
- **THEN** 系统 SHALL 显示完整的提示词内容（只读模式）
- **AND** 系统 SHALL 显示黄色"只读"徽章
- **AND** 系统 SHALL 显示警告："这是系统核心提示词，修改可能导致不稳定"
- **AND** 系统 SHALL 提供"复制到自定义"按钮
- **AND** 如果启用专家模式，系统 SHALL 提供"创建覆盖版本"按钮

#### Scenario: 隐藏层提示词不可见
- **GIVEN** 用户在提示词管理器中
- **WHEN** 查看提示词列表
- **THEN** 系统 SHALL NOT 显示隐藏层提示词（如 ifainew-core 内部提示词）
- **AND** 在对话中显示提示词组成时，系统 SHALL 显示占位符："核心提示词（ifainew-core 管理）"
- **AND** 占位符 SHALL 标记为不可查看

#### Scenario: 专家模式覆盖系统提示词
- **GIVEN** 用户启用专家模式
- **AND** 用户选择一个半透明层提示词
- **WHEN** 用户点击"创建覆盖版本"
- **THEN** 系统 SHALL 复制官方提示词到 `.ifai/prompts/system/[name].override.md`
- **AND** 系统 SHALL 打开编辑器，允许用户修改覆盖版本
- **AND** 系统 SHALL 在覆盖版本顶部添加警告注释：
  ```markdown
  <!-- ⚠️ 这是系统提示词的用户覆盖版本 -->
  <!-- 修改此文件可能导致 AI 行为不稳定 -->
  <!-- 删除此文件可恢复为官方默认版本 -->
  ```
- **AND** 系统 SHALL 在加载时优先使用覆盖版本

#### Scenario: 提示词注入检测
- **GIVEN** 用户编辑一个公开层提示词
- **WHEN** 用户输入包含危险模式的内容（如 "ignore previous instructions"）
- **THEN** 系统 SHALL 阻止保存
- **AND** 系统 SHALL 显示错误："提示词包含潜在的注入攻击模式，请修改"
- **AND** 系统 SHALL 高亮显示危险部分

### Requirement: 提示词存储和组织

系统 SHALL 支持提示词的本地存储和层级组织。

#### Scenario: 提示词文件组织
- **GIVEN** 用户首次启动系统
- **WHEN** 系统初始化完成
- **THEN** 系统 SHALL 创建以下目录结构：
  - `.ifai/prompts/system/` - 系统提示词
  - `.ifai/prompts/agents/` - 智能体提示词
  - `.ifai/prompts/tools/` - 工具描述提示词
  - `.ifai/prompts/custom/` - 用户自定义提示词

#### Scenario: 提示词文件格式
- **GIVEN** 用户创建新提示词
- **WHEN** 保存提示词文件
- **THEN** 文件 SHALL 使用 Markdown 格式，包含 YAML Front Matter 元数据：
  ```markdown
  ---
  name: "提示词名称"
  description: "提示词描述"
  version: "1.0.0"
  variables:
    - VARIABLE_1
    - VARIABLE_2
  ---

  提示词内容...
  ```

#### Scenario: 默认提示词导入
- **GIVEN** 系统首次启动或用户点击"导入默认模板"
- **WHEN** 导入流程开始
- **THEN** 系统 SHALL 从内置资源包解压至少 15 个默认提示词到 `.ifai/prompts/default/`
- **AND** 系统 SHALL 在 UI 中显示导入成功的提示词数量

### Requirement: 提示词编辑和预览

系统 SHALL 提供提示词编辑和实时预览功能。

#### Scenario: 提示词编辑器
- **GIVEN** 用户选择一个提示词
- **WHEN** 打开编辑器
- **THEN** 系统 SHALL 显示 Monaco Editor，支持 Markdown 语法高亮
- **AND** 编辑器 SHALL 支持 Handlebars 模板语法高亮
- **AND** 编辑器 SHALL 提供变量名自动补全

#### Scenario: 实时预览
- **GIVEN** 用户正在编辑提示词
- **WHEN** 提示词内容包含变量（如 `{{LANGUAGE}}`）
- **THEN** 系统 SHALL 在预览窗格中实时显示变量替换后的结果
- **AND** 预览 SHALL 使用当前上下文的变量值（如当前文件的语言）

#### Scenario: 保存提示词
- **GIVEN** 用户编辑了提示词
- **WHEN** 用户点击保存
- **THEN** 系统 SHALL 验证 YAML Front Matter 格式
- **AND** 系统 SHALL 保存文件到磁盘
- **AND** 系统 SHALL 更新提示词列表

### Requirement: 提示词模板渲染

系统 SHALL 支持基于 Handlebars 的模板渲染。

#### Scenario: 变量替换
- **GIVEN** 提示词包含变量 `{{LANGUAGE}}` 和 `{{FRAMEWORK}}`
- **WHEN** 渲染提示词
- **THEN** 系统 SHALL 将 `{{LANGUAGE}}` 替换为当前文件的编程语言
- **AND** 系统 SHALL 将 `{{FRAMEWORK}}` 替换为项目检测到的框架名称

#### Scenario: 条件渲染
- **GIVEN** 提示词包含条件块：
  ```handlebars
  {{#if (eq SEVERITY_LEVEL "critical")}}
  关注严重级别问题
  {{else}}
  关注一般级别问题
  {{/if}}
  ```
- **WHEN** `SEVERITY_LEVEL` 变量值为 `"critical"`
- **THEN** 渲染结果 SHALL 只包含 "关注严重级别问题"

#### Scenario: 循环渲染
- **GIVEN** 提示词包含循环块：
  ```handlebars
  文件列表：
  {{#each FILE_PATHS}}
  - {{this}}
  {{/each}}
  ```
- **WHEN** `FILE_PATHS` 变量为 `["src/main.rs", "src/lib.rs"]`
- **THEN** 渲染结果 SHALL 包含两个文件路径，每个一行

### Requirement: 变量系统

系统 SHALL 支持多种来源的变量。

#### Scenario: 系统变量
- **GIVEN** 渲染提示词时
- **WHEN** 提示词包含系统变量
- **THEN** 系统 SHALL 自动提供以下系统变量：
  - `{{CWD}}` - 当前工作目录
  - `{{USER_NAME}}` - 用户名
  - `{{PROJECT_NAME}}` - 项目名称
  - `{{CURRENT_FILE}}` - 当前文件路径
  - `{{CURRENT_LANGUAGE}}` - 当前文件语言

#### Scenario: 用户自定义变量
- **GIVEN** 用户在 `.ifai/config.toml` 中定义变量：
  ```toml
  [prompt_variables]
  COMPANY_NAME = "MyCompany"
  CODE_STYLE = "Google Style Guide"
  ```
- **WHEN** 渲染提示词包含 `{{COMPANY_NAME}}`
- **THEN** 系统 SHALL 替换为 `"MyCompany"`

#### Scenario: 运行时变量
- **GIVEN** 智能体启动时传入运行时变量 `{ "SEVERITY_LEVEL": "warning" }`
- **WHEN** 渲染智能体提示词
- **THEN** 系统 SHALL 使用运行时变量覆盖默认值

### Requirement: 版本管理

系统 SHALL 支持提示词的版本管理。

#### Scenario: 版本追踪
- **GIVEN** 提示词文件在 Git 仓库中
- **WHEN** 用户修改提示词并保存
- **THEN** 系统 SHALL 记录版本历史（通过 Git）
- **AND** 用户 SHALL 可以查看历史版本列表

#### Scenario: 版本对比
- **GIVEN** 提示词有多个历史版本
- **WHEN** 用户选择两个版本进行对比
- **THEN** 系统 SHALL 显示 diff 视图，高亮变更部分

#### Scenario: 版本回滚
- **GIVEN** 用户选择一个历史版本
- **WHEN** 用户点击"回滚到此版本"
- **THEN** 系统 SHALL 恢复提示词内容到选中版本
- **AND** 系统 SHALL 提示用户确认操作

### Requirement: 提示词搜索和过滤

系统 SHALL 支持提示词的搜索和过滤。

#### Scenario: 按名称搜索
- **GIVEN** 用户在提示词列表中
- **WHEN** 用户输入搜索关键词 "review"
- **THEN** 系统 SHALL 只显示名称或描述包含 "review" 的提示词

#### Scenario: 按分类过滤
- **GIVEN** 用户在提示词列表中
- **WHEN** 用户选择分类 "智能体"
- **THEN** 系统 SHALL 只显示 `.ifai/prompts/agents/` 目录下的提示词

### Requirement: 提示词导入导出

系统 SHALL 支持提示词的导入和导出。

#### Scenario: 导出提示词包
- **GIVEN** 用户选择多个提示词
- **WHEN** 用户点击"导出"
- **THEN** 系统 SHALL 创建一个 `.zip` 文件，包含所有选中的提示词和元数据
- **AND** 用户 SHALL 可以保存到任意位置

#### Scenario: 导入提示词包
- **GIVEN** 用户有一个提示词包 `.zip` 文件
- **WHEN** 用户选择导入
- **THEN** 系统 SHALL 解压文件并验证格式
- **AND** 系统 SHALL 询问用户是否覆盖同名提示词
- **AND** 系统 SHALL 导入提示词到 `.ifai/prompts/custom/`

### Requirement: 提示词性能

提示词渲染 SHALL 满足性能要求。

#### Scenario: 渲染时间
- **GIVEN** 一个包含 20 个变量和 5 个条件块的提示词
- **WHEN** 执行渲染
- **THEN** 渲染时间 SHALL < 100ms

#### Scenario: 缓存机制
- **GIVEN** 同一提示词被多次渲染，变量值相同
- **WHEN** 第二次渲染
- **THEN** 系统 SHALL 使用缓存结果，不重新渲染
- **AND** 渲染时间 SHALL < 10ms
