import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { invoke } from '@tauri-apps/api/core';
import { appStore } from '../stores/appStore';
import './Editor.css';

interface EditorProps {
  filePath?: string;
  fileName?: string;
}

export function Editor(props: EditorProps) {
  let editorContainer: HTMLDivElement | undefined;
  let editorView: EditorView | undefined;
  const [content, setContent] = createSignal('');
  const [isSaving, setIsSaving] = createSignal(false);

  // Use prop filePath if provided, otherwise fallback to appStore
  const getFilePath = () => props.filePath || appStore.selectedFile();

  onMount(() => {
    if (editorContainer) {
      editorView = new EditorView({
        doc: content(),
        extensions: [
          basicSetup,
          markdown(),
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

  onCleanup(() => {
    editorView?.destroy();
  });

  // Load file content when filePath changes
  createEffect(async () => {
    const filePath = getFilePath();
    if (filePath && editorView) {
      try {
        console.log('[Editor] Loading file:', filePath);
        const fileContent = await invoke('get_file_content', { path: filePath });
        setContent(fileContent as string);
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

  const handleSave = async () => {
    const filePath = getFilePath();
    if (!filePath) return;

    try {
      setIsSaving(true);
      await invoke('save_file', { path: filePath, content: content() });
      console.log('File saved successfully');
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div class="editor">
      <div class="editor-toolbar">
        <button onClick={handleSave} disabled={!getFilePath() || isSaving()} class="save-button">
          {isSaving() ? '💾 Saving...' : '💾 Save'}
        </button>
        <span class="editor-file-path">{getFilePath() || 'No file selected'}</span>
      </div>
      <div class="editor-content" ref={editorContainer}></div>
    </div>
  );
}
