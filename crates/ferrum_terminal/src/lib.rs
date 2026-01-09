//! Ferrum Terminal
//!
//! Terminal emulator integration using portable-pty.

pub mod pty;
pub mod session;

pub use session::TerminalSession;
