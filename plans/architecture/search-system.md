# Search System 상세 스펙

> **핵심 가치**: "대규모 프로젝트에서도 빠르게 파일과 코드를 찾는다"

## 1. 개요

### 1.1 검색 유형

| 유형 | 설명 | 트리거 |
|------|------|--------|
| **파일 검색** | 파일명으로 빠른 탐색 | `Cmd+P` |
| **텍스트 검색** | 코드 내용 검색 | `Cmd+Shift+F` |
| **심볼 검색** | 함수, 클래스 등 검색 | `Cmd+T` |
| **Command Palette** | 명령어 검색 | `Cmd+Shift+P` |
| **찾기/바꾸기** | 현재 파일 내 | `Cmd+F` / `Cmd+H` |

### 1.2 성능 목표

| 작업 | 목표 시간 |
|------|----------|
| 파일 검색 (첫 결과) | < 50ms |
| 텍스트 검색 (첫 결과) | < 100ms |
| 심볼 검색 (첫 결과) | < 150ms |
| 바꾸기 미리보기 | < 200ms |

---

## 2. 파일 검색 (Quick Open)

### 2.1 인덱싱

```rust
pub struct FileIndex {
    // 모든 파일 경로
    files: Vec<PathBuf>,

    // 파일명 → 인덱스 (빠른 lookup)
    name_index: HashMap<String, Vec<usize>>,

    // 최근 열린 파일 (우선순위 부스트)
    recent_files: VecDeque<PathBuf>,

    // Git 추적 파일만
    git_tracked: Option<HashSet<PathBuf>>,
}

impl FileIndex {
    pub async fn build(root: &Path, config: &SearchConfig) -> Result<Self> {
        let mut files = Vec::new();
        let mut name_index = HashMap::new();

        // ignore 크레이트로 .gitignore 적용
        let walker = ignore::WalkBuilder::new(root)
            .hidden(!config.include_hidden)
            .git_ignore(config.respect_gitignore)
            .build();

        for entry in walker.flatten() {
            if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                let path = entry.path().to_path_buf();
                let idx = files.len();

                // 이름 인덱스 업데이트
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    name_index
                        .entry(name.to_lowercase())
                        .or_insert_with(Vec::new)
                        .push(idx);
                }

                files.push(path);
            }
        }

        Ok(FileIndex {
            files,
            name_index,
            recent_files: VecDeque::new(),
            git_tracked: None,
        })
    }
}
```

### 2.2 Fuzzy 매칭

```rust
use fuzzy_matcher::skim::SkimMatcherV2;

pub struct FileSearcher {
    index: FileIndex,
    matcher: SkimMatcherV2,
}

impl FileSearcher {
    pub fn search(&self, query: &str, limit: usize) -> Vec<FileSearchResult> {
        if query.is_empty() {
            // 빈 쿼리: 최근 파일 반환
            return self.index.recent_files
                .iter()
                .take(limit)
                .map(|p| FileSearchResult {
                    path: p.clone(),
                    score: 1000,
                    match_positions: vec![],
                })
                .collect();
        }

        let mut results: Vec<FileSearchResult> = self.index.files
            .par_iter()  // 병렬 처리
            .filter_map(|path| {
                let path_str = path.to_string_lossy();

                // 경로 전체와 파일명 모두 매칭 시도
                let path_score = self.matcher.fuzzy_match(&path_str, query);
                let name_score = path.file_name()
                    .and_then(|n| n.to_str())
                    .and_then(|n| self.matcher.fuzzy_match(n, query));

                let score = path_score.max(name_score.map(|s| s + 50));  // 파일명 매칭 보너스

                score.map(|s| {
                    // 최근 파일 보너스
                    let recency_bonus = self.get_recency_bonus(path);

                    FileSearchResult {
                        path: path.clone(),
                        score: s + recency_bonus,
                        match_positions: self.get_match_positions(&path_str, query),
                    }
                })
            })
            .collect();

        // 점수순 정렬
        results.sort_by(|a, b| b.score.cmp(&a.score));
        results.truncate(limit);

        results
    }

    fn get_recency_bonus(&self, path: &Path) -> i64 {
        self.index.recent_files
            .iter()
            .position(|p| p == path)
            .map(|pos| 100 - (pos as i64 * 10))  // 최근일수록 높은 보너스
            .unwrap_or(0)
    }
}

pub struct FileSearchResult {
    pub path: PathBuf,
    pub score: i64,
    pub match_positions: Vec<(usize, usize)>,  // (start, end) 쌍
}
```

### 2.3 실시간 결과 스트리밍

```rust
impl FileSearcher {
    pub fn search_streaming(
        &self,
        query: String,
        tx: mpsc::Sender<FileSearchResult>,
    ) {
        // 두 단계로 검색
        // 1. 빠른 결과 (파일명만)
        // 2. 전체 결과 (경로 포함)

        let query_lower = query.to_lowercase();

        // Phase 1: 파일명 정확 매칭 (즉시)
        if let Some(indices) = self.index.name_index.get(&query_lower) {
            for &idx in indices.iter().take(5) {
                let _ = tx.blocking_send(FileSearchResult {
                    path: self.index.files[idx].clone(),
                    score: 2000,  // 정확 매칭 최고 점수
                    match_positions: vec![],
                });
            }
        }

        // Phase 2: Fuzzy 매칭 (백그라운드)
        let results = self.search(&query, 50);
        for result in results {
            let _ = tx.blocking_send(result);
        }
    }
}
```

---

## 3. 텍스트 검색 (ripgrep 통합)

### 3.1 ripgrep Wrapper

```rust
use grep_regex::RegexMatcher;
use grep_searcher::{Searcher, SearcherBuilder, Sink, SinkMatch};

pub struct TextSearcher {
    root: PathBuf,
    config: SearchConfig,
}

pub struct TextSearchQuery {
    pub pattern: String,
    pub is_regex: bool,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub include_patterns: Vec<String>,  // 예: "*.ts"
    pub exclude_patterns: Vec<String>,  // 예: "node_modules"
}

impl TextSearcher {
    pub async fn search(
        &self,
        query: TextSearchQuery,
        tx: mpsc::Sender<TextSearchResult>,
    ) -> Result<SearchStats> {
        let matcher = self.build_matcher(&query)?;
        let mut searcher = SearcherBuilder::new()
            .binary_detection(BinaryDetection::quit(b'\x00'))
            .line_number(true)
            .build();

        let walker = self.build_walker(&query);

        let mut stats = SearchStats::default();

        for entry in walker {
            let entry = entry?;

            if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                continue;
            }

            stats.files_searched += 1;

            let path = entry.path().to_path_buf();
            let tx = tx.clone();

            // 파일별 검색
            let sink = SearchSink::new(path.clone(), tx);
            let result = searcher.search_path(&matcher, &path, sink);

            if let Ok(sink) = result {
                stats.matches_found += sink.match_count;
            }
        }

        Ok(stats)
    }

    fn build_matcher(&self, query: &TextSearchQuery) -> Result<RegexMatcher> {
        let mut pattern = if query.is_regex {
            query.pattern.clone()
        } else {
            regex::escape(&query.pattern)
        };

        if query.whole_word {
            pattern = format!(r"\b{}\b", pattern);
        }

        RegexMatcherBuilder::new()
            .case_insensitive(!query.case_sensitive)
            .build(&pattern)
            .map_err(|e| e.into())
    }

    fn build_walker(&self, query: &TextSearchQuery) -> ignore::Walk {
        let mut builder = ignore::WalkBuilder::new(&self.root);

        builder
            .hidden(!self.config.include_hidden)
            .git_ignore(self.config.respect_gitignore);

        // Include 패턴
        for pattern in &query.include_patterns {
            builder.add_custom_ignore_filename(pattern);
        }

        builder.build()
    }
}

struct SearchSink {
    path: PathBuf,
    tx: mpsc::Sender<TextSearchResult>,
    match_count: usize,
}

impl Sink for SearchSink {
    type Error = std::io::Error;

    fn matched(&mut self, _: &Searcher, mat: &SinkMatch<'_>) -> Result<bool, Self::Error> {
        let line_number = mat.line_number().unwrap_or(0) as u32;
        let line_content = String::from_utf8_lossy(mat.bytes()).to_string();

        let result = TextSearchResult {
            path: self.path.clone(),
            line_number,
            column: 0,  // TODO: 정확한 컬럼 계산
            line_content,
            match_ranges: vec![],  // TODO: 매칭 범위
        };

        let _ = self.tx.blocking_send(result);
        self.match_count += 1;

        Ok(true)  // 계속 검색
    }
}

pub struct TextSearchResult {
    pub path: PathBuf,
    pub line_number: u32,
    pub column: u32,
    pub line_content: String,
    pub match_ranges: Vec<(usize, usize)>,
}

#[derive(Default)]
pub struct SearchStats {
    pub files_searched: usize,
    pub matches_found: usize,
}
```

### 3.2 바꾸기 (Replace)

```rust
pub struct ReplaceOperation {
    pub search_query: TextSearchQuery,
    pub replacement: String,
    pub preview_only: bool,
}

pub struct ReplacePreview {
    pub path: PathBuf,
    pub changes: Vec<LineChange>,
}

pub struct LineChange {
    pub line_number: u32,
    pub old_content: String,
    pub new_content: String,
}

impl TextSearcher {
    pub async fn replace_preview(
        &self,
        op: ReplaceOperation,
    ) -> Result<Vec<ReplacePreview>> {
        let mut previews = Vec::new();
        let matcher = self.build_matcher(&op.search_query)?;

        // 검색 결과 수집
        let (tx, mut rx) = mpsc::channel(1000);
        self.search(op.search_query.clone(), tx).await?;

        // 파일별 그룹화
        let mut file_matches: HashMap<PathBuf, Vec<TextSearchResult>> = HashMap::new();
        while let Some(result) = rx.recv().await {
            file_matches
                .entry(result.path.clone())
                .or_insert_with(Vec::new)
                .push(result);
        }

        // 미리보기 생성
        for (path, matches) in file_matches {
            let changes: Vec<LineChange> = matches
                .iter()
                .map(|m| {
                    let new_content = matcher
                        .replace_all(&m.line_content, &op.replacement)
                        .to_string();

                    LineChange {
                        line_number: m.line_number,
                        old_content: m.line_content.clone(),
                        new_content,
                    }
                })
                .collect();

            previews.push(ReplacePreview { path, changes });
        }

        Ok(previews)
    }

    pub async fn replace_all(&self, op: ReplaceOperation) -> Result<ReplaceStats> {
        let previews = self.replace_preview(ReplaceOperation {
            preview_only: false,
            ..op
        }).await?;

        let mut stats = ReplaceStats::default();

        for preview in previews {
            // 파일 읽기
            let content = tokio::fs::read_to_string(&preview.path).await?;
            let mut lines: Vec<&str> = content.lines().collect();

            // 변경 적용 (역순으로 - 라인 번호 유지)
            for change in preview.changes.iter().rev() {
                let idx = (change.line_number - 1) as usize;
                if idx < lines.len() {
                    lines[idx] = &change.new_content;
                    stats.replacements_made += 1;
                }
            }

            // 파일 쓰기
            let new_content = lines.join("\n");
            tokio::fs::write(&preview.path, new_content).await?;

            stats.files_modified += 1;
        }

        Ok(stats)
    }
}

#[derive(Default)]
pub struct ReplaceStats {
    pub files_modified: usize,
    pub replacements_made: usize,
}
```

---

## 4. 심볼 검색 (LSP 통합)

### 4.1 워크스페이스 심볼

```rust
pub struct SymbolSearcher {
    lsp_manager: Arc<LspManager>,
}

impl SymbolSearcher {
    pub async fn search_workspace_symbols(
        &self,
        query: &str,
    ) -> Result<Vec<SymbolSearchResult>> {
        // 모든 활성 LSP 서버에 요청
        let servers = self.lsp_manager.active_servers();

        let mut results = Vec::new();

        for server in servers {
            if server.capabilities.workspace_symbol_provider.is_some() {
                let symbols = server
                    .workspace_symbol(WorkspaceSymbolParams {
                        query: query.to_string(),
                        ..Default::default()
                    })
                    .await?;

                if let Some(symbols) = symbols {
                    for symbol in symbols {
                        results.push(SymbolSearchResult {
                            name: symbol.name,
                            kind: symbol.kind,
                            location: symbol.location,
                            container_name: symbol.container_name,
                        });
                    }
                }
            }
        }

        // 관련성 정렬
        results.sort_by(|a, b| {
            let a_score = self.score_symbol(a, query);
            let b_score = self.score_symbol(b, query);
            b_score.cmp(&a_score)
        });

        Ok(results)
    }

    fn score_symbol(&self, symbol: &SymbolSearchResult, query: &str) -> i32 {
        let mut score = 0;

        // 정확 매칭
        if symbol.name.eq_ignore_ascii_case(query) {
            score += 1000;
        }

        // 접두사 매칭
        if symbol.name.to_lowercase().starts_with(&query.to_lowercase()) {
            score += 500;
        }

        // 심볼 종류 가중치
        score += match symbol.kind {
            SymbolKind::Class | SymbolKind::Interface => 100,
            SymbolKind::Function | SymbolKind::Method => 80,
            SymbolKind::Variable | SymbolKind::Constant => 60,
            _ => 40,
        };

        score
    }
}

pub struct SymbolSearchResult {
    pub name: String,
    pub kind: SymbolKind,
    pub location: Location,
    pub container_name: Option<String>,
}
```

### 4.2 문서 심볼 (Outline)

```rust
impl SymbolSearcher {
    pub async fn get_document_symbols(
        &self,
        file_path: &Path,
    ) -> Result<Vec<DocumentSymbol>> {
        let uri = Url::from_file_path(file_path)
            .map_err(|_| Error::InvalidPath)?;

        let server = self.lsp_manager
            .server_for_file(file_path)
            .ok_or(Error::NoLspServer)?;

        let symbols = server
            .document_symbol(DocumentSymbolParams {
                text_document: TextDocumentIdentifier { uri },
            })
            .await?;

        match symbols {
            Some(DocumentSymbolResponse::Flat(symbols)) => {
                // 플랫 → 계층 변환
                Ok(self.build_symbol_tree(symbols))
            }
            Some(DocumentSymbolResponse::Nested(symbols)) => {
                Ok(symbols)
            }
            None => Ok(vec![]),
        }
    }
}
```

---

## 5. 현재 파일 찾기/바꾸기

### 5.1 상태 관리

```rust
pub struct FindInFileState {
    pub query: String,
    pub is_regex: bool,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub replacement: Option<String>,

    // 결과
    pub matches: Vec<FindMatch>,
    pub current_match_index: Option<usize>,
}

pub struct FindMatch {
    pub range: Range,
    pub line_content: String,
}

impl FindInFileState {
    pub fn find_all(&mut self, buffer: &TextBuffer) {
        self.matches.clear();

        let pattern = self.build_pattern();
        let text = buffer.text();

        for mat in pattern.find_iter(&text) {
            let start = buffer.offset_to_position(mat.start());
            let end = buffer.offset_to_position(mat.end());

            self.matches.push(FindMatch {
                range: Range { start, end },
                line_content: buffer.line(start.line).to_string(),
            });
        }

        // 커서 근처의 매치로 이동
        self.current_match_index = self.find_nearest_match(buffer.cursor_position());
    }

    pub fn next_match(&mut self) -> Option<&FindMatch> {
        if self.matches.is_empty() {
            return None;
        }

        self.current_match_index = Some(
            (self.current_match_index.unwrap_or(0) + 1) % self.matches.len()
        );

        self.current_match()
    }

    pub fn prev_match(&mut self) -> Option<&FindMatch> {
        if self.matches.is_empty() {
            return None;
        }

        self.current_match_index = Some(
            self.current_match_index
                .map(|i| if i == 0 { self.matches.len() - 1 } else { i - 1 })
                .unwrap_or(self.matches.len() - 1)
        );

        self.current_match()
    }

    pub fn current_match(&self) -> Option<&FindMatch> {
        self.current_match_index
            .and_then(|i| self.matches.get(i))
    }

    pub fn replace_current(&mut self, buffer: &mut TextBuffer) -> Option<()> {
        let replacement = self.replacement.as_ref()?;
        let current = self.current_match()?;

        buffer.edit(Edit {
            range: current.range.clone(),
            text: replacement.clone(),
        });

        // 다시 검색
        self.find_all(buffer);

        Some(())
    }

    pub fn replace_all(&mut self, buffer: &mut TextBuffer) -> usize {
        let replacement = match &self.replacement {
            Some(r) => r.clone(),
            None => return 0,
        };

        let count = self.matches.len();

        // 역순으로 바꾸기 (위치 유지)
        for mat in self.matches.iter().rev() {
            buffer.edit(Edit {
                range: mat.range.clone(),
                text: replacement.clone(),
            });
        }

        self.find_all(buffer);
        count
    }
}
```

### 5.2 UI 컴포넌트

```typescript
function FindWidget(props: { bufferId: string }) {
    const [state, setState] = createStore<FindState>({
        query: '',
        isRegex: false,
        caseSensitive: false,
        wholeWord: false,
        replacement: '',
        showReplace: false,
    });

    const [results, setResults] = createSignal<FindResults | null>(null);

    // 디바운스된 검색
    createEffect(() => {
        const query = state.query;
        if (query.length > 0) {
            invoke('find_in_file', {
                bufferId: props.bufferId,
                query,
                options: {
                    isRegex: state.isRegex,
                    caseSensitive: state.caseSensitive,
                    wholeWord: state.wholeWord,
                }
            }).then(setResults);
        } else {
            setResults(null);
        }
    });

    return (
        <div class="find-widget">
            <div class="find-row">
                <input
                    type="text"
                    placeholder="Find"
                    value={state.query}
                    onInput={(e) => setState('query', e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.shiftKey ? invoke('prev_match') : invoke('next_match');
                        }
                        if (e.key === 'Escape') {
                            invoke('close_find');
                        }
                    }}
                />

                <button
                    class={state.caseSensitive ? 'active' : ''}
                    onClick={() => setState('caseSensitive', !state.caseSensitive)}
                    title="Case Sensitive (Cmd+Alt+C)"
                >
                    Aa
                </button>

                <button
                    class={state.wholeWord ? 'active' : ''}
                    onClick={() => setState('wholeWord', !state.wholeWord)}
                    title="Whole Word (Cmd+Alt+W)"
                >
                    Ab
                </button>

                <button
                    class={state.isRegex ? 'active' : ''}
                    onClick={() => setState('isRegex', !state.isRegex)}
                    title="Regex (Cmd+Alt+R)"
                >
                    .*
                </button>

                <span class="match-count">
                    <Show when={results()} fallback="No results">
                        {results()!.currentIndex + 1} of {results()!.totalMatches}
                    </Show>
                </span>

                <button onClick={() => invoke('prev_match')}>↑</button>
                <button onClick={() => invoke('next_match')}>↓</button>
            </div>

            <Show when={state.showReplace}>
                <div class="replace-row">
                    <input
                        type="text"
                        placeholder="Replace"
                        value={state.replacement}
                        onInput={(e) => setState('replacement', e.target.value)}
                    />

                    <button onClick={() => invoke('replace_current')}>
                        Replace
                    </button>
                    <button onClick={() => invoke('replace_all')}>
                        Replace All
                    </button>
                </div>
            </Show>
        </div>
    );
}
```

---

## 6. Command Palette

### 6.1 명령어 레지스트리

```rust
pub struct CommandRegistry {
    commands: HashMap<CommandId, Command>,
    recent_commands: VecDeque<CommandId>,
}

pub struct Command {
    pub id: CommandId,
    pub title: String,
    pub category: Option<String>,
    pub keybinding: Option<Keybinding>,
    pub handler: Box<dyn CommandHandler>,
}

impl CommandRegistry {
    pub fn search(&self, query: &str) -> Vec<CommandSearchResult> {
        let matcher = SkimMatcherV2::default();

        let mut results: Vec<CommandSearchResult> = self.commands
            .values()
            .filter_map(|cmd| {
                let search_text = match &cmd.category {
                    Some(cat) => format!("{}: {}", cat, cmd.title),
                    None => cmd.title.clone(),
                };

                matcher.fuzzy_match(&search_text, query)
                    .map(|score| {
                        // 최근 사용 보너스
                        let recency_bonus = self.recent_commands
                            .iter()
                            .position(|id| id == &cmd.id)
                            .map(|pos| 50 - pos as i64)
                            .unwrap_or(0);

                        CommandSearchResult {
                            command: cmd.clone(),
                            score: score + recency_bonus,
                        }
                    })
            })
            .collect();

        results.sort_by(|a, b| b.score.cmp(&a.score));
        results
    }
}
```

### 6.2 UI

```typescript
function CommandPalette() {
    const [isOpen, setIsOpen] = createSignal(false);
    const [query, setQuery] = createSignal('');
    const [results, setResults] = createSignal<CommandResult[]>([]);
    const [selectedIndex, setSelectedIndex] = createSignal(0);

    // Cmd+Shift+P로 열기
    createEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.metaKey && e.shiftKey && e.key === 'p') {
                e.preventDefault();
                setIsOpen(true);
            }
        };
        window.addEventListener('keydown', handler);
        onCleanup(() => window.removeEventListener('keydown', handler));
    });

    // 검색
    createEffect(async () => {
        const q = query();
        if (isOpen()) {
            const results = await invoke<CommandResult[]>('search_commands', { query: q });
            setResults(results);
            setSelectedIndex(0);
        }
    });

    const executeSelected = async () => {
        const selected = results()[selectedIndex()];
        if (selected) {
            await invoke('execute_command', { commandId: selected.id });
            setIsOpen(false);
        }
    };

    return (
        <Show when={isOpen()}>
            <div class="command-palette-overlay" onClick={() => setIsOpen(false)}>
                <div class="command-palette" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="text"
                        placeholder="Type a command..."
                        value={query()}
                        onInput={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            switch (e.key) {
                                case 'ArrowDown':
                                    setSelectedIndex(i => Math.min(i + 1, results().length - 1));
                                    break;
                                case 'ArrowUp':
                                    setSelectedIndex(i => Math.max(i - 1, 0));
                                    break;
                                case 'Enter':
                                    executeSelected();
                                    break;
                                case 'Escape':
                                    setIsOpen(false);
                                    break;
                            }
                        }}
                        autofocus
                    />

                    <ul class="results">
                        <For each={results()}>
                            {(result, index) => (
                                <li
                                    class={index() === selectedIndex() ? 'selected' : ''}
                                    onClick={() => {
                                        setSelectedIndex(index());
                                        executeSelected();
                                    }}
                                >
                                    <span class="title">
                                        <Show when={result.category}>
                                            <span class="category">{result.category}:</span>
                                        </Show>
                                        {result.title}
                                    </span>
                                    <Show when={result.keybinding}>
                                        <span class="keybinding">{result.keybinding}</span>
                                    </Show>
                                </li>
                            )}
                        </For>
                    </ul>
                </div>
            </div>
        </Show>
    );
}
```

---

## 7. IPC 메시지

```rust
// Commands
#[tauri::command]
async fn search_files(query: String, limit: u32) -> Vec<FileSearchResult>;

#[tauri::command]
async fn search_text(query: TextSearchQuery) -> SearchStats;

#[tauri::command]
async fn search_symbols(query: String) -> Vec<SymbolSearchResult>;

#[tauri::command]
async fn search_commands(query: String) -> Vec<CommandSearchResult>;

#[tauri::command]
async fn find_in_file(buffer_id: String, query: String, options: FindOptions) -> FindResults;

#[tauri::command]
async fn next_match(buffer_id: String) -> Option<FindMatch>;

#[tauri::command]
async fn prev_match(buffer_id: String) -> Option<FindMatch>;

#[tauri::command]
async fn replace_current(buffer_id: String, replacement: String) -> bool;

#[tauri::command]
async fn replace_all(buffer_id: String, replacement: String) -> u32;

#[tauri::command]
async fn replace_in_files(query: TextSearchQuery, replacement: String, preview: bool)
    -> Result<Vec<ReplacePreview>, String>;

// Events (스트리밍 결과)
enum SearchEvent {
    FileSearchResult(FileSearchResult),
    TextSearchResult(TextSearchResult),
    SearchComplete(SearchStats),
}
```

---

## 8. 설정

```toml
[search]
# 파일 검색
max_file_results = 50
include_hidden_files = false

# 텍스트 검색
max_text_results = 1000
context_lines = 2  # 매칭 전후 보여줄 라인 수

# 제외 패턴
exclude_patterns = [
    "node_modules",
    ".git",
    "dist",
    "build",
    "*.min.js",
]

# 캐시
enable_file_index_cache = true
index_rebuild_interval = "5m"

# 성능
parallel_file_search = true
streaming_results = true
```

---

## 9. 구현 로드맵

### Phase 1: 파일 검색 (Week 1-2)
- [ ] FileIndex 구현
- [ ] Fuzzy 매칭
- [ ] Quick Open UI

### Phase 2: 텍스트 검색 (Week 2-4)
- [ ] ripgrep 통합
- [ ] 결과 스트리밍
- [ ] 검색 패널 UI

### Phase 3: 찾기/바꾸기 (Week 4-5)
- [ ] FindInFileState
- [ ] 바꾸기 미리보기
- [ ] Find Widget UI

### Phase 4: 심볼 검색 (Week 5-6)
- [ ] LSP workspace/symbol
- [ ] Document symbols
- [ ] Go to Symbol UI

### Phase 5: Command Palette (Week 6-7)
- [ ] CommandRegistry
- [ ] Fuzzy 검색
- [ ] Command Palette UI
