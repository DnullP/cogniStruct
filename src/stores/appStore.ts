/**
 * @fileoverview 应用程序状态管理模块
 *
 * 本模块管理 CogniStruct 应用的全局状态，包括：
 * - 知识库路径和视图模式
 * - 图数据和文件树
 * - 搜索功能
 * - 文件打开事件处理
 *
 * @module stores/appStore
 *
 * @example
 * ```tsx
 * import { appStore } from './stores/appStore';
 *
 * // 获取当前知识库路径
 * const path = appStore.vaultPath();
 *
 * // 切换视图模式
 * appStore.setViewMode('editor');
 *
 * // 打开文件
 * appStore.openFile('notes/example.md');
 * ```
 *
 * @exports appStore - 应用状态管理对象
 * @exports ViewMode - 视图模式类型
 * @exports Node - 知识节点接口
 * @exports Edge - 知识边接口
 * @exports GraphData - 图数据接口
 * @exports FileNode - 文件节点接口
 */

import { createSignal } from 'solid-js';

/**
 * 视图模式类型
 * - 'graph': 图视图模式，显示知识图谱
 * - 'editor': 编辑器模式，编辑 Markdown 文件
 */
export type ViewMode = 'graph' | 'editor';

/**
 * 知识节点接口
 *
 * 表示知识图谱中的一个节点，通常对应一个 Markdown 文件
 */
export interface Node {
  /** 节点唯一标识符 */
  uuid: string;
  /** 文件相对路径 */
  path: string;
  /** 节点标题（文件名） */
  title: string;
  /** 文件内容 */
  content: string;
  /** 节点类型（如 'note'） */
  node_type: string;
  /** 内容哈希值，用于检测变化 */
  hash: string;
  /** 创建时间戳 */
  created_at: number;
  /** 更新时间戳 */
  updated_at: number;
}

/**
 * 知识边接口
 *
 * 表示知识图谱中两个节点之间的关系
 */
export interface Edge {
  /** 源节点 UUID */
  src_uuid: string;
  /** 目标节点 UUID */
  dst_uuid: string;
  /** 关系类型（如 'link'、'tagged'） */
  relation: string;
  /** 关系权重 */
  weight: number;
  /** 关系来源（如 'wikilink'、'tag'） */
  source: string;
}

/**
 * 图数据接口
 *
 * 包含完整的知识图谱数据
 */
export interface GraphData {
  /** 所有节点列表 */
  nodes: Node[];
  /** 所有边列表 */
  edges: Edge[];
}

/**
 * 文件节点接口
 *
 * 表示文件树中的一个节点
 */
export interface FileNode {
  /** 文件或目录名称 */
  name: string;
  /** 相对路径 */
  path: string;
  /** 是否为目录 */
  is_dir: boolean;
  /** 子节点列表（仅目录有效） */
  children?: FileNode[];
}

/**
 * 文件打开回调函数类型
 * @param filePath - 文件路径
 * @param fileName - 文件名
 */
type FileOpenCallback = (filePath: string, fileName: string) => void;

// ============================================================================
// 全局状态信号
// ============================================================================

/** 当前打开的知识库路径 */
const [vaultPath, setVaultPath] = createSignal<string | null>(null);
/** 当前视图模式 */
const [viewMode, setViewMode] = createSignal<ViewMode>('graph');
/** 当前选中的文件路径 */
const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
/** 知识图谱数据 */
const [graphData, setGraphData] = createSignal<GraphData | null>(null);
/** 文件树数据 */
const [fileTree, setFileTree] = createSignal<FileNode[]>([]);
/** 搜索查询字符串 */
const [searchQuery, setSearchQuery] = createSignal<string>('');
/** 搜索结果列表 */
const [searchResults, setSearchResults] = createSignal<Node[]>([]);

// ============================================================================
// 文件打开回调
// ============================================================================

/** 文件打开回调函数 */
let fileOpenCallback: FileOpenCallback | null = null;

/**
 * 注册文件打开事件回调
 *
 * @param callback - 文件打开时调用的回调函数
 */
function onFileOpen(callback: FileOpenCallback) {
  fileOpenCallback = callback;
}

/**
 * 打开指定文件
 *
 * 设置选中文件并触发文件打开回调
 *
 * @param filePath - 要打开的文件路径
 */
function openFile(filePath: string) {
  const fileName = filePath.split('/').pop() || filePath;
  setSelectedFile(filePath);
  if (fileOpenCallback) {
    fileOpenCallback(filePath, fileName);
  }
}

// ============================================================================
// 导出应用状态管理对象
// ============================================================================

/**
 * 应用状态管理对象
 *
 * 提供应用程序全局状态的访问和修改方法
 */
export const appStore = {
  // 知识库路径
  /** 获取当前知识库路径 */
  vaultPath,
  /** 设置知识库路径 */
  setVaultPath,

  // 视图模式
  /** 获取当前视图模式 */
  viewMode,
  /** 设置视图模式 */
  setViewMode,

  // 文件选择
  /** 获取当前选中的文件路径 */
  selectedFile,
  /** 设置选中的文件路径 */
  setSelectedFile,

  // 图数据
  /** 获取知识图谱数据 */
  graphData,
  /** 设置知识图谱数据 */
  setGraphData,

  // 文件树
  /** 获取文件树数据 */
  fileTree,
  /** 设置文件树数据 */
  setFileTree,

  // 搜索
  /** 获取搜索查询字符串 */
  searchQuery,
  /** 设置搜索查询字符串 */
  setSearchQuery,
  /** 获取搜索结果 */
  searchResults,
  /** 设置搜索结果 */
  setSearchResults,

  // 文件打开 API
  /** 注册文件打开回调 */
  onFileOpen,
  /** 打开文件 */
  openFile,
};
