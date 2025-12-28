import { For, Show } from 'solid-js';
import { appStore, FileNode } from '../stores/appStore';
import './FileTree.css';

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
}

function FileTreeItem(props: FileTreeItemProps) {
  return (
    <div class="file-tree-item" style={{ 'padding-left': `${props.depth * 16}px` }}>
      <Show
        when={props.node.is_dir}
        fallback={
          <div
            class="file-item"
            classList={{ active: appStore.selectedFile() === props.node.path }}
            onClick={() => appStore.openFile(props.node.path)}
          >
            📄 {props.node.name}
          </div>
        }
      >
        <details open>
          <summary class="folder-item">📁 {props.node.name}</summary>
          <Show when={props.node.children}>
            <For each={props.node.children}>
              {(child) => <FileTreeItem node={child} depth={props.depth + 1} />}
            </For>
          </Show>
        </details>
      </Show>
    </div>
  );
}

export function FileTree() {
  return (
    <div class="file-tree">
      <div class="file-tree-header">
        <h3>Files</h3>
      </div>
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
