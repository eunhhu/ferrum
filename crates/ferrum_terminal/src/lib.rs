//! Ferrum Terminal
//!
//! Terminal emulator integration using portable-pty.

pub mod pty;
pub mod session;

pub use pty::{Pty, PtyEvent, TerminalSize};
pub use session::{TerminalConfig, TerminalSession};
