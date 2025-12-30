//! # Serialization 模块
//!
//! 本模块定义了认知对象的序列化层（物理表示）。
//!
//! ## 设计理念
//!
//! 根据 DCOM 架构，认知对象可以有多种物理表示形式：
//! - **Markdown**：最常见的表示形式，兼容 Obsidian 等工具
//! - **Binary**：PDF、图片、音频等二进制资源
//! - **Virtual**：由 Datalog 规则动态生成的虚拟对象
//!
//! 序列化层负责：
//! 1. 记录对象的物理存储位置
//! 2. 跟踪内容变化（通过 hash）
//! 3. 支持增量同步
//!
//! ## 模块依赖
//!
//! - `serde` - 序列化/反序列化
//!
//! ## 导出的主要内容
//!
//! ### 枚举
//! - [`SerializationSource`] - 序列化源类型
//!
//! ### 结构体
//! - [`MarkdownSource`] - Markdown 文件源
//! - [`BinarySource`] - 二进制文件源
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use dcom::serialization::{SerializationSource, MarkdownSource};
//!
//! let source = SerializationSource::Markdown(MarkdownSource {
//!     path: "notes/my-note.md".into(),
//!     content_hash: "abc123".into(),
//!     last_modified: 1704067200,
//! });
//! ```

use serde::{Deserialize, Serialize};

/// Markdown 文件源
///
/// 表示一个 Markdown 文件作为认知对象的物理表示。
///
/// # 字段说明
///
/// * `path` - 相对于 Vault 根目录的文件路径
/// * `content_hash` - 文件内容的哈希值，用于检测变化
/// * `last_modified` - 最后修改时间戳（Unix 时间戳）
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MarkdownSource {
    /// 相对于 Vault 的文件路径
    pub path: String,
    /// 内容哈希值
    pub content_hash: String,
    /// 最后修改时间戳
    pub last_modified: i64,
}

impl MarkdownSource {
    /// 创建新的 Markdown 源
    ///
    /// # 参数
    ///
    /// * `path` - 文件路径
    /// * `content_hash` - 内容哈希
    /// * `last_modified` - 最后修改时间
    pub fn new(
        path: impl Into<String>,
        content_hash: impl Into<String>,
        last_modified: i64,
    ) -> Self {
        MarkdownSource {
            path: path.into(),
            content_hash: content_hash.into(),
            last_modified,
        }
    }

    /// 检查内容是否发生变化
    ///
    /// # 参数
    ///
    /// * `new_hash` - 新的内容哈希
    ///
    /// # 返回值
    ///
    /// 如果哈希不同则返回 true
    pub fn has_changed(&self, new_hash: &str) -> bool {
        self.content_hash != new_hash
    }
}

/// 二进制文件源
///
/// 表示一个二进制文件（如 PDF、图片、音频）作为认知对象的物理表示。
///
/// # 字段说明
///
/// * `path` - 相对于 Vault 根目录的文件路径
/// * `content_hash` - 文件内容的哈希值
/// * `mime_type` - MIME 类型
/// * `size_bytes` - 文件大小（字节）
/// * `last_modified` - 最后修改时间戳
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BinarySource {
    /// 相对于 Vault 的文件路径
    pub path: String,
    /// 内容哈希值
    pub content_hash: String,
    /// MIME 类型
    pub mime_type: String,
    /// 文件大小（字节）
    pub size_bytes: u64,
    /// 最后修改时间戳
    pub last_modified: i64,
}

impl BinarySource {
    /// 创建新的二进制源
    ///
    /// # 参数
    ///
    /// * `path` - 文件路径
    /// * `content_hash` - 内容哈希
    /// * `mime_type` - MIME 类型
    /// * `size_bytes` - 文件大小
    /// * `last_modified` - 最后修改时间
    pub fn new(
        path: impl Into<String>,
        content_hash: impl Into<String>,
        mime_type: impl Into<String>,
        size_bytes: u64,
        last_modified: i64,
    ) -> Self {
        BinarySource {
            path: path.into(),
            content_hash: content_hash.into(),
            mime_type: mime_type.into(),
            size_bytes,
            last_modified,
        }
    }
}

/// 虚拟源信息
///
/// 表示由 Datalog 规则动态生成的虚拟对象。
/// 这类对象没有物理文件，其内容由规则计算得出。
///
/// # 字段说明
///
/// * `rule_name` - 生成此对象的规则名称
/// * `computed_at` - 最后计算时间戳
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VirtualSource {
    /// 生成此对象的规则名称
    pub rule_name: String,
    /// 最后计算时间戳
    pub computed_at: i64,
}

impl VirtualSource {
    /// 创建新的虚拟源
    ///
    /// # 参数
    ///
    /// * `rule_name` - 规则名称
    /// * `computed_at` - 计算时间
    pub fn new(rule_name: impl Into<String>, computed_at: i64) -> Self {
        VirtualSource {
            rule_name: rule_name.into(),
            computed_at,
        }
    }
}

/// 序列化源类型
///
/// 表示认知对象的物理表示形式。
/// 一个对象可能同时拥有多种序列化形式。
///
/// # 变体说明
///
/// * `Markdown` - Markdown 文件
/// * `Binary` - 二进制文件（PDF、图片等）
/// * `Virtual` - 虚拟对象（由规则生成）
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "source_type")]
pub enum SerializationSource {
    /// Markdown 文件源
    Markdown(MarkdownSource),
    /// 二进制文件源
    Binary(BinarySource),
    /// 虚拟源（规则生成）
    Virtual(VirtualSource),
}

impl SerializationSource {
    /// 获取文件路径（如果有）
    ///
    /// # 返回值
    ///
    /// 对于 Markdown 和 Binary 源返回路径，Virtual 源返回 None
    pub fn path(&self) -> Option<&str> {
        match self {
            SerializationSource::Markdown(m) => Some(&m.path),
            SerializationSource::Binary(b) => Some(&b.path),
            SerializationSource::Virtual(_) => None,
        }
    }

    /// 获取内容哈希（如果有）
    ///
    /// # 返回值
    ///
    /// 对于 Markdown 和 Binary 源返回哈希，Virtual 源返回 None
    pub fn content_hash(&self) -> Option<&str> {
        match self {
            SerializationSource::Markdown(m) => Some(&m.content_hash),
            SerializationSource::Binary(b) => Some(&b.content_hash),
            SerializationSource::Virtual(_) => None,
        }
    }

    /// 检查是否为 Markdown 源
    pub fn is_markdown(&self) -> bool {
        matches!(self, SerializationSource::Markdown(_))
    }

    /// 检查是否为二进制源
    pub fn is_binary(&self) -> bool {
        matches!(self, SerializationSource::Binary(_))
    }

    /// 检查是否为虚拟源
    pub fn is_virtual(&self) -> bool {
        matches!(self, SerializationSource::Virtual(_))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_markdown_source_new() {
        let source = MarkdownSource::new("notes/test.md", "abc123", 1704067200);
        assert_eq!(source.path, "notes/test.md");
        assert_eq!(source.content_hash, "abc123");
    }

    #[test]
    fn test_markdown_source_has_changed() {
        let source = MarkdownSource::new("test.md", "hash1", 0);
        assert!(source.has_changed("hash2"));
        assert!(!source.has_changed("hash1"));
    }

    #[test]
    fn test_binary_source_new() {
        let source = BinarySource::new(
            "docs/file.pdf",
            "xyz789",
            "application/pdf",
            1024,
            1704067200,
        );
        assert_eq!(source.path, "docs/file.pdf");
        assert_eq!(source.mime_type, "application/pdf");
        assert_eq!(source.size_bytes, 1024);
    }

    #[test]
    fn test_virtual_source_new() {
        let source = VirtualSource::new("urgent_tasks", 1704067200);
        assert_eq!(source.rule_name, "urgent_tasks");
    }

    #[test]
    fn test_serialization_source_path() {
        let md = SerializationSource::Markdown(MarkdownSource::new("test.md", "hash", 0));
        assert_eq!(md.path(), Some("test.md"));

        let virtual_src = SerializationSource::Virtual(VirtualSource::new("rule", 0));
        assert!(virtual_src.path().is_none());
    }

    #[test]
    fn test_serialization_source_type_checks() {
        let md = SerializationSource::Markdown(MarkdownSource::new("test.md", "hash", 0));
        assert!(md.is_markdown());
        assert!(!md.is_binary());
        assert!(!md.is_virtual());
    }

    #[test]
    fn test_serialization_source_json() {
        let source =
            SerializationSource::Markdown(MarkdownSource::new("test.md", "hash", 1234567890));
        let json = serde_json::to_string(&source).unwrap();
        let parsed: SerializationSource = serde_json::from_str(&json).unwrap();
        assert_eq!(source, parsed);
    }
}
