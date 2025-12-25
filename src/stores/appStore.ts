import { createSignal } from 'solid-js';

export type ViewMode = 'graph' | 'editor';

export interface Node {
  uuid: string;
  path: string;
  title: string;
  content: string;
  node_type: string;
  hash: string;
  created_at: number;
  updated_at: number;
}

export interface Edge {
  src_uuid: string;
  dst_uuid: string;
  relation: string;
  weight: number;
  source: string;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

// Global state
const [vaultPath, setVaultPath] = createSignal<string | null>(null);
const [viewMode, setViewMode] = createSignal<ViewMode>('graph');
const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
const [graphData, setGraphData] = createSignal<GraphData | null>(null);
const [fileTree, setFileTree] = createSignal<FileNode[]>([]);
const [searchQuery, setSearchQuery] = createSignal<string>('');
const [searchResults, setSearchResults] = createSignal<Node[]>([]);

export const appStore = {
  vaultPath,
  setVaultPath,
  viewMode,
  setViewMode,
  selectedFile,
  setSelectedFile,
  graphData,
  setGraphData,
  fileTree,
  setFileTree,
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
};
