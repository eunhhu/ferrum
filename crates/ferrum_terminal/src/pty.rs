//! PTY (Pseudo-Terminal) management
//!
//! Provides portable PTY support for running shell processes.

use ferrum_core::prelude::*;
use parking_lot::Mutex;
use portable_pty::{CommandBuilder, NativePtySystem, PtyPair, PtySize, PtySystem};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use tokio::sync::mpsc;

/// PTY size in rows and columns
#[derive(Debug, Clone, Copy)]
pub struct TerminalSize {
    pub rows: u16,
    pub cols: u16,
}

impl Default for TerminalSize {
    fn default() -> Self {
        Self { rows: 24, cols: 80 }
    }
}

impl From<TerminalSize> for PtySize {
    fn from(size: TerminalSize) -> Self {
        PtySize {
            rows: size.rows,
            cols: size.cols,
            pixel_width: 0,
            pixel_height: 0,
        }
    }
}

/// Events from the PTY
#[derive(Debug, Clone)]
pub enum PtyEvent {
    /// Data received from the PTY
    Output(Vec<u8>),
    /// PTY process exited
    Exit(i32),
    /// PTY error
    Error(String),
}

/// A PTY instance
pub struct Pty {
    pair: Mutex<Option<PtyPair>>,
    writer: Mutex<Option<Box<dyn Write + Send>>>,
    running: AtomicBool,
    event_tx: mpsc::UnboundedSender<PtyEvent>,
}

impl Pty {
    /// Create a new PTY
    pub fn new() -> (Self, mpsc::UnboundedReceiver<PtyEvent>) {
        let (tx, rx) = mpsc::unbounded_channel();

        let pty = Self {
            pair: Mutex::new(None),
            writer: Mutex::new(None),
            running: AtomicBool::new(false),
            event_tx: tx,
        };

        (pty, rx)
    }

    /// Spawn a shell process
    pub fn spawn(
        &self,
        shell: Option<&str>,
        cwd: Option<&PathBuf>,
        env: &[(String, String)],
        size: TerminalSize,
    ) -> Result<()> {
        let pty_system = NativePtySystem::default();

        // Create PTY pair
        let pair = pty_system
            .openpty(size.into())
            .map_err(|e| Error::Internal(format!("Failed to open PTY: {}", e)))?;

        // Determine shell
        let shell_path = shell
            .map(String::from)
            .or_else(|| std::env::var("SHELL").ok())
            .unwrap_or_else(|| {
                if cfg!(windows) {
                    "cmd.exe".to_string()
                } else {
                    "/bin/bash".to_string()
                }
            });

        // Build command
        let mut cmd = CommandBuilder::new(&shell_path);

        // Set working directory
        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }

        // Set environment variables
        for (key, value) in env {
            cmd.env(key, value);
        }

        // Set TERM
        cmd.env("TERM", "xterm-256color");

        // Spawn the process
        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| Error::Internal(format!("Failed to spawn shell: {}", e)))?;

        // Get writer for input
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| Error::Internal(format!("Failed to get PTY writer: {}", e)))?;

        // Get reader for output
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| Error::Internal(format!("Failed to get PTY reader: {}", e)))?;

        // Store handles
        *self.pair.lock() = Some(pair);
        *self.writer.lock() = Some(writer);
        self.running.store(true, Ordering::SeqCst);

        // Start reader thread
        let event_tx = self.event_tx.clone();
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        thread::spawn(move || {
            let mut buf = [0u8; 4096];

            while running_clone.load(Ordering::SeqCst) {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF - process exited
                        let _ = event_tx.send(PtyEvent::Exit(0));
                        break;
                    }
                    Ok(n) => {
                        let _ = event_tx.send(PtyEvent::Output(buf[..n].to_vec()));
                    }
                    Err(e) => {
                        if e.kind() != std::io::ErrorKind::WouldBlock {
                            let _ = event_tx.send(PtyEvent::Error(e.to_string()));
                            break;
                        }
                    }
                }
            }
        });

        // Wait for child in another thread
        let event_tx = self.event_tx.clone();
        thread::spawn(move || {
            match child.wait() {
                Ok(status) => {
                    let code = status.exit_code() as i32;
                    let _ = event_tx.send(PtyEvent::Exit(code));
                }
                Err(e) => {
                    let _ = event_tx.send(PtyEvent::Error(e.to_string()));
                }
            }
            running.store(false, Ordering::SeqCst);
        });

        Ok(())
    }

    /// Write data to the PTY
    pub fn write(&self, data: &[u8]) -> Result<()> {
        let mut writer = self.writer.lock();
        if let Some(ref mut w) = *writer {
            w.write_all(data)
                .map_err(|e| Error::Internal(format!("Failed to write to PTY: {}", e)))?;
            w.flush()
                .map_err(|e| Error::Internal(format!("Failed to flush PTY: {}", e)))?;
        }
        Ok(())
    }

    /// Resize the PTY
    pub fn resize(&self, size: TerminalSize) -> Result<()> {
        let pair = self.pair.lock();
        if let Some(ref p) = *pair {
            p.master
                .resize(size.into())
                .map_err(|e| Error::Internal(format!("Failed to resize PTY: {}", e)))?;
        }
        Ok(())
    }

    /// Check if the PTY is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Kill the PTY process
    pub fn kill(&self) {
        self.running.store(false, Ordering::SeqCst);
        // Drop the pair to close the PTY
        *self.pair.lock() = None;
        *self.writer.lock() = None;
    }
}

impl Drop for Pty {
    fn drop(&mut self) {
        self.kill();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_terminal_size() {
        let size = TerminalSize { rows: 30, cols: 100 };
        let pty_size: PtySize = size.into();
        assert_eq!(pty_size.rows, 30);
        assert_eq!(pty_size.cols, 100);
    }
}
