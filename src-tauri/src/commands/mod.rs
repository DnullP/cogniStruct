//! # Commands 模块
//!
//! 本模块提供 Tauri 前端调用的所有命令接口。
//!
//! ## 模块依赖
//!
//! - [`crate::db`] - 数据库操作
//! - [`crate::sync`] - 文件同步和监听
//!
//! ## 导出的主要内容
//!
//! ### 结构体
//! - [`AppState`] - 应用程序全局状态
//! - [`FileNode`] - 文件树节点
//!
//! ### 命令
//! - [`open_vault`] - 打开知识库
//! - [`get_graph_data`] - 获取图数据
//! - [`get_file_tree`] - 获取文件树
//! - [`get_file_content`] - 获取文件内容
//! - [`save_file`] - 保存文件
//! - [`search_nodes`] - 搜索节点
//!
//! ## 使用示例
//!
//! 这些命令通过 Tauri 的 invoke 机制从前端调用：
//!
//! ```javascript
//! // 前端调用示例
//! const result = await invoke('open_vault', { path: '/path/to/vault' });
//! ```

use crate::db::{Database, GraphData, Node};
use crate::sync::{sync_vault, FileWatcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

/// 应用程序全局状态
///
/// 存储应用程序运行时需要的全局状态，包括数据库连接、知识库路径和文件监听器。
/// 使用 `Mutex` 确保线程安全访问。
///
/// # 字段说明
///
/// * `db` - 数据库实例，用于存储和查询知识图谱数据
/// * `vault_path` - 当前打开的知识库路径
/// * `watcher` - 文件监听器，用于监控知识库文件变化
#[derive(Default)]
pub struct AppState {
    /// 数据库实例，封装在 Option 中表示可能未初始化
    pub db: Mutex<Option<Database>>,
    /// 当前打开的知识库路径
    pub vault_path: Mutex<Option<PathBuf>>,
    /// 文件变化监听器
    pub watcher: Mutex<Option<FileWatcher>>,
}

/// 文件树节点
///
/// 表示知识库中的一个文件或目录，用于构建文件树结构。
///
/// # 字段说明
///
/// * `name` - 文件或目录名称
/// * `path` - 相对于知识库根目录的路径
/// * `is_dir` - 是否为目录
/// * `children` - 子节点列表（仅目录有效）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    /// 文件或目录名称
    pub name: String,
    /// 相对于知识库根目录的路径
    pub path: String,
    /// 是否为目录
    pub is_dir: bool,
    /// 子节点列表，仅当 is_dir 为 true 时有值
    pub children: Option<Vec<FileNode>>,
}

/// 打开知识库
///
/// 初始化并打开指定路径的知识库，创建数据库、同步文件并启动文件监听。
///
/// # 参数
///
/// * `path` - 知识库目录的绝对路径
/// * `state` - 应用程序状态
///
/// # 返回值
///
/// * `Ok(String)` - 成功打开知识库，返回成功消息
/// * `Err(String)` - 打开失败，返回错误信息
///
/// # 错误情况
///
/// * 路径不存在或不是目录
/// * 数据库初始化失败
/// * 文件同步失败
/// * 文件监听器创建失败
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

/// 获取知识图谱数据
///
/// 从数据库中获取所有节点和边，用于前端图形可视化。
///
/// # 参数
///
/// * `state` - 应用程序状态
///
/// # 返回值
///
/// * `Ok(GraphData)` - 包含所有节点和边的图数据
/// * `Err(String)` - 获取失败，返回错误信息
///
/// # 错误情况
///
/// * 未打开知识库
/// * 数据库查询失败
#[tauri::command]
pub async fn get_graph_data(state: State<'_, AppState>) -> Result<GraphData, String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("No vault opened")?;

    db.get_graph_data().map_err(|e| e.to_string())
}

/// 获取文件树结构
///
/// 递归构建知识库的文件树结构，用于前端文件浏览器显示。
/// 自动过滤隐藏文件和 `.cognistruct` 目录。
///
/// # 参数
///
/// * `state` - 应用程序状态
///
/// # 返回值
///
/// * `Ok(Vec<FileNode>)` - 文件树根节点的子节点列表
/// * `Err(String)` - 获取失败，返回错误信息
///
/// # 错误情况
///
/// * 未打开知识库
/// * 文件系统读取失败
#[tauri::command]
pub async fn get_file_tree(state: State<'_, AppState>) -> Result<Vec<FileNode>, String> {
    let vault_path_guard = state.vault_path.lock().unwrap();
    let vault_path = vault_path_guard.as_ref().ok_or("No vault opened")?;

    /// 递归构建文件树
    ///
    /// 内部辅助函数，递归遍历目录并构建 FileNode 树结构。
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
            child_nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.cmp(&b.name),
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

/// 获取文件内容
///
/// 读取指定路径文件的完整内容。
///
/// # 参数
///
/// * `path` - 相对于知识库根目录的文件路径
/// * `state` - 应用程序状态
///
/// # 返回值
///
/// * `Ok(String)` - 文件内容
/// * `Err(String)` - 读取失败，返回错误信息
///
/// # 错误情况
///
/// * 未打开知识库
/// * 文件不存在或无法读取
#[tauri::command]
pub async fn get_file_content(path: String, state: State<'_, AppState>) -> Result<String, String> {
    let vault_path_guard = state.vault_path.lock().unwrap();
    let vault_path = vault_path_guard.as_ref().ok_or("No vault opened")?;

    let file_path = vault_path.join(&path);
    fs::read_to_string(file_path).map_err(|e| e.to_string())
}

/// 保存文件内容
///
/// 将内容写入指定路径的文件，如果父目录不存在则自动创建。
///
/// # 参数
///
/// * `path` - 相对于知识库根目录的文件路径
/// * `content` - 要写入的文件内容
/// * `state` - 应用程序状态
///
/// # 返回值
///
/// * `Ok(String)` - 保存成功，返回成功消息
/// * `Err(String)` - 保存失败，返回错误信息
///
/// # 错误情况
///
/// * 未打开知识库
/// * 无法创建父目录
/// * 无法写入文件
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

/// 搜索节点
///
/// 根据查询字符串搜索匹配的知识节点，支持标题和内容搜索。
///
/// # 参数
///
/// * `query` - 搜索关键词
/// * `state` - 应用程序状态
///
/// # 返回值
///
/// * `Ok(Vec<Node>)` - 匹配的节点列表
/// * `Err(String)` - 搜索失败，返回错误信息
///
/// # 错误情况
///
/// * 未打开知识库
/// * 数据库查询失败
#[tauri::command]
pub async fn search_nodes(query: String, state: State<'_, AppState>) -> Result<Vec<Node>, String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("No vault opened")?;

    db.search_nodes(&query).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    /// 测试 FileNode 结构体的序列化
    #[test]
    fn test_file_node_serialization() {
        let node = FileNode {
            name: "test.md".to_string(),
            path: "folder/test.md".to_string(),
            is_dir: false,
            children: None,
        };

        let json = serde_json::to_string(&node).unwrap();
        assert!(json.contains("test.md"));
        assert!(json.contains("folder/test.md"));
        assert!(json.contains("\"is_dir\":false"));
    }

    /// 测试 FileNode 目录节点的序列化
    #[test]
    fn test_file_node_with_children() {
        let child = FileNode {
            name: "child.md".to_string(),
            path: "parent/child.md".to_string(),
            is_dir: false,
            children: None,
        };

        let parent = FileNode {
            name: "parent".to_string(),
            path: "parent".to_string(),
            is_dir: true,
            children: Some(vec![child]),
        };

        let json = serde_json::to_string(&parent).unwrap();
        assert!(json.contains("parent"));
        assert!(json.contains("child.md"));
        assert!(json.contains("\"is_dir\":true"));
    }

    /// 测试 AppState 默认初始化
    #[test]
    fn test_app_state_default() {
        let state = AppState::default();

        assert!(state.db.lock().unwrap().is_none());
        assert!(state.vault_path.lock().unwrap().is_none());
        assert!(state.watcher.lock().unwrap().is_none());
    }

    /// 测试 FileNode 反序列化
    #[test]
    fn test_file_node_deserialization() {
        let json = r#"{
            "name": "test.md",
            "path": "test.md",
            "is_dir": false,
            "children": null
        }"#;

        let node: FileNode = serde_json::from_str(json).unwrap();
        assert_eq!(node.name, "test.md");
        assert_eq!(node.path, "test.md");
        assert!(!node.is_dir);
        assert!(node.children.is_none());
    }
}
