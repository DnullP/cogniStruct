//! # CogniStruct Library
//!
//! CogniStruct 是一个用于管理和可视化 Markdown 知识库的 Tauri 应用程序后端。
//! 基于 DCOM（Dynamic Cognitive Object Model）架构设计。
//!
//! ## 模块结构
//!
//! - [`adapters`] - 适配器模块，将各种格式转换为 DCOM 认知对象
//! - [`commands`] - Tauri 命令处理模块，提供前端调用的 API 接口
//! - [`db`] - 数据库模块，基于 CozoDB 实现图数据存储
//! - [`dcom`] - DCOM 核心模块，定义认知对象数据结构
//! - [`sync`] - 同步模块，负责文件监听和变化处理
//!
//! ## 架构设计
//!
//! 系统采用三层架构：
//! - **DCOM 核心层**：抽象的认知对象模型，格式无关
//! - **适配器层**：将具体格式（Obsidian Markdown 等）映射到 DCOM
//! - **存储层**：CozoDB 索引 + 文件系统持久化
//!
//! ## 功能特性
//!
//! - 打开并索引 Markdown 知识库（Vault）
//! - 解析 Markdown 文件中的 wikilinks 和标签
//! - 构建知识图谱并提供图数据查询
//! - 实时监听文件变化并同步更新
//! - 动态属性和类型推演支持
//! - 可扩展的适配器架构
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! // 启动 Tauri 应用程序
//! cognistruct_lib::run();
//! ```

pub mod adapters;
mod commands;
mod db;
pub mod dcom;
mod sync;

use commands::AppState;

/// 运行 CogniStruct Tauri 应用程序
///
/// 初始化 Tauri 应用程序，注册所有必要的插件和命令处理器。
///
/// # 功能
///
/// - 初始化 `tauri_plugin_opener` 插件（用于打开外部链接）
/// - 初始化 `tauri_plugin_dialog` 插件（用于文件选择对话框）
/// - 注册应用状态 `AppState`
/// - 注册所有 Tauri 命令
///
/// # Panics
///
/// 如果 Tauri 应用程序初始化失败，程序将 panic。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::open_vault,
            commands::get_graph_data,
            commands::get_file_tree,
            commands::get_file_content,
            commands::save_file,
            commands::search_nodes,
            commands::get_vault_statistics,
            commands::get_dcom_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
