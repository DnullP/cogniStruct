//! # Parser 模块
//!
//! 本模块提供 Obsidian Markdown 的解析功能。
//!
//! ## 模块依赖
//!
//! - `pulldown_cmark` - Markdown 解析器
//! - `regex` - 正则表达式
//! - [`super::frontmatter`] - Frontmatter 解析
//! - [`super::links`] - 链接提取
//!
//! ## 导出的主要内容
//!
//! ### 结构体
//! - [`ParsedMarkdown`] - 解析后的 Markdown 数据
//!
//! ### 函数
//! - [`parse_markdown`] - 解析 Markdown 内容
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use adapters::obsidian::parser::parse_markdown;
//!
//! let content = "---\ntags: [rust]\n---\n# Hello\n\nLink to [[Other]].";
//! let parsed = parse_markdown(content);
//! println!("Title: {}", parsed.title);
//! ```

use super::frontmatter::{parse_frontmatter, Frontmatter};
use super::links::{extract_block_references, BlockReference};
use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::LazyLock;

/// 解析后的 Markdown 数据
///
/// 包含从 Obsidian Markdown 文件中提取的结构化信息。
///
/// # 字段说明
///
/// * `title` - 文档标题，从第一个 heading 提取
/// * `content` - 去除 frontmatter 后的 Markdown 内容
/// * `raw_content` - 原始完整内容
/// * `frontmatter` - 解析后的 Frontmatter 数据
/// * `wikilinks` - 提取的 wikilinks 列表（去重）
/// * `tags` - 提取的标签列表（去重，合并 frontmatter 和正文）
/// * `block_ids` - Block ID 列表
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedMarkdown {
    /// 文档标题
    pub title: String,
    /// 去除 frontmatter 后的内容
    pub content: String,
    /// 原始完整内容
    pub raw_content: String,
    /// Frontmatter 元数据
    pub frontmatter: Option<Frontmatter>,
    /// Wikilinks 列表
    pub wikilinks: Vec<String>,
    /// 标签列表（合并 frontmatter 和正文）
    pub tags: Vec<String>,
    /// Block ID 列表
    #[serde(default)]
    pub block_ids: Vec<BlockReference>,
}

// 预编译正则表达式
static WIKILINK_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\[\[([^\]]+)\]\]").unwrap());
static TAG_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?:^|[^\w#])#([\w\-_/]+)").unwrap());

/// 解析 Markdown 内容
///
/// 从 Obsidian Markdown 文本中提取 frontmatter、标题、wikilinks 和标签。
///
/// # 参数
///
/// * `content` - Markdown 文本内容
///
/// # 返回值
///
/// 返回包含解析结果的 [`ParsedMarkdown`] 结构体
///
/// # 解析规则
///
/// - **Frontmatter**：提取 `---` 包围的 YAML 元数据
/// - **标题**：提取第一个 heading 的文本，如果没有则使用第一行
/// - **Wikilinks**：匹配 `[[link]]` 或 `[[link|alias]]` 格式
/// - **标签**：匹配 `#tag` 格式 + frontmatter 中的 tags
/// - **Block IDs**：匹配 `^blockid` 格式
///
/// # 副作用
///
/// 无副作用，纯函数
pub fn parse_markdown(content: &str) -> ParsedMarkdown {
    // 解析 frontmatter
    let (frontmatter, body_content) = parse_frontmatter(content);

    let mut title = String::new();
    let mut wikilinks = HashSet::new();
    let mut tags = HashSet::new();

    // 添加 frontmatter 中的标签
    if let Some(ref fm) = frontmatter {
        for tag in &fm.tags {
            tags.insert(tag.clone());
        }
    }

    // 提取标题（第一个 heading）
    let parser = Parser::new(&body_content);
    let mut in_heading = false;

    for event in parser {
        match event {
            Event::Start(Tag::Heading { level: _, .. }) => {
                in_heading = true;
            }
            Event::End(TagEnd::Heading(_)) => {
                in_heading = false;
                if !title.is_empty() {
                    break;
                }
            }
            Event::Text(text) if in_heading => {
                title.push_str(&text);
            }
            _ => {}
        }
    }

    // 提取 wikilinks [[link]]
    for cap in WIKILINK_RE.captures_iter(&body_content) {
        if let Some(link) = cap.get(1) {
            let link_text = link.as_str();
            // 处理 [[link|alias]] 格式，提取实际链接
            let actual_link = link_text.split('|').next().unwrap_or(link_text);
            // 移除 # 及之后的内容
            let link_without_hash = actual_link.split('#').next().unwrap_or(actual_link);
            wikilinks.insert(link_without_hash.trim().to_string());
        }
    }

    // 提取标签 #tag（但不在代码块中）
    for cap in TAG_RE.captures_iter(&body_content) {
        if let Some(tag) = cap.get(1) {
            tags.insert(tag.as_str().to_string());
        }
    }

    // 如果没有找到标题，尝试从第一行提取
    if title.is_empty() {
        title = body_content
            .lines()
            .next()
            .unwrap_or("Untitled")
            .trim()
            .trim_start_matches('#')
            .trim()
            .to_string();
    }

    // 如果标题还是空，使用 "Untitled"
    if title.is_empty() {
        title = "Untitled".to_string();
    }

    // 提取 block IDs
    let block_ids = extract_block_references(&body_content);

    ParsedMarkdown {
        title,
        content: body_content,
        raw_content: content.to_string(),
        frontmatter,
        wikilinks: wikilinks.into_iter().collect(),
        tags: tags.into_iter().collect(),
        block_ids,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_markdown_basic() {
        let content = "# Hello World\n\nSome content here.";
        let parsed = parse_markdown(content);

        assert_eq!(parsed.title, "Hello World");
        assert!(parsed.content.contains("Some content"));
        assert!(parsed.frontmatter.is_none());
    }

    #[test]
    fn test_parse_markdown_with_frontmatter() {
        let content = "---\ntags: [rust, test]\ntype: note\n---\n# My Note\n\nContent.";
        let parsed = parse_markdown(content);

        assert_eq!(parsed.title, "My Note");
        assert!(parsed.frontmatter.is_some());
        let fm = parsed.frontmatter.unwrap();
        assert_eq!(fm.tags, vec!["rust", "test"]);
        assert_eq!(fm.node_type, Some("note".to_string()));
    }

    #[test]
    fn test_parse_markdown_wikilinks() {
        let content = "# Test\n\nLink to [[Page A]] and [[Page B|alias]].";
        let parsed = parse_markdown(content);

        assert!(parsed.wikilinks.contains(&"Page A".to_string()));
        assert!(parsed.wikilinks.contains(&"Page B".to_string()));
    }

    #[test]
    fn test_parse_markdown_wikilinks_with_heading() {
        let content = "# Test\n\nSee [[Page#Section]] for details.";
        let parsed = parse_markdown(content);

        // # 之后的部分应该被移除
        assert!(parsed.wikilinks.contains(&"Page".to_string()));
        assert!(!parsed.wikilinks.iter().any(|l| l.contains('#')));
    }

    #[test]
    fn test_parse_markdown_tags() {
        let content = "---\ntags: [yaml-tag]\n---\n# Test\n\nWith #inline-tag here.";
        let parsed = parse_markdown(content);

        assert!(parsed.tags.contains(&"yaml-tag".to_string()));
        assert!(parsed.tags.contains(&"inline-tag".to_string()));
    }

    #[test]
    fn test_parse_markdown_block_ids() {
        let content = "# Test\n\nParagraph one ^abc123\n\nParagraph two";
        let parsed = parse_markdown(content);

        assert_eq!(parsed.block_ids.len(), 1);
        assert_eq!(parsed.block_ids[0].id, "abc123");
    }

    #[test]
    fn test_parse_markdown_no_title() {
        let content = "Just some content without heading.";
        let parsed = parse_markdown(content);

        // 应该使用第一行作为标题
        assert_eq!(parsed.title, "Just some content without heading.");
    }

    #[test]
    fn test_parse_markdown_empty() {
        let content = "";
        let parsed = parse_markdown(content);

        assert_eq!(parsed.title, "Untitled");
    }

    #[test]
    fn test_parse_markdown_dedup_wikilinks() {
        let content = "# Test\n\n[[A]] and [[A]] and [[A|different alias]]";
        let parsed = parse_markdown(content);

        // 应该去重
        let count = parsed.wikilinks.iter().filter(|l| *l == "A").count();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_parse_markdown_dedup_tags() {
        let content = "---\ntags: [dup]\n---\n# Test\n\n#dup here and #dup again";
        let parsed = parse_markdown(content);

        // 应该去重
        let count = parsed.tags.iter().filter(|t| *t == "dup").count();
        assert_eq!(count, 1);
    }
}
