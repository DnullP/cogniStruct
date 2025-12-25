# CogniStruct MVP

CogniStruct is a local-first knowledge management system based on the Dynamic Cognitive Object Model (DCOM), built with Tauri 2.x, SolidJS, and CozoDB.

## Features

✅ **Backend (Rust/Tauri)**
- CozoDB integration for graph data storage
- File sync engine with automatic markdown parsing
- Wikilink `[[link]]` and tag `#tag` extraction
- File tree navigation
- Full-text search

✅ **Frontend (SolidJS)**
- Interactive knowledge graph visualization (Cosmograph)
- Markdown editor with CodeMirror
- File tree browser
- Real-time search
- Toggle between graph and editor views

## Prerequisites

- Node.js 18+ and npm
- Rust 1.70+
- System dependencies for Tauri:
  - Linux: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
  - macOS: Xcode Command Line Tools
  - Windows: WebView2

## Installation

```bash
# Clone the repository
git clone https://github.com/DnullP/cogniStruct.git
cd cogniStruct

# Install frontend dependencies
npm install

# Build the application
npm run tauri build
```

## Development

```bash
# Run in development mode
npm run tauri dev
```

## Usage

1. **Open a Vault**: Click the "Open Vault" button and select a folder containing markdown files
2. **View Graph**: The knowledge graph will automatically display all notes and their connections
3. **Edit Notes**: Click on a file in the file tree or a node in the graph to open it in the editor
4. **Search**: Use the search bar to find notes by title or content
5. **Toggle Views**: Switch between graph view and editor view using the view toggle button

## Architecture

### Backend (src-tauri/src)
- `db/mod.rs`: CozoDB database wrapper with schema definitions
- `sync/parser.rs`: Markdown parser for extracting titles, wikilinks, and tags
- `sync/watcher.rs`: File system watcher for real-time updates
- `sync/mod.rs`: Vault synchronization engine
- `commands/mod.rs`: Tauri commands for frontend-backend communication

### Frontend (src)
- `stores/appStore.ts`: SolidJS signal-based state management
- `components/FileTree.tsx`: File tree browser component
- `components/GraphView.tsx`: Interactive graph visualization
- `components/Editor.tsx`: CodeMirror-based markdown editor
- `components/SearchBar.tsx`: Search functionality

### Data Storage
- All markdown files remain in their original location
- Metadata and relationships are indexed in `.cognistruct/db.db` (CozoDB/SQLite)
- The database is automatically created and updated when you open a vault

## Testing

The application has been tested with a test vault containing markdown files with wikilinks and tags. The test vault can be found in the design documents.

## Design Documents

- `docs/designv1.md`: Architecture overview and technology stack
- `docs/designv2.md`: DCOM data model and Datalog implementation
- `docs/designv3.md`: CozoDB integration and system architecture

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
