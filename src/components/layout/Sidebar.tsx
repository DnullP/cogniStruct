/**
 * @fileoverview 侧边栏组件
 *
 * 本模块提供基于 paneview-core 的可折叠卡片侧边栏。
 * 支持动态添加/移除卡片、拖拽排序和持久化布局。
 *
 * @module components/layout/Sidebar
 *
 * @features
 * - 可折叠卡片容器
 * - 拖拽排序
 * - HMR 支持（热模块替换）
 * - 布局序列化/反序列化
 *
 * @example
 * ```tsx
 * import { Sidebar, addCard, removeCard } from './layout';
 *
 * <Sidebar
 *   position="left"
 *   cards={cardComponents}
 *   initialLayout={sidebarConfig}
 *   width={250}
 * />
 * ```
 *
 * @exports Sidebar - 侧边栏组件
 * @exports getSidebar - 获取侧边栏 API
 * @exports addCard - 添加卡片
 * @exports getCard - 获取卡片
 * @exports removeCard - 移除卡片
 * @exports moveCard - 移动卡片
 * @exports getAllCards - 获取所有卡片
 * @exports sidebarToJSON - 序列化侧边栏
 * @exports sidebarFromJSON - 反序列化侧边栏
 * @exports clearSidebar - 清空侧边栏
 */

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
/* 样式：Sidebar.css - 侧边栏和卡片样式 */
import './Sidebar.css';

/* ==========================================================================
   类型定义
   ========================================================================== */

/**
 * 卡片组件工厂函数类型
 *
 * @template T - 组件属性类型
 * @param props - 组件属性
 * @returns JSX 元素
 */
export type CardComponentFactory<T = any> = (props: T) => JSX.Element;

/**
 * 卡片定义接口
 *
 * @template T - 组件属性类型
 */
export interface CardDefinition<T = any> {
    /** 卡片唯一标识 */
    id: string;
    /** 卡片组件工厂 */
    component: CardComponentFactory<T>;
    /** 卡片标题 */
    title: string;
    /** 卡片图标 */
    icon?: string;
    /** 是否展开 */
    expanded?: boolean;
    /** 最小高度 */
    minimumBodySize?: number;
    /** 最大高度 */
    maximumBodySize?: number;
}

/**
 * 侧边栏组件属性接口
 */
export interface SidebarProps {
    /** 卡片组件映射（类型 -> 工厂函数） */
    cards: Record<string, CardComponentFactory>;
    /** 初始布局配置 */
    initialLayout?: SidebarLayoutConfig;
    /** Paneview 就绪回调 */
    onReady?: (api: PaneviewComponent) => void;
    /** 位置：左侧或右侧 */
    position: 'left' | 'right';
    /** 侧边栏宽度 (px) */
    width?: number;
    /** Paneview 选项 */
    options?: Partial<PaneviewComponentOptions>;
    /** 添加视图事件 */
    onDidAddView?: (panel: IPaneviewPanel) => void;
    /** 移除视图事件 */
    onDidRemoveView?: (panel: IPaneviewPanel) => void;
    /** 拖放事件 */
    onDidDrop?: (event: PaneviewDropEvent) => void;
    /** 布局变更事件 */
    onDidLayoutChange?: () => void;
    /** 未处理的拖拽事件 */
    onUnhandledDragOverEvent?: (event: PaneviewDndOverlayEvent) => void;
}

/**
 * 侧边栏布局配置接口
 */
export interface SidebarLayoutConfig {
    /** 卡片配置列表 */
    cards: SidebarCardConfig[];
}

/**
 * 侧边栏卡片配置接口
 */
export interface SidebarCardConfig {
    /** 卡片唯一标识 */
    id: string;
    /** 卡片类型（对应 cards 映射的键） */
    type: string;
    /** 卡片标题 */
    title: string;
    /** 卡片参数 */
    params?: Record<string, any>;
    /** 是否展开 */
    expanded?: boolean;
    /** 初始大小 */
    size?: number;
    /** 最小高度 */
    minimumBodySize?: number;
    /** 最大高度 */
    maximumBodySize?: number;
}

/* ==========================================================================
   全局 API 存储（支持 HMR）
   ========================================================================== */

/** 侧边栏拖拽数据接口 */
interface SidebarDragData {
    cardId: string;
    fromPosition: 'left' | 'right';
}

declare global {
    interface Window {
        __paneviewApis?: Map<string, PaneviewComponent>;
        __paneviewCardParams?: Map<string, Map<string, Record<string, any>>>;
        __paneviewCardTypes?: Map<string, string>; /* cardId -> component type */
        __sidebarDragData?: SidebarDragData; /* 跨边栏拖拽数据 */
    }
}

/**
 * 获取 Paneview API 实例
 *
 * @param position - 侧边栏位置
 * @returns Paneview API 或 null
 * @internal
 */
function getPaneviewApi(position: string): PaneviewComponent | null {
    return window.__paneviewApis?.get(position) || null;
}

/**
 * 存储 Paneview API 实例
 *
 * @param position - 侧边栏位置
 * @param api - Paneview API 实例
 * @internal
 */
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

/**
 * 获取卡片类型映射
 *
 * @returns 卡片类型映射 (cardId -> component type)
 * @internal
 */
function getCardTypeMap(): Map<string, string> {
    if (!window.__paneviewCardTypes) {
        window.__paneviewCardTypes = new Map();
    }
    return window.__paneviewCardTypes;
}

/**
 * 获取卡片参数映射
 *
 * @param position - 侧边栏位置
 * @returns 卡片参数映射
 * @internal
 */
function getCardParamsMap(position: string): Map<string, Record<string, any>> {
    if (!window.__paneviewCardParams) {
        window.__paneviewCardParams = new Map();
    }
    if (!window.__paneviewCardParams.has(position)) {
        window.__paneviewCardParams.set(position, new Map());
    }
    return window.__paneviewCardParams.get(position)!;
}

/* ==========================================================================
   SolidJS 面板渲染器
   ========================================================================== */

/**
 * SolidJS 面板主体渲染器
 *
 * 将 SolidJS 组件渲染到 Paneview 面板主体中
 *
 * @internal
 */
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
        /* 可选：处理更新 */
    }

    dispose(): void {
        if (this._dispose) {
            this._dispose();
            this._dispose = null;
        }
    }
}

/* ==========================================================================
   SolidJS 面板头部渲染器
   ========================================================================== */

/**
 * SolidJS 面板头部渲染器
 *
 * 渲染 Paneview 面板的头部（标题和图标）
 * 支持跨边栏拖拽移动
 *
 * @internal
 */
class SolidPaneHeaderRenderer implements IPanePart {
    private _element: HTMLElement;
    private _title: string;
    private _icon?: string;
    private _panelId?: string;
    private _position?: 'left' | 'right';

    get element(): HTMLElement {
        return this._element;
    }

    constructor(title: string, icon?: string, panelId?: string, position?: 'left' | 'right') {
        this._title = title;
        this._icon = icon;
        this._panelId = panelId;
        this._position = position;
        this._element = document.createElement('div');
        this._element.className = 'sidebar-card-header sidebar-card-draggable';
        this._element.draggable = true;
        this._updateContent();
        this._setupDragEvents();
    }

    private _updateContent(): void {
        this._element.innerHTML = `
            ${this._icon ? `<span class="sidebar-card-icon">${this._icon}</span>` : ''}
            <span class="sidebar-card-title">${this._title}</span>
            <span class="sidebar-card-drag-hint" title="Drag to move between sidebars">⋮⋮</span>
        `;
    }

    private _setupDragEvents(): void {
        if (!this._panelId || !this._position) return;

        this._element.addEventListener('dragstart', (e) => {
            /* 设置拖拽数据到全局变量 */
            window.__sidebarDragData = {
                cardId: this._panelId!,
                fromPosition: this._position!,
            };
            /* 设置拖拽效果 */
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', this._panelId!);
            }
            /* 添加拖拽样式 */
            this._element.classList.add('dragging');
        });

        this._element.addEventListener('dragend', () => {
            /* 清理拖拽状态 */
            this._element.classList.remove('dragging');
            /* 延迟清理拖拽数据，给 drop 事件处理时间 */
            setTimeout(() => {
                window.__sidebarDragData = undefined;
            }, 100);
        });
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

/* ==========================================================================
   事件处理器设置
   ========================================================================== */

/**
 * 设置 Paneview 事件处理器
 *
 * 将 SidebarProps 中的事件回调绑定到 Paneview 实例
 *
 * @param paneview - Paneview 实例
 * @param props - 侧边栏属性（包含事件回调）
 * @internal
 */
function setupEventHandlers(paneview: PaneviewComponent, props: SidebarProps) {
    /* 添加视图事件 - 新卡片添加时触发 */
    if (props.onDidAddView) {
        paneview.onDidAddView(props.onDidAddView);
    }

    /* 移除视图事件 - 卡片移除时触发 */
    if (props.onDidRemoveView) {
        paneview.onDidRemoveView(props.onDidRemoveView);
    }

    /* 拖放事件 - 卡片拖放完成时触发 */
    if (props.onDidDrop) {
        paneview.onDidDrop(props.onDidDrop);
    }

    /* 布局变更事件 - 任何布局变化时触发 */
    if (props.onDidLayoutChange) {
        paneview.onDidLayoutChange(props.onDidLayoutChange);
    }

    /* 未处理拖拽事件 - 处理跨边栏拖拽 */
    paneview.onUnhandledDragOverEvent((event: PaneviewDndOverlayEvent) => {
        /* 获取拖拽的面板数据 */
        const paneData = event.getData();

        if (paneData) {
            /* 检查是否来自另一个边栏 */
            const sourceViewId = paneData.viewId;
            const currentViewId = paneview.id;

            /* 如果来自不同的 paneview（另一个边栏），接受拖拽 */
            if (sourceViewId !== currentViewId) {
                event.accept();
            }
        }

        /* 调用外部处理器（如果提供） */
        if (props.onUnhandledDragOverEvent) {
            props.onUnhandledDragOverEvent(event);
        }
    });

    /* 监听拖放完成事件 - 处理跨边栏移动 */
    paneview.onDidDrop((event) => {
        /* 获取拖拽的面板数据 */
        const paneData = event.getData();
        if (paneData) {
            const sourceViewId = paneData.viewId;
            const currentViewId = paneview.id;
            const panelId = paneData.paneId;

            /* 如果来自不同的 paneview（另一个边栏） */
            if (sourceViewId !== currentViewId && panelId) {
                /* 确定源边栏位置 */
                const sourcePosition = props.position === 'left' ? 'right' : 'left';

                /* 延迟执行移动，确保拖拽操作完成 */
                setTimeout(() => {
                    moveCardToSidebar(panelId, sourcePosition, props.position);
                }, 0);
            }
        }
    });
}

/* ==========================================================================
   初始布局设置
   ========================================================================== */

/**
 * 设置侧边栏初始布局
 *
 * 根据配置创建初始卡片，恢复之前保存的布局状态
 *
 * @param paneview - Paneview 实例
 * @param config - 布局配置
 * @param cards - 卡片组件工厂映射
 * @param position - 侧边栏位置
 * @internal
 */
function setupInitialLayout(
    paneview: PaneviewComponent,
    config: SidebarLayoutConfig,
    cards: Record<string, CardComponentFactory>,
    position: string
) {
    /* 获取卡片参数映射，用于存储每个卡片的自定义参数 */
    const paramsMap = getCardParamsMap(position);

    /* 遍历配置创建卡片 */
    for (const cardConfig of config.cards) {
        /* 查找对应的组件工厂 */
        const componentFactory = cards[cardConfig.type];
        if (!componentFactory) {
            console.warn(`Card component not found: ${cardConfig.type}`);
            continue;
        }

        /* 存储卡片参数供后续使用 */
        if (cardConfig.params) {
            paramsMap.set(cardConfig.id, cardConfig.params);
        }

        /* 存储卡片类型供跨边栏移动使用 */
        getCardTypeMap().set(cardConfig.id, cardConfig.type);

        /* 添加面板到 Paneview */
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

/* ==========================================================================
   侧边栏组件
   ========================================================================== */

/**
 * 侧边栏组件
 *
 * 基于 Paneview 实现的可折叠卡片侧边栏。
 * 支持拖拽排序、动态添加/移除卡片、HMR 热更新。
 *
 * @component
 *
 * @param props - 组件属性 {@link SidebarProps}
 * @returns 侧边栏容器
 *
 * @example
 * ```tsx
 * <Sidebar
 *   position="left"
 *   cards={{ fileTree: FileTree, search: SearchBar }}
 *   initialLayout={{ cards: [...] }}
 *   width={280}
 *   onReady={(api) => console.log('Ready')}
 * />
 * ```
 */
export function Sidebar(props: SidebarProps) {
    /* DOM 容器引用 */
    let containerRef: HTMLDivElement | undefined;

    /* Paneview API 信号（用于响应式更新） */
    const [, setPaneviewApiSignal] = createSignal<PaneviewComponent | null>(null);

    onMount(() => {
        if (!containerRef) return;

        /* 检查是否存在现有实例（HMR 热更新场景） */
        let paneview = getPaneviewApi(props.position);

        if (!paneview) {
            /* ========================================
               创建新的 Paneview 实例
               ======================================== */
            paneview = new PaneviewComponent(containerRef, {
                /**
                 * 创建面板主体组件
                 *
                 * 根据组件名称查找工厂函数并创建渲染器
                 */
                createComponent: (options) => {
                    const componentFactory = props.cards[options.name] || props.cards['default'];
                    if (!componentFactory) {
                        throw new Error(`Card component not found: ${options.name}`);
                    }
                    return new SolidPaneBodyRenderer(() => componentFactory({}));
                },

                /**
                 * 创建面板头部组件
                 *
                 * 渲染卡片标题栏（使用拖拽实现跨边栏移动）
                 */
                createHeaderComponent: (options) => {
                    return new SolidPaneHeaderRenderer(
                        options.name,
                        undefined,
                        options.id,
                        props.position
                    );
                },

                /* 启用拖拽排序 */
                disableDnd: false,
                ...props.options,
            });

            /* 存储 API 引用到全局（支持 HMR） */
            setPaneviewApi(props.position, paneview);

            /* 绑定事件处理器 */
            setupEventHandlers(paneview, props);

            /* 恢复初始布局 */
            if (props.initialLayout) {
                setupInitialLayout(paneview, props.initialLayout, props.cards, props.position);
            }
        } else {
            /* ========================================
               HMR：重用现有实例
               ======================================== */
            containerRef.appendChild(paneview.element);
        }

        /* 更新信号 */
        setPaneviewApiSignal(paneview);

        /* 通知外部组件就绪 */
        if (props.onReady) {
            props.onReady(paneview);
        }

        /* 初始化布局尺寸 */
        const rect = containerRef.getBoundingClientRect();
        paneview.layout(rect.width, rect.height);

        /* ========================================
           尺寸监听
           ======================================== */
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                paneview?.layout(width, height);
            }
        });
        resizeObserver.observe(containerRef);

        /* ========================================
           跨边栏拖拽支持（原生 HTML5 拖拽事件）
           ======================================== */
        const handleDragOver = (e: DragEvent) => {
            /* 检查是否是来自另一个 sidebar 的拖拽 */
            const dragData = window.__sidebarDragData;
            if (dragData && dragData.fromPosition !== props.position) {
                e.preventDefault();
                e.stopPropagation();
                /* 显示拖拽指示器 */
                containerRef.classList.add('sidebar-drop-target');
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            /* 确保是离开整个容器而不是进入子元素 */
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (!containerRef.contains(relatedTarget)) {
                containerRef.classList.remove('sidebar-drop-target');
            }
        };

        const handleDrop = (e: DragEvent) => {
            containerRef.classList.remove('sidebar-drop-target');
            const dragData = window.__sidebarDragData;
            if (dragData && dragData.fromPosition !== props.position) {
                e.preventDefault();
                e.stopPropagation();
                /* 执行跨边栏移动 */
                moveCardToSidebar(dragData.cardId, dragData.fromPosition, props.position);
                /* 清理拖拽数据 */
                window.__sidebarDragData = undefined;
            }
        };

        containerRef.addEventListener('dragover', handleDragOver);
        containerRef.addEventListener('dragleave', handleDragLeave);
        containerRef.addEventListener('drop', handleDrop);

        /* 清理 - 仅断开 ResizeObserver，保留 Paneview 以支持 HMR */
        onCleanup(() => {
            resizeObserver.disconnect();
            containerRef.removeEventListener('dragover', handleDragOver);
            containerRef.removeEventListener('dragleave', handleDragLeave);
            containerRef.removeEventListener('drop', handleDrop);
            /* 注意：不销毁 paneview 以便 HMR 复用 */
        });
    });

    /* 渲染侧边栏容器 */
    return (
        <div
            ref={containerRef}
            class={`sidebar sidebar-${props.position}`}
            style={{ width: props.width ? `${props.width}px` : '250px' }}
        />
    );
}

/* ==========================================================================
   公共 API 函数
   ========================================================================== */

/**
 * 获取侧边栏 API 实例
 *
 * @param position - 侧边栏位置
 * @returns Paneview API 实例，未初始化时返回 null
 *
 * @example
 * ```ts
 * const leftSidebar = getSidebar('left');
 * leftSidebar?.layout(300, 800);
 * ```
 */
export function getSidebar(position: 'left' | 'right'): PaneviewComponent | null {
    return getPaneviewApi(position);
}

/**
 * 添加卡片到侧边栏
 *
 * @param position - 侧边栏位置
 * @param type - 卡片类型（对应 cards 映射的键）
 * @param options - 可选配置
 * @param options.id - 卡片 ID（默认自动生成）
 * @param options.title - 卡片标题
 * @param options.params - 卡片参数
 * @param options.expanded - 是否展开
 * @param options.size - 初始大小
 * @param options.index - 插入位置
 * @returns 新添加的面板，或已存在的面板
 *
 * @example
 * ```ts
 * addCard('left', 'search', {
 *   id: 'search-panel',
 *   title: '搜索',
 *   expanded: true
 * });
 * ```
 */
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

    /* 生成或使用提供的 ID */
    const cardId = options?.id || `${type}-${Date.now()}`;

    /* 检查卡片是否已存在 */
    const existing = paneview.getPanel(cardId);
    if (existing) {
        return existing;
    }

    /* 存储自定义参数 */
    if (options?.params) {
        getCardParamsMap(position).set(cardId, options.params);
    }

    /* 存储卡片类型供跨边栏移动使用 */
    getCardTypeMap().set(cardId, type);

    /* 添加面板 */
    return paneview.addPanel({
        id: cardId,
        component: type,
        title: options?.title || type,
        isExpanded: options?.expanded !== false,
        size: options?.size,
        index: options?.index,
    });
}

/**
 * 获取指定卡片
 *
 * @param position - 侧边栏位置
 * @param id - 卡片 ID
 * @returns 面板实例，不存在时返回 undefined
 */
export function getCard(position: 'left' | 'right', id: string): IPaneviewPanel | undefined {
    const paneview = getPaneviewApi(position);
    return paneview?.getPanel(id);
}

/**
 * 移除卡片
 *
 * @param position - 侧边栏位置
 * @param panel - 要移除的面板
 */
export function removeCard(position: 'left' | 'right', panel: PaneviewPanel): void {
    const paneview = getPaneviewApi(position);
    paneview?.removePanel(panel);
}

/**
 * 移动卡片位置
 *
 * @param position - 侧边栏位置
 * @param from - 原索引
 * @param to - 目标索引
 */
export function moveCard(position: 'left' | 'right', from: number, to: number): void {
    const paneview = getPaneviewApi(position);
    paneview?.movePanel(from, to);
}

/**
 * 获取侧边栏所有卡片
 *
 * @param position - 侧边栏位置
 * @returns 面板数组
 */
export function getAllCards(position: 'left' | 'right'): IPaneviewPanel[] {
    const paneview = getPaneviewApi(position);
    return paneview?.panels ?? [];
}

/**
 * 序列化侧边栏布局
 *
 * 用于持久化保存布局状态
 *
 * @param position - 侧边栏位置
 * @returns 序列化的布局数据
 */
export function sidebarToJSON(position: 'left' | 'right'): SerializedPaneview | undefined {
    const paneview = getPaneviewApi(position);
    return paneview?.toJSON();
}

/**
 * 从序列化数据恢复侧边栏布局
 *
 * @param position - 侧边栏位置
 * @param data - 序列化的布局数据
 */
export function sidebarFromJSON(position: 'left' | 'right', data: SerializedPaneview): void {
    const paneview = getPaneviewApi(position);
    paneview?.fromJSON(data);
}

/**
 * 清空侧边栏所有卡片
 *
 * @param position - 侧边栏位置
 */
export function clearSidebar(position: 'left' | 'right'): void {
    const paneview = getPaneviewApi(position);
    paneview?.clear();
}

/**
 * 移动卡片到另一个侧边栏
 *
 * @param cardId - 卡片 ID
 * @param fromPosition - 源侧边栏位置
 * @param toPosition - 目标侧边栏位置
 * @param options - 可选配置
 * @param options.index - 目标位置索引
 * @returns 是否移动成功
 *
 * @example
 * ```ts
 * // 将搜索卡片从左边栏移动到右边栏
 * moveCardToSidebar('search', 'left', 'right');
 * ```
 */
export function moveCardToSidebar(
    cardId: string,
    fromPosition: 'left' | 'right',
    toPosition: 'left' | 'right',
    options?: { index?: number }
): boolean {
    if (fromPosition === toPosition) {
        console.warn('Source and target sidebar are the same');
        return false;
    }

    const fromPaneview = getPaneviewApi(fromPosition);
    const toPaneview = getPaneviewApi(toPosition);

    if (!fromPaneview || !toPaneview) {
        console.warn('Sidebar not initialized');
        return false;
    }

    /* 获取源面板 */
    const panel = fromPaneview.getPanel(cardId) as PaneviewPanel | undefined;
    if (!panel) {
        console.warn(`Card not found: ${cardId}`);
        return false;
    }

    /* 从类型映射中获取组件类型 */
    const cardTypeMap = getCardTypeMap();
    const component = cardTypeMap.get(cardId) || cardId;
    const title = cardId;
    const isExpanded = panel.isExpanded();
    const size = panel.size;

    /* 从源侧边栏移除 */
    fromPaneview.removePanel(panel);

    /* 添加到目标侧边栏 */
    toPaneview.addPanel({
        id: cardId,
        component,
        title,
        isExpanded,
        size,
        index: options?.index,
    });

    return true;
}

/**
 * 获取卡片当前所在的侧边栏位置
 *
 * @param cardId - 卡片 ID
 * @returns 侧边栏位置，如果卡片不存在则返回 null
 */
export function getCardPosition(cardId: string): 'left' | 'right' | null {
    const leftPaneview = getPaneviewApi('left');
    const rightPaneview = getPaneviewApi('right');

    if (leftPaneview?.getPanel(cardId)) {
        return 'left';
    }
    if (rightPaneview?.getPanel(cardId)) {
        return 'right';
    }
    return null;
}
