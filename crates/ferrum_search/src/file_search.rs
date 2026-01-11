//! File search with fuzzy matching

use nucleo::{Config, Matcher, Utf32Str};
use std::path::PathBuf;

/// Result of a file search
#[derive(Debug, Clone)]
pub struct FileMatch {
  pub path: PathBuf,
  pub score: u32,
  pub indices: Vec<u32>,
}

/// File searcher with fuzzy matching
pub struct FileSearcher {
  files: Vec<PathBuf>,
  matcher: Matcher,
}

impl FileSearcher {
  /// Create a new file searcher
  pub fn new() -> Self {
    Self {
      files: Vec::new(),
      matcher: Matcher::new(Config::DEFAULT),
    }
  }

  /// Set the root directory and index all files
  pub fn set_root(&mut self, root: &PathBuf) {
    use ignore::WalkBuilder;

    self.files.clear();

    let walker = WalkBuilder::new(root)
      .hidden(false)
      .git_ignore(true)
      .git_global(true)
      .git_exclude(true)
      .max_depth(Some(20))
      .build();

    for entry in walker.filter_map(Result::ok) {
      if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
        self.files.push(entry.into_path());
      }
    }
  }

  /// Set the file list
  pub fn set_files(&mut self, files: Vec<PathBuf>) {
    self.files = files;
  }

  /// Add a file to the index
  pub fn add_file(&mut self, path: PathBuf) {
    self.files.push(path);
  }

  /// Search for files matching a query
  pub fn search(&mut self, query: &str, limit: usize) -> Vec<FileMatch> {
    if query.is_empty() {
      return self
        .files
        .iter()
        .take(limit)
        .map(|p| FileMatch {
          path: p.clone(),
          score: 0,
          indices: Vec::new(),
        })
        .collect();
    }

    let mut results: Vec<FileMatch> = Vec::new();
    let mut needle_buf = Vec::new();
    let needle = Utf32Str::new(query, &mut needle_buf);

    for path in &self.files {
      let path_str = path.to_string_lossy();
      let mut haystack_buf = Vec::new();
      let haystack = Utf32Str::new(&path_str, &mut haystack_buf);

      let mut indices = Vec::new();
      if let Some(score) = self.matcher.fuzzy_indices(haystack, needle, &mut indices) {
        results.push(FileMatch {
          path: path.clone(),
          score: score as u32,
          indices,
        });
      }
    }

    // Sort by score descending
    results.sort_by(|a, b| b.score.cmp(&a.score));
    results.truncate(limit);

    results
  }
}

impl Default for FileSearcher {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_fuzzy_search() {
    let mut searcher = FileSearcher::new();
    searcher.set_files(vec![
      PathBuf::from("src/main.rs"),
      PathBuf::from("src/lib.rs"),
      PathBuf::from("src/editor/buffer.rs"),
      PathBuf::from("tests/test.rs"),
    ]);

    let results = searcher.search("buf", 10);
    assert!(!results.is_empty());
    assert!(results[0].path.to_string_lossy().contains("buffer"));
  }
}
