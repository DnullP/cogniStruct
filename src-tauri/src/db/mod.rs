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
