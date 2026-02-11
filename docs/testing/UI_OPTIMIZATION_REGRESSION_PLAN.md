# 🏆 UI 工业级优化回归测试基线方案 (Structural & Interaction Baseline)

> **方案编号**: TEST-UI-OPT-001
> **关联提案**: [UI_OPTIMIZATION_AI_SIDEBAR.md](../proposals/UI_OPTIMIZATION_AI_SIDEBAR.md)
> **测试准则**: [IfAI 高保真 E2E 测试架构指南](./HIGH_FIDELITY_E2E_GUIDE.md)

---

## 1. 核心测试哲学：物理结构验证 (Physical Proof)

由于本次重构涉及 Activity Bar 从“标准 CSS 布局块”向“悬浮胶囊组件”的转变，传统的 `toBeVisible()` 断言已不足以验证其工业级精度。基线必须验证其**物理属性**（坐标、间距、Z轴深度）。

## 2. 核心验证矩阵 (Verification Matrix)

### A. 结构基线 (Structural Baseline)
| 模块 | 验证点 | 物理期望值 | 断言方式 |
|------|------|----------|---------|
| **Activity Bar** | 容器形态 | 非 100% 高度，具备 `border-radius` | `boundingBox().height < viewport.height` |
| **Activity Bar** | 负空间 | 距离左侧边缘 8px，距离编辑器 8px | `boundingBox().x === 8` |
| **AI Sidebar** | Header 压缩 | 总高度 ≤ 68px | `locator('header').boundingBox().height` |
| **材质系统** | 毛玻璃 | 存在 `backdrop-filter: blur` 样式 | `getComputedStyle(el).backdropFilter` |

### B. 交互基线 (Interaction Baseline)
| 动作 | 预期行为 | 状态同步 | 物理反馈 |
|------|---------|---------|---------|
| **Cmd+F** | 搜索栏 Slide-down | `chatUIStore.isSearchVisible === true` | `SearchPanel` 顶部偏移量物理增加 |
| **Tab 切换** | 胶囊背景包裹动画 | `layoutStore.activeTab` 更新 | `motion.div` (Active Pill) 坐标物理位移 |
| **模型选择** | 胶囊面板唤起 | 发出 `ai_model_panel_open` 事件 | 浮动面板 Z-Index > 500 |

## 3. 物理级回归脚本范式

我们将采用以下“物理注入”方式编写回归用例：

```typescript
// tests/e2e/ui/UI_OPTIMIZATION_REGRESSION.spec.ts

test('Activity Bar should maintain capsule structure and negative space', async ({ page }) => {
  const activityBar = page.locator('[data-testid="activity-bar-capsule"]');
  const box = await activityBar.boundingBox();
  
  // 1. 验证悬浮物理特性 (x=8px 为工业级标准)
  expect(box?.x).toBe(8);
  
  // 2. 验证材质属性
  const blur = await activityBar.evaluate(el => window.getComputedStyle(el).backdropFilter);
  expect(blur).toContain('blur(16px)');
  
  // 3. 验证选中态物理包裹 (Active Pill)
  await page.click('[data-tab="search"]');
  const pill = page.locator('[data-testid="tab-active-pill"]');
  await expect(pill).toBeVisible();
  // 物理检测 Pill 是否包裹了 Search 图标
});
```

## 4. 环境自愈与持久化验证 (Persistence)

重构后的 UI 必须能够经受住 **Reload (重启)** 的考验。
- **验证流**：
    1.  物理切换至“紧凑模式”。
    2.  `page.reload()`。
    3.  `waitForFunction` 验证 `layoutStore` 恢复为“紧凑模式”。
    4.  物理断言 Header 高度依然为 32px。

## 5. 验收红线 (The "Red Line" Criteria)

- [ ] **无抖动 (Zero Jitter)**：侧边栏展开/收起时，编辑器层不得出现超过 1px 的闪烁或跳动。
- [ ] **无穿透 (Click Safe)**：在 Activity Bar 的 8px 负空间点击，必须能穿透至编辑器或底层，不得有幽灵遮罩拦截。
- [ ] **高密度 (High Density)**：在 1080p 屏幕下，侧边栏 Thread 列表必须能比旧版多展示至少 2 个完整条目。

---
*IfAI Quality Assurance - v0.3.6 Industrial Refinement*
