# GPU 加速与 120 FPS 渲染性能优化设计文档

## Context

### 背景

若爱编辑器基于 Tauri 2.0 + React + Monaco Editor 架构，目标是提供媲美 VSCode 的编辑体验。当前虽然使用了成熟的 Monaco Editor 引擎，但在以下场景下存在性能挑战：

1. **大文件编辑**：打开 >10MB 的日志文件、JSON 数据时，滚动和高亮渲染可能卡顿
2. **多窗口分屏**：同时编辑 4+ 个文件时，整体响应速度下降
3. **高频操作**：快速输入、多光标批量编辑时，渲染跟不上操作
4. **高刷新率显示器**：未充分利用 120Hz/144Hz 显示器能力，视觉体验未达最佳

### 约束条件

- **技术栈固定**：必须基于现有 Monaco Editor，不能替换编辑器引擎
- **跨平台一致性**：Windows/macOS/Linux 必须保持一致体验
- **内存限制**：相比 Electron，Tauri 的优势是低内存占用，不能因性能优化大幅增加内存
- **向后兼容**：低端设备（集成显卡、旧 GPU）仍需正常工作
- **启动速度**：不能因性能优化增加冷启动时间

### 利益相关者

- **核心用户**：需要长时间编辑大文件的开发者（后端、DevOps）
- **高端用户**：拥有高刷新率显示器和独立显卡的用户
- **普通用户**：一般编辑场景，不应因优化引入副作用

## Goals / Non-Goals

### Goals（目标）

1. **GPU 硬件加速**
   - 启用浏览器和 Tauri 的 GPU 加速特性
   - Monaco Editor 使用 Canvas 硬件渲染
   - 提升渲染吞吐量 2-3 倍

2. **高帧率渲染**
   - 自动检测显示器刷新率（60/120/144 Hz）
   - 关键操作达到显示器最高刷新率
   - 滚动、光标、输入达到 120 FPS（在支持的硬件上）

3. **自适应性能**
   - 自动检测 GPU 性能等级
   - 低端设备自动降级，不影响稳定性
   - 提供手动性能档位配置

4. **可观测性**
   - 提供性能监控面板（开发和高级用户）
   - FPS、GPU 内存、渲染耗时可视化
   - 帮助定位性能瓶颈

### Non-Goals（非目标）

1. **不替换编辑器引擎**：继续使用 Monaco Editor，不自研渲染引擎
2. **不优化 AI 功能性能**：本提案仅关注编辑器渲染，不涉及 AI 推理性能
3. **不支持所有旧设备**：对于不支持 GPU 加速的极旧设备，降级至基础体验
4. **不保证所有操作 120 FPS**：复杂语法高亮（如 Regex）可能无法达到 120 FPS

## Decisions

### 决策 1：GPU 加速启用策略

**决定**：默认启用 GPU 加速，运行时自动检测并降级

**原因**：
- 现代设备（2018 年后）普遍支持 GPU 加速
- 自动降级机制可保证兼容性
- 默认启用可让大多数用户受益

**实现方案**：
```typescript
// 1. Tauri 窗口配置（tauri.conf.json）
{
  "tauri": {
    "windows": [{
      "hardwareAcceleration": true  // 启用硬件加速
    }]
  }
}

// 2. Monaco Editor 配置
const editorOptions = {
  // 启用 GPU 友好的选项
  'editor.renderWhitespace': 'selection',  // 减少渲染开销
  'editor.renderControlCharacters': false,
  'editor.smoothScrolling': true,           // 平滑滚动（GPU 加速）
  'editor.cursorSmoothCaretAnimation': 'on' // 光标动画（GPU 加速）
}

// 3. 运行时检测
const gpuTier = await detectGPUTier();
if (gpuTier === 'low') {
  // 降级配置
  editorOptions.smoothScrolling = false;
  targetFPS = 60;
}
```

**替代方案考虑**：
- **方案 A**：默认关闭，用户手动开启 ❌ - 大多数用户不会配置
- **方案 B**：仅高端设备启用 ❌ - 检测逻辑复杂且可能误判

### 决策 2：帧率调度策略

**决定**：使用自适应帧率调度，优先保证响应速度

**原因**：
- 并非所有渲染都需要 120 FPS
- 关键交互（输入、滚动）优先高帧率
- 后台任务（语法高亮）可降低优先级

**实现方案**：
```typescript
// 帧率调度器
class FrameRateScheduler {
  private targetFPS: number = 120; // 目标帧率
  private lastFrameTime: number = 0;

  scheduleFrame(callback: () => void, priority: 'high' | 'normal' | 'low') {
    const frameInterval = 1000 / this.targetFPS;

    if (priority === 'high') {
      // 高优先级：立即执行
      requestAnimationFrame(callback);
    } else {
      // 低优先级：空闲时执行
      requestIdleCallback(callback, { timeout: frameInterval });
    }
  }
}

// 使用示例
scheduler.scheduleFrame(() => {
  // 渲染光标、处理输入
}, 'high');

scheduler.scheduleFrame(() => {
  // 更新语法高亮
}, 'low');
```

**替代方案考虑**：
- **方案 A**：所有渲染统一 120 FPS ❌ - 不必要的性能消耗
- **方案 B**：固定 60 FPS ❌ - 无法利用高刷新率显示器

### 决策 3：性能降级阈值

**决定**：基于 FPS 实时监控动态降级

**降级策略**：
| 场景 | 条件 | 降级措施 |
|------|------|----------|
| 轻度卡顿 | 平均 FPS < 100（目标 120） | 关闭非必要动画效果 |
| 中度卡顿 | 平均 FPS < 50 | 降级至 60 FPS 目标 + 简化渲染 |
| 重度卡顿 | 平均 FPS < 30 | 关闭所有动画 + 最小化渲染 |
| GPU 不可用 | 检测失败或驱动异常 | 软件渲染（Monaco 默认） |

**实现方案**：
```typescript
class PerformanceMonitor {
  private fpsHistory: number[] = [];

  monitorFrame() {
    const currentFPS = this.calculateFPS();
    this.fpsHistory.push(currentFPS);

    // 保留最近 60 帧的数据
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift();
    }

    const avgFPS = this.getAverageFPS();

    if (avgFPS < 30) {
      this.applyDegradation('severe');
    } else if (avgFPS < 50) {
      this.applyDegradation('moderate');
    } else if (avgFPS < 100) {
      this.applyDegradation('mild');
    }
  }
}
```

### 决策 4：大文件优化策略

**决定**：使用虚拟滚动 + 延迟语法高亮

**原因**：
- Monaco Editor 已内置虚拟滚动，但需优化配置
- 语法高亮是大文件性能瓶颈
- 分块渲染可显著提升响应速度

**实现方案**：
```typescript
// 大文件检测阈值
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB

// 大文件优化配置
if (fileSize > LARGE_FILE_THRESHOLD) {
  editorOptions = {
    ...editorOptions,
    'editor.largeFileOptimizations': true,
    'editor.tokenizationLimit': 5000,          // 限制 token 化行数
    'editor.maxTokenizationLineLength': 1000,  // 限制单行 token 化长度
    'editor.renderValidationDecorations': 'off' // 关闭验证装饰
  };
}

// 延迟语法高亮
const debouncedHighlight = debounce(() => {
  monaco.editor.setModelLanguage(model, language);
}, 500);
```

### 决策 5：性能监控 UI 设计

**决定**：可选开启的悬浮面板，不侵入编辑区域

**设计**：
- 默认关闭，通过设置或快捷键开启
- 悬浮在编辑器右下角，半透明
- 显示关键指标：FPS、GPU 内存、渲染耗时
- 可拖拽、可折叠

**实现方案**：
```typescript
// 性能监控面板组件
<PerformanceMonitor
  visible={settings.showPerformanceMonitor}
  position="bottom-right"
  opacity={0.8}
  metrics={['fps', 'gpu-memory', 'render-time']}
/>

// 快捷键：Cmd/Ctrl + Shift + P
editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
  togglePerformanceMonitor();
});
```

## Risks / Trade-offs

### 风险 1：兼容性问题

**风险**：部分旧设备或虚拟机不支持 GPU 加速，可能导致渲染异常或崩溃

**影响等级**：中等

**缓解措施**：
1. 启动时检测 GPU 可用性
2. 捕获 WebGL 错误，自动降级至软件渲染
3. 提供"安全模式"启动选项（禁用所有 GPU 特性）
4. 在设置中提供手动关闭 GPU 加速的开关

**回滚计划**：
- 如果用户报告大量兼容性问题，通过配置文件默认关闭 GPU 加速
- 发布热修复版本，添加更严格的 GPU 检测逻辑

### 风险 2：功耗增加

**风险**：GPU 加速会增加笔记本电量消耗，影响续航

**影响等级**：低

**缓解措施**：
1. 检测电池模式（Windows/macOS API）
2. 电池模式下自动降低性能档位（60 FPS）
3. 在设置中提供"节能模式"选项

```typescript
// 电池模式检测
const onBattery = await invoke<boolean>('is_on_battery');
if (onBattery && !settings.highPerformanceOnBattery) {
  targetFPS = 60;
  disableNonEssentialAnimations();
}
```

### 风险 3：内存占用增加

**风险**：GPU 渲染可能增加显存和内存占用

**影响等级**：低

**缓解措施**：
1. 监控内存使用，超过阈值自动释放缓存
2. 多窗口场景下共享 GPU 资源
3. 定期清理未使用的纹理和缓冲区

**可接受范围**：
- 单文件编辑：内存增加 <50MB
- 4 窗口分屏：总内存增加 <200MB

### Trade-off：性能 vs 电量

**选择**：默认高性能，提供节能选项

**理由**：
- 开发者通常在插电环境下工作
- 性能体验对生产效率影响更大
- 用户可根据场景切换模式

## Migration Plan

### 阶段 1：基础设施（Week 1-2）

1. **Tauri 配置**
   - 启用硬件加速
   - 添加 GPU 检测命令

2. **性能检测工具**
   - 实现 GPU 性能等级检测
   - 实现帧率监控工具
   - 实现显示器刷新率检测

3. **设置项扩展**
   - 添加性能档位配置
   - 添加性能监控开关
   - 添加降级策略配置

### 阶段 2：编辑器优化（Week 3-4）

1. **Monaco Editor 配置优化**
   - 启用 GPU 友好选项
   - 实现自适应配置切换
   - 大文件优化配置

2. **帧率调度器**
   - 实现优先级队列
   - 集成到渲染管线
   - 性能测试和调优

3. **降级策略**
   - 实现自动降级逻辑
   - 测试各降级档位效果

### 阶段 3：监控与优化（Week 5-6）

1. **性能监控面板**
   - UI 组件开发
   - 实时数据可视化
   - 国际化支持

2. **测试与调优**
   - 不同硬件配置测试
   - 性能基准测试
   - 内存和功耗测试

3. **文档与发布**
   - 用户文档
   - 性能优化指南
   - 发布说明

### 回滚策略

如需回滚，执行以下步骤：

1. **配置回滚**
   ```json
   // tauri.conf.json
   {
     "tauri": {
       "windows": [{
         "hardwareAcceleration": false  // 关闭硬件加速
       }]
     }
   }
   ```

2. **代码回滚**
   - 移除性能检测代码
   - 移除帧率调度器
   - 恢复默认 Monaco 配置

3. **用户通知**
   - 发布说明中标注性能优化已回滚
   - 提供降级原因和替代方案

### 数据迁移

无需数据迁移，所有变更为配置和代码层面。

## Open Questions

1. **Q**: 是否需要为不同操作系统制定不同的性能策略？
   **A**: 暂定统一策略，如发现平台差异显著，再针对性优化

2. **Q**: 性能监控数据是否需要上报到服务器用于分析？
   **A**: 不上报，保持 local-first 原则，仅在本地显示

3. **Q**: 是否需要支持外接显示器的不同刷新率？
   **A**: 是，需要检测主显示器刷新率，并支持窗口移动时动态调整

4. **Q**: 虚拟机环境下如何处理 GPU 加速？
   **A**: 虚拟机通常不支持 GPU 透传，自动降级至软件渲染

5. **Q**: 是否需要与系统性能模式（高性能/均衡/节能）联动？
   **A**: macOS 和 Windows 11+ 支持，可作为未来增强功能，当前版本暂不实现
