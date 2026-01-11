//! Directory walking with ignore support

use ferrum_core::prelude::*;
use ignore::WalkBuilder;
use std::path::{Path, PathBuf};

use crate::file_info::FileInfo;

/// File walker with .gitignore support
pub struct FileWalker {
  root: PathBuf,
  follow_symlinks: bool,
  include_hidden: bool,
  max_depth: Option<usize>,
}

impl FileWalker {
  /// Create a new walker for a directory
  pub fn new(root: impl Into<PathBuf>) -> Self {
    Self {
      root: root.into(),
      follow_symlinks: false,
      include_hidden: false,
      max_depth: None,
    }
  }

  /// Follow symbolic links
  pub fn follow_symlinks(mut self, follow: bool) -> Self {
    self.follow_symlinks = follow;
    self
  }

  /// Include hidden files
  pub fn include_hidden(mut self, include: bool) -> Self {
    self.include_hidden = include;
    self
  }

  /// Set maximum depth
  pub fn max_depth(mut self, depth: usize) -> Self {
    self.max_depth = Some(depth);
    self
  }

  /// Walk the directory and collect files
  pub fn walk(&self) -> Result<Vec<FileInfo>> {
    let mut builder = WalkBuilder::new(&self.root);
    builder
      .follow_links(self.follow_symlinks)
      .hidden(!self.include_hidden)
      .git_ignore(true)
      .git_global(true)
      .git_exclude(true);

    if let Some(depth) = self.max_depth {
      builder.max_depth(Some(depth));
    }

    let mut files = Vec::new();

    for entry in builder.build() {
      let entry = entry.map_err(|e| Error::Internal(format!("Walk error: {}", e)))?;

      if let Ok(info) = FileInfo::from_path(entry.path()) {
        files.push(info);
      }
    }

    Ok(files)
  }

  /// Walk the directory asynchronously with a callback
  pub async fn walk_async<F>(&self, mut callback: F) -> Result<()>
  where
    F: FnMut(FileInfo),
  {
    let files = self.walk()?;
    for file in files {
      callback(file);
    }
    Ok(())
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;
  use tempfile::TempDir;

  #[test]
  fn test_walker() {
    let dir = TempDir::new().unwrap();
    fs::write(dir.path().join("test.txt"), "hello").unwrap();
    fs::create_dir(dir.path().join("subdir")).unwrap();
    fs::write(dir.path().join("subdir/nested.txt"), "world").unwrap();

    let walker = FileWalker::new(dir.path());
    let files = walker.walk().unwrap();

    assert!(files.len() >= 2);
  }
}
