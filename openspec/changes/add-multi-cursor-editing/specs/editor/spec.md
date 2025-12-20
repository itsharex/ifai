# 编辑器核心功能规格（增量变更）

## ADDED Requirements

### Requirement: 多光标编辑支持
系统 SHALL 支持多光标编辑功能，允许用户在多个位置同时进行编辑操作，以提升批量编辑效率。

#### Scenario: 通过点击添加多个光标
- **WHEN** 用户按住 `Cmd`（macOS）或 `Ctrl`（Windows/Linux）并点击编辑器中的不同位置
- **THEN** 在每个点击位置创建一个新的光标
- **AND** 所有光标同步接收用户的输入操作
- **AND** 光标以不同颜色或样式显示，与主光标区分

#### Scenario: 在上下行添加光标
- **WHEN** 用户按下 `Cmd/Ctrl + Alt + ↑` 或 `Cmd/Ctrl + Alt + ↓`
- **THEN** 在当前光标的上一行或下一行的相同列位置创建新光标
- **AND** 可以连续按下快捷键，在多行创建光标

#### Scenario: 选中下一个相同内容
- **WHEN** 用户选中一段文本后按下 `Cmd/Ctrl + D`
- **THEN** 自动查找并选中文档中下一个相同的文本
- **AND** 在新选中的文本位置创建新光标
- **AND** 可以连续按下快捷键，依次选中所有相同内容

#### Scenario: 选中所有相同内容
- **WHEN** 用户选中一段文本后按下 `Cmd/Ctrl + Shift + L`
- **THEN** 自动查找并选中文档中所有相同的文本
- **AND** 在每个匹配位置创建光标

#### Scenario: 退出多光标模式
- **WHEN** 用户在多光标模式下按下 `Esc` 键
- **THEN** 取消所有额外的光标
- **AND** 只保留主光标（最后创建的光标或第一个光标）

#### Scenario: 多光标复制粘贴
- **WHEN** 用户在多光标模式下复制文本（`Cmd/Ctrl + C`）
- **THEN** 系统记录每个光标位置的选中内容
- **WHEN** 用户粘贴文本（`Cmd/Ctrl + V`）
- **THEN** 在每个光标位置分别粘贴对应的复制内容
- **AND** 如果复制内容只有一项，则在所有光标位置粘贴相同内容

### Requirement: 多光标快捷键提示
系统 SHALL 在欢迎页面显示多光标编辑的核心快捷键，帮助用户快速了解功能。

#### Scenario: 显示快捷键提示
- **WHEN** 用户打开编辑器且没有打开文件时
- **THEN** 在欢迎页面的快捷键列表中显示多光标相关快捷键
- **AND** 快捷键说明支持中英文切换
- **AND** macOS 显示 `Cmd` 修饰键，Windows/Linux 显示 `Ctrl` 修饰键

#### Scenario: 快捷键说明国际化
- **WHEN** 用户切换界面语言为中文
- **THEN** 快捷键说明显示为中文（如"添加光标"）
- **WHEN** 用户切换界面语言为英文
- **THEN** 快捷键说明显示为英文（如"Add Cursor"）

### Requirement: 编辑器配置选项
系统 SHALL 提供多光标相关的编辑器配置选项，确保功能正常工作。

#### Scenario: 启用多光标修饰键
- **WHEN** 编辑器初始化时
- **THEN** `multiCursorModifier` 配置设置为 `'ctrlCmd'`
- **AND** 用户可以使用平台标准修饰键（Cmd 或 Ctrl）进行多光标操作

#### Scenario: 启用多光标粘贴
- **WHEN** 编辑器初始化时
- **THEN** `multiCursorPaste` 配置设置为 `'spread'`
- **AND** 多行复制的内容可以分别粘贴到多个光标位置

#### Scenario: 启用选区剪贴板（Linux）
- **WHEN** 编辑器在 Linux 平台初始化时
- **THEN** `selectionClipboard` 配置设置为 `true`
- **AND** 选中的文本自动复制到中键粘贴剪贴板
