---
name: "Edit Tool"
description: "编辑文件内容"
version: "1.0.0"
access_tier: "public"
---

Replaces a string in a file with a new string.

Parameters:
- file_path (required): Path to file
- old_string (required): Exact text to replace
- new_string (required): New text
- expected_replacements (optional): Number of expected occurrences (default 1)
