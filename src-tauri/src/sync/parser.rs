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
