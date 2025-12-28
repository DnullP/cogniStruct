/**
 * VS Code Style Layout - Main Application Layout
 * 
 * Features:
 * - Left sidebar with collapsible cards (FileTree, Search)
 * - Center tab section (Editor, GraphView)
 * - Activity Bar for navigation
 * - Header and Status Bar
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
import './MainLayout.css';

// ============================================================================
// Card Components (for Sidebars)
// ============================================================================

const FileTreeCard: CardComponentFactory = () => (
    <div class="sidebar-card-content">
        <FileTree />
    </div>
);

const SearchCard: CardComponentFactory = () => (
    <div class="sidebar-card-content">
        <SearchBar />
    </div>
);

const OutlineCard: CardComponentFactory = () => (
    <div class="sidebar-card-content">
        <div class="outline-placeholder">
            <p>Document Outline</p>
            <p class="hint">Open a file to see its structure</p>
        </div>
    </div>
);

// ============================================================================
// Panel Components (for Center Tabs)
// ============================================================================

interface EditorPanelProps {
    filePath?: string;
    fileName?: string;
}

const EditorPanel: PanelComponentFactory<EditorPanelProps> = (props) => (
    <div class="panel-content">
        <Editor filePath={props.filePath} fileName={props.fileName} />
    </div>
);

const GraphPanel: PanelComponentFactory = () => (
    <div class="panel-content">
        <GraphView />
    </div>
);

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

// ============================================================================
// Card & Panel Definitions
// ============================================================================

const cards: Record<string, CardComponentFactory> = {
    'file-tree': FileTreeCard,
    'search': SearchCard,
    'outline': OutlineCard,
};

const panels: Record<string, PanelComponentFactory> = {
    'editor': EditorPanel,
    'graph': GraphPanel,
    'welcome': WelcomePanel,
};

// ============================================================================
// Initial Layout Configurations
// ============================================================================

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

// ============================================================================
// Helper Functions
// ============================================================================

async function openVault() {
    try {
        const selected = await open({
            directory: true,
            multiple: false,
            title: 'Open Vault',
        });

        if (selected) {
            const path = typeof selected === 'string' ? selected : (selected as { path: string }).path;
            console.log('Opening vault:', path);
            await invoke('open_vault', { path });
            appStore.setVaultPath(path);

            // Load graph data
            const graphData = await invoke('get_graph_data');
            console.log('Graph data received:', graphData);
            appStore.setGraphData(graphData as any);

            // Load file tree
            const fileTree = await invoke('get_file_tree');
            console.log('File tree received:', fileTree);
            appStore.setFileTree(fileTree as any);
        }
    } catch (error) {
        console.error('Failed to open vault:', error);
        alert('Failed to open vault: ' + error);
    }
}

// ============================================================================
// Activity Bar Component
// ============================================================================

function ActivityBar(props: {
    activeView: () => 'explorer' | 'search' | 'graph';
    setActiveView: (view: 'explorer' | 'search' | 'graph') => void;
    onOpenGraph: () => void;
}) {
    return (
        <>
            <button
                class="activity-bar-item"
                classList={{ active: props.activeView() === 'explorer' }}
                title="Explorer"
                onClick={() => props.setActiveView('explorer')}
            >
                📁
            </button>
            <button
                class="activity-bar-item"
                classList={{ active: props.activeView() === 'search' }}
                title="Search"
                onClick={() => props.setActiveView('search')}
            >
                🔍
            </button>
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
            <div class="activity-bar-spacer" />
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

// ============================================================================
// Header Component
// ============================================================================

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

// ============================================================================
// Status Bar Component
// ============================================================================

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

// ============================================================================
// Main Layout Component
// ============================================================================

export function MainLayout() {
    const [activeView, setActiveView] = createSignal<'explorer' | 'search' | 'graph'>('explorer');
    let dockviewApi: DockviewComponent | null = null;

    // Open graph view in center panel
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

    // Open editor for a file
    const openFileEditor = (filePath: string, fileName: string) => {
        if (!dockviewApi) return;

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
    };

    // Handle center panel ready
    const handleCenterReady = (api: DockviewComponent) => {
        dockviewApi = api;
    };

    // Register file open callback on mount
    onMount(() => {
        appStore.onFileOpen(openFileEditor);
    });

    return (
        <>
            <AppLayout
                cards={cards}
                panels={panels}
                leftSidebarLayout={leftSidebarLayout}
                rightSidebarLayout={rightSidebarLayout}
                centerLayout={centerLayout}
                leftSidebarWidth={250}
                rightSidebarWidth={200}
                showLeftSidebar={true}
                showRightSidebar={false}
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
            <Settings />
        </>
    );
}
