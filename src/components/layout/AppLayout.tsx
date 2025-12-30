/**
 * @fileoverview 应用布局组件
 *
 * 本模块提供 VS Code 风格的应用布局容器，整合侧边栏、中央标签页、
 * 活动栏、标题栏和状态栏。
 *
 * @module components/layout/AppLayout
 *
 * @features
 * - 左右可调整大小的侧边栏
 * - 中央 dockview 标签页区域
 * - 活动栏垂直导航
 * - 标题栏和状态栏
 *
 * @example
 * ```tsx
 * import { AppLayout } from './layout';
 *
 * <AppLayout
 *   cards={cardComponents}
 *   panels={panelComponents}
 *   leftSidebarLayout={sidebarConfig}
 *   centerLayout={centerConfig}
 *   header={<Header />}
 *   statusBar={<StatusBar />}
 *   activityBar={<ActivityBar />}
 * />
 * ```
 *
 * @exports AppLayout - 应用布局组件
 * @exports AppLayoutProps - 布局组件属性类型
 */

import { JSX, Show, createSignal } from 'solid-js';
import { Sidebar, SidebarLayoutConfig, CardComponentFactory } from './Sidebar';
import { DockLayout, InitialLayoutConfig, PanelComponentFactory } from './DockLayout';
import { DockviewComponent, PaneviewComponent } from 'dockview-core';
/* 样式：AppLayout.css - 布局网格和调整手柄样式 */
import './AppLayout.css';

/* ==========================================================================
   类型定义
   ========================================================================== */

/**
 * 应用布局组件属性接口
 */
export interface AppLayoutProps {
    /** 侧边栏卡片组件映射 */
    cards: Record<string, CardComponentFactory>;
    /** 中央标签页面板组件映射 */
    panels: Record<string, PanelComponentFactory>;
    /** 左侧边栏初始布局配置 */
    leftSidebarLayout?: SidebarLayoutConfig;
    /** 右侧边栏初始布局配置 */
    rightSidebarLayout?: SidebarLayoutConfig;
    /** 中央区域初始布局配置 */
    centerLayout?: InitialLayoutConfig;
    /** 左侧边栏宽度 (px) */
    leftSidebarWidth?: number;
    /** 右侧边栏宽度 (px) */
    rightSidebarWidth?: number;
    /** 是否显示左侧边栏 */
    showLeftSidebar?: boolean;
    /** 是否显示右侧边栏 */
    showRightSidebar?: boolean;
    /** 切换左侧边栏回调 */
    onToggleLeftSidebar?: () => void;
    /** 切换右侧边栏回调 */
    onToggleRightSidebar?: () => void;
    /** 左侧边栏就绪回调 */
    onLeftSidebarReady?: (api: PaneviewComponent) => void;
    /** 右侧边栏就绪回调 */
    onRightSidebarReady?: (api: PaneviewComponent) => void;
    /** 中央区域就绪回调 */
    onCenterReady?: (api: DockviewComponent) => void;
    /** 标题栏内容 */
    header?: JSX.Element;
    /** 状态栏内容 */
    statusBar?: JSX.Element;
    /** 活动栏内容（左侧图标栏） */
    activityBar?: JSX.Element;
}

/* ==========================================================================
   AppLayout 组件
   ========================================================================== */

/**
 * 应用布局组件
 *
 * VS Code 风格的应用布局，包含：
 * - 可选的标题栏
 * - 活动栏（垂直图标导航）
 * - 可调整大小的左右侧边栏
 * - 中央 dockview 标签页区域
 * - 可选的状态栏
 *
 * @param props - 组件属性
 * @returns 应用布局 JSX
 */
export function AppLayout(props: AppLayoutProps) {
    /** 左侧边栏宽度 */
    const [leftWidth, setLeftWidth] = createSignal(props.leftSidebarWidth ?? 250);
    /** 右侧边栏宽度 */
    const [rightWidth, setRightWidth] = createSignal(props.rightSidebarWidth ?? 250);
    /** 是否正在调整左侧边栏大小 */
    const [isResizingLeft, setIsResizingLeft] = createSignal(false);
    /** 是否正在调整右侧边栏大小 */
    const [isResizingRight, setIsResizingRight] = createSignal(false);

    /**
     * 开始调整左侧边栏大小
     *
     * @param e - 鼠标事件
     * @internal
     */
    const startResizeLeft = (e: MouseEvent) => {
        e.preventDefault();
        setIsResizingLeft(true);

        const startX = e.clientX;
        const startWidth = leftWidth();

        const onMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startX;
            /* 限制宽度在 150-500px 范围内 */
            const newWidth = Math.max(150, Math.min(500, startWidth + delta));
            setLeftWidth(newWidth);
        };

        const onMouseUp = () => {
            setIsResizingLeft(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    /**
     * 开始调整右侧边栏大小
     *
     * @param e - 鼠标事件
     * @internal
     */
    const startResizeRight = (e: MouseEvent) => {
        e.preventDefault();
        setIsResizingRight(true);

        const startX = e.clientX;
        const startWidth = rightWidth();

        const onMouseMove = (e: MouseEvent) => {
            const delta = startX - e.clientX;
            /* 限制宽度在 150-500px 范围内 */
            const newWidth = Math.max(150, Math.min(500, startWidth + delta));
            setRightWidth(newWidth);
        };

        const onMouseUp = () => {
            setIsResizingRight(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        /* app-layout: 应用布局根容器 */
        <div class="app-layout">
            {/* 标题栏 */}
            <Show when={props.header}>
                <div class="app-layout-header">
                    {props.header}
                </div>
            </Show>

            {/* 主内容区域 */}
            <div class="app-layout-main">
                {/* 活动栏 */}
                <Show when={props.activityBar}>
                    <div class="app-layout-activity-bar">
                        {props.activityBar}
                    </div>
                </Show>

                {/* 左侧边栏区域（包含切换按钮和内容） */}
                <div class="app-layout-left-sidebar-container">
                    {/* 左侧边栏头部（含切换按钮） */}
                    <div class="sidebar-toggle-header left">
                        <button
                            class="sidebar-toggle-btn"
                            title={props.showLeftSidebar ? 'Hide Left Sidebar' : 'Show Left Sidebar'}
                            onClick={() => props.onToggleLeftSidebar?.()}
                        >
                            {props.showLeftSidebar ? '◀' : '▶'}
                        </button>
                    </div>
                    {/* 左侧边栏内容 */}
                    <Show when={props.showLeftSidebar !== false && Object.keys(props.cards).length > 0}>
                        <div class="sidebar-wrapper">
                            <Sidebar
                                position="left"
                                cards={props.cards}
                                initialLayout={props.leftSidebarLayout}
                                width={leftWidth()}
                                onReady={props.onLeftSidebarReady}
                            />
                        </div>
                        {/* 左侧调整手柄 */}
                        <div
                            class="app-layout-resize-handle resize-handle-left"
                            classList={{ resizing: isResizingLeft() }}
                            onMouseDown={startResizeLeft}
                        />
                    </Show>
                </div>

                {/* 中央标签页区域 */}
                <div class="app-layout-center">
                    <DockLayout
                        panels={props.panels}
                        initialLayout={props.centerLayout}
                        onReady={props.onCenterReady}
                        theme="dockview-theme-abyss"
                    />
                </div>

                {/* 右侧边栏区域（包含切换按钮和内容） */}
                <div class="app-layout-right-sidebar-container">
                    {/* 右侧边栏内容 */}
                    <Show when={props.showRightSidebar && Object.keys(props.cards).length > 0}>
                        {/* 右侧调整手柄 */}
                        <div
                            class="app-layout-resize-handle resize-handle-right"
                            classList={{ resizing: isResizingRight() }}
                            onMouseDown={startResizeRight}
                        />
                        <div class="sidebar-wrapper">
                            <Sidebar
                                position="right"
                                cards={props.cards}
                                initialLayout={props.rightSidebarLayout}
                                width={rightWidth()}
                                onReady={props.onRightSidebarReady}
                            />
                        </div>
                    </Show>
                    {/* 右侧边栏头部（含切换按钮） */}
                    <div class="sidebar-toggle-header right">
                        <button
                            class="sidebar-toggle-btn"
                            title={props.showRightSidebar ? 'Hide Right Sidebar' : 'Show Right Sidebar'}
                            onClick={() => props.onToggleRightSidebar?.()}
                        >
                            {props.showRightSidebar ? '▶' : '◀'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 状态栏 */}
            <Show when={props.statusBar}>
                <div class="app-layout-status-bar">
                    {props.statusBar}
                </div>
            </Show>
        </div>
    );
}

/* ==========================================================================
   重新导出
   ========================================================================== */

export { Sidebar } from './Sidebar';
export { DockLayout } from './DockLayout';
export type { SidebarLayoutConfig, SidebarCardConfig, CardComponentFactory } from './Sidebar';
export type { InitialLayoutConfig, InitialPanelConfig, PanelComponentFactory } from './DockLayout';
