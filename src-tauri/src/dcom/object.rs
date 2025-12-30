//! # Object 模块
//!
//! 本模块定义了 DCOM 的核心数据结构：认知对象（CognitiveObject）。
//!
//! ## 设计理念
//!
//! 认知对象是 DCOM 系统的基础单元，综合了三版设计文档的核心思想：
//! - **v1**：对象化知识管理（笔记/事物/资料/多媒体）
//! - **v2**：流体认知对象（动态类型、双时态、规则推演）
//! - **v3**：双源架构（Markdown 物理层 + CozoDB 逻辑层）
//!
//! ## 模块依赖
//!
//! - `serde` - 序列化/反序列化
//! - `uuid` - UUID 生成
//! - `chrono` - 时间处理
//! - [`super::property`] - 属性系统
//! - [`super::serialization`] - 序列化层
//!
//! ## 导出的主要内容
//!
//! ### 结构体
//! - [`ObjectId`] - 对象唯一标识
//! - [`CognitiveObject`] - 认知对象核心结构
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use dcom::object::{CognitiveObject, ObjectId};
//! use dcom::property::PropertyValue;
//!
//! let mut obj = CognitiveObject::new();
//! obj.set_property("title", PropertyValue::string("My Note"));
//! obj.set_property("type", PropertyValue::string("note"));
//! obj.add_tag("rust");
//! ```

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use super::property::PropertyValue;
use super::serialization::SerializationSource;

/// 对象唯一标识
///
/// 基于 UUID v4 生成的唯一标识符。
/// 设计为不可变类型，一旦创建不可更改。
///
/// # 字段说明
///
/// * 内部存储 UUID 的字符串表示
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ObjectId(String);

impl ObjectId {
    /// 生成新的唯一 ID
    ///
    /// 使用 UUID v4 算法生成随机唯一标识。
    pub fn new() -> Self {
        ObjectId(Uuid::new_v4().to_string())
    }

    /// 从字符串创建 ID
    ///
    /// # 参数
    ///
    /// * `id` - ID 字符串
    ///
    /// # 注意
    ///
    /// 不验证输入是否为有效 UUID 格式
    pub fn from_string(id: impl Into<String>) -> Self {
        ObjectId(id.into())
    }

    /// 获取 ID 字符串引用
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// 消费并返回内部字符串
    pub fn into_string(self) -> String {
        self.0
    }
}

impl Default for ObjectId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for ObjectId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<String> for ObjectId {
    fn from(s: String) -> Self {
        ObjectId(s)
    }
}

impl From<&str> for ObjectId {
    fn from(s: &str) -> Self {
        ObjectId(s.to_string())
    }
}

/// 认知对象
///
/// DCOM 系统的核心数据结构，表示知识图谱中的一个节点。
///
/// ## 结构层次
///
/// 1. **身份层**：`id`, `created_at`, `updated_at`
/// 2. **序列化层**：`sources` - 物理表示形式
/// 3. **属性层**：`properties` - 动态 Schema-less 属性
/// 4. **关系层**：`tags`, `aliases`, `links` - 快速访问的关系
/// 5. **推演层**：`inferred_type`, `equivalence_classes` - Datalog 规则计算结果
///
/// ## 设计说明
///
/// - 属性使用 HashMap 实现 Schema-less 存储
/// - 序列化源支持多种物理表示
/// - 推演属性由 CozoDB 规则计算填充
///
/// # 字段说明
///
/// * `id` - 对象唯一标识
/// * `created_at` - 创建时间戳（Unix 毫秒）
/// * `updated_at` - 更新时间戳（Unix 毫秒）
/// * `sources` - 序列化源列表（物理表示）
/// * `properties` - 动态属性（键值对）
/// * `tags` - 标签列表
/// * `aliases` - 别名列表
/// * `links` - 出链目标 ID 列表
/// * `inferred_type` - 推演类型（由规则计算）
/// * `equivalence_classes` - 所属等价类（由规则计算）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitiveObject {
    /// 对象唯一标识
    pub id: ObjectId,
    /// 创建时间戳（Unix 毫秒）
    pub created_at: i64,
    /// 更新时间戳（Unix 毫秒）
    pub updated_at: i64,
    /// 序列化源列表
    #[serde(default)]
    pub sources: Vec<SerializationSource>,
    /// 动态属性
    #[serde(default)]
    pub properties: HashMap<String, PropertyValue>,
    /// 标签列表
    #[serde(default)]
    pub tags: Vec<String>,
    /// 别名列表
    #[serde(default)]
    pub aliases: Vec<String>,
    /// 出链目标 ID 列表
    #[serde(default)]
    pub links: Vec<ObjectId>,
    /// 推演类型（由 Datalog 规则计算）
    #[serde(default)]
    pub inferred_type: Option<String>,
    /// 所属等价类列表（由 Datalog 规则计算）
    #[serde(default)]
    pub equivalence_classes: Vec<String>,
}

impl CognitiveObject {
    /// 创建新的认知对象
    ///
    /// 生成新 UUID，设置创建和更新时间为当前时间。
    pub fn new() -> Self {
        let now = chrono::Utc::now().timestamp_millis();
        CognitiveObject {
            id: ObjectId::new(),
            created_at: now,
            updated_at: now,
            sources: Vec::new(),
            properties: HashMap::new(),
            tags: Vec::new(),
            aliases: Vec::new(),
            links: Vec::new(),
            inferred_type: None,
            equivalence_classes: Vec::new(),
        }
    }

    /// 使用指定 ID 创建新的认知对象
    ///
    /// # 参数
    ///
    /// * `id` - 对象 ID
    pub fn with_id(id: impl Into<ObjectId>) -> Self {
        let now = chrono::Utc::now().timestamp_millis();
        CognitiveObject {
            id: id.into(),
            created_at: now,
            updated_at: now,
            sources: Vec::new(),
            properties: HashMap::new(),
            tags: Vec::new(),
            aliases: Vec::new(),
            links: Vec::new(),
            inferred_type: None,
            equivalence_classes: Vec::new(),
        }
    }

    /// 设置属性
    ///
    /// 如果属性已存在则覆盖。同时更新 `updated_at` 时间戳。
    ///
    /// # 参数
    ///
    /// * `name` - 属性名
    /// * `value` - 属性值
    pub fn set_property(&mut self, name: impl Into<String>, value: impl Into<PropertyValue>) {
        self.properties.insert(name.into(), value.into());
        self.updated_at = chrono::Utc::now().timestamp_millis();
    }

    /// 获取属性值
    ///
    /// # 参数
    ///
    /// * `name` - 属性名
    ///
    /// # 返回值
    ///
    /// 属性值的引用，如果不存在则返回 None
    pub fn get_property(&self, name: &str) -> Option<&PropertyValue> {
        self.properties.get(name)
    }

    /// 移除属性
    ///
    /// # 参数
    ///
    /// * `name` - 属性名
    ///
    /// # 返回值
    ///
    /// 被移除的属性值，如果不存在则返回 None
    pub fn remove_property(&mut self, name: &str) -> Option<PropertyValue> {
        let result = self.properties.remove(name);
        if result.is_some() {
            self.updated_at = chrono::Utc::now().timestamp_millis();
        }
        result
    }

    /// 获取标题属性
    ///
    /// 便捷方法，获取 "title" 属性的字符串值
    pub fn title(&self) -> Option<&str> {
        self.get_property("title").and_then(|v| v.as_string())
    }

    /// 设置标题
    ///
    /// 便捷方法，设置 "title" 属性
    pub fn set_title(&mut self, title: impl Into<String>) {
        self.set_property("title", PropertyValue::string(title));
    }

    /// 获取内容属性
    ///
    /// 便捷方法，获取 "content" 属性的字符串值
    pub fn content(&self) -> Option<&str> {
        self.get_property("content").and_then(|v| v.as_string())
    }

    /// 设置内容
    ///
    /// 便捷方法，设置 "content" 属性
    pub fn set_content(&mut self, content: impl Into<String>) {
        self.set_property("content", PropertyValue::string(content));
    }

    /// 获取类型
    ///
    /// 优先返回推演类型，如果没有则返回显式设置的类型属性
    pub fn object_type(&self) -> Option<&str> {
        self.inferred_type
            .as_deref()
            .or_else(|| self.get_property("type").and_then(|v| v.as_string()))
    }

    /// 设置显式类型
    ///
    /// 便捷方法，设置 "type" 属性
    pub fn set_type(&mut self, obj_type: impl Into<String>) {
        self.set_property("type", PropertyValue::string(obj_type));
    }

    /// 添加标签
    ///
    /// 如果标签不存在则添加，同时更新时间戳
    ///
    /// # 参数
    ///
    /// * `tag` - 标签名
    pub fn add_tag(&mut self, tag: impl Into<String>) {
        let tag = tag.into();
        if !self.tags.contains(&tag) {
            self.tags.push(tag);
            self.updated_at = chrono::Utc::now().timestamp_millis();
        }
    }

    /// 移除标签
    ///
    /// # 参数
    ///
    /// * `tag` - 标签名
    ///
    /// # 返回值
    ///
    /// 如果标签存在并被移除则返回 true
    pub fn remove_tag(&mut self, tag: &str) -> bool {
        if let Some(pos) = self.tags.iter().position(|t| t == tag) {
            self.tags.remove(pos);
            self.updated_at = chrono::Utc::now().timestamp_millis();
            true
        } else {
            false
        }
    }

    /// 添加别名
    ///
    /// 如果别名不存在则添加
    ///
    /// # 参数
    ///
    /// * `alias` - 别名
    pub fn add_alias(&mut self, alias: impl Into<String>) {
        let alias = alias.into();
        if !self.aliases.contains(&alias) {
            self.aliases.push(alias);
            self.updated_at = chrono::Utc::now().timestamp_millis();
        }
    }

    /// 添加链接
    ///
    /// 添加到另一个对象的链接
    ///
    /// # 参数
    ///
    /// * `target_id` - 目标对象 ID
    pub fn add_link(&mut self, target_id: impl Into<ObjectId>) {
        let target = target_id.into();
        if !self.links.contains(&target) {
            self.links.push(target);
            self.updated_at = chrono::Utc::now().timestamp_millis();
        }
    }

    /// 添加序列化源
    ///
    /// # 参数
    ///
    /// * `source` - 序列化源
    pub fn add_source(&mut self, source: SerializationSource) {
        self.sources.push(source);
        self.updated_at = chrono::Utc::now().timestamp_millis();
    }

    /// 获取 Markdown 源
    ///
    /// 返回第一个 Markdown 类型的序列化源
    pub fn markdown_source(&self) -> Option<&super::serialization::MarkdownSource> {
        self.sources.iter().find_map(|s| {
            if let SerializationSource::Markdown(m) = s {
                Some(m)
            } else {
                None
            }
        })
    }

    /// 获取文件路径
    ///
    /// 便捷方法，获取 Markdown 源的文件路径
    pub fn path(&self) -> Option<&str> {
        self.markdown_source().map(|m| m.path.as_str())
    }

    /// 检查是否有物理文件
    pub fn has_file(&self) -> bool {
        self.sources.iter().any(|s| !s.is_virtual())
    }

    /// 获取类型
    ///
    /// 获取显式设置的类型属性（不包括推演类型）
    ///
    /// # 返回值
    ///
    /// 类型字符串引用，如果没有设置则返回 None
    pub fn get_type(&self) -> Option<&str> {
        self.get_property("type").and_then(|v| v.as_string())
    }

    /// 获取所有标签
    ///
    /// # 返回值
    ///
    /// 标签列表的引用
    pub fn tags(&self) -> &[String] {
        &self.tags
    }

    /// 获取所有别名
    ///
    /// # 返回值
    ///
    /// 别名列表的引用
    pub fn aliases(&self) -> &[String] {
        &self.aliases
    }

    /// 获取所有属性
    ///
    /// # 返回值
    ///
    /// 属性映射的引用
    pub fn properties(&self) -> &HashMap<String, PropertyValue> {
        &self.properties
    }

    /// 获取所有链接
    ///
    /// # 返回值
    ///
    /// 链接列表的引用
    pub fn links(&self) -> &[ObjectId] {
        &self.links
    }

    /// 获取所有序列化源
    ///
    /// # 返回值
    ///
    /// 序列化源列表的引用
    pub fn sources(&self) -> &[SerializationSource] {
        &self.sources
    }

    /// 检查是否为虚拟对象
    pub fn is_virtual(&self) -> bool {
        self.sources.is_empty() || self.sources.iter().all(|s| s.is_virtual())
    }
}

impl Default for CognitiveObject {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dcom::serialization::MarkdownSource;

    #[test]
    fn test_object_id_new() {
        let id1 = ObjectId::new();
        let id2 = ObjectId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_object_id_from_string() {
        let id = ObjectId::from_string("test-id-123");
        assert_eq!(id.as_str(), "test-id-123");
    }

    #[test]
    fn test_cognitive_object_new() {
        let obj = CognitiveObject::new();
        assert!(!obj.id.as_str().is_empty());
        assert!(obj.created_at > 0);
        assert!(obj.properties.is_empty());
    }

    #[test]
    fn test_cognitive_object_with_id() {
        let obj = CognitiveObject::with_id("custom-id");
        assert_eq!(obj.id.as_str(), "custom-id");
    }

    #[test]
    fn test_set_and_get_property() {
        let mut obj = CognitiveObject::new();
        obj.set_property("key", PropertyValue::string("value"));

        let prop = obj.get_property("key");
        assert!(prop.is_some());
        assert_eq!(prop.unwrap().as_string(), Some("value"));
    }

    #[test]
    fn test_remove_property() {
        let mut obj = CognitiveObject::new();
        obj.set_property("key", PropertyValue::string("value"));

        let removed = obj.remove_property("key");
        assert!(removed.is_some());
        assert!(obj.get_property("key").is_none());
    }

    #[test]
    fn test_title_convenience_methods() {
        let mut obj = CognitiveObject::new();
        obj.set_title("My Note");

        assert_eq!(obj.title(), Some("My Note"));
    }

    #[test]
    fn test_content_convenience_methods() {
        let mut obj = CognitiveObject::new();
        obj.set_content("Hello, world!");

        assert_eq!(obj.content(), Some("Hello, world!"));
    }

    #[test]
    fn test_type_with_inferred() {
        let mut obj = CognitiveObject::new();
        obj.set_type("note");
        obj.inferred_type = Some("concept".to_string());

        // inferred_type takes precedence
        assert_eq!(obj.object_type(), Some("concept"));
    }

    #[test]
    fn test_type_without_inferred() {
        let mut obj = CognitiveObject::new();
        obj.set_type("note");

        assert_eq!(obj.object_type(), Some("note"));
    }

    #[test]
    fn test_add_tag() {
        let mut obj = CognitiveObject::new();
        obj.add_tag("rust");
        obj.add_tag("programming");
        obj.add_tag("rust"); // duplicate

        assert_eq!(obj.tags.len(), 2);
        assert!(obj.tags.contains(&"rust".to_string()));
    }

    #[test]
    fn test_remove_tag() {
        let mut obj = CognitiveObject::new();
        obj.add_tag("rust");

        assert!(obj.remove_tag("rust"));
        assert!(!obj.remove_tag("nonexistent"));
        assert!(obj.tags.is_empty());
    }

    #[test]
    fn test_add_alias() {
        let mut obj = CognitiveObject::new();
        obj.add_alias("alias1");
        obj.add_alias("alias2");
        obj.add_alias("alias1"); // duplicate

        assert_eq!(obj.aliases.len(), 2);
    }

    #[test]
    fn test_add_link() {
        let mut obj = CognitiveObject::new();
        let target = ObjectId::new();
        obj.add_link(target.clone());

        assert_eq!(obj.links.len(), 1);
        assert_eq!(obj.links[0], target);
    }

    #[test]
    fn test_add_source() {
        let mut obj = CognitiveObject::new();
        let source = SerializationSource::Markdown(MarkdownSource::new("test.md", "hash", 0));
        obj.add_source(source);

        assert_eq!(obj.sources.len(), 1);
        assert!(obj.markdown_source().is_some());
    }

    #[test]
    fn test_path() {
        let mut obj = CognitiveObject::new();
        let source = SerializationSource::Markdown(MarkdownSource::new("notes/test.md", "hash", 0));
        obj.add_source(source);

        assert_eq!(obj.path(), Some("notes/test.md"));
    }

    #[test]
    fn test_has_file() {
        let obj = CognitiveObject::new();
        assert!(!obj.has_file());

        let mut obj2 = CognitiveObject::new();
        obj2.add_source(SerializationSource::Markdown(MarkdownSource::new(
            "test.md", "hash", 0,
        )));
        assert!(obj2.has_file());
    }

    #[test]
    fn test_is_virtual() {
        let obj = CognitiveObject::new();
        assert!(obj.is_virtual()); // no sources

        let mut obj2 = CognitiveObject::new();
        obj2.add_source(SerializationSource::Markdown(MarkdownSource::new(
            "test.md", "hash", 0,
        )));
        assert!(!obj2.is_virtual());
    }

    #[test]
    fn test_serialization() {
        let mut obj = CognitiveObject::new();
        obj.set_title("Test");
        obj.add_tag("rust");

        let json = serde_json::to_string(&obj).unwrap();
        let parsed: CognitiveObject = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.title(), Some("Test"));
        assert!(parsed.tags.contains(&"rust".to_string()));
    }
}
