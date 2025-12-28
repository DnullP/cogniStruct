import { Show } from 'solid-js';
import { settingsStore } from '../stores/settingsStore';
import './Settings.css';

export function Settings() {
    const handleThemeChange = (e: Event) => {
        const value = (e.target as HTMLSelectElement).value as 'light' | 'dark';
        settingsStore.setTheme(value);
    };

    const handleGraphChange = (key: string, value: number | boolean) => {
        settingsStore.setGraphSettings({ [key]: value });
    };

    const handleClose = () => {
        settingsStore.setSettingsOpen(false);
    };

    const handleOverlayClick = (e: MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    return (
        <Show when={settingsStore.settingsOpen()}>
            <div class="settings-overlay" onClick={handleOverlayClick}>
                <div class="settings-panel">
                    <div class="settings-header">
                        <h2>⚙️ 设置 Settings</h2>
                        <button class="close-btn" onClick={handleClose}>✕</button>
                    </div>

                    <div class="settings-content">
                        {/* Theme Section */}
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

                        {/* Graph Physics Section */}
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

                        {/* Graph Style Section */}
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

                        {/* Actions */}
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
