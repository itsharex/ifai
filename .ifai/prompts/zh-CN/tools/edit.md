---
name: "Edit Tool"
description: "编辑文件内容"
version: "1.0.0"
access_tier: "public"
---

将文件中的指定字符串替换为新字符串。

参数：
- file_path (必填): 文件路径
- old_string (必填): 待替换的精确文本
- new_string (必填): 新文本
- expected_replacements (可选): 预期匹配的次数 (默认 1)
