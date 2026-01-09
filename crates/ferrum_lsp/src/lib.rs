//! Ferrum LSP
//!
//! Language Server Protocol client for code intelligence.

pub mod client;
pub mod manager;
pub mod types;

pub use client::LspClient;
pub use manager::LspManager;
