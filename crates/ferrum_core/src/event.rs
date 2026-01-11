//! Event system for Ferrum IDE
//!
//! Provides a publish-subscribe event system for decoupled communication
//! between components. Events are categorized by domain and can be
//! subscribed to globally or per-scope.

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::any::{Any, TypeId};
use std::collections::HashMap;

use crate::id::{BufferId, FileId, TabId, WindowId};

/// Event bus for publishing and subscribing to events
pub struct EventBus {
  handlers: RwLock<HashMap<TypeId, Vec<Box<dyn Fn(&dyn Any) + Send + Sync>>>>,
}

impl EventBus {
  /// Create a new event bus
  pub fn new() -> Self {
    Self {
      handlers: RwLock::new(HashMap::new()),
    }
  }

  /// Subscribe to events of a specific type
  pub fn subscribe<E, F>(&self, handler: F)
  where
    E: Event + 'static,
    F: Fn(&E) + Send + Sync + 'static,
  {
    let type_id = TypeId::of::<E>();
    let boxed: Box<dyn Fn(&dyn Any) + Send + Sync> = Box::new(move |event| {
      if let Some(e) = event.downcast_ref::<E>() {
        handler(e);
      }
    });

    self
      .handlers
      .write()
      .entry(type_id)
      .or_default()
      .push(boxed);
  }

  /// Publish an event to all subscribers
  pub fn publish<E: Event + 'static>(&self, event: &E) {
    let type_id = TypeId::of::<E>();
    if let Some(handlers) = self.handlers.read().get(&type_id) {
      for handler in handlers {
        handler(event);
      }
    }
  }
}

impl Default for EventBus {
  fn default() -> Self {
    Self::new()
  }
}

/// Marker trait for events
pub trait Event: Send + Sync {}

// ===== File Events =====

/// Event emitted when a file is opened
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOpened {
  pub file_id: FileId,
  pub buffer_id: BufferId,
  pub path: std::path::PathBuf,
}
impl Event for FileOpened {}

/// Event emitted when a file is saved
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSaved {
  pub file_id: FileId,
  pub buffer_id: BufferId,
  pub path: std::path::PathBuf,
}
impl Event for FileSaved {}

/// Event emitted when a file is closed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileClosed {
  pub file_id: FileId,
  pub buffer_id: BufferId,
}
impl Event for FileClosed {}

/// Event emitted when a file changes on disk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangedOnDisk {
  pub path: std::path::PathBuf,
  pub change_kind: FileChangeKind,
}
impl Event for FileChangedOnDisk {}

/// Kind of file change
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileChangeKind {
  Created,
  Modified,
  Deleted,
  Renamed,
}

// ===== Buffer Events =====

/// Event emitted when buffer content changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BufferChanged {
  pub buffer_id: BufferId,
  pub changes: Vec<TextChange>,
}
impl Event for BufferChanged {}

/// Represents a single text change
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextChange {
  pub range: std::ops::Range<usize>,
  pub text: String,
}

/// Event emitted when buffer dirty state changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BufferDirtyChanged {
  pub buffer_id: BufferId,
  pub is_dirty: bool,
}
impl Event for BufferDirtyChanged {}

// ===== Editor Events =====

/// Event emitted when cursor position changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorMoved {
  pub buffer_id: BufferId,
  pub position: Position,
  pub selection: Option<Selection>,
}
impl Event for CursorMoved {}

/// Position in a document
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Position {
  pub line: usize,
  pub column: usize,
}

/// Selection range
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Selection {
  pub start: Position,
  pub end: Position,
}

/// Event emitted when active tab changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveTabChanged {
  pub window_id: WindowId,
  pub previous: Option<TabId>,
  pub current: Option<TabId>,
}
impl Event for ActiveTabChanged {}

// ===== LSP Events =====

/// Event emitted when LSP diagnostics are received
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticsReceived {
  pub file_id: FileId,
  pub diagnostics: Vec<Diagnostic>,
}
impl Event for DiagnosticsReceived {}

/// A diagnostic message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
  pub range: std::ops::Range<usize>,
  pub severity: DiagnosticSeverity,
  pub message: String,
  pub source: Option<String>,
  pub code: Option<String>,
}

/// Diagnostic severity level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiagnosticSeverity {
  Error,
  Warning,
  Info,
  Hint,
}

// ===== Window Events =====

/// Event emitted when a window is created
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowCreated {
  pub window_id: WindowId,
}
impl Event for WindowCreated {}

/// Event emitted when a window is closed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowClosed {
  pub window_id: WindowId,
}
impl Event for WindowClosed {}

/// Event emitted when window focus changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowFocusChanged {
  pub window_id: WindowId,
  pub focused: bool,
}
impl Event for WindowFocusChanged {}

// ===== Git Events =====

/// Event emitted when git status changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatusChanged {
  pub repository_path: std::path::PathBuf,
}
impl Event for GitStatusChanged {}

/// Event emitted when current branch changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranchChanged {
  pub repository_path: std::path::PathBuf,
  pub branch_name: Option<String>,
}
impl Event for GitBranchChanged {}

// ===== Global Event Bus =====

/// Get the global event bus instance
pub fn global_event_bus() -> &'static EventBus {
  static EVENT_BUS: once_cell::sync::Lazy<EventBus> = once_cell::sync::Lazy::new(EventBus::new);
  &EVENT_BUS
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::atomic::{AtomicUsize, Ordering};
  use std::sync::Arc;

  #[test]
  fn test_event_bus_publish_subscribe() {
    let bus = EventBus::new();
    let counter = Arc::new(AtomicUsize::new(0));

    let counter_clone = counter.clone();
    bus.subscribe::<FileSaved, _>(move |_event| {
      counter_clone.fetch_add(1, Ordering::SeqCst);
    });

    bus.publish(&FileSaved {
      file_id: FileId::new(),
      buffer_id: BufferId::new(),
      path: std::path::PathBuf::from("/test"),
    });

    assert_eq!(counter.load(Ordering::SeqCst), 1);
  }

  #[test]
  fn test_event_isolation() {
    let bus = EventBus::new();
    let counter = Arc::new(AtomicUsize::new(0));

    let counter_clone = counter.clone();
    bus.subscribe::<FileSaved, _>(move |_event| {
      counter_clone.fetch_add(1, Ordering::SeqCst);
    });

    // Publishing a different event type should not trigger the handler
    bus.publish(&FileOpened {
      file_id: FileId::new(),
      buffer_id: BufferId::new(),
      path: std::path::PathBuf::from("/test"),
    });

    assert_eq!(counter.load(Ordering::SeqCst), 0);
  }
}
