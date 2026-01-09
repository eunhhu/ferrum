//! Task scheduling and background job infrastructure
//!
//! Provides utilities for running background tasks with proper cancellation,
//! progress reporting, and error handling.

use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use parking_lot::Mutex;
use tokio::sync::{broadcast, mpsc};

use crate::id::RequestId;

/// A handle to a running background task
pub struct TaskHandle<T> {
    id: RequestId,
    cancel_flag: Arc<AtomicBool>,
    result_rx: tokio::sync::oneshot::Receiver<crate::Result<T>>,
}

impl<T> TaskHandle<T> {
    /// Get the task ID
    pub fn id(&self) -> RequestId {
        self.id
    }

    /// Cancel the task
    pub fn cancel(&self) {
        self.cancel_flag.store(true, Ordering::SeqCst);
    }

    /// Check if the task was cancelled
    pub fn is_cancelled(&self) -> bool {
        self.cancel_flag.load(Ordering::SeqCst)
    }

    /// Wait for the task to complete
    pub async fn wait(self) -> crate::Result<T> {
        self.result_rx.await.map_err(|_| {
            crate::Error::Internal("Task was dropped before completion".to_string())
        })?
    }
}

/// Context passed to background tasks
#[derive(Clone)]
pub struct TaskContext {
    cancel_flag: Arc<AtomicBool>,
    progress: Arc<TaskProgress>,
}

impl TaskContext {
    /// Create a new task context
    pub fn new() -> (Self, Arc<AtomicBool>) {
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let ctx = Self {
            cancel_flag: cancel_flag.clone(),
            progress: Arc::new(TaskProgress::new()),
        };
        (ctx, cancel_flag)
    }

    /// Check if cancellation was requested
    pub fn is_cancelled(&self) -> bool {
        self.cancel_flag.load(Ordering::SeqCst)
    }

    /// Report progress (0-100)
    pub fn report_progress(&self, percentage: u8) {
        self.progress
            .current
            .store(percentage.min(100) as u64, Ordering::SeqCst);
    }

    /// Set the progress message
    pub fn set_message(&self, message: impl Into<String>) {
        *self.progress.message.lock() = Some(message.into());
    }

    /// Get the progress tracker
    pub fn progress(&self) -> &Arc<TaskProgress> {
        &self.progress
    }
}

impl Default for TaskContext {
    fn default() -> Self {
        Self::new().0
    }
}

/// Progress information for a task
pub struct TaskProgress {
    current: AtomicU64,
    total: AtomicU64,
    message: Mutex<Option<String>>,
}

impl TaskProgress {
    /// Create a new progress tracker
    pub fn new() -> Self {
        Self {
            current: AtomicU64::new(0),
            total: AtomicU64::new(100),
            message: Mutex::new(None),
        }
    }

    /// Get current progress percentage (0-100)
    pub fn percentage(&self) -> u8 {
        let current = self.current.load(Ordering::SeqCst);
        let total = self.total.load(Ordering::SeqCst);
        if total == 0 {
            0
        } else {
            ((current * 100) / total).min(100) as u8
        }
    }

    /// Get the current message
    pub fn message(&self) -> Option<String> {
        self.message.lock().clone()
    }

    /// Set total units of work
    pub fn set_total(&self, total: u64) {
        self.total.store(total, Ordering::SeqCst);
    }

    /// Increment progress by one unit
    pub fn increment(&self) {
        self.current.fetch_add(1, Ordering::SeqCst);
    }

    /// Set current progress units
    pub fn set_current(&self, current: u64) {
        self.current.store(current, Ordering::SeqCst);
    }
}

impl Default for TaskProgress {
    fn default() -> Self {
        Self::new()
    }
}

/// Task scheduler for managing background jobs
pub struct TaskScheduler {
    runtime: tokio::runtime::Handle,
    shutdown_tx: broadcast::Sender<()>,
}

impl TaskScheduler {
    /// Create a new task scheduler
    pub fn new(runtime: tokio::runtime::Handle) -> Self {
        let (shutdown_tx, _) = broadcast::channel(1);
        Self {
            runtime,
            shutdown_tx,
        }
    }

    /// Spawn a background task
    pub fn spawn<F, T>(&self, task: F) -> TaskHandle<T>
    where
        F: FnOnce(TaskContext) -> Pin<Box<dyn Future<Output = crate::Result<T>> + Send>>
            + Send
            + 'static,
        T: Send + 'static,
    {
        let id = RequestId::new();
        let (ctx, cancel_flag) = TaskContext::new();
        let (result_tx, result_rx) = tokio::sync::oneshot::channel();

        let mut shutdown_rx = self.shutdown_tx.subscribe();
        let cancel_flag_clone = cancel_flag.clone();

        self.runtime.spawn(async move {
            let result = tokio::select! {
                result = task(ctx) => result,
                _ = shutdown_rx.recv() => {
                    cancel_flag_clone.store(true, Ordering::SeqCst);
                    Err(crate::Error::Internal("Scheduler shutdown".to_string()))
                }
            };
            let _ = result_tx.send(result);
        });

        TaskHandle {
            id,
            cancel_flag,
            result_rx,
        }
    }

    /// Spawn a simple async task without context
    pub fn spawn_detached<F>(&self, future: F)
    where
        F: Future<Output = ()> + Send + 'static,
    {
        self.runtime.spawn(future);
    }

    /// Signal shutdown to all tasks
    pub fn shutdown(&self) {
        let _ = self.shutdown_tx.send(());
    }
}

/// Debouncer for coalescing rapid events
pub struct Debouncer<T> {
    tx: mpsc::Sender<T>,
}

impl<T: Send + 'static> Debouncer<T> {
    /// Create a new debouncer with the specified delay
    pub fn new<F>(delay: std::time::Duration, handler: F) -> Self
    where
        F: Fn(T) + Send + 'static,
    {
        let (tx, mut rx) = mpsc::channel::<T>(16);

        tokio::spawn(async move {
            let mut pending: Option<T> = None;
            let mut timer = tokio::time::interval(delay);
            timer.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            loop {
                tokio::select! {
                    Some(item) = rx.recv() => {
                        pending = Some(item);
                        timer.reset();
                    }
                    _ = timer.tick() => {
                        if let Some(item) = pending.take() {
                            handler(item);
                        }
                    }
                }
            }
        });

        Self { tx }
    }

    /// Submit an item to be debounced
    pub fn call(&self, item: T) {
        let _ = self.tx.try_send(item);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_task_completion() {
        let runtime = tokio::runtime::Handle::current();
        let scheduler = TaskScheduler::new(runtime);

        let handle = scheduler.spawn(|_ctx| {
            Box::pin(async { Ok::<_, crate::Error>(42) })
        });

        let result = handle.wait().await.unwrap();
        assert_eq!(result, 42);
    }

    #[tokio::test]
    async fn test_task_cancellation() {
        let runtime = tokio::runtime::Handle::current();
        let scheduler = TaskScheduler::new(runtime);

        let handle = scheduler.spawn(|ctx| {
            Box::pin(async move {
                for i in 0..100 {
                    if ctx.is_cancelled() {
                        return Err(crate::Error::Internal("Cancelled".to_string()));
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                    ctx.report_progress(i as u8);
                }
                Ok(())
            })
        });

        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        handle.cancel();

        let result = handle.wait().await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_progress_tracking() {
        let progress = TaskProgress::new();
        progress.set_total(200);
        progress.set_current(100);
        assert_eq!(progress.percentage(), 50);

        progress.increment();
        assert_eq!(progress.percentage(), 50); // 101/200 still rounds to 50
    }
}
