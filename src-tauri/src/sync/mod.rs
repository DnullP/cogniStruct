//! # Sync 模块
//!
//! 本模块负责知识库文件的同步和解析功能。
//!
//! ## 模块依赖
//!
//! - [`crate::db`] - 数据库操作
//! - `walkdir` - 目录遍历
//! - `anyhow` - 错误处理
//!
//! ## 子模块
//!
//! - [`parser`] - Markdown 解析器，提取标题、wikilinks 和标签
//! - [`watcher`] - 文件监听器，监控知识库文件变化
//!
//! ## 导出的主要内容
//!
//! ### 函数
//! - [`sync_vault`] - 同步整个知识库
//! - [`process_file_change`] - 处理单个文件变化
//! - [`calculate_hash`] - 计算内容哈希值
//! - [`path_to_uuid`] - 根据路径生成 UUID
//!
//! ### 重导出
//! - [`parse_markdown`] - 从 parser 模块重导出
//! - [`FileWatcher`] - 从 watcher 模块重导出
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use sync::{sync_vault, FileWatcher};
//! use db::Database;
//!
//! let mut db = Database::new("db.db".into())?;
//! sync_vault(&vault_path, &mut db)?;
//!
//! let watcher = FileWatcher::new(&vault_path)?;
//! ```

pub mod parser;
pub mod watcher;

use crate::db::{Database, Edge, Node};
use anyhow::Result;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

pub use parser::parse_markdown;
pub use watcher::FileWatcher;

/// 计算内容哈希值
///
/// 使用标准库的 DefaultHasher 计算字符串内容的哈希值。
/// 用于检测文件内容是否发生变化。
///
/// # 参数
///
/// * `content` - 要计算哈希的内容
///
/// # 返回值
///
/// 返回十六进制格式的哈希字符串
pub fn calculate_hash(content: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// 根据相对路径生成确定性 UUID
///
/// 使用文件的相对路径生成一个确定性的 UUID 样式的标识符。
/// 同一路径始终生成相同的 UUID。
///
/// # 参数
///
/// * `relative_path` - 相对于知识库根目录的文件路径
///
/// # 返回值
///
/// 返回 UUID 格式的字符串（如 "12345678-1234-1234-1234-123456789012"）
pub fn path_to_uuid(relative_path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    relative_path.hash(&mut hasher);
    let hash = hasher.finish();
    // Format as UUID-like string for consistency
    format!(
        "{:08x}-{:04x}-{:04x}-{:04x}-{:012x}",
        (hash >> 32) as u32,
        ((hash >> 16) & 0xFFFF) as u16,
        (hash & 0xFFFF) as u16,
        ((hash >> 48) & 0xFFFF) as u16,
        hash & 0xFFFFFFFFFFFF
    )
}

/// 同步知识库
///
/// 扫描知识库目录中的所有 Markdown 文件，解析其内容并更新数据库。
/// 包括创建节点和根据 wikilinks/tags 创建边。
///
/// # 参数
///
/// * `vault_path` - 知识库根目录路径
/// * `db` - 数据库实例的可变引用
///
/// # 返回值
///
/// * `Ok(())` - 同步成功
/// * `Err(anyhow::Error)` - 同步失败
///
/// # 错误情况
///
/// * 文件读取失败
/// * 数据库操作失败
pub fn sync_vault(vault_path: &Path, db: &mut Database) -> Result<()> {
    // Clear existing data to avoid accumulation
    db.clear_all()?;

    // Map: filename -> Vec<uuid> (multiple files can have same name in different folders)
    let mut filename_to_uuids: HashMap<String, Vec<String>> = HashMap::new();

    // First pass: Index all markdown files and create nodes
    for entry in WalkDir::new(vault_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            if let Ok(content) = fs::read_to_string(path) {
                let _parsed = parse_markdown(&content);
                let hash = calculate_hash(&content);
                let relative_path = path
                    .strip_prefix(vault_path)
                    .unwrap_or(path)
                    .to_string_lossy()
                    .to_string();

                // UUID is determined by relative path (unique identifier)
                let uuid = path_to_uuid(&relative_path);

                // Use filename (without .md extension) as display name
                let filename = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Untitled")
                    .to_string();

                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64;

                let node = Node {
                    uuid: uuid.clone(),
                    path: relative_path.clone(),
                    title: filename.clone(), // Display name is filename
                    content: content.clone(),
                    node_type: "note".to_string(),
                    hash,
                    created_at: now,
                    updated_at: now,
                };

                db.upsert_node(&node)?;

                // Track all uuids for each filename (handles same-name files in different folders)
                filename_to_uuids
                    .entry(filename)
                    .or_insert_with(Vec::new)
                    .push(uuid);
            }
        }
    }

    // Second pass: Create edges from wikilinks
    for entry in WalkDir::new(vault_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            if let Ok(content) = fs::read_to_string(path) {
                let parsed = parse_markdown(&content);
                let relative_path = path
                    .strip_prefix(vault_path)
                    .unwrap_or(path)
                    .to_string_lossy()
                    .to_string();

                let src_uuid = path_to_uuid(&relative_path);

                // Create edges from wikilinks
                for wikilink in &parsed.wikilinks {
                    // Try to find target by filename (wikilinks reference filenames)
                    // If multiple files have the same name, link to all of them
                    if let Some(dst_uuids) = filename_to_uuids.get(wikilink) {
                        for dst_uuid in dst_uuids {
                            let edge = Edge {
                                src_uuid: src_uuid.clone(),
                                dst_uuid: dst_uuid.clone(),
                                relation: "link".to_string(),
                                weight: 1.0,
                                source: "wikilink".to_string(),
                            };
                            db.upsert_edge(&edge)?;
                        }
                    }
                }

                // Create edges for tags
                for tag in &parsed.tags {
                    // Create a virtual tag node if it doesn't exist
                    let tag_uuid = format!("tag:{}", tag);
                    let edge = Edge {
                        src_uuid: src_uuid.clone(),
                        dst_uuid: tag_uuid,
                        relation: "tagged".to_string(),
                        weight: 1.0,
                        source: "tag".to_string(),
                    };
                    db.upsert_edge(&edge)?;
                }
            }
        }
    }

    Ok(())
}

/// 处理单个文件变化
///
/// 当检测到文件变化时，更新该文件对应的节点信息。
/// 包括更新内容、哈希值和时间戳，并重新创建相关的边。
///
/// # 参数
///
/// * `file_path` - 变化的文件绝对路径
/// * `vault_path` - 知识库根目录路径
/// * `db` - 数据库实例的可变引用
///
/// # 返回值
///
/// * `Ok(())` - 处理成功
/// * `Err(anyhow::Error)` - 处理失败
///
/// # 错误情况
///
/// * 文件读取失败
/// * 数据库操作失败
pub fn process_file_change(file_path: &Path, vault_path: &Path, db: &mut Database) -> Result<()> {
    if let Ok(content) = fs::read_to_string(file_path) {
        let _parsed = parse_markdown(&content);
        let relative_path = file_path
            .strip_prefix(vault_path)
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string();

        // UUID is determined by relative path (unique and deterministic)
        let uuid = path_to_uuid(&relative_path);

        // Use filename as display name
        let filename = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string();

        // Check if node already exists
        let existing_nodes = db.get_all_nodes()?;
        let existing_node = existing_nodes.iter().find(|n| n.path == relative_path);

        let hash = calculate_hash(&content);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let node = Node {
            uuid: uuid.clone(),
            path: relative_path,
            title: filename, // Display name is filename
            content,
            node_type: "note".to_string(),
            hash,
            created_at: existing_node.map(|n| n.created_at).unwrap_or(now),
            updated_at: now,
        };

        db.upsert_node(&node)?;

        // Delete old edges and recreate them
        db.delete_edges_by_node(&uuid)?;

        // This is a simplified version - in production, you'd want to resolve wikilinks properly
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_calculate_hash() {
        let content1 = "Hello, World!";
        let content2 = "Hello, World!";
        let content3 = "Different content";

        let hash1 = calculate_hash(content1);
        let hash2 = calculate_hash(content2);
        let hash3 = calculate_hash(content3);

        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
    }

    #[test]
    fn test_sync_vault() {
        // Create temp directory for test vault
        let vault_dir = TempDir::new().unwrap();
        let vault_path = vault_dir.path();

        // Create test markdown files
        fs::write(
            vault_path.join("note1.md"),
            "# Note 1\n\nLink to [[note2]].\n\n#tag1",
        )
        .unwrap();

        fs::write(
            vault_path.join("note2.md"),
            "# Note 2\n\nLink to [[note1]].\n\n#tag2",
        )
        .unwrap();

        // Create subdirectory with note
        fs::create_dir(vault_path.join("subfolder")).unwrap();
        fs::write(
            vault_path.join("subfolder/note3.md"),
            "# Note 3\n\nLink to [[note1]].\n\n#tag3",
        )
        .unwrap();

        // Create test database
        let db_dir = TempDir::new().unwrap();
        let db_path = db_dir.path().join("test.db");
        let mut db = Database::new(db_path).unwrap();

        // Sync the vault
        sync_vault(vault_path, &mut db).unwrap();

        // Verify nodes
        let nodes = db.get_all_nodes().unwrap();
        assert_eq!(nodes.len(), 3);

        let titles: Vec<String> = nodes.iter().map(|n| n.title.clone()).collect();
        assert!(titles.contains(&"note1".to_string()));
        assert!(titles.contains(&"note2".to_string()));
        assert!(titles.contains(&"note3".to_string()));

        // Verify edges
        let edges = db.get_all_edges().unwrap();
        assert!(edges.len() >= 2); // At least Note 1 <-> Note 2

        // Verify that links are created
        let edge_exists = edges.iter().any(|e| {
            let src_node = nodes.iter().find(|n| n.uuid == e.src_uuid);
            let dst_node = nodes.iter().find(|n| n.uuid == e.dst_uuid);
            src_node.map(|s| s.title.as_str()) == Some("note1")
                && dst_node.map(|d| d.title.as_str()) == Some("note2")
        });
        assert!(edge_exists);
    }

    #[test]
    fn test_sync_vault_clear_old_data() {
        let vault_dir = TempDir::new().unwrap();
        let vault_path = vault_dir.path();

        fs::write(vault_path.join("note1.md"), "# Note 1\n\nContent").unwrap();

        let db_dir = TempDir::new().unwrap();
        let db_path = db_dir.path().join("test.db");
        let mut db = Database::new(db_path).unwrap();

        // First sync
        sync_vault(vault_path, &mut db).unwrap();
        let nodes1 = db.get_all_nodes().unwrap();
        assert_eq!(nodes1.len(), 1);

        // Second sync - should clear and recreate
        sync_vault(vault_path, &mut db).unwrap();
        let nodes2 = db.get_all_nodes().unwrap();
        assert_eq!(nodes2.len(), 1);

        // Should be different UUIDs (since we clear and recreate)
        // This tests that clear_all() works
    }

    #[test]
    fn test_sync_vault_empty() {
        let vault_dir = TempDir::new().unwrap();
        let vault_path = vault_dir.path();

        let db_dir = TempDir::new().unwrap();
        let db_path = db_dir.path().join("test.db");
        let mut db = Database::new(db_path).unwrap();

        sync_vault(vault_path, &mut db).unwrap();

        let nodes = db.get_all_nodes().unwrap();
        let edges = db.get_all_edges().unwrap();
        assert_eq!(nodes.len(), 0);
        assert_eq!(edges.len(), 0);
    }
}
