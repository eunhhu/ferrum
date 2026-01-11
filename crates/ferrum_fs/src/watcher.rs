//! File system watcher

use ferrum_core::prelude::*;
use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{DebouncedEvent, Debouncer, RecommendedCache, new_debouncer};
use std::path::Path;
use std::path::PathBuf;
use std::time::Duration;
use tokio::sync::mpsc;

/// File system event
#[derive(Debug, Clone)]
pub enum FsEvent {
  Created(PathBuf),
  Modified(PathBuf),
  Deleted(PathBuf),
  Renamed { from: PathBuf, to: PathBuf },
}

/// File system watcher
pub struct FileWatcher {
  debouncer: Debouncer<RecommendedWatcher, RecommendedCache>,
  event_rx: mpsc::Receiver<FsEvent>,
}

impl FileWatcher {
  /// Create a new file watcher
  pub fn new() -> Result<Self> {
    let (tx, rx) = mpsc::channel(256);

    let debouncer = new_debouncer(
      Duration::from_millis(100),
      None,
      move |result: std::result::Result<Vec<DebouncedEvent>, Vec<notify::Error>>| {
        if let Ok(events) = result {
          for event in events {
            let fs_event = match &event.kind {
              notify::EventKind::Create(_) => {
                event.paths.first().map(|p| FsEvent::Created(p.clone()))
              },
              notify::EventKind::Modify(notify::event::ModifyKind::Name(_)) => {
                // Rename events
                if event.paths.len() >= 2 {
                  Some(FsEvent::Renamed {
                    from: event.paths[0].clone(),
                    to: event.paths[1].clone(),
                  })
                } else {
                  event.paths.first().map(|p| FsEvent::Modified(p.clone()))
                }
              },
              notify::EventKind::Modify(_) => {
                event.paths.first().map(|p| FsEvent::Modified(p.clone()))
              },
              notify::EventKind::Remove(_) => {
                event.paths.first().map(|p| FsEvent::Deleted(p.clone()))
              },
              _ => None,
            };

            if let Some(e) = fs_event {
              let _ = tx.blocking_send(e);
            }
          }
        }
      },
    )
    .map_err(|e| Error::Internal(format!("Failed to create watcher: {}", e)))?;

    Ok(Self {
      debouncer,
      event_rx: rx,
    })
  }

  /// Watch a path
  pub fn watch(&mut self, path: impl AsRef<Path>) -> Result<()> {
    self
      .debouncer
      .watch(path.as_ref(), RecursiveMode::Recursive)
      .map_err(|e| Error::Internal(format!("Failed to watch: {}", e)))
  }

  /// Stop watching a path
  pub fn unwatch(&mut self, path: impl AsRef<Path>) -> Result<()> {
    self
      .debouncer
      .unwatch(path.as_ref())
      .map_err(|e| Error::Internal(format!("Failed to unwatch: {}", e)))
  }

  /// Receive the next event
  pub async fn recv(&mut self) -> Option<FsEvent> {
    self.event_rx.recv().await
  }
}
