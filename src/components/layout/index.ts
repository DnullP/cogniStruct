// ============================================================================
// AppLayout - VS Code Style Layout
// ============================================================================

export { AppLayout } from './AppLayout';
export type { AppLayoutProps } from './AppLayout';

// ============================================================================
// Sidebar - Paneview wrapper for collapsible card containers
// ============================================================================

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
} from './Sidebar';

export type {
    CardComponentFactory,
    CardDefinition,
    SidebarProps,
    SidebarLayoutConfig,
    SidebarCardConfig,
} from './Sidebar';

// ============================================================================
// DockLayout - SolidJS wrapper for dockview-core
// ============================================================================

export {
    DockLayout,
    // Context hooks
    useDockview,
    usePanelParams,
    // Panel operations
    addPanel,
    getPanel,
    closePanel,
    activatePanel,
    getAllPanels,
    getActivePanel,
    getTotalPanels,
    removePanel,
    // Group operations
    addGroup,
    getGroup,
    removeGroup,
    getAllGroups,
    getActiveGroup,
    getGroupCount,
    // Serialization
    toJSON,
    fromJSON,
    // Floating & Popout
    addFloatingGroup,
    addPopoutGroup,
    // Navigation
    moveToNext,
    moveToPrevious,
    // Maximization
    maximizeGroup,
    exitMaximizedGroup,
    hasMaximizedGroup,
    // Layout control
    getDockview,
    clear,
    closeAllGroups,
    focus,
    getSize,
    getSizeConstraints,
    layout,
    updateOptions,
    getId,
    // Visibility
    setGroupVisible,
    // Movement
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

// ============================================================================
// Re-export useful types from dockview-core
// ============================================================================

export type {
    // Dockview types
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
    // Paneview types
    PaneviewComponent,
    IPaneviewPanel,
    SerializedPaneview,
    PaneviewDropEvent,
    PaneviewComponentOptions,
    PaneviewDndOverlayEvent,
} from 'dockview-core';
