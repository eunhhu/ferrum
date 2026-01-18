//! Git Tauri commands

use ferrum_git::{FileStatus, Repository};
use serde::{Deserialize, Serialize};

/// Git file change info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileChange {
  pub path: String,
  pub status: String,
  pub staged: bool,
}

/// Git status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatusResponse {
  pub branch: Option<String>,
  pub upstream: Option<String>,
  pub ahead: usize,
  pub behind: usize,
  pub changes: Vec<GitFileChange>,
  pub is_clean: bool,
}

/// Git commit info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommitInfo {
  pub id: String,
  pub short_id: String,
  pub message: String,
  pub author: String,
  pub email: String,
  pub time: i64,
}

/// Git branch info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranchInfo {
  pub name: String,
  pub is_current: bool,
  pub is_remote: bool,
  pub upstream: Option<String>,
}

#[allow(dead_code)]
fn status_to_string(status: FileStatus) -> String {
  match status {
    FileStatus::Modified => "modified".to_string(),
    FileStatus::Added => "added".to_string(),
    FileStatus::Deleted => "deleted".to_string(),
    FileStatus::Renamed => "renamed".to_string(),
    FileStatus::Copied => "copied".to_string(),
    FileStatus::Untracked => "untracked".to_string(),
    FileStatus::Ignored => "ignored".to_string(),
    FileStatus::Conflicted => "conflicted".to_string(),
  }
}

/// Get git status for a repository
#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatusResponse, String> {
  let repo = Repository::open(&path).map_err(|e| e.to_string())?;

  let inner = repo.inner();

  // Get status
  let statuses = inner
    .statuses(None)
    .map_err(|e| format!("Failed to get status: {}", e))?;

  let mut changes = Vec::new();

  for entry in statuses.iter() {
    let path = entry.path().unwrap_or("").to_string();
    let status = entry.status();

    // Index (staged) changes
    if status.is_index_new() {
      changes.push(GitFileChange {
        path: path.clone(),
        status: "added".to_string(),
        staged: true,
      });
    } else if status.is_index_modified() {
      changes.push(GitFileChange {
        path: path.clone(),
        status: "modified".to_string(),
        staged: true,
      });
    } else if status.is_index_deleted() {
      changes.push(GitFileChange {
        path: path.clone(),
        status: "deleted".to_string(),
        staged: true,
      });
    } else if status.is_index_renamed() {
      changes.push(GitFileChange {
        path: path.clone(),
        status: "renamed".to_string(),
        staged: true,
      });
    }

    // Worktree (unstaged) changes
    if status.is_wt_new() {
      changes.push(GitFileChange {
        path: path.clone(),
        status: "untracked".to_string(),
        staged: false,
      });
    } else if status.is_wt_modified() {
      changes.push(GitFileChange {
        path: path.clone(),
        status: "modified".to_string(),
        staged: false,
      });
    } else if status.is_wt_deleted() {
      changes.push(GitFileChange {
        path: path.clone(),
        status: "deleted".to_string(),
        staged: false,
      });
    }

    if status.is_conflicted() {
      changes.push(GitFileChange {
        path: path.clone(),
        status: "conflicted".to_string(),
        staged: false,
      });
    }
  }

  let branch = repo.current_branch();
  let is_clean = changes.is_empty();

  Ok(GitStatusResponse {
    branch,
    upstream: None, // TODO: Get upstream
    ahead: 0,
    behind: 0,
    changes,
    is_clean,
  })
}

/// Stage a file
#[tauri::command]
pub async fn git_stage(repo_path: String, file_path: String) -> Result<(), String> {
  let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
  let inner = repo.inner();

  let mut index = inner
    .index()
    .map_err(|e| format!("Failed to get index: {}", e))?;
  index
    .add_path(std::path::Path::new(&file_path))
    .map_err(|e| format!("Failed to stage file: {}", e))?;
  index
    .write()
    .map_err(|e| format!("Failed to write index: {}", e))?;

  Ok(())
}

/// Unstage a file
#[tauri::command]
pub async fn git_unstage(repo_path: String, file_path: String) -> Result<(), String> {
  let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
  let inner = repo.inner();

  let head = inner
    .head()
    .map_err(|e| format!("Failed to get HEAD: {}", e))?;
  let head_commit = head
    .peel_to_commit()
    .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;
  let _head_tree = head_commit
    .tree()
    .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;

  inner
    .reset_default(
      Some(&head_commit.as_object()),
      [std::path::Path::new(&file_path)],
    )
    .map_err(|e| format!("Failed to unstage file: {}", e))?;

  Ok(())
}

/// Stage all changes
#[tauri::command]
pub async fn git_stage_all(repo_path: String) -> Result<(), String> {
  let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
  let inner = repo.inner();

  let mut index = inner
    .index()
    .map_err(|e| format!("Failed to get index: {}", e))?;
  index
    .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
    .map_err(|e| format!("Failed to stage all: {}", e))?;
  index
    .write()
    .map_err(|e| format!("Failed to write index: {}", e))?;

  Ok(())
}

/// Commit staged changes
#[tauri::command]
pub async fn git_commit(repo_path: String, message: String) -> Result<GitCommitInfo, String> {
  let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
  let inner = repo.inner();

  // Get signature
  let sig = inner
    .signature()
    .map_err(|e| format!("Failed to get signature: {}", e))?;

  // Get index
  let mut index = inner
    .index()
    .map_err(|e| format!("Failed to get index: {}", e))?;
  let tree_id = index
    .write_tree()
    .map_err(|e| format!("Failed to write tree: {}", e))?;
  let tree = inner
    .find_tree(tree_id)
    .map_err(|e| format!("Failed to find tree: {}", e))?;

  // Get parent commit
  let parent = match inner.head() {
    Ok(head) => Some(
      head
        .peel_to_commit()
        .map_err(|e| format!("Failed to get HEAD commit: {}", e))?,
    ),
    Err(_) => None,
  };

  // Create commit
  let parents: Vec<&git2::Commit> = parent.iter().collect();
  let commit_id = inner
    .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
    .map_err(|e| format!("Failed to create commit: {}", e))?;

  let commit = inner
    .find_commit(commit_id)
    .map_err(|e| format!("Failed to find commit: {}", e))?;

  Ok(GitCommitInfo {
    id: commit_id.to_string(),
    short_id: commit_id.to_string()[..7].to_string(),
    message: message.clone(),
    author: sig.name().unwrap_or("Unknown").to_string(),
    email: sig.email().unwrap_or("").to_string(),
    time: commit.time().seconds(),
  })
}

/// Get recent commits
#[tauri::command]
pub async fn git_log(
  repo_path: String,
  limit: Option<usize>,
) -> Result<Vec<GitCommitInfo>, String> {
  let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
  let inner = repo.inner();

  let mut revwalk = inner
    .revwalk()
    .map_err(|e| format!("Failed to create revwalk: {}", e))?;
  revwalk
    .push_head()
    .map_err(|e| format!("Failed to push HEAD: {}", e))?;

  let limit = limit.unwrap_or(50);
  let mut commits = Vec::new();

  for oid in revwalk.take(limit) {
    let oid = oid.map_err(|e| format!("Failed to get oid: {}", e))?;
    let commit = inner
      .find_commit(oid)
      .map_err(|e| format!("Failed to find commit: {}", e))?;

    commits.push(GitCommitInfo {
      id: oid.to_string(),
      short_id: oid.to_string()[..7].to_string(),
      message: commit.summary().unwrap_or("").to_string(),
      author: commit.author().name().unwrap_or("Unknown").to_string(),
      email: commit.author().email().unwrap_or("").to_string(),
      time: commit.time().seconds(),
    });
  }

  Ok(commits)
}

/// Get branches
#[tauri::command]
pub async fn git_branches(repo_path: String) -> Result<Vec<GitBranchInfo>, String> {
  let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
  let inner = repo.inner();

  let branches = inner
    .branches(None)
    .map_err(|e| format!("Failed to get branches: {}", e))?;

  let current = repo.current_branch();
  let mut result = Vec::new();

  for branch in branches {
    let (branch, branch_type) = branch.map_err(|e| format!("Failed to get branch: {}", e))?;

    let name = branch.name().ok().flatten().unwrap_or("").to_string();
    let is_remote = branch_type == git2::BranchType::Remote;

    result.push(GitBranchInfo {
      name: name.clone(),
      is_current: current.as_ref() == Some(&name),
      is_remote,
      upstream: None,
    });
  }

  Ok(result)
}

/// Checkout a branch
#[tauri::command]
pub async fn git_checkout(repo_path: String, branch: String) -> Result<(), String> {
  let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
  let inner = repo.inner();

  let obj = inner
    .revparse_single(&format!("refs/heads/{}", branch))
    .map_err(|e| format!("Failed to find branch: {}", e))?;

  inner
    .checkout_tree(&obj, None)
    .map_err(|e| format!("Failed to checkout: {}", e))?;

  inner
    .set_head(&format!("refs/heads/{}", branch))
    .map_err(|e| format!("Failed to set HEAD: {}", e))?;

  Ok(())
}

/// Discard changes in a file
#[tauri::command]
pub async fn git_discard(repo_path: String, file_path: String) -> Result<(), String> {
  let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
  let inner = repo.inner();

  let mut opts = git2::build::CheckoutBuilder::new();
  opts.path(&file_path);
  opts.force();

  inner
    .checkout_head(Some(&mut opts))
    .map_err(|e| format!("Failed to discard changes: {}", e))?;

  Ok(())
}

/// Get file diff
#[tauri::command]
pub async fn git_diff_file(
  repo_path: String,
  file_path: String,
  staged: bool,
) -> Result<String, String> {
  let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
  let inner = repo.inner();

  let mut opts = git2::DiffOptions::new();
  opts.pathspec(&file_path);

  let diff = if staged {
    let head = inner.head().ok();
    let tree = head.and_then(|h| h.peel_to_tree().ok());
    inner
      .diff_tree_to_index(tree.as_ref(), None, Some(&mut opts))
      .map_err(|e| format!("Failed to get diff: {}", e))?
  } else {
    inner
      .diff_index_to_workdir(None, Some(&mut opts))
      .map_err(|e| format!("Failed to get diff: {}", e))?
  };

  let mut result = String::new();
  diff
    .print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
      let prefix = match line.origin() {
        '+' => "+",
        '-' => "-",
        ' ' => " ",
        _ => "",
      };
      result.push_str(prefix);
      result.push_str(std::str::from_utf8(line.content()).unwrap_or(""));
      true
    })
    .map_err(|e| format!("Failed to format diff: {}", e))?;

  Ok(result)
}

/// Git blame info for a single line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBlameLineInfo {
  pub line: usize,
  pub commit_id: String,
  pub short_id: String,
  pub author: String,
  pub email: String,
  pub time: i64,
  pub message: String,
}

/// Get git blame for a file
#[tauri::command]
pub async fn git_blame_file(
  repo_path: String,
  file_path: String,
) -> Result<Vec<GitBlameLineInfo>, String> {
  let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
  let inner = repo.inner();

  // Resolve the file path relative to repo root
  let repo_workdir = inner.workdir().ok_or("Not a worktree repository")?;
  let full_path = std::path::Path::new(&repo_path).join(&file_path);
  let relative_path = full_path
    .strip_prefix(repo_workdir)
    .unwrap_or(std::path::Path::new(&file_path));

  // Get blame for the file
  let blame = inner
    .blame_file(relative_path, None)
    .map_err(|e| format!("Failed to get blame: {}", e))?;

  let mut result = Vec::new();
  let mut commit_cache: std::collections::HashMap<git2::Oid, (String, String, String, i64)> =
    std::collections::HashMap::new();

  for (line_idx, hunk) in blame.iter().enumerate() {
    let oid = hunk.final_commit_id();

    // Cache commit info to avoid repeated lookups
    let (author, email, message, time) = if let Some(cached) = commit_cache.get(&oid) {
      cached.clone()
    } else {
      let (author, email, message, time) = match inner.find_commit(oid) {
        Ok(commit) => {
          let author_name = commit.author().name().unwrap_or("Unknown").to_string();
          let author_email = commit.author().email().unwrap_or("").to_string();
          let msg = commit.summary().unwrap_or("").to_string();
          let commit_time = commit.time().seconds();
          (author_name, author_email, msg, commit_time)
        },
        Err(_) => ("Unknown".to_string(), "".to_string(), "".to_string(), 0),
      };
      commit_cache.insert(oid, (author.clone(), email.clone(), message.clone(), time));
      (author, email, message, time)
    };

    result.push(GitBlameLineInfo {
      line: line_idx,
      commit_id: oid.to_string(),
      short_id: oid.to_string().chars().take(7).collect(),
      author,
      email,
      time,
      message,
    });
  }

  Ok(result)
}
