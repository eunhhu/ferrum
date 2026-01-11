//! Git repository wrapper

use ferrum_core::prelude::*;
use git2::Repository as Git2Repo;
use std::path::{Path, PathBuf};

/// Wrapper around git2 repository
pub struct Repository {
  inner: Git2Repo,
  path: PathBuf,
}

impl Repository {
  /// Open a repository at a path
  pub fn open(path: impl AsRef<Path>) -> Result<Self> {
    let path = path.as_ref();
    let inner = Git2Repo::discover(path).map_err(|_e| Error::NotGitRepo {
      path: path.to_path_buf(),
    })?;

    let repo_path = inner
      .workdir()
      .map(|p| p.to_path_buf())
      .unwrap_or_else(|| path.to_path_buf());

    Ok(Self {
      inner,
      path: repo_path,
    })
  }

  /// Get the repository path
  pub fn path(&self) -> &Path {
    &self.path
  }

  /// Get the current branch name
  pub fn current_branch(&self) -> Option<String> {
    let head = self.inner.head().ok()?;
    head.shorthand().map(String::from)
  }

  /// Check if the repository is clean
  pub fn is_clean(&self) -> bool {
    self
      .inner
      .statuses(None)
      .map(|s| s.is_empty())
      .unwrap_or(false)
  }

  /// Get the inner git2 repository (for advanced operations)
  pub fn inner(&self) -> &Git2Repo {
    &self.inner
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_open_nonexistent() {
    let result = Repository::open("/nonexistent/path");
    assert!(result.is_err());
  }
}
