use notify_debouncer_full::{new_debouncer, notify::*, DebounceEventResult};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver};
use std::time::Duration;
use anyhow::Result;

pub struct FileWatcher {
    pub receiver: Receiver<Vec<PathBuf>>,
}

impl FileWatcher {
    pub fn new(vault_path: &Path) -> Result<Self> {
        let (tx, rx) = channel();
        let vault_path = vault_path.to_path_buf();

        std::thread::spawn(move || {
            let (tx_debounced, rx_debounced) = channel();
            
            let mut debouncer = new_debouncer(
                Duration::from_millis(200),
                None,
                move |result: DebounceEventResult| {
                    match result {
                        Ok(events) => {
                            let paths: Vec<PathBuf> = events
                                .iter()
                                .filter_map(|event| {
                                    if let Some(path) = &event.paths.first() {
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
                    }
                },
            ).expect("Failed to create debouncer");

            debouncer
                .watcher()
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
