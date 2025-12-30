//! # Links 模块
//!
//! 本模块提供 Obsidian 链接语法的解析功能。
//!
//! ## 模块依赖
//!
//! - `regex` - 正则表达式匹配
//! - [`crate::adapters::ExtractedLink`] - 链接数据结构
//! - [`crate::adapters::LinkKind`] - 链接类型
//!
//! ## 导出的主要内容
//!
//! ### 结构体
//! - [`BlockReference`] - 块引用标记
//!
//! ### 函数
//! - [`extract_wikilinks`] - 提取 wikilink
//! - [`extract_embeds`] - 提取嵌入
//! - [`extract_external_links`] - 提取外部链接
//! - [`extract_block_references`] - 提取块 ID
//!
//! ## Obsidian 链接语法
//!
//! | 语法 | 类型 | 示例 |
//! |------|------|------|
//! | `[[link]]` | WikiLink | `[[My Note]]` |
//! | `[[link\|alias]]` | WikiLink + Alias | `[[My Note\|显示文本]]` |
//! | `[[note#heading]]` | 标题链接 | `[[Note#Section]]` |
//! | `[[note#^blockid]]` | 块引用 | `[[Note#^abc123]]` |
//! | `![[embed]]` | 嵌入 | `![[image.png]]` |
//! | `[text](url)` | 外部链接 | `[Google](https://...)` |
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use adapters::obsidian::links::extract_wikilinks;
//!
//! let content = "Link to [[Page A]] and [[Page B|display]].";
//! let links = extract_wikilinks(content);
//! assert_eq!(links.len(), 2);
//! ```

use crate::adapters::{ExtractedLink, LinkKind};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;

/// 块引用标记
///
/// 表示 Markdown 中的块级引用标记（`^blockid`）。
/// 用于实现细粒度的段落/观点关联。
///
/// # 字段说明
///
/// * `id` - Block ID 标识符（不含 `^` 前缀）
/// * `line_number` - 所在行号（1-based）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockReference {
    /// Block ID 标识符
    pub id: String,
    /// 所在行号（1-based）
    pub line_number: usize,
}

impl BlockReference {
    /// 创建新的块引用
    ///
    /// # 参数
    ///
    /// * `id` - Block ID 标识符
    /// * `line_number` - 行号
    pub fn new(id: impl Into<String>, line_number: usize) -> Self {
        BlockReference {
            id: id.into(),
            line_number,
        }
    }
}

// 预编译正则表达式
static WIKILINK_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\[\[([^\]]+)\]\]").unwrap());
static EMBED_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"!\[\[([^\]]+)\]\]").unwrap());
static EXTERNAL_LINK_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[([^\]]*)\]\((https?://[^\)]+)\)").unwrap());
static BLOCK_ID_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\^([\w\-_]+)").unwrap());
static BLOCK_REF_LINK_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[\[([^#\]]+)#\^([\w\-_]+)(?:\|[^\]]+)?\]\]").unwrap());

/// 提取 Wikilinks
///
/// 从 Markdown 内容中提取所有 `[[link]]` 格式的链接。
///
/// # 参数
///
/// * `content` - Markdown 文本内容
///
/// # 返回值
///
/// 提取的链接列表
///
/// # 支持的格式
///
/// - `[[link]]` - 简单链接
/// - `[[link|alias]]` - 带显示文本的链接
/// - `[[note#heading]]` - 标题链接
/// - `[[note#^blockid]]` - 块引用链接
///
/// # 注意
///
/// - 嵌入链接 `![[...]]` 不会被提取，使用 `extract_embeds`
/// - 返回的 target 不含 `#` 后的部分
pub fn extract_wikilinks(content: &str) -> Vec<ExtractedLink> {
    let mut links = Vec::new();

    for (line_num, line) in content.lines().enumerate() {
        // 跳过嵌入链接（以 ! 开头）
        let line_without_embeds = EMBED_RE.replace_all(line, "");

        for cap in WIKILINK_RE.captures_iter(&line_without_embeds) {
            if let Some(link_match) = cap.get(1) {
                let link_text = link_match.as_str();

                // 检查是否是块引用链接
                if let Some(block_cap) = BLOCK_REF_LINK_RE.captures(line) {
                    let note = block_cap.get(1).map(|m| m.as_str()).unwrap_or("");
                    let block_id = block_cap.get(2).map(|m| m.as_str()).unwrap_or("");

                    links.push(
                        ExtractedLink::new(note, LinkKind::BlockReference)
                            .with_display_text(format!("{}#^{}", note, block_id))
                            .with_line_number(line_num + 1),
                    );
                    continue;
                }

                // 解析链接和显示文本
                let (target, display) = parse_link_text(link_text);

                let mut link =
                    ExtractedLink::new(target, LinkKind::WikiLink).with_line_number(line_num + 1);

                if let Some(d) = display {
                    link = link.with_display_text(d);
                }

                links.push(link);
            }
        }
    }

    links
}

/// 提取嵌入链接
///
/// 从 Markdown 内容中提取所有 `![[embed]]` 格式的嵌入。
///
/// # 参数
///
/// * `content` - Markdown 文本内容
///
/// # 返回值
///
/// 提取的嵌入链接列表
pub fn extract_embeds(content: &str) -> Vec<ExtractedLink> {
    let mut links = Vec::new();

    for (line_num, line) in content.lines().enumerate() {
        for cap in EMBED_RE.captures_iter(line) {
            if let Some(link_match) = cap.get(1) {
                let link_text = link_match.as_str();
                let (target, _) = parse_link_text(link_text);

                links.push(
                    ExtractedLink::new(target, LinkKind::Embed).with_line_number(line_num + 1),
                );
            }
        }
    }

    links
}

/// 提取外部链接
///
/// 从 Markdown 内容中提取所有 `[text](url)` 格式的外部链接。
///
/// # 参数
///
/// * `content` - Markdown 文本内容
///
/// # 返回值
///
/// 提取的外部链接列表
pub fn extract_external_links(content: &str) -> Vec<ExtractedLink> {
    let mut links = Vec::new();

    for (line_num, line) in content.lines().enumerate() {
        for cap in EXTERNAL_LINK_RE.captures_iter(line) {
            let display = cap.get(1).map(|m| m.as_str().to_string());
            let url = cap.get(2).map(|m| m.as_str()).unwrap_or("");

            let mut link =
                ExtractedLink::new(url, LinkKind::External).with_line_number(line_num + 1);

            if let Some(d) = display {
                if !d.is_empty() {
                    link = link.with_display_text(d);
                }
            }

            links.push(link);
        }
    }

    links
}

/// 提取块 ID
///
/// 从 Markdown 内容中提取所有 `^blockid` 格式的块标识符。
///
/// # 参数
///
/// * `content` - Markdown 文本内容
///
/// # 返回值
///
/// 块引用列表
pub fn extract_block_references(content: &str) -> Vec<BlockReference> {
    let mut refs = Vec::new();

    for (line_num, line) in content.lines().enumerate() {
        for cap in BLOCK_ID_RE.captures_iter(line) {
            if let Some(id_match) = cap.get(1) {
                refs.push(BlockReference::new(id_match.as_str(), line_num + 1));
            }
        }
    }

    refs
}

/// 解析链接文本
///
/// 解析 `link` 或 `link|display` 格式。
///
/// # 参数
///
/// * `link_text` - 链接文本（`[[` 和 `]]` 之间的内容）
///
/// # 返回值
///
/// `(target, Option<display_text>)` 元组
fn parse_link_text(link_text: &str) -> (String, Option<String>) {
    // 移除 # 及之后的部分（标题/块引用）
    let link_without_hash = link_text.split('#').next().unwrap_or(link_text);

    // 分离 target 和 display text
    if let Some(pipe_pos) = link_without_hash.find('|') {
        let target = link_without_hash[..pipe_pos].trim().to_string();
        let display = link_without_hash[pipe_pos + 1..].trim().to_string();
        (target, Some(display))
    } else {
        (link_without_hash.trim().to_string(), None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_wikilinks_basic() {
        let content = "Link to [[Page A]] and then [[Page B]].";
        let links = extract_wikilinks(content);

        assert_eq!(links.len(), 2);
        assert!(links.iter().any(|l| l.target == "Page A"));
        assert!(links.iter().any(|l| l.target == "Page B"));
    }

    #[test]
    fn test_extract_wikilinks_with_alias() {
        let content = "See [[Real Page|Display Text]] for more.";
        let links = extract_wikilinks(content);

        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target, "Real Page");
        assert_eq!(links[0].display_text, Some("Display Text".to_string()));
    }

    #[test]
    fn test_extract_wikilinks_with_heading() {
        let content = "Jump to [[Page#Section]] directly.";
        let links = extract_wikilinks(content);

        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target, "Page"); // # 之后被移除
    }

    #[test]
    fn test_extract_wikilinks_excludes_embeds() {
        let content = "Link [[A]] and embed ![[B]].";
        let links = extract_wikilinks(content);

        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target, "A");
    }

    #[test]
    fn test_extract_embeds() {
        let content = "Image: ![[photo.png]]\nAnother: ![[doc.pdf]]";
        let embeds = extract_embeds(content);

        assert_eq!(embeds.len(), 2);
        assert!(embeds.iter().all(|l| l.kind == LinkKind::Embed));
        assert!(embeds.iter().any(|l| l.target == "photo.png"));
    }

    #[test]
    fn test_extract_external_links() {
        let content = "Visit [Google](https://google.com) and [GitHub](https://github.com).";
        let links = extract_external_links(content);

        assert_eq!(links.len(), 2);
        assert!(links.iter().all(|l| l.kind == LinkKind::External));
        assert!(links.iter().any(|l| l.target.contains("google.com")));
    }

    #[test]
    fn test_extract_block_references() {
        let content = "Paragraph one ^abc123\n\nParagraph two ^def456";
        let refs = extract_block_references(content);

        assert_eq!(refs.len(), 2);
        assert_eq!(refs[0].id, "abc123");
        assert_eq!(refs[0].line_number, 1);
        assert_eq!(refs[1].id, "def456");
        assert_eq!(refs[1].line_number, 3);
    }

    #[test]
    fn test_block_reference_new() {
        let br = BlockReference::new("test-id", 5);
        assert_eq!(br.id, "test-id");
        assert_eq!(br.line_number, 5);
    }

    #[test]
    fn test_parse_link_text() {
        let (target, display) = parse_link_text("Simple Link");
        assert_eq!(target, "Simple Link");
        assert!(display.is_none());

        let (target, display) = parse_link_text("Real|Alias");
        assert_eq!(target, "Real");
        assert_eq!(display, Some("Alias".to_string()));

        let (target, display) = parse_link_text("Note#Section");
        assert_eq!(target, "Note");
        assert!(display.is_none());
    }

    #[test]
    fn test_line_numbers() {
        let content = "Line 1 [[A]]\nLine 2\nLine 3 [[B]]";
        let links = extract_wikilinks(content);

        assert_eq!(links.len(), 2);
        assert_eq!(links[0].line_number, Some(1));
        assert_eq!(links[1].line_number, Some(3));
    }
}
