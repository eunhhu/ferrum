//! Telemetry and observability infrastructure
//!
//! Provides structured logging, metrics, and distributed tracing capabilities.

use std::path::Path;
use std::sync::OnceLock;

use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{
  EnvFilter,
  fmt::{self, format::FmtSpan},
  layer::SubscriberExt,
  util::SubscriberInitExt,
};

/// Guards that must be kept alive for logging to work
static LOG_GUARDS: OnceLock<Vec<WorkerGuard>> = OnceLock::new();

/// Configuration for telemetry initialization
#[derive(Debug, Clone)]
pub struct TelemetryConfig {
  /// Log level filter (e.g., "info", "debug", "ferrum=trace")
  pub log_filter: String,
  /// Directory for log files (None for stdout only)
  pub log_dir: Option<std::path::PathBuf>,
  /// Enable JSON format for logs
  pub json_logs: bool,
  /// Enable span events (enter/exit)
  pub span_events: bool,
  /// Application name for log prefix
  pub app_name: String,
}

impl Default for TelemetryConfig {
  fn default() -> Self {
    Self {
      log_filter: "info,ferrum=debug".to_string(),
      log_dir: None,
      json_logs: false,
      span_events: false,
      app_name: "ferrum".to_string(),
    }
  }
}

impl TelemetryConfig {
  /// Create a development configuration with verbose logging
  pub fn development() -> Self {
    Self {
      log_filter: "debug,ferrum=trace".to_string(),
      log_dir: None,
      json_logs: false,
      span_events: false, // Disabled to reduce noise
      app_name: "ferrum".to_string(),
    }
  }

  /// Create a production configuration
  pub fn production(log_dir: impl AsRef<Path>) -> Self {
    Self {
      log_filter: "info,ferrum=debug".to_string(),
      log_dir: Some(log_dir.as_ref().to_path_buf()),
      json_logs: true,
      span_events: false,
      app_name: "ferrum".to_string(),
    }
  }
}

/// Initialize the telemetry system
///
/// This should be called once at application startup. The returned guard
/// must be kept alive for the duration of the application.
pub fn init(config: TelemetryConfig) -> crate::Result<()> {
  let env_filter =
    EnvFilter::try_new(&config.log_filter).unwrap_or_else(|_| EnvFilter::new("info"));

  let mut guards = Vec::new();

  // Console layer
  let span_events = if config.span_events {
    FmtSpan::ENTER | FmtSpan::EXIT
  } else {
    FmtSpan::NONE
  };

  let fmt_layer = fmt::layer()
    .with_target(true)
    .with_thread_ids(true)
    .with_file(true)
    .with_line_number(true)
    .with_span_events(span_events);

  if let Some(log_dir) = config.log_dir {
    // File appender with rotation
    let file_appender = tracing_appender::rolling::daily(&log_dir, &config.app_name);
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
    guards.push(guard);

    let file_span_events = if config.span_events {
      FmtSpan::ENTER | FmtSpan::EXIT
    } else {
      FmtSpan::NONE
    };

    if config.json_logs {
      let file_layer = fmt::layer()
        .json()
        .with_writer(non_blocking)
        .with_span_events(file_span_events);

      tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .with(file_layer)
        .try_init()
        .map_err(|e| crate::Error::Internal(format!("Failed to init logging: {}", e)))?;
    } else {
      let file_layer = fmt::layer()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_span_events(file_span_events);

      tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .with(file_layer)
        .try_init()
        .map_err(|e| crate::Error::Internal(format!("Failed to init logging: {}", e)))?;
    }
  } else {
    tracing_subscriber::registry()
      .with(env_filter)
      .with(fmt_layer)
      .try_init()
      .map_err(|e| crate::Error::Internal(format!("Failed to init logging: {}", e)))?;
  }

  // Store guards
  LOG_GUARDS
    .set(guards)
    .map_err(|_| crate::Error::Internal("Telemetry already initialized".to_string()))?;

  tracing::info!(
      app = %config.app_name,
      filter = %config.log_filter,
      "Telemetry initialized"
  );

  Ok(())
}

/// Timing guard for measuring operation duration
pub struct TimingGuard {
  name: &'static str,
  start: std::time::Instant,
  threshold_ms: Option<u64>,
}

impl TimingGuard {
  /// Create a new timing guard
  pub fn new(name: &'static str) -> Self {
    Self {
      name,
      start: std::time::Instant::now(),
      threshold_ms: None,
    }
  }

  /// Only log if duration exceeds threshold
  pub fn with_threshold(mut self, ms: u64) -> Self {
    self.threshold_ms = Some(ms);
    self
  }
}

impl Drop for TimingGuard {
  fn drop(&mut self) {
    let elapsed = self.start.elapsed();
    let elapsed_ms = elapsed.as_millis() as u64;

    if let Some(threshold) = self.threshold_ms {
      if elapsed_ms < threshold {
        return;
      }
    }

    if elapsed_ms > 1000 {
      tracing::warn!(
          operation = %self.name,
          duration_ms = %elapsed_ms,
          "Slow operation detected"
      );
    } else {
      tracing::debug!(
          operation = %self.name,
          duration_ms = %elapsed_ms,
          "Operation completed"
      );
    }
  }
}

/// Macro for timing a block of code
#[macro_export]
macro_rules! time_operation {
  ($name:expr) => {
    let _guard = $crate::telemetry::TimingGuard::new($name);
  };
  ($name:expr, threshold = $ms:expr) => {
    let _guard = $crate::telemetry::TimingGuard::new($name).with_threshold($ms);
  };
}

/// Metrics for tracking application health
pub mod metrics {
  use std::sync::atomic::{AtomicU64, Ordering};

  /// Counter metric
  pub struct Counter {
    value: AtomicU64,
  }

  impl Counter {
    /// Create a new counter
    pub const fn new() -> Self {
      Self {
        value: AtomicU64::new(0),
      }
    }

    /// Increment the counter
    pub fn increment(&self) {
      self.value.fetch_add(1, Ordering::Relaxed);
    }

    /// Add a value to the counter
    pub fn add(&self, value: u64) {
      self.value.fetch_add(value, Ordering::Relaxed);
    }

    /// Get the current value
    pub fn get(&self) -> u64 {
      self.value.load(Ordering::Relaxed)
    }
  }

  /// Gauge metric (can go up and down)
  pub struct Gauge {
    value: AtomicU64,
  }

  impl Gauge {
    /// Create a new gauge
    pub const fn new() -> Self {
      Self {
        value: AtomicU64::new(0),
      }
    }

    /// Set the gauge value
    pub fn set(&self, value: u64) {
      self.value.store(value, Ordering::Relaxed);
    }

    /// Increment the gauge
    pub fn increment(&self) {
      self.value.fetch_add(1, Ordering::Relaxed);
    }

    /// Decrement the gauge
    pub fn decrement(&self) {
      self.value.fetch_sub(1, Ordering::Relaxed);
    }

    /// Get the current value
    pub fn get(&self) -> u64 {
      self.value.load(Ordering::Relaxed)
    }
  }

  // Global metrics
  pub static OPEN_BUFFERS: Gauge = Gauge::new();
  pub static OPEN_FILES: Gauge = Gauge::new();
  pub static ACTIVE_LSP_SERVERS: Gauge = Gauge::new();
  pub static IPC_MESSAGES_SENT: Counter = Counter::new();
  pub static IPC_MESSAGES_RECEIVED: Counter = Counter::new();
  pub static ERRORS_TOTAL: Counter = Counter::new();
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_timing_guard() {
    let _guard = TimingGuard::new("test_operation");
    std::thread::sleep(std::time::Duration::from_millis(10));
    // Guard drops here and logs
  }

  #[test]
  fn test_counter() {
    let counter = metrics::Counter::new();
    counter.increment();
    counter.increment();
    counter.add(3);
    assert_eq!(counter.get(), 5);
  }

  #[test]
  fn test_gauge() {
    let gauge = metrics::Gauge::new();
    gauge.set(10);
    gauge.increment();
    gauge.decrement();
    gauge.decrement();
    assert_eq!(gauge.get(), 9);
  }
}
