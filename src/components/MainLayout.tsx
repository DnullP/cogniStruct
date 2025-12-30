/**
 * @fileoverview 主布局组件
 *
 * 本模块提供 VS Code 风格的应用布局，包括：
 * - 左侧边栏（文件树、搜索）
 * - 中央标签页区域（编辑器、图谱视图）
 * - 活动栏导航
 * - 标题栏和状态栏
 *
 * @module components/MainLayout
 *
 * @features
 * - 可折叠的侧边栏卡片
 * - 多标签页编辑器
 * - 活动栏快速导航
 * - Vault 打开和管理
 *
 * @example
 * ```tsx
 * import { MainLayout } from './components/MainLayout';
 *
 * <MainLayout />
 * ```
 *
 * @exports MainLayout - 主布局组件
 */

import { Show, createSignal, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { appStore } from '../stores/appStore';
import { settingsStore } from '../stores/settingsStore';
import { FileTree } from './FileTree';
import { SearchBar } from './SearchBar';
import { GraphView } from './GraphView';
import { Editor } from './Editor';
import { Settings } from './Settings';
import {
    AppLayout,
    SidebarLayoutConfig,
    InitialLayoutConfig,
    CardComponentFactory,
    PanelComponentFactory,
    addPanel,
    activatePanel,
    getPanel,
    DockviewComponent,
} from './layout';
/* 样式：MainLayout.css - 主布局相关样式 */
import './MainLayout.css';

/* ==========================================================================
   卡片组件（用于侧边栏）
   ========================================================================== */

/**
 * 文件树卡片组件
 *
 * 包装 FileTree 组件用于侧边栏显示
 */
const FileTreeCard: CardComponentFactory = () => (
    <div class="sidebar-card-content">
        <FileTree />
    </div>
);

/**
 * 搜索卡片组件
 *
 * 包装 SearchBar 组件用于侧边栏显示
 */
const SearchCard: CardComponentFactory = () => (
    <div class="sidebar-card-content">
        <SearchBar />
    </div>
);

/**
 * 大纲卡片组件
 *
 * 显示文档结构大纲（待实现）
 */
const OutlineCard: CardComponentFactory = () => (
    <div class="sidebar-card-content">
        <div class="outline-placeholder">
            <p>Document Outline</p>
            <p class="hint">Open a file to see its structure</p>
        </div>
    </div>
);

/* ==========================================================================
   面板组件（用于中央标签页）
   ========================================================================== */

/**
 * 编辑器面板属性接口
 */
interface EditorPanelProps {
    /** 要编辑的文件路径 */
    filePath?: string;
    /** 文件名称 */
    fileName?: string;
}

/**
 * 编辑器面板组件
 *
 * 包装 Editor 组件用于标签页显示
 */
const EditorPanel: PanelComponentFactory<EditorPanelProps> = (props) => (
    <div class="panel-content">
        <Editor filePath={props.filePath} fileName={props.fileName} />
    </div>
);

/**
 * 图谱面板组件
 *
 * 包装 GraphView 组件用于标签页显示
 */
const GraphPanel: PanelComponentFactory = () => (
    <div class="panel-content">
        <GraphView />
    </div>
);

/**
 * 欢迎面板组件
 *
 * 应用启动时显示的欢迎界面
 */
const WelcomePanel: PanelComponentFactory = () => (
    <div class="panel-content welcome-panel">
        <div class="welcome-content">
            <h1>Welcome to CogniStruct</h1>
            <p>Open a vault to get started</p>
            <button onClick={openVault} class="open-vault-btn">
                📁 Open Vault
            </button>
        </div>
    </div>
);

/* ==========================================================================
   卡片和面板定义映射
   ========================================================================== */

/** 卡片组件类型映射 */
const cards: Record<string, CardComponentFactory> = {
    'file-tree': FileTreeCard,
    'search': SearchCard,
    'outline': OutlineCard,
};

/** 面板组件类型映射 */
const panels: Record<string, PanelComponentFactory> = {
    'editor': EditorPanel,
    'graph': GraphPanel,
    'welcome': WelcomePanel,
};

/* ==========================================================================
   初始布局配置
   ========================================================================== */

/** 左侧边栏布局配置 */
const leftSidebarLayout: SidebarLayoutConfig = {
    cards: [
        {
            id: 'explorer',
            type: 'file-tree',
            title: 'Explorer',
            expanded: true,
            minimumBodySize: 100,
        },
        {
            id: 'search',
            type: 'search',
            title: 'Search',
            expanded: true,
            minimumBodySize: 80,
        },
    ],
};

/** 右侧边栏布局配置 */
const rightSidebarLayout: SidebarLayoutConfig = {
    cards: [
        {
            id: 'outline',
            type: 'outline',
            title: 'Outline',
            expanded: true,
            minimumBodySize: 100,
        },
    ],
};

/** 中央区域初始布局配置 */
const centerLayout: InitialLayoutConfig = {
    panels: [
        {
            id: 'welcome',
            type: 'welcome',
            title: 'Welcome',
        },
    ],
    activePanel: 'welcome',
};

/* ==========================================================================
   辅助函数
   ========================================================================== */

/**
 * 打开 Vault 目录
 *
 * 显示目录选择对话框，加载选中的 vault 并获取图谱数据和文件树
 */
async function openVault() {
    try {
        /* 显示目录选择对话框 */
        const selected = await open({
            directory: true,
            multiple: false,
            title: 'Open Vault',
        });

        if (selected) {
            const path = typeof selected === 'string' ? selected : (selected as { path: string }).path;
            console.log('Opening vault:', path);

            /* 调用后端打开 vault */
            await invoke('open_vault', { path });
            appStore.setVaultPath(path);

            /* 加载图谱数据 */
            const graphData = await invoke('get_graph_data');
            console.log('Graph data received:', graphData);
            appStore.setGraphData(graphData as any);

            /* 加载文件树 */
            const fileTree = await invoke('get_file_tree');
            console.log('File tree received:', fileTree);
            appStore.setFileTree(fileTree as any);
        }
    } catch (error) {
        console.error('Failed to open vault:', error);
        alert('Failed to open vault: ' + error);
    }
}

/* ==========================================================================
   活动栏组件
   ========================================================================== */

/**
 * 活动栏属性接口
 */
interface ActivityBarProps {
    /** 当前活动视图获取器 */
    activeView: () => 'explorer' | 'search' | 'graph';
    /** 设置活动视图 */
    setActiveView: (view: 'explorer' | 'search' | 'graph') => void;
    /** 打开图谱视图回调 */
    onOpenGraph: () => void;
}

/**
 * 活动栏组件
 *
 * 左侧垂直导航栏，用于快速切换不同视图
 *
 * @param props - 组件属性
 * @returns 活动栏 JSX
 */
function ActivityBar(props: ActivityBarProps) {
    return (
        <>
            {/* 文件浏览器按钮 */}
            <button
                class="activity-bar-item"
                classList={{ active: props.activeView() === 'explorer' }}
                title="Explorer"
                onClick={() => props.setActiveView('explorer')}
            >
                📁
            </button>
            {/* 搜索按钮 */}
            <button
                class="activity-bar-item"
                classList={{ active: props.activeView() === 'search' }}
                title="Search"
                onClick={() => props.setActiveView('search')}
            >
                🔍
            </button>
            {/* 图谱视图按钮 */}
            <button
                class="activity-bar-item"
                classList={{ active: props.activeView() === 'graph' }}
                title="Graph View"
                onClick={() => {
                    props.setActiveView('graph');
                    props.onOpenGraph();
                }}
            >
                🕸️
            </button>
            {/* 弹性空间 */}
            <div class="activity-bar-spacer" />
            {/* 设置按钮 */}
            <button
                class="activity-bar-item"
                title="Settings"
                onClick={() => settingsStore.setSettingsOpen(true)}
            >
                ⚙️
            </button>
        </>
    );
}

/* ==========================================================================
   标题栏组件
   ========================================================================== */

/**
 * 标题栏组件
 *
 * 显示应用名称和当前 vault 路径
 *
 * @returns 标题栏 JSX
 */
function Header() {
    return (
        <>
            <span class="header-title">CogniStruct</span>
            <div class="header-spacer" />
            <Show when={appStore.vaultPath()}>
                <span class="header-vault-path">{appStore.vaultPath()}</span>
            </Show>
        </>
    );
}

/* ==========================================================================
   状态栏组件
   ========================================================================== */

/**
 * 状态栏组件
 *
 * 显示当前 vault 名称和选中文件路径
 *
 * @returns 状态栏 JSX
 */
function StatusBar() {
    return (
        <>
            <Show when={appStore.vaultPath()}>
                <span class="status-item">📁 {appStore.vaultPath()?.split('/').pop()}</span>
            </Show>
            <div class="status-spacer" />
            <Show when={appStore.selectedFile()}>
                <span class="status-item">{appStore.selectedFile()}</span>
            </Show>
        </>
    );
}

/* ==========================================================================
   主布局组件
   ========================================================================== */

/**
 * 主布局组件
 *
 * 应用的根布局组件，组合所有子组件并管理布局状态
 *
 * @returns 主布局 JSX
 */
export function MainLayout() {
    /** 当前活动视图 */
    const [activeView, setActiveView] = createSignal<'explorer' | 'search' | 'graph'>('explorer');
    /** Dockview API 引用 */
    let dockviewApi: DockviewComponent | null = null;

    /**
     * 打开图谱视图面板
     *
     * @internal
     */
    const openGraphView = () => {
        if (!dockviewApi) return;

        const existingPanel = getPanel('graph-view');
        if (existingPanel) {
            activatePanel('graph-view');
        } else {
            addPanel('graph', {
                id: 'graph-view',
                title: '🕸️ Graph View',
            });
        }
    };

    /**
     * 打开文件编辑器面板
     *
     * @param filePath - 文件路径
     * @param fileName - 文件名
     * @internal
     */
    const openFileEditor = (filePath: string, fileName: string) => {
        if (!dockviewApi) return;

        /* 使用文件路径生成唯一面板 ID */
        const panelId = `editor-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const existingPanel = getPanel(panelId);
        if (existingPanel) {
            activatePanel(panelId);
        } else {
            addPanel('editor', {
                id: panelId,
                title: `📝 ${fileName}`,
                params: { filePath, fileName },
            });
        }

        /* 展开文件树到对应文件并高亮 */
        appStore.expandToFile(filePath);
    };

    /**
     * 处理中央面板就绪事件
     *
     * @param api - Dockview API 实例
     * @internal
     */
    const handleCenterReady = (api: DockviewComponent) => {
        dockviewApi = api;

        /* 监听活动面板变化，同步文件树选中状态 */
        api.onDidActivePanelChange((panel) => {
            if (!panel) return;

            /* 从面板 ID 提取文件路径 */
            const panelId = panel.id;
            if (panelId.startsWith('editor-')) {
                /* 尝试从面板参数获取文件路径 */
                const params = (panel as any).params as { filePath?: string } | undefined;
                if (params?.filePath) {
                    /* 更新选中文件并展开文件树 */
                    appStore.setSelectedFile(params.filePath);
                    appStore.expandToFile(params.filePath);
                } else {
                    /* 尝试从存储的参数映射中获取 */
                    const storedParams = (window as any).__dockviewPanelParams?.get(panelId) as { filePath?: string } | undefined;
                    if (storedParams?.filePath) {
                        appStore.setSelectedFile(storedParams.filePath);
                        appStore.expandToFile(storedParams.filePath);
                    }
                }
            }
        });
    };

    /* 组件挂载时注册文件打开回调 */
    onMount(() => {
        appStore.onFileOpen(openFileEditor);
    });

    return (
        <>
            {/* AppLayout: 核心布局组件 */}
            <AppLayout
                cards={cards}
                panels={panels}
                leftSidebarLayout={leftSidebarLayout}
                rightSidebarLayout={rightSidebarLayout}
                centerLayout={centerLayout}
                leftSidebarWidth={250}
                rightSidebarWidth={200}
                showLeftSidebar={appStore.leftSidebarVisible()}
                showRightSidebar={appStore.rightSidebarVisible()}
                onToggleLeftSidebar={() => appStore.toggleLeftSidebar()}
                onToggleRightSidebar={() => appStore.toggleRightSidebar()}
                activityBar={
                    <ActivityBar
                        activeView={activeView}
                        setActiveView={setActiveView}
                        onOpenGraph={openGraphView}
                    />
                }
                header={<Header />}
                statusBar={<StatusBar />}
                onCenterReady={handleCenterReady}
            />
            {/* Settings: 设置面板模态框 */}
            <Settings />
        </>
    );
}
