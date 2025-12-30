//! # Parser 模块
//!
//! 本模块提供 Markdown 文件的解析功能，提取结构化信息。
//!
//! ## 模块依赖
//!
//! - `pulldown_cmark` - Markdown 解析器
//! - `regex` - 正则表达式匹配
//!
//! ## 导出的主要内容
//!
//! ### 结构体
//! - [`ParsedMarkdown`] - 解析后的 Markdown 数据
//!
//! ### 函数
//! - [`parse_markdown`] - 解析 Markdown 内容
//!
//! ## 功能说明
//!
//! 本模块能够从 Markdown 内容中提取：
//! - 标题（第一个 heading）
//! - Wikilinks（`[[link]]` 格式）
//! - 标签（`#tag` 格式）
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use parser::parse_markdown;
//!
//! let content = "# Title\n\nLink to [[Page A]].\n\n#tag1 #tag2";
//! let parsed = parse_markdown(content);
//! assert_eq!(parsed.title, "Title");
//! assert!(parsed.wikilinks.contains(&"Page A".to_string()));
//! ```

use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use regex::Regex;
use std::collections::HashSet;

/// 解析后的 Markdown 数据
///
/// 包含从 Markdown 文件中提取的结构化信息。
///
/// # 字段说明
///
/// * `title` - 文档标题，从第一个 heading 提取
/// * `content` - 原始 Markdown 内容
/// * `wikilinks` - 提取的 wikilinks 列表（去重）
/// * `tags` - 提取的标签列表（去重）
#[derive(Debug, Clone)]
pub struct ParsedMarkdown {
    /// 文档标题
    pub title: String,
    /// 原始内容
    pub content: String,
    /// Wikilinks 列表
    pub wikilinks: Vec<String>,
    /// 标签列表
    pub tags: Vec<String>,
}

/// 解析 Markdown 内容
///
/// 从 Markdown 文本中提取标题、wikilinks 和标签。
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
/// - **标题**：提取第一个 heading 的文本，如果没有则使用第一行
/// - **Wikilinks**：匹配 `[[link]]` 或 `[[link|alias]]` 格式
/// - **标签**：匹配 `#tag` 格式（不包括代码块中的）
pub fn parse_markdown(content: &str) -> ParsedMarkdown {
    let mut title = String::new();
    let mut wikilinks = HashSet::new();
    let mut tags = HashSet::new();

    // Extract title (first heading)
    let parser = Parser::new(content);
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

    // Extract wikilinks [[link]]
    let wikilink_regex = Regex::new(r"\[\[([^\]]+)\]\]").unwrap();
    for cap in wikilink_regex.captures_iter(content) {
        if let Some(link) = cap.get(1) {
            let link_text = link.as_str();
            // Handle [[link|alias]] format
            let actual_link = link_text.split('|').next().unwrap_or(link_text);
            wikilinks.insert(actual_link.trim().to_string());
        }
    }

    // Extract tags #tag (but not in code blocks)
    let tag_regex = Regex::new(r"(?:^|[^\w#])#([\w\-_]+)").unwrap();
    for cap in tag_regex.captures_iter(content) {
        if let Some(tag) = cap.get(1) {
            tags.insert(tag.as_str().to_string());
        }
    }

    // If no title found, try to extract from filename or use first line
    if title.is_empty() {
        title = content
            .lines()
            .next()
            .unwrap_or("Untitled")
            .trim()
            .trim_start_matches('#')
            .trim()
            .to_string();
    }

    ParsedMarkdown {
        title,
        content: content.to_string(),
        wikilinks: wikilinks.into_iter().collect(),
        tags: tags.into_iter().collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_title() {
        let content = "# My Title\n\nSome content here.";
        let parsed = parse_markdown(content);
        assert_eq!(parsed.title, "My Title");
    }

    #[test]
    fn test_parse_title_no_heading() {
        let content = "Just some text without heading.";
        let parsed = parse_markdown(content);
        assert_eq!(parsed.title, "Just some text without heading.");
    }

    #[test]
    fn test_parse_wikilinks() {
        let content = "# Test\n\nLink to [[Page A]] and [[Page B]].";
        let parsed = parse_markdown(content);
        assert_eq!(parsed.wikilinks.len(), 2);
        assert!(parsed.wikilinks.contains(&"Page A".to_string()));
        assert!(parsed.wikilinks.contains(&"Page B".to_string()));
    }

    #[test]
    fn test_parse_wikilinks_with_alias() {
        let content = "# Test\n\nLink to [[Page A|别名]] here.";
        let parsed = parse_markdown(content);
        assert_eq!(parsed.wikilinks.len(), 1);
        assert!(parsed.wikilinks.contains(&"Page A".to_string()));
    }

    #[test]
    fn test_parse_tags() {
        let content = "# Test\n\nSome content #tag1 and #tag2 here.";
        let parsed = parse_markdown(content);
        assert_eq!(parsed.tags.len(), 2);
        assert!(parsed.tags.contains(&"tag1".to_string()));
        assert!(parsed.tags.contains(&"tag2".to_string()));
    }

    #[test]
    fn test_parse_complex_content() {
        let content = r#"# Project A

这是项目 A 的说明文档。

## 相关链接

- [[Index]]
- [[Project B]]
- [[Meeting Notes]]

#project #rust
"#;
        let parsed = parse_markdown(content);
        assert_eq!(parsed.title, "Project A");
        assert_eq!(parsed.wikilinks.len(), 3);
        assert!(parsed.wikilinks.contains(&"Index".to_string()));
        assert!(parsed.wikilinks.contains(&"Project B".to_string()));
        assert!(parsed.wikilinks.contains(&"Meeting Notes".to_string()));
        assert_eq!(parsed.tags.len(), 2);
        assert!(parsed.tags.contains(&"project".to_string()));
        assert!(parsed.tags.contains(&"rust".to_string()));
    }

    #[test]
    fn test_empty_content() {
        let content = "";
        let parsed = parse_markdown(content);
        assert_eq!(parsed.title, "Untitled");
        assert!(parsed.wikilinks.is_empty());
        assert!(parsed.tags.is_empty());
    }

    #[test]
    fn test_duplicate_wikilinks() {
        let content = "# Test\n\n[[Page A]] and [[Page A]] again.";
        let parsed = parse_markdown(content);
        assert_eq!(parsed.wikilinks.len(), 1);
    }
}
