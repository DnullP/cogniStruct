import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { appStore } from '../stores/appStore';
import './SearchBar.css';

export function SearchBar() {
  const [isSearching, setIsSearching] = createSignal(false);

  const handleSearch = async (query: string) => {
    appStore.setSearchQuery(query);
    
    if (query.trim().length < 2) {
      appStore.setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const results = await invoke('search_nodes', { query });
      appStore.setSearchResults(results as any[]);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div class="search-bar">
      <input
        type="text"
        placeholder="Search notes..."
        value={appStore.searchQuery()}
        onInput={(e) => handleSearch(e.currentTarget.value)}
        class="search-input"
      />
      {isSearching() && <div class="search-spinner">🔍</div>}
    </div>
  );
}
