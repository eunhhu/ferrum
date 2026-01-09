//! Workspace management

use ferrum_core::prelude::*;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// A workspace (project folder)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceFolder {
    pub path: PathBuf,
    pub name: String,
}

/// Workspace state
pub struct Workspace {
    id: WorkspaceId,
    folders: RwLock<Vec<WorkspaceFolder>>,
    settings_path: RwLock<Option<PathBuf>>,
}

impl Workspace {
    /// Create a new empty workspace
    pub fn new() -> Self {
        Self {
            id: WorkspaceId::new(),
            folders: RwLock::new(Vec::new()),
            settings_path: RwLock::new(None),
        }
    }

    /// Create a workspace with a single folder
    pub fn single_folder(path: impl Into<PathBuf>) -> Self {
        let path = path.into();
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Workspace".to_string());

        let workspace = Self::new();
        workspace.add_folder(path, name);
        workspace
    }

    /// Get the workspace ID
    pub fn id(&self) -> WorkspaceId {
        self.id
    }

    /// Add a folder to the workspace
    pub fn add_folder(&self, path: impl Into<PathBuf>, name: impl Into<String>) {
        let folder = WorkspaceFolder {
            path: path.into(),
            name: name.into(),
        };
        self.folders.write().push(folder);
    }

    /// Remove a folder from the workspace
    pub fn remove_folder(&self, path: &PathBuf) -> Option<WorkspaceFolder> {
        let mut folders = self.folders.write();
        if let Some(idx) = folders.iter().position(|f| &f.path == path) {
            Some(folders.remove(idx))
        } else {
            None
        }
    }

    /// Get all folders
    pub fn folders(&self) -> Vec<WorkspaceFolder> {
        self.folders.read().clone()
    }

    /// Get the root folder (first folder)
    pub fn root(&self) -> Option<PathBuf> {
        self.folders.read().first().map(|f| f.path.clone())
    }

    /// Check if a path is within the workspace
    pub fn contains(&self, path: &PathBuf) -> bool {
        self.folders.read().iter().any(|f| path.starts_with(&f.path))
    }

    /// Get relative path within workspace
    pub fn relative_path(&self, path: &PathBuf) -> Option<PathBuf> {
        for folder in self.folders.read().iter() {
            if let Ok(relative) = path.strip_prefix(&folder.path) {
                return Some(relative.to_path_buf());
            }
        }
        None
    }

    /// Check if workspace is empty
    pub fn is_empty(&self) -> bool {
        self.folders.read().is_empty()
    }

    /// Get folder count
    pub fn folder_count(&self) -> usize {
        self.folders.read().len()
    }
}

impl Default for Workspace {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workspace_creation() {
        let workspace = Workspace::single_folder("/home/user/project");

        assert_eq!(workspace.folder_count(), 1);
        assert_eq!(workspace.root(), Some(PathBuf::from("/home/user/project")));
    }

    #[test]
    fn test_workspace_contains() {
        let workspace = Workspace::single_folder("/home/user/project");

        assert!(workspace.contains(&PathBuf::from("/home/user/project/src/main.rs")));
        assert!(!workspace.contains(&PathBuf::from("/home/other/file.rs")));
    }

    #[test]
    fn test_relative_path() {
        let workspace = Workspace::single_folder("/home/user/project");

        let relative = workspace.relative_path(&PathBuf::from("/home/user/project/src/main.rs"));
        assert_eq!(relative, Some(PathBuf::from("src/main.rs")));
    }
}
