# 焦点系统设计文档

## 概述

焦点系统负责管理应用中的视觉焦点状态，为用户提供清晰的交互反馈。系统完全基于**浏览器原生焦点机制**（`:focus`/`:focus-within`），简单可靠。

## 设计原则

1. **原生优先**：使用浏览器原生焦点机制（`:focus`、`:focus-within`）
2. **一致性**：所有可交互元素使用统一的焦点样式变量
3. **可访问性**：支持键盘导航，符合 WCAG 标准
4. **简洁性**：不引入额外的应用状态层，减少复杂度

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         焦点系统架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    浏览器原生焦点                        │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │  • :focus          - 元素获得焦点时                      │    │
│  │  • :focus-within   - 子元素获得焦点时（容器样式）         │    │
│  │  • tabindex="0"    - 使非原生元素可聚焦                  │    │
│  │  • outline/border  - 视觉反馈样式                        │    │
│  └────────────────────────────────────────────────────────┘    │
│                              │                                  │
│                              ▼                                  │
│           ┌──────────────────────────────────┐                 │
│           │         CSS 变量系统              │                 │
│           │    --vscode-focusBorder          │                 │
│           │    (深色: #007fd4 / 浅色: #0e639c)│                 │
│           └──────────────────────────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 核心机制

### 1. tabindex 属性

使非原生可聚焦元素（如 `<div>`）能够接收键盘焦点：

```tsx
<div tabindex="0" onClick={handleClick}>
  可聚焦的元素
</div>
```

- `tabindex="0"`：元素可通过 Tab 键导航
- `tabindex="-1"`：元素可通过 JavaScript 聚焦，但不参与 Tab 导航

### 2. :focus 伪类

当元素直接获得焦点时触发：

```css
.file-item:focus {
  outline: 1px solid var(--vscode-focusBorder, #007fd4);
  outline-offset: -1px;
}
```

### 3. :focus-within 伪类

当容器内任意子元素获得焦点时触发（dockview 使用此机制）：

```css
/* dockview 内置样式 */
.dv-pane-container .dv-pane .dv-pane-body:focus-within:before {
  outline: 1px solid;
  /* ... */
}
```

## CSS 变量

焦点系统使用统一的 CSS 变量，确保主题一致性：

```css
/* theme.css 中定义 */
:root {
  --vscode-focusBorder: #007fd4;  /* 深色主题 */
}

[data-theme="light"] {
  --vscode-focusBorder: #0e639c;  /* 浅色主题 */
}
```

## 实现指南

### 为新组件添加焦点支持

遵循以下三步：

#### 1. 添加 tabindex 使元素可聚焦

```tsx
<div
  class="my-item"
  tabindex="0"
  onClick={handleActivate}
>
  内容
</div>
```

#### 2. 添加键盘事件处理

```tsx
<div
  class="my-item"
  tabindex="0"
  onClick={handleActivate}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  }}
>
  内容
</div>
```

#### 3. 添加 CSS 焦点样式

```css
/* .my-item: 列表项
 * - tabindex="0" 使其可聚焦
 * - 支持键盘导航
 */
.my-item {
  cursor: pointer;
  outline: none;
  transition: background 0.2s, outline 0.1s;
}

/* .my-item:hover: 悬停状态 */
.my-item:hover {
  background: var(--bg-hover);
}

/* .my-item:focus: 焦点状态 */
.my-item:focus {
  outline: 1px solid var(--vscode-focusBorder, #007fd4);
  outline-offset: -1px;
}
```

### 完整示例

```tsx
// MyComponent.tsx
export function MyComponent() {
  const handleActivate = () => {
    // 激活逻辑
  };

  return (
    <div
      class="my-item"
      tabindex="0"
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}
    >
      内容
    </div>
  );
}
```

## 最佳实践

### DO ✅

1. **添加 `tabindex="0"`**：使非原生可聚焦元素可聚焦
2. **支持键盘操作**：Enter/Space 应触发与点击相同的行为
3. **使用统一变量**：`var(--vscode-focusBorder)` 确保主题一致性
4. **添加过渡动画**：`transition: outline 0.1s ease` 提升体验
5. **提供替代焦点样式**：如果移除 outline，必须提供其他视觉反馈

### DON'T ❌

1. **避免 `outline: none` 无替代样式**：影响可访问性
2. **避免硬编码颜色**：应使用 CSS 变量
3. **避免忽略键盘事件**：所有可点击元素应支持键盘

## 组件焦点实现清单

| 组件 | 原生焦点 | 键盘支持 |
|------|----------|----------|
| FileTree 文件项 | ✅ | ✅ |
| FileTree 目录项 | ✅ | ✅ |
| SearchBar 输入框 | ✅ | ✅ |
| SearchBar 结果项 | ✅ | ✅ |
| Settings 下拉框 | ✅ | ✅ |
| Sidebar Card | ✅ (dockview) | ✅ |
| DockLayout Tab | ✅ (dockview) | ✅ |
| ActivityBar 图标 | 待添加 | 待添加 |

## 相关文件

- `src/styles/theme.css` - 焦点颜色变量定义
- `src/components/FileTree.tsx` - 文件树焦点实现示例
- `src/components/FileTree.css` - 焦点样式示例
- `src/components/SearchBar.tsx` - 搜索结果焦点实现
- `src/components/SearchBar.css` - 搜索结果焦点样式
- `node_modules/dockview-core/dist/styles/dockview.css` - dockview 内置焦点样式

## 未来扩展

如果未来需要更复杂的焦点管理（如快捷键区域跳转、焦点历史等），可以考虑：

1. **焦点导航**：支持 Tab/Shift+Tab 在区域间导航
2. **焦点恢复**：切换视图后恢复之前的焦点位置
3. **焦点陷阱**：模态对话框中限制焦点范围
4. **应用层焦点状态**：通过全局状态追踪区域级焦点（仅在需要时添加）
