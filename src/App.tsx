/**
 * @fileoverview 应用程序根组件
 *
 * 本模块是 CogniStruct 应用的入口组件，负责：
 * - 初始化主题设置
 * - 渲染主布局组件
 *
 * @module App
 *
 * @example
 * ```tsx
 * import App from './App';
 *
 * render(() => <App />, document.getElementById('root'));
 * ```
 */

import { onMount } from 'solid-js';
import { settingsStore } from './stores/settingsStore';
import { MainLayout } from './components/MainLayout';
/* 样式：App.css - 全局样式和主题变量 */
import './App.css';

/**
 * 应用程序根组件
 *
 * 在挂载时应用主题设置，并渲染主布局
 *
 * @returns 主布局组件
 */
function App() {
  // 挂载时应用主题
  onMount(() => {
    settingsStore.applyTheme();
  });

  return <MainLayout />;
}

export default App;