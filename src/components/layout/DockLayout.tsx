import { onMount, onCleanup, createSignal, JSX, createContext, useContext, Accessor } from 'solid-js';
import { render } from 'solid-js/web';
import {
    DockviewComponent,
    IDockviewPanel,
    AddPanelOptions,
    AddGroupOptions,
    DockviewGroupPanel,
    DockviewPanel,
    SerializedDockview,
    DockviewDidDropEvent,
    DockviewWillDropEvent,
    TabDragEvent,
    GroupDragEvent,
    MovementOptions,
    DockviewDndOverlayEvent,
    DockviewMaximizedGroupChanged,
    DockviewComponentOptions,
    FloatingGroupOptions,
    Position,
    MovePanelEvent,
    PopoutGroupChangeSizeEvent,
    PopoutGroupChangePositionEvent,
    DockviewWillShowOverlayLocationEvent,
} from 'dockview-core';
import 'dockview-core/dist/styles/dockview.css';
import './DockLayout.css';

// ============================================================================
// Types
// ============================================================================

export type PanelType = string;

/** Panel component factory with optional props */
export type PanelComponentFactory<T = any> = (props: T) => JSX.Element;

export interface PanelDefinition<T = any> {
    id: string;
    component: PanelComponentFactory<T>;
    title?: string;
    icon?: string;
    closable?: boolean;
    /** If true, this panel's group will have hidden header (sidebar style) */
    sidebarStyle?: boolean;
}

export interface DockLayoutProps {
    /** Panel definitions - map of panel type to component factory */
    panels: Record<string, PanelComponentFactory>;
    /** Initial layout configuration */
    initialLayout?: InitialLayoutConfig;
    /** Called when dockview is ready */
    onReady?: (api: DockviewComponent) => void;
    /** Theme class name */
    theme?: string;
    /** Dockview options */
    options?: Partial<DockviewComponentOptions>;
    /** Event handlers - Panel Events */
    onDidAddPanel?: (panel: IDockviewPanel) => void;
    onDidRemovePanel?: (panel: IDockviewPanel) => void;
    onDidActivePanelChange?: (panel: IDockviewPanel | undefined) => void;
    onDidMovePanel?: (event: MovePanelEvent) => void;
    /** Event handlers - Group Events */
    onDidAddGroup?: (group: DockviewGroupPanel) => void;
    onDidRemoveGroup?: (group: DockviewGroupPanel) => void;
    onDidActiveGroupChange?: (group: DockviewGroupPanel | undefined) => void;
    /** Event handlers - Drag & Drop */
    onDidDrop?: (event: DockviewDidDropEvent) => void;
    onWillDrop?: (event: DockviewWillDropEvent) => void;
    onWillDragPanel?: (event: TabDragEvent) => void;
    onWillDragGroup?: (event: GroupDragEvent) => void;
    onWillShowOverlay?: (event: DockviewWillShowOverlayLocationEvent) => void;
    onUnhandledDragOverEvent?: (event: DockviewDndOverlayEvent) => void;
    /** Event handlers - Layout Events */
    onDidLayoutChange?: () => void;
    onDidLayoutFromJSON?: () => void;
    /** Event handlers - Maximization */
    onDidMaximizedGroupChange?: (event: DockviewMaximizedGroupChanged) => void;
    /** Event handlers - Popout Groups */
    onDidPopoutGroupSizeChange?: (event: PopoutGroupChangeSizeEvent) => void;
    onDidPopoutGroupPositionChange?: (event: PopoutGroupChangePositionEvent) => void;
    onDidOpenPopoutWindowFail?: () => void;
}

export interface InitialLayoutConfig {
    panels: InitialPanelConfig[];
    activePanel?: string;
}

export interface InitialPanelConfig {
    id: string;
    type: string;
    title?: string;
    params?: Record<string, any>;
    position?: {
        referencePanel: string;
        direction: 'left' | 'right' | 'above' | 'below' | 'within';
    };
    size?: { width?: number; height?: number };
    /** If true, this panel's group will have hidden header (sidebar style) */
    sidebarStyle?: boolean;
    /** If true, panel cannot be closed */
    locked?: boolean;
}

export interface AddPanelOptionsExtended {
    id?: string;
    title?: string;
    params?: Record<string, any>;
    position?: {
        referencePanel?: string;
        referenceGroup?: string;
        direction: 'left' | 'right' | 'above' | 'below' | 'within';
    };
    sidebarStyle?: boolean;
    inactive?: boolean;
    floating?: FloatingGroupOptions;
}

// ============================================================================
// Context for accessing DockviewComponent
// ============================================================================

interface DockviewContextValue {
    api: Accessor<DockviewComponent | null>;
    panelParams: Map<string, Record<string, any>>;
}

const DockviewContext = createContext<DockviewContextValue>();

export function useDockview(): DockviewComponent | null {
    const ctx = useContext(DockviewContext);
    return ctx ? ctx.api() : null;
}

export function usePanelParams<T = Record<string, any>>(panelId: string): T | undefined {
    const ctx = useContext(DockviewContext);
    return ctx?.panelParams.get(panelId) as T | undefined;
}

// ============================================================================
// Global API storage (survives HMR)
// ============================================================================

declare global {
    interface Window {
        __dockviewApi?: DockviewComponent | null;
        __dockviewPanelParams?: Map<string, Record<string, any>>;
    }
}

function getDockviewApi(): DockviewComponent | null {
    return window.__dockviewApi || null;
}

function setDockviewApi(api: DockviewComponent | null): void {
    window.__dockviewApi = api;
}

function getPanelParamsMap(): Map<string, Record<string, any>> {
    if (!window.__dockviewPanelParams) {
        window.__dockviewPanelParams = new Map();
    }
    return window.__dockviewPanelParams;
}

// ============================================================================
// SolidJS Panel Renderer
// ============================================================================

interface ContentRendererInitParams {
    api: any;
    containerApi: any;
    title: string;
    params: Record<string, any>;
}

class SolidPanelRenderer {
    private _element: HTMLElement;
    private _dispose: (() => void) | null = null;
    private _componentFactory: () => JSX.Element;

    get element(): HTMLElement {
        return this._element;
    }

    constructor(componentFactory: () => JSX.Element) {
        this._componentFactory = componentFactory;
        this._element = document.createElement('div');
        this._element.className = 'dockview-solid-panel';
        this._element.style.width = '100%';
        this._element.style.height = '100%';
        this._element.style.overflow = 'auto';
    }

    init(_parameters: ContentRendererInitParams): void {
        this._dispose = render(this._componentFactory, this._element);
    }

    layout(_width: number, _height: number): void {
        // Optional: handle layout changes
    }

    update(_event: { params: Record<string, any> }): void {
        // Optional: handle parameter updates
    }

    focus(): void {
        this._element.focus();
    }

    toJSON(): object {
        return {};
    }

    dispose(): void {
        if (this._dispose) {
            this._dispose();
            this._dispose = null;
        }
    }
}

// ============================================================================
// Custom Tab Renderer
// ============================================================================

class SolidTabRenderer {
    private _element: HTMLElement;
    private _title: string;
    private _icon?: string;

    get element(): HTMLElement {
        return this._element;
    }

    constructor(title: string, icon?: string) {
        this._title = title;
        this._icon = icon;
        this._element = document.createElement('div');
        this._element.className = 'dockview-solid-tab';
        this._updateContent();
    }

    private _updateContent(): void {
        this._element.innerHTML = `
      ${this._icon ? `<span class="tab-icon">${this._icon}</span>` : ''}
      <span class="tab-title">${this._title}</span>
    `;
    }

    init(): void { }
    dispose(): void { }
}

// ============================================================================
// DockLayout Component
// ============================================================================

export function DockLayout(props: DockLayoutProps) {
    let containerRef: HTMLDivElement | undefined;
    let resizeObserver: ResizeObserver | null = null;
    const [api, setApi] = createSignal<DockviewComponent | null>(null);
    const panelParamsMap = getPanelParamsMap();

    onMount(() => {
        if (!containerRef) return;

        // Add theme class
        const themeClass = props.theme || 'dockview-theme-abyss';
        containerRef.classList.add(themeClass);

        // Build panel params map for initial panels
        if (props.initialLayout) {
            for (const config of props.initialLayout.panels) {
                if (config.params) {
                    panelParamsMap.set(config.id, config.params);
                }
            }
        }

        // Merge user options with defaults
        const dockviewOptions: DockviewComponentOptions = {
            ...props.options,
            // Enable drag and drop with visible drop zones
            disableDnd: false,
            createComponent: (options) => {
                // options.name is the "component" property from addPanel()
                // options.id is the panel's unique ID
                const panelType = options.name;
                console.log('[DockLayout] createComponent called:', { id: options.id, name: options.name, panelType });

                // Find component factory
                const componentFactory = props.panels[panelType];
                if (!componentFactory) {
                    console.warn(`No component registered for panel type: ${panelType}`);
                    return new SolidPanelRenderer(() => <div>Unknown panel: {panelType}</div>);
                }

                // Get params for this panel
                const params = panelParamsMap.get(options.id) || {};
                console.log('[DockLayout] Creating panel with params:', params);

                return new SolidPanelRenderer(() => componentFactory(params));
            },
            // Use default tab component for proper drag & drop support
        };

        // Create dockview instance
        const dockview = new DockviewComponent(containerRef, dockviewOptions);

        // Debug: log all drag events and overlay events
        dockview.onWillDragPanel((e) => {
            console.log('[DockLayout] onWillDragPanel:', e);
        });
        dockview.onWillDragGroup((e) => {
            console.log('[DockLayout] onWillDragGroup:', e);
        });
        dockview.onDidDrop((e) => {
            console.log('[DockLayout] onDidDrop:', e);
        });
        dockview.onWillShowOverlay((e) => {
            console.log('[DockLayout] onWillShowOverlay:', e);
        });
        dockview.onUnhandledDragOverEvent((e) => {
            console.log('[DockLayout] onUnhandledDragOverEvent:', e);
        });
        dockview.onDidActivePanelChange((panel) => {
            console.log('[DockLayout] Active panel changed:', panel?.id);
        });

        // Store API
        setDockviewApi(dockview);
        setApi(() => dockview);

        // Debug: Add raw dragover listener to document to see if events exist
        document.addEventListener('dragover', (e) => {
            console.log('[DockLayout] Document dragover:', e.target, 'class:', (e.target as HTMLElement).className);
        }, true);

        // Debug: Add raw dragover listener to container
        containerRef.addEventListener('dragover', (e) => {
            console.log('[DockLayout] Raw dragover on container:', e.target);
        }, true);

        // Set up event handlers
        setupEventHandlers(dockview, props);

        // Initial layout
        const { clientWidth, clientHeight } = containerRef;
        dockview.layout(clientWidth, clientHeight);

        // Resize observer
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    dockview.layout(width, height);
                }
            }
        });
        resizeObserver.observe(containerRef);

        // Set up initial layout
        if (props.initialLayout) {
            setupInitialLayout(dockview, props.initialLayout);
        }

        // Notify ready
        if (props.onReady) {
            props.onReady(dockview);
        }
    });

    onCleanup(() => {
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }

        const dockview = getDockviewApi();
        if (dockview) {
            dockview.dispose();
            setDockviewApi(null);
        }
    });

    const contextValue: DockviewContextValue = {
        api,
        panelParams: panelParamsMap,
    };

    return (
        <DockviewContext.Provider value={contextValue}>
            <div ref={containerRef} class="dockview-container" />
        </DockviewContext.Provider>
    );
}

// ============================================================================
// Event Handlers Setup
// ============================================================================

function setupEventHandlers(dockview: DockviewComponent, props: DockLayoutProps) {
    // Panel events
    if (props.onDidAddPanel) {
        dockview.onDidAddPanel(props.onDidAddPanel);
    }
    if (props.onDidRemovePanel) {
        dockview.onDidRemovePanel(props.onDidRemovePanel);
    }
    if (props.onDidActivePanelChange) {
        dockview.onDidActivePanelChange(props.onDidActivePanelChange);
    }
    if (props.onDidMovePanel) {
        dockview.onDidMovePanel(props.onDidMovePanel);
    }

    // Group events
    if (props.onDidAddGroup) {
        dockview.onDidAddGroup(props.onDidAddGroup);
    }
    if (props.onDidRemoveGroup) {
        dockview.onDidRemoveGroup(props.onDidRemoveGroup);
    }
    if (props.onDidActiveGroupChange) {
        dockview.onDidActiveGroupChange(props.onDidActiveGroupChange);
    }

    // Drag & Drop events
    if (props.onDidDrop) {
        dockview.onDidDrop(props.onDidDrop);
    }
    if (props.onWillDrop) {
        dockview.onWillDrop(props.onWillDrop);
    }
    if (props.onWillDragPanel) {
        dockview.onWillDragPanel(props.onWillDragPanel);
    }
    if (props.onWillDragGroup) {
        dockview.onWillDragGroup(props.onWillDragGroup);
    }
    if (props.onWillShowOverlay) {
        dockview.onWillShowOverlay(props.onWillShowOverlay);
    }
    if (props.onUnhandledDragOverEvent) {
        dockview.onUnhandledDragOverEvent(props.onUnhandledDragOverEvent);
    }

    // Layout events
    if (props.onDidLayoutChange) {
        dockview.onDidLayoutChange(props.onDidLayoutChange);
    }
    if (props.onDidLayoutFromJSON) {
        dockview.onDidLayoutFromJSON(props.onDidLayoutFromJSON);
    }

    // Maximization events
    if (props.onDidMaximizedGroupChange) {
        dockview.onDidMaximizedGroupChange(props.onDidMaximizedGroupChange);
    }

    // Popout group events
    if (props.onDidPopoutGroupSizeChange) {
        dockview.onDidPopoutGroupSizeChange(props.onDidPopoutGroupSizeChange);
    }
    if (props.onDidPopoutGroupPositionChange) {
        dockview.onDidPopoutGroupPositionChange(props.onDidPopoutGroupPositionChange);
    }
    if (props.onDidOpenPopoutWindowFail) {
        dockview.onDidOpenPopoutWindowFail(props.onDidOpenPopoutWindowFail);
    }
}

// ============================================================================
// Initial Layout Setup
// ============================================================================

function setupInitialLayout(
    dockview: DockviewComponent,
    config: InitialLayoutConfig
) {
    for (const panelConfig of config.panels) {
        const options: AddPanelOptions = {
            id: panelConfig.id,
            component: panelConfig.type, // Use type as component name
            title: panelConfig.title || panelConfig.id,
        };

        // Add position if specified
        if (panelConfig.position) {
            options.position = {
                referencePanel: panelConfig.position.referencePanel,
                direction: panelConfig.position.direction,
            };
        }

        const panel = dockview.addPanel(options);

        // Apply sidebar style if needed
        if (panelConfig.sidebarStyle && panel) {
            const group = panel.group;
            if (group) {
                group.locked = 'no-drop-target';
                group.header.hidden = true;
            }
        }

        // Apply size if specified
        if (panelConfig.size && panel) {
            panel.api.setSize(panelConfig.size);
        }
    }
}

// ============================================================================
// Public API Functions
// ============================================================================

export function addPanel(
    type: string,
    options?: {
        id?: string;
        title?: string;
        params?: Record<string, any>;
        position?: { referencePanel: string; direction: 'left' | 'right' | 'above' | 'below' | 'within' };
        sidebarStyle?: boolean;
    }
): IDockviewPanel | undefined {
    const dockview = getDockviewApi();
    if (!dockview) {
        console.warn('Dockview not initialized');
        return undefined;
    }

    const panelId = options?.id || `${type}-${Date.now()}`;

    // Check if panel already exists
    const existing = dockview.getPanel(panelId);
    if (existing) {
        existing.api.setActive();
        return existing as unknown as IDockviewPanel;
    }

    // Store params for this panel before creating it
    if (options?.params) {
        const panelParamsMap = getPanelParamsMap();
        panelParamsMap.set(panelId, options.params);
    }

    const addOptions: AddPanelOptions = {
        id: panelId,
        component: type, // This becomes options.name in createComponent
        title: options?.title || type,
    };

    if (options?.position) {
        addOptions.position = options.position;
    }

    console.log('[DockLayout] addPanel:', { type, panelId, options: addOptions });
    const panel = dockview.addPanel(addOptions);

    if (options?.sidebarStyle && panel) {
        const group = panel.group;
        if (group) {
            group.locked = 'no-drop-target';
            group.header.hidden = true;
        }
    }

    return panel;
}

export function getPanel(id: string) {
    const dockview = getDockviewApi();
    return dockview?.getPanel(id);
}

export function closePanel(id: string): void {
    const panel = getPanel(id);
    if (panel) {
        panel.api.close();
    }
}

export function activatePanel(id: string): void {
    const panel = getPanel(id);
    if (panel) {
        panel.api.setActive();
    }
}

export function getDockview(): DockviewComponent | null {
    return getDockviewApi();
}

// ============================================================================
// Group Management
// ============================================================================

export function addGroup(options?: AddGroupOptions): DockviewGroupPanel | undefined {
    const dockview = getDockviewApi();
    return dockview?.addGroup(options);
}

export function getGroup(id: string): DockviewGroupPanel | undefined {
    const dockview = getDockviewApi();
    // Find group by iterating through groups
    return dockview?.groups.find(g => g.id === id);
}

export function removeGroup(group: DockviewGroupPanel): void {
    const dockview = getDockviewApi();
    dockview?.removeGroup(group);
}

export function getAllGroups(): DockviewGroupPanel[] {
    const dockview = getDockviewApi();
    return dockview?.groups ?? [];
}

export function getActiveGroup(): DockviewGroupPanel | undefined {
    const dockview = getDockviewApi();
    return dockview?.activeGroup;
}

export function getActivePanel(): IDockviewPanel | undefined {
    const dockview = getDockviewApi();
    return dockview?.activePanel;
}

export function getAllPanels(): IDockviewPanel[] {
    const dockview = getDockviewApi();
    return dockview?.panels ?? [];
}

export function getTotalPanels(): number {
    const dockview = getDockviewApi();
    return dockview?.totalPanels ?? 0;
}

// ============================================================================
// Serialization
// ============================================================================

export function toJSON(): SerializedDockview | undefined {
    const dockview = getDockviewApi();
    return dockview?.toJSON();
}

export function fromJSON(data: SerializedDockview): void {
    const dockview = getDockviewApi();
    dockview?.fromJSON(data);
}

// ============================================================================
// Floating & Popout Groups
// ============================================================================

export function addFloatingGroup(
    item: DockviewPanel | DockviewGroupPanel,
    options?: FloatingGroupOptions
): void {
    const dockview = getDockviewApi();
    dockview?.addFloatingGroup(item, options);
}

export function addPopoutGroup(
    item: DockviewPanel | DockviewGroupPanel,
    options?: {
        position?: { left: number; top: number; width: number; height: number };
        popoutUrl?: string;
        onDidOpen?: (event: { id: string; window: Window }) => void;
        onWillClose?: (event: { id: string; window: Window }) => void;
    }
): Promise<boolean> | undefined {
    const dockview = getDockviewApi();
    return dockview?.addPopoutGroup(item, options);
}

// ============================================================================
// Navigation
// ============================================================================

export function moveToNext(options?: MovementOptions): void {
    const dockview = getDockviewApi();
    dockview?.moveToNext(options);
}

export function moveToPrevious(options?: MovementOptions): void {
    const dockview = getDockviewApi();
    dockview?.moveToPrevious(options);
}

// ============================================================================
// Maximization
// ============================================================================

export function maximizeGroup(group: DockviewGroupPanel): void {
    const dockview = getDockviewApi();
    dockview?.maximizeGroup(group);
}

export function exitMaximizedGroup(): void {
    const dockview = getDockviewApi();
    dockview?.exitMaximizedGroup();
}

export function hasMaximizedGroup(): boolean {
    const dockview = getDockviewApi();
    return dockview?.hasMaximizedGroup() ?? false;
}

// ============================================================================
// Layout Control
// ============================================================================

export function clear(): void {
    const dockview = getDockviewApi();
    dockview?.clear();
}

export function closeAllGroups(): void {
    const dockview = getDockviewApi();
    dockview?.closeAllGroups();
}

export function focus(): void {
    const dockview = getDockviewApi();
    dockview?.focus();
}

export function getSize(): { width: number; height: number } | undefined {
    const dockview = getDockviewApi();
    if (!dockview) return undefined;
    return { width: dockview.width, height: dockview.height };
}

export function layout(width: number, height: number, force?: boolean): void {
    const dockview = getDockviewApi();
    dockview?.layout(width, height, force);
}

// ============================================================================
// Visibility
// ============================================================================

export function setGroupVisible(group: DockviewGroupPanel, visible: boolean): void {
    const dockview = getDockviewApi();
    dockview?.setVisible(group, visible);
}

// ============================================================================
// Move Panel Between Groups
// ============================================================================

export function moveGroupOrPanel(options: {
    from: { groupId: string; panelId?: string };
    to: { group: DockviewGroupPanel; position: Position; index?: number };
}): void {
    const dockview = getDockviewApi();
    dockview?.moveGroupOrPanel(options);
}

// ============================================================================
// Panel Removal
// ============================================================================

export function removePanel(panel: IDockviewPanel): void {
    const dockview = getDockviewApi();
    dockview?.removePanel(panel);
}

// ============================================================================
// Options Update
// ============================================================================

export function updateOptions(options: Partial<DockviewComponentOptions>): void {
    const dockview = getDockviewApi();
    dockview?.updateOptions(options);
}

// ============================================================================
// Size Constraints
// ============================================================================

export function getSizeConstraints(): {
    minimumWidth: number;
    minimumHeight: number;
    maximumWidth: number;
    maximumHeight: number;
} | undefined {
    const dockview = getDockviewApi();
    if (!dockview) return undefined;
    return {
        minimumWidth: dockview.minimumWidth,
        minimumHeight: dockview.minimumHeight,
        maximumWidth: dockview.maximumWidth,
        maximumHeight: dockview.maximumHeight,
    };
}

// ============================================================================
// Utility
// ============================================================================

export function getId(): string | undefined {
    const dockview = getDockviewApi();
    return dockview?.id;
}

export function getGroupCount(): number {
    const dockview = getDockviewApi();
    return dockview?.size ?? 0;
}
