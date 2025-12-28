import { onMount } from 'solid-js';
import { settingsStore } from './stores/settingsStore';
import { MainLayout } from './components/MainLayout';
import './App.css';

function App() {
  // Apply theme on mount
  onMount(() => {
    settingsStore.applyTheme();
  });

  return <MainLayout />;
}

export default App;