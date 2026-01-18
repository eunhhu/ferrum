//! Environment variable management commands

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

/// Detected environment variable usage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVariableUsage {
  pub name: String,
  pub file_path: String,
  pub line: usize,
  pub has_value: bool,
}

/// Environment variable info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVariableInfo {
  pub name: String,
  pub value: Option<String>,
  pub is_secret: bool,
  pub usages: Vec<EnvVariableUsage>,
}

/// Scan result for environment variables
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvScanResult {
  pub variables: Vec<EnvVariableInfo>,
  pub env_files: Vec<String>,
  pub missing_in_env: Vec<String>,
  pub unused_in_code: Vec<String>,
}

/// Scan project for environment variable usage
#[tauri::command]
pub async fn scan_env_variables(project_path: String) -> Result<EnvScanResult, String> {
  let project_dir = Path::new(&project_path);

  // 1. Find and parse .env files
  let (env_files, defined_vars) = find_env_files(project_dir)?;

  // 2. Scan source files for env variable usage
  let used_vars = scan_source_files(project_dir)?;

  // 3. Build result
  let mut variables: HashMap<String, EnvVariableInfo> = HashMap::new();

  // Add defined variables
  for (name, value) in &defined_vars {
    variables.insert(
      name.clone(),
      EnvVariableInfo {
        name: name.clone(),
        value: Some(value.clone()),
        is_secret: is_likely_secret(name),
        usages: Vec::new(),
      },
    );
  }

  // Add used variables and their usages
  for usage in used_vars {
    variables
      .entry(usage.name.clone())
      .or_insert(EnvVariableInfo {
        name: usage.name.clone(),
        value: None,
        is_secret: is_likely_secret(&usage.name),
        usages: Vec::new(),
      })
      .usages
      .push(usage);
  }

  // Calculate missing and unused
  let defined_names: HashSet<_> = defined_vars.keys().cloned().collect();
  let used_names: HashSet<_> = variables
    .values()
    .filter(|v| !v.usages.is_empty())
    .map(|v| v.name.clone())
    .collect();

  let missing_in_env: Vec<String> = used_names.difference(&defined_names).cloned().collect();
  let unused_in_code: Vec<String> = defined_names.difference(&used_names).cloned().collect();

  Ok(EnvScanResult {
    variables: variables.into_values().collect(),
    env_files,
    missing_in_env,
    unused_in_code,
  })
}

/// Generate .env.example file content
#[tauri::command]
pub async fn generate_env_example(project_path: String) -> Result<String, String> {
  let result = scan_env_variables(project_path).await?;

  let mut lines: Vec<String> = Vec::new();
  lines.push("# Environment Variables".to_string());
  lines.push("# Copy this file to .env and fill in the values".to_string());
  lines.push(String::new());

  // Group by prefix
  let mut vars: Vec<_> = result.variables.iter().collect();
  vars.sort_by(|a, b| a.name.cmp(&b.name));

  let mut current_prefix = String::new();
  for var in vars {
    // Add section comment for new prefix
    let prefix = var.name.split('_').next().unwrap_or("");
    if prefix != current_prefix && !prefix.is_empty() {
      if !current_prefix.is_empty() {
        lines.push(String::new());
      }
      lines.push(format!("# {}", prefix));
      current_prefix = prefix.to_string();
    }

    // Add variable
    let example_value = if var.is_secret {
      "your-secret-value-here"
    } else {
      var.value.as_deref().unwrap_or("")
    };

    lines.push(format!("{}={}", var.name, example_value));
  }

  Ok(lines.join("\n"))
}

/// Generate TypeScript type definitions for environment variables
#[tauri::command]
pub async fn generate_env_types(project_path: String) -> Result<String, String> {
  let result = scan_env_variables(project_path).await?;

  let mut lines: Vec<String> = Vec::new();
  lines.push("// Auto-generated environment variable types".to_string());
  lines.push("// Do not edit manually".to_string());
  lines.push(String::new());
  lines.push("declare namespace NodeJS {".to_string());
  lines.push("  interface ProcessEnv {".to_string());

  let mut vars: Vec<_> = result.variables.iter().collect();
  vars.sort_by(|a, b| a.name.cmp(&b.name));

  for var in vars {
    let optional = if var.value.is_none() { "?" } else { "" };
    lines.push(format!("    {}{}: string;", var.name, optional));
  }

  lines.push("  }".to_string());
  lines.push("}".to_string());
  lines.push(String::new());
  lines.push("export {};".to_string());

  Ok(lines.join("\n"))
}

/// Write .env.example file
#[tauri::command]
pub async fn write_env_example(project_path: String) -> Result<(), String> {
  let content = generate_env_example(project_path.clone()).await?;
  let path = Path::new(&project_path).join(".env.example");
  fs::write(&path, content).map_err(|e| format!("Failed to write .env.example: {}", e))?;
  Ok(())
}

/// Write env.d.ts file
#[tauri::command]
pub async fn write_env_types(project_path: String) -> Result<(), String> {
  let content = generate_env_types(project_path.clone()).await?;
  let path = Path::new(&project_path).join("env.d.ts");
  fs::write(&path, content).map_err(|e| format!("Failed to write env.d.ts: {}", e))?;
  Ok(())
}

// ========== Helper Functions ==========

fn find_env_files(project_dir: &Path) -> Result<(Vec<String>, HashMap<String, String>), String> {
  let mut env_files = Vec::new();
  let mut vars = HashMap::new();

  let env_file_names = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.test",
  ];

  for name in env_file_names {
    let path = project_dir.join(name);
    if path.exists() {
      env_files.push(name.to_string());

      if let Ok(content) = fs::read_to_string(&path) {
        for line in content.lines() {
          let line = line.trim();
          if line.is_empty() || line.starts_with('#') {
            continue;
          }

          if let Some((key, value)) = line.split_once('=') {
            let key = key.trim().to_string();
            let value = value
              .trim()
              .trim_matches('"')
              .trim_matches('\'')
              .to_string();
            vars.insert(key, value);
          }
        }
      }
    }
  }

  Ok((env_files, vars))
}

fn scan_source_files(project_dir: &Path) -> Result<Vec<EnvVariableUsage>, String> {
  let mut usages = Vec::new();

  // File extensions to scan
  let extensions = ["ts", "tsx", "js", "jsx", "mjs", "cjs", "rs", "py", "go"];

  // Directories to skip
  let skip_dirs = ["node_modules", ".git", "target", "dist", "build", ".next"];

  scan_directory(
    project_dir,
    project_dir,
    &extensions,
    &skip_dirs,
    &mut usages,
  )?;

  Ok(usages)
}

fn scan_directory(
  root: &Path,
  dir: &Path,
  extensions: &[&str],
  skip_dirs: &[&str],
  usages: &mut Vec<EnvVariableUsage>,
) -> Result<(), String> {
  let entries = match fs::read_dir(dir) {
    Ok(e) => e,
    Err(_) => return Ok(()),
  };

  for entry in entries.filter_map(|e| e.ok()) {
    let path = entry.path();

    if path.is_dir() {
      let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
      if !skip_dirs.contains(&dir_name) {
        scan_directory(root, &path, extensions, skip_dirs, usages)?;
      }
    } else if path.is_file() {
      let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
      if extensions.contains(&ext) {
        if let Ok(content) = fs::read_to_string(&path) {
          let relative_path = path.strip_prefix(root).unwrap_or(&path);
          scan_file_content(
            &content,
            relative_path.to_string_lossy().to_string(),
            usages,
          );
        }
      }
    }
  }

  Ok(())
}

fn scan_file_content(content: &str, file_path: String, usages: &mut Vec<EnvVariableUsage>) {
  // Patterns to match environment variable usage
  let patterns = [
    // JavaScript/TypeScript: process.env.VAR_NAME
    r"process\.env\.([A-Z][A-Z0-9_]*)",
    // JavaScript/TypeScript: process.env['VAR_NAME'] or process.env["VAR_NAME"]
    r#"process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]"#,
    // Vite: import.meta.env.VAR_NAME
    r"import\.meta\.env\.([A-Z][A-Z0-9_]*)",
    // Rust: env::var("VAR_NAME") or std::env::var("VAR_NAME")
    r#"env::var\(['"]([A-Z][A-Z0-9_]*)['"]\)"#,
    // Python: os.environ["VAR_NAME"] or os.environ.get("VAR_NAME")
    r#"os\.environ(?:\.get)?\[?['"]([A-Z][A-Z0-9_]*)['"]\]?"#,
    // Go: os.Getenv("VAR_NAME")
    r#"os\.Getenv\(['"]([A-Z][A-Z0-9_]*)['"]\)"#,
  ];

  for (line_num, line) in content.lines().enumerate() {
    for pattern in &patterns {
      if let Ok(re) = regex::Regex::new(pattern) {
        for cap in re.captures_iter(line) {
          if let Some(var_name) = cap.get(1) {
            usages.push(EnvVariableUsage {
              name: var_name.as_str().to_string(),
              file_path: file_path.clone(),
              line: line_num + 1,
              has_value: false,
            });
          }
        }
      }
    }
  }
}

fn is_likely_secret(name: &str) -> bool {
  let secret_patterns = [
    "KEY",
    "SECRET",
    "PASSWORD",
    "TOKEN",
    "PRIVATE",
    "CREDENTIAL",
    "AUTH",
    "API_KEY",
    "ACCESS_KEY",
    "JWT",
  ];

  let upper_name = name.to_uppercase();
  secret_patterns.iter().any(|p| upper_name.contains(p))
}
