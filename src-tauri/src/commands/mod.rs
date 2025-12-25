use crate::db::{Database, GraphData, Node};
use crate::sync::{sync_vault, FileWatcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;
use walkdir::WalkDir;

#[derive(Default)]
pub struct AppState {
    pub db: Mutex<Option<Database>>,
    pub vault_path: Mutex<Option<PathBuf>>,
    pub watcher: Mutex<Option<FileWatcher>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

#[tauri::command]
pub async fn open_vault(path: String, state: State<'_, AppState>) -> Result<String, String> {
    let vault_path = PathBuf::from(&path);
    
    if !vault_path.exists() || !vault_path.is_dir() {
        return Err("Invalid vault path".to_string());
    }
    
    // Initialize database
    let db_path = vault_path.join(".cognistruct").join("db.db");
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let mut db = Database::new(db_path).map_err(|e| e.to_string())?;
    
    // Sync vault
    sync_vault(&vault_path, &mut db).map_err(|e| e.to_string())?;
    
    // Set up file watcher
    let watcher = FileWatcher::new(&vault_path).map_err(|e| e.to_string())?;
    
    // Store state
    *state.db.lock().unwrap() = Some(db);
    *state.vault_path.lock().unwrap() = Some(vault_path);
    *state.watcher.lock().unwrap() = Some(watcher);
    
    Ok("Vault opened successfully".to_string())
}

#[tauri::command]
pub async fn get_graph_data(state: State<'_, AppState>) -> Result<GraphData, String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("No vault opened")?;
    
    db.get_graph_data().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_file_tree(state: State<'_, AppState>) -> Result<Vec<FileNode>, String> {
    let vault_path_guard = state.vault_path.lock().unwrap();
    let vault_path = vault_path_guard.as_ref().ok_or("No vault opened")?;
    
    fn build_tree(path: &Path, base_path: &Path) -> Result<FileNode, String> {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        
        let relative_path = path
            .strip_prefix(base_path)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();
        
        let is_dir = path.is_dir();
        
        let children = if is_dir {
            let mut child_nodes = Vec::new();
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let entry_path = entry.path();
                    // Skip hidden files and .cognistruct directory
                    if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
                        if name.starts_with('.') {
                            continue;
                        }
                    }
                    if let Ok(child) = build_tree(&entry_path, base_path) {
                        child_nodes.push(child);
                    }
                }
            }
            // Sort: directories first, then files
            child_nodes.sort_by(|a, b| {
                match (a.is_dir, b.is_dir) {
                    (true, false) => std::cmp::Ordering::Less,
                    (false, true) => std::cmp::Ordering::Greater,
                    _ => a.name.cmp(&b.name),
                }
            });
            Some(child_nodes)
        } else {
            None
        };
        
        Ok(FileNode {
            name,
            path: relative_path,
            is_dir,
            children,
        })
    }
    
    let tree = build_tree(vault_path, vault_path)?;
    Ok(tree.children.unwrap_or_default())
}

#[tauri::command]
pub async fn get_file_content(path: String, state: State<'_, AppState>) -> Result<String, String> {
    let vault_path_guard = state.vault_path.lock().unwrap();
    let vault_path = vault_path_guard.as_ref().ok_or("No vault opened")?;
    
    let file_path = vault_path.join(&path);
    fs::read_to_string(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_file(
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let vault_path_guard = state.vault_path.lock().unwrap();
    let vault_path = vault_path_guard.as_ref().ok_or("No vault opened")?;
    
    let file_path = vault_path.join(&path);
    
    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    fs::write(&file_path, content).map_err(|e| e.to_string())?;
    
    Ok("File saved successfully".to_string())
}

#[tauri::command]
pub async fn search_nodes(query: String, state: State<'_, AppState>) -> Result<Vec<Node>, String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("No vault opened")?;
    
    db.search_nodes(&query).map_err(|e| e.to_string())
}
