/**
 * @fileoverview Dockview 标签页布局组件
 *
 * 本模块提供基于 dockview-core 的 VS Code 风格标签页布局系统。
 * 支持拖拽分组、浮动窗口、弹出窗口等高级功能。
 *
 * @module components/layout/DockLayout
 *
 * @features
 * - 标签页分组管理
 * - 拖拽排序和分割
 * - 浮动窗口 (Floating)
 * - 弹出窗口 (Popout)
 * - 布局序列化/反序列化
 * - 最大化/还原
 * - HMR 热更新支持
 *
 * @example
 * ```tsx
 * import { DockLayout, addPanel, closePanel } from './layout';
 *
 * <DockLayout
 *   panels={{ editor: EditorPanel, graph: GraphPanel }}
 *   initialLayout={{ panels: [...] }}
 *   onReady={(api) => console.log('Ready')}
 * />
 * ```
 *
 * @exports DockLayout - Dockview 容器组件
 * @exports useDockview - 获取 Dockview API Hook
 * @exports usePanelParams - 获取面板参数 Hook
 * @exports addPanel - 添加面板
 * @exports getPanel - 获取面板
 * @exports closePanel - 关闭面板
 * @exports activatePanel - 激活面板
 * @exports getDockview - 获取 Dockview 实例
 * @exports addGroup - 添加组
 * @exports getGroup - 获取组
 * @exports removeGroup - 移除组
 * @exports getAllGroups - 获取所有组
 * @exports getActiveGroup - 获取活动组
 * @exports getActivePanel - 获取活动面板
 * @exports getAllPanels - 获取所有面板
 * @exports getTotalPanels - 获取面板总数
 * @exports toJSON - 序列化布局
 * @exports fromJSON - 反序列化布局
 * @exports addFloatingGroup - 添加浮动组
 * @exports addPopoutGroup - 添加弹出组
 * @exports moveToNext - 移动到下一个面板
 * @exports moveToPrevious - 移动到上一个面板
 * @exports maximizeGroup - 最大化组
 * @exports exitMaximizedGroup - 退出最大化
 * @exports hasMaximizedGroup - 是否有最大化组
 * @exports clear - 清空布局
 * @exports closeAllGroups - 关闭所有组
 * @exports focus - 聚焦布局
 * @exports getSize - 获取尺寸
 * @exports layout - 重新布局
 * @exports setGroupVisible - 设置组可见性
 * @exports moveGroupOrPanel - 移动组或面板
 * @exports removePanel - 移除面板
 * @exports updateOptions - 更新选项
 * @exports getSizeConstraints - 获取尺寸约束
 * @exports getId - 获取布局 ID
 * @exports getGroupCount - 获取组数量
 */

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
/* dockview-core 核心样式 */
import 'dockview-core/dist/styles/dockview.css';
/* 自定义 Dockview 主题样式 */
import './DockLayout.css';

/* ==========================================================================
   类型定义
   ========================================================================== */

/**
 * 面板类型别名
 */
export type PanelType = string;

/**
 * 面板组件工厂函数类型
 *
 * @template T - 组件属性类型
 * @param props - 组件属性
 * @returns JSX 元素
 */
export type PanelComponentFactory<T = any> = (props: T) => JSX.Element;

/**
 * 面板定义接口
 *
 * @template T - 组件属性类型
 */
export interface PanelDefinition<T = any> {
    /** 面板唯一标识 */
    id: string;
    /** 面板组件工厂 */
    component: PanelComponentFactory<T>;
    /** 面板标题 */
    title?: string;
    /** 面板图标 */
    icon?: string;
    /** 是否可关闭 */
    closable?: boolean;
    /** 侧边栏样式（隐藏标签头） */
    sidebarStyle?: boolean;
}

/**
 * DockLayout 组件属性接口
 */
export interface DockLayoutProps {
    /** 面板组件映射（类型 -> 工厂函数） */
    panels: Record<string, PanelComponentFactory>;
    /** 初始布局配置 */
    initialLayout?: InitialLayoutConfig;
    /** Dockview 就绪回调 */
    onReady?: (api: DockviewComponent) => void;
    /** 主题类名 */
    theme?: string;
    /** Dockview 选项 */
    options?: Partial<DockviewComponentOptions>;

    /* ======== 面板事件 ======== */
    /** 添加面板事件 */
    onDidAddPanel?: (panel: IDockviewPanel) => void;
    /** 移除面板事件 */
    onDidRemovePanel?: (panel: IDockviewPanel) => void;
    /** 活动面板变更事件 */
    onDidActivePanelChange?: (panel: IDockviewPanel | undefined) => void;
    /** 移动面板事件 */
    onDidMovePanel?: (event: MovePanelEvent) => void;

    /* ======== 组事件 ======== */
    /** 添加组事件 */
    onDidAddGroup?: (group: DockviewGroupPanel) => void;
    /** 移除组事件 */
    onDidRemoveGroup?: (group: DockviewGroupPanel) => void;
    /** 活动组变更事件 */
    onDidActiveGroupChange?: (group: DockviewGroupPanel | undefined) => void;

    /* ======== 拖放事件 ======== */
    /** 拖放完成事件 */
    onDidDrop?: (event: DockviewDidDropEvent) => void;
    /** 拖放开始事件 */
    onWillDrop?: (event: DockviewWillDropEvent) => void;
    /** 开始拖动面板事件 */
    onWillDragPanel?: (event: TabDragEvent) => void;
    /** 开始拖动组事件 */
    onWillDragGroup?: (event: GroupDragEvent) => void;
    /** 显示拖放叠加层事件 */
    onWillShowOverlay?: (event: DockviewWillShowOverlayLocationEvent) => void;
    /** 未处理拖拽事件 */
    onUnhandledDragOverEvent?: (event: DockviewDndOverlayEvent) => void;

    /* ======== 布局事件 ======== */
    /** 布局变更事件 */
    onDidLayoutChange?: () => void;
    /** 从 JSON 恢复完成事件 */
    onDidLayoutFromJSON?: () => void;

    /* ======== 最大化事件 ======== */
    /** 最大化组变更事件 */
    onDidMaximizedGroupChange?: (event: DockviewMaximizedGroupChanged) => void;

    /* ======== 弹出窗口事件 ======== */
    /** 弹出组尺寸变更事件 */
    onDidPopoutGroupSizeChange?: (event: PopoutGroupChangeSizeEvent) => void;
    /** 弹出组位置变更事件 */
    onDidPopoutGroupPositionChange?: (event: PopoutGroupChangePositionEvent) => void;
    /** 打开弹出窗口失败事件 */
    onDidOpenPopoutWindowFail?: () => void;
}

/**
 * 初始布局配置接口
 */
export interface InitialLayoutConfig {
    /** 面板配置列表 */
    panels: InitialPanelConfig[];
    /** 活动面板 ID */
    activePanel?: string;
}

/**
 * 初始面板配置接口
 */
export interface InitialPanelConfig {
    /** 面板唯一标识 */
    id: string;
    /** 面板类型（对应 panels 映射的键） */
    type: string;
    /** 面板标题 */
    title?: string;
    /** 面板参数 */
    params?: Record<string, any>;
    /** 位置配置 */
    position?: {
        /** 参考面板 ID */
        referencePanel: string;
        /** 相对方向 */
        direction: 'left' | 'right' | 'above' | 'below' | 'within';
    };
    /** 初始尺寸 */
    size?: { width?: number; height?: number };
    /** 侧边栏样式（隐藏标签头） */
    sidebarStyle?: boolean;
    /** 锁定（不可关闭） */
    locked?: boolean;
}

/**
 * 添加面板扩展选项接口
 */
export interface AddPanelOptionsExtended {
    /** 面板 ID */
    id?: string;
    /** 面板标题 */
    title?: string;
    /** 面板参数 */
    params?: Record<string, any>;
    /** 位置配置 */
    position?: {
        /** 参考面板 ID */
        referencePanel?: string;
        /** 参考组 ID */
        referenceGroup?: string;
        /** 相对方向 */
        direction: 'left' | 'right' | 'above' | 'below' | 'within';
    };
    /** 侧边栏样式 */
    sidebarStyle?: boolean;
    /** 非活动状态 */
    inactive?: boolean;
    /** 浮动选项 */
    floating?: FloatingGroupOptions;
}

/* ==========================================================================
   Dockview Context
   ========================================================================== */

/**
 * Dockview Context 值接口
 * @internal
 */
interface DockviewContextValue {
    /** Dockview API 访问器 */
    api: Accessor<DockviewComponent | null>;
    /** 面板参数映射 */
    panelParams: Map<string, Record<string, any>>;
}

/** Dockview Context */
const DockviewContext = createContext<DockviewContextValue>();

/**
 * 获取 Dockview API Hook
 *
 * @returns Dockview API 实例，未初始化时返回 null
 *
 * @example
 * ```tsx
 * function MyPanel() {
 *   const dockview = useDockview();
 *   return <div>Panels: {dockview?.totalPanels}</div>;
 * }
 * ```
 */
export function useDockview(): DockviewComponent | null {
    const ctx = useContext(DockviewContext);
    return ctx ? ctx.api() : null;
}

/**
 * 获取面板参数 Hook
 *
 * @template T - 参数类型
 * @param panelId - 面板 ID
 * @returns 面板参数
 *
 * @example
 * ```tsx
 * function EditorPanel() {
 *   const params = usePanelParams<{ filePath: string }>('editor-1');
 *   return <div>File: {params?.filePath}</div>;
 * }
 * ```
 */
export function usePanelParams<T = Record<string, any>>(panelId: string): T | undefined {
    const ctx = useContext(DockviewContext);
    return ctx?.panelParams.get(panelId) as T | undefined;
}

/* ==========================================================================
   全局 API 存储（支持 HMR）
   ========================================================================== */

declare global {
    interface Window {
        /** Dockview 全局实例（HMR 复用） */
        __dockviewApi?: DockviewComponent | null;
        /** 面板参数映射 */
        __dockviewPanelParams?: Map<string, Record<string, any>>;
    }
}

/**
 * 获取 Dockview API 实例
 *
 * @returns Dockview API 或 null
 * @internal
 */
function getDockviewApi(): DockviewComponent | null {
    return window.__dockviewApi || null;
}

/**
 * 存储 Dockview API 实例
 *
 * @param api - Dockview API 实例
 * @internal
 */
function setDockviewApi(api: DockviewComponent | null): void {
    window.__dockviewApi = api;
}

/**
 * 获取面板参数映射
 *
 * @returns 面板参数映射
 * @internal
 */
function getPanelParamsMap(): Map<string, Record<string, any>> {
    if (!window.__dockviewPanelParams) {
        window.__dockviewPanelParams = new Map();
    }
    return window.__dockviewPanelParams;
}

/* ==========================================================================
   SolidJS 面板渲染器
   ========================================================================== */

/**
 * 面板渲染器初始化参数
 * @internal
 */
interface ContentRendererInitParams {
    /** 面板 API */
    api: any;
    /** 容器 API */
    containerApi: any;
    /** 面板标题 */
    title: string;
    /** 面板参数 */
    params: Record<string, any>;
}

/**
 * SolidJS 面板渲染器
 *
 * 将 SolidJS 组件渲染到 Dockview 面板内容区域
 *
 * @internal
 */
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

    /**
     * 初始化渲染器，挂载 SolidJS 组件
     */
    init(_parameters: ContentRendererInitParams): void {
        this._dispose = render(this._componentFactory, this._element);
    }

    /**
     * 处理布局变更
     */
    layout(_width: number, _height: number): void {
        /* 可选：处理布局变更 */
    }

    /**
     * 处理参数更新
     */
    update(_event: { params: Record<string, any> }): void {
        /* 可选：处理参数更新 */
    }

    /**
     * 聚焦面板
     */
    focus(): void {
        this._element.focus();
    }

    /**
     * 序列化状态
     */
    toJSON(): object {
        return {};
    }

    /**
     * 销毁渲染器，卸载 SolidJS 组件
     */
    dispose(): void {
        if (this._dispose) {
            this._dispose();
            this._dispose = null;
        }
    }
}

/* ==========================================================================
   SolidJS 标签渲染器
   ========================================================================== */

/**
 * SolidJS 标签渲染器
 *
 * 渲染 Dockview 标签页头部（标题和图标）
 *
 * @internal
 */
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

    /**
     * 更新标签内容
     */
    private _updateContent(): void {
        this._element.innerHTML = `
      ${this._icon ? `<span class="tab-icon">${this._icon}</span>` : ''}
      <span class="tab-title">${this._title}</span>
    `;
    }

    init(): void { }
    dispose(): void { }
}

/* ==========================================================================
   DockLayout 组件
   ========================================================================== */

/**
 * Dockview 标签页布局组件
 *
 * 基于 dockview-core 实现的 VS Code 风格标签页布局系统。
 * 支持拖拽分组、浮动窗口、弹出窗口等高级功能。
 *
 * @component
 *
 * @param props - 组件属性 {@link DockLayoutProps}
 * @returns Dockview 容器
 *
 * @example
 * ```tsx
 * <DockLayout
 *   panels={{
 *     editor: EditorPanel,
 *     graph: GraphPanel,
 *     settings: SettingsPanel,
 *   }}
 *   initialLayout={{
 *     panels: [
 *       { id: 'editor-1', type: 'editor', title: 'Editor' },
 *       { id: 'graph-1', type: 'graph', title: 'Graph', position: { referencePanel: 'editor-1', direction: 'right' } },
 *     ],
 *   }}
 *   onReady={(api) => console.log('Dockview ready:', api.totalPanels)}
 * />
 * ```
 */
export function DockLayout(props: DockLayoutProps) {
    /* DOM 容器引用 */
    let containerRef: HTMLDivElement | undefined;
    /* ResizeObserver 引用 */
    let resizeObserver: ResizeObserver | null = null;
    /* Dockview API 信号 */
    const [api, setApi] = createSignal<DockviewComponent | null>(null);
    /* 面板参数映射 */
    const panelParamsMap = getPanelParamsMap();

    onMount(() => {
        if (!containerRef) return;

        /* 添加主题类名 */
        const themeClass = props.theme || 'dockview-theme-abyss';
        containerRef.classList.add(themeClass);

        /* ========================================
           构建初始面板参数映射
           ======================================== */
        if (props.initialLayout) {
            for (const config of props.initialLayout.panels) {
                if (config.params) {
                    panelParamsMap.set(config.id, config.params);
                }
            }
        }

        /* ========================================
           配置 Dockview 选项
           ======================================== */
        const dockviewOptions: DockviewComponentOptions = {
            ...props.options,
            /* 启用拖放功能 */
            disableDnd: false,

            /**
             * 创建面板内容组件
             *
             * 根据组件名称查找工厂函数并创建渲染器
             */
            createComponent: (options) => {
                const panelType = options.name;
                console.log('[DockLayout] createComponent called:', { id: options.id, name: options.name, panelType });

                /* 查找组件工厂 */
                const componentFactory = props.panels[panelType];
                if (!componentFactory) {
                    console.warn(`No component registered for panel type: ${panelType}`);
                    return new SolidPanelRenderer(() => <div>Unknown panel: {panelType}</div>);
                }

                /* 获取面板参数 */
                const params = panelParamsMap.get(options.id) || {};
                console.log('[DockLayout] Creating panel with params:', params);

                return new SolidPanelRenderer(() => componentFactory(params));
            },
            /* 使用默认标签组件以支持拖放 */
        };

        /* ========================================
           创建 Dockview 实例
           ======================================== */
        const dockview = new DockviewComponent(containerRef, dockviewOptions);

        /* ========================================
           调试：日志记录拖放事件（已禁用以避免频繁输出）
           ======================================== */
        /* 注释掉调试日志以减少控制台输出
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
        */

        /* 存储 API 引用 */
        setDockviewApi(dockview);
        setApi(() => dockview);

        /* 调试日志已禁用
        document.addEventListener('dragover', (e) => {
            console.log('[DockLayout] Document dragover:', e.target, 'class:', (e.target as HTMLElement).className);
        }, true);

        containerRef.addEventListener('dragover', (e) => {
            console.log('[DockLayout] Raw dragover on container:', e.target);
        }, true);
        */

        /* 绑定事件处理器 */
        setupEventHandlers(dockview, props);

        /* ========================================
           初始化布局尺寸
           ======================================== */
        const { clientWidth, clientHeight } = containerRef;
        dockview.layout(clientWidth, clientHeight);

        /* ========================================
           尺寸监听
           ======================================== */
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    dockview.layout(width, height);
                }
            }
        });
        resizeObserver.observe(containerRef);

        /* 恢复初始布局 */
        if (props.initialLayout) {
            setupInitialLayout(dockview, props.initialLayout);
        }

        /* 通知外部组件就绪 */
        if (props.onReady) {
            props.onReady(dockview);
        }
    });

    /* ========================================
       清理
       ======================================== */
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

    /* Context 值 */
    const contextValue: DockviewContextValue = {
        api,
        panelParams: panelParamsMap,
    };

    /* 渲染 Dockview 容器 */
    return (
        <DockviewContext.Provider value={contextValue}>
            <div ref={containerRef} class="dockview-container" />
        </DockviewContext.Provider>
    );
}

/* ==========================================================================
   事件处理器设置
   ========================================================================== */

/**
 * 设置 Dockview 事件处理器
 *
 * 将 DockLayoutProps 中的事件回调绑定到 Dockview 实例
 *
 * @param dockview - Dockview 实例
 * @param props - 组件属性（包含事件回调）
 * @internal
 */
function setupEventHandlers(dockview: DockviewComponent, props: DockLayoutProps) {
    /* ======== 面板事件 ======== */
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

    /* ======== 组事件 ======== */
    if (props.onDidAddGroup) {
        dockview.onDidAddGroup(props.onDidAddGroup);
    }
    if (props.onDidRemoveGroup) {
        dockview.onDidRemoveGroup(props.onDidRemoveGroup);
    }
    if (props.onDidActiveGroupChange) {
        dockview.onDidActiveGroupChange(props.onDidActiveGroupChange);
    }

    /* ======== 拖放事件 ======== */
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

    /* ======== 布局事件 ======== */
    if (props.onDidLayoutChange) {
        dockview.onDidLayoutChange(props.onDidLayoutChange);
    }
    if (props.onDidLayoutFromJSON) {
        dockview.onDidLayoutFromJSON(props.onDidLayoutFromJSON);
    }

    /* ======== 最大化事件 ======== */
    if (props.onDidMaximizedGroupChange) {
        dockview.onDidMaximizedGroupChange(props.onDidMaximizedGroupChange);
    }

    /* ======== 弹出窗口事件 ======== */
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

/* ==========================================================================
   初始布局设置
   ========================================================================== */

/**
 * 设置 Dockview 初始布局
 *
 * 根据配置创建初始面板，恢复之前保存的布局状态
 *
 * @param dockview - Dockview 实例
 * @param config - 布局配置
 * @internal
 */
function setupInitialLayout(
    dockview: DockviewComponent,
    config: InitialLayoutConfig
) {
    for (const panelConfig of config.panels) {
        /* 构建面板选项 */
        const options: AddPanelOptions = {
            id: panelConfig.id,
            component: panelConfig.type, /* 类型作为组件名称 */
            title: panelConfig.title || panelConfig.id,
        };

        /* 添加位置配置 */
        if (panelConfig.position) {
            options.position = {
                referencePanel: panelConfig.position.referencePanel,
                direction: panelConfig.position.direction,
            };
        }

        /* 创建面板 */
        const panel = dockview.addPanel(options);

        /* 应用侧边栏样式（隐藏标签头） */
        if (panelConfig.sidebarStyle && panel) {
            const group = panel.group;
            if (group) {
                group.locked = 'no-drop-target';
                group.header.hidden = true;
            }
        }

        /* 应用尺寸配置 */
        if (panelConfig.size && panel) {
            panel.api.setSize(panelConfig.size);
        }
    }
}

/* ==========================================================================
   公共 API 函数 - 面板管理
   ========================================================================== */

/**
 * 添加面板到 Dockview
 *
 * @param type - 面板类型（对应 panels 映射的键）
 * @param options - 可选配置
 * @param options.id - 面板 ID（默认自动生成）
 * @param options.title - 面板标题
 * @param options.params - 面板参数
 * @param options.position - 位置配置
 * @param options.sidebarStyle - 侧边栏样式
 * @returns 新添加的面板，或已存在的面板
 *
 * @example
 * ```ts
 * addPanel('editor', {
 *   id: 'editor-1',
 *   title: 'Main Editor',
 *   params: { filePath: '/path/to/file.md' }
 * });
 * ```
 */
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

    /* 生成或使用提供的 ID */
    const panelId = options?.id || `${type}-${Date.now()}`;

    /* 检查面板是否已存在 */
    const existing = dockview.getPanel(panelId);
    if (existing) {
        existing.api.setActive();
        return existing as unknown as IDockviewPanel;
    }

    /* 存储面板参数 */
    if (options?.params) {
        const panelParamsMap = getPanelParamsMap();
        panelParamsMap.set(panelId, options.params);
    }

    /* 构建添加选项 */
    const addOptions: AddPanelOptions = {
        id: panelId,
        component: type, /* 传递给 createComponent 的 options.name */
        title: options?.title || type,
        params: options?.params, /* 传递 params 到 dockview 面板 */
    };

    if (options?.position) {
        addOptions.position = options.position;
    }

    console.log('[DockLayout] addPanel:', { type, panelId, options: addOptions });
    const panel = dockview.addPanel(addOptions);

    /* 应用侧边栏样式 */
    if (options?.sidebarStyle && panel) {
        const group = panel.group;
        if (group) {
            group.locked = 'no-drop-target';
            group.header.hidden = true;
        }
    }

    return panel;
}

/**
 * 获取指定面板
 *
 * @param id - 面板 ID
 * @returns 面板实例，不存在时返回 undefined
 */
export function getPanel(id: string) {
    const dockview = getDockviewApi();
    return dockview?.getPanel(id);
}

/**
 * 关闭面板
 *
 * @param id - 面板 ID
 */
export function closePanel(id: string): void {
    const panel = getPanel(id);
    if (panel) {
        panel.api.close();
    }
}

/**
 * 激活面板（设为活动标签）
 *
 * @param id - 面板 ID
 */
export function activatePanel(id: string): void {
    const panel = getPanel(id);
    if (panel) {
        panel.api.setActive();
    }
}

/**
 * 获取 Dockview 实例
 *
 * @returns Dockview 实例，未初始化时返回 null
 */
export function getDockview(): DockviewComponent | null {
    return getDockviewApi();
}

/* ==========================================================================
   公共 API 函数 - 组管理
   ========================================================================== */

/**
 * 添加新组
 *
 * @param options - 组选项
 * @returns 新添加的组
 */
export function addGroup(options?: AddGroupOptions): DockviewGroupPanel | undefined {
    const dockview = getDockviewApi();
    return dockview?.addGroup(options);
}

/**
 * 获取指定组
 *
 * @param id - 组 ID
 * @returns 组实例，不存在时返回 undefined
 */
export function getGroup(id: string): DockviewGroupPanel | undefined {
    const dockview = getDockviewApi();
    /* 遍历组列表查找 */
    return dockview?.groups.find(g => g.id === id);
}

/**
 * 移除组
 *
 * @param group - 要移除的组
 */
export function removeGroup(group: DockviewGroupPanel): void {
    const dockview = getDockviewApi();
    dockview?.removeGroup(group);
}

/**
 * 获取所有组
 *
 * @returns 组数组
 */
export function getAllGroups(): DockviewGroupPanel[] {
    const dockview = getDockviewApi();
    return dockview?.groups ?? [];
}

/**
 * 获取活动组
 *
 * @returns 活动组，无活动组时返回 undefined
 */
export function getActiveGroup(): DockviewGroupPanel | undefined {
    const dockview = getDockviewApi();
    return dockview?.activeGroup;
}

/**
 * 获取活动面板
 *
 * @returns 活动面板，无活动面板时返回 undefined
 */
export function getActivePanel(): IDockviewPanel | undefined {
    const dockview = getDockviewApi();
    return dockview?.activePanel;
}

/**
 * 获取所有面板
 *
 * @returns 面板数组
 */
export function getAllPanels(): IDockviewPanel[] {
    const dockview = getDockviewApi();
    return dockview?.panels ?? [];
}

/**
 * 获取面板总数
 *
 * @returns 面板数量
 */
export function getTotalPanels(): number {
    const dockview = getDockviewApi();
    return dockview?.totalPanels ?? 0;
}

/* ==========================================================================
   公共 API 函数 - 序列化
   ========================================================================== */

/**
 * 序列化布局
 *
 * 用于持久化保存布局状态
 *
 * @returns 序列化的布局数据
 */
export function toJSON(): SerializedDockview | undefined {
    const dockview = getDockviewApi();
    return dockview?.toJSON();
}

/**
 * 从序列化数据恢复布局
 *
 * @param data - 序列化的布局数据
 */
export function fromJSON(data: SerializedDockview): void {
    const dockview = getDockviewApi();
    dockview?.fromJSON(data);
}

/* ==========================================================================
   公共 API 函数 - 浮动和弹出组
   ========================================================================== */

/**
 * 添加浮动组
 *
 * 将面板或组转换为浮动窗口
 *
 * @param item - 面板或组
 * @param options - 浮动选项
 */
export function addFloatingGroup(
    item: DockviewPanel | DockviewGroupPanel,
    options?: FloatingGroupOptions
): void {
    const dockview = getDockviewApi();
    dockview?.addFloatingGroup(item, options);
}

/**
 * 添加弹出组
 *
 * 将面板或组转换为独立浏览器窗口
 *
 * @param item - 面板或组
 * @param options - 弹出选项
 * @returns 成功与否的 Promise
 */
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

/* ==========================================================================
   公共 API 函数 - 导航
   ========================================================================== */

/**
 * 移动到下一个面板
 *
 * @param options - 移动选项
 */
export function moveToNext(options?: MovementOptions): void {
    const dockview = getDockviewApi();
    dockview?.moveToNext(options);
}

/**
 * 移动到上一个面板
 *
 * @param options - 移动选项
 */
export function moveToPrevious(options?: MovementOptions): void {
    const dockview = getDockviewApi();
    dockview?.moveToPrevious(options);
}

/* ==========================================================================
   公共 API 函数 - 最大化
   ========================================================================== */

/**
 * 最大化组
 *
 * @param group - 要最大化的组
 */
export function maximizeGroup(group: DockviewGroupPanel): void {
    const dockview = getDockviewApi();
    dockview?.maximizeGroup(group);
}

/**
 * 退出最大化状态
 */
export function exitMaximizedGroup(): void {
    const dockview = getDockviewApi();
    dockview?.exitMaximizedGroup();
}

/**
 * 检查是否有最大化的组
 *
 * @returns 是否有最大化的组
 */
export function hasMaximizedGroup(): boolean {
    const dockview = getDockviewApi();
    return dockview?.hasMaximizedGroup() ?? false;
}

/* ==========================================================================
   公共 API 函数 - 布局控制
   ========================================================================== */

/**
 * 清空布局（移除所有面板和组）
 */
export function clear(): void {
    const dockview = getDockviewApi();
    dockview?.clear();
}

/**
 * 关闭所有组
 */
export function closeAllGroups(): void {
    const dockview = getDockviewApi();
    dockview?.closeAllGroups();
}

/**
 * 聚焦布局容器
 */
export function focus(): void {
    const dockview = getDockviewApi();
    dockview?.focus();
}

/**
 * 获取布局尺寸
 *
 * @returns 宽度和高度
 */
export function getSize(): { width: number; height: number } | undefined {
    const dockview = getDockviewApi();
    if (!dockview) return undefined;
    return { width: dockview.width, height: dockview.height };
}

/**
 * 重新计算布局
 *
 * @param width - 新宽度
 * @param height - 新高度
 * @param force - 强制重新布局
 */
export function layout(width: number, height: number, force?: boolean): void {
    const dockview = getDockviewApi();
    dockview?.layout(width, height, force);
}

/* ==========================================================================
   公共 API 函数 - 可见性
   ========================================================================== */

/**
 * 设置组可见性
 *
 * @param group - 组实例
 * @param visible - 是否可见
 */
export function setGroupVisible(group: DockviewGroupPanel, visible: boolean): void {
    const dockview = getDockviewApi();
    dockview?.setVisible(group, visible);
}

/* ==========================================================================
   公共 API 函数 - 组间移动
   ========================================================================== */

/**
 * 在组之间移动面板或组
 *
 * @param options - 移动选项
 * @param options.from - 源位置（组 ID 和可选的面板 ID）
 * @param options.to - 目标位置（组、方向和可选的索引）
 */
export function moveGroupOrPanel(options: {
    from: { groupId: string; panelId?: string };
    to: { group: DockviewGroupPanel; position: Position; index?: number };
}): void {
    const dockview = getDockviewApi();
    dockview?.moveGroupOrPanel(options);
}

/* ==========================================================================
   公共 API 函数 - 面板移除
   ========================================================================== */

/**
 * 移除面板
 *
 * @param panel - 要移除的面板
 */
export function removePanel(panel: IDockviewPanel): void {
    const dockview = getDockviewApi();
    dockview?.removePanel(panel);
}

/* ==========================================================================
   公共 API 函数 - 选项更新
   ========================================================================== */

/**
 * 更新 Dockview 选项
 *
 * @param options - 新选项
 */
export function updateOptions(options: Partial<DockviewComponentOptions>): void {
    const dockview = getDockviewApi();
    dockview?.updateOptions(options);
}

/* ==========================================================================
   公共 API 函数 - 尺寸约束
   ========================================================================== */

/**
 * 获取尺寸约束
 *
 * @returns 最小/最大宽度和高度
 */
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

/* ==========================================================================
   公共 API 函数 - 工具函数
   ========================================================================== */

/**
 * 获取布局 ID
 *
 * @returns 布局唯一标识
 */
export function getId(): string | undefined {
    const dockview = getDockviewApi();
    return dockview?.id;
}

/**
 * 获取组数量
 *
 * @returns 组总数
 */
export function getGroupCount(): number {
    const dockview = getDockviewApi();
    return dockview?.size ?? 0;
}
