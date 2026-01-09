//! Git status types

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Status of a file in git
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FileStatus {
    Modified,
    Added,
    Deleted,
    Renamed,
    Copied,
    Untracked,
    Ignored,
    Conflicted,
}

/// Overall git status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<(PathBuf, FileStatus)>,
    pub unstaged: Vec<(PathBuf, FileStatus)>,
    pub untracked: Vec<PathBuf>,
    pub conflicted: Vec<PathBuf>,
}

impl GitStatus {
    /// Create an empty status
    pub fn empty() -> Self {
        Self {
            branch: None,
            upstream: None,
            ahead: 0,
            behind: 0,
            staged: Vec::new(),
            unstaged: Vec::new(),
            untracked: Vec::new(),
            conflicted: Vec::new(),
        }
    }

    /// Check if the working directory is clean
    pub fn is_clean(&self) -> bool {
        self.staged.is_empty()
            && self.unstaged.is_empty()
            && self.untracked.is_empty()
            && self.conflicted.is_empty()
    }

    /// Get total number of changes
    pub fn change_count(&self) -> usize {
        self.staged.len() + self.unstaged.len() + self.untracked.len() + self.conflicted.len()
    }
}
