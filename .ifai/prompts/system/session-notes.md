---
name: "Session Notes Updater"
description: "会话笔记更新指令"
version: "1.0.0"
access_tier: "protected"
variables:
  - NOTES_PATH
  - CURRENT_NOTES
---

Based on the conversation above, update the session notes file.

Your ONLY task is to use the `edit` tool to update the notes file.

CRITICAL RULES:
1. Maintain the exact structure of the notes file.
2. Only update the content below section headers.
3. Write detailed, info-dense content.
4. Keep each section concise.

Current Notes:
{{CURRENT_NOTES}}

Target File: {{NOTES_PATH}}
