/**
 * @fileoverview 文件树组件
 *
 * 本模块提供知识库文件浏览功能，以树形结构显示文件和目录。
 * 支持响应式的展开/折叠状态，可与外部状态同步。
 *
 * @module components/FileTree
 *
 * @example
 * ```tsx
 * import { FileTree } from './components/FileTree';
 *
 * <FileTree />
 * ```
 *
 * @exports FileTree - 文件树组件
 */

import { For, Show } from 'solid-js';
import { appStore, FileNode } from '../stores/appStore';
/* 样式：FileTree.css - 文件树布局和交互样式 */
import './FileTree.css';

/**
 * 文件树项目属性接口
 */
interface FileTreeItemProps {
  /** 文件或目录节点 */
  node: FileNode;
  /** 缩进深度 */
  depth: number;
}

/**
 * 文件树项目组件
 *
 * 递归渲染单个文件或目录节点
 *
 * @param props - 组件属性
 * @returns 文件或目录节点的 JSX
 */
function FileTreeItem(props: FileTreeItemProps) {
  /**
   * 检查目录是否展开
   * @returns 是否展开
   */
  const isExpanded = () => appStore.expandedFolders().has(props.node.path);

  /**
   * 处理目录点击，切换展开状态
   */
  const handleFolderClick = () => {
    appStore.toggleFolder(props.node.path);
  };

  return (
    /* file-tree-item: 单个文件树项目容器，使用 padding-left 实现缩进 */
    <div class="file-tree-item" style={{ 'padding-left': `${props.depth * 16}px` }}>
      <Show
        when={props.node.is_dir}
        fallback={
          /* file-item: 文件项目，可点击打开文件，tabindex 使其可聚焦 */
          <div
            class="file-item"
            classList={{ active: appStore.selectedFile() === props.node.path }}
            tabindex="0"
            onClick={() => appStore.openFile(props.node.path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                appStore.openFile(props.node.path);
              }
            }}
          >
            📄 {props.node.name}
          </div>
        }
      >
        {/* folder-container: 目录容器 */}
        <div class="folder-container">
          {/* folder-item: 目录项目，可点击展开/折叠，tabindex 使其可聚焦 */}
          <div
            class="folder-item"
            classList={{ expanded: isExpanded() }}
            tabindex="0"
            onClick={handleFolderClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleFolderClick();
              }
            }}
          >
            <span class="folder-icon">{isExpanded() ? '📂' : '📁'}</span>
            <span class="folder-name">{props.node.name}</span>
          </div>
          {/* folder-children: 子节点容器，根据展开状态显示/隐藏 */}
          <Show when={isExpanded() && props.node.children}>
            <div class="folder-children">
              <For each={props.node.children}>
                {(child) => <FileTreeItem node={child} depth={props.depth + 1} />}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

/**
 * 文件树组件
 *
 * 显示知识库的文件和目录结构，支持点击打开文件
 *
 * @returns 文件树 JSX
 */
export function FileTree() {
  return (
    /* file-tree: 文件树根容器 */
    <div class="file-tree">
      {/* file-tree-header: 文件树标题区域 */}
      <div class="file-tree-header">
        <h3>Files</h3>
      </div>
      {/* file-tree-content: 文件树内容区域，可滚动 */}
      <div class="file-tree-content">
        <Show when={appStore.fileTree().length > 0} fallback={<div class="empty-state">No vault opened</div>}>
          <For each={appStore.fileTree()}>
            {(node) => <FileTreeItem node={node} depth={0} />}
          </For>
        </Show>
      </div>
    </div>
  );
}
