/**
 * @fileoverview 设置面板组件
 *
 * 本模块提供应用设置的用户界面，包括主题切换和图谱物理/样式参数调整。
 *
 * @module components/Settings
 *
 * @features
 * - 主题切换（深色/浅色）
 * - 图谱物理参数调整（引力、斥力、弹力等）
 * - 图谱样式调整（节点大小、边宽度、箭头等）
 * - 设置重置功能
 *
 * @example
 * ```tsx
 * import { Settings } from './components/Settings';
 *
 * // 组件根据 settingsStore.settingsOpen() 状态自动显示/隐藏
 * <Settings />
 * ```
 *
 * @exports Settings - 设置面板组件
 */

import { Show } from 'solid-js';
import { settingsStore } from '../stores/settingsStore';
/* 样式：Settings.css - 设置面板模态框和表单控件样式 */
import './Settings.css';

/**
 * 设置面板组件
 *
 * 模态对话框形式的设置界面，包含：
 * - 主题设置
 * - 图谱物理模拟参数
 * - 图谱视觉样式参数
 * - 重置按钮
 *
 * @returns 设置面板 JSX（当 settingsOpen 为 true 时显示）
 */
export function Settings() {
    /**
     * 处理主题切换
     *
     * @param e - 下拉框变更事件
     * @internal
     */
    const handleThemeChange = (e: Event) => {
        const value = (e.target as HTMLSelectElement).value as 'light' | 'dark';
        settingsStore.setTheme(value);
    };

    /**
     * 处理图谱设置变更
     *
     * @param key - 设置键名
     * @param value - 新值
     * @internal
     */
    const handleGraphChange = (key: string, value: number | boolean) => {
        settingsStore.setGraphSettings({ [key]: value });
    };

    /**
     * 关闭设置面板
     *
     * @internal
     */
    const handleClose = () => {
        settingsStore.setSettingsOpen(false);
    };

    /**
     * 处理遮罩层点击（点击遮罩关闭面板）
     *
     * @param e - 点击事件
     * @internal
     */
    const handleOverlayClick = (e: MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    return (
        <Show when={settingsStore.settingsOpen()}>
            {/* settings-overlay: 模态遮罩层，点击可关闭 */}
            <div class="settings-overlay" onClick={handleOverlayClick}>
                {/* settings-panel: 设置面板容器 */}
                <div class="settings-panel">
                    {/* settings-header: 标题栏和关闭按钮 */}
                    <div class="settings-header">
                        <h2>⚙️ 设置 Settings</h2>
                        <button class="close-btn" onClick={handleClose}>✕</button>
                    </div>

                    {/* settings-content: 设置内容区域 */}
                    <div class="settings-content">
                        {/* 主题设置区 */}
                        <section class="settings-section">
                            <h3>🎨 主题 Theme</h3>
                            <div class="setting-item">
                                <label>颜色模式 Color Mode</label>
                                <select value={settingsStore.theme()} onChange={handleThemeChange}>
                                    <option value="dark">🌙 深色 Dark</option>
                                    <option value="light">☀️ 浅色 Light</option>
                                </select>
                            </div>
                        </section>

                        {/* 图谱物理模拟参数区 */}
                        <section class="settings-section">
                            <h3>⚡ 物理模拟 Physics</h3>

                            <div class="setting-item">
                                <label>引力 Gravity: {settingsStore.graphSettings().gravity.toFixed(2)}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={settingsStore.graphSettings().gravity}
                                    onInput={(e) => handleGraphChange('gravity', parseFloat(e.currentTarget.value))}
                                />
                            </div>

                            <div class="setting-item">
                                <label>斥力 Repulsion: {settingsStore.graphSettings().repulsion.toFixed(0)}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="300"
                                    step="1"
                                    value={settingsStore.graphSettings().repulsion}
                                    onInput={(e) => handleGraphChange('repulsion', parseFloat(e.currentTarget.value))}
                                />
                            </div>

                            <div class="setting-item">
                                <label>斥力精度 Theta: {settingsStore.graphSettings().repulsionTheta.toFixed(2)}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="3"
                                    step="0.05"
                                    value={settingsStore.graphSettings().repulsionTheta}
                                    onInput={(e) => handleGraphChange('repulsionTheta', parseFloat(e.currentTarget.value))}
                                />
                            </div>

                            <div class="setting-item">
                                <label>边距离 Link Distance: {settingsStore.graphSettings().linkDistance}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={settingsStore.graphSettings().linkDistance}
                                    onInput={(e) => handleGraphChange('linkDistance', parseFloat(e.currentTarget.value))}
                                />
                            </div>

                            <div class="setting-item">
                                <label>弹力 Link Spring: {settingsStore.graphSettings().linkSpring.toFixed(2)}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="5"
                                    step="0.1"
                                    value={settingsStore.graphSettings().linkSpring}
                                    onInput={(e) => handleGraphChange('linkSpring', parseFloat(e.currentTarget.value))}
                                />
                            </div>

                            <div class="setting-item">
                                <label>摩擦力 Friction: {settingsStore.graphSettings().friction.toFixed(2)}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={settingsStore.graphSettings().friction}
                                    onInput={(e) => handleGraphChange('friction', parseFloat(e.currentTarget.value))}
                                />
                            </div>

                            <div class="setting-item">
                                <label>衰减 Decay: {settingsStore.graphSettings().decay}</label>
                                <input
                                    type="range"
                                    min="100"
                                    max="50000"
                                    step="100"
                                    value={settingsStore.graphSettings().decay}
                                    onInput={(e) => handleGraphChange('decay', parseFloat(e.currentTarget.value))}
                                />
                            </div>

                            <div class="setting-item">
                                <label>向心力 Center: {settingsStore.graphSettings().center.toFixed(2)}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={settingsStore.graphSettings().center}
                                    onInput={(e) => handleGraphChange('center', parseFloat(e.currentTarget.value))}
                                />
                            </div>

                            <div class="setting-item">
                                <label>聚类 Cluster: {settingsStore.graphSettings().cluster.toFixed(2)}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={settingsStore.graphSettings().cluster}
                                    onInput={(e) => handleGraphChange('cluster', parseFloat(e.currentTarget.value))}
                                />
                            </div>
                        </section>

                        {/* 图谱样式参数区 */}
                        <section class="settings-section">
                            <h3>🎨 样式 Style</h3>

                            <div class="setting-item">
                                <label>节点大小 Point Size: {settingsStore.graphSettings().pointSize.toFixed(1)}</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="20"
                                    step="0.5"
                                    value={settingsStore.graphSettings().pointSize}
                                    onInput={(e) => handleGraphChange('pointSize', parseFloat(e.currentTarget.value))}
                                />
                            </div>

                            <div class="setting-item">
                                <label>边粗细 Link Width: {settingsStore.graphSettings().linkWidth.toFixed(2)}</label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="5"
                                    step="0.1"
                                    value={settingsStore.graphSettings().linkWidth}
                                    onInput={(e) => handleGraphChange('linkWidth', parseFloat(e.currentTarget.value))}
                                />
                            </div>

                            <div class="setting-item">
                                <label>箭头大小 Arrow Size: {settingsStore.graphSettings().arrowSize.toFixed(1)}</label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="5"
                                    step="0.1"
                                    value={settingsStore.graphSettings().arrowSize}
                                    onInput={(e) => handleGraphChange('arrowSize', parseFloat(e.currentTarget.value))}
                                />
                            </div>

                            <div class="setting-item checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={settingsStore.graphSettings().showArrows}
                                        onChange={(e) => handleGraphChange('showArrows', e.currentTarget.checked)}
                                    />
                                    显示箭头 Show Arrows
                                </label>
                            </div>

                            <div class="setting-item checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={settingsStore.graphSettings().curvedLinks}
                                        onChange={(e) => handleGraphChange('curvedLinks', e.currentTarget.checked)}
                                    />
                                    曲线边 Curved Links
                                </label>
                            </div>
                        </section>

                        {/* 操作按钮区 */}
                        <section class="settings-section">
                            <h3>🔧 操作 Actions</h3>
                            <div class="settings-actions">
                                <button class="reset-btn" onClick={() => settingsStore.resetGraphSettings()}>
                                    重置图表设置 Reset Graph
                                </button>
                                <button class="reset-btn danger" onClick={() => settingsStore.resetAllSettings()}>
                                    重置所有设置 Reset All
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </Show>
    );
}
