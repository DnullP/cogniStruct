/**
 * @fileoverview Markdown 编辑器组件
 *
 * 本模块提供基于 CodeMirror 的 Markdown 编辑功能，支持文件加载和保存。
 *
 * @module components/Editor
 *
 * @example
 * ```tsx
 * import { Editor } from './components/Editor';
 *
 * // 使用 appStore 中的选中文件
 * <Editor />
 *
 * // 使用指定的文件路径
 * <Editor filePath="/path/to/file.md" fileName="file.md" />
 * ```
 *
 * @exports Editor - Markdown 编辑器组件
 */

import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { invoke } from '@tauri-apps/api/core';
import { appStore } from '../stores/appStore';
/* 样式：Editor.css - 编辑器布局和 CodeMirror 样式覆盖 */
import './Editor.css';

/**
 * 编辑器组件属性接口
 */
interface EditorProps {
  /** 要编辑的文件路径 (可选，默认使用 appStore.selectedFile) */
  filePath?: string;
  /** 文件名称 (可选，用于显示) */
  fileName?: string;
}

/**
 * Markdown 编辑器组件
 *
 * 基于 CodeMirror 6 的 Markdown 编辑器，支持：
 * - 语法高亮
 * - 自动加载文件内容
 * - 保存文件到后端
 *
 * @param props - 组件属性
 * @returns 编辑器 JSX
 */
export function Editor(props: EditorProps) {
  /** 编辑器容器 DOM 引用 */
  let editorContainer: HTMLDivElement | undefined;
  /** CodeMirror EditorView 实例 */
  let editorView: EditorView | undefined;
  /** 当前编辑器内容 */
  const [content, setContent] = createSignal('');
  /** 保存中状态 */
  const [isSaving, setIsSaving] = createSignal(false);

  /**
   * 获取当前文件路径
   * 优先使用 props.filePath，否则使用 appStore.selectedFile
   *
   * @returns 文件路径或 undefined
   * @internal
   */
  const getFilePath = () => props.filePath || appStore.selectedFile();

  /**
   * 组件挂载时初始化 CodeMirror 编辑器
   */
  onMount(() => {
    if (editorContainer) {
      editorView = new EditorView({
        doc: content(),
        extensions: [
          /* basicSetup: 基础编辑器功能（行号、折叠、高亮等） */
          basicSetup,
          /* markdown(): Markdown 语法支持 */
          markdown(),
          /* 监听文档变更并更新 content 信号 */
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setContent(update.state.doc.toString());
            }
          }),
        ],
        parent: editorContainer,
      });
    }
  });

  /**
   * 组件卸载时销毁编辑器实例
   */
  onCleanup(() => {
    editorView?.destroy();
  });

  /**
   * 文件路径变更时加载文件内容
   */
  createEffect(async () => {
    const filePath = getFilePath();
    if (filePath && editorView) {
      try {
        console.log('[Editor] Loading file:', filePath);
        /* 调用后端获取文件内容 */
        const fileContent = await invoke('get_file_content', { path: filePath });
        setContent(fileContent as string);
        /* 替换编辑器全部内容 */
        editorView.dispatch({
          changes: {
            from: 0,
            to: editorView.state.doc.length,
            insert: fileContent as string,
          },
        });
      } catch (error) {
        console.error('Failed to load file:', error);
      }
    }
  });

  /**
   * 处理保存按钮点击
   *
   * @internal
   */
  const handleSave = async () => {
    const filePath = getFilePath();
    if (!filePath) return;

    try {
      setIsSaving(true);
      /* 调用后端保存文件 */
      await invoke('save_file', { path: filePath, content: content() });
      console.log('File saved successfully');
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    /* editor: 编辑器根容器 */
    <div class="editor">
      {/* editor-toolbar: 工具栏，包含保存按钮和文件路径 */}
      <div class="editor-toolbar">
        <button onClick={handleSave} disabled={!getFilePath() || isSaving()} class="save-button">
          {isSaving() ? '💾 Saving...' : '💾 Save'}
        </button>
        <span class="editor-file-path">{getFilePath() || 'No file selected'}</span>
      </div>
      {/* editor-content: CodeMirror 编辑器挂载点 */}
      <div class="editor-content" ref={editorContainer}></div>
    </div>
  );
}
