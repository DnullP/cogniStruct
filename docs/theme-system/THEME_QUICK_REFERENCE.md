# 主题系统 - 快速参考

## 🚀 30 秒快速开始

### 在组件中使用主题颜色

```css
/* src/components/MyComponent.css */

.button {
  background: var(--accent-color);      /* 强调色 */
  color: white;
  border: 1px solid var(--border-color); /* 边框 */
}

.card {
  background: var(--bg-primary);        /* 主背景 */
  color: var(--text-primary);            /* 主文本 */
}

.error-text {
  color: var(--status-error);           /* 错误红 */
}

.success-text {
  color: var(--status-success);         /* 成功绿 */
}
```

### 切换主题

```typescript
import { settingsStore } from './stores/settingsStore';

// 切换主题
settingsStore.setTheme('light');  // 浅色
settingsStore.setTheme('dark');   // 深色

// 获取当前主题
const current = settingsStore.theme();
```

---

## 📋 完整变量列表

### 背景色（5 个）

```css
--bg-primary      主背景（编辑区）
--bg-secondary    次级背景（侧边栏）
--bg-tertiary     三级背景（选中、高亮）
--bg-hover        悬停背景
--bg-disabled     禁用背景
```

### 文本色（4 个）

```css
--text-primary    正常文本
--text-secondary  次要文本（标题）
--text-tertiary   禁用文本
--text-inverse    反色文本（与背景对比）
```

### 边框色（3 个）

```css
--border-color    标准边框
--border-accent   焦点边框
--border-danger   危险边框
```

### 强调色（3 个）

```css
--accent-color    主强调色（按钮、链接）
--accent-hover    悬停状态
--accent-active   活动状态
```

### 状态色（4 个）

```css
--status-success  成功（绿）
--status-warning  警告（橙）
--status-error    错误（红）
--status-info     信息（蓝）
```

### RGB 变量（5 个）

```css
--bg-primary-rgb        用于 rgba()
--text-primary-rgb      用于 rgba()
--border-color-rgb      用于 rgba()
--accent-color-rgb      用于 rgba()
--status-error-rgb      用于 rgba()

/* 使用示例 */
background: rgba(var(--accent-color-rgb), 0.1);
box-shadow: 0 0 4px rgba(var(--accent-color-rgb), 0.3);
```

---

## 🎨 深色主题配色

```
背景：#1e1e1e → #252526 → #3c3c3c
文本：#d4d4d4（正常）→ #9a9a9a（次要）
边框：#3e3e3e
强调：#0e639c（蓝）→ #1177bb（悬停）
错误：#f48771（红）
成功：#4ec9b0（青）
警告：#ce9178（橙）
```

---

## 🎨 浅色主题配色

```
背景：#ffffff → #f3f3f3 → #e4e4e4
文本：#1e1e1e（正常）→ #6a6a6a（次要）
边框：#d4d4d4
强调：#0e639c（蓝）→ #1177bb（悬停）
错误：#d13438（红）
成功：#107c10（绿）
警告：#ffb900（黄）
```

---

## ✅ 检查清单

### 新增组件时

- [ ] 使用 `var(--*)` 而非硬编码颜色
- [ ] 在两种主题下测试外观
- [ ] 验证文本对比度 ≥4.5:1
- [ ] 检查边框和分隔线清晰度

### 修改颜色时

- [ ] 修改 `src/styles/theme.css`
- [ ] 同时更新深色和浅色模式
- [ ] 测试两种主题
- [ ] 更新文档（如需）

### 常见问题

| 问题 | 解决方案 |
|------|--------|
| 颜色不随主题变化 | 检查是否使用 `var(--*)`，而非硬编码值 |
| 浅色主题中看不清 | 检查是否在 `[data-theme="light"]` 中定义了变量 |
| 透明度效果不工作 | 使用 RGB 变量：`rgba(var(--*-rgb), alpha)` |
| 主题不保存 | 检查浏览器 localStorage 是否被禁用 |

---

## 📁 文件位置

```
src/
├── styles/theme.css              ← 主题变量（修改这里）
├── App.css                        ← 导入主题
└── components/
    ├── *.css                      ← 使用主题变量
    └── layout/
        └── *.css                  ← 使用主题变量

docs/
├── THEME_SYSTEM.md               ← 完整指南
├── IMPLEMENTATION_SUMMARY.md     ← 技术细节
└── ACCEPTANCE_REPORT.md          ← 验收报告
```

---

## 🔗 相关链接

- [完整使用指南](./THEME_SYSTEM.md)
- [实现总结](./IMPLEMENTATION_SUMMARY.md)
- [验收报告](./ACCEPTANCE_REPORT.md)
- [settingsStore.ts](../src/stores/settingsStore.ts) - 主题管理代码
- [Settings.tsx](../src/components/Settings.tsx) - 主题切换 UI

---

## 💡 最佳实践

### ✅ 推荐做法

```css
/* 使用语义化的变量名 */
.button {
  background: var(--accent-color);
  color: white;
  border: 1px solid var(--border-accent);
}

/* 对于透明度，使用 RGB 变量 */
.hover-effect {
  background: rgba(var(--accent-color-rgb), 0.1);
}

/* 相关状态使用对应状态变量 */
.error { color: var(--status-error); }
.success { color: var(--status-success); }
```

### ❌ 避免做法

```css
/* 不要硬编码颜色 */
.button {
  background: #0e639c;  /* ❌ 不推荐 */
}

/* 不要使用通用名称 */
.text {
  color: var(--color);  /* ❌ 过于通用 */
}

/* 不要为每个组件创建变量 */
--button-color: #0e639c;  /* ❌ 重复定义 */
```

---

## 📞 支持

遇到问题？

1. 查看 [完整使用指南](./THEME_SYSTEM.md)
2. 检查代码注释
3. 浏览 [实现总结](./IMPLEMENTATION_SUMMARY.md)

---

**版本**: 1.0.0  
**最后更新**: 2024 年

