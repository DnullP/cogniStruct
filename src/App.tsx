import { Show, createEffect } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { appStore } from './stores/appStore';
import { FileTree } from './components/FileTree';
import { SearchBar } from './components/SearchBar';
import { GraphView } from './components/GraphView';
import { Editor } from './components/Editor';
import './App.css';

function App() {
  const openVault = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Open Vault',
      });

      if (selected) {
        const path = typeof selected === 'string' ? selected : selected.path;
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
  };

  const toggleView = () => {
    appStore.setViewMode(appStore.viewMode() === 'graph' ? 'editor' : 'graph');
  };

  return (
    <div class="app">
      <div class="sidebar">
        <div class="sidebar-header">
          <h2>CogniStruct</h2>
          <button onClick={openVault} class="open-vault-btn">
            📁 Open Vault
          </button>
        </div>
        <SearchBar />
        <FileTree />
      </div>

      <div class="main-content">
        <div class="view-toolbar">
          <button onClick={toggleView} class="view-toggle-btn">
            {appStore.viewMode() === 'graph' ? '📝 Editor' : '🌐 Graph'}
          </button>
        </div>

        <Show when={appStore.vaultPath()} fallback={<div class="welcome">Open a vault to get started</div>}>
          <Show when={appStore.viewMode() === 'graph'} fallback={<Editor />}>
            <GraphView />
          </Show>
        </Show>
      </div>
    </div>
  );
}

export default App;

