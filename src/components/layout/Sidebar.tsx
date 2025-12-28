import { onMount, onCleanup, createSignal, JSX } from 'solid-js';
import { render } from 'solid-js/web';
import {
    PaneviewComponent,
    IPaneviewPanel,
    PaneviewPanel,
    SerializedPaneview,
    PaneviewDropEvent,
    PaneviewComponentOptions,
    PaneviewDndOverlayEvent,
    IPanePart,
    PanelUpdateEvent,
    Parameters,
} from 'dockview-core';
import 'dockview-core/dist/styles/dockview.css';
import './Sidebar.css';

// ============================================================================
// Types
// ============================================================================

export type CardComponentFactory<T = any> = (props: T) => JSX.Element;

export interface CardDefinition<T = any> {
    id: string;
    component: CardComponentFactory<T>;
    title: string;
    icon?: string;
    expanded?: boolean;
    minimumBodySize?: number;
    maximumBodySize?: number;
}

export interface SidebarProps {
    /** Card definitions - map of card type to component factory */
    cards: Record<string, CardComponentFactory>;
    /** Initial layout configuration */
    initialLayout?: SidebarLayoutConfig;
    /** Called when paneview is ready */
    onReady?: (api: PaneviewComponent) => void;
    /** Position: left or right */
    position: 'left' | 'right';
    /** Width of the sidebar */
    width?: number;
    /** Paneview options */
    options?: Partial<PaneviewComponentOptions>;
    /** Event handlers */
    onDidAddView?: (panel: IPaneviewPanel) => void;
    onDidRemoveView?: (panel: IPaneviewPanel) => void;
    onDidDrop?: (event: PaneviewDropEvent) => void;
    onDidLayoutChange?: () => void;
    onUnhandledDragOverEvent?: (event: PaneviewDndOverlayEvent) => void;
}

export interface SidebarLayoutConfig {
    cards: SidebarCardConfig[];
}

export interface SidebarCardConfig {
    id: string;
    type: string;
    title: string;
    params?: Record<string, any>;
    expanded?: boolean;
    size?: number;
    minimumBodySize?: number;
    maximumBodySize?: number;
}

// ============================================================================
// Global API storage (survives HMR)
// ============================================================================

declare global {
    interface Window {
        __paneviewApis?: Map<string, PaneviewComponent>;
        __paneviewCardParams?: Map<string, Map<string, Record<string, any>>>;
    }
}

function getPaneviewApi(position: string): PaneviewComponent | null {
    return window.__paneviewApis?.get(position) || null;
}

function setPaneviewApi(position: string, api: PaneviewComponent | null): void {
    if (!window.__paneviewApis) {
        window.__paneviewApis = new Map();
    }
    if (api) {
        window.__paneviewApis.set(position, api);
    } else {
        window.__paneviewApis.delete(position);
    }
}

function getCardParamsMap(position: string): Map<string, Record<string, any>> {
    if (!window.__paneviewCardParams) {
        window.__paneviewCardParams = new Map();
    }
    if (!window.__paneviewCardParams.has(position)) {
        window.__paneviewCardParams.set(position, new Map());
    }
    return window.__paneviewCardParams.get(position)!;
}

// ============================================================================
// SolidJS Panel Body Renderer
// ============================================================================

class SolidPaneBodyRenderer implements IPanePart {
    private _element: HTMLElement;
    private _dispose: (() => void) | null = null;
    private _componentFactory: () => JSX.Element;

    get element(): HTMLElement {
        return this._element;
    }

    constructor(componentFactory: () => JSX.Element) {
        this._componentFactory = componentFactory;
        this._element = document.createElement('div');
        this._element.className = 'sidebar-card-body';
        this._element.style.width = '100%';
        this._element.style.height = '100%';
        this._element.style.overflow = 'auto';
    }

    init(): void {
        this._dispose = render(this._componentFactory, this._element);
    }

    update(): void {
        // Optional: handle updates
    }

    dispose(): void {
        if (this._dispose) {
            this._dispose();
            this._dispose = null;
        }
    }
}

// ============================================================================
// SolidJS Panel Header Renderer
// ============================================================================

class SolidPaneHeaderRenderer implements IPanePart {
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
        this._element.className = 'sidebar-card-header';
        this._updateContent();
    }

    private _updateContent(): void {
        this._element.innerHTML = `
            ${this._icon ? `<span class="sidebar-card-icon">${this._icon}</span>` : ''}
            <span class="sidebar-card-title">${this._title}</span>
        `;
    }

    init(): void {
        // Already initialized in constructor
    }

    update(_params: PanelUpdateEvent<Parameters>): void {
        // Can extract title from params if needed
    }

    dispose(): void {
        // Nothing to dispose
    }
}

// ============================================================================
// Event Handlers Setup
// ============================================================================

function setupEventHandlers(paneview: PaneviewComponent, props: SidebarProps) {
    if (props.onDidAddView) {
        paneview.onDidAddView(props.onDidAddView);
    }
    if (props.onDidRemoveView) {
        paneview.onDidRemoveView(props.onDidRemoveView);
    }
    if (props.onDidDrop) {
        paneview.onDidDrop(props.onDidDrop);
    }
    if (props.onDidLayoutChange) {
        paneview.onDidLayoutChange(props.onDidLayoutChange);
    }
    if (props.onUnhandledDragOverEvent) {
        paneview.onUnhandledDragOverEvent(props.onUnhandledDragOverEvent);
    }
}

// ============================================================================
// Initial Layout Setup
// ============================================================================

function setupInitialLayout(
    paneview: PaneviewComponent,
    config: SidebarLayoutConfig,
    cards: Record<string, CardComponentFactory>,
    position: string
) {
    const paramsMap = getCardParamsMap(position);

    for (const cardConfig of config.cards) {
        const componentFactory = cards[cardConfig.type];
        if (!componentFactory) {
            console.warn(`Card component not found: ${cardConfig.type}`);
            continue;
        }

        // Store params for later retrieval
        if (cardConfig.params) {
            paramsMap.set(cardConfig.id, cardConfig.params);
        }

        paneview.addPanel({
            id: cardConfig.id,
            component: cardConfig.type,
            title: cardConfig.title,
            isExpanded: cardConfig.expanded !== false,
            size: cardConfig.size,
            minimumBodySize: cardConfig.minimumBodySize ?? 100,
            maximumBodySize: cardConfig.maximumBodySize,
        });
    }
}

// ============================================================================
// Sidebar Component
// ============================================================================

export function Sidebar(props: SidebarProps) {
    let containerRef: HTMLDivElement | undefined;
    const [, setPaneviewApiSignal] = createSignal<PaneviewComponent | null>(null);

    onMount(() => {
        if (!containerRef) return;

        // Check for existing instance (HMR)
        let paneview = getPaneviewApi(props.position);

        if (!paneview) {
            // Create new Paneview instance
            paneview = new PaneviewComponent(containerRef, {
                createComponent: (options) => {
                    const componentFactory = props.cards[options.name] || props.cards['default'];
                    if (!componentFactory) {
                        throw new Error(`Card component not found: ${options.name}`);
                    }
                    return new SolidPaneBodyRenderer(() => componentFactory({}));
                },
                createHeaderComponent: (options) => {
                    return new SolidPaneHeaderRenderer(options.name);
                },
                disableDnd: false,
                ...props.options,
            });

            // Store reference
            setPaneviewApi(props.position, paneview);

            // Setup event handlers
            setupEventHandlers(paneview, props);

            // Setup initial layout
            if (props.initialLayout) {
                setupInitialLayout(paneview, props.initialLayout, props.cards, props.position);
            }
        } else {
            // Reuse existing instance, move to new container
            containerRef.appendChild(paneview.element);
        }

        setPaneviewApiSignal(paneview);

        // Notify ready
        if (props.onReady) {
            props.onReady(paneview);
        }

        // Initial layout
        const rect = containerRef.getBoundingClientRect();
        paneview.layout(rect.width, rect.height);

        // Handle resize
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                paneview?.layout(width, height);
            }
        });
        resizeObserver.observe(containerRef);

        onCleanup(() => {
            resizeObserver.disconnect();
            // Don't dispose paneview to survive HMR
        });
    });

    return (
        <div
            ref={containerRef}
            class={`sidebar sidebar-${props.position}`}
            style={{ width: props.width ? `${props.width}px` : '250px' }}
        />
    );
}

// ============================================================================
// Public API Functions
// ============================================================================

export function getSidebar(position: 'left' | 'right'): PaneviewComponent | null {
    return getPaneviewApi(position);
}

export function addCard(
    position: 'left' | 'right',
    type: string,
    options?: {
        id?: string;
        title?: string;
        params?: Record<string, any>;
        expanded?: boolean;
        size?: number;
        index?: number;
    }
): IPaneviewPanel | undefined {
    const paneview = getPaneviewApi(position);
    if (!paneview) {
        console.warn('Sidebar not initialized:', position);
        return undefined;
    }

    const cardId = options?.id || `${type}-${Date.now()}`;

    // Check if card already exists
    const existing = paneview.getPanel(cardId);
    if (existing) {
        return existing;
    }

    // Store params
    if (options?.params) {
        getCardParamsMap(position).set(cardId, options.params);
    }

    return paneview.addPanel({
        id: cardId,
        component: type,
        title: options?.title || type,
        isExpanded: options?.expanded !== false,
        size: options?.size,
        index: options?.index,
    });
}

export function getCard(position: 'left' | 'right', id: string): IPaneviewPanel | undefined {
    const paneview = getPaneviewApi(position);
    return paneview?.getPanel(id);
}

export function removeCard(position: 'left' | 'right', panel: PaneviewPanel): void {
    const paneview = getPaneviewApi(position);
    paneview?.removePanel(panel);
}

export function moveCard(position: 'left' | 'right', from: number, to: number): void {
    const paneview = getPaneviewApi(position);
    paneview?.movePanel(from, to);
}

export function getAllCards(position: 'left' | 'right'): IPaneviewPanel[] {
    const paneview = getPaneviewApi(position);
    return paneview?.panels ?? [];
}

export function sidebarToJSON(position: 'left' | 'right'): SerializedPaneview | undefined {
    const paneview = getPaneviewApi(position);
    return paneview?.toJSON();
}

export function sidebarFromJSON(position: 'left' | 'right', data: SerializedPaneview): void {
    const paneview = getPaneviewApi(position);
    paneview?.fromJSON(data);
}

export function clearSidebar(position: 'left' | 'right'): void {
    const paneview = getPaneviewApi(position);
    paneview?.clear();
}
