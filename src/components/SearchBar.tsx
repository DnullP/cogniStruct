/**
 * @fileoverview 搜索栏组件
 *
 * 本模块提供知识库全文搜索功能，调用后端搜索 API 并显示结果。
 * 支持点击搜索结果打开对应文件。
 *
 * @module components/SearchBar
 *
 * @example
 * ```tsx
 * import { SearchBar } from './components/SearchBar';
 *
 * <SearchBar />
 * ```
 *
 * @exports SearchBar - 搜索栏组件
 */

import { createSignal, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { appStore } from '../stores/appStore';
/* 样式：SearchBar.css - 搜索输入框、结果列表和加载状态样式 */
import './SearchBar.css';

/**
 * 搜索栏组件
 *
 * 提供文本输入框，用户输入搜索词后自动调用后端搜索 API。
 * 搜索最少需要 2 个字符才会触发。
 * 显示搜索结果列表，点击可打开对应文件。
 *
 * @returns 搜索栏 JSX
 */
export function SearchBar() {
  /**
   * 搜索中状态信号
   * @internal
   */
  const [isSearching, setIsSearching] = createSignal(false);

  /**
   * 处理搜索请求
   *
   * @param query - 搜索关键词
   * @internal
   */
  const handleSearch = async (query: string) => {
    /* 更新全局搜索查询状态 */
    appStore.setSearchQuery(query);

    /* 搜索词少于 2 字符时清空结果 */
    if (query.trim().length < 2) {
      appStore.setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      /* 调用后端搜索命令 */
      const results = await invoke('search_nodes', { query });
      appStore.setSearchResults(results as any[]);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * 处理搜索结果点击
   *
   * @param filePath - 要打开的文件路径
   * @internal
   */
  const handleResultClick = (filePath: string) => {
    appStore.openFile(filePath);
  };

  return (
    /* search-container: 搜索组件容器 */
    <div class="search-container">
      {/* search-bar: 搜索栏容器 */}
      <div class="search-bar">
        {/* search-input: 搜索输入框 */}
        <input
          type="text"
          placeholder="Search notes..."
          value={appStore.searchQuery()}
          onInput={(e) => handleSearch(e.currentTarget.value)}
          class="search-input"
        />
        {/* search-spinner: 搜索中加载动画 */}
        <Show when={isSearching()}>
          <div class="search-spinner">🔍</div>
        </Show>
      </div>

      {/* search-results: 搜索结果列表 */}
      <Show when={appStore.searchResults().length > 0}>
        <div class="search-results">
          <div class="search-results-header">
            Found {appStore.searchResults().length} result(s)
          </div>
          <For each={appStore.searchResults()}>
            {(result) => (
              /* search-result-item: 单个搜索结果项 */
              <div
                class="search-result-item"
                onClick={() => handleResultClick(result.path)}
              >
                {/* search-result-icon: 结果图标 */}
                <span class="search-result-icon">📄</span>
                {/* search-result-content: 结果内容 */}
                <div class="search-result-content">
                  {/* search-result-title: 结果标题 */}
                  <div class="search-result-title">{result.title}</div>
                  {/* search-result-path: 文件路径 */}
                  <div class="search-result-path">{result.path}</div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* search-empty: 无结果提示 */}
      <Show when={appStore.searchQuery().trim().length >= 2 && appStore.searchResults().length === 0 && !isSearching()}>
        <div class="search-empty">
          <p>No results found for "{appStore.searchQuery()}"</p>
        </div>
      </Show>
    </div>
  );
}
