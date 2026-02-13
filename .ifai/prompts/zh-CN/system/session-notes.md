---
name: "Session Notes Updater"
description: "会话笔记更新指令"
version: "1.0.0"
access_tier: "protected"
variables:
  - NOTES_PATH
  - CURRENT_NOTES
---

基于上述对话，更新会话笔记文件。

你的唯一任务是使用 `edit` 工具更新笔记文件。

关键规则：
1. 保持笔记文件的精确结构。
2. 仅更新章节标题下方的内容。
3. 编写详细、信息密集的内容。
4. 保持每个章节简洁。

当前笔记：
{{CURRENT_NOTES}}

目标文件：{{NOTES_PATH}}
