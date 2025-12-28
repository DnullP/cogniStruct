use anyhow::Result;
use cozo::{DataValue, DbInstance, ScriptMutability};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;

pub struct Database {
    db: DbInstance,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub uuid: String,
    pub path: String,
    pub title: String,
    pub content: String,
    pub node_type: String,
    pub hash: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub src_uuid: String,
    pub dst_uuid: String,
    pub relation: String,
    pub weight: f64,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let db = DbInstance::new("sqlite", db_path.to_str().unwrap(), "")
            .map_err(|e| anyhow::anyhow!("{}", e.to_string()))?;

        let mut database = Database { db };
        database.init_schema()?;

        Ok(database)
    }

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

    pub fn get_graph_data(&self) -> Result<GraphData> {
        let nodes = self.get_all_nodes()?;
        let edges = self.get_all_edges()?;

        Ok(GraphData { nodes, edges })
    }

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
