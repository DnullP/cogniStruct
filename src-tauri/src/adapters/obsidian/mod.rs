//! # Obsidian 适配器模块
//!
//! 本模块提供 Obsidian 风格 Markdown 笔记的适配器实现。
//!
//! ## 功能说明
//!
//! Obsidian 适配器负责：
//! - 解析 Obsidian 格式的 Markdown 文件
//! - 提取 YAML frontmatter 元数据
//! - 识别 wikilink、标签、块引用等 Obsidian 特有语法
//! - 将解析结果映射到 DCOM 认知对象
//! - 将 DCOM 对象序列化回 Markdown
//!
//! ## 模块依赖
//!
//! - `pulldown_cmark` - Markdown 解析器
//! - `regex` - 正则表达式匹配
//! - `serde_yaml` - YAML Frontmatter 解析
//! - [`crate::dcom`] - DCOM 核心数据结构
//! - [`super`] - 适配器接口定义
//!
//! ## 导出的主要内容
//!
//! ### 结构体
//! - [`ObsidianAdapter`] - Obsidian 适配器
//! - [`ParsedMarkdown`] - 解析后的 Markdown 数据
//! - [`Frontmatter`] - YAML 元数据
//! - [`BlockReference`] - 块引用
//!
//! ## Obsidian 特有语法
//!
//! | 语法 | 说明 |
//! |------|------|
//! | `[[link]]` | Wiki 链接 |
//! | `[[link\|alias]]` | 带别名的链接 |
//! | `![[embed]]` | 嵌入引用 |
//! | `#tag` | 标签 |
//! | `^blockid` | 块 ID |
//! | `[[note#^blockid]]` | 块引用链接 |
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use adapters::obsidian::ObsidianAdapter;
//! use adapters::ObjectAdapter;
//! use std::path::Path;
//!
//! let adapter = ObsidianAdapter::new();
//! let content = b"# Hello\n\nLink to [[Other Note]].";
//! let obj = adapter.load(Path::new("hello.md"), content)?;
//! ```

mod frontmatter;
mod links;
mod parser;

use crate::adapters::{ExtractedLink, ObjectAdapter};
use crate::dcom::{
    serialization::{MarkdownSource, SerializationSource},
    CognitiveObject, PropertyValue,
};
use anyhow::{Context, Result};
use std::path::Path;

pub use frontmatter::Frontmatter;
pub use links::BlockReference;
pub use parser::{parse_markdown, ParsedMarkdown};

/// Obsidian Markdown 适配器
///
/// 实现 `ObjectAdapter` trait，提供 Obsidian 风格 Markdown 的完整支持。
///
/// # 特性
///
/// - 无状态设计，可安全并发使用
/// - 支持完整的 Obsidian Markdown 语法
/// - 提供双向转换（Markdown ↔ CognitiveObject）
///
/// # 支持的扩展名
///
/// - `.md`
/// - `.markdown`
#[derive(Debug, Clone, Default)]
pub struct ObsidianAdapter;

impl ObsidianAdapter {
    /// 创建新的 Obsidian 适配器
    pub fn new() -> Self {
        ObsidianAdapter
    }

    /// 计算内容哈希
    ///
    /// 使用简单的哈希算法生成内容指纹。
    fn compute_hash(content: &[u8]) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }
}

impl ObjectAdapter for ObsidianAdapter {
    fn supported_extensions(&self) -> &[&str] {
        &["md", "markdown"]
    }

    fn load(&self, path: &Path, content: &[u8]) -> Result<CognitiveObject> {
        // 将字节转换为 UTF-8 字符串
        let text = std::str::from_utf8(content).context("Markdown 文件必须是 UTF-8 编码")?;

        // 解析 Markdown
        let parsed = parse_markdown(text);

        // 构建 CognitiveObject
        let mut obj = CognitiveObject::new();

        // 设置基本属性
        obj.set_title(&parsed.title);
        obj.set_content(&parsed.content);

        // 从 frontmatter 获取类型和其他属性
        if let Some(ref fm) = parsed.frontmatter {
            if let Some(ref node_type) = fm.node_type {
                obj.set_type(node_type);
            }

            // 设置别名
            for alias in &fm.aliases {
                obj.add_alias(alias);
            }

            // 提取额外属性
            for (key, value) in &fm.properties {
                // 跳过已处理的特殊字段
                if key == "tags" || key == "aliases" || key == "type" || key == "created" {
                    continue;
                }
                let prop_value = frontmatter::yaml_to_property_value(value);
                obj.set_property(key, prop_value);
            }

            // 设置创建日期
            if let Some(ref created) = fm.created {
                obj.set_property("created", PropertyValue::string(created));
            }
        }

        // 设置标签
        for tag in &parsed.tags {
            obj.add_tag(tag);
        }

        // 添加 Markdown 序列化源
        let content_hash = Self::compute_hash(content);
        let now = chrono::Utc::now().timestamp();
        let path_str = path.to_string_lossy().to_string();
        let source =
            SerializationSource::Markdown(MarkdownSource::new(path_str, content_hash, now));
        obj.add_source(source);

        Ok(obj)
    }

    fn save(&self, object: &CognitiveObject) -> Result<Vec<u8>> {
        let mut output = String::new();

        // 生成 frontmatter
        let fm = self.build_frontmatter(object);
        if !fm.is_empty() {
            output.push_str("---\n");
            output.push_str(&fm);
            output.push_str("---\n\n");
        }

        // 添加标题
        if let Some(title) = object.title() {
            output.push_str("# ");
            output.push_str(title);
            output.push_str("\n\n");
        }

        // 添加内容
        if let Some(content) = object.content() {
            // 移除标题行（如果存在）
            let content_without_title = self.remove_title_line(content);
            output.push_str(&content_without_title);
        }

        Ok(output.into_bytes())
    }

    fn extract_links(&self, object: &CognitiveObject) -> Vec<ExtractedLink> {
        let mut links_result = Vec::new();

        // 从内容中提取链接
        if let Some(content) = object.content() {
            links_result.extend(links::extract_wikilinks(content));
            links_result.extend(links::extract_embeds(content));
            links_result.extend(links::extract_external_links(content));
        }

        links_result
    }
}

impl ObsidianAdapter {
    /// 构建 frontmatter YAML
    fn build_frontmatter(&self, object: &CognitiveObject) -> String {
        let mut lines = Vec::new();

        // 类型
        if let Some(t) = object.get_type() {
            lines.push(format!("type: {}", t));
        }

        // 标签
        let tags = object.tags();
        if !tags.is_empty() {
            let tags_str: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();
            lines.push(format!("tags: [{}]", tags_str.join(", ")));
        }

        // 别名
        let aliases = object.aliases();
        if !aliases.is_empty() {
            let aliases_str: Vec<&str> = aliases.iter().map(|s| s.as_str()).collect();
            lines.push(format!("aliases: [{}]", aliases_str.join(", ")));
        }

        // 其他属性
        for (key, value) in object.properties() {
            // 跳过内部属性
            if key == "title" || key == "content" || key == "type" {
                continue;
            }
            if let Some(yaml) = self.property_to_yaml_line(key, value) {
                lines.push(yaml);
            }
        }

        lines.join("\n")
    }

    /// 将属性转换为 YAML 行
    fn property_to_yaml_line(&self, key: &str, value: &PropertyValue) -> Option<String> {
        match value {
            PropertyValue::Null => None,
            PropertyValue::String(s) => Some(format!("{}: \"{}\"", key, s)),
            PropertyValue::Integer(i) => Some(format!("{}: {}", key, i)),
            PropertyValue::Float(f) => Some(format!("{}: {}", key, f)),
            PropertyValue::Boolean(b) => Some(format!("{}: {}", key, b)),
            PropertyValue::DateTime(dt) => Some(format!("{}: \"{}\"", key, dt)),
            PropertyValue::Reference(r) => Some(format!("{}: \"[[{}]]\"", key, r)),
            PropertyValue::List(items) => {
                let items_str: Vec<String> = items
                    .iter()
                    .filter_map(|v| self.property_to_yaml_value(v))
                    .collect();
                Some(format!("{}: [{}]", key, items_str.join(", ")))
            }
            PropertyValue::Json(j) => Some(format!("{}: {}", key, j)),
        }
    }

    /// 将属性值转换为 YAML 值字符串
    fn property_to_yaml_value(&self, value: &PropertyValue) -> Option<String> {
        match value {
            PropertyValue::Null => None,
            PropertyValue::String(s) => Some(format!("\"{}\"", s)),
            PropertyValue::Integer(i) => Some(i.to_string()),
            PropertyValue::Float(f) => Some(f.to_string()),
            PropertyValue::Boolean(b) => Some(b.to_string()),
            PropertyValue::DateTime(dt) => Some(format!("\"{}\"", dt)),
            PropertyValue::Reference(r) => Some(format!("\"[[{}]]\"", r)),
            _ => None,
        }
    }

    /// 移除内容中的标题行
    fn remove_title_line(&self, content: &str) -> String {
        let mut lines = content.lines();
        if let Some(first_line) = lines.next() {
            if first_line.trim().starts_with("# ") {
                // 跳过标题行和可能的空行
                let rest: Vec<&str> = lines.collect();
                return rest.join("\n").trim_start().to_string();
            }
        }
        content.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_obsidian_adapter_supported_extensions() {
        let adapter = ObsidianAdapter::new();
        assert!(adapter.supports("md"));
        assert!(adapter.supports("markdown"));
        assert!(adapter.supports("MD"));
        assert!(!adapter.supports("txt"));
    }

    #[test]
    fn test_obsidian_adapter_load_basic() {
        let adapter = ObsidianAdapter::new();
        let content = b"# Hello World\n\nThis is content.";
        let path = Path::new("test.md");

        let obj = adapter.load(path, content).unwrap();

        assert_eq!(obj.title(), Some("Hello World"));
        assert!(obj.content().unwrap().contains("This is content"));
    }

    #[test]
    fn test_obsidian_adapter_load_with_frontmatter() {
        let adapter = ObsidianAdapter::new();
        let content = b"---\ntags: [rust, test]\ntype: note\n---\n# My Note\n\nContent here.";
        let path = Path::new("test.md");

        let obj = adapter.load(path, content).unwrap();

        assert_eq!(obj.title(), Some("My Note"));
        assert_eq!(obj.get_type(), Some("note"));
        assert!(obj.tags().contains(&"rust".to_string()));
        assert!(obj.tags().contains(&"test".to_string()));
    }

    #[test]
    fn test_obsidian_adapter_save() {
        let adapter = ObsidianAdapter::new();

        let mut obj = CognitiveObject::new();
        obj.set_title("Test Note");
        obj.set_content("Hello world");
        obj.set_type("note");
        obj.add_tag("rust");

        let saved = adapter.save(&obj).unwrap();
        let saved_str = String::from_utf8(saved).unwrap();

        assert!(saved_str.contains("---"));
        assert!(saved_str.contains("type: note"));
        assert!(saved_str.contains("tags: [rust]"));
        assert!(saved_str.contains("# Test Note"));
    }

    #[test]
    fn test_obsidian_adapter_extract_links() {
        let adapter = ObsidianAdapter::new();

        let mut obj = CognitiveObject::new();
        obj.set_content("Link to [[Page A]] and [[Page B|display]].");

        let links = adapter.extract_links(&obj);

        assert_eq!(links.len(), 2);
        assert!(links.iter().any(|l| l.target == "Page A"));
        assert!(links.iter().any(|l| l.target == "Page B"));
    }

    #[test]
    fn test_compute_hash() {
        let hash1 = ObsidianAdapter::compute_hash(b"hello");
        let hash2 = ObsidianAdapter::compute_hash(b"hello");
        let hash3 = ObsidianAdapter::compute_hash(b"world");

        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
    }
}
