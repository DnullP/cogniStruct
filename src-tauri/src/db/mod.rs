//! # Database 模块
//!
//! 本模块提供基于 CozoDB 的图数据库操作，用于存储和查询知识图谱数据。
//!
//! ## 模块依赖
//!
//! - `cozo` - CozoDB 嵌入式数据库引擎
//! - `anyhow` - 错误处理
//! - `serde` - 序列化/反序列化
//!
//! ## 导出的主要内容
//!
//! ### 结构体
//! - [`Database`] - 数据库操作封装
//! - [`Node`] - 知识节点
//! - [`Edge`] - 知识节点之间的边（关系）
//! - [`GraphData`] - 图数据（包含节点和边）
//!
//! ## 数据模型
//!
//! 本模块实现了一个简单的图数据模型：
//! - **节点（Node）**：代表一个 Markdown 文件，包含标题、内容、路径等信息
//! - **边（Edge）**：代表节点之间的关系，如 wikilink 引用或标签关联
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use db::{Database, Node, Edge};
//!
//! let mut db = Database::new("path/to/db.db".into())?;
//!
//! let node = Node {
//!     uuid: "uuid-1".to_string(),
//!     path: "note.md".to_string(),
//!     // ... 其他字段
//! };
//! db.upsert_node(&node)?;
//!
//! let graph_data = db.get_graph_data()?;
//! ```

use anyhow::Result;
use cozo::{DataValue, DbInstance, ScriptMutability};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;

/// 数据库操作封装
///
/// 封装 CozoDB 数据库实例，提供知识图谱的 CRUD 操作。
///
/// # 字段说明
///
/// * `db` - CozoDB 数据库实例
pub struct Database {
    /// CozoDB 数据库实例
    db: DbInstance,
}

/// 知识节点
///
/// 表示知识图谱中的一个节点，通常对应一个 Markdown 文件。
///
/// # 字段说明
///
/// * `uuid` - 节点的唯一标识符，基于文件路径生成
/// * `path` - 文件相对于知识库的路径
/// * `title` - 节点标题（文件名）
/// * `content` - 文件内容
/// * `node_type` - 节点类型（如 "note"）
/// * `hash` - 内容哈希值，用于检测变化
/// * `created_at` - 创建时间戳（Unix 时间戳）
/// * `updated_at` - 更新时间戳（Unix 时间戳）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    /// 节点的唯一标识符
    pub uuid: String,
    /// 文件相对路径
    pub path: String,
    /// 节点标题
    pub title: String,
    /// 文件内容
    pub content: String,
    /// 节点类型
    pub node_type: String,
    /// 内容哈希值
    pub hash: String,
    /// 创建时间戳
    pub created_at: i64,
    /// 更新时间戳
    pub updated_at: i64,
}

/// 知识边（关系）
///
/// 表示知识图谱中两个节点之间的关系。
///
/// # 字段说明
///
/// * `src_uuid` - 源节点 UUID
/// * `dst_uuid` - 目标节点 UUID
/// * `relation` - 关系类型（如 "link"、"tagged"）
/// * `weight` - 关系权重
/// * `source` - 关系来源（如 "wikilink"、"tag"）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    /// 源节点 UUID
    pub src_uuid: String,
    /// 目标节点 UUID
    pub dst_uuid: String,
    /// 关系类型
    pub relation: String,
    /// 关系权重
    pub weight: f64,
    /// 关系来源
    pub source: String,
}

/// 图数据
///
/// 包含完整的知识图谱数据，包括所有节点和边。
///
/// # 字段说明
///
/// * `nodes` - 所有知识节点的列表
/// * `edges` - 所有关系边的列表
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphData {
    /// 知识节点列表
    pub nodes: Vec<Node>,
    /// 关系边列表
    pub edges: Vec<Edge>,
}

impl Database {
    /// 创建新的数据库实例
    ///
    /// 初始化 CozoDB 数据库并创建必要的表结构。
    ///
    /// # 参数
    ///
    /// * `db_path` - 数据库文件路径
    ///
    /// # 返回值
    ///
    /// * `Ok(Database)` - 成功创建的数据库实例
    /// * `Err(anyhow::Error)` - 创建失败
    ///
    /// # 错误情况
    ///
    /// * 数据库文件创建失败
    /// * Schema 初始化失败
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let db = DbInstance::new("sqlite", db_path.to_str().unwrap(), "")
            .map_err(|e| anyhow::anyhow!("{}", e.to_string()))?;

        let mut database = Database { db };
        database.init_schema()?;

        Ok(database)
    }

    /// 初始化数据库 Schema
    ///
    /// 创建 nodes 和 edges 表，如果表已存在则忽略错误。
    fn init_schema(&mut self) -> Result<()> {
        // Create nodes table - ignore error if already exists
        let _ = self.db.run_script(
            r#"
            :create nodes {
                uuid: String,
                =>
                path: String,
                title: String,
                content: String,
                node_type: String,
                hash: String,
                created_at: Int,
                updated_at: Int
            }
            "#,
            Default::default(),
            ScriptMutability::Mutable,
        );

        // Create edges table - ignore error if already exists
        let _ = self.db.run_script(
            r#"
            :create edges {
                src_uuid: String,
                dst_uuid: String,
                =>
                relation: String,
                weight: Float,
                source: String
            }
            "#,
            Default::default(),
            ScriptMutability::Mutable,
        );

        Ok(())
    }

    /// 将 JSON 转换为 CozoDB 参数映射
    ///
    /// 内部辅助函数，将 serde_json::Value 转换为 CozoDB 运行时所需的参数格式。
    fn make_params(json: serde_json::Value) -> BTreeMap<String, DataValue> {
        let mut params = BTreeMap::new();
        if let serde_json::Value::Object(obj) = json {
            for (key, val) in obj {
                let data_val = match val {
                    serde_json::Value::String(s) => DataValue::Str(s.into()),
                    serde_json::Value::Number(n) => {
                        if let Some(i) = n.as_i64() {
                            DataValue::from(i)
                        } else if let Some(f) = n.as_f64() {
                            DataValue::from(f)
                        } else {
                            DataValue::Null
                        }
                    }
                    serde_json::Value::Bool(b) => DataValue::Bool(b),
                    _ => DataValue::Null,
                };
                params.insert(key, data_val);
            }
        }
        params
    }

    /// 插入或更新节点
    ///
    /// 如果节点已存在（根据 UUID）则更新，否则插入新节点。
    ///
    /// # 参数
    ///
    /// * `node` - 要插入或更新的节点
    ///
    /// # 返回值
    ///
    /// * `Ok(())` - 操作成功
    /// * `Err(anyhow::Error)` - 数据库操作失败
    pub fn upsert_node(&mut self, node: &Node) -> Result<()> {
        let params = Self::make_params(serde_json::json!({
            "uuid": node.uuid,
            "path": node.path,
            "title": node.title,
            "content": node.content,
            "node_type": node.node_type,
            "hash": node.hash,
            "created_at": node.created_at,
            "updated_at": node.updated_at,
        }));

        self.db.run_script(
            r#"
            ?[uuid, path, title, content, node_type, hash, created_at, updated_at] <- [[$uuid, $path, $title, $content, $node_type, $hash, $created_at, $updated_at]]
            :put nodes {uuid => path, title, content, node_type, hash, created_at, updated_at}
            "#,
            params,
            ScriptMutability::Mutable,
        ).map_err(|e| anyhow::anyhow!("{}", e.to_string()))?;

        Ok(())
    }

    /// 插入或更新边
    ///
    /// 如果边已存在（根据 src_uuid 和 dst_uuid）则更新，否则插入新边。
    ///
    /// # 参数
    ///
    /// * `edge` - 要插入或更新的边
    ///
    /// # 返回值
    ///
    /// * `Ok(())` - 操作成功
    /// * `Err(anyhow::Error)` - 数据库操作失败
    pub fn upsert_edge(&mut self, edge: &Edge) -> Result<()> {
        let params = Self::make_params(serde_json::json!({
            "src_uuid": edge.src_uuid,
            "dst_uuid": edge.dst_uuid,
            "relation": edge.relation,
            "weight": edge.weight,
            "source": edge.source,
        }));

        self.db.run_script(
            r#"
            ?[src_uuid, dst_uuid, relation, weight, source] <- [[$src_uuid, $dst_uuid, $relation, $weight, $source]]
            :put edges {src_uuid, dst_uuid => relation, weight, source}
            "#,
            params,
            ScriptMutability::Mutable,
        ).map_err(|e| anyhow::anyhow!("{}", e.to_string()))?;

        Ok(())
    }

    /// 获取所有节点
    ///
    /// 返回数据库中所有的知识节点。
    ///
    /// # 返回值
    ///
    /// * `Ok(Vec<Node>)` - 所有节点的列表
    /// * `Err(anyhow::Error)` - 数据库查询失败
    pub fn get_all_nodes(&self) -> Result<Vec<Node>> {
        let result = self.db.run_script(
            "?[uuid, path, title, content, node_type, hash, created_at, updated_at] := *nodes{uuid, path, title, content, node_type, hash, created_at, updated_at}",
            Default::default(),
            ScriptMutability::Immutable,
        ).map_err(|e| anyhow::anyhow!("{}", e.to_string()))?;

        let nodes: Vec<Node> = result
            .rows
            .iter()
            .map(|row| Node {
                uuid: row[0].get_str().unwrap_or("").to_string(),
                path: row[1].get_str().unwrap_or("").to_string(),
                title: row[2].get_str().unwrap_or("").to_string(),
                content: row[3].get_str().unwrap_or("").to_string(),
                node_type: row[4].get_str().unwrap_or("").to_string(),
                hash: row[5].get_str().unwrap_or("").to_string(),
                created_at: row[6].get_int().unwrap_or(0),
                updated_at: row[7].get_int().unwrap_or(0),
            })
            .collect();

        Ok(nodes)
    }

    /// 获取所有边
    ///
    /// 返回数据库中所有的关系边。
    ///
    /// # 返回值
    ///
    /// * `Ok(Vec<Edge>)` - 所有边的列表
    /// * `Err(anyhow::Error)` - 数据库查询失败
    pub fn get_all_edges(&self) -> Result<Vec<Edge>> {
        let result = self.db.run_script(
            "?[src_uuid, dst_uuid, relation, weight, source] := *edges{src_uuid, dst_uuid, relation, weight, source}",
            Default::default(),
            ScriptMutability::Immutable,
        ).map_err(|e| anyhow::anyhow!("{}", e.to_string()))?;

        let edges: Vec<Edge> = result
            .rows
            .iter()
            .map(|row| Edge {
                src_uuid: row[0].get_str().unwrap_or("").to_string(),
                dst_uuid: row[1].get_str().unwrap_or("").to_string(),
                relation: row[2].get_str().unwrap_or("").to_string(),
                weight: row[3].get_float().unwrap_or(1.0),
                source: row[4].get_str().unwrap_or("").to_string(),
            })
            .collect();

        Ok(edges)
    }

    /// 搜索节点
    ///
    /// 根据查询字符串在标题和内容中搜索匹配的节点，不区分大小写。
    ///
    /// # 参数
    ///
    /// * `query` - 搜索关键词
    ///
    /// # 返回值
    ///
    /// * `Ok(Vec<Node>)` - 匹配的节点列表
    /// * `Err(anyhow::Error)` - 数据库查询失败
    pub fn search_nodes(&self, query: &str) -> Result<Vec<Node>> {
        let query_lower = query.to_lowercase();
        let all_nodes = self.get_all_nodes()?;

        let filtered_nodes: Vec<Node> = all_nodes
            .into_iter()
            .filter(|node| {
                node.title.to_lowercase().contains(&query_lower)
                    || node.content.to_lowercase().contains(&query_lower)
            })
            .collect();

        Ok(filtered_nodes)
    }

    /// 获取完整的图数据
    ///
    /// 返回包含所有节点和边的图数据结构。
    ///
    /// # 返回值
    ///
    /// * `Ok(GraphData)` - 包含所有节点和边的图数据
    /// * `Err(anyhow::Error)` - 数据库查询失败
    pub fn get_graph_data(&self) -> Result<GraphData> {
        let nodes = self.get_all_nodes()?;
        let edges = self.get_all_edges()?;

        Ok(GraphData { nodes, edges })
    }

    /// 根据路径获取节点
    ///
    /// 根据文件路径查找对应的节点。
    ///
    /// # 参数
    ///
    /// * `path` - 文件相对路径
    ///
    /// # 返回值
    ///
    /// * `Ok(Some(Node))` - 找到匹配的节点
    /// * `Ok(None)` - 未找到节点
    /// * `Err(anyhow::Error)` - 数据库查询失败
    pub fn get_node_by_path(&self, path: &str) -> Result<Option<Node>> {
        let params = Self::make_params(serde_json::json!({ "path": path }));

        let result = self.db.run_script(
            "?[uuid, path, title, content, node_type, hash, created_at, updated_at] := *nodes{uuid, path, title, content, node_type, hash, created_at, updated_at}, path == $path",
            params,
            ScriptMutability::Immutable,
        ).map_err(|e| anyhow::anyhow!("{}", e.to_string()))?;

        if result.rows.is_empty() {
            Ok(None)
        } else {
            let row = &result.rows[0];
            Ok(Some(Node {
                uuid: row[0].get_str().unwrap_or("").to_string(),
                path: row[1].get_str().unwrap_or("").to_string(),
                title: row[2].get_str().unwrap_or("").to_string(),
                content: row[3].get_str().unwrap_or("").to_string(),
                node_type: row[4].get_str().unwrap_or("").to_string(),
                hash: row[5].get_str().unwrap_or("").to_string(),
                created_at: row[6].get_int().unwrap_or(0),
                updated_at: row[7].get_int().unwrap_or(0),
            }))
        }
    }

    /// 清空所有数据
    ///
    /// 删除数据库中的所有节点和边。
    ///
    /// # 返回值
    ///
    /// * `Ok(())` - 操作成功
    /// * `Err(anyhow::Error)` - 数据库操作失败
    pub fn clear_all(&mut self) -> Result<()> {
        // Delete all nodes
        let _ = self.db.run_script(
            "?[uuid, path, title, content, node_type, hash, created_at, updated_at] <- [] :replace nodes {uuid => path, title, content, node_type, hash, created_at, updated_at}",
            Default::default(),
            ScriptMutability::Mutable,
        );

        // Delete all edges
        let _ = self.db.run_script(
            "?[src_uuid, dst_uuid, relation, weight, source] <- [] :replace edges {src_uuid, dst_uuid => relation, weight, source}",
            Default::default(),
            ScriptMutability::Mutable,
        );

        Ok(())
    }

    /// 删除节点
    ///
    /// 根据 UUID 删除指定的节点。
    ///
    /// # 参数
    ///
    /// * `uuid` - 要删除的节点 UUID
    ///
    /// # 返回值
    ///
    /// * `Ok(())` - 操作成功
    /// * `Err(anyhow::Error)` - 数据库操作失败
    pub fn delete_node(&mut self, uuid: &str) -> Result<()> {
        let params = Self::make_params(serde_json::json!({ "uuid": uuid }));

        self.db.run_script(
            r#"
            ?[uuid, path, title, content, node_type, hash, created_at, updated_at] := *nodes{uuid, path, title, content, node_type, hash, created_at, updated_at}, uuid != $uuid
            :replace nodes {uuid => path, title, content, node_type, hash, created_at, updated_at}
            "#,
            params,
            ScriptMutability::Mutable,
        ).map_err(|e| anyhow::anyhow!("{}", e.to_string()))?;

        Ok(())
    }

    /// 删除与节点相关的所有边
    ///
    /// 删除所有源节点或目标节点为指定 UUID 的边。
    ///
    /// # 参数
    ///
    /// * `uuid` - 节点 UUID
    ///
    /// # 返回值
    ///
    /// * `Ok(())` - 操作成功
    /// * `Err(anyhow::Error)` - 数据库操作失败
    pub fn delete_edges_by_node(&mut self, uuid: &str) -> Result<()> {
        let params = Self::make_params(serde_json::json!({ "uuid": uuid }));

        self.db.run_script(
            r#"
            ?[src_uuid, dst_uuid, relation, weight, source] := *edges{src_uuid, dst_uuid, relation, weight, source}, 
                src_uuid != $uuid, dst_uuid != $uuid
            :replace edges {src_uuid, dst_uuid => relation, weight, source}
            "#,
            params,
            ScriptMutability::Mutable,
        ).map_err(|e| anyhow::anyhow!("{}", e.to_string()))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::TempDir;

    fn setup_test_db() -> (Database, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let db = Database::new(db_path).unwrap();
        (db, temp_dir)
    }

    #[test]
    fn test_database_creation() {
        let (db, _temp_dir) = setup_test_db();
        let nodes = db.get_all_nodes().unwrap();
        assert_eq!(nodes.len(), 0);
    }

    #[test]
    fn test_upsert_node() {
        let (mut db, _temp_dir) = setup_test_db();

        let node = Node {
            uuid: "test-uuid-1".to_string(),
            path: "test.md".to_string(),
            title: "Test Node".to_string(),
            content: "Test content".to_string(),
            node_type: "note".to_string(),
            hash: "test-hash".to_string(),
            created_at: 1234567890,
            updated_at: 1234567890,
        };

        db.upsert_node(&node).unwrap();

        let nodes = db.get_all_nodes().unwrap();
        assert_eq!(nodes.len(), 1);
        assert_eq!(nodes[0].uuid, "test-uuid-1");
        assert_eq!(nodes[0].title, "Test Node");
    }

    #[test]
    fn test_upsert_node_update() {
        let (mut db, _temp_dir) = setup_test_db();

        let node1 = Node {
            uuid: "test-uuid-1".to_string(),
            path: "test.md".to_string(),
            title: "Test Node".to_string(),
            content: "Test content".to_string(),
            node_type: "note".to_string(),
            hash: "test-hash".to_string(),
            created_at: 1234567890,
            updated_at: 1234567890,
        };

        db.upsert_node(&node1).unwrap();

        // Update the same node
        let node2 = Node {
            uuid: "test-uuid-1".to_string(),
            path: "test.md".to_string(),
            title: "Updated Node".to_string(),
            content: "Updated content".to_string(),
            node_type: "note".to_string(),
            hash: "new-hash".to_string(),
            created_at: 1234567890,
            updated_at: 1234567900,
        };

        db.upsert_node(&node2).unwrap();

        let nodes = db.get_all_nodes().unwrap();
        assert_eq!(nodes.len(), 1);
        assert_eq!(nodes[0].title, "Updated Node");
        assert_eq!(nodes[0].hash, "new-hash");
    }

    #[test]
    fn test_upsert_edge() {
        let (mut db, _temp_dir) = setup_test_db();

        let edge = Edge {
            src_uuid: "uuid-1".to_string(),
            dst_uuid: "uuid-2".to_string(),
            relation: "link".to_string(),
            weight: 1.0,
            source: "wikilink".to_string(),
        };

        db.upsert_edge(&edge).unwrap();

        let edges = db.get_all_edges().unwrap();
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0].src_uuid, "uuid-1");
        assert_eq!(edges[0].dst_uuid, "uuid-2");
    }

    #[test]
    fn test_get_graph_data() {
        let (mut db, _temp_dir) = setup_test_db();

        let node1 = Node {
            uuid: "uuid-1".to_string(),
            path: "note1.md".to_string(),
            title: "Note 1".to_string(),
            content: "Content 1".to_string(),
            node_type: "note".to_string(),
            hash: "hash1".to_string(),
            created_at: 1234567890,
            updated_at: 1234567890,
        };

        let node2 = Node {
            uuid: "uuid-2".to_string(),
            path: "note2.md".to_string(),
            title: "Note 2".to_string(),
            content: "Content 2".to_string(),
            node_type: "note".to_string(),
            hash: "hash2".to_string(),
            created_at: 1234567890,
            updated_at: 1234567890,
        };

        db.upsert_node(&node1).unwrap();
        db.upsert_node(&node2).unwrap();

        let edge = Edge {
            src_uuid: "uuid-1".to_string(),
            dst_uuid: "uuid-2".to_string(),
            relation: "link".to_string(),
            weight: 1.0,
            source: "wikilink".to_string(),
        };

        db.upsert_edge(&edge).unwrap();

        let graph_data = db.get_graph_data().unwrap();
        assert_eq!(graph_data.nodes.len(), 2);
        assert_eq!(graph_data.edges.len(), 1);
    }

    #[test]
    fn test_search_nodes() {
        let (mut db, _temp_dir) = setup_test_db();

        let node1 = Node {
            uuid: "uuid-1".to_string(),
            path: "rust.md".to_string(),
            title: "Rust Programming".to_string(),
            content: "Learn Rust language".to_string(),
            node_type: "note".to_string(),
            hash: "hash1".to_string(),
            created_at: 1234567890,
            updated_at: 1234567890,
        };

        let node2 = Node {
            uuid: "uuid-2".to_string(),
            path: "python.md".to_string(),
            title: "Python Programming".to_string(),
            content: "Learn Python language".to_string(),
            node_type: "note".to_string(),
            hash: "hash2".to_string(),
            created_at: 1234567890,
            updated_at: 1234567890,
        };

        db.upsert_node(&node1).unwrap();
        db.upsert_node(&node2).unwrap();

        let results = db.search_nodes("Rust").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Rust Programming");

        let results = db.search_nodes("Programming").unwrap();
        assert_eq!(results.len(), 2);

        let results = db.search_nodes("JavaScript").unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_clear_all() {
        let (mut db, _temp_dir) = setup_test_db();

        let node = Node {
            uuid: "uuid-1".to_string(),
            path: "test.md".to_string(),
            title: "Test".to_string(),
            content: "Content".to_string(),
            node_type: "note".to_string(),
            hash: "hash1".to_string(),
            created_at: 1234567890,
            updated_at: 1234567890,
        };

        db.upsert_node(&node).unwrap();

        let edge = Edge {
            src_uuid: "uuid-1".to_string(),
            dst_uuid: "uuid-2".to_string(),
            relation: "link".to_string(),
            weight: 1.0,
            source: "wikilink".to_string(),
        };

        db.upsert_edge(&edge).unwrap();

        db.clear_all().unwrap();

        let nodes = db.get_all_nodes().unwrap();
        let edges = db.get_all_edges().unwrap();
        assert_eq!(nodes.len(), 0);
        assert_eq!(edges.len(), 0);
    }
}
