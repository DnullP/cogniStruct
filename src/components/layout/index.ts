/**
 * @fileoverview 布局模块入口
 *
 * 本模块统一导出所有布局相关的组件、类型和辅助函数。
 * 采用 VS Code 风格的布局系统，基于 dockview-core 实现。
 *
 * @module components/layout
 *
 * @exports AppLayout - 主应用布局组件
 * @exports Sidebar - 侧边栏组件（基于 Paneview）
 * @exports DockLayout - 中央标签页布局（基于 Dockview）
 *
 * @example
 * ```tsx
 * import {
 *   AppLayout,
 *   Sidebar,
 *   DockLayout,
 *   addPanel,
 *   getPanel,
 * } from './components/layout';
 * ```
 */

/* ==========================================================================
   AppLayout - VS Code 风格主布局
   ========================================================================== */

export { AppLayout } from './AppLayout';
export type { AppLayoutProps } from './AppLayout';

/* ==========================================================================
   Sidebar - 可折叠卡片容器（Paneview 包装器）
   ========================================================================== */

export {
    Sidebar,
    getSidebar,
    addCard,
    getCard,
    removeCard,
    moveCard,
    getAllCards,
    sidebarToJSON,
    sidebarFromJSON,
    clearSidebar,
    moveCardToSidebar,
    getCardPosition,
} from './Sidebar';

export type {
    CardComponentFactory,
    CardDefinition,
    SidebarProps,
    SidebarLayoutConfig,
    SidebarCardConfig,
} from './Sidebar';

/* ==========================================================================
   DockLayout - 标签页布局（dockview-core 包装器）
   ========================================================================== */

export {
    DockLayout,
    /* Context hooks */
    useDockview,
    usePanelParams,
    /* 面板操作 */
    addPanel,
    getPanel,
    closePanel,
    activatePanel,
    getAllPanels,
    getActivePanel,
    getTotalPanels,
    removePanel,
    /* 组操作 */
    addGroup,
    getGroup,
    removeGroup,
    getAllGroups,
    getActiveGroup,
    getGroupCount,
    /* 序列化 */
    toJSON,
    fromJSON,
    /* 浮动和弹出 */
    addFloatingGroup,
    addPopoutGroup,
    /* 导航 */
    moveToNext,
    moveToPrevious,
    /* 最大化 */
    maximizeGroup,
    exitMaximizedGroup,
    hasMaximizedGroup,
    /* 布局控制 */
    getDockview,
    clear,
    closeAllGroups,
    focus,
    getSize,
    getSizeConstraints,
    layout,
    updateOptions,
    getId,
    /* 可见性 */
    setGroupVisible,
    /* 移动 */
    moveGroupOrPanel,
} from './DockLayout';

export type {
    PanelType,
    PanelComponentFactory,
    PanelDefinition,
    DockLayoutProps,
    InitialLayoutConfig,
    InitialPanelConfig,
    AddPanelOptionsExtended,
} from './DockLayout';

/* ==========================================================================
   从 dockview-core 重新导出的类型
   ========================================================================== */

export type {
    /* Dockview 类型 */
    DockviewPanel,
    DockviewGroupPanel,
    DockviewComponent,
    AddPanelOptions,
    AddGroupOptions,
    SerializedDockview,
    FloatingGroupOptions,
    MovementOptions,
    DockviewDidDropEvent,
    DockviewWillDropEvent,
    TabDragEvent,
    GroupDragEvent,
    DockviewDndOverlayEvent,
    DockviewMaximizedGroupChanged,
    DockviewWillShowOverlayLocationEvent,
    MovePanelEvent,
    PopoutGroupChangeSizeEvent,
    PopoutGroupChangePositionEvent,
    DockviewComponentOptions,
    Position,
    /* Paneview 类型 */
    PaneviewComponent,
    IPaneviewPanel,
    SerializedPaneview,
    PaneviewDropEvent,
    PaneviewComponentOptions,
    PaneviewDndOverlayEvent,
} from 'dockview-core';
