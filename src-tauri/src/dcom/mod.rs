//! # DCOM (Dynamic Cognitive Object Model) 模块
//!
//! 本模块实现了动态认知对象模型的核心数据结构和行为。
//!
//! ## 设计理念
//!
//! DCOM 将信息单元视为具有生命周期的"认知对象"，而非简单的文件。
//! 核心特点：
//! - **对象统一论**：一切皆对象，"类"本身也是对象
//! - **动态属性**：Schema-less 的属性存储
//! - **多源序列化**：对象可以有多种物理表示（Markdown、二进制等）
//! - **规则驱动类型**：类型通过 Datalog 规则推演
//!
//! ## 模块依赖
//!
//! - `serde` - 序列化/反序列化
//! - `uuid` - UUID 生成
//! - `chrono` - 时间处理
//!
//! ## 模块结构
//!
//! - [`object`] - 认知对象核心定义
//! - [`property`] - 动态属性系统
//! - [`serialization`] - 序列化层（物理表示）
//!
//! ## 导出的主要内容
//!
//! ### 结构体
//! - [`CognitiveObject`] - 认知对象核心结构
//! - [`ObjectId`] - 对象唯一标识
//! - [`Property`] - 动态属性
//! - [`PropertyValue`] - 属性值（多态）
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use dcom::{CognitiveObject, PropertyValue};
//!
//! let mut obj = CognitiveObject::new();
//! obj.set_property("type", PropertyValue::String("note".into()));
//! obj.set_property("author", PropertyValue::String("Alice".into()));
//! ```
//!
//! ## 状态说明
//!
//! 本模块定义的数据结构是无状态的值对象（Value Object）。
//! 对象的持久化由 `db` 模块负责。

pub mod object;
pub mod property;
pub mod serialization;

// Re-export main types
pub use object::{CognitiveObject, ObjectId};
pub use property::{Property, PropertyValue};
pub use serialization::{MarkdownSource, SerializationSource};
