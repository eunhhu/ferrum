# Ferrum IDE Architecture

## Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                           Frontend                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                        SolidJS Layer                          │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │  │
│  │  │   Layout    │ │   Editor    │ │       Explorer          │ │  │
│  │  │ Components  │ │    View     │ │       Components        │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                        PixiJS Layer                           │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │  │
│  │  │   Visual    │ │  Preview    │ │       Overlays          │ │  │
│  │  │   Coding    │ │   Canvas    │ │   (highlights, etc)     │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     IPC Bridge (Tauri)                        │  │
│  │  - Commands (Frontend → Backend)                              │  │
│  │  - Events (Backend → Frontend)                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────┤
│                            Backend                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      Core Services                            │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐  │  │
│  │  │  Buffer    │ │    AST     │ │    LSP     │ │  Search   │  │  │
│  │  │  Manager   │ │   Engine   │ │   Client   │ │  Engine   │  │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └───────────┘  │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐  │  │
│  │  │   File     │ │   State    │ │   Index    │ │  Plugin   │  │  │
│  │  │  System    │ │   Store    │ │   Manager  │ │  Runtime  │  │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └───────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      AI Services                              │  │
│  │  ┌────────────────────┐ ┌────────────────────────────────┐   │  │
│  │  │  OpenRouter Client │ │  Local Model Runtime (GGML)    │   │  │
│  │  └────────────────────┘ └────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

### Rust Backend (`src-tauri/`)

```
src-tauri/
├── src/
│   ├── main.rs                 # Entry point
│   ├── lib.rs                  # Library exports
│   ├── app/
│   │   ├── mod.rs
│   │   ├── state.rs            # Global app state
│   │   └── config.rs           # App configuration
│   │
│   ├── core/
│   │   ├── mod.rs
│   │   ├── buffer/
│   │   │   ├── mod.rs
│   │   │   ├── rope.rs         # Rope-based text buffer
│   │   │   ├── piece_table.rs  # Alternative implementation
│   │   │   └── history.rs      # Undo/redo stack
│   │   │
│   │   ├── ast/
│   │   │   ├── mod.rs
│   │   │   ├── parser.rs       # Tree-sitter integration
│   │   │   ├── query.rs        # AST queries
│   │   │   ├── highlight.rs    # Syntax highlighting
│   │   │   └── symbols.rs      # Symbol extraction
│   │   │
│   │   ├── lsp/
│   │   │   ├── mod.rs
│   │   │   ├── client.rs       # LSP client implementation
│   │   │   ├── protocol.rs     # LSP message types
│   │   │   ├── manager.rs      # Server lifecycle
│   │   │   └── servers/        # Bundled LSP configs
│   │   │
│   │   └── search/
│   │       ├── mod.rs
│   │       ├── grep.rs         # Text search (ripgrep-like)
│   │       ├── fuzzy.rs        # Fuzzy matching
│   │       └── index.rs        # Search indexing
│   │
│   ├── services/
│   │   ├── mod.rs
│   │   ├── file_system.rs      # File I/O operations
│   │   ├── workspace.rs        # Workspace management
│   │   ├── git.rs              # Git integration
│   │   ├── env.rs              # Environment variable detection
│   │   └── project.rs          # Project detection & config
│   │
│   ├── index/
│   │   ├── mod.rs
│   │   ├── file_index.rs       # File metadata index
│   │   ├── symbol_index.rs     # Symbol index
│   │   ├── dependency.rs       # Dependency graph
│   │   └── persistence.rs      # Index persistence
│   │
│   ├── ai/
│   │   ├── mod.rs
│   │   ├── openrouter.rs       # OpenRouter API client
│   │   ├── local.rs            # Local model inference
│   │   └── embedding.rs        # Code embeddings
│   │
│   ├── plugin/
│   │   ├── mod.rs
│   │   ├── runtime.rs          # JS runtime (QuickJS)
│   │   ├── api.rs              # Plugin API bindings
│   │   ├── sandbox.rs          # Security sandbox
│   │   └── loader.rs           # Plugin discovery & loading
│   │
│   └── ipc/
│       ├── mod.rs
│       ├── commands.rs         # Tauri command handlers
│       ├── events.rs           # Event emitters
│       └── types.rs            # Shared IPC types
│
├── Cargo.toml
└── tauri.conf.json
```

### Frontend (`src/`)

```
src/
├── index.tsx                   # Entry point
├── App.tsx                     # Root component
│
├── components/
│   ├── layout/
│   │   ├── ActivityBar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── EditorArea.tsx
│   │   ├── Panel.tsx
│   │   ├── StatusBar.tsx
│   │   └── index.ts
│   │
│   ├── editor/
│   │   ├── Editor.tsx          # Main editor component
│   │   ├── EditorTabs.tsx
│   │   ├── EditorLine.tsx      # Single line renderer
│   │   ├── Cursor.tsx          # Cursor component
│   │   ├── Selection.tsx       # Selection highlight
│   │   ├── Gutter.tsx          # Line numbers, folding
│   │   ├── Minimap.tsx         # Structural minimap
│   │   ├── Breadcrumb.tsx      # Navigation breadcrumb
│   │   ├── PeekView.tsx        # Inline definition peek
│   │   └── InlineBlame.tsx     # Git blame overlay
│   │
│   ├── explorer/
│   │   ├── FileExplorer.tsx
│   │   ├── TreeNode.tsx        # Single tree node
│   │   ├── TreeContainer.tsx   # Depth-colored container
│   │   ├── DependencyLine.tsx  # Dependency connection lines
│   │   └── RelatedFiles.tsx    # Related file grouping
│   │
│   ├── panel/
│   │   ├── Terminal.tsx
│   │   ├── Problems.tsx
│   │   ├── Output.tsx
│   │   └── Search.tsx
│   │
│   ├── palette/
│   │   ├── CommandPalette.tsx
│   │   ├── ActionPalette.tsx   # Context action suggestions
│   │   └── QuickOpen.tsx       # File/symbol search
│   │
│   └── visual/
│       ├── VisualEditor.tsx    # PixiJS visual coding canvas
│       ├── PreviewPane.tsx     # Compile-time preview
│       ├── NodeGraph.tsx       # Node-based editor
│       └── Overlay.tsx         # PixiJS overlay layer
│
├── canvas/                     # PixiJS specific
│   ├── Application.ts          # PixiJS app setup
│   ├── nodes/
│   │   ├── BaseNode.ts
│   │   ├── FunctionNode.ts
│   │   ├── ComponentNode.ts
│   │   └── ConnectionLine.ts
│   └── interactions/
│       ├── DragDrop.ts
│       ├── Selection.ts
│       └── Zoom.ts
│
├── ipc/
│   ├── commands.ts             # Backend command callers
│   ├── events.ts               # Event listeners
│   └── types.ts                # TypeScript types for IPC
│
├── stores/                     # Reactive state (from backend)
│   ├── index.ts
│   ├── editor.ts
│   ├── files.ts
│   ├── ui.ts
│   └── sync.ts                 # Backend state sync
│
└── types/
    ├── index.ts
    ├── editor.ts
    ├── buffer.ts
    ├── ast.ts
    └── lsp.ts
```

---

## Core Data Types

### Buffer System

```rust
// src-tauri/src/core/buffer/mod.rs

use ropey::Rope;
use serde::{Deserialize, Serialize};

/// Unique identifier for a buffer
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BufferId(pub u64);

/// Position in a buffer (0-indexed)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub column: u32,
}

/// Range in a buffer
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

/// Selection with direction
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Selection {
    pub anchor: Position,  // Where selection started
    pub head: Position,    // Where cursor is (can be before anchor)
}

impl Selection {
    pub fn is_empty(&self) -> bool {
        self.anchor == self.head
    }

    pub fn to_range(&self) -> Range {
        if self.anchor <= self.head {
            Range { start: self.anchor, end: self.head }
        } else {
            Range { start: self.head, end: self.anchor }
        }
    }
}

/// A single cursor with optional selection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cursor {
    pub selection: Selection,
    pub preferred_column: Option<u32>,  // For vertical movement
}

/// Edit operation for undo/redo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EditOperation {
    Insert {
        position: Position,
        text: String,
    },
    Delete {
        range: Range,
        deleted_text: String,
    },
    Replace {
        range: Range,
        old_text: String,
        new_text: String,
    },
}

/// Edit group for atomic undo/redo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditGroup {
    pub operations: Vec<EditOperation>,
    pub cursors_before: Vec<Cursor>,
    pub cursors_after: Vec<Cursor>,
    pub timestamp: u64,
}

/// Buffer state
pub struct Buffer {
    pub id: BufferId,
    pub file_path: Option<PathBuf>,
    pub rope: Rope,
    pub cursors: Vec<Cursor>,
    pub language: Option<String>,
    pub undo_stack: Vec<EditGroup>,
    pub redo_stack: Vec<EditGroup>,
    pub is_dirty: bool,
    pub version: u64,  // Increments on each edit
}

impl Buffer {
    pub fn new(id: BufferId) -> Self {
        Self {
            id,
            file_path: None,
            rope: Rope::new(),
            cursors: vec![Cursor::default()],
            language: None,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            is_dirty: false,
            version: 0,
        }
    }

    pub fn from_file(id: BufferId, path: PathBuf, content: &str) -> Self {
        let language = detect_language(&path);
        Self {
            id,
            file_path: Some(path),
            rope: Rope::from_str(content),
            cursors: vec![Cursor::default()],
            language,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            is_dirty: false,
            version: 0,
        }
    }

    /// Insert text at position
    pub fn insert(&mut self, pos: Position, text: &str) -> EditOperation {
        let char_idx = self.position_to_char_idx(pos);
        self.rope.insert(char_idx, text);
        self.version += 1;
        self.is_dirty = true;
        
        EditOperation::Insert {
            position: pos,
            text: text.to_string(),
        }
    }

    /// Delete text in range
    pub fn delete(&mut self, range: Range) -> EditOperation {
        let start_idx = self.position_to_char_idx(range.start);
        let end_idx = self.position_to_char_idx(range.end);
        let deleted = self.rope.slice(start_idx..end_idx).to_string();
        self.rope.remove(start_idx..end_idx);
        self.version += 1;
        self.is_dirty = true;

        EditOperation::Delete {
            range,
            deleted_text: deleted,
        }
    }

    /// Get line content
    pub fn line(&self, line_num: u32) -> Option<&str> {
        self.rope.get_line(line_num as usize).map(|l| l.as_str().unwrap_or(""))
    }

    /// Get total line count
    pub fn line_count(&self) -> u32 {
        self.rope.len_lines() as u32
    }

    /// Convert position to character index
    fn position_to_char_idx(&self, pos: Position) -> usize {
        let line_start = self.rope.line_to_char(pos.line as usize);
        line_start + pos.column as usize
    }

    /// Convert character index to position
    fn char_idx_to_position(&self, idx: usize) -> Position {
        let line = self.rope.char_to_line(idx) as u32;
        let line_start = self.rope.line_to_char(line as usize);
        let column = (idx - line_start) as u32;
        Position { line, column }
    }
}

/// Detect language from file extension
fn detect_language(path: &Path) -> Option<String> {
    let ext = path.extension()?.to_str()?;
    let lang = match ext {
        "rs" => "rust",
        "ts" | "tsx" => "typescript",
        "js" | "jsx" => "javascript",
        "py" => "python",
        "go" => "go",
        "c" | "h" => "c",
        "cpp" | "hpp" | "cc" => "cpp",
        "java" => "java",
        "swift" => "swift",
        "kt" | "kts" => "kotlin",
        "rb" => "ruby",
        "php" => "php",
        "zig" => "zig",
        "erl" => "erlang",
        "html" => "html",
        "css" => "css",
        "json" => "json",
        "md" => "markdown",
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        _ => return None,
    };
    Some(lang.to_string())
}
```

### Buffer Manager

```rust
// src-tauri/src/core/buffer/manager.rs

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use parking_lot::RwLock;

pub struct BufferManager {
    buffers: RwLock<HashMap<BufferId, Buffer>>,
    path_to_id: RwLock<HashMap<PathBuf, BufferId>>,
    next_id: AtomicU64,
}

impl BufferManager {
    pub fn new() -> Self {
        Self {
            buffers: RwLock::new(HashMap::new()),
            path_to_id: RwLock::new(HashMap::new()),
            next_id: AtomicU64::new(1),
        }
    }

    /// Create a new empty buffer
    pub fn create(&self) -> BufferId {
        let id = BufferId(self.next_id.fetch_add(1, Ordering::SeqCst));
        let buffer = Buffer::new(id);
        self.buffers.write().insert(id, buffer);
        id
    }

    /// Open a file into a buffer (reuses existing if already open)
    pub fn open_file(&self, path: PathBuf) -> Result<BufferId, std::io::Error> {
        // Check if already open
        if let Some(&id) = self.path_to_id.read().get(&path) {
            return Ok(id);
        }

        // Read file content
        let content = std::fs::read_to_string(&path)?;
        
        let id = BufferId(self.next_id.fetch_add(1, Ordering::SeqCst));
        let buffer = Buffer::from_file(id, path.clone(), &content);
        
        self.buffers.write().insert(id, buffer);
        self.path_to_id.write().insert(path, id);
        
        Ok(id)
    }

    /// Get buffer by ID
    pub fn get(&self, id: BufferId) -> Option<impl std::ops::Deref<Target = Buffer> + '_> {
        let buffers = self.buffers.read();
        if buffers.contains_key(&id) {
            Some(parking_lot::RwLockReadGuard::map(buffers, |b| b.get(&id).unwrap()))
        } else {
            None
        }
    }

    /// Get mutable buffer by ID
    pub fn get_mut(&self, id: BufferId) -> Option<impl std::ops::DerefMut<Target = Buffer> + '_> {
        let buffers = self.buffers.write();
        if buffers.contains_key(&id) {
            Some(parking_lot::RwLockWriteGuard::map(buffers, |b| b.get_mut(&id).unwrap()))
        } else {
            None
        }
    }

    /// Close a buffer
    pub fn close(&self, id: BufferId) -> Option<Buffer> {
        let buffer = self.buffers.write().remove(&id)?;
        if let Some(ref path) = buffer.file_path {
            self.path_to_id.write().remove(path);
        }
        Some(buffer)
    }

    /// Save buffer to its file
    pub fn save(&self, id: BufferId) -> Result<(), std::io::Error> {
        let mut buffers = self.buffers.write();
        let buffer = buffers.get_mut(&id).ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::NotFound, "Buffer not found")
        })?;

        let path = buffer.file_path.as_ref().ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::InvalidInput, "Buffer has no file path")
        })?;

        std::fs::write(path, buffer.rope.to_string())?;
        buffer.is_dirty = false;
        Ok(())
    }

    /// List all open buffers
    pub fn list(&self) -> Vec<BufferInfo> {
        self.buffers
            .read()
            .values()
            .map(|b| BufferInfo {
                id: b.id,
                file_path: b.file_path.clone(),
                is_dirty: b.is_dirty,
                language: b.language.clone(),
            })
            .collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BufferInfo {
    pub id: BufferId,
    pub file_path: Option<PathBuf>,
    pub is_dirty: bool,
    pub language: Option<String>,
}
```

### AST Engine

```rust
// src-tauri/src/core/ast/mod.rs

use tree_sitter::{Parser, Tree, Language, Query, QueryCursor};
use std::collections::HashMap;

/// Supported languages with their tree-sitter parsers
pub struct AstEngine {
    parsers: HashMap<String, Parser>,
    highlight_queries: HashMap<String, Query>,
    trees: HashMap<BufferId, Tree>,
}

impl AstEngine {
    pub fn new() -> Self {
        let mut engine = Self {
            parsers: HashMap::new(),
            highlight_queries: HashMap::new(),
            trees: HashMap::new(),
        };
        
        // Initialize supported languages
        engine.register_language("rust", tree_sitter_rust::language());
        engine.register_language("typescript", tree_sitter_typescript::language_typescript());
        engine.register_language("tsx", tree_sitter_typescript::language_tsx());
        engine.register_language("javascript", tree_sitter_javascript::language());
        engine.register_language("python", tree_sitter_python::language());
        engine.register_language("go", tree_sitter_go::language());
        engine.register_language("c", tree_sitter_c::language());
        engine.register_language("cpp", tree_sitter_cpp::language());
        // ... more languages
        
        engine
    }

    fn register_language(&mut self, name: &str, language: Language) {
        let mut parser = Parser::new();
        parser.set_language(language).expect("Failed to set language");
        self.parsers.insert(name.to_string(), parser);
        
        // Load highlight query for this language
        if let Some(query_str) = self.load_highlight_query(name) {
            if let Ok(query) = Query::new(language, &query_str) {
                self.highlight_queries.insert(name.to_string(), query);
            }
        }
    }

    /// Parse buffer content and store/update tree
    pub fn parse(&mut self, buffer_id: BufferId, content: &str, language: &str) -> Option<&Tree> {
        let parser = self.parsers.get_mut(language)?;
        let old_tree = self.trees.get(&buffer_id);
        
        let tree = parser.parse(content, old_tree)?;
        self.trees.insert(buffer_id, tree);
        self.trees.get(&buffer_id)
    }

    /// Incremental parse after edit
    pub fn parse_incremental(
        &mut self,
        buffer_id: BufferId,
        content: &str,
        language: &str,
        edit: &tree_sitter::InputEdit,
    ) -> Option<&Tree> {
        if let Some(old_tree) = self.trees.get_mut(&buffer_id) {
            old_tree.edit(edit);
        }
        self.parse(buffer_id, content, language)
    }

    /// Get syntax highlights for a range
    pub fn get_highlights(
        &self,
        buffer_id: BufferId,
        language: &str,
        content: &str,
        range: Range,
    ) -> Vec<HighlightSpan> {
        let tree = match self.trees.get(&buffer_id) {
            Some(t) => t,
            None => return vec![],
        };

        let query = match self.highlight_queries.get(language) {
            Some(q) => q,
            None => return vec![],
        };

        let mut cursor = QueryCursor::new();
        let mut highlights = Vec::new();

        // Set range for query
        cursor.set_byte_range(
            self.position_to_byte(content, range.start)..
            self.position_to_byte(content, range.end)
        );

        let matches = cursor.matches(query, tree.root_node(), content.as_bytes());
        
        for m in matches {
            for capture in m.captures {
                let node = capture.node;
                let capture_name = &query.capture_names()[capture.index as usize];
                
                highlights.push(HighlightSpan {
                    range: Range {
                        start: self.byte_to_position(content, node.start_byte()),
                        end: self.byte_to_position(content, node.end_byte()),
                    },
                    scope: capture_name.clone(),
                });
            }
        }

        highlights
    }

    /// Get AST node at position
    pub fn node_at_position(
        &self,
        buffer_id: BufferId,
        content: &str,
        pos: Position,
    ) -> Option<AstNode> {
        let tree = self.trees.get(&buffer_id)?;
        let byte_offset = self.position_to_byte(content, pos);
        
        let node = tree.root_node().descendant_for_byte_range(byte_offset, byte_offset)?;
        
        Some(AstNode {
            kind: node.kind().to_string(),
            range: Range {
                start: self.byte_to_position(content, node.start_byte()),
                end: self.byte_to_position(content, node.end_byte()),
            },
            is_named: node.is_named(),
        })
    }

    /// Expand selection to parent AST node (Smart Selection Expansion)
    pub fn expand_selection(
        &self,
        buffer_id: BufferId,
        content: &str,
        current: Range,
    ) -> Option<Range> {
        let tree = self.trees.get(&buffer_id)?;
        let start_byte = self.position_to_byte(content, current.start);
        let end_byte = self.position_to_byte(content, current.end);
        
        // Find smallest node containing the current selection
        let mut node = tree.root_node().descendant_for_byte_range(start_byte, end_byte)?;
        
        // If selection exactly matches this node, go to parent
        if node.start_byte() == start_byte && node.end_byte() == end_byte {
            node = node.parent()?;
        }
        
        // Skip non-named nodes (syntax tokens)
        while !node.is_named() {
            node = node.parent()?;
        }
        
        Some(Range {
            start: self.byte_to_position(content, node.start_byte()),
            end: self.byte_to_position(content, node.end_byte()),
        })
    }

    /// Extract symbols from buffer (functions, classes, etc.)
    pub fn extract_symbols(&self, buffer_id: BufferId, content: &str) -> Vec<Symbol> {
        let tree = match self.trees.get(&buffer_id) {
            Some(t) => t,
            None => return vec![],
        };

        let mut symbols = Vec::new();
        self.walk_for_symbols(tree.root_node(), content, &mut symbols);
        symbols
    }

    fn walk_for_symbols(
        &self,
        node: tree_sitter::Node,
        content: &str,
        symbols: &mut Vec<Symbol>,
    ) {
        let kind = node.kind();
        
        // Check if this node represents a symbol
        let symbol_kind = match kind {
            "function_definition" | "function_declaration" | "function_item" => Some(SymbolKind::Function),
            "class_definition" | "class_declaration" | "struct_item" => Some(SymbolKind::Class),
            "interface_declaration" | "trait_item" => Some(SymbolKind::Interface),
            "method_definition" | "impl_item" => Some(SymbolKind::Method),
            "variable_declaration" | "const_item" | "static_item" => Some(SymbolKind::Variable),
            "enum_item" | "enum_declaration" => Some(SymbolKind::Enum),
            "type_alias" | "type_item" => Some(SymbolKind::Type),
            _ => None,
        };

        if let Some(sk) = symbol_kind {
            // Try to find the name node
            if let Some(name) = self.find_name_in_node(node, content) {
                symbols.push(Symbol {
                    name,
                    kind: sk,
                    range: Range {
                        start: self.byte_to_position(content, node.start_byte()),
                        end: self.byte_to_position(content, node.end_byte()),
                    },
                    children: Vec::new(), // Populate recursively if needed
                });
            }
        }

        // Recurse into children
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            self.walk_for_symbols(child, content, symbols);
        }
    }

    fn find_name_in_node(&self, node: tree_sitter::Node, content: &str) -> Option<String> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "identifier" || child.kind() == "name" || child.kind().ends_with("_name") {
                return Some(content[child.start_byte()..child.end_byte()].to_string());
            }
        }
        None
    }

    fn position_to_byte(&self, content: &str, pos: Position) -> usize {
        let mut byte = 0;
        for (i, line) in content.lines().enumerate() {
            if i == pos.line as usize {
                return byte + pos.column as usize;
            }
            byte += line.len() + 1; // +1 for newline
        }
        byte
    }

    fn byte_to_position(&self, content: &str, byte: usize) -> Position {
        let mut current_byte = 0;
        for (line_num, line) in content.lines().enumerate() {
            let line_end = current_byte + line.len() + 1;
            if byte < line_end {
                return Position {
                    line: line_num as u32,
                    column: (byte - current_byte) as u32,
                };
            }
            current_byte = line_end;
        }
        Position { line: 0, column: 0 }
    }

    fn load_highlight_query(&self, language: &str) -> Option<String> {
        // Load from embedded resources or files
        // This would be populated with actual highlight queries
        None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightSpan {
    pub range: Range,
    pub scope: String,  // e.g., "keyword", "function", "string"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstNode {
    pub kind: String,
    pub range: Range,
    pub is_named: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Symbol {
    pub name: String,
    pub kind: SymbolKind,
    pub range: Range,
    pub children: Vec<Symbol>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SymbolKind {
    File,
    Module,
    Namespace,
    Package,
    Class,
    Method,
    Property,
    Field,
    Constructor,
    Enum,
    Interface,
    Function,
    Variable,
    Constant,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Key,
    Null,
    EnumMember,
    Struct,
    Event,
    Operator,
    Type,
}
```

### Global App State

```rust
// src-tauri/src/app/state.rs

use std::sync::Arc;
use parking_lot::RwLock;

pub struct AppState {
    pub buffers: Arc<BufferManager>,
    pub ast: Arc<RwLock<AstEngine>>,
    pub lsp: Arc<LspManager>,
    pub search: Arc<SearchEngine>,
    pub index: Arc<IndexManager>,
    pub workspace: Arc<RwLock<WorkspaceState>>,
    pub config: Arc<RwLock<AppConfig>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            buffers: Arc::new(BufferManager::new()),
            ast: Arc::new(RwLock::new(AstEngine::new())),
            lsp: Arc::new(LspManager::new()),
            search: Arc::new(SearchEngine::new()),
            index: Arc::new(IndexManager::new()),
            workspace: Arc::new(RwLock::new(WorkspaceState::default())),
            config: Arc::new(RwLock::new(AppConfig::default())),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WorkspaceState {
    pub root_path: Option<PathBuf>,
    pub open_folders: Vec<PathBuf>,
    pub active_buffer: Option<BufferId>,
    pub recent_files: Vec<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub theme: String,
    pub font_family: String,
    pub font_size: u32,
    pub tab_size: u32,
    pub auto_save: bool,
    pub format_on_save: bool,
    // ... more settings
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            font_family: "JetBrains Mono".to_string(),
            font_size: 14,
            tab_size: 4,
            auto_save: false,
            format_on_save: true,
        }
    }
}
```

---

## IPC Protocol

### Command Definitions

```rust
// src-tauri/src/ipc/commands.rs

use tauri::State;

// ============ Buffer Commands ============

#[tauri::command]
pub async fn buffer_create(state: State<'_, AppState>) -> Result<BufferId, String> {
    Ok(state.buffers.create())
}

#[tauri::command]
pub async fn buffer_open(
    state: State<'_, AppState>,
    path: String,
) -> Result<BufferOpenResult, String> {
    let path = PathBuf::from(path);
    let id = state.buffers.open_file(path.clone()).map_err(|e| e.to_string())?;
    
    let buffer = state.buffers.get(id).ok_or("Buffer not found")?;
    let content = buffer.rope.to_string();
    let language = buffer.language.clone();
    
    // Parse AST
    if let Some(ref lang) = language {
        state.ast.write().parse(id, &content, lang);
    }
    
    Ok(BufferOpenResult {
        id,
        content,
        language,
        line_count: buffer.line_count(),
    })
}

#[tauri::command]
pub async fn buffer_save(
    state: State<'_, AppState>,
    buffer_id: BufferId,
) -> Result<(), String> {
    state.buffers.save(buffer_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn buffer_close(
    state: State<'_, AppState>,
    buffer_id: BufferId,
) -> Result<(), String> {
    state.buffers.close(buffer_id);
    Ok(())
}

#[tauri::command]
pub async fn buffer_edit(
    state: State<'_, AppState>,
    buffer_id: BufferId,
    edits: Vec<EditRequest>,
) -> Result<EditResponse, String> {
    let mut buffer = state.buffers.get_mut(buffer_id).ok_or("Buffer not found")?;
    let mut operations = Vec::new();
    
    for edit in edits {
        let op = match edit {
            EditRequest::Insert { position, text } => {
                buffer.insert(position, &text)
            }
            EditRequest::Delete { range } => {
                buffer.delete(range)
            }
            EditRequest::Replace { range, text } => {
                let old = buffer.rope.slice(
                    buffer.position_to_char_idx(range.start)..
                    buffer.position_to_char_idx(range.end)
                ).to_string();
                buffer.delete(range);
                buffer.insert(range.start, &text);
                EditOperation::Replace {
                    range,
                    old_text: old,
                    new_text: text,
                }
            }
        };
        operations.push(op);
    }
    
    // Update AST incrementally
    if let Some(ref language) = buffer.language {
        let content = buffer.rope.to_string();
        state.ast.write().parse(buffer_id, &content, language);
    }
    
    Ok(EditResponse {
        version: buffer.version,
        operations,
    })
}

// ============ AST Commands ============

#[tauri::command]
pub async fn ast_get_highlights(
    state: State<'_, AppState>,
    buffer_id: BufferId,
    start_line: u32,
    end_line: u32,
) -> Result<Vec<HighlightSpan>, String> {
    let buffer = state.buffers.get(buffer_id).ok_or("Buffer not found")?;
    let language = buffer.language.as_ref().ok_or("No language set")?;
    let content = buffer.rope.to_string();
    
    let range = Range {
        start: Position { line: start_line, column: 0 },
        end: Position { line: end_line, column: u32::MAX },
    };
    
    let highlights = state.ast.read().get_highlights(buffer_id, language, &content, range);
    Ok(highlights)
}

#[tauri::command]
pub async fn ast_expand_selection(
    state: State<'_, AppState>,
    buffer_id: BufferId,
    range: Range,
) -> Result<Option<Range>, String> {
    let buffer = state.buffers.get(buffer_id).ok_or("Buffer not found")?;
    let content = buffer.rope.to_string();
    
    let expanded = state.ast.read().expand_selection(buffer_id, &content, range);
    Ok(expanded)
}

#[tauri::command]
pub async fn ast_get_symbols(
    state: State<'_, AppState>,
    buffer_id: BufferId,
) -> Result<Vec<Symbol>, String> {
    let buffer = state.buffers.get(buffer_id).ok_or("Buffer not found")?;
    let content = buffer.rope.to_string();
    
    let symbols = state.ast.read().extract_symbols(buffer_id, &content);
    Ok(symbols)
}

// ============ File System Commands ============

#[tauri::command]
pub async fn fs_read_dir(
    path: String,
) -> Result<Vec<FileEntry>, String> {
    let path = PathBuf::from(path);
    let mut entries = Vec::new();
    
    for entry in std::fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        
        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            is_symlink: metadata.file_type().is_symlink(),
            size: metadata.len(),
            modified: metadata.modified().ok(),
        });
    }
    
    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(entries)
}

#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

// ============ Search Commands ============

#[tauri::command]
pub async fn search_files(
    state: State<'_, AppState>,
    query: String,
    options: SearchOptions,
) -> Result<Vec<SearchResult>, String> {
    state.search.search_files(&query, &options).await
}

#[tauri::command]
pub async fn search_symbols(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<SymbolSearchResult>, String> {
    state.index.search_symbols(&query).await
}

// ============ LSP Commands ============

#[tauri::command]
pub async fn lsp_hover(
    state: State<'_, AppState>,
    buffer_id: BufferId,
    position: Position,
) -> Result<Option<HoverInfo>, String> {
    let buffer = state.buffers.get(buffer_id).ok_or("Buffer not found")?;
    let path = buffer.file_path.as_ref().ok_or("Buffer has no file")?;
    
    state.lsp.hover(path, position).await
}

#[tauri::command]
pub async fn lsp_completions(
    state: State<'_, AppState>,
    buffer_id: BufferId,
    position: Position,
) -> Result<Vec<CompletionItem>, String> {
    let buffer = state.buffers.get(buffer_id).ok_or("Buffer not found")?;
    let path = buffer.file_path.as_ref().ok_or("Buffer has no file")?;
    
    state.lsp.completions(path, position).await
}

#[tauri::command]
pub async fn lsp_goto_definition(
    state: State<'_, AppState>,
    buffer_id: BufferId,
    position: Position,
) -> Result<Vec<Location>, String> {
    let buffer = state.buffers.get(buffer_id).ok_or("Buffer not found")?;
    let path = buffer.file_path.as_ref().ok_or("Buffer has no file")?;
    
    state.lsp.goto_definition(path, position).await
}

#[tauri::command]
pub async fn lsp_references(
    state: State<'_, AppState>,
    buffer_id: BufferId,
    position: Position,
) -> Result<Vec<Location>, String> {
    let buffer = state.buffers.get(buffer_id).ok_or("Buffer not found")?;
    let path = buffer.file_path.as_ref().ok_or("Buffer has no file")?;
    
    state.lsp.references(path, position).await
}

#[tauri::command]
pub async fn lsp_diagnostics(
    state: State<'_, AppState>,
    buffer_id: BufferId,
) -> Result<Vec<Diagnostic>, String> {
    let buffer = state.buffers.get(buffer_id).ok_or("Buffer not found")?;
    let path = buffer.file_path.as_ref().ok_or("Buffer has no file")?;
    
    state.lsp.get_diagnostics(path).await
}
```

### IPC Types

```rust
// src-tauri/src/ipc/types.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BufferOpenResult {
    pub id: BufferId,
    pub content: String,
    pub language: Option<String>,
    pub line_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum EditRequest {
    Insert { position: Position, text: String },
    Delete { range: Range },
    Replace { range: Range, text: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditResponse {
    pub version: u64,
    pub operations: Vec<EditOperation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified: Option<std::time::SystemTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchOptions {
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub regex: bool,
    pub include_pattern: Option<String>,
    pub exclude_pattern: Option<String>,
    pub max_results: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub line: u32,
    pub column: u32,
    pub text: String,
    pub match_range: Range,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolSearchResult {
    pub name: String,
    pub kind: SymbolKind,
    pub path: String,
    pub range: Range,
    pub container_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoverInfo {
    pub contents: String,
    pub range: Option<Range>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: CompletionItemKind,
    pub detail: Option<String>,
    pub documentation: Option<String>,
    pub insert_text: String,
    pub insert_text_format: InsertTextFormat,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CompletionItemKind {
    Text,
    Method,
    Function,
    Constructor,
    Field,
    Variable,
    Class,
    Interface,
    Module,
    Property,
    Unit,
    Value,
    Enum,
    Keyword,
    Snippet,
    Color,
    File,
    Reference,
    Folder,
    EnumMember,
    Constant,
    Struct,
    Event,
    Operator,
    TypeParameter,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum InsertTextFormat {
    PlainText,
    Snippet,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub path: String,
    pub range: Range,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub range: Range,
    pub severity: DiagnosticSeverity,
    pub message: String,
    pub source: Option<String>,
    pub code: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Information,
    Hint,
}
```

### Event Definitions

```rust
// src-tauri/src/ipc/events.rs

use tauri::{AppHandle, Emitter};

pub struct EventEmitter {
    app: AppHandle,
}

impl EventEmitter {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    /// Emit buffer changed event (for UI sync)
    pub fn buffer_changed(&self, buffer_id: BufferId, changes: &[EditOperation]) {
        let _ = self.app.emit("buffer:changed", BufferChangedEvent {
            buffer_id,
            changes: changes.to_vec(),
        });
    }

    /// Emit diagnostics updated
    pub fn diagnostics_updated(&self, path: &str, diagnostics: &[Diagnostic]) {
        let _ = self.app.emit("diagnostics:updated", DiagnosticsEvent {
            path: path.to_string(),
            diagnostics: diagnostics.to_vec(),
        });
    }

    /// Emit file system change
    pub fn fs_changed(&self, event: FsChangeEvent) {
        let _ = self.app.emit("fs:changed", event);
    }

    /// Emit LSP status change
    pub fn lsp_status(&self, language: &str, status: LspStatus) {
        let _ = self.app.emit("lsp:status", LspStatusEvent {
            language: language.to_string(),
            status,
        });
    }

    /// Emit index progress
    pub fn index_progress(&self, progress: IndexProgress) {
        let _ = self.app.emit("index:progress", progress);
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct BufferChangedEvent {
    pub buffer_id: BufferId,
    pub changes: Vec<EditOperation>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticsEvent {
    pub path: String,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FsChangeEvent {
    pub kind: FsChangeKind,
    pub path: String,
}

#[derive(Debug, Clone, Copy, Serialize)]
pub enum FsChangeKind {
    Created,
    Modified,
    Deleted,
    Renamed,
}

#[derive(Debug, Clone, Serialize)]
pub struct LspStatusEvent {
    pub language: String,
    pub status: LspStatus,
}

#[derive(Debug, Clone, Copy, Serialize)]
pub enum LspStatus {
    Starting,
    Running,
    Stopped,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct IndexProgress {
    pub phase: String,
    pub current: u32,
    pub total: u32,
}
```

---

## Frontend Types (TypeScript)

```typescript
// src/types/buffer.ts

export type BufferId = number;

export interface Position {
  line: number;
  column: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Selection {
  anchor: Position;
  head: Position;
}

export interface Cursor {
  selection: Selection;
  preferredColumn?: number;
}

export type EditOperation =
  | { type: "Insert"; position: Position; text: string }
  | { type: "Delete"; range: Range; deletedText: string }
  | { type: "Replace"; range: Range; oldText: string; newText: string };

export interface BufferOpenResult {
  id: BufferId;
  content: string;
  language: string | null;
  lineCount: number;
}

export interface EditRequest {
  type: "Insert" | "Delete" | "Replace";
  position?: Position;
  range?: Range;
  text?: string;
}

export interface EditResponse {
  version: number;
  operations: EditOperation[];
}
```

```typescript
// src/types/ast.ts

export interface HighlightSpan {
  range: Range;
  scope: string;
}

export interface AstNode {
  kind: string;
  range: Range;
  isNamed: boolean;
}

export interface Symbol {
  name: string;
  kind: SymbolKind;
  range: Range;
  children: Symbol[];
}

export type SymbolKind =
  | "File"
  | "Module"
  | "Namespace"
  | "Package"
  | "Class"
  | "Method"
  | "Property"
  | "Field"
  | "Constructor"
  | "Enum"
  | "Interface"
  | "Function"
  | "Variable"
  | "Constant"
  | "String"
  | "Number"
  | "Boolean"
  | "Array"
  | "Object"
  | "Key"
  | "Null"
  | "EnumMember"
  | "Struct"
  | "Event"
  | "Operator"
  | "Type";
```

```typescript
// src/types/lsp.ts

export interface HoverInfo {
  contents: string;
  range?: Range;
}

export interface CompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText: string;
  insertTextFormat: "PlainText" | "Snippet";
}

export type CompletionItemKind =
  | "Text"
  | "Method"
  | "Function"
  | "Constructor"
  | "Field"
  | "Variable"
  | "Class"
  | "Interface"
  | "Module"
  | "Property"
  | "Unit"
  | "Value"
  | "Enum"
  | "Keyword"
  | "Snippet"
  | "Color"
  | "File"
  | "Reference"
  | "Folder"
  | "EnumMember"
  | "Constant"
  | "Struct"
  | "Event"
  | "Operator"
  | "TypeParameter";

export interface Location {
  path: string;
  range: Range;
}

export interface Diagnostic {
  range: Range;
  severity: DiagnosticSeverity;
  message: string;
  source?: string;
  code?: string;
}

export type DiagnosticSeverity = "Error" | "Warning" | "Information" | "Hint";
```

```typescript
// src/types/fs.ts

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  isSymlink: boolean;
  size: number;
  modified?: string;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  includePattern?: string;
  excludePattern?: string;
  maxResults?: number;
}

export interface SearchResult {
  path: string;
  line: number;
  column: number;
  text: string;
  matchRange: Range;
}

export interface SymbolSearchResult {
  name: string;
  kind: SymbolKind;
  path: string;
  range: Range;
  containerName?: string;
}
```

---

## IPC Bridge (Frontend)

```typescript
// src/ipc/commands.ts

import { invoke } from "@tauri-apps/api/core";
import type {
  BufferId,
  BufferOpenResult,
  EditRequest,
  EditResponse,
  Position,
  Range,
} from "../types/buffer";
import type { HighlightSpan, Symbol } from "../types/ast";
import type {
  FileEntry,
  SearchOptions,
  SearchResult,
  SymbolSearchResult,
} from "../types/fs";
import type {
  HoverInfo,
  CompletionItem,
  Location,
  Diagnostic,
} from "../types/lsp";

// ============ Buffer Commands ============

export const buffer = {
  create: (): Promise<BufferId> => invoke("buffer_create"),

  open: (path: string): Promise<BufferOpenResult> =>
    invoke("buffer_open", { path }),

  save: (bufferId: BufferId): Promise<void> =>
    invoke("buffer_save", { bufferId }),

  close: (bufferId: BufferId): Promise<void> =>
    invoke("buffer_close", { bufferId }),

  edit: (bufferId: BufferId, edits: EditRequest[]): Promise<EditResponse> =>
    invoke("buffer_edit", { bufferId, edits }),
};

// ============ AST Commands ============

export const ast = {
  getHighlights: (
    bufferId: BufferId,
    startLine: number,
    endLine: number
  ): Promise<HighlightSpan[]> =>
    invoke("ast_get_highlights", { bufferId, startLine, endLine }),

  expandSelection: (
    bufferId: BufferId,
    range: Range
  ): Promise<Range | null> =>
    invoke("ast_expand_selection", { bufferId, range }),

  getSymbols: (bufferId: BufferId): Promise<Symbol[]> =>
    invoke("ast_get_symbols", { bufferId }),
};

// ============ File System Commands ============

export const fs = {
  readDir: (path: string): Promise<FileEntry[]> =>
    invoke("fs_read_dir", { path }),

  readFile: (path: string): Promise<string> =>
    invoke("fs_read_file", { path }),

  writeFile: (path: string, content: string): Promise<void> =>
    invoke("fs_write_file", { path, content }),
};

// ============ Search Commands ============

export const search = {
  files: (query: string, options: SearchOptions): Promise<SearchResult[]> =>
    invoke("search_files", { query, options }),

  symbols: (query: string): Promise<SymbolSearchResult[]> =>
    invoke("search_symbols", { query }),
};

// ============ LSP Commands ============

export const lsp = {
  hover: (bufferId: BufferId, position: Position): Promise<HoverInfo | null> =>
    invoke("lsp_hover", { bufferId, position }),

  completions: (
    bufferId: BufferId,
    position: Position
  ): Promise<CompletionItem[]> =>
    invoke("lsp_completions", { bufferId, position }),

  gotoDefinition: (
    bufferId: BufferId,
    position: Position
  ): Promise<Location[]> =>
    invoke("lsp_goto_definition", { bufferId, position }),

  references: (
    bufferId: BufferId,
    position: Position
  ): Promise<Location[]> =>
    invoke("lsp_references", { bufferId, position }),

  diagnostics: (bufferId: BufferId): Promise<Diagnostic[]> =>
    invoke("lsp_diagnostics", { bufferId }),
};
```

```typescript
// src/ipc/events.ts

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { BufferId, EditOperation } from "../types/buffer";
import type { Diagnostic } from "../types/lsp";

export interface BufferChangedEvent {
  bufferId: BufferId;
  changes: EditOperation[];
}

export interface DiagnosticsEvent {
  path: string;
  diagnostics: Diagnostic[];
}

export interface FsChangeEvent {
  kind: "Created" | "Modified" | "Deleted" | "Renamed";
  path: string;
}

export interface LspStatusEvent {
  language: string;
  status: "Starting" | "Running" | "Stopped" | "Error";
}

export interface IndexProgress {
  phase: string;
  current: number;
  total: number;
}

export const events = {
  onBufferChanged: (
    callback: (event: BufferChangedEvent) => void
  ): Promise<UnlistenFn> =>
    listen("buffer:changed", (e) => callback(e.payload as BufferChangedEvent)),

  onDiagnosticsUpdated: (
    callback: (event: DiagnosticsEvent) => void
  ): Promise<UnlistenFn> =>
    listen("diagnostics:updated", (e) =>
      callback(e.payload as DiagnosticsEvent)
    ),

  onFsChanged: (
    callback: (event: FsChangeEvent) => void
  ): Promise<UnlistenFn> =>
    listen("fs:changed", (e) => callback(e.payload as FsChangeEvent)),

  onLspStatus: (
    callback: (event: LspStatusEvent) => void
  ): Promise<UnlistenFn> =>
    listen("lsp:status", (e) => callback(e.payload as LspStatusEvent)),

  onIndexProgress: (
    callback: (event: IndexProgress) => void
  ): Promise<UnlistenFn> =>
    listen("index:progress", (e) => callback(e.payload as IndexProgress)),
};
```

---

## State Synchronization

Frontend는 순수 View이므로, Backend 상태를 구독하고 반영만 함.

```typescript
// src/stores/sync.ts

import { createSignal, onCleanup, onMount } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { events } from "../ipc/events";
import { buffer, ast } from "../ipc/commands";
import type { BufferId, Cursor, Position } from "../types/buffer";
import type { HighlightSpan, Symbol } from "../types/ast";
import type { Diagnostic } from "../types/lsp";

// ============ Editor State (synced from backend) ============

export interface EditorBufferState {
  id: BufferId;
  content: string;
  language: string | null;
  lineCount: number;
  version: number;
  isDirty: boolean;
  cursors: Cursor[];
  highlights: Map<number, HighlightSpan[]>; // line -> highlights
  symbols: Symbol[];
  diagnostics: Diagnostic[];
}

export function createEditorSync(bufferId: BufferId) {
  const [state, setState] = createStore<EditorBufferState>({
    id: bufferId,
    content: "",
    language: null,
    lineCount: 0,
    version: 0,
    isDirty: false,
    cursors: [{ selection: { anchor: { line: 0, column: 0 }, head: { line: 0, column: 0 } } }],
    highlights: new Map(),
    symbols: [],
    diagnostics: [],
  });

  // Subscribe to backend events
  onMount(async () => {
    const unlistenBuffer = await events.onBufferChanged((e) => {
      if (e.bufferId === bufferId) {
        // Apply changes to local state
        // In practice, we'd request updated content from backend
        setState("version", (v) => v + 1);
        setState("isDirty", true);
      }
    });

    const unlistenDiagnostics = await events.onDiagnosticsUpdated((e) => {
      // Match by path - would need to track path
      setState("diagnostics", e.diagnostics);
    });

    onCleanup(() => {
      unlistenBuffer();
      unlistenDiagnostics();
    });
  });

  // Actions that call backend
  const actions = {
    async loadHighlights(startLine: number, endLine: number) {
      const highlights = await ast.getHighlights(bufferId, startLine, endLine);
      // Group by line
      const byLine = new Map<number, HighlightSpan[]>();
      for (const h of highlights) {
        for (let line = h.range.start.line; line <= h.range.end.line; line++) {
          if (!byLine.has(line)) byLine.set(line, []);
          byLine.get(line)!.push(h);
        }
      }
      setState("highlights", reconcile(byLine));
    },

    async loadSymbols() {
      const symbols = await ast.getSymbols(bufferId);
      setState("symbols", symbols);
    },

    async expandSelection() {
      const cursor = state.cursors[0];
      if (!cursor) return;

      const range = {
        start: cursor.selection.anchor,
        end: cursor.selection.head,
      };

      const expanded = await ast.expandSelection(bufferId, range);
      if (expanded) {
        setState("cursors", 0, "selection", {
          anchor: expanded.start,
          head: expanded.end,
        });
      }
    },

    async insertText(text: string) {
      const cursor = state.cursors[0];
      if (!cursor) return;

      await buffer.edit(bufferId, [
        {
          type: "Insert",
          position: cursor.selection.head,
          text,
        },
      ]);
    },

    async deleteSelection() {
      const cursor = state.cursors[0];
      if (!cursor || cursor.selection.anchor === cursor.selection.head) return;

      await buffer.edit(bufferId, [
        {
          type: "Delete",
          range: {
            start: cursor.selection.anchor,
            end: cursor.selection.head,
          },
        },
      ]);
    },

    async save() {
      await buffer.save(bufferId);
      setState("isDirty", false);
    },
  };

  return { state, actions };
}
```

---

## LSP Manager

```rust
// src-tauri/src/core/lsp/manager.rs

use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use parking_lot::RwLock;
use tokio::sync::mpsc;

pub struct LspManager {
    servers: RwLock<HashMap<String, LspServer>>,
    config: LspConfig,
}

pub struct LspServer {
    language: String,
    process: Child,
    sender: mpsc::Sender<LspMessage>,
    capabilities: ServerCapabilities,
}

#[derive(Debug, Clone)]
pub struct LspConfig {
    pub servers: HashMap<String, LspServerConfig>,
}

#[derive(Debug, Clone)]
pub struct LspServerConfig {
    pub command: String,
    pub args: Vec<String>,
    pub initialization_options: Option<serde_json::Value>,
}

impl Default for LspConfig {
    fn default() -> Self {
        let mut servers = HashMap::new();

        // TypeScript/JavaScript
        servers.insert(
            "typescript".to_string(),
            LspServerConfig {
                command: "typescript-language-server".to_string(),
                args: vec!["--stdio".to_string()],
                initialization_options: None,
            },
        );

        // Rust
        servers.insert(
            "rust".to_string(),
            LspServerConfig {
                command: "rust-analyzer".to_string(),
                args: vec![],
                initialization_options: None,
            },
        );

        // Python
        servers.insert(
            "python".to_string(),
            LspServerConfig {
                command: "pyright-langserver".to_string(),
                args: vec!["--stdio".to_string()],
                initialization_options: None,
            },
        );

        // Go
        servers.insert(
            "go".to_string(),
            LspServerConfig {
                command: "gopls".to_string(),
                args: vec![],
                initialization_options: None,
            },
        );

        // C/C++
        servers.insert(
            "c".to_string(),
            LspServerConfig {
                command: "clangd".to_string(),
                args: vec![],
                initialization_options: None,
            },
        );
        servers.insert("cpp".to_string(), servers.get("c").unwrap().clone());

        // Add more...

        Self { servers }
    }
}

impl LspManager {
    pub fn new() -> Self {
        Self {
            servers: RwLock::new(HashMap::new()),
            config: LspConfig::default(),
        }
    }

    /// Start LSP server for a language
    pub async fn start_server(&self, language: &str, workspace_root: &Path) -> Result<(), LspError> {
        if self.servers.read().contains_key(language) {
            return Ok(()); // Already running
        }

        let config = self.config.servers.get(language)
            .ok_or_else(|| LspError::UnsupportedLanguage(language.to_string()))?;

        let mut process = Command::new(&config.command)
            .args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| LspError::SpawnFailed(e.to_string()))?;

        // Set up communication channels
        let (tx, rx) = mpsc::channel(100);

        // Initialize the server
        let initialize_params = InitializeParams {
            process_id: Some(std::process::id()),
            root_uri: Some(Url::from_file_path(workspace_root).unwrap()),
            capabilities: self.client_capabilities(),
            initialization_options: config.initialization_options.clone(),
            ..Default::default()
        };

        // Send initialize request...
        // This is simplified - real implementation would handle JSON-RPC protocol

        let server = LspServer {
            language: language.to_string(),
            process,
            sender: tx,
            capabilities: ServerCapabilities::default(),
        };

        self.servers.write().insert(language.to_string(), server);
        Ok(())
    }

    /// Stop LSP server
    pub async fn stop_server(&self, language: &str) {
        if let Some(mut server) = self.servers.write().remove(language) {
            let _ = server.process.kill();
        }
    }

    /// Get hover information
    pub async fn hover(&self, path: &Path, position: Position) -> Result<Option<HoverInfo>, LspError> {
        let language = detect_language(path).ok_or(LspError::UnknownLanguage)?;
        let server = self.servers.read();
        let server = server.get(&language).ok_or(LspError::ServerNotRunning)?;

        // Send hover request via JSON-RPC
        // This is simplified
        Ok(None)
    }

    /// Get completions
    pub async fn completions(&self, path: &Path, position: Position) -> Result<Vec<CompletionItem>, LspError> {
        let language = detect_language(path).ok_or(LspError::UnknownLanguage)?;
        // ... similar to hover
        Ok(vec![])
    }

    /// Go to definition
    pub async fn goto_definition(&self, path: &Path, position: Position) -> Result<Vec<Location>, LspError> {
        // ...
        Ok(vec![])
    }

    /// Find references
    pub async fn references(&self, path: &Path, position: Position) -> Result<Vec<Location>, LspError> {
        // ...
        Ok(vec![])
    }

    /// Get diagnostics for a file
    pub async fn get_diagnostics(&self, path: &Path) -> Result<Vec<Diagnostic>, LspError> {
        // Diagnostics are typically pushed by the server
        // This would return cached diagnostics
        Ok(vec![])
    }

    fn client_capabilities(&self) -> ClientCapabilities {
        ClientCapabilities {
            text_document: Some(TextDocumentClientCapabilities {
                hover: Some(HoverClientCapabilities {
                    content_format: Some(vec![MarkupKind::Markdown, MarkupKind::PlainText]),
                    ..Default::default()
                }),
                completion: Some(CompletionClientCapabilities {
                    completion_item: Some(CompletionItemCapability {
                        snippet_support: Some(true),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
                // ... more capabilities
                ..Default::default()
            }),
            ..Default::default()
        }
    }
}

#[derive(Debug)]
pub enum LspError {
    UnsupportedLanguage(String),
    UnknownLanguage,
    ServerNotRunning,
    SpawnFailed(String),
    CommunicationError(String),
}
```

---

## Search Engine

```rust
// src-tauri/src/core/search/grep.rs

use std::path::Path;
use ignore::WalkBuilder;
use regex::Regex;
use rayon::prelude::*;

pub struct SearchEngine {
    // Could cache compiled regexes, etc.
}

impl SearchEngine {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn search_files(
        &self,
        query: &str,
        options: &SearchOptions,
    ) -> Result<Vec<SearchResult>, SearchError> {
        let regex = if options.regex {
            Regex::new(query).map_err(|e| SearchError::InvalidRegex(e.to_string()))?
        } else {
            let escaped = regex::escape(query);
            let pattern = if options.whole_word {
                format!(r"\b{}\b", escaped)
            } else {
                escaped
            };
            let pattern = if options.case_sensitive {
                pattern
            } else {
                format!("(?i){}", pattern)
            };
            Regex::new(&pattern).map_err(|e| SearchError::InvalidRegex(e.to_string()))?
        };

        let workspace_root = std::env::current_dir()?;
        let walker = WalkBuilder::new(&workspace_root)
            .hidden(false)
            .git_ignore(true)
            .build();

        let results: Vec<SearchResult> = walker
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
            .par_bridge()
            .flat_map(|entry| {
                self.search_file(entry.path(), &regex, options.max_results)
            })
            .collect();

        Ok(results)
    }

    fn search_file(
        &self,
        path: &Path,
        regex: &Regex,
        max_results: Option<usize>,
    ) -> Vec<SearchResult> {
        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return vec![],
        };

        let mut results = Vec::new();

        for (line_num, line) in content.lines().enumerate() {
            for m in regex.find_iter(line) {
                results.push(SearchResult {
                    path: path.to_string_lossy().to_string(),
                    line: line_num as u32,
                    column: m.start() as u32,
                    text: line.to_string(),
                    match_range: Range {
                        start: Position {
                            line: line_num as u32,
                            column: m.start() as u32,
                        },
                        end: Position {
                            line: line_num as u32,
                            column: m.end() as u32,
                        },
                    },
                });

                if let Some(max) = max_results {
                    if results.len() >= max {
                        return results;
                    }
                }
            }
        }

        results
    }
}

#[derive(Debug)]
pub enum SearchError {
    InvalidRegex(String),
    IoError(std::io::Error),
}

impl From<std::io::Error> for SearchError {
    fn from(e: std::io::Error) -> Self {
        SearchError::IoError(e)
    }
}
```

```rust
// src-tauri/src/core/search/fuzzy.rs

use fuzzy_matcher::skim::SkimMatcherV2;
use fuzzy_matcher::FuzzyMatcher;

pub struct FuzzySearch {
    matcher: SkimMatcherV2,
}

impl FuzzySearch {
    pub fn new() -> Self {
        Self {
            matcher: SkimMatcherV2::default(),
        }
    }

    pub fn score(&self, pattern: &str, text: &str) -> Option<i64> {
        self.matcher.fuzzy_match(text, pattern)
    }

    pub fn search<T, F>(&self, pattern: &str, items: &[T], get_text: F) -> Vec<(usize, i64)>
    where
        F: Fn(&T) -> &str,
    {
        let mut results: Vec<(usize, i64)> = items
            .iter()
            .enumerate()
            .filter_map(|(i, item)| {
                self.score(pattern, get_text(item)).map(|score| (i, score))
            })
            .collect();

        // Sort by score descending
        results.sort_by(|a, b| b.1.cmp(&a.1));
        results
    }
}
```

---

## Index Manager

```rust
// src-tauri/src/index/mod.rs

use std::collections::HashMap;
use std::path::PathBuf;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

pub struct IndexManager {
    file_index: RwLock<FileIndex>,
    symbol_index: RwLock<SymbolIndex>,
    dependency_graph: RwLock<DependencyGraph>,
}

#[derive(Default)]
pub struct FileIndex {
    files: HashMap<PathBuf, FileMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub path: PathBuf,
    pub size: u64,
    pub modified: u64,
    pub language: Option<String>,
    pub symbols: Vec<String>,  // Quick lookup names
}

#[derive(Default)]
pub struct SymbolIndex {
    // Symbol name -> locations
    symbols: HashMap<String, Vec<SymbolLocation>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolLocation {
    pub path: PathBuf,
    pub range: Range,
    pub kind: SymbolKind,
    pub container: Option<String>,
}

#[derive(Default)]
pub struct DependencyGraph {
    // File -> files it imports
    imports: HashMap<PathBuf, Vec<PathBuf>>,
    // File -> files that import it
    imported_by: HashMap<PathBuf, Vec<PathBuf>>,
}

impl IndexManager {
    pub fn new() -> Self {
        Self {
            file_index: RwLock::new(FileIndex::default()),
            symbol_index: RwLock::new(SymbolIndex::default()),
            dependency_graph: RwLock::new(DependencyGraph::default()),
        }
    }

    /// Index a workspace
    pub async fn index_workspace(&self, root: &Path, on_progress: impl Fn(IndexProgress)) {
        // 1. Scan all files
        let files = self.scan_files(root).await;
        on_progress(IndexProgress {
            phase: "Scanning".to_string(),
            current: files.len() as u32,
            total: files.len() as u32,
        });

        // 2. Parse each file for symbols
        for (i, file) in files.iter().enumerate() {
            self.index_file(file).await;
            on_progress(IndexProgress {
                phase: "Indexing".to_string(),
                current: i as u32 + 1,
                total: files.len() as u32,
            });
        }

        // 3. Build dependency graph
        self.build_dependency_graph().await;
        on_progress(IndexProgress {
            phase: "Complete".to_string(),
            current: files.len() as u32,
            total: files.len() as u32,
        });
    }

    /// Search symbols by name
    pub async fn search_symbols(&self, query: &str) -> Result<Vec<SymbolSearchResult>, IndexError> {
        let fuzzy = FuzzySearch::new();
        let symbols = self.symbol_index.read();

        let symbol_names: Vec<&String> = symbols.symbols.keys().collect();
        let matches = fuzzy.search(query, &symbol_names, |s| s.as_str());

        let mut results = Vec::new();
        for (idx, _score) in matches.into_iter().take(50) {
            let name = symbol_names[idx];
            if let Some(locations) = symbols.symbols.get(name) {
                for loc in locations {
                    results.push(SymbolSearchResult {
                        name: name.clone(),
                        kind: loc.kind,
                        path: loc.path.to_string_lossy().to_string(),
                        range: loc.range,
                        container_name: loc.container.clone(),
                    });
                }
            }
        }

        Ok(results)
    }

    /// Get files that depend on a given file
    pub fn get_dependents(&self, path: &Path) -> Vec<PathBuf> {
        self.dependency_graph
            .read()
            .imported_by
            .get(path)
            .cloned()
            .unwrap_or_default()
    }

    /// Get files that a given file depends on
    pub fn get_dependencies(&self, path: &Path) -> Vec<PathBuf> {
        self.dependency_graph
            .read()
            .imports
            .get(path)
            .cloned()
            .unwrap_or_default()
    }

    async fn scan_files(&self, root: &Path) -> Vec<PathBuf> {
        // Use ignore crate to respect .gitignore
        let walker = ignore::WalkBuilder::new(root)
            .hidden(false)
            .git_ignore(true)
            .build();

        walker
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
            .map(|e| e.path().to_path_buf())
            .collect()
    }

    async fn index_file(&self, path: &Path) {
        // Parse file and extract symbols
        // This would use the AST engine
    }

    async fn build_dependency_graph(&self) {
        // Analyze imports/requires/use statements
        // This would parse each file's imports
    }
}

#[derive(Debug)]
pub enum IndexError {
    IoError(std::io::Error),
    ParseError(String),
}
```

---

## Next Steps

이 문서는 Core Architecture를 정의함. 다음 단계:

1. **Feature Spec: Navigation** (`plans/features/navigation.md`)
   - Tree Viewer 상세
   - Tree Fold 상세
   - Navigation Trail 상세
   - Dependency Highlight 상세

2. **Feature Spec: Editor** (`plans/features/editor.md`)
   - 자체 에디터 렌더링
   - 커서/선택 시스템
   - 하이라이팅 파이프라인
   - Minimap

3. **Feature Spec: Visual** (`plans/features/visual.md`)
   - Visual Coding 노드 시스템
   - Compile-time Preview
   - Code/View 모드 전환
