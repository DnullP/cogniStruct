//! # Property 模块
//!
//! 本模块定义了 DCOM 的动态属性系统，实现 Schema-less 的属性存储。
//!
//! ## 模块依赖
//!
//! - `serde` - 序列化/反序列化
//! - `serde_json` - JSON 值类型支持
//! - `chrono` - 时间类型
//!
//! ## 导出的主要内容
//!
//! ### 枚举
//! - [`PropertyValue`] - 多态属性值
//!
//! ### 结构体
//! - [`Property`] - 属性定义（名称 + 值）
//!
//! ## 设计说明
//!
//! 属性系统采用 EAV（Entity-Attribute-Value）模式：
//! - 任何对象可以拥有任意数量的属性
//! - 属性值支持多种类型（字符串、数字、布尔、日期、引用等）
//! - 属性可以是对另一个对象的引用（实现关联）
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use dcom::property::{Property, PropertyValue};
//!
//! let title = Property::new("title", PropertyValue::String("My Note".into()));
//! let priority = Property::new("priority", PropertyValue::Integer(1));
//! let is_done = Property::new("done", PropertyValue::Boolean(false));
//! ```

use serde::{Deserialize, Serialize};

/// 属性值
///
/// 多态属性值类型，支持多种数据类型。
/// 设计参考 v2 文档的"通用四元组存储"理念。
///
/// # 变体说明
///
/// * `Null` - 空值
/// * `String` - 字符串
/// * `Integer` - 整数
/// * `Float` - 浮点数
/// * `Boolean` - 布尔值
/// * `DateTime` - 日期时间（ISO 8601 格式字符串）
/// * `Reference` - 对另一个对象的引用（存储目标对象 ID）
/// * `List` - 值列表
/// * `Json` - 任意 JSON 值（用于复杂嵌套结构）
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum PropertyValue {
    /// 空值
    Null,
    /// 字符串值
    String(String),
    /// 整数值
    Integer(i64),
    /// 浮点数值
    Float(f64),
    /// 布尔值
    Boolean(bool),
    /// 日期时间（ISO 8601 格式）
    DateTime(String),
    /// 对另一个对象的引用
    Reference(String),
    /// 值列表
    List(Vec<PropertyValue>),
    /// 任意 JSON 值
    Json(serde_json::Value),
}

impl PropertyValue {
    /// 创建字符串属性值
    pub fn string(s: impl Into<String>) -> Self {
        PropertyValue::String(s.into())
    }

    /// 创建整数属性值
    pub fn integer(i: i64) -> Self {
        PropertyValue::Integer(i)
    }

    /// 创建浮点数属性值
    pub fn float(f: f64) -> Self {
        PropertyValue::Float(f)
    }

    /// 创建布尔属性值
    pub fn boolean(b: bool) -> Self {
        PropertyValue::Boolean(b)
    }

    /// 创建引用属性值
    pub fn reference(id: impl Into<String>) -> Self {
        PropertyValue::Reference(id.into())
    }

    /// 创建字符串列表属性值
    pub fn string_list(items: Vec<String>) -> Self {
        PropertyValue::List(items.into_iter().map(PropertyValue::String).collect())
    }

    /// 尝试获取字符串值
    pub fn as_string(&self) -> Option<&str> {
        match self {
            PropertyValue::String(s) => Some(s),
            _ => None,
        }
    }

    /// 尝试获取整数值
    pub fn as_integer(&self) -> Option<i64> {
        match self {
            PropertyValue::Integer(i) => Some(*i),
            _ => None,
        }
    }

    /// 尝试获取布尔值
    pub fn as_boolean(&self) -> Option<bool> {
        match self {
            PropertyValue::Boolean(b) => Some(*b),
            _ => None,
        }
    }

    /// 尝试获取引用 ID
    pub fn as_reference(&self) -> Option<&str> {
        match self {
            PropertyValue::Reference(id) => Some(id),
            _ => None,
        }
    }

    /// 检查是否为空值
    pub fn is_null(&self) -> bool {
        matches!(self, PropertyValue::Null)
    }
}

impl Default for PropertyValue {
    fn default() -> Self {
        PropertyValue::Null
    }
}

impl From<String> for PropertyValue {
    fn from(s: String) -> Self {
        PropertyValue::String(s)
    }
}

impl From<&str> for PropertyValue {
    fn from(s: &str) -> Self {
        PropertyValue::String(s.to_string())
    }
}

impl From<i64> for PropertyValue {
    fn from(i: i64) -> Self {
        PropertyValue::Integer(i)
    }
}

impl From<f64> for PropertyValue {
    fn from(f: f64) -> Self {
        PropertyValue::Float(f)
    }
}

impl From<bool> for PropertyValue {
    fn from(b: bool) -> Self {
        PropertyValue::Boolean(b)
    }
}

impl From<Vec<String>> for PropertyValue {
    fn from(v: Vec<String>) -> Self {
        PropertyValue::string_list(v)
    }
}

impl From<serde_json::Value> for PropertyValue {
    fn from(v: serde_json::Value) -> Self {
        match v {
            serde_json::Value::Null => PropertyValue::Null,
            serde_json::Value::Bool(b) => PropertyValue::Boolean(b),
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    PropertyValue::Integer(i)
                } else if let Some(f) = n.as_f64() {
                    PropertyValue::Float(f)
                } else {
                    PropertyValue::Null
                }
            }
            serde_json::Value::String(s) => PropertyValue::String(s),
            serde_json::Value::Array(arr) => {
                PropertyValue::List(arr.into_iter().map(PropertyValue::from).collect())
            }
            serde_json::Value::Object(_) => PropertyValue::Json(v),
        }
    }
}

/// 属性定义
///
/// 表示一个命名的属性，包含属性名和属性值。
///
/// # 字段说明
///
/// * `name` - 属性名称
/// * `value` - 属性值
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Property {
    /// 属性名称
    pub name: String,
    /// 属性值
    pub value: PropertyValue,
}

impl Property {
    /// 创建新属性
    ///
    /// # 参数
    ///
    /// * `name` - 属性名称
    /// * `value` - 属性值
    pub fn new(name: impl Into<String>, value: impl Into<PropertyValue>) -> Self {
        Property {
            name: name.into(),
            value: value.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_property_value_string() {
        let val = PropertyValue::string("hello");
        assert_eq!(val.as_string(), Some("hello"));
        assert!(val.as_integer().is_none());
    }

    #[test]
    fn test_property_value_integer() {
        let val = PropertyValue::integer(42);
        assert_eq!(val.as_integer(), Some(42));
        assert!(val.as_string().is_none());
    }

    #[test]
    fn test_property_value_reference() {
        let val = PropertyValue::reference("uuid-123");
        assert_eq!(val.as_reference(), Some("uuid-123"));
    }

    #[test]
    fn test_property_value_from_string() {
        let val: PropertyValue = "test".into();
        assert_eq!(val.as_string(), Some("test"));
    }

    #[test]
    fn test_property_value_from_json() {
        let json = serde_json::json!({"key": "value"});
        let val = PropertyValue::from(json.clone());
        assert!(matches!(val, PropertyValue::Json(_)));
    }

    #[test]
    fn test_property_new() {
        let prop = Property::new("title", "My Note");
        assert_eq!(prop.name, "title");
        assert_eq!(prop.value.as_string(), Some("My Note"));
    }

    #[test]
    fn test_property_value_string_list() {
        let val = PropertyValue::string_list(vec!["a".into(), "b".into()]);
        if let PropertyValue::List(items) = val {
            assert_eq!(items.len(), 2);
            assert_eq!(items[0].as_string(), Some("a"));
        } else {
            panic!("Expected List variant");
        }
    }

    #[test]
    fn test_property_value_serialization() {
        let val = PropertyValue::string("test");
        let json = serde_json::to_string(&val).unwrap();
        let parsed: PropertyValue = serde_json::from_str(&json).unwrap();
        assert_eq!(val, parsed);
    }
}
