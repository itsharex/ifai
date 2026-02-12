# 工具调用批量执行与聚合展示优化提案

> **提案编号**: OPT-TOOL-001
> **优先级**: P0 - 最高优先级
> **目标版本**: v0.3.6
> **状态**: 待审核

---

## 📋 执行摘要

### 当前问题（截图1-4）

用户询问"oa-app目录是干什么的"时，AI执行了4次独立的 `List Directory` 操作：
1. `oa-app` → 发现 `src` 子目录
2. `oa-app/src` → 发现 `main` 子目录
3. `oa-app/src/main` → 发现 `java` 子目录
4. `oa-app/src/main/java` → 继续探索...

**问题表现**：
- 4个独立的工具调用卡片刷屏
- 每个卡片占用 ~200px 垂直空间
- 用户被迫滚动查看完整探索过程
- 信息密度极低，效率严重低下

### 参考设计（截图6 - Claude Code）

Claude Code采用**任务树（Task Tree）**设计：
```
● Running 2 Explore agents... (ctrl+o to expand)
├─ 探索项目整体结构 · 26 tool uses · 53.3k tokens
│  └─ Done
└─ 访问 ifainew-core 私有库 · 39 tool uses · 70.2k tokens
   └─ Read: ~/project/.../storeRegistry.ts
```

**优势**：
- 单条消息展示多步骤操作
- 树形结构可展开/折叠
- 显示工具使用统计（次数、token消耗）
- 极大节省垂直空间

---

## 🎯 优化目标

| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| 垂直空间占用 | 800px+ (4个卡片) | ≤150px (1个聚合卡片) | **-81%** |
| 探索完成时间 | 4次往返延迟 | 1次批量请求 | **-75%** |
| 用户滚动次数 | 3-4次 | 0次（首屏可见） | **-100%** |
| 信息密度 | 低（重复UI元素） | 高（纯数据展示） | **+400%** |

---

## 🔧 详细优化方案

### 1. 引入批量目录探索工具（Batch List Directory）

#### 1.1 新工具定义

**工具名称**: `batch_list_directory`
**功能**: 递归列出目录结构，支持深度限制和模式过滤

**参数定义**:
```typescript
interface BatchListDirectoryArgs {
  rel_path: string;           // 起始路径
  max_depth?: number;         // 最大递归深度（默认3）
  include_pattern?: string;   // 包含模式（如 '*.java'）
  exclude_pattern?: string;   // 排除模式（如 'node_modules'）
  max_entries?: number;       // 最大条目数（默认100）
}

interface BatchListDirectoryResult {
  tree: DirectoryNode;        // 目录树结构
  total_dirs: number;         // 总目录数
  total_files: number;        // 总文件数
  entries_scanned: number;    // 扫描条目数
}

interface DirectoryNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: DirectoryNode[];
  size?: number;              // 文件大小（仅文件）
  last_modified?: string;     // 最后修改时间
}
```

#### 1.2 Rust后端实现

**文件**: `src-tauri/src/commands/batch_directory.rs`

```rust
#[tauri::command]
pub async fn batch_list_directory(
    path: String,
    max_depth: Option<usize>,
    include_pattern: Option<String>,
    exclude_pattern: Option<String>,
) -> Result<DirectoryTree, String> {
    let max_depth = max_depth.unwrap_or(3);
    let mut tree = DirectoryTree::new(&path);

    // 使用异步递归扫描
    scan_directory_recursive(
        Path::new(&path),
        &mut tree.root,
        0,
        max_depth,
        &include_pattern,
        &exclude_pattern,
    ).await?;

    Ok(tree)
}

async fn scan_directory_recursive(
    path: &Path,
    parent: &mut TreeNode,
    current_depth: usize,
    max_depth: usize,
    include: &Option<String>,
    exclude: &Option<String>,
) -> Result<(), String> {
    if current_depth >= max_depth {
        return Ok(());
    }

    let mut entries = tokio::fs::read_dir(path).await
        .map_err(|e| e.to_string())?;

    while let Some(entry) = entries.next_entry().await
        .map_err(|e| e.to_string())?
    {
        let name = entry.file_name().to_string_lossy().to_string();

        // 应用排除模式
        if let Some(ref pattern) = exclude {
            if matches_pattern(&name, pattern) {
                continue;
            }
        }

        let metadata = entry.metadata().await
            .map_err(|e| e.to_string())?;

        let mut node = TreeNode::new(name.clone());
        node.is_directory = metadata.is_dir();

        // 递归扫描子目录
        if metadata.is_dir() && current_depth < max_depth - 1 {
            scan_directory_recursive(
                &entry.path(),
                &mut node,
                current_depth + 1,
                max_depth,
                include,
                exclude,
            ).await?;
        }

        parent.children.push(node);
    }

    // 按类型排序：目录在前，文件在后
    parent.children.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(())
}
```

#### 1.3 工具注册

在 `src-tauri/src/lib.rs` 中注册：

```rust
.commands(batch_list_directory)
```

---

### 2. 聚合展示组件设计（Aggregated Tool View）

#### 2.1 组件架构

```
AggregatedToolView (聚合视图)
├── Header (头部摘要)
│   ├── Tool Icon + Name
│   ├── Status Badge (执行中/已完成)
│   ├── Progress (3/4 完成)
│   └── Expand/Collapse Toggle
├── Summary Stats (统计信息)
│   ├── 工具调用次数
│   ├── Token消耗
│   ├── 耗时
│   └── 扫描文件数
├── Tree View (树形结构)
│   ├── DirectoryNode
│   │   ├── 📁 oa-app/
│   │   │   ├── 📁 src/
│   │   │   │   ├── 📁 main/
│   │   │   │   │   └── 📁 java/
│   │   │   │   └── 📁 test/
│   │   │   └── 📄 pom.xml
│   │   └── 📄 README.md
│   └── Click to Expand/Collapse
└── Detail Panel (详情面板 - 展开时)
    ├── 每个子操作的详细信息
    └── 错误信息（如有）
```

#### 2.2 React组件实现

**文件**: `src/components/AIChat/AggregatedToolView.tsx`

```tsx
import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Folder, File, Clock, Zap, Hash } from 'lucide-react';
import { clsx } from 'clsx';

interface AggregatedToolViewProps {
  operation: BatchOperation;
  onToggleExpand: () => void;
}

export const AggregatedToolView: React.FC<AggregatedToolViewProps> = ({
  operation,
  onToggleExpand,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));

  const stats = useMemo(() => ({
    toolCalls: operation.subOperations?.length || 0,
    tokens: operation.tokenUsage || 0,
    duration: operation.endTime
      ? (operation.endTime - operation.startTime) / 1000
      : null,
    filesScanned: operation.result?.total_files || 0,
    dirsScanned: operation.result?.total_dirs || 0,
  }), [operation]);

  const toggleNode = (path: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderTreeNode = (node: DirectoryNode, path: string, depth: number = 0) => {
    const isExpanded = expandedNodes.has(path);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={path} className="select-none">
        <div
          className={clsx(
            "flex items-center gap-1.5 py-0.5 px-2 rounded cursor-pointer",
            "hover:bg-white/5 transition-colors",
            depth === 0 && "font-medium"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => hasChildren && toggleNode(path)}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} className="text-gray-500" />
            ) : (
              <ChevronRight size={14} className="text-gray-500" />
            )
          ) : (
            <span className="w-3.5" />
          )}

          {node.type === 'directory' ? (
            <Folder size={14} className="text-amber-500" />
          ) : (
            <File size={14} className="text-blue-400" />
          )}

          <span className={clsx(
            "text-sm",
            node.type === 'directory' ? "text-gray-300" : "text-gray-400"
          )}>
            {node.name}
          </span>

          {node.type === 'directory' && node.children && (
            <span className="text-xs text-gray-600 ml-1">
              ({node.children.length})
            </span>
          )}
        </div>

        {isExpanded && node.children?.map((child, index) =>
          renderTreeNode(child, `${path}/${child.name}`, depth + 1)
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#1e1e1e] border border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-[#252526] border-b border-gray-800 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Folder size={16} className="text-blue-400" />
          </div>

          <div>
            <div className="font-medium text-sm text-gray-200">
              {operation.name}
            </div>
            <div className="text-xs text-gray-500">
              {operation.description}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress Badge */}
          {operation.status === 'running' && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              执行中 ({operation.completedSteps}/{operation.totalSteps})
            </div>
          )}

          {operation.status === 'completed' && (
            <div className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
              已完成
            </div>
          )}

          <ChevronDown
            size={16}
            className={clsx(
              "text-gray-500 transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 px-4 py-2 bg-[#1e1e1e] border-b border-gray-800/50 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <Zap size={12} />
          <span>{stats.toolCalls} 次工具调用</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Hash size={12} />
          <span>{(stats.tokens / 1000).toFixed(1)}k tokens</span>
        </div>
        {stats.duration && (
          <div className="flex items-center gap-1.5">
            <Clock size={12} />
            <span>{stats.duration.toFixed(1)}s</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Folder size={12} />
          <span>{stats.dirsScanned} 目录 / {stats.filesScanned} 文件</span>
        </div>
      </div>

      {/* Tree View */}
      {isExpanded && operation.result?.tree && (
        <div className="py-2 max-h-96 overflow-y-auto">
          {renderTreeNode(operation.result.tree, 'root')}
        </div>
      )}
    </div>
  );
};
```

---

### 3. 智能探索策略（Smart Exploration）

#### 3.1 意图识别

当用户询问"oa-app是干什么的"时，AI应识别为**探索意图**，而非简单的目录列表。

**意图分类器**：
```typescript
type ExplorationIntent =
  | 'understand_structure'    // 了解目录结构
  | 'find_specific_file'      // 查找特定文件
  | 'analyze_dependencies'    // 分析依赖关系
  | 'review_code_quality';    // 审查代码质量

function detectExplorationIntent(query: string): ExplorationIntent {
  const patterns = {
    understand_structure: [
      /是干什么的/,
      /什么用/,
      /作用/,
      /架构/,
      /结构/,
      /overview/i,
      /structure/i,
    ],
    find_specific_file: [
      /找.*文件/,
      /.*在哪里/,
      /定位/,
      /find/i,
      /where is/i,
    ],
    // ... 其他模式
  };

  for (const [intent, regexes] of Object.entries(patterns)) {
    if (regexes.some(re => re.test(query))) {
      return intent as ExplorationIntent;
    }
  }

  return 'understand_structure'; // 默认
}
```

#### 3.2 自适应深度

根据目录内容动态调整探索深度：

```typescript
function calculateExplorationDepth(
  rootPath: string,
  entries: DirectoryEntry[],
  intent: ExplorationIntent
): number {
  // 基础深度
  let depth = 2;

  // 根据目录特征调整
  const hasSrc = entries.some(e => e.name === 'src');
  const hasPackageJson = entries.some(e => e.name === 'package.json');
  const hasPomXml = entries.some(e => e.name === 'pom.xml');

  if (hasSrc) depth += 1;
  if (hasPackageJson || hasPomXml) depth += 1;

  // 根据意图调整
  switch (intent) {
    case 'understand_structure':
      return Math.min(depth, 4); // 最大4层
    case 'find_specific_file':
      return Math.min(depth, 3);
    default:
      return depth;
  }
}
```

---

### 4. 批量读取关键文件

在探索目录的同时，自动读取关键文件以理解项目：

```typescript
const KEY_FILES = [
  'README.md',
  'package.json',
  'pom.xml',
  'build.gradle',
  'Cargo.toml',
  'go.mod',
  'requirements.txt',
  'Dockerfile',
];

async function exploreWithContext(
  rootPath: string,
  maxDepth: number
): Promise<ExplorationResult> {
  // 1. 批量列出目录
  const tree = await batch_list_directory({
    rel_path: rootPath,
    max_depth: maxDepth,
  });

  // 2. 识别关键文件
  const keyFilePaths = findKeyFiles(tree, KEY_FILES);

  // 3. 批量读取关键文件（并行）
  const keyFileContents = await Promise.all(
    keyFilePaths.map(async path => ({
      path,
      content: await read_file({ rel_path: path }),
    }))
  );

  // 4. 返回综合结果
  return {
    tree,
    keyFiles: keyFileContents,
    summary: generateSummary(tree, keyFileContents),
  };
}
```

---

### 5. 消息流式处理优化

#### 5.1 聚合消息类型

新增消息类型 `aggregated_operation`：

```typescript
interface AggregatedOperationMessage {
  id: string;
  role: 'assistant';
  type: 'aggregated_operation';
  operation: BatchOperation;
  content: string; // AI的总结说明
}

interface BatchOperation {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'completed' | 'failed';
  toolType: 'directory_exploration' | 'file_analysis' | 'code_search';
  subOperations: SubOperation[];
  result?: any;
  startTime: number;
  endTime?: number;
  tokenUsage: number;
  completedSteps: number;
  totalSteps: number;
}
```

#### 5.2 流式更新机制

```typescript
// 逐步更新聚合视图，而非创建多个独立卡片
for await (const update of streamBatchOperation({
  type: 'directory_exploration',
  rootPath: 'oa-app',
  maxDepth: 3,
})) {
  switch (update.type) {
    case 'progress':
      // 更新进度：3/4 完成
      updateAggregatedView(operationId, {
        completedSteps: update.completed,
        totalSteps: update.total,
      });
      break;

    case 'sub_operation':
      // 添加子操作记录
      addSubOperation(operationId, update.subOperation);
      break;

    case 'complete':
      // 完成，显示最终结果
      finalizeAggregatedView(operationId, update.result);
      break;
  }
}
```

---

## 📊 性能预期

### 5.1 响应时间对比

| 操作 | 当前方案 | 优化后 | 提升 |
|------|---------|--------|------|
| 探索4层目录 | 4 × 500ms = 2s | 1 × 800ms = 0.8s | **-60%** |
| 读取10个关键文件 | 10 × 300ms = 3s | 并行 500ms | **-83%** |
| 总探索时间 | ~5s | ~1.3s | **-74%** |

### 5.2 用户体验指标

| 指标 | 当前 | 目标 | 测量方式 |
|------|------|------|---------|
| 首屏可见信息 | 1个目录 | 完整树形结构 | 用户调研 |
| 操作打断感 | 高（多次弹窗） | 低（单次聚合） | 眼动追踪 |
| 认知负荷 | 高（需记忆多个结果） | 低（树形可视化） | NASA-TLX量表 |

---

## 🛠️ 实施计划

### Phase 1: 后端支持 (2天)
- [ ] 实现 `batch_list_directory` Rust命令
- [ ] 实现 `batch_read_files` 并行读取
- [ ] 添加流式更新事件支持
- [ ] 单元测试覆盖

### Phase 2: 前端组件 (3天)
- [ ] 开发 `AggregatedToolView` 组件
- [ ] 开发 `DirectoryTree` 树形展示
- [ ] 集成到消息流
- [ ] 添加展开/折叠动画

### Phase 3: AI集成 (2天)
- [ ] 实现意图识别逻辑
- [ ] 集成批量工具调用
- [ ] 优化提示词，引导AI使用批量工具
- [ ] E2E测试

### Phase 4: 优化打磨 (1天)
- [ ] 性能调优
- [ ] 边界情况处理
- [ ] 用户反馈收集

**总计**: 8 个工作日

---

## ✅ 验收标准

- [ ] 探索 `oa-app` 目录时只显示1个聚合卡片
- [ ] 聚合卡片内展示完整目录树（可展开/折叠）
- [ ] 显示工具调用统计（次数、token、耗时）
- [ ] 支持批量读取关键文件
- [ ] 树形节点支持点击展开子目录
- [ ] 响应时间比当前方案快50%以上
- [ ] 所有现有E2E测试通过

---

## 📎 参考文档

- Claude Code Design Pattern: 见截图6
- 当前实现: `src/components/AIChat/ToolApproval.tsx`
- 私有库工具系统: `ifainew-core/typescript/src/services/ToolRegistry.ts`

---

**提案人**: AI助手
**日期**: 2026-02-11
**审核人**: [待填写]
