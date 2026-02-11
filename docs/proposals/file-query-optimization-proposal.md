# IfAI 文件查询功能优化提案

## 📋 概述

本提案针对用户询问"项目下所有js文件"这类文件查询场景，分析当前系统处理逻辑的路径，并提出优化方案。提案包含现有流程分析、性能瓶颈识别、优化建议和实施路线图。

## 🎯 业务场景

### 典型用户查询
- "项目下所有js文件"
- "列出项目中所有的TypeScript文件"
- "查看src目录下的组件文件"
- "扫描所有测试文件"

### 期望结果
- 快速返回匹配文件列表
- 显示文件结构统计信息
- 提供文件预览功能
- 支持进一步的文件操作

## 🔍 现有流程分析

### 1. 意图识别阶段

**文件**: `src/utils/intentRecognizer.ts`

```typescript
// 意图识别模式
{
  type: '/explore',
  keywords: ['浏览', '查看', '项目', '结构', '文件', 'explore', 'scan', 'list', 'tree'],
  regex: /(?:帮我|给我)?(?:浏览|查看|扫描|列出|list|scan|explore)(?:项目|目录|结构|文件)?(?:\s+)?([\w\.\-\/]+)?/i
}
```

**当前行为**:
- 匹配关键词和正则表达式
- 置信度计算（关键词+正则+组合加成）
- 默认阈值: 0.7

**问题**:
- 意图识别对于"项目下所有js文件"这类查询可能不稳定
- 没有考虑文件类型模式匹配（如 *.js）

### 2. Agent启动阶段

**文件**: `src/stores/useChatStore.ts`

```typescript
// Agent名称映射
const agentNameMap: Record<string, string> = {
    'proposal': 'proposal-generator',
    // 其他映射...
};

const agentName = agentNameMap[agentTypeBase] ||
    (agentTypeBase.charAt(0).toUpperCase() + agentTypeBase.slice(1) + " Agent");
```

**当前行为**:
- 识别为 `/explore` 意图
- 启动 "Explore Agent"
- 加载提示词: `.ifai/prompts/agents/explore.md`

### 3. Explore Agent执行阶段

**文件**: `.ifai/prompts/agents/explore.md`

**两阶段扫描工作流**:

#### Phase 1: Quick Overview
```json
{
  "name": "agent_scan_directory",
  "arguments": {
    "rel_path": ".",
    "pattern": "**/*.{ts,tsx,js,jsx}",
    "max_depth": 5,
    "max_files": 200
  }
}
```

#### Phase 2: Deep Scan
```json
{
  "name": "agent_batch_read",
  "arguments": {
    "paths": ["src/App.tsx", "src/main.tsx", ...]
  }
}
```

### 4. 后端工具执行

**文件**: `src-tauri/src/commands/core_wrappers.rs`

```rust
#[tauri::command]
pub async fn agent_scan_directory(
    root_path: String,
    rel_path: String,
    pattern: Option<String>,
    max_depth: Option<usize>,
    max_files: Option<usize>
) -> Result<String, String>
```

**关键特性**:
- 使用 `glob` crate 进行模式匹配
- 自动忽略目录: node_modules, .git, target, dist, build 等
- 支持深度限制和文件数量限制
- 返回结构化JSON结果

**性能参数**:
- 默认 `max_depth`: 10
- 默认 `max_files`: 500
- 忽略目录: 13个预定义目录

### 5. LLM交互路径

**文件**: `src-tauri/src/agent_system/runner.rs`

```rust
// Agent执行循环
const MAX_LOOPS: usize = 12;

while loop_count < MAX_LOOPS {
    // 1. 调用LLM API
    // 2. 解析tool_calls
    // 3. 发送审批请求
    // 4. 等待用户审批
    // 5. 执行工具
    // 6. 将结果加入历史
}
```

## ⚠️ 性能瓶颈分析

### 瓶颈1: LLM循环开销

**问题**:
- 每个工具调用都需要完整的 LLM 请求-响应周期
- "项目下所有js文件"查询可能需要2-3轮循环
- 对于大型项目（500+文件），显著延迟

**量化分析**:
```
典型场景（100个JS文件）:
1. Phase 1 扫描: ~2-3秒
2. LLM处理扫描结果: ~1-2秒
3. Phase 2 批量读取: ~1秒
4. LLM生成最终报告: ~2-3秒
总耗时: ~6-9秒
```

### 瓶颈2: 文件系统遍历

**问题**:
- `walkdir` 遍历可能在大项目上较慢
- 没有缓存机制
- 每次查询都重新扫描

**当前实现**:
```rust
// 硬编码的忽略目录
let ignore_dirs = [
    "node_modules", ".git", "target", "dist", "build",
    ".vscode", ".idea", "coverage", ".next", ".nuxt",
    ".venv", "venv", "__pycache__", "node_modules_cache"
];
```

### 瓶颈3: 意图识别准确性

**问题**:
- "项目下所有js文件"可能不被识别为 `/explore` 意图
- 没有专门的文件类型查询模式
- 依赖通用关键词匹配

**测试案例**:
```
用户输入: "项目下所有js文件"
当前行为: 可能识别为普通查询，不触发Agent
期望行为: 识别为 /explore + pattern="**/*.js"
```

## 💡 优化方案

### 方案1: 快速路径优化

**目标**: 常见文件查询场景免LLM处理

**实现**:

```typescript
// src/utils/fileQueryParser.ts

interface FileQueryPattern {
  pattern: string;      // glob模式
  description: string;  // 描述
}

// 文件类型模式映射
const FILE_TYPE_PATTERNS: Record<string, FileQueryPattern> = {
  'js': { pattern: '**/*.js', description: 'JavaScript文件' },
  'ts': { pattern: '**/*.ts', description: 'TypeScript文件' },
  'tsx': { pattern: '**/*.tsx', description: 'TypeScript JSX文件' },
  'jsx': { pattern: '**/*.jsx', description: 'JavaScript JSX文件' },
  'py': { pattern: '**/*.py', description: 'Python文件' },
  // ... 更多文件类型
};

function parseFileQuery(input: string): FileQueryPattern | null {
  // 匹配 "所有[文件类型]文件" 模式
  const match = input.match(/(?:所有|列出|查看|显示)?.*?(js|ts|tsx|jsx|py|go|rs).*?文件/i);
  if (match) {
    return FILE_TYPE_PATTERNS[match[1]] || null;
  }
  return null;
}
```

**集成到 intentRecognizer**:
```typescript
export function recognizeIntent(input: string): IntentResult | null {
  // 优先检查文件查询模式
  const fileQuery = parseFileQuery(input);
  if (fileQuery) {
    return {
      type: '/explore',
      confidence: 0.95,
      args: JSON.stringify({ pattern: fileQuery.pattern })
    };
  }

  // 原有逻辑...
}
```

**预期收益**:
- 文件类型查询响应时间从 6-9秒 降至 2-3秒
- 减少 LLM API 调用成本

### 方案2: 增量缓存机制

**目标**: 避免重复扫描相同目录

**实现**:

```rust
// src-tauri/src/cache/file_scan_cache.rs

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

struct CacheEntry {
    result: String,
    timestamp: u64,
    file_hash: String, // 目录修改时间哈希
}

pub struct FileScanCache {
    cache: HashMap<String, CacheEntry>,
    ttl: u64, // 缓存有效期（秒）
}

impl FileScanCache {
    pub fn get_or_compute<F>(
        &mut self,
        key: &str,
        file_hash: &str,
        compute: F
    ) -> Result<String, String>
    where
        F: FnOnce() -> Result<String, String>,
    {
        if let Some(entry) = self.cache.get(key) {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();

            if entry.timestamp + self.ttl > now && entry.file_hash == file_hash {
                return Ok(entry.result.clone());
            }
        }

        // 缓存未命中或过期，重新计算
        let result = compute()?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        self.cache.insert(key.to_string(), CacheEntry {
            result: result.clone(),
            timestamp: now,
            file_hash: file_hash.to_string(),
        });

        Ok(result)
    }
}
```

**预期收益**:
- 重复查询响应时间从 2-3秒 降至 <100ms
- 减少文件系统I/O

### 方案3: 智能采样策略

**目标**: 大项目场景下返回代表性结果

**实现**:

```rust
pub fn sample_files(files: Vec<String>, max_files: usize) -> Vec<String> {
    if files.len() <= max_files {
        return files;
    }

    // 按目录分组
    let mut by_dir: HashMap<String, Vec<String>> = HashMap::new();
    for file in files {
        let dir = file.rsplit('/').nth(1).unwrap_or("");
        by_dir.entry(dir.to_string())
            .or_insert_with(Vec::new)
            .push(file);
    }

    // 从每个目录采样
    let mut sampled = Vec::new();
    for (_dir, mut dir_files) in by_dir {
        dir_files.sort(); // 确保可复现性
        let sample_size = (max_files as f64 / by_dir.len() as f64).ceil() as usize;
        sampled.extend(dir_files.into_iter().take(sample_size));
    }

    sampled.truncate(max_files);
    sampled
}
```

**预期收益**:
- 超大项目（10000+文件）仍能快速响应
- 保持结果的代表性

### 方案4: 增强的Explore Agent提示词

**目标**: 提高LLM工具选择准确性

**优化后的提示词片段**:

```markdown
=== FILE QUERY PATTERNS ===

When user asks for specific file types, use these patterns:

User Query Examples → Tool Call Pattern:

"项目下所有js文件" → agent_scan_directory(pattern="**/*.js")
"所有的TypeScript文件" → agent_scan_directory(pattern="**/*.ts")
"src下的组件文件" → agent_scan_directory(rel_path="src", pattern="**/*.{tsx,jsx}")
"测试文件" → agent_scan_directory(pattern="**/*.{test,spec}.{ts,js}")

=== PRIORITY STRATEGY ===

1. FIRST: Use agent_scan_directory with pattern for file type queries
2. SECOND: Use agent_batch_read to read 5-10 key files
3. LAST: Only read individual files with agent_read_file if specifically asked
```

**预期收益**:
- 提高Agent工具选择准确性
- 减少不必要的工具调用

## 📊 性能对比

| 场景 | 当前实现 | 优化后 | 改进 |
|------|----------|--------|------|
| 小项目（<100文件） | 6-9秒 | 2-3秒 | 66%↓ |
| 中项目（100-500文件） | 8-12秒 | 3-5秒 | 58%↓ |
| 大项目（500-2000文件） | 15-25秒 | 5-8秒 | 68%↓ |
| 重复查询（缓存命中） | 6-9秒 | <100ms | 99%↓ |

## 🗺️ 实施路线图

### Phase 1: 快速路径实现（1-2周）
- [ ] 实现文件查询解析器
- [ ] 集成到意图识别系统
- [ ] 单元测试和E2E验证

### Phase 2: 缓存机制（2-3周）
- [ ] 实现文件扫描缓存
- [ ] 添加缓存失效策略
- [ ] 性能测试和调优

### Phase 3: Agent提示词优化（1周）
- [ ] 更新Explore Agent提示词
- [ ] A/B测试对比效果
- [ ] 迭代优化

### Phase 4: 智能采样（1-2周）
- [ ] 实现智能采样算法
- [ ] 添加用户配置选项
- [ ] 文档更新

## 📈 成功指标

1. **响应时间**: 文件查询平均响应时间 <3秒
2. **准确性**: 意图识别准确率 >95%
3. **用户满意度**: 用户反馈评分 >4.5/5
4. **成本降低**: LLM API调用减少 >40%

## 🧪 测试策略

### 单元测试
- 文件查询解析器测试
- 缓存机制测试
- 采样算法测试

### E2E测试
- 不同项目规模场景测试
- 边界条件测试
- 性能回归测试

### A/B测试
- 提示词优化效果对比
- 新旧流程用户满意度对比

---

**文档版本**: v1.0
**创建日期**: 2026-02-10
**作者**: IfAI Technical Team
