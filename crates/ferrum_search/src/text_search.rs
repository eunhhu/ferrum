//! Text search using ripgrep-style searching

use ferrum_core::prelude::*;
use ignore::WalkBuilder;
use std::fs;
use std::path::{Path, PathBuf};

/// A text search match
#[derive(Debug, Clone)]
pub struct TextMatch {
    pub path: PathBuf,
    pub line_number: usize,
    pub column: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

/// Search options
#[derive(Debug, Clone, Default)]
pub struct SearchOptions {
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub regex: bool,
    pub max_results: Option<usize>,
}

/// Text searcher
pub struct TextSearcher {
    root: PathBuf,
}

impl TextSearcher {
    /// Create a new text searcher
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    /// Search for text in files
    pub fn search(&self, query: &str, options: &SearchOptions) -> Result<Vec<TextMatch>> {
        let mut results = Vec::new();
        let max = options.max_results.unwrap_or(1000);

        let walker = WalkBuilder::new(&self.root)
            .hidden(false)
            .git_ignore(true)
            .build();

        for entry in walker {
            if results.len() >= max {
                break;
            }

            let entry = entry.map_err(|e| Error::Internal(e.to_string()))?;
            let path = entry.path();

            if !path.is_file() {
                continue;
            }

            // Skip binary files
            if let Some(ext) = path.extension() {
                let ext = ext.to_string_lossy();
                if matches!(
                    ext.as_ref(),
                    "png" | "jpg" | "gif" | "ico" | "woff" | "woff2" | "ttf" | "exe" | "dll" | "so"
                ) {
                    continue;
                }
            }

            if let Ok(content) = fs::read_to_string(path) {
                self.search_in_content(path, &content, query, options, &mut results, max);
            }
        }

        Ok(results)
    }

    fn search_in_content(
        &self,
        path: &Path,
        content: &str,
        query: &str,
        options: &SearchOptions,
        results: &mut Vec<TextMatch>,
        max: usize,
    ) {
        let query_lower = if options.case_sensitive {
            query.to_string()
        } else {
            query.to_lowercase()
        };

        for (line_idx, line) in content.lines().enumerate() {
            if results.len() >= max {
                break;
            }

            let search_line = if options.case_sensitive {
                line.to_string()
            } else {
                line.to_lowercase()
            };

            let mut start = 0;
            while let Some(pos) = search_line[start..].find(&query_lower) {
                if results.len() >= max {
                    break;
                }

                let match_start = start + pos;
                let match_end = match_start + query.len();

                // Check whole word if needed
                if options.whole_word {
                    let before_ok = match_start == 0
                        || !line.chars().nth(match_start - 1).map(|c| c.is_alphanumeric()).unwrap_or(false);
                    let after_ok = match_end >= line.len()
                        || !line.chars().nth(match_end).map(|c| c.is_alphanumeric()).unwrap_or(false);

                    if !before_ok || !after_ok {
                        start = match_start + 1;
                        continue;
                    }
                }

                results.push(TextMatch {
                    path: path.to_path_buf(),
                    line_number: line_idx + 1,
                    column: match_start + 1,
                    line_content: line.to_string(),
                    match_start,
                    match_end,
                });

                start = match_end;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_text_search() {
        let dir = TempDir::new().unwrap();
        fs::write(
            dir.path().join("test.rs"),
            "fn main() {\n    println!(\"Hello\");\n}\n",
        )
        .unwrap();

        let searcher = TextSearcher::new(dir.path());
        let results = searcher.search("Hello", &SearchOptions::default()).unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].line_number, 2);
    }
}
