/**
 * @fileoverview 设置状态管理模块
 *
 * 本模块管理 CogniStruct 应用的用户设置，包括：
 * - 主题设置（深色/浅色）
 * - 图视图物理模拟参数
 * - 图视图样式参数
 * - 设置的持久化存储
 *
 * @module stores/settingsStore
 *
 * @example
 * ```tsx
 * import { settingsStore } from './stores/settingsStore';
 *
 * // 切换主题
 * settingsStore.setTheme('light');
 *
 * // 修改图设置
 * settingsStore.setGraphSettings({ gravity: 0.2 });
 *
 * // 重置所有设置
 * settingsStore.resetAllSettings();
 * ```
 *
 * @exports settingsStore - 设置状态管理对象
 * @exports Theme - 主题类型
 * @exports GraphSettings - 图设置接口
 * @exports Settings - 完整设置接口
 */

import { createSignal } from 'solid-js';

/**
 * 主题类型
 * - 'light': 浅色主题
 * - 'dark': 深色主题
 */
export type Theme = 'light' | 'dark';

/**
 * 图视图设置接口
 *
 * 控制知识图谱的物理模拟和视觉样式
 */
export interface GraphSettings {
    /** 引力系数，控制节点向中心的吸引力 */
    gravity: number;
    /** 边的理想长度 */
    linkDistance: number;
    /** 边的弹性系数 */
    linkSpring: number;
    /** 节点间斥力强度 */
    repulsion: number;
    /** 摩擦力系数 */
    friction: number;
    /** 模拟衰减时间 */
    decay: number;
    /** 向心力强度 */
    center: number;
    /** Barnes-Hut 近似精度 */
    repulsionTheta: number;
    /** 聚类强度 */
    cluster: number;
    /** 节点默认大小 */
    pointSize: number;
    /** 边默认宽度 */
    linkWidth: number;
    /** 是否显示箭头 */
    showArrows: boolean;
    /** 箭头大小 */
    arrowSize: number;
    /** 是否使用曲线边 */
    curvedLinks: boolean;
}

/**
 * 完整设置接口
 */
export interface Settings {
    /** 主题设置 */
    theme: Theme;
    /** 图视图设置 */
    graph: GraphSettings;
}

/**
 * 默认设置配置
 */
const DEFAULT_SETTINGS: Settings = {
    theme: 'dark',
    graph: {
        gravity: 0.15,
        linkDistance: 80,
        linkSpring: 1.5,
        repulsion: 120,
        friction: 1.0,
        decay: 1000,
        center: 0.2,
        repulsionTheta: 1.0,
        cluster: 0.15,
        pointSize: 5,
        linkWidth: 0.2,
        showArrows: true,
        arrowSize: 1.2,
        curvedLinks: false,
    },
};

/** localStorage 存储键名 */
const STORAGE_KEY = 'cognistruct-settings';

// ============================================================================
// 存储函数
// ============================================================================

/**
 * 从 localStorage 加载设置
 *
 * @returns 加载的设置，如果加载失败则返回默认设置
 */
function loadSettings(): Settings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // 与默认值合并以处理新增的设置项
            return {
                ...DEFAULT_SETTINGS,
                ...parsed,
                graph: {
                    ...DEFAULT_SETTINGS.graph,
                    ...parsed.graph,
                },
            };
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
    return DEFAULT_SETTINGS;
}

/**
 * 保存设置到 localStorage
 *
 * @param settings - 要保存的设置对象
 */
function saveSettings(settings: Settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
}

// ============================================================================
// 状态信号
// ============================================================================

/** 初始设置（从存储加载） */
const initialSettings = loadSettings();

/** 当前主题 */
const [theme, setThemeInternal] = createSignal<Theme>(initialSettings.theme);
/** 图视图设置 */
const [graphSettings, setGraphSettingsInternal] = createSignal<GraphSettings>(initialSettings.graph);
/** 设置面板是否打开 */
const [settingsOpen, setSettingsOpen] = createSignal(false);

// ============================================================================
// 主题函数
// ============================================================================

/**
 * 应用主题到文档
 *
 * @param t - 要应用的主题
 */
function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t);
}

// 页面加载时初始化主题
applyTheme(initialSettings.theme);

// ============================================================================
// 设置修改函数
// ============================================================================

/**
 * 设置主题并保存
 *
 * @param t - 新的主题值
 */
function setTheme(t: Theme) {
    setThemeInternal(t);
    applyTheme(t);
    saveSettings({ theme: t, graph: graphSettings() });
}

/**
 * 更新图视图设置
 *
 * @param settings - 要更新的设置项（部分）
 */
function setGraphSettings(settings: Partial<GraphSettings>) {
    const newSettings = { ...graphSettings(), ...settings };
    setGraphSettingsInternal(newSettings);
    saveSettings({ theme: theme(), graph: newSettings });
}

/**
 * 重置图视图设置为默认值
 */
function resetGraphSettings() {
    setGraphSettingsInternal(DEFAULT_SETTINGS.graph);
    saveSettings({ theme: theme(), graph: DEFAULT_SETTINGS.graph });
}

/**
 * 重置所有设置为默认值
 */
function resetAllSettings() {
    setThemeInternal(DEFAULT_SETTINGS.theme);
    applyTheme(DEFAULT_SETTINGS.theme);
    setGraphSettingsInternal(DEFAULT_SETTINGS.graph);
    saveSettings(DEFAULT_SETTINGS);
}

// ============================================================================
// 导出设置状态管理对象
// ============================================================================

/**
 * 设置状态管理对象
 *
 * 提供应用设置的访问和修改方法
 */
export const settingsStore = {
    // 主题
    /** 获取当前主题 */
    theme,
    /** 设置主题 */
    setTheme,
    /** 应用当前主题到文档 */
    applyTheme: () => applyTheme(theme()),

    // 图视图设置
    /** 获取图视图设置 */
    graphSettings,
    /** 更新图视图设置 */
    setGraphSettings,
    /** 重置图视图设置 */
    resetGraphSettings,

    // 设置面板
    /** 获取设置面板打开状态 */
    settingsOpen,
    /** 设置面板打开状态 */
    setSettingsOpen,

    // 重置
    /** 重置所有设置 */
    resetAllSettings,

    // 默认值引用
    /** 默认设置配置 */
    DEFAULT_SETTINGS,
};
