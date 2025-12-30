//! # Sync 模块
//!
//! 本模块负责知识库文件的同步功能，将文件系统中的内容同步到 DCOM 系统。
//!
//! ## 设计理念
//!
//! Sync 模块作为文件系统与 DCOM 系统之间的桥梁：
//! - 使用适配器层将文件转换为 CognitiveObject
//! - 将对象及其关系持久化到 CozoDB
//! - 监听文件变化实现增量同步
//!
//! ## 模块依赖
//!
//! - [`crate::adapters`] - 适配器层，提供文件格式转换
//! - [`crate::db`] - 数据库操作
//! - [`crate::dcom`] - DCOM 核心数据结构
//! - `walkdir` - 目录遍历
//! - `anyhow` - 错误处理
//!
//! ## 子模块
//!
//! - [`watcher`] - 文件监听器，监控知识库文件变化
//!
//! ## 导出的主要内容
//!
//! ### 结构体
//! - [`VaultSyncer`] - 知识库同步器
//!
//! ### 函数
//! - [`sync_vault`] - 同步整个知识库（兼容旧接口）
//! - [`calculate_hash`] - 计算内容哈希值
//! - [`path_to_uuid`] - 根据路径生成 UUID
//!
//! ### 重导出
//! - [`FileWatcher`] - 从 watcher 模块重导出
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use sync::{VaultSyncer, FileWatcher};
//! use db::Database;
//! use adapters::AdapterRegistry;
//!
//! let mut db = Database::new("db.db".into())?;
//! let registry = AdapterRegistry::default();
//! let syncer = VaultSyncer::new(registry);
//!
//! syncer.sync_full(&vault_path, &mut db)?;
//! ```
//!
//! ## 状态说明
//!
//! - `VaultSyncer` 持有适配器注册表，可重用
//! - 同步操作会修改数据库状态

pub mod watcher;

use crate::adapters::AdapterRegistry;
use crate::db::{Database, Edge, Node};
use crate::dcom::CognitiveObject;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

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
///
/// # 副作用
///
/// 无副作用，纯函数
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
///
/// # 副作用
///
/// 无副作用，纯函数
pub fn path_to_uuid(relative_path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    relative_path.hash(&mut hasher);
    let hash = hasher.finish();
    format!(
        "{:08x}-{:04x}-{:04x}-{:04x}-{:012x}",
        (hash >> 32) as u32,
        ((hash >> 16) & 0xFFFF) as u16,
        (hash & 0xFFFF) as u16,
        ((hash >> 48) & 0xFFFF) as u16,
        hash & 0xFFFFFFFFFFFF
    )
}

/// 知识库同步器
///
/// 负责将知识库文件同步到 DCOM 系统。
/// 使用适配器注册表支持多种文件格式。
///
/// # 设计说明
///
/// - 无状态设计（适配器注册表是配置）
/// - 支持全量同步和增量同步
/// - 自动选择合适的适配器处理文件
///
/// # 使用示例
///
/// ```rust,ignore
/// let syncer = VaultSyncer::new(AdapterRegistry::default());
/// syncer.sync_full(&vault_path, &mut db)?;
/// ```
pub struct VaultSyncer {
    /// 适配器注册表
    registry: AdapterRegistry,
}

impl VaultSyncer {
    /// 创建新的同步器
    ///
    /// # 参数
    ///
    /// * `registry` - 适配器注册表
    pub fn new(registry: AdapterRegistry) -> Self {
        VaultSyncer { registry }
    }

    /// 使用默认适配器创建同步器
    pub fn with_defaults() -> Self {
        VaultSyncer {
            registry: AdapterRegistry::default(),
        }
    }

    /// 全量同步知识库
    ///
    /// 清除现有数据，重新扫描并索引所有文件。
    ///
    /// # 参数
    ///
    /// * `vault_path` - 知识库根目录路径
    /// * `db` - 数据库实例的可变引用
    ///
    /// # 返回值
    ///
    /// * `Ok(SyncResult)` - 同步成功，返回统计信息
    /// * `Err(anyhow::Error)` - 同步失败
    ///
    /// # 副作用
    ///
    /// - 清除数据库中所有现有数据
    /// - 创建新的节点和边
    pub fn sync_full(&self, vault_path: &Path, db: &mut Database) -> Result<SyncResult> {
        // 清除现有数据
        db.clear_all()?;

        // 收集所有对象
        let objects = self.collect_objects(vault_path)?;

        // 构建文件名到 UUID 的映射（用于解析 wikilinks）
        let filename_to_uuids = self.build_filename_index(&objects);

        // 第一遍：创建所有节点
        for (obj, relative_path) in &objects {
            let node = self.object_to_node(obj, relative_path);
            db.upsert_node(&node)?;
        }

        // 第二遍：创建边
        let mut edge_count = 0;
        for (obj, relative_path) in &objects {
            let src_uuid = path_to_uuid(relative_path);

            // 从适配器提取链接
            if let Some(adapter) = self
                .registry
                .find_adapter_for_path(Path::new(relative_path))
            {
                let links = adapter.extract_links(obj);

                for link in links {
                    // 尝试通过文件名解析链接目标
                    if let Some(dst_uuids) = filename_to_uuids.get(&link.target) {
                        for dst_uuid in dst_uuids {
                            let edge = Edge {
                                src_uuid: src_uuid.clone(),
                                dst_uuid: dst_uuid.clone(),
                                relation: "link".to_string(),
                                weight: 1.0,
                                source: format!("{:?}", link.kind),
                            };
                            db.upsert_edge(&edge)?;
                            edge_count += 1;
                        }
                    }
                }
            }

            // 处理标签
            for tag in obj.tags() {
                let tag_uuid = format!("tag:{}", tag);
                let edge = Edge {
                    src_uuid: src_uuid.clone(),
                    dst_uuid: tag_uuid,
                    relation: "tagged".to_string(),
                    weight: 1.0,
                    source: "tag".to_string(),
                };
                db.upsert_edge(&edge)?;
                edge_count += 1;
            }
        }

        Ok(SyncResult {
            nodes_synced: objects.len(),
            edges_created: edge_count,
        })
    }

    /// 同步单个文件
    ///
    /// 处理单个文件的变化，更新对应的节点。
    ///
    /// # 参数
    ///
    /// * `file_path` - 文件绝对路径
    /// * `vault_path` - 知识库根目录
    /// * `db` - 数据库实例
    ///
    /// # 返回值
    ///
    /// * `Ok(true)` - 文件已同步
    /// * `Ok(false)` - 文件不受支持或不存在
    /// * `Err(anyhow::Error)` - 同步失败
    pub fn sync_file(
        &self,
        file_path: &Path,
        vault_path: &Path,
        db: &mut Database,
    ) -> Result<bool> {
        // 检查文件是否存在
        if !file_path.exists() {
            // 文件被删除，移除对应节点
            let relative_path = file_path
                .strip_prefix(vault_path)
                .unwrap_or(file_path)
                .to_string_lossy()
                .to_string();
            let uuid = path_to_uuid(&relative_path);
            db.delete_node(&uuid)?;
            db.delete_edges_by_node(&uuid)?;
            return Ok(true);
        }

        // 查找适配器
        let adapter = match self.registry.find_adapter_for_path(file_path) {
            Some(a) => a,
            None => return Ok(false), // 不支持的文件类型
        };

        // 读取文件内容
        let content = fs::read(file_path).context("读取文件失败")?;

        // 计算相对路径
        let relative_path = file_path
            .strip_prefix(vault_path)
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string();

        // 使用适配器加载对象
        let obj = adapter
            .load(Path::new(&relative_path), &content)
            .context("解析文件失败")?;

        // 转换为节点并保存
        let node = self.object_to_node(&obj, &relative_path);
        db.upsert_node(&node)?;

        // 更新边（先删除旧边）
        let uuid = path_to_uuid(&relative_path);
        db.delete_edges_by_node(&uuid)?;

        // 重新创建标签边
        for tag in obj.tags() {
            let edge = Edge {
                src_uuid: uuid.clone(),
                dst_uuid: format!("tag:{}", tag),
                relation: "tagged".to_string(),
                weight: 1.0,
                source: "tag".to_string(),
            };
            db.upsert_edge(&edge)?;
        }

        // 注意：wikilink 边需要完整的文件名索引才能正确解析
        // 增量同步时可能需要重新扫描或使用缓存

        Ok(true)
    }

    /// 收集知识库中所有对象
    ///
    /// 遍历目录，使用适配器将文件转换为 CognitiveObject。
    fn collect_objects(&self, vault_path: &Path) -> Result<Vec<(CognitiveObject, String)>> {
        let mut objects = Vec::new();

        for entry in WalkDir::new(vault_path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            // 查找适配器
            if let Some(adapter) = self.registry.find_adapter_for_path(path) {
                if let Ok(content) = fs::read(path) {
                    let relative_path = path
                        .strip_prefix(vault_path)
                        .unwrap_or(path)
                        .to_string_lossy()
                        .to_string();

                    if let Ok(obj) = adapter.load(Path::new(&relative_path), &content) {
                        objects.push((obj, relative_path));
                    }
                }
            }
        }

        Ok(objects)
    }

    /// 构建文件名到 UUID 的索引
    ///
    /// 用于解析 wikilinks（wikilinks 通常引用文件名而非完整路径）。
    fn build_filename_index(
        &self,
        objects: &[(CognitiveObject, String)],
    ) -> HashMap<String, Vec<String>> {
        let mut index: HashMap<String, Vec<String>> = HashMap::new();

        for (_obj, relative_path) in objects {
            let uuid = path_to_uuid(relative_path);

            // 提取文件名（不含扩展名）
            let filename = Path::new(relative_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            index.entry(filename).or_default().push(uuid);
        }

        index
    }

    /// 将 CognitiveObject 转换为数据库 Node
    fn object_to_node(&self, obj: &CognitiveObject, relative_path: &str) -> Node {
        let uuid = path_to_uuid(relative_path);
        let now = chrono::Utc::now().timestamp();

        // 获取标题，优先使用对象的 title 属性，否则使用文件名
        let title = obj.title().map(|s| s.to_string()).unwrap_or_else(|| {
            Path::new(relative_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Untitled")
                .to_string()
        });

        // 获取内容
        let content = obj.content().unwrap_or("").to_string();

        // 获取类型
        let node_type = obj.get_type().unwrap_or("note").to_string();

        // 计算哈希
        let hash = calculate_hash(&content);

        Node {
            uuid,
            path: relative_path.to_string(),
            title,
            content,
            node_type,
            hash,
            created_at: now,
            updated_at: now,
        }
    }
}

impl Default for VaultSyncer {
    fn default() -> Self {
        Self::with_defaults()
    }
}

/// 同步结果
///
/// 记录同步操作的统计信息。
#[derive(Debug, Clone)]
pub struct SyncResult {
    /// 同步的节点数量
    pub nodes_synced: usize,
    /// 创建的边数量
    pub edges_created: usize,
}

/// 同步知识库（兼容旧接口）
///
/// 使用默认适配器同步整个知识库。
/// 这是一个便捷函数，保持向后兼容。
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
pub fn sync_vault(vault_path: &Path, db: &mut Database) -> Result<()> {
    let syncer = VaultSyncer::with_defaults();
    syncer.sync_full(vault_path, db)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
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
    fn test_path_to_uuid() {
        let uuid1 = path_to_uuid("notes/test.md");
        let uuid2 = path_to_uuid("notes/test.md");
        let uuid3 = path_to_uuid("notes/other.md");

        assert_eq!(uuid1, uuid2);
        assert_ne!(uuid1, uuid3);
        // UUID 格式验证
        assert!(uuid1.contains('-'));
    }

    #[test]
    fn test_vault_syncer_new() {
        let syncer = VaultSyncer::with_defaults();
        // 验证能够创建
        assert!(syncer.registry.find_adapter("md").is_some());
    }

    #[test]
    fn test_sync_vault() {
        let vault_dir = TempDir::new().unwrap();
        let vault_path = vault_dir.path();

        // 创建测试文件
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

        // 创建子目录
        fs::create_dir(vault_path.join("subfolder")).unwrap();
        fs::write(
            vault_path.join("subfolder/note3.md"),
            "# Note 3\n\nLink to [[note1]].\n\n#tag3",
        )
        .unwrap();

        let db_dir = TempDir::new().unwrap();
        let db_path = db_dir.path().join("test.db");
        let mut db = Database::new(db_path).unwrap();

        // 使用兼容接口
        sync_vault(vault_path, &mut db).unwrap();

        let nodes = db.get_all_nodes().unwrap();
        assert_eq!(nodes.len(), 3);

        let titles: Vec<String> = nodes.iter().map(|n| n.title.clone()).collect();
        assert!(titles.contains(&"Note 1".to_string()));
        assert!(titles.contains(&"Note 2".to_string()));
        assert!(titles.contains(&"Note 3".to_string()));
    }

    #[test]
    fn test_sync_full_with_result() {
        let vault_dir = TempDir::new().unwrap();
        let vault_path = vault_dir.path();

        fs::write(
            vault_path.join("note1.md"),
            "# Note 1\n\nLink to [[note2]].\n\n#tag1",
        )
        .unwrap();

        fs::write(vault_path.join("note2.md"), "# Note 2\n\nContent").unwrap();

        let db_dir = TempDir::new().unwrap();
        let db_path = db_dir.path().join("test.db");
        let mut db = Database::new(db_path).unwrap();

        let syncer = VaultSyncer::with_defaults();
        let result = syncer.sync_full(vault_path, &mut db).unwrap();

        assert_eq!(result.nodes_synced, 2);
        assert!(result.edges_created >= 2); // 至少 1 个链接 + 1 个标签
    }

    #[test]
    fn test_sync_file_new() {
        let vault_dir = TempDir::new().unwrap();
        let vault_path = vault_dir.path();

        let db_dir = TempDir::new().unwrap();
        let db_path = db_dir.path().join("test.db");
        let mut db = Database::new(db_path).unwrap();

        // 创建文件
        let file_path = vault_path.join("new_note.md");
        fs::write(&file_path, "# New Note\n\nContent here.").unwrap();

        let syncer = VaultSyncer::with_defaults();
        let synced = syncer.sync_file(&file_path, vault_path, &mut db).unwrap();

        assert!(synced);

        let nodes = db.get_all_nodes().unwrap();
        assert_eq!(nodes.len(), 1);
        assert_eq!(nodes[0].title, "New Note");
    }

    #[test]
    fn test_sync_file_unsupported() {
        let vault_dir = TempDir::new().unwrap();
        let vault_path = vault_dir.path();

        let db_dir = TempDir::new().unwrap();
        let db_path = db_dir.path().join("test.db");
        let mut db = Database::new(db_path).unwrap();

        // 创建不支持的文件类型
        let file_path = vault_path.join("image.png");
        fs::write(&file_path, "fake image data").unwrap();

        let syncer = VaultSyncer::with_defaults();
        let synced = syncer.sync_file(&file_path, vault_path, &mut db).unwrap();

        assert!(!synced); // 不支持的文件类型
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

    #[test]
    fn test_sync_vault_clear_old_data() {
        let vault_dir = TempDir::new().unwrap();
        let vault_path = vault_dir.path();

        fs::write(vault_path.join("note1.md"), "# Note 1\n\nContent").unwrap();

        let db_dir = TempDir::new().unwrap();
        let db_path = db_dir.path().join("test.db");
        let mut db = Database::new(db_path).unwrap();

        // 第一次同步
        sync_vault(vault_path, &mut db).unwrap();
        let nodes1 = db.get_all_nodes().unwrap();
        assert_eq!(nodes1.len(), 1);

        // 第二次同步 - 应该清除并重建
        sync_vault(vault_path, &mut db).unwrap();
        let nodes2 = db.get_all_nodes().unwrap();
        assert_eq!(nodes2.len(), 1);
    }

    #[test]
    fn test_build_filename_index() {
        let syncer = VaultSyncer::with_defaults();

        let obj1 = CognitiveObject::new();
        let obj2 = CognitiveObject::new();

        let objects = vec![
            (obj1, "notes/test.md".to_string()),
            (obj2, "other/test.md".to_string()), // 同名文件
        ];

        let index = syncer.build_filename_index(&objects);

        // 同名文件应该有多个 UUID
        assert!(index.contains_key("test"));
        assert_eq!(index["test"].len(), 2);
    }
}
