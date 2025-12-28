import { JSX, Show, createSignal } from 'solid-js';
import { Sidebar, SidebarLayoutConfig, CardComponentFactory } from './Sidebar';
import { DockLayout, InitialLayoutConfig, PanelComponentFactory } from './DockLayout';
import { DockviewComponent, PaneviewComponent } from 'dockview-core';
import './AppLayout.css';

// ============================================================================
// Types
// ============================================================================

export interface AppLayoutProps {
    /** Card components for sidebars */
    cards: Record<string, CardComponentFactory>;
    /** Panel components for center tabs */
    panels: Record<string, PanelComponentFactory>;
    /** Initial left sidebar layout */
    leftSidebarLayout?: SidebarLayoutConfig;
    /** Initial right sidebar layout */
    rightSidebarLayout?: SidebarLayoutConfig;
    /** Initial center tabs layout */
    centerLayout?: InitialLayoutConfig;
    /** Left sidebar width */
    leftSidebarWidth?: number;
    /** Right sidebar width */
    rightSidebarWidth?: number;
    /** Show left sidebar */
    showLeftSidebar?: boolean;
    /** Show right sidebar */
    showRightSidebar?: boolean;
    /** Callback when left sidebar is ready */
    onLeftSidebarReady?: (api: PaneviewComponent) => void;
    /** Callback when right sidebar is ready */
    onRightSidebarReady?: (api: PaneviewComponent) => void;
    /** Callback when center dockview is ready */
    onCenterReady?: (api: DockviewComponent) => void;
    /** Header content */
    header?: JSX.Element;
    /** Status bar content */
    statusBar?: JSX.Element;
    /** Activity bar (left icon bar) */
    activityBar?: JSX.Element;
}

// ============================================================================
// AppLayout Component
// ============================================================================

export function AppLayout(props: AppLayoutProps) {
    const [leftWidth, setLeftWidth] = createSignal(props.leftSidebarWidth ?? 250);
    const [rightWidth, setRightWidth] = createSignal(props.rightSidebarWidth ?? 250);
    const [isResizingLeft, setIsResizingLeft] = createSignal(false);
    const [isResizingRight, setIsResizingRight] = createSignal(false);

    // Resize handlers
    const startResizeLeft = (e: MouseEvent) => {
        e.preventDefault();
        setIsResizingLeft(true);

        const startX = e.clientX;
        const startWidth = leftWidth();

        const onMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startX;
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

    const startResizeRight = (e: MouseEvent) => {
        e.preventDefault();
        setIsResizingRight(true);

        const startX = e.clientX;
        const startWidth = rightWidth();

        const onMouseMove = (e: MouseEvent) => {
            const delta = startX - e.clientX;
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
        <div class="app-layout">
            {/* Header */}
            <Show when={props.header}>
                <div class="app-layout-header">
                    {props.header}
                </div>
            </Show>

            {/* Main content area */}
            <div class="app-layout-main">
                {/* Activity Bar */}
                <Show when={props.activityBar}>
                    <div class="app-layout-activity-bar">
                        {props.activityBar}
                    </div>
                </Show>

                {/* Left Sidebar */}
                <Show when={props.showLeftSidebar !== false && Object.keys(props.cards).length > 0}>
                    <Sidebar
                        position="left"
                        cards={props.cards}
                        initialLayout={props.leftSidebarLayout}
                        width={leftWidth()}
                        onReady={props.onLeftSidebarReady}
                    />
                    <div
                        class="app-layout-resize-handle resize-handle-left"
                        classList={{ resizing: isResizingLeft() }}
                        onMouseDown={startResizeLeft}
                    />
                </Show>

                {/* Center - Tab Section */}
                <div class="app-layout-center">
                    <DockLayout
                        panels={props.panels}
                        initialLayout={props.centerLayout}
                        onReady={props.onCenterReady}
                        theme="dockview-theme-abyss"
                    />
                </div>

                {/* Right Sidebar */}
                <Show when={props.showRightSidebar && Object.keys(props.cards).length > 0}>
                    <div
                        class="app-layout-resize-handle resize-handle-right"
                        classList={{ resizing: isResizingRight() }}
                        onMouseDown={startResizeRight}
                    />
                    <Sidebar
                        position="right"
                        cards={props.cards}
                        initialLayout={props.rightSidebarLayout}
                        width={rightWidth()}
                        onReady={props.onRightSidebarReady}
                    />
                </Show>
            </div>

            {/* Status Bar */}
            <Show when={props.statusBar}>
                <div class="app-layout-status-bar">
                    {props.statusBar}
                </div>
            </Show>
        </div>
    );
}

// ============================================================================
// Re-exports
// ============================================================================

export { Sidebar } from './Sidebar';
export { DockLayout } from './DockLayout';
export type { SidebarLayoutConfig, SidebarCardConfig, CardComponentFactory } from './Sidebar';
export type { InitialLayoutConfig, InitialPanelConfig, PanelComponentFactory } from './DockLayout';
