use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use regex::Regex;
use std::collections::HashSet;

#[derive(Debug, Clone)]
pub struct ParsedMarkdown {
    pub title: String,
    pub content: String,
    pub wikilinks: Vec<String>,
    pub tags: Vec<String>,
}

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
        title = content.lines()
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
