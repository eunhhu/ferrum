//! Terminal Tauri commands

use crate::state::AppState;
use dashmap::DashMap;
use ferrum_terminal::{Pty, PtyEvent, TerminalSize};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::mpsc;

/// Terminal session info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub id: String,
    pub rows: u16,
    pub cols: u16,
    pub cwd: Option<String>,
    pub running: bool,
}

/// Terminal manager to store active terminals
pub struct TerminalManager {
    terminals: DashMap<String, Arc<Pty>>,
    next_id: std::sync::atomic::AtomicU32,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: DashMap::new(),
            next_id: std::sync::atomic::AtomicU32::new(1),
        }
    }

    pub fn create_id(&self) -> String {
        let id = self.next_id.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        format!("terminal-{}", id)
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Create a new terminal session
#[tauri::command]
pub async fn terminal_create(
    app: AppHandle,
    state: State<'_, AppState>,
    cwd: Option<String>,
    shell: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<TerminalInfo, String> {
    let terminal_mgr = app.state::<TerminalManager>();
    let id = terminal_mgr.create_id();

    let size = TerminalSize {
        rows: rows.unwrap_or(24),
        cols: cols.unwrap_or(80),
    };

    let (pty, mut rx) = Pty::new();
    let pty = Arc::new(pty);

    // Spawn the shell
    let cwd_path = cwd.as_ref().map(PathBuf::from);
    pty.spawn(
        shell.as_deref(),
        cwd_path.as_ref(),
        &[],
        size,
    )
    .map_err(|e| e.to_string())?;

    // Store the terminal
    terminal_mgr.terminals.insert(id.clone(), pty.clone());

    // Forward PTY events to frontend
    let id_clone = id.clone();
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                PtyEvent::Output(data) => {
                    // Send data to frontend
                    let _ = app_clone.emit(&format!("terminal-output-{}", id_clone), data);
                }
                PtyEvent::Exit(code) => {
                    let _ = app_clone.emit(&format!("terminal-exit-{}", id_clone), code);
                    break;
                }
                PtyEvent::Error(err) => {
                    let _ = app_clone.emit(&format!("terminal-error-{}", id_clone), err);
                }
            }
        }
    });

    Ok(TerminalInfo {
        id,
        rows: size.rows,
        cols: size.cols,
        cwd,
        running: true,
    })
}

/// Write data to a terminal
#[tauri::command]
pub async fn terminal_write(
    app: AppHandle,
    id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let terminal_mgr = app.state::<TerminalManager>();

    let pty = terminal_mgr
        .terminals
        .get(&id)
        .ok_or_else(|| "Terminal not found".to_string())?;

    pty.write(&data).map_err(|e| e.to_string())
}

/// Resize a terminal
#[tauri::command]
pub async fn terminal_resize(
    app: AppHandle,
    id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let terminal_mgr = app.state::<TerminalManager>();

    let pty = terminal_mgr
        .terminals
        .get(&id)
        .ok_or_else(|| "Terminal not found".to_string())?;

    let size = TerminalSize { rows, cols };
    pty.resize(size).map_err(|e| e.to_string())
}

/// Kill a terminal
#[tauri::command]
pub async fn terminal_kill(
    app: AppHandle,
    id: String,
) -> Result<(), String> {
    let terminal_mgr = app.state::<TerminalManager>();

    if let Some((_, pty)) = terminal_mgr.terminals.remove(&id) {
        pty.kill();
    }

    Ok(())
}

/// Get terminal info
#[tauri::command]
pub fn terminal_info(
    app: AppHandle,
    id: String,
) -> Result<TerminalInfo, String> {
    let terminal_mgr = app.state::<TerminalManager>();

    let pty = terminal_mgr
        .terminals
        .get(&id)
        .ok_or_else(|| "Terminal not found".to_string())?;

    Ok(TerminalInfo {
        id,
        rows: 24, // TODO: Store actual size
        cols: 80,
        cwd: None,
        running: pty.is_running(),
    })
}

/// List all terminals
#[tauri::command]
pub fn terminal_list(app: AppHandle) -> Vec<String> {
    let terminal_mgr = app.state::<TerminalManager>();
    terminal_mgr.terminals.iter().map(|e| e.key().clone()).collect()
}
