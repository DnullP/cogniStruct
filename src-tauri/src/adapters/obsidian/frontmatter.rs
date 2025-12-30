//! # Frontmatter 模块
//!
//! 本模块提供 YAML Frontmatter 的解析和转换功能。
//!
//! ## 模块依赖
//!
//! - `serde_yaml` - YAML 解析
//! - `serde_json` - JSON 转换（用于复杂对象）
//! - [`crate::dcom::PropertyValue`] - DCOM 属性值类型
//!
//! ## 导出的主要内容
//!
//! ### 结构体
//! - [`Frontmatter`] - YAML Frontmatter 数据结构
//!
//! ### 函数
//! - [`parse_frontmatter`] - 解析 frontmatter
//! - [`yaml_to_property_value`] - YAML 值转 PropertyValue
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use adapters::obsidian::frontmatter::{parse_frontmatter, Frontmatter};
//!
//! let content = "---\ntags: [rust]\ntype: note\n---\n# Hello";
//! let (fm, body) = parse_frontmatter(content);
//! ```

use crate::dcom::PropertyValue;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Frontmatter 元数据
///
/// 存储从 Markdown 文件头部 YAML 区域提取的结构化元数据。
/// 支持 Obsidian 风格的 frontmatter 格式。
///
/// # Obsidian 约定
///
/// | 字段 | 说明 |
/// |------|------|
/// | `tags` | 标签列表 |
/// | `aliases` | 别名列表 |
/// | `type` | 节点类型 |
/// | `created` | 创建日期 |
///
/// # 字段说明
///
/// * `tags` - 标签列表，用于分类和过滤
/// * `aliases` - 别名列表，wikilink 可以通过别名链接到此笔记
/// * `node_type` - 节点类型（映射自 YAML 中的 `type` 字段）
/// * `created` - 创建日期字符串
/// * `properties` - 其他自定义属性（通过 `#[serde(flatten)]` 捕获）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Frontmatter {
    /// 标签列表
    #[serde(default)]
    pub tags: Vec<String>,

    /// 别名列表
    #[serde(default)]
    pub aliases: Vec<String>,

    /// 节点类型
    #[serde(rename = "type", default)]
    pub node_type: Option<String>,

    /// 创建日期
    #[serde(default)]
    pub created: Option<String>,

    /// 其他自定义属性
    #[serde(flatten)]
    pub properties: HashMap<String, serde_yaml::Value>,
}

impl Frontmatter {
    /// 检查 frontmatter 是否为空
    pub fn is_empty(&self) -> bool {
        self.tags.is_empty()
            && self.aliases.is_empty()
            && self.node_type.is_none()
            && self.created.is_none()
            && self.properties.is_empty()
    }
}

/// 解析 Frontmatter
///
/// 从 Markdown 内容开头提取 YAML frontmatter。
///
/// # 参数
///
/// * `content` - Markdown 文本内容
///
/// # 返回值
///
/// 返回 `(Option<Frontmatter>, String)` 元组：
/// - 第一项：解析成功的 Frontmatter，如果不存在或解析失败则为 None
/// - 第二项：去除 frontmatter 后的剩余内容
///
/// # 解析规则
///
/// 1. 内容必须以 `---` 开头
/// 2. frontmatter 结束标记为另一个 `---`（在新行）
/// 3. 两个标记之间的内容作为 YAML 解析
///
/// # 示例
///
/// ```rust,ignore
/// let (fm, body) = parse_frontmatter("---\ntags: [a]\n---\nContent");
/// assert!(fm.is_some());
/// assert!(body.contains("Content"));
/// ```
pub fn parse_frontmatter(content: &str) -> (Option<Frontmatter>, String) {
    // 检查是否以 --- 开头
    if !content.starts_with("---") {
        return (None, content.to_string());
    }

    // 查找结束的 ---
    if let Some(end_pos) = content[3..].find("\n---") {
        let yaml_content = &content[3..3 + end_pos];
        let remaining = &content[3 + end_pos + 4..]; // 跳过 \n---

        // 解析 YAML
        match serde_yaml::from_str::<Frontmatter>(yaml_content.trim()) {
            Ok(fm) => (Some(fm), remaining.trim_start().to_string()),
            Err(_) => (None, content.to_string()),
        }
    } else {
        (None, content.to_string())
    }
}

/// 将 YAML 值转换为 PropertyValue
///
/// 将 `serde_yaml::Value` 递归转换为 DCOM 的 `PropertyValue`。
///
/// # 参数
///
/// * `value` - YAML 值
///
/// # 返回值
///
/// 对应的 `PropertyValue`
///
/// # 转换规则
///
/// | YAML 类型 | PropertyValue |
/// |-----------|---------------|
/// | Null | `Null` |
/// | Bool | `Boolean` |
/// | Number (整数) | `Integer` |
/// | Number (浮点) | `Float` |
/// | String | `String` |
/// | Sequence | `List` |
/// | Mapping | `Json` |
/// | Tagged | `Null` |
pub fn yaml_to_property_value(value: &serde_yaml::Value) -> PropertyValue {
    match value {
        serde_yaml::Value::Null => PropertyValue::Null,
        serde_yaml::Value::Bool(b) => PropertyValue::Boolean(*b),
        serde_yaml::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                PropertyValue::Integer(i)
            } else if let Some(f) = n.as_f64() {
                PropertyValue::Float(f)
            } else {
                PropertyValue::Null
            }
        }
        serde_yaml::Value::String(s) => PropertyValue::String(s.clone()),
        serde_yaml::Value::Sequence(seq) => {
            let items: Vec<PropertyValue> = seq.iter().map(yaml_to_property_value).collect();
            PropertyValue::List(items)
        }
        serde_yaml::Value::Mapping(_) => {
            // 复杂对象转换为 JSON
            if let Ok(json) = serde_json::to_value(value) {
                PropertyValue::Json(json)
            } else {
                PropertyValue::Null
            }
        }
        serde_yaml::Value::Tagged(_) => PropertyValue::Null,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_frontmatter_basic() {
        let content = "---\ntags: [rust, test]\ntype: note\n---\n# Hello\n\nContent";
        let (fm, body) = parse_frontmatter(content);

        assert!(fm.is_some());
        let fm = fm.unwrap();
        assert_eq!(fm.tags, vec!["rust", "test"]);
        assert_eq!(fm.node_type, Some("note".to_string()));
        assert!(body.starts_with("# Hello"));
    }

    #[test]
    fn test_parse_frontmatter_with_aliases() {
        let content = "---\naliases: [alias1, alias2]\n---\nContent";
        let (fm, _body) = parse_frontmatter(content);

        assert!(fm.is_some());
        let fm = fm.unwrap();
        assert_eq!(fm.aliases, vec!["alias1", "alias2"]);
    }

    #[test]
    fn test_parse_frontmatter_with_created() {
        let content = "---\ncreated: 2024-01-15\n---\nContent";
        let (fm, _body) = parse_frontmatter(content);

        assert!(fm.is_some());
        let fm = fm.unwrap();
        assert_eq!(fm.created, Some("2024-01-15".to_string()));
    }

    #[test]
    fn test_parse_frontmatter_with_custom_properties() {
        let content = "---\nauthor: John\npriority: 5\n---\nContent";
        let (fm, _body) = parse_frontmatter(content);

        assert!(fm.is_some());
        let fm = fm.unwrap();
        assert!(fm.properties.contains_key("author"));
        assert!(fm.properties.contains_key("priority"));
    }

    #[test]
    fn test_parse_frontmatter_none() {
        let content = "# No Frontmatter\n\nJust content.";
        let (fm, body) = parse_frontmatter(content);

        assert!(fm.is_none());
        assert_eq!(body, content);
    }

    #[test]
    fn test_parse_frontmatter_invalid_yaml() {
        let content = "---\n[invalid yaml\n---\nContent";
        let (fm, body) = parse_frontmatter(content);

        assert!(fm.is_none());
        assert_eq!(body, content); // 返回原始内容
    }

    #[test]
    fn test_yaml_to_property_value_primitives() {
        assert!(matches!(
            yaml_to_property_value(&serde_yaml::Value::Null),
            PropertyValue::Null
        ));

        assert!(matches!(
            yaml_to_property_value(&serde_yaml::Value::Bool(true)),
            PropertyValue::Boolean(true)
        ));

        let num = serde_yaml::Value::Number(42.into());
        assert!(matches!(
            yaml_to_property_value(&num),
            PropertyValue::Integer(42)
        ));

        let s = serde_yaml::Value::String("hello".to_string());
        assert!(matches!(
            yaml_to_property_value(&s),
            PropertyValue::String(ref x) if x == "hello"
        ));
    }

    #[test]
    fn test_yaml_to_property_value_sequence() {
        let seq = serde_yaml::Value::Sequence(vec![
            serde_yaml::Value::String("a".to_string()),
            serde_yaml::Value::String("b".to_string()),
        ]);

        if let PropertyValue::List(items) = yaml_to_property_value(&seq) {
            assert_eq!(items.len(), 2);
        } else {
            panic!("Expected List");
        }
    }

    #[test]
    fn test_frontmatter_is_empty() {
        let empty = Frontmatter::default();
        assert!(empty.is_empty());

        let mut non_empty = Frontmatter::default();
        non_empty.tags.push("tag".to_string());
        assert!(!non_empty.is_empty());
    }
}
