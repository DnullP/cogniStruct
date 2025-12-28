import { createSignal } from 'solid-js';

export type Theme = 'light' | 'dark';

export interface GraphSettings {
    gravity: number;
    linkDistance: number;
    linkSpring: number;
    repulsion: number;
    friction: number;
    decay: number;
    center: number;
    repulsionTheta: number;
    cluster: number;
    pointSize: number;
    linkWidth: number;
    showArrows: boolean;
    arrowSize: number;
    curvedLinks: boolean;
}

export interface Settings {
    theme: Theme;
    graph: GraphSettings;
}

const DEFAULT_SETTINGS: Settings = {
    theme: 'dark',
    graph: {
        gravity: 0.15,
        linkDistance: 80,
        linkSpring: 1.5,
        repulsion: 120,
        friction: 1.0,
        decay: 1000,
        center: 0.2,
        repulsionTheta: 1.0,
        cluster: 0.15,
        pointSize: 5,
        linkWidth: 0.2,
        showArrows: true,
        arrowSize: 1.2,
        curvedLinks: false,
    },
};

const STORAGE_KEY = 'cognistruct-settings';

// Load settings from localStorage
function loadSettings(): Settings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge with defaults to handle new settings
            return {
                ...DEFAULT_SETTINGS,
                ...parsed,
                graph: {
                    ...DEFAULT_SETTINGS.graph,
                    ...parsed.graph,
                },
            };
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
    return DEFAULT_SETTINGS;
}

// Save settings to localStorage
function saveSettings(settings: Settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
}

// Initialize with loaded settings
const initialSettings = loadSettings();

// Create signals for each setting category
const [theme, setThemeInternal] = createSignal<Theme>(initialSettings.theme);
const [graphSettings, setGraphSettingsInternal] = createSignal<GraphSettings>(initialSettings.graph);
const [settingsOpen, setSettingsOpen] = createSignal(false);

// Apply theme to document
function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t);
}

// Initialize theme on load
applyTheme(initialSettings.theme);

// Wrapper functions that also save
function setTheme(t: Theme) {
    setThemeInternal(t);
    applyTheme(t);
    saveSettings({ theme: t, graph: graphSettings() });
}

function setGraphSettings(settings: Partial<GraphSettings>) {
    const newSettings = { ...graphSettings(), ...settings };
    setGraphSettingsInternal(newSettings);
    saveSettings({ theme: theme(), graph: newSettings });
}

function resetGraphSettings() {
    setGraphSettingsInternal(DEFAULT_SETTINGS.graph);
    saveSettings({ theme: theme(), graph: DEFAULT_SETTINGS.graph });
}

function resetAllSettings() {
    setThemeInternal(DEFAULT_SETTINGS.theme);
    applyTheme(DEFAULT_SETTINGS.theme);
    setGraphSettingsInternal(DEFAULT_SETTINGS.graph);
    saveSettings(DEFAULT_SETTINGS);
}

export const settingsStore = {
    // Theme
    theme,
    setTheme,
    applyTheme: () => applyTheme(theme()),

    // Graph settings
    graphSettings,
    setGraphSettings,
    resetGraphSettings,

    // Settings panel
    settingsOpen,
    setSettingsOpen,

    // Reset
    resetAllSettings,

    // Defaults for reference
    DEFAULT_SETTINGS,
};
