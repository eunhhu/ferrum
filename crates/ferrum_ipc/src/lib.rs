//! Ferrum IPC
//!
//! IPC layer for frontend-backend communication using Tauri commands
//! with MessagePack serialization for performance-critical paths.

pub mod commands;
pub mod protocol;
pub mod response;

pub use protocol::{IpcMessage, IpcPayload};
pub use response::{IpcResponse, IpcResult};
