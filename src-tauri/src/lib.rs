//! Ferrum IDE
//!
//! A high-performance code editor built with Tauri and SolidJS.

mod app;
mod commands;
mod state;

use ferrum_core::telemetry::{self, TelemetryConfig};
use tracing::info;

/// Initialize and run the Tauri application
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize telemetry
    if let Err(e) = telemetry::init(TelemetryConfig::development()) {
        eprintln!("Failed to initialize telemetry: {}", e);
    }

    info!("Starting Ferrum IDE");

    // Build and run the app
    app::build()
        .run(tauri::generate_context!())
        .expect("error while running ferrum");
}
