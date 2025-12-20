# v0.1.2 工作区增强功能 - 技术设计文档

## Context（背景）

若爱编辑器当前使用 React 19 + Zustand + Monaco Editor + Tauri 2.0 架构。v0.1.2 将引入分屏编辑、多窗口支持和快捷键自定义功能，这些功能涉及复杂的状态管理、窗口间通信和用户配置持久化。

**关键约束：**
- 必须保持轻量级（相比 Electron）
- 跨平台一致性（Windows、macOS、Linux）
- 与现有 AI 功能无缝集成
- 启动时间 < 3s（即使有多窗格）

**利益相关者：**
- 最终用户（需要高效的多文件编辑体验）
- 开发团队（需要可维护的架构）
- 性能预算（内存 < 500MB with 4 panes）

## Goals / Non-Goals（目标与非目标）

### Goals
1. **分屏编辑**：支持 1-4 个窗格的灵活布局，可拖拽调整
2. **多窗口支持**：利用 Tauri 多窗口能力，支持多显示器工作流
3. **快捷键自定义**：可视化配置界面，支持预设方案和导入/导出
4. **性能优化**：确保多窗格/多窗口场景下的流畅体验
5. **状态持久化**：保存用户的布局和快捷键偏好

### Non-Goals
1. **浮动窗格**：不支持窗格的自由浮动（仅支持固定网格布局）
2. **实时协作**：不支持多用户同时编辑（未来功能）
3. **窗格内嵌套分屏**：窗格内不能再分割（仅支持一级分屏）
4. **无限窗格数量**：限制最大 4 个窗格（性能考量）

## Decisions（技术决策）

### 决策 1: 分屏布局实现方式

**选择：自实现基于 Flexbox 的分屏系统**

**候选方案：**
1. **react-mosaic-component** - 成熟的窗格管理库
   - ✅ 功能完整，支持拖拽、嵌套
   - ❌ 体积较大（~50KB），依赖较多
   - ❌ 样式定制困难，与我们的 TailwindCSS 风格不匹配

2. **react-grid-layout** - 网格布局库
   - ✅ 灵活的网格系统
   - ❌ 过于复杂，功能超出需求
   - ❌ 主要为仪表板设计，不适合代码编辑器

3. **自实现** - 基于 Flexbox 和 Zustand
   - ✅ 完全可控，轻量级（~5KB）
   - ✅ 与现有技术栈无缝集成
   - ✅ 易于定制和维护
   - ❌ 需要自行实现拖拽逻辑

**理由：**
- 我们的需求相对简单（仅支持水平/垂直分屏，无嵌套）
- 轻量级是核心价值，避免引入大型依赖
- 团队对 React 和 Flexbox 熟悉，维护成本低

**实现细节：**
```typescript
// 布局数据结构
interface LayoutState {
  panes: Pane[];
  activePane: string;
  splitDirection: 'horizontal' | 'vertical';
}

interface Pane {
  id: string;
  fileId?: string;
  size: number; // 百分比 (0-100)
  position: { x: number; y: number };
}
```

### 决策 2: 多窗口通信机制

**选择：Tauri Event System**

**候选方案：**
1. **Tauri Events** - Tauri 原生事件系统
   - ✅ 原生支持，无需额外依赖
   - ✅ 类型安全（TypeScript 支持）
   - ✅ 双向通信（Frontend ↔ Backend ↔ Frontend）

2. **WebSocket** - 基于 WebSocket 的自定义通信
   - ❌ 需要额外的服务器实现
   - ❌ 增加复杂度和资源占用

3. **localStorage + Polling** - 基于本地存储的轮询
   - ❌ 性能差，延迟高
   - ❌ 不适合实时通信

**理由：**
- Tauri Events 是官方推荐方案
- 性能优异，延迟低（< 10ms）
- 与现有架构一致

**实现细节：**
```rust
// Rust 后端事件发送
use tauri::Manager;

app.emit_all("file-opened", FileOpenedPayload {
  window_id: window.label(),
  file_path: path.to_string(),
}).unwrap();
```

```typescript
// TypeScript 前端事件监听
import { listen } from '@tauri-apps/api/event';

listen<FileOpenedPayload>('file-opened', (event) => {
  // 同步文件打开状态
});
```

### 决策 3: 快捷键管理库选择

**选择：hotkeys-js**

**候选方案：**
1. **mousetrap** - 轻量级快捷键库
   - ✅ 简单易用，API 清晰
   - ❌ 不再活跃维护（最后更新 2017）
   - ❌ TypeScript 支持不完整

2. **hotkeys-js** - 现代快捷键库
   - ✅ 活跃维护，支持 TypeScript
   - ✅ 轻量级（~3KB gzipped）
   - ✅ 支持组合键、序列键
   - ✅ 无依赖

3. **react-hotkeys-hook** - React Hook 封装
   - ✅ React 友好
   - ❌ 依赖 hotkeys-js，多一层封装
   - ❌ 不支持动态绑定（需要重新渲染）

**理由：**
- hotkeys-js 是现代化、轻量级的选择
- 我们可以基于它封装自己的 React Hook
- 支持全局快捷键和局部快捷键（scope）

**实现细节：**
```typescript
import hotkeys from 'hotkeys-js';

// 动态绑定快捷键
function bindShortcut(key: string, handler: () => void) {
  hotkeys(key, handler);
}

// 取消绑定
function unbindShortcut(key: string) {
  hotkeys.unbind(key);
}
```

### 决策 4: Monaco Editor 实例管理

**选择：编辑器实例池 + 懒加载**

**理由：**
- Monaco Editor 实例创建开销较大（~100ms + ~20MB 内存）
- 限制同时存在的编辑器实例数量（最大 4 个）
- 不活跃的窗格可以销毁编辑器实例，保留状态

**实现细节：**
```typescript
class EditorInstancePool {
  private instances: Map<string, monaco.editor.IStandaloneCodeEditor> = new Map();
  private readonly MAX_INSTANCES = 4;

  getOrCreate(paneId: string): monaco.editor.IStandaloneCodeEditor {
    if (this.instances.has(paneId)) {
      return this.instances.get(paneId)!;
    }

    // 如果达到上限，销毁最久未使用的实例
    if (this.instances.size >= this.MAX_INSTANCES) {
      this.evictLRU();
    }

    const instance = monaco.editor.create(/* ... */);
    this.instances.set(paneId, instance);
    return instance;
  }
}
```

### 决策 5: 配置文件格式

**选择：JSON + Schema 验证**

**候选方案：**
1. **JSON** - 标准 JSON 格式
   - ✅ 易于解析，跨语言支持
   - ✅ 可读性好
   - ❌ 不支持注释

2. **TOML** - 配置文件专用格式
   - ✅ 支持注释，可读性更好
   - ❌ Rust 解析库增加体积

3. **YAML** - 人类友好格式
   - ❌ 解析复杂度高
   - ❌ 容易出现缩进错误

**理由：**
- JSON 是最轻量级、最广泛支持的格式
- 可通过 JSON Schema 进行验证
- 用户通常通过 UI 编辑，不需要手动修改配置文件

**配置文件位置：**
- macOS: `~/Library/Application Support/com.peterfei.ifai/`
- Windows: `%APPDATA%/com.peterfei.ifai/`
- Linux: `~/.config/ifai/`

**配置文件结构：**
```json
// layout.json
{
  "version": "1.0",
  "panes": [
    { "id": "pane-1", "fileId": "file-123", "size": 50 },
    { "id": "pane-2", "fileId": "file-456", "size": 50 }
  ],
  "splitDirection": "horizontal"
}

// keybindings.json
{
  "version": "1.0",
  "preset": "ifai-default",
  "custom": [
    { "key": "cmd+shift+p", "command": "showCommandPalette" },
    { "key": "cmd+\\", "command": "splitEditorHorizontal" }
  ]
}
```

## Architecture（架构图）

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  AI Chat    │  │  File Tree   │  │  Settings UI   │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                 Editor Workspace Layer                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │         SplitPaneContainer (New)                  │  │
│  │  ┌─────────────┐  ┌─────────────┐               │  │
│  │  │   Pane 1    │  │   Pane 2    │               │  │
│  │  │  Monaco     │  │  Monaco     │               │  │
│  │  │  Editor     │  │  Editor     │               │  │
│  │  └─────────────┘  └─────────────┘               │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   State Management Layer                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │layout-store │  │shortcuts-    │  │ editor-store   │ │
│  │   (New)     │  │  store (New) │  │  (Modified)    │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│              Tauri Backend Layer (Rust)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Window Mgr   │  │  Config Mgr  │  │  Event Bus   │ │
│  │   (New)      │  │  (Modified)  │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                      System Layer                        │
│   ┌────────────┐    ┌────────────┐    ┌────────────┐  │
│   │ File System│    │  WebView   │    │   OS APIs  │  │
│   └────────────┘    └────────────┘    └────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 数据流图（分屏场景）

```
User Action: "Split Editor"
         ↓
   UI Event Handler
         ↓
   layout-store.split()
         ↓
   ┌───────────────────────────┐
   │  Update Layout State      │
   │  - Create new Pane        │
   │  - Adjust existing sizes  │
   └───────────────────────────┘
         ↓
   React Re-render
         ↓
   ┌───────────────────────────┐
   │  SplitPaneContainer       │
   │  - Render 2 Panes         │
   │  - Create Monaco instance │
   └───────────────────────────┘
         ↓
   Save to config.rs
         ↓
   Persist to layout.json
```

### 多窗口通信流程

```
Window A                  Tauri Backend               Window B
   │                            │                         │
   │─── invoke("open_file") ──>│                         │
   │                            │                         │
   │<─── result ───────────────│                         │
   │                            │                         │
   │                            │─── emit("file-opened")─>│
   │                            │                         │
   │                            │                         │
   │<─── emit("file-opened") ───│                         │
   │                            │                         │
   │  (Update UI)               │                (Update UI)
```

## Risks / Trade-offs（风险与权衡）

### 风险 1: 多 Monaco 实例内存占用

**风险描述：**
每个 Monaco Editor 实例占用约 20MB 内存。4 窗格场景下内存占用可能达到 ~400MB（仅编辑器部分）。

**缓解措施：**
1. **实例池管理**：限制最大 4 个实例，LRU 淘汰策略
2. **懒加载**：窗格不可见时销毁编辑器，保留编辑状态
3. **共享资源**：多个实例共享 Monaco 语言服务
4. **监控指标**：实现内存使用监控，超过阈值时自动清理

**回退方案：**
如果内存问题无法解决，降级为最多 2 窗格分屏。

### 风险 2: 快捷键冲突

**风险描述：**
用户自定义快捷键可能与系统快捷键（如 Cmd+Q）或浏览器快捷键冲突。

**缓解措施：**
1. **冲突检测**：实时检测用户输入的快捷键是否冲突
2. **黑名单机制**：禁止绑定系统保留快捷键
3. **警告提示**：当检测到潜在冲突时显示警告
4. **快捷键优先级**：应用内快捷键 > 全局快捷键

**权衡：**
某些快捷键（如 F1、F11）在某些平台上无法拦截，需要文档说明。

### 风险 3: 窗口状态同步延迟

**风险描述：**
多窗口间通过事件同步状态时可能存在延迟（~10-50ms），导致状态不一致。

**缓解措施：**
1. **乐观更新**：本地先更新，然后广播事件
2. **版本号机制**：状态更新携带版本号，检测冲突
3. **最终一致性**：接受短暂的不一致，定期同步

**权衡：**
为了性能，不采用强一致性（会引入锁和等待），接受最终一致性。

### 风险 4: 跨平台快捷键差异

**风险描述：**
macOS 使用 Cmd，Windows/Linux 使用 Ctrl，某些快捷键在不同平台上行为不一致。

**缓解措施：**
1. **平台检测**：自动映射 Cmd ↔ Ctrl
2. **平台专用配置**：允许为不同平台定义不同快捷键
3. **预设方案适配**：内置预设方案已针对平台优化

**实现：**
```typescript
const isMac = navigator.platform.includes('Mac');
const modifier = isMac ? 'cmd' : 'ctrl';
const shortcut = `${modifier}+s`; // 自动适配
```

## Migration Plan（迁移计划）

### 阶段 1: 兼容性准备（v0.1.1 → v0.1.2）

1. **配置文件初始化**：
   - 首次启动 v0.1.2 时，生成 `layout.json` 和 `keybindings.json`
   - 如果用户已有编辑器状态，迁移到新的布局模型

2. **向后兼容**：
   - 保留单窗格模式作为默认（不强制用户使用分屏）
   - 旧版本打开的文件自动加载到默认窗格

3. **数据迁移脚本**：
```rust
fn migrate_config_v1_to_v2(old_config: &OldConfig) -> NewConfig {
  NewConfig {
    layout: LayoutConfig {
      panes: vec![Pane {
        id: "default-pane".to_string(),
        file_id: old_config.current_file.clone(),
        size: 100,
      }],
    },
    keybindings: KeybindingsConfig::default(),
  }
}
```

### 阶段 2: 灰度发布

1. **Feature Flag**：通过配置文件控制新功能开关
```json
{
  "features": {
    "splitPane": true,
    "multiWindow": false, // 先发布分屏，多窗口后续开启
    "customShortcuts": true
  }
}
```

2. **监控指标**：
   - 分屏使用率
   - 平均窗格数量
   - 内存占用分布
   - 快捷键配置修改率

### 阶段 3: 全量发布

1. **默认启用所有功能**
2. **收集用户反馈**
3. **修复 Bug 并发布 v0.1.3 补丁版本**

### 回滚计划

如果发现严重问题：
1. **紧急回滚**：发布 v0.1.2.1，禁用多窗口功能
2. **配置降级**：将 `layout.json` 重置为单窗格模式
3. **用户通知**：在应用内显示降级通知

## Performance Considerations（性能考量）

### 目标性能指标

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 冷启动时间 | < 3s | 从点击图标到编辑器可交互 |
| 分屏切换延迟 | < 100ms | 从点击到窗格激活 |
| 内存占用（4 窗格） | < 500MB | Chrome DevTools Memory Profiler |
| CPU 空闲时占用 | < 5% | Activity Monitor / Task Manager |
| 窗口通信延迟 | < 50ms | 事件发送到接收的时间差 |

### 性能优化策略

1. **编辑器实例懒加载**：
   - 窗格创建时不立即创建编辑器
   - 当窗格获得焦点时才创建

2. **虚拟化窗格**：
   - 窗格不可见时，销毁 DOM 元素
   - 保留编辑状态（光标位置、滚动位置）

3. **节流和防抖**：
   - 窗格大小调整时使用节流（throttle 16ms）
   - 快捷键配置搜索使用防抖（debounce 300ms）

4. **内存监控**：
```typescript
// 定期检查内存使用
setInterval(() => {
  if (performance.memory.usedJSHeapSize > THRESHOLD) {
    editorInstancePool.evictLRU();
  }
}, 30000); // 每 30 秒检查一次
```

## Open Questions（待解决问题）

### 问题 1: 窗格拖拽重排序

**问题：** 是否支持通过拖拽改变窗格的排列顺序？

**选项：**
- A: 仅支持大小调整，不支持重排序（简化实现）
- B: 支持拖拽重排序（需要实现复杂的拖拽逻辑）

**建议：** v0.1.2 选择 A，v0.2.0 考虑 B

### 问题 2: 窗格间同步滚动

**问题：** 是否提供同步滚动功能（用于代码对比）？

**选项：**
- A: 提供（增加开发工作量，但对代码对比场景很有用）
- B: 不提供（简化实现）

**建议：** v0.1.2 选择 B，作为 v0.2.0 增强功能

### 问题 3: 快捷键宏录制

**问题：** 是否支持快捷键宏（录制一系列操作并绑定到快捷键）？

**选项：**
- A: 提供（高级功能，吸引 power user）
- B: 不提供（范围蔓延，增加复杂度）

**建议：** v0.1.2 不提供，作为未来独立功能考虑

## Dependencies（依赖关系）

### 前置依赖
- ✅ Monaco Editor 集成（已完成）
- ✅ Zustand 状态管理（已完成）
- ✅ Tauri 2.0 基础设施（已完成）

### 新增依赖
- `hotkeys-js: ^3.13.7` - 快捷键管理
- `react-resizable-panels: ^2.0.0` (可选) - 窗格大小调整（如果自实现不满足需求）

### 开发依赖
- `@testing-library/react: ^14.0.0` - React 组件测试
- `vitest: ^1.0.0` - 单元测试框架

## Success Metrics（成功指标）

### 功能指标
- [x] 分屏功能完整实现（水平、垂直、四象限）
- [x] 多窗口支持（创建、关闭、状态同步）
- [x] 快捷键自定义（配置界面、冲突检测、预设方案）

### 性能指标
- [ ] 4 窗格场景内存 < 500MB
- [ ] 分屏切换延迟 < 100ms
- [ ] 冷启动时间 < 3s（未退化）

### 质量指标
- [ ] 单元测试覆盖率 > 80%
- [ ] 跨平台测试通过（macOS、Windows、Linux）
- [ ] 严重 Bug < 5（上线后 2 周）

### 用户指标
- [ ] 分屏功能使用率 > 30%（活跃用户）
- [ ] 快捷键自定义率 > 15%（活跃用户）
- [ ] 用户满意度 > 4.0/5.0（问卷调查）

## Timeline Estimate（时间估算）

| 阶段 | 工作量（人天） | 关键里程碑 |
|------|----------------|------------|
| Week 1: 分屏基础 | 5 天 | 完成布局管理和 UI 组件 |
| Week 2: 多窗口 | 5 天 | 完成窗口管理和状态同步 |
| Week 3: 快捷键系统 | 5 天 | 完成快捷键配置和 UI |
| Week 4: 测试与优化 | 5 天 | 完成测试、文档和性能优化 |
| **总计** | **20 人天** | **v0.1.2 发布** |

**风险缓冲：** +5 天（应对不可预见问题）

**实际预计：** 25 人天（约 5 个工作周，单人开发）
