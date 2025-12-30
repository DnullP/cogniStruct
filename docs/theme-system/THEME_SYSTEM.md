# 统一主题系统 - CogniStruct

## 概述

CogniStruct 实现了一个完整的统一主题系统，支持**深色模式**和**浅色模式**的无缝切换。所有组件使用 CSS 自定义属性（变量）实现主题管理，确保全应用的视觉一致性和易于维护。

## 🎨 主题架构

### 文件结构

```
src/
├── styles/
│   └── theme.css          # 统一的主题变量定义
├── App.tsx                # 应用主组件 - 初始化主题
├── App.css                # 全局样式（导入主题变量）
└── components/
    ├── *.css              # 所有组件使用主题变量
    └── layout/
        └── *.css          # 布局组件使用主题变量
```

### 核心特性

| 功能 | 描述 |
|------|------|
| **CSS 变量系统** | 40+ 个精心设计的主题变量 |
| **双主题支持** | 深色（Abyss）和浅色（Light）模式 |
| **自动切换** | Settings 面板中一键切换主题 |
| **持久化存储** | 用户偏好自动保存到 localStorage |
| **实时更新** | 主题切换即时生效，无需刷新 |
| **VS Code 兼容** | 内置 20+ VS Code 编辑器主题变量 |
| **透明度支持** | RGB 变量支持 rgba() 透明度 |

## 🎯 主题变量

### 颜色变量库

#### 深色主题（默认）

```css
:root {
  /* 背景色 */
  --bg-primary: #1e1e1e;       /* 主编辑区 */
  --bg-secondary: #252526;     /* 侧边栏、工具栏 */
  --bg-tertiary: #3c3c3c;      /* 选中状态、高亮背景 */
  --bg-hover: #404040;         /* 悬停背景 */
  --bg-disabled: #2a2a2a;      /* 禁用状态 */

  /* 文本色 */
  --text-primary: #d4d4d4;     /* 正常文本 */
  --text-secondary: #9a9a9a;   /* 标题、次要信息 */
  --text-tertiary: #6a6a6a;    /* 禁用、最小化文本 */
  --text-inverse: #ffffff;     /* 与背景对比 */

  /* 边框色 */
  --border-color: #3e3e3e;     /* 分隔线、边框 */
  --border-accent: #0e639c;    /* 焦点、选中边框 */
  --border-danger: #d13438;    /* 危险操作边框 */

  /* 强调色 */
  --accent-color: #0e639c;     /* 按钮、链接、焦点 */
  --accent-hover: #1177bb;     /* 悬停状态 */
  --accent-active: #004a7c;    /* 活动状态 */

  /* 状态色 */
  --status-success: #4ec9b0;   /* 成功（绿） */
  --status-warning: #ce9178;   /* 警告（橙） */
  --status-error: #f48771;     /* 错误（红） */
  --status-info: #9cdcfe;      /* 信息（蓝） */
}
```

#### 浅色主题

```css
[data-theme="light"] {
  /* 背景色 */
  --bg-primary: #ffffff;       /* 主编辑区 */
  --bg-secondary: #f3f3f3;     /* 侧边栏、工具栏 */
  --bg-tertiary: #e4e4e4;      /* 选中状态、高亮背景 */
  --bg-hover: #d8d8d8;         /* 悬停背景 */
  --bg-disabled: #efefef;      /* 禁用状态 */

  /* 文本色 */
  --text-primary: #1e1e1e;     /* 正常文本 */
  --text-secondary: #6a6a6a;   /* 标题、次要信息 */
  --text-tertiary: #9a9a9a;    /* 禁用、最小化文本 */
  --text-inverse: #000000;     /* 与背景对比 */

  /* 边框色 */
  --border-color: #d4d4d4;     /* 分隔线、边框 */
  --border-accent: #0e639c;    /* 焦点、选中边框 */
  --border-danger: #d13438;    /* 危险操作边框 */

  /* 强调色 */
  --accent-color: #0e639c;     /* 按钮、链接、焦点 */
  --accent-hover: #1177bb;     /* 悬停状态 */
  --accent-active: #004a7c;    /* 活动状态 */

  /* 状态色 */
  --status-success: #107c10;   /* 成功（绿） */
  --status-warning: #ffb900;   /* 警告（橙） */
  --status-error: #d13438;     /* 错误（红） */
  --status-info: #0078d4;      /* 信息（蓝） */
}
```

### RGB 变量支持

为支持透明度效果，主题系统提供了 RGB 变量：

```css
/* 深色主题 */
--bg-primary-rgb: 30, 30, 30;
--text-primary-rgb: 212, 212, 212;
--border-color-rgb: 62, 62, 62;
--accent-color-rgb: 14, 99, 156;
--status-error-rgb: 244, 135, 113;

/* 使用 RGB 变量 */
background: rgba(var(--bg-primary-rgb), 0.5);  /* 50% 透明背景 */
box-shadow: 0 0 4px rgba(var(--accent-color-rgb), 0.3);  /* 蓝色光晕 */
```

## 🔧 使用方法

### 在 CSS 中使用主题变量

```css
/* ✅ 推荐做法 */
.my-component {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

/* 带透明度的颜色 */
.my-button:hover {
  background: rgba(var(--accent-color-rgb), 0.1);
  box-shadow: 0 0 4px rgba(var(--accent-color-rgb), 0.3);
}

/* ❌ 避免硬编码颜色 */
.bad-component {
  background-color: #1e1e1e;  /* 不推荐 */
  color: #d4d4d4;             /* 不推荐 */
}
```

### 在 React/Solid-JS 中切换主题

```typescript
import { settingsStore } from './stores/settingsStore';

// 获取当前主题
const currentTheme = settingsStore.theme();

// 切换到浅色主题
settingsStore.setTheme('light');

// 切换到深色主题
settingsStore.setTheme('dark');

// 在组件中使用（Solid-JS）
import { createEffect } from 'solid-js';

export function MyComponent() {
  createEffect(() => {
    const currentTheme = settingsStore.theme();
    console.log(`现在使用 ${currentTheme} 主题`);
  });

  return <div>主题感知组件</div>;
}
```

## 🔄 主题切换流程

```
┌─────────────────────┐
│   Settings 面板      │  用户点击主题选择器
│  (Settings.tsx)     │
└────────┬────────────┘
         │ handleThemeChange()
         ▼
┌─────────────────────┐
│ settingsStore       │  修改 theme 信号
│ .setTheme(theme)    │
└────────┬────────────┘
         │
         ├─ setThemeInternal(t)     设置信号值
         ├─ applyTheme(t)            应用 DOM 属性
         │  document.documentElement
         │  .setAttribute('data-theme', t)
         └─ saveSettings()           保存到 localStorage
              │
              ▼
         ┌─────────────────────┐
         │  CSS 级联更新        │
         │  :root →            │
         │  [data-theme="light"]│
         │  所有变量值切换      │
         └─────────────────────┘
              │
              ▼
         ┌─────────────────────┐
         │  所有组件立即更新    │
         │  （使用 CSS 变量）   │
         └─────────────────────┘
```

## 📱 组件集成

### 所有已转换的组件

#### 核心组件

| 组件 | 文件 | 转换状态 | 变量数量 |
|------|------|--------|---------|
| GraphView | `components/GraphView.css` | ✅ 完成 | 8 个颜色 |
| FileTree | `components/FileTree.css` | ✅ 完成 | 7 个颜色 |
| SearchBar | `components/SearchBar.css` | ✅ 完成 | 7 个颜色 |
| Editor | `components/Editor.css` | ✅ 完成 | 7 个颜色 |
| Settings | `components/Settings.css` | ✅ 完成 | 7 个颜色 |
| MainLayout | `components/MainLayout.css` | ✅ 完成 | 7 个颜色 |

#### 布局组件

| 组件 | 文件 | 转换状态 | 变量数量 |
|------|------|--------|---------|
| AppLayout | `components/layout/AppLayout.css` | ✅ 完成 | 7 个颜色 |
| Sidebar | `components/layout/Sidebar.css` | ✅ 完成 | 7 个颜色 |
| DockLayout | `components/layout/DockLayout.css` | ✅ 完成 | 7 个颜色 |

### 集成示例

```css
/* src/components/MyComponent.css */

/* 导入主题变量（已在 App.css 中全局导入） */

.my-container {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.my-button {
  background: var(--accent-color);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.my-button:hover {
  background: var(--accent-hover);
}

.my-button:active {
  background: var(--accent-active);
}

.my-error-text {
  color: var(--status-error);
}

.my-success-text {
  color: var(--status-success);
}
```

## 🔍 VS Code 兼容变量

主题系统包含 20+ 个 VS Code 编辑器主题变量，用于与 dockview/paneview 等编辑器组件库的兼容：

```css
--vscode-editor-background       编辑器背景
--vscode-editor-foreground       编辑器文本颜色
--vscode-sideBar-background      侧边栏背景
--vscode-sideBar-foreground      侧边栏文本
--vscode-sideBar-border          侧边栏边框
--vscode-activityBar-background  活动栏背景
--vscode-statusBar-background    状态栏背景
--vscode-statusBar-foreground    状态栏文本
--vscode-focusBorder             焦点边框
--vscode-scrollbarSlider-background      滚动条背景
--vscode-scrollbarSlider-hoverBackground 滚动条悬停
```

## 📋 检查清单

### 集成新组件时

- [ ] 在组件 CSS 文件中使用主题变量而非硬编码颜色
- [ ] 使用 `var(--bg-primary)` 等标准变量名
- [ ] 对于透明度效果，使用 RGB 变量：`rgba(var(--accent-color-rgb), 0.5)`
- [ ] 测试深色和浅色主题下的外观
- [ ] 验证文本对比度符合可访问性标准（WCAG 2.0 Level AA）

### 添加新的主题变量时

- [ ] 在 `src/styles/theme.css` 中同时定义深色和浅色模式的值
- [ ] 如果需要透明度支持，添加对应的 RGB 变量
- [ ] 使用统一的命名约定：`--<category>-<purpose>[-<state>]`
- [ ] 在文件注释中记录用途和使用场景

## 🎓 最佳实践

### 1. 变量命名约定

```css
/* ✅ 推荐 */
--bg-primary           主背景色
--text-secondary       次要文本
--border-accent        强调边框
--status-error         错误状态
--accent-hover         强调色悬停

/* ❌ 避免 */
--dark-bg              不够具体
--text-color           冗余
--blue-button          不足够通用
--color1, --color2     无意义命名
```

### 2. 颜色对比度

确保文本和背景的颜色对比度符合 WCAG 2.0 标准：

- **大文本**（18px+）：最小 3:1 对比度
- **正常文本**（<18px）：最小 4.5:1 对比度
- **UI 组件边框**：最小 3:1 对比度

### 3. 性能考虑

CSS 变量的性能影响很小，但以下做法可以优化：

```css
/* ✅ 优化：复用变量 */
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

/* ❌ 避免：过度重复 */
.card {
  background: var(--bg-secondary);
}
.card:hover {
  background: var(--bg-secondary);  /* 不必要的重复 */
}
```

### 4. 浏览器兼容性

CSS 变量支持情况：
- ✅ Chrome 49+
- ✅ Firefox 31+
- ✅ Safari 9.1+
- ✅ Edge 15+
- ⚠️ IE 11（不支持）

## 📊 系统指标

### 主题变量统计

| 类别 | 数量 | 说明 |
|------|------|------|
| 背景色 | 5 个 | primary, secondary, tertiary, hover, disabled |
| 文本色 | 4 个 | primary, secondary, tertiary, inverse |
| 边框色 | 3 个 | 主边框、强调边框、危险边框 |
| 强调色 | 3 个 | default, hover, active |
| 状态色 | 4 个 | success, warning, error, info |
| RGB 变量 | 5 个 | 用于 rgba() 透明度 |
| VS Code 变量 | 20+ 个 | 编辑器兼容 |
| **总计** | **45+** | 完整主题系统 |

### 覆盖范围

- ✅ 11 个 CSS 文件
- ✅ 15+ 个 React/Solid-JS 组件
- ✅ 70+ 个硬编码颜色值已转换为变量
- ✅ 100% CSS 变量覆盖率

## 🔗 相关文件

- [theme.css](../src/styles/theme.css) - 主题变量定义
- [App.tsx](../src/App.tsx) - 主题初始化
- [settingsStore.ts](../src/stores/settingsStore.ts) - 主题状态管理
- [Settings.tsx](../src/components/Settings.tsx) - 主题切换 UI
- [SPEC-FRONTEND.md](./SPEC-FRONTEND.md) - 前端规范

## 🤝 贡献指南

如需修改或扩展主题系统：

1. **修改颜色值**：编辑 `src/styles/theme.css`
2. **添加新变量**：同时更新深色和浅色模式部分
3. **测试主题**：使用 Settings 面板验证两种模式
4. **更新文档**：在本文件中记录新增变量

## 🐛 故障排除

### 问题：主题不能切换

**检查清单：**
- [ ] `settingsStore.applyTheme()` 是否在 `App.tsx` 的 `onMount` 中调用
- [ ] `data-theme` 属性是否正确设置在 `document.documentElement`
- [ ] `theme.css` 是否在 `App.css` 中导入
- [ ] 浏览器是否支持 CSS 变量（检查开发者工具）

### 问题：某些组件颜色不随主题变化

**解决步骤：**
1. 检查该组件的 CSS 文件是否使用 `var(--*)` 语法
2. 确认 CSS 文件是否导入或继承了主题变量
3. 检查是否有内联样式覆盖了 CSS 类
4. 查看浏览器开发者工具的"元素检查"，确认计算样式使用了变量

### 问题：新增的颜色值在浅色主题中不显示

**原因分析：**
- 浅色主题 `[data-theme="light"]` 中未定义该变量
- 需要同时更新深色和浅色主题部分

## 📚 参考资源

- [MDN - CSS 变量](https://developer.mozilla.org/zh-CN/docs/Web/CSS/--*)
- [WCAG 2.0 色彩对比度检查](https://webaim.org/resources/contrastchecker/)
- [VS Code 主题 API](https://code.visualstudio.com/api/references/theme-color)
- [设计系统最佳实践](https://spectrum.adobe.com/page/design-tokens/)

---

**最后更新**：2024 年
**维护人**：CogniStruct 开发团队
**版本**：1.0.0
