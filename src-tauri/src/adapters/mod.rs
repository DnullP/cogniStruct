//! # Adapters 模块
//!
//! 本模块定义对象适配器层，负责将各种格式的资源转换为 DCOM 认知对象。
//!
//! ## 设计理念
//!
//! DCOM 核心层是抽象的、格式无关的。适配器层负责：
//! - 将具体格式（如 Obsidian Markdown、PDF、图片等）映射到 DCOM 模型
//! - 提供双向转换能力（load/save）
//! - 提取对象间的关系（链接、引用等）
//!
//! ## 模块依赖
//!
//! - [`crate::dcom`] - DCOM 核心数据结构
//! - 各适配器依赖其特定的解析库
//!
//! ## 导出的主要内容
//!
//! ### Trait
//! - [`ObjectAdapter`] - 对象适配器特征
//!
//! ### 子模块
//! - [`obsidian`] - Obsidian Markdown 适配器
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use adapters::{ObjectAdapter, obsidian::ObsidianAdapter};
//! use std::path::Path;
//!
//! let adapter = ObsidianAdapter::new();
//! let obj = adapter.load(Path::new("notes/my-note.md"))?;
//! println!("Title: {:?}", obj.title());
//! ```
//!
//! ## 扩展新适配器
//!
//! 实现 `ObjectAdapter` trait 即可添加对新格式的支持：
//!
//! ```rust,ignore
//! pub struct PdfAdapter;
//!
//! impl ObjectAdapter for PdfAdapter {
//!     fn supported_extensions(&self) -> &[&str] { &["pdf"] }
//!     fn load(&self, path: &Path, content: &[u8]) -> Result<CognitiveObject> { ... }
//!     // ...
//! }
//! ```

pub mod obsidian;

use crate::dcom::CognitiveObject;
use anyhow::Result;
use std::path::Path;

/// 链接类型
///
/// 表示对象间的链接关系类型。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LinkKind {
    /// Wiki 链接：`[[target]]`
    WikiLink,
    /// 块引用链接：`[[note#^blockid]]`
    BlockReference,
    /// 嵌入：`![[target]]`
    Embed,
    /// 外部链接
    External,
}

/// 提取的链接
///
/// 表示从源对象中提取的一个链接。
///
/// # 字段说明
///
/// * `target` - 链接目标（可能是路径、标题或 URL）
/// * `kind` - 链接类型
/// * `display_text` - 显示文本（如 `[[link|display]]` 中的 display）
/// * `line_number` - 链接所在行号
#[derive(Debug, Clone)]
pub struct ExtractedLink {
    /// 链接目标
    pub target: String,
    /// 链接类型
    pub kind: LinkKind,
    /// 显示文本
    pub display_text: Option<String>,
    /// 所在行号（1-based）
    pub line_number: Option<usize>,
}

impl ExtractedLink {
    /// 创建新的链接
    pub fn new(target: impl Into<String>, kind: LinkKind) -> Self {
        ExtractedLink {
            target: target.into(),
            kind,
            display_text: None,
            line_number: None,
        }
    }

    /// 设置显示文本
    pub fn with_display_text(mut self, text: impl Into<String>) -> Self {
        self.display_text = Some(text.into());
        self
    }

    /// 设置行号
    pub fn with_line_number(mut self, line: usize) -> Self {
        self.line_number = Some(line);
        self
    }
}

/// 对象适配器特征
///
/// 定义将特定格式资源转换为 DCOM 认知对象的接口。
/// 每种文件格式（如 Obsidian Markdown、PDF 等）实现此 trait。
///
/// # 设计原则
///
/// - 适配器是无状态的
/// - 提供双向转换（load/save）
/// - 负责提取对象间关系
///
/// # 示例实现
///
/// ```rust,ignore
/// impl ObjectAdapter for MyAdapter {
///     fn supported_extensions(&self) -> &[&str] {
///         &["myext"]
///     }
///
///     fn load(&self, path: &Path, content: &[u8]) -> Result<CognitiveObject> {
///         // 解析 content，构建 CognitiveObject
///         Ok(CognitiveObject::new())
///     }
///
///     fn save(&self, object: &CognitiveObject) -> Result<Vec<u8>> {
///         // 序列化对象为文件内容
///         Ok(vec![])
///     }
///
///     fn extract_links(&self, object: &CognitiveObject) -> Vec<ExtractedLink> {
///         vec![]
///     }
/// }
/// ```
pub trait ObjectAdapter: Send + Sync {
    /// 适配器支持的文件扩展名
    ///
    /// 返回此适配器能处理的文件扩展名列表（不含点号）。
    ///
    /// # 返回值
    ///
    /// 文件扩展名切片，如 `&["md", "markdown"]`
    fn supported_extensions(&self) -> &[&str];

    /// 从文件加载为 CognitiveObject
    ///
    /// 解析文件内容，构建 DCOM 认知对象。
    ///
    /// # 参数
    ///
    /// * `path` - 文件相对路径（相对于 vault 根目录）
    /// * `content` - 文件二进制内容
    ///
    /// # 返回值
    ///
    /// 成功返回 `CognitiveObject`，失败返回错误
    ///
    /// # 错误
    ///
    /// - 内容编码不支持
    /// - 格式解析失败
    fn load(&self, path: &Path, content: &[u8]) -> Result<CognitiveObject>;

    /// 将 CognitiveObject 序列化为文件内容
    ///
    /// 将认知对象转换回原始格式的字节内容。
    ///
    /// # 参数
    ///
    /// * `object` - 要序列化的认知对象
    ///
    /// # 返回值
    ///
    /// 成功返回文件字节内容，失败返回错误
    ///
    /// # 错误
    ///
    /// - 对象缺少必要属性
    /// - 序列化失败
    fn save(&self, object: &CognitiveObject) -> Result<Vec<u8>>;

    /// 提取对象中的链接
    ///
    /// 分析对象内容，提取指向其他对象的链接关系。
    ///
    /// # 参数
    ///
    /// * `object` - 认知对象
    ///
    /// # 返回值
    ///
    /// 提取的链接列表
    fn extract_links(&self, object: &CognitiveObject) -> Vec<ExtractedLink>;

    /// 检查是否支持指定扩展名
    ///
    /// # 参数
    ///
    /// * `ext` - 文件扩展名（不含点号）
    ///
    /// # 返回值
    ///
    /// 如果支持返回 true
    fn supports(&self, ext: &str) -> bool {
        self.supported_extensions()
            .iter()
            .any(|e| e.eq_ignore_ascii_case(ext))
    }
}

/// 适配器注册表
///
/// 管理多个适配器，根据文件扩展名自动选择合适的适配器。
///
/// # 使用示例
///
/// ```rust,ignore
/// let mut registry = AdapterRegistry::new();
/// registry.register(Box::new(ObsidianAdapter::new()));
///
/// if let Some(adapter) = registry.find_adapter("md") {
///     let obj = adapter.load(path, content)?;
/// }
/// ```
pub struct AdapterRegistry {
    /// 已注册的适配器列表
    adapters: Vec<Box<dyn ObjectAdapter>>,
}

impl AdapterRegistry {
    /// 创建空的注册表
    pub fn new() -> Self {
        AdapterRegistry {
            adapters: Vec::new(),
        }
    }

    /// 注册一个适配器
    ///
    /// # 参数
    ///
    /// * `adapter` - 适配器实例
    pub fn register(&mut self, adapter: Box<dyn ObjectAdapter>) {
        self.adapters.push(adapter);
    }

    /// 根据扩展名查找适配器
    ///
    /// # 参数
    ///
    /// * `ext` - 文件扩展名（不含点号）
    ///
    /// # 返回值
    ///
    /// 如果找到返回适配器引用，否则返回 None
    pub fn find_adapter(&self, ext: &str) -> Option<&dyn ObjectAdapter> {
        self.adapters
            .iter()
            .find(|a| a.supports(ext))
            .map(|a| a.as_ref())
    }

    /// 根据文件路径查找适配器
    ///
    /// # 参数
    ///
    /// * `path` - 文件路径
    ///
    /// # 返回值
    ///
    /// 如果找到返回适配器引用，否则返回 None
    pub fn find_adapter_for_path(&self, path: &Path) -> Option<&dyn ObjectAdapter> {
        path.extension()
            .and_then(|ext| ext.to_str())
            .and_then(|ext| self.find_adapter(ext))
    }
}

impl Default for AdapterRegistry {
    fn default() -> Self {
        let mut registry = Self::new();
        // 默认注册 Obsidian 适配器
        registry.register(Box::new(obsidian::ObsidianAdapter::new()));
        registry
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extracted_link_creation() {
        let link = ExtractedLink::new("target", LinkKind::WikiLink)
            .with_display_text("display")
            .with_line_number(10);

        assert_eq!(link.target, "target");
        assert_eq!(link.kind, LinkKind::WikiLink);
        assert_eq!(link.display_text, Some("display".to_string()));
        assert_eq!(link.line_number, Some(10));
    }

    #[test]
    fn test_adapter_registry() {
        let registry = AdapterRegistry::default();

        // 应该找到 md 扩展名的适配器
        assert!(registry.find_adapter("md").is_some());
        assert!(registry.find_adapter("markdown").is_some());

        // 不支持的扩展名
        assert!(registry.find_adapter("pdf").is_none());
    }

    #[test]
    fn test_find_adapter_for_path() {
        let registry = AdapterRegistry::default();

        let md_path = Path::new("notes/test.md");
        assert!(registry.find_adapter_for_path(md_path).is_some());

        let pdf_path = Path::new("docs/test.pdf");
        assert!(registry.find_adapter_for_path(pdf_path).is_none());
    }
}
