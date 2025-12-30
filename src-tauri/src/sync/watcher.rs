//! # Watcher 模块
//!
//! 本模块提供文件系统监听功能，用于实时监控知识库文件变化。
//!
//! ## 模块依赖
//!
//! - `notify_debouncer_full` - 带防抖的文件监听库
//! - `anyhow` - 错误处理
//!
//! ## 导出的主要内容
//!
//! ### 结构体
//! - [`FileWatcher`] - 文件监听器
//!
//! ## 功能说明
//!
//! 本模块使用 notify 库监控知识库目录中的 Markdown 文件变化。
//! 事件经过防抖处理（200ms），避免短时间内的重复触发。
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use watcher::FileWatcher;
//!
//! let watcher = FileWatcher::new(&vault_path)?;
//!
//! // 在另一个线程中处理文件变化事件
//! while let Ok(paths) = watcher.receiver.recv() {
//!     for path in paths {
//!         println!("File changed: {:?}", path);
//!     }
//! }
//! ```

use anyhow::Result;
use notify_debouncer_full::{new_debouncer, notify::RecursiveMode, DebounceEventResult};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver};
use std::time::Duration;

/// 文件监听器
///
/// 监控知识库目录中的 Markdown 文件变化，并通过 channel 发送变化的文件路径。
/// 使用防抖机制（200ms）避免短时间内的重复事件。
///
/// # 字段说明
///
/// * `receiver` - 接收文件变化事件的 channel 接收端
///
/// # 使用方式
///
/// 创建监听器后，在另一个线程中循环接收文件变化事件：
///
/// ```rust,ignore
/// let watcher = FileWatcher::new(&vault_path)?;
/// while let Ok(paths) = watcher.receiver.recv() {
///     // 处理变化的文件
/// }
/// ```
pub struct FileWatcher {
    /// 文件变化事件接收器
    pub receiver: Receiver<Vec<PathBuf>>,
}

impl FileWatcher {
    /// 创建新的文件监听器
    ///
    /// 启动一个后台线程监控指定目录中的 Markdown 文件变化。
    /// 使用 200ms 的防抖时间避免频繁触发。
    ///
    /// # 参数
    ///
    /// * `vault_path` - 要监控的知识库目录路径
    ///
    /// # 返回值
    ///
    /// * `Ok(FileWatcher)` - 创建成功的监听器实例
    /// * `Err(anyhow::Error)` - 创建失败
    ///
    /// # 错误情况
    ///
    /// * 无法创建文件监听器
    /// * 无法监控指定目录
    ///
    /// # 注意事项
    ///
    /// 监听器在后台线程中运行，会持续监控直到程序退出。
    pub fn new(vault_path: &Path) -> Result<Self> {
        let (tx, rx) = channel();
        let vault_path = vault_path.to_path_buf();

        std::thread::spawn(move || {
            let (tx_debounced, rx_debounced) = channel();

            let mut debouncer = new_debouncer(
                Duration::from_millis(200),
                None,
                move |result: DebounceEventResult| match result {
                    Ok(events) => {
                        let paths: Vec<PathBuf> = events
                            .iter()
                            .filter_map(|event| {
                                if let Some(path) = event.paths.first() {
                                    if path.extension().and_then(|s| s.to_str()) == Some("md") {
                                        return Some(path.clone());
                                    }
                                }
                                None
                            })
                            .collect();

                        if !paths.is_empty() {
                            let _ = tx_debounced.send(paths);
                        }
                    }
                    Err(e) => eprintln!("Watch error: {:?}", e),
                },
            )
            .expect("Failed to create debouncer");

            debouncer
                .watch(&vault_path, RecursiveMode::Recursive)
                .expect("Failed to watch vault path");

            // Keep the debouncer alive and forward events
            while let Ok(paths) = rx_debounced.recv() {
                let _ = tx.send(paths);
            }
        });

        Ok(FileWatcher { receiver: rx })
    }
}
