# 编辑器渲染性能规范 (Editor Performance Specification)

本规范定义了若爱编辑器的渲染性能要求，包括 GPU 硬件加速、高帧率渲染、性能监控和自适应降级等核心能力。

## ADDED Requirements

### Requirement: GPU 硬件加速

系统 **SHALL** 启用 GPU 硬件加速以提升编辑器渲染性能，包括 Tauri 窗口层和 Monaco Editor 渲染层的 GPU 加速。

#### Scenario: Tauri 窗口启用 GPU 加速
- **WHEN** 应用程序启动
- **THEN** Tauri 窗口配置中 `hardwareAcceleration` 设置为 `true`
- **AND** 窗口渲染使用系统 GPU 而非 CPU 软件渲染

#### Scenario: Monaco Editor 启用 Canvas GPU 渲染
- **WHEN** Monaco Editor 初始化
- **THEN** 编辑器选项中启用 GPU 友好特性：
  - `smoothScrolling` 设置为 `true`
  - `cursorSmoothCaretAnimation` 设置为 `'on'`
- **AND** 编辑器使用 Canvas 硬件加速渲染文本和装饰

#### Scenario: GPU 不可用时自动降级
- **WHEN** 系统检测到 GPU 不可用或 WebGL 初始化失败
- **THEN** 系统自动降级至 CPU 软件渲染
- **AND** 在设置中显示提示信息："GPU 加速不可用，已降级至软件渲染"
- **AND** 编辑器仍能正常工作，但性能可能降低

### Requirement: 高刷新率渲染支持

系统 **SHALL** 支持高刷新率显示器（120Hz/144Hz），并在关键交互操作中达到显示器最高刷新率。

#### Scenario: 自动检测显示器刷新率
- **WHEN** 应用程序启动
- **THEN** 系统通过 Tauri 命令 `get_display_refresh_rate()` 检测主显示器刷新率
- **AND** 系统根据检测结果设置目标帧率（60/120/144 FPS）

#### Scenario: 滚动操作达到 120 FPS
- **GIVEN** 用户显示器支持 120Hz 刷新率
- **WHEN** 用户在编辑器中滚动
- **THEN** 滚动动画帧率达到或接近 120 FPS
- **AND** 滚动过程流畅无明显卡顿

#### Scenario: 光标移动和闪烁达到 120 FPS
- **GIVEN** 用户显示器支持 120Hz 刷新率
- **WHEN** 用户移动光标或光标闪烁
- **THEN** 光标动画帧率达到或接近 120 FPS
- **AND** 光标移动轨迹连续流畅

#### Scenario: 文本输入渲染达到 120 FPS
- **GIVEN** 用户显示器支持 120Hz 刷新率
- **WHEN** 用户快速输入文本
- **THEN** 文本渲染帧率达到或接近 120 FPS
- **AND** 输入响应延迟 <8ms（1000ms/120fps）

#### Scenario: 60Hz 显示器回退至 60 FPS
- **GIVEN** 用户显示器仅支持 60Hz 刷新率
- **WHEN** 系统检测到显示器刷新率为 60Hz
- **THEN** 系统将目标帧率设置为 60 FPS
- **AND** 编辑器渲染性能仍然流畅

### Requirement: 帧率调度与优先级管理

系统 **SHALL** 实现帧率调度器，根据操作优先级分配渲染资源，确保关键交互的高帧率。

#### Scenario: 高优先级操作立即执行
- **WHEN** 用户执行高优先级操作（文本输入、光标移动、滚动）
- **THEN** 系统通过 `requestAnimationFrame()` 立即调度渲染
- **AND** 渲染延迟 <16ms（60 FPS）或 <8ms（120 FPS）

#### Scenario: 低优先级操作延迟执行
- **WHEN** 系统执行低优先级操作（语法高亮更新、装饰渲染）
- **THEN** 系统通过 `requestIdleCallback()` 在浏览器空闲时执行
- **AND** 不阻塞高优先级操作的渲染

#### Scenario: 优先级队列管理
- **WHEN** 多个渲染任务同时排队
- **THEN** 系统按优先级顺序执行：高优先级 > 普通优先级 > 低优先级
- **AND** 高优先级任务始终优先获得渲染时间片

### Requirement: 大文件性能优化

系统 **SHALL** 针对大文件（>10MB）提供专门的性能优化配置，确保编辑流畅。

#### Scenario: 自动检测大文件
- **WHEN** 用户打开文件大小 >10MB 的文件
- **THEN** 系统自动检测并标记为大文件
- **AND** 应用大文件专用优化配置

#### Scenario: 大文件限制 Token 化
- **WHEN** 大文件被打开
- **THEN** Monaco Editor 配置 `tokenizationLimit` 设置为 5000 行
- **AND** `maxTokenizationLineLength` 设置为 1000 字符
- **AND** 超过限制的部分不进行语法高亮，保持纯文本显示

#### Scenario: 大文件关闭验证装饰
- **WHEN** 大文件被打开
- **THEN** Monaco Editor 配置 `renderValidationDecorations` 设置为 `'off'`
- **AND** 不显示语法错误、警告等验证装饰，减少渲染开销

#### Scenario: 大文件延迟语法高亮
- **WHEN** 用户在大文件中编辑
- **THEN** 语法高亮更新延迟 500ms（通过 debounce）
- **AND** 避免每次按键都触发全文件高亮计算

#### Scenario: 大文件虚拟滚动优化
- **WHEN** 用户在大文件中滚动
- **THEN** Monaco Editor 仅渲染可见区域及前后缓冲区
- **AND** 不渲染不可见的行，节省渲染资源

### Requirement: 性能自适应降级

系统 **SHALL** 实时监控渲染性能，根据实际帧率自动降级配置，保证稳定性。

#### Scenario: 实时监控 FPS
- **WHEN** 编辑器运行时
- **THEN** 系统每秒计算平均 FPS
- **AND** 保留最近 60 帧的 FPS 历史数据

#### Scenario: 轻度卡顿降级
- **WHEN** 平均 FPS < 100（目标 120 FPS）持续 3 秒
- **THEN** 系统关闭非必要动画效果（如装饰动画）
- **AND** 在性能监控面板显示"性能降级：轻度"

#### Scenario: 中度卡顿降级
- **WHEN** 平均 FPS < 50 持续 3 秒
- **THEN** 系统将目标帧率降至 60 FPS
- **AND** 简化渲染配置（关闭平滑滚动等）
- **AND** 在性能监控面板显示"性能降级：中度"

#### Scenario: 重度卡顿降级
- **WHEN** 平均 FPS < 30 持续 3 秒
- **THEN** 系统关闭所有动画效果
- **AND** 采用最小化渲染配置
- **AND** 在性能监控面板显示"性能降级：重度"
- **AND** 显示用户提示："检测到性能问题，已自动降级配置"

#### Scenario: 性能改善自动恢复
- **WHEN** 平均 FPS 恢复至目标帧率的 90% 以上持续 5 秒
- **THEN** 系统逐步恢复之前的优化配置
- **AND** 在性能监控面板显示"性能已恢复"

### Requirement: 多窗口/分屏渲染优化

系统 **SHALL** 优化多窗口和分屏场景的渲染性能，避免相互阻塞。

#### Scenario: 独立渲染管线
- **WHEN** 用户打开多个编辑器窗格（分屏）
- **THEN** 每个窗格拥有独立的 Monaco Editor 实例
- **AND** 每个窗格的渲染互不阻塞

#### Scenario: 共享 GPU 资源池
- **WHEN** 多个编辑器窗格同时渲染
- **THEN** 系统共享 WebGL 上下文和纹理缓存
- **AND** 避免重复加载字体和纹理资源

#### Scenario: 分屏拖拽流畅动画
- **WHEN** 用户拖拽调整分屏比例
- **THEN** 拖拽动画帧率达到 60 FPS 或更高
- **AND** 窗格大小调整过程流畅无卡顿

#### Scenario: 4 窗格分屏性能测试
- **WHEN** 用户同时打开 4 个编辑器窗格
- **THEN** 每个窗格的文本输入延迟 <16ms
- **AND** 滚动操作帧率 ≥60 FPS
- **AND** 总内存增加 <200MB

### Requirement: GPU 性能等级检测

系统 **SHALL** 在启动时检测 GPU 性能等级，并根据等级选择默认性能配置。

#### Scenario: 检测高性能 GPU
- **WHEN** 系统检测到独立显卡（NVIDIA/AMD 中高端型号）
- **THEN** GPU 性能等级标记为 `high`
- **AND** 默认启用所有性能优化特性
- **AND** 目标帧率设置为 120 FPS（如显示器支持）

#### Scenario: 检测中等性能 GPU
- **WHEN** 系统检测到集成显卡（Intel Iris Xe、AMD Vega 等）
- **THEN** GPU 性能等级标记为 `medium`
- **AND** 启用部分性能优化特性
- **AND** 目标帧率设置为 60 FPS

#### Scenario: 检测低性能 GPU
- **WHEN** 系统检测到老旧集成显卡或 GPU 基准测试得分低
- **THEN** GPU 性能等级标记为 `low`
- **AND** 禁用大部分动画效果
- **AND** 目标帧率设置为 60 FPS
- **AND** 启用节能模式配置

#### Scenario: GPU 不可用
- **WHEN** 系统无法检测到 GPU 或 WebGL 不可用
- **THEN** GPU 性能等级标记为 `none`
- **AND** 完全禁用 GPU 加速
- **AND** 使用 CPU 软件渲染
- **AND** 显示提示："GPU 不可用，性能可能受限"

### Requirement: 电池模式性能调整

系统 **SHALL** 检测设备电池状态，在电池模式下自动降低性能档位以节省电量。

#### Scenario: 检测电池供电模式
- **WHEN** 系统启动或电源状态改变
- **THEN** 系统通过 Tauri 命令 `is_on_battery()` 检测电池状态
- **AND** 如果设备正在使用电池供电，标记为电池模式

#### Scenario: 电池模式自动降低帧率
- **WHEN** 系统检测到电池模式
- **AND** 用户设置中未启用"电池模式高性能"选项
- **THEN** 系统将目标帧率降至 60 FPS
- **AND** 在状态栏显示电池图标和"节能模式"标识

#### Scenario: 电池模式禁用非必要动画
- **WHEN** 系统处于电池模式
- **THEN** 系统禁用非必要的视觉效果：
  - 关闭光标平滑动画
  - 关闭平滑滚动
  - 减少装饰渲染频率

#### Scenario: 接入电源恢复性能
- **WHEN** 系统从电池模式切换至电源供电
- **THEN** 系统恢复之前的性能配置
- **AND** 移除"节能模式"标识

### Requirement: 性能监控面板

系统 **SHALL** 提供可选的性能监控面板，实时显示 FPS、GPU 内存和渲染耗时等指标。

#### Scenario: 通过设置开启性能监控
- **WHEN** 用户在设置中启用"显示性能监控"选项
- **THEN** 编辑器右下角显示半透明的性能监控面板
- **AND** 面板显示当前 FPS、平均 FPS、GPU 内存使用

#### Scenario: 通过快捷键切换性能监控
- **WHEN** 用户按下 `Cmd/Ctrl + Shift + P`
- **THEN** 性能监控面板切换显示/隐藏状态
- **AND** 状态同步到设置存储

#### Scenario: FPS 实时显示
- **WHEN** 性能监控面板可见
- **THEN** 面板每秒更新当前 FPS 值
- **AND** 显示最近 60 帧的 FPS 迷你图表
- **AND** 如果 FPS < 目标帧率 80%，以红色高亮显示

#### Scenario: GPU 内存显示
- **WHEN** 性能监控面板可见
- **AND** WebGL 可用
- **THEN** 面板显示 GPU 内存使用情况（已用/总计）
- **AND** 如果内存使用 >80%，以黄色警告显示

#### Scenario: 渲染耗时显示
- **WHEN** 性能监控面板可见
- **THEN** 面板显示平均帧时间（ms）
- **AND** 显示最近 60 帧的帧时间图表
- **AND** 如果帧时间 >16ms（60 FPS）或 >8ms（120 FPS），以红色高亮

#### Scenario: 性能监控面板拖拽
- **WHEN** 用户拖拽性能监控面板
- **THEN** 面板可以移动到编辑器的四个角落
- **AND** 面板位置保存到本地存储

#### Scenario: 性能监控面板折叠
- **WHEN** 用户点击性能监控面板的折叠按钮
- **THEN** 面板折叠为仅显示 FPS 的小图标
- **AND** 鼠标悬停时展开完整面板

### Requirement: 性能设置配置

系统 **SHALL** 在设置界面提供性能相关配置选项，允许用户自定义性能行为。

#### Scenario: 性能模式选择
- **WHEN** 用户在设置中选择性能模式
- **THEN** 提供以下选项：
  - **自动**（默认）：根据 GPU 性能自动调整
  - **高性能**：启用所有优化，目标 120 FPS
  - **均衡**：平衡性能和功耗，目标 60 FPS
  - **节能**：最小化 GPU 使用，禁用动画
- **AND** 选择后立即应用到编辑器配置

#### Scenario: 目标帧率配置
- **WHEN** 用户在设置中配置目标帧率
- **THEN** 提供选项：60 FPS / 120 FPS / 144 FPS
- **AND** 如果用户选择高于显示器刷新率的值，显示警告："您的显示器刷新率为 {detected}Hz"

#### Scenario: GPU 加速手动开关
- **WHEN** 用户在设置中切换"启用 GPU 加速"开关
- **THEN** 系统立即应用或禁用 GPU 加速特性
- **AND** 如果禁用 GPU 加速，显示提示："禁用后性能可能显著下降"

#### Scenario: 自动降级开关
- **WHEN** 用户在设置中切换"启用自动性能降级"开关
- **THEN** 系统启用或禁用实时性能监控和自动降级逻辑
- **AND** 如果禁用自动降级，在低性能场景可能出现卡顿

#### Scenario: 电池模式高性能开关
- **WHEN** 用户在设置中启用"电池模式启用高性能"
- **THEN** 即使在电池供电时，系统仍保持高性能配置
- **AND** 显示警告："启用后会显著增加电量消耗"

#### Scenario: 重置性能设置
- **WHEN** 用户点击"重置为默认"按钮
- **THEN** 所有性能设置恢复为默认值：
  - 性能模式：自动
  - 启用 GPU 加速：是
  - 启用自动降级：是
  - 显示性能监控：否
- **AND** 显示确认提示："已恢复默认性能设置"

### Requirement: 性能基准测试

系统 **SHALL** 在优化前后进行性能基准测试，验证优化效果。

#### Scenario: 启动时间基准
- **GIVEN** 性能优化已实施
- **WHEN** 测量应用冷启动时间
- **THEN** 启动时间不超过 3 秒（与优化前一致）
- **AND** 记录基准数据供回归测试使用

#### Scenario: 文本输入延迟基准
- **GIVEN** 性能优化已实施
- **WHEN** 测量快速输入时的渲染延迟
- **THEN** 在 60 FPS 模式下延迟 <16ms
- **AND** 在 120 FPS 模式下延迟 <8ms

#### Scenario: 大文件滚动帧率基准
- **GIVEN** 性能优化已实施
- **AND** 打开一个 >10MB 的文件
- **WHEN** 用户快速滚动
- **THEN** 滚动过程平均帧率 ≥60 FPS
- **AND** 无明显掉帧或卡顿

#### Scenario: 多窗口分屏性能基准
- **GIVEN** 性能优化已实施
- **AND** 打开 4 个编辑器窗格
- **WHEN** 在任意窗格中编辑和滚动
- **THEN** 每个窗格的操作响应时间 <100ms
- **AND** 总体帧率 ≥60 FPS

#### Scenario: 内存占用基准
- **GIVEN** 性能优化已实施
- **WHEN** 测量编辑器运行时内存占用
- **THEN** 单文件编辑内存增加 <50MB（相比优化前）
- **AND** 4 窗格分屏内存增加 <200MB（相比优化前）

#### Scenario: 语法高亮性能基准
- **GIVEN** 性能优化已实施
- **AND** 打开一个复杂的 TypeScript 文件（>1000 行）
- **WHEN** 编辑器进行语法高亮
- **THEN** 高亮计算时间 <500ms
- **AND** 不阻塞用户输入操作
