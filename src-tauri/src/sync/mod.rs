pub mod parser;
pub mod watcher;

use crate::db::{Database, Edge, Node};
use anyhow::Result;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub use parser::parse_markdown;
pub use watcher::FileWatcher;

pub fn calculate_hash(content: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

pub fn sync_vault(vault_path: &Path, db: &mut Database) -> Result<()> {
    let mut path_to_uuid: HashMap<String, String> = HashMap::new();
    let mut title_to_uuid: HashMap<String, String> = HashMap::new();
    
    // First pass: Index all markdown files and create nodes
    for entry in WalkDir::new(vault_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            if let Ok(content) = fs::read_to_string(path) {
                let parsed = parse_markdown(&content);
                let uuid = uuid::Uuid::new_v4().to_string();
                let hash = calculate_hash(&content);
                let relative_path = path
                    .strip_prefix(vault_path)
                    .unwrap_or(path)
                    .to_string_lossy()
                    .to_string();
                
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64;
                
                let node = Node {
                    uuid: uuid.clone(),
                    path: relative_path.clone(),
                    title: parsed.title.clone(),
                    content: content.clone(),
                    node_type: "note".to_string(),
                    hash,
                    created_at: now,
                    updated_at: now,
                };
                
                db.upsert_node(&node)?;
                
                path_to_uuid.insert(relative_path, uuid.clone());
                title_to_uuid.insert(parsed.title.clone(), uuid.clone());
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
                
                if let Some(src_uuid) = path_to_uuid.get(&relative_path) {
                    // Create edges from wikilinks
                    for wikilink in &parsed.wikilinks {
                        // Try to find target by title
                        if let Some(dst_uuid) = title_to_uuid.get(wikilink) {
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
    }
    
    Ok(())
}

pub fn process_file_change(file_path: &Path, vault_path: &Path, db: &mut Database) -> Result<()> {
    if let Ok(content) = fs::read_to_string(file_path) {
        let parsed = parse_markdown(&content);
        let relative_path = file_path
            .strip_prefix(vault_path)
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string();
        
        // Check if node already exists
        let existing_nodes = db.get_all_nodes()?;
        let existing_node = existing_nodes.iter().find(|n| n.path == relative_path);
        
        let uuid = if let Some(node) = existing_node {
            // Update existing node
            node.uuid.clone()
        } else {
            // Create new node
            uuid::Uuid::new_v4().to_string()
        };
        
        let hash = calculate_hash(&content);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        
        let node = Node {
            uuid: uuid.clone(),
            path: relative_path,
            title: parsed.title,
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
