# GPU 加速与 120 FPS 渲染性能优化任务清单

## 1. 基础设施搭建

### 1.1 Tauri 配置
- [ ] 1.1.1 在 `src-tauri/tauri.conf.json` 中启用 `hardwareAcceleration`
- [ ] 1.1.2 在 `src-tauri/src/lib.rs` 中添加 GPU 检测 Tauri 命令 `detect_gpu_info`
- [ ] 1.1.3 添加电池状态检测命令 `is_on_battery`（Windows/macOS）
- [ ] 1.1.4 添加显示器刷新率检测命令 `get_display_refresh_rate`
- [ ] 1.1.5 测试 Tauri 命令在三平台的可用性（Windows/macOS/Linux）

### 1.2 性能检测工具
- [ ] 1.2.1 创建 `src/utils/performance.ts` 文件
- [ ] 1.2.2 实现 `detectGPUTier()` 函数（检测 GPU 性能等级：high/medium/low/none）
- [ ] 1.2.3 实现 `getDisplayRefreshRate()` 函数（检测显示器刷新率）
- [ ] 1.2.4 实现 `detectWebGLSupport()` 函数（检测 WebGL 可用性）
- [ ] 1.2.5 实现 `PerformanceMonitor` 类（FPS 监控、内存监控）
- [ ] 1.2.6 编写单元测试 `performance.test.ts`

### 1.3 设置项扩展
- [ ] 1.3.1 在 `src/stores/settingsStore.ts` 中添加性能相关设置
  - `performanceMode`: 'auto' | 'high' | 'medium' | 'low'
  - `targetFPS`: 60 | 120 | 144
  - `enableGPUAcceleration`: boolean
  - `showPerformanceMonitor`: boolean
  - `enableAutoDowngrade`: boolean
- [ ] 1.3.2 实现设置项持久化（localStorage）
- [ ] 1.3.3 添加设置项默认值和验证逻辑

## 2. 编辑器性能优化

### 2.1 Monaco Editor 配置优化
- [ ] 2.1.1 在 `src/components/Editor/MonacoEditor.tsx` 中添加 GPU 友好配置
  - 启用 `smoothScrolling`
  - 启用 `cursorSmoothCaretAnimation`
  - 优化 `renderWhitespace`、`renderControlCharacters`
- [ ] 2.1.2 实现大文件检测逻辑（>10MB）
- [ ] 2.1.3 实现大文件专用配置（限制 tokenization、关闭装饰等）
- [ ] 2.1.4 实现根据 GPU 性能等级动态调整编辑器配置
- [ ] 2.1.5 测试不同配置组合的性能表现

### 2.2 帧率调度器
- [ ] 2.2.1 创建 `src/hooks/useFrameRate.ts`
- [ ] 2.2.2 实现 `FrameRateScheduler` 类
  - `scheduleFrame(callback, priority)` 方法
  - 优先级队列（high/normal/low）
  - 自适应帧率调整
- [ ] 2.2.3 集成到 Monaco Editor 的渲染管线
- [ ] 2.2.4 实现帧时间监控和统计
- [ ] 2.2.5 测试高频操作下的帧率稳定性

### 2.3 GPU 加速 Hook
- [ ] 2.3.1 创建 `src/hooks/useGPUAcceleration.ts`
- [ ] 2.3.2 实现 GPU 可用性检测
- [ ] 2.3.3 实现 GPU 性能监控
- [ ] 2.3.4 实现错误捕获和自动降级
- [ ] 2.3.5 提供 GPU 状态 React Context

### 2.4 性能降级策略
- [ ] 2.4.1 实现实时 FPS 监控
- [ ] 2.4.2 实现降级阈值检测
  - 平均 FPS < 30 → 重度降级
  - 平均 FPS < 50 → 中度降级
  - 平均 FPS < 100 → 轻度降级
- [ ] 2.4.3 实现降级配置应用逻辑
- [ ] 2.4.4 实现自动恢复逻辑（性能改善时）
- [ ] 2.4.5 测试降级策略在不同硬件上的表现

## 3. 性能监控 UI

### 3.1 性能监控面板组件
- [ ] 3.1.1 创建 `src/components/PerformanceMonitor/PerformanceMonitor.tsx`
- [ ] 3.1.2 实现悬浮面板 UI（右下角、半透明、可拖拽）
- [ ] 3.1.3 实现 FPS 实时显示（数字 + 迷你图表）
- [ ] 3.1.4 实现 GPU 内存使用显示
- [ ] 3.1.5 实现渲染耗时显示（帧时间）
- [ ] 3.1.6 实现面板折叠/展开功能
- [ ] 3.1.7 实现拖拽重定位功能
- [ ] 3.1.8 添加样式 `PerformanceMonitor.module.css`

### 3.2 监控数据收集
- [ ] 3.2.1 集成 `PerformanceMonitor` 类
- [ ] 3.2.2 实现数据刷新机制（每秒更新）
- [ ] 3.2.3 实现历史数据存储（最近 60 帧）
- [ ] 3.2.4 实现数据平滑算法（移动平均）

### 3.3 快捷键集成
- [ ] 3.3.1 在 `MonacoEditor.tsx` 中添加快捷键 `Cmd/Ctrl + Shift + P`
- [ ] 3.3.2 实现快捷键切换性能监控面板显示/隐藏
- [ ] 3.3.3 同步快捷键状态到 `settingsStore`

## 4. 国际化

### 4.1 中文翻译
- [ ] 4.1.1 在 `src/i18n/locales/zh.json` 中添加性能相关文案
  - 设置项标签和描述
  - 性能监控面板文案
  - 性能模式说明

### 4.2 英文翻译
- [ ] 4.2.1 在 `src/i18n/locales/en.json` 中添加对应英文文案
- [ ] 4.2.2 检查翻译准确性和一致性

## 5. 设置界面集成

### 5.1 性能设置页面
- [ ] 5.1.1 在 `src/components/Settings/SettingsModal.tsx` 中添加"性能"选项卡
- [ ] 5.1.2 添加性能模式选择（自动/高性能/均衡/节能）
- [ ] 5.1.3 添加目标帧率选择（60/120/144 FPS）
- [ ] 5.1.4 添加 GPU 加速开关
- [ ] 5.1.5 添加性能监控开关
- [ ] 5.1.6 添加自动降级开关
- [ ] 5.1.7 添加"重置为默认"按钮

### 5.2 性能提示
- [ ] 5.2.1 添加 GPU 不可用时的提示信息
- [ ] 5.2.2 添加电池模式下的性能提示
- [ ] 5.2.3 添加大文件编辑时的性能建议

## 6. 测试

### 6.1 单元测试
- [ ] 6.1.1 `performance.test.ts` - 性能检测工具测试
- [ ] 6.1.2 `useFrameRate.test.tsx` - 帧率调度器测试
- [ ] 6.1.3 `useGPUAcceleration.test.tsx` - GPU 加速 Hook 测试
- [ ] 6.1.4 `PerformanceMonitor.test.tsx` - 监控面板组件测试

### 6.2 集成测试
- [ ] 6.2.1 测试大文件（>10MB）编辑性能
- [ ] 6.2.2 测试多窗口分屏（4+）性能
- [ ] 6.2.3 测试高频操作（快速输入、多光标）
- [ ] 6.2.4 测试滚动流畅度（大文件）
- [ ] 6.2.5 测试语法高亮性能（复杂文件）

### 6.3 性能基准测试
- [ ] 6.3.1 建立性能测试基准（FPS、内存、启动时间）
- [ ] 6.3.2 对比优化前后的性能数据
- [ ] 6.3.3 生成性能测试报告

### 6.4 兼容性测试
- [ ] 6.4.1 Windows 10/11 测试（Intel/AMD/NVIDIA GPU）
- [ ] 6.4.2 macOS 测试（Intel/Apple Silicon）
- [ ] 6.4.3 Linux 测试（Ubuntu/Fedora）
- [ ] 6.4.4 虚拟机环境测试（降级逻辑验证）
- [ ] 6.4.5 低端设备测试（集成显卡）

### 6.5 功耗测试
- [ ] 6.5.1 测试电池模式下的功耗影响
- [ ] 6.5.2 验证节能模式的有效性
- [ ] 6.5.3 对比优化前后的电量消耗

## 7. 文档

### 7.1 用户文档
- [ ] 7.1.1 更新 `README.md`，添加性能优化特性说明
- [ ] 7.1.2 创建性能优化指南（大文件、多窗口最佳实践）
- [ ] 7.1.3 添加故障排查文档（GPU 问题、性能问题）

### 7.2 开发者文档
- [ ] 7.2.1 编写性能优化技术文档
- [ ] 7.2.2 编写性能监控 API 文档
- [ ] 7.2.3 更新架构文档（添加性能层说明）

### 7.3 发布说明
- [ ] 7.3.1 编写 CHANGELOG 条目
- [ ] 7.3.2 准备发布公告（性能提升数据、使用建议）
- [ ] 7.3.3 准备演示视频/截图

## 8. 发布前检查

### 8.1 代码质量
- [ ] 8.1.1 所有 TypeScript 类型检查通过
- [ ] 8.1.2 所有 ESLint 检查通过
- [ ] 8.1.3 代码审查完成

### 8.2 功能验证
- [ ] 8.2.1 所有核心功能正常工作
- [ ] 8.2.2 降级策略正常工作
- [ ] 8.2.3 设置持久化正常
- [ ] 8.2.4 国际化文案正确

### 8.3 性能验证
- [ ] 8.3.1 启动时间未增加（<3s）
- [ ] 8.3.2 内存占用增加在可接受范围（<10%）
- [ ] 8.3.3 目标 FPS 在支持的硬件上达成
- [ ] 8.3.4 大文件性能显著提升

### 8.4 文档完整性
- [ ] 8.4.1 所有用户文档已更新
- [ ] 8.4.2 发布说明已准备
- [ ] 8.4.3 CHANGELOG 已更新

## 9. 发布后监控

### 9.1 用户反馈收集
- [ ] 9.1.1 监控 GitHub Issues（性能问题、兼容性问题）
- [ ] 9.1.2 收集用户性能数据反馈
- [ ] 9.1.3 收集低端设备用户反馈

### 9.2 问题修复
- [ ] 9.2.1 根据反馈修复兼容性问题
- [ ] 9.2.2 优化降级策略阈值
- [ ] 9.2.3 发布热修复版本（如需要）

### 9.3 持续优化
- [ ] 9.3.1 收集性能瓶颈数据
- [ ] 9.3.2 计划下一轮性能优化
- [ ] 9.3.3 探索新的性能优化技术
