use cozo::DbInstance;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use anyhow::Result;

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
        let db = DbInstance::new("sqlite", db_path.to_str().unwrap(), "")?;
        
        let mut database = Database { db };
        database.init_schema()?;
        
        Ok(database)
    }

    fn init_schema(&mut self) -> Result<()> {
        // Create nodes table
        self.db.run_script(
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
        )?;

        // Create edges table
        self.db.run_script(
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
        )?;

        Ok(())
    }

    pub fn upsert_node(&mut self, node: &Node) -> Result<()> {
        let params = serde_json::json!({
            "uuid": node.uuid,
            "path": node.path,
            "title": node.title,
            "content": node.content,
            "node_type": node.node_type,
            "hash": node.hash,
            "created_at": node.created_at,
            "updated_at": node.updated_at,
        });

        self.db.run_script(
            r#"
            ?[uuid, path, title, content, node_type, hash, created_at, updated_at] <- [[$uuid, $path, $title, $content, $node_type, $hash, $created_at, $updated_at]]
            :put nodes {uuid => path, title, content, node_type, hash, created_at, updated_at}
            "#,
            params.into(),
        )?;

        Ok(())
    }

    pub fn upsert_edge(&mut self, edge: &Edge) -> Result<()> {
        let params = serde_json::json!({
            "src_uuid": edge.src_uuid,
            "dst_uuid": edge.dst_uuid,
            "relation": edge.relation,
            "weight": edge.weight,
            "source": edge.source,
        });

        self.db.run_script(
            r#"
            ?[src_uuid, dst_uuid, relation, weight, source] <- [[$src_uuid, $dst_uuid, $relation, $weight, $source]]
            :put edges {src_uuid, dst_uuid => relation, weight, source}
            "#,
            params.into(),
        )?;

        Ok(())
    }

    pub fn get_all_nodes(&self) -> Result<Vec<Node>> {
        let result = self.db.run_script(
            "?[uuid, path, title, content, node_type, hash, created_at, updated_at] := *nodes{uuid, path, title, content, node_type, hash, created_at, updated_at}",
            Default::default(),
        )?;

        let nodes: Vec<Node> = result.rows.iter().map(|row| {
            Node {
                uuid: row[0].get_str().unwrap_or("").to_string(),
                path: row[1].get_str().unwrap_or("").to_string(),
                title: row[2].get_str().unwrap_or("").to_string(),
                content: row[3].get_str().unwrap_or("").to_string(),
                node_type: row[4].get_str().unwrap_or("").to_string(),
                hash: row[5].get_str().unwrap_or("").to_string(),
                created_at: row[6].get_int().unwrap_or(0),
                updated_at: row[7].get_int().unwrap_or(0),
            }
        }).collect();

        Ok(nodes)
    }

    pub fn get_all_edges(&self) -> Result<Vec<Edge>> {
        let result = self.db.run_script(
            "?[src_uuid, dst_uuid, relation, weight, source] := *edges{src_uuid, dst_uuid, relation, weight, source}",
            Default::default(),
        )?;

        let edges: Vec<Edge> = result.rows.iter().map(|row| {
            Edge {
                src_uuid: row[0].get_str().unwrap_or("").to_string(),
                dst_uuid: row[1].get_str().unwrap_or("").to_string(),
                relation: row[2].get_str().unwrap_or("").to_string(),
                weight: row[3].get_float().unwrap_or(1.0),
                source: row[4].get_str().unwrap_or("").to_string(),
            }
        }).collect();

        Ok(edges)
    }

    pub fn search_nodes(&self, query: &str) -> Result<Vec<Node>> {
        let query_lower = query.to_lowercase();
        let all_nodes = self.get_all_nodes()?;
        
        let filtered_nodes: Vec<Node> = all_nodes.into_iter()
            .filter(|node| {
                node.title.to_lowercase().contains(&query_lower) ||
                node.content.to_lowercase().contains(&query_lower)
            })
            .collect();

        Ok(filtered_nodes)
    }

    pub fn get_graph_data(&self) -> Result<GraphData> {
        let nodes = self.get_all_nodes()?;
        let edges = self.get_all_edges()?;
        
        Ok(GraphData { nodes, edges })
    }

    pub fn delete_node(&mut self, uuid: &str) -> Result<()> {
        let params = serde_json::json!({ "uuid": uuid });
        
        self.db.run_script(
            r#"
            ?[uuid, path, title, content, node_type, hash, created_at, updated_at] := *nodes{uuid, path, title, content, node_type, hash, created_at, updated_at}, uuid != $uuid
            :replace nodes {uuid => path, title, content, node_type, hash, created_at, updated_at}
            "#,
            params.into(),
        )?;

        Ok(())
    }

    pub fn delete_edges_by_node(&mut self, uuid: &str) -> Result<()> {
        let params = serde_json::json!({ "uuid": uuid });
        
        self.db.run_script(
            r#"
            ?[src_uuid, dst_uuid, relation, weight, source] := *edges{src_uuid, dst_uuid, relation, weight, source}, 
                src_uuid != $uuid, dst_uuid != $uuid
            :replace edges {src_uuid, dst_uuid => relation, weight, source}
            "#,
            params.into(),
        )?;

        Ok(())
    }
}
