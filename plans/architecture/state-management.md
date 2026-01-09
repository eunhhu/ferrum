# State Management 아키텍처

> **목적**: Ferrum IDE의 전체 상태 관리 설계

## 1. 설계 원칙

### 1.1 핵심 원칙

**Single Source of Truth (Rust Backend)**
```
Frontend (SolidJS): 순수 View, 상태 없음
           ↓ (읽기 전용)
Backend (Rust): 모든 상태 관리
```

**명확한 책임 분리:**
- **Frontend**: 렌더링, 사용자 입력, 애니메이션
- **Backend**: 상태, 로직, 데이터 영속성

### 1.2 Zed vs Ferrum

| 측면 | Zed (GPUI) | Ferrum (Tauri) |
|------|------------|----------------|
| **상태 위치** | Rust (Entity 시스템) | Rust (중앙 AppState) |
| **UI 프레임워크** | GPUI (Rust) | SolidJS (TypeScript) |
| **통신** | 직접 접근 | IPC (Tauri) |
| **반응성** | Effect 시스템 | IPC Events + Signals |

---

## 2. Optimistic Updates (낙관적 업데이트)

### 2.1 핵심 원칙

**Single Source of Truth를 Rust 백엔드에 두는 것은 옳지만, 프론트엔드에서 애니메이션이나 즉각적인 UI 피드백(예: 타이핑 시 커서 이동)은 '낙관적 업데이트(Optimistic Update)'를 적용해야 체감 성능이 극대화됩니다.**

```
┌─────────────────────────────────────────────────────────┐
│                    사용자 입력                            │
│                        ↓                                │
│            ┌──────────────────────┐                     │
│            │  Frontend (SolidJS)  │                     │
│            │  Optimistic State    │ ← 즉시 UI 반영      │
│            └──────────────────────┘                     │
│                   ↓        ↑                            │
│              IPC 요청    확정/롤백                        │
│                   ↓        ↑                            │
│            ┌──────────────────────┐                     │
│            │   Backend (Rust)     │                     │
│            │   Source of Truth    │ ← 최종 검증/저장     │
│            └──────────────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 낙관적 상태 관리자

```typescript
import { createSignal, batch } from 'solid-js';

interface OptimisticOperation<T> {
    id: string;
    optimisticState: T;
    rollbackState: T;
    timestamp: number;
}

export function createOptimisticStore<T>(initialState: T) {
    const [state, setState] = createSignal<T>(initialState);
    const [pendingOps, setPendingOps] = createSignal<OptimisticOperation<T>[]>([]);
    const [isOptimistic, setIsOptimistic] = createSignal(false);

    // 낙관적 업데이트 적용
    const applyOptimistic = <R>(
        opId: string,
        updater: (current: T) => T,
        backendCall: () => Promise<R>,
    ): Promise<R> => {
        const previousState = state();

        // 1. 즉시 UI 업데이트 (낙관적)
        batch(() => {
            setState(updater);
            setIsOptimistic(true);
            setPendingOps(ops => [...ops, {
                id: opId,
                optimisticState: updater(previousState),
                rollbackState: previousState,
                timestamp: Date.now(),
            }]);
        });

        // 2. 백엔드 호출
        return backendCall()
            .then(result => {
                // 성공: 낙관적 상태 확정
                setPendingOps(ops => ops.filter(op => op.id !== opId));
                if (pendingOps().length === 0) {
                    setIsOptimistic(false);
                }
                return result;
            })
            .catch(error => {
                // 실패: 롤백
                console.error('Rollback:', error);
                const op = pendingOps().find(op => op.id === opId);
                if (op) {
                    setState(() => op.rollbackState);
                    setPendingOps(ops => ops.filter(o => o.id !== opId));
                }
                if (pendingOps().length === 0) {
                    setIsOptimistic(false);
                }
                throw error;
            });
    };

    return {
        state,
        setState,
        isOptimistic,
        pendingOps,
        applyOptimistic,
    };
}
```

### 2.3 에디터 타이핑 낙관적 업데이트

```typescript
// 에디터 상태 스토어
interface EditorState {
    content: string;
    cursorPosition: Position;
    selections: Selection[];
    version: number;
}

const editorStore = createOptimisticStore<EditorState>({
    content: '',
    cursorPosition: { line: 0, column: 0 },
    selections: [],
    version: 0,
});

// 타이핑 핸들러
async function handleKeyPress(key: string) {
    const opId = crypto.randomUUID();

    // 낙관적 업데이트: 즉시 화면에 반영
    await editorStore.applyOptimistic(
        opId,
        (state) => {
            const newContent = insertAt(state.content, state.cursorPosition, key);
            return {
                ...state,
                content: newContent,
                cursorPosition: moveCursor(state.cursorPosition, key.length),
                version: state.version + 1,
            };
        },
        // 백엔드 호출 (병렬 처리)
        () => invoke('buffer_insert', {
            bufferId: currentBufferId(),
            position: cursorToOffset(editorStore.state().cursorPosition),
            text: key,
        })
    );
}
```

### 2.4 커서 이동 낙관적 업데이트

```typescript
// 커서 이동은 항상 낙관적으로 처리 (백엔드 검증 불필요한 경우가 많음)
function handleCursorMove(direction: 'up' | 'down' | 'left' | 'right') {
    // 즉시 UI 업데이트
    editorStore.setState(state => ({
        ...state,
        cursorPosition: calculateNewPosition(state.cursorPosition, direction, state.content),
    }));

    // 백엔드에 비동기로 동기화 (fire-and-forget)
    queueMicrotask(() => {
        invoke('editor_cursor_moved', {
            editorId: currentEditorId(),
            position: editorStore.state().cursorPosition,
        });
    });
}
```

### 2.5 선택 영역 낙관적 업데이트

```typescript
// 선택 영역 변경 (Shift + 화살표, 드래그)
function handleSelectionChange(start: Position, end: Position) {
    const opId = crypto.randomUUID();

    editorStore.applyOptimistic(
        opId,
        (state) => ({
            ...state,
            selections: [{ start, end }],
        }),
        () => invoke('editor_select', {
            editorId: currentEditorId(),
            selections: [{ start, end }],
        })
    );
}
```

### 2.6 롤백 시각화

```typescript
// 롤백 발생 시 사용자에게 시각적 피드백
function OptimisticIndicator() {
    return (
        <Show when={editorStore.isOptimistic()}>
            <div class="optimistic-indicator" title="Syncing...">
                <span class="sync-icon">⟳</span>
            </div>
        </Show>
    );
}

// CSS
// .optimistic-indicator {
//     position: absolute;
//     top: 4px;
//     right: 4px;
//     opacity: 0.7;
//     animation: spin 1s linear infinite;
// }
```

### 2.7 배치 낙관적 업데이트 (붙여넣기 등)

```typescript
// 대량 텍스트 붙여넣기
async function handlePaste(text: string) {
    const opId = crypto.randomUUID();

    // 긴 텍스트는 청크 단위로 낙관적 업데이트
    const CHUNK_SIZE = 1000;

    if (text.length > CHUNK_SIZE) {
        // 첫 청크만 즉시 표시
        const firstChunk = text.slice(0, CHUNK_SIZE);
        editorStore.setState(state => ({
            ...state,
            content: insertAt(state.content, state.cursorPosition, firstChunk),
            cursorPosition: moveCursor(state.cursorPosition, firstChunk.length),
        }));

        // 전체 텍스트는 백엔드에서 처리
        const result = await invoke('buffer_insert', {
            bufferId: currentBufferId(),
            position: cursorToOffset(editorStore.state().cursorPosition),
            text: text,
        });

        // 백엔드 결과로 상태 동기화
        editorStore.setState(state => ({
            ...state,
            content: result.content,
            cursorPosition: result.cursorPosition,
            version: result.version,
        }));
    } else {
        // 짧은 텍스트는 일반 낙관적 업데이트
        await editorStore.applyOptimistic(
            opId,
            (state) => ({
                ...state,
                content: insertAt(state.content, state.cursorPosition, text),
                cursorPosition: moveCursor(state.cursorPosition, text.length),
            }),
            () => invoke('buffer_insert', {
                bufferId: currentBufferId(),
                position: cursorToOffset(editorStore.state().cursorPosition),
                text,
            })
        );
    }
}
```

### 2.8 성능 벤치마크

| 시나리오 | 낙관적 업데이트 없음 | 낙관적 업데이트 적용 |
|----------|---------------------|---------------------|
| 키 입력 → 화면 반영 | ~30ms (IPC 대기) | ~2ms (즉시) |
| 커서 이동 반응 | ~20ms | ~1ms |
| 선택 드래그 | 60fps 불가 | 120fps 가능 |
| 체감 반응성 | 약간 느림 | 네이티브급 |

---

## 3. AppState 구조

### 3.1 최상위 구조

```rust
pub struct AppState {
    // 버퍼 관리
    buffer_manager: BufferManager,

    // 에디터 인스턴스
    editors: HashMap<EditorId, Editor>,

    // LSP 관리
    lsp_manager: LspManager,

    // 프로젝트 관리
    project_manager: ProjectManager,

    // 워크스페이스 레이아웃
    workspace: Workspace,

    // 파일 시스템
    fs: Arc<dyn FileSystem>,

    // 테마
    theme_manager: ThemeManager,

    // 검색
    search_manager: SearchManager,

    // 설정
    config: Config,

    // Git 통합
    git_manager: GitManager,

    // 플러그인
    plugin_manager: PluginManager,
}

// Tauri State로 래핑
type SharedAppState = Arc<Mutex<AppState>>;
```

### 2.2 초기화

```rust
impl AppState {
    pub fn new() -> Self {
        AppState {
            buffer_manager: BufferManager::new(),
            editors: HashMap::new(),
            lsp_manager: LspManager::new(),
            project_manager: ProjectManager::new(),
            workspace: Workspace::new(),
            fs: Arc::new(RealFileSystem::new()),
            theme_manager: ThemeManager::new(),
            search_manager: SearchManager::new(),
            config: Config::load_or_default(),
            git_manager: GitManager::new(),
            plugin_manager: PluginManager::new(),
        }
    }

    pub async fn initialize(&mut self, app_handle: AppHandle) -> Result<()> {
        // 1. 설정 로드
        self.config = Config::load()?;

        // 2. 테마 로드
        self.theme_manager.load_themes()?;

        // 3. LSP 서버 초기화
        self.lsp_manager.initialize()?;

        // 4. 플러그인 로드
        self.plugin_manager.load_plugins().await?;

        // 5. 최근 프로젝트 복원 (설정에 따라)
        if self.config.restore_last_project {
            self.restore_last_project().await?;
        }

        Ok(())
    }
}
```

---

## 3. BufferManager (텍스트 버퍼 관리)

### 3.1 구조

```rust
pub struct BufferManager {
    // 열린 버퍼들
    buffers: HashMap<BufferId, Arc<Mutex<TextBuffer>>>,

    // 경로 → 버퍼 ID 매핑
    path_to_buffer: HashMap<PathBuf, BufferId>,

    // 다음 버퍼 ID
    next_id: BufferId,

    // 더티 버퍼 추적
    dirty_buffers: HashSet<BufferId>,
}

impl BufferManager {
    pub fn open_file(&mut self, path: PathBuf) -> Result<BufferId> {
        // 이미 열린 경우
        if let Some(buffer_id) = self.path_to_buffer.get(&path) {
            return Ok(*buffer_id);
        }

        // 파일 읽기
        let content = std::fs::read_to_string(&path)?;

        // 버퍼 생성
        let buffer_id = self.next_id;
        self.next_id.0 += 1;

        let mut buffer = TextBuffer::new();
        buffer.set_text(&content);
        buffer.set_path(Some(path.clone()));

        // 언어 감지
        let language = detect_language(&path);
        buffer.set_language(language);

        // 저장
        self.buffers.insert(buffer_id, Arc::new(Mutex::new(buffer)));
        self.path_to_buffer.insert(path, buffer_id);

        Ok(buffer_id)
    }

    pub fn close_buffer(&mut self, buffer_id: BufferId) {
        if let Some(buffer) = self.buffers.remove(&buffer_id) {
            if let Some(path) = buffer.lock().unwrap().path() {
                self.path_to_buffer.remove(path);
            }
        }
        self.dirty_buffers.remove(&buffer_id);
    }

    pub fn get_buffer(&self, buffer_id: BufferId) -> Option<Arc<Mutex<TextBuffer>>> {
        self.buffers.get(&buffer_id).cloned()
    }

    pub fn save_buffer(&mut self, buffer_id: BufferId) -> Result<PathBuf> {
        let buffer = self.get_buffer(buffer_id)
            .ok_or_else(|| anyhow::anyhow!("Buffer not found"))?;

        let buffer = buffer.lock().unwrap();
        let path = buffer.path()
            .ok_or_else(|| anyhow::anyhow!("Buffer has no path"))?;

        std::fs::write(path, buffer.text())?;

        self.dirty_buffers.remove(&buffer_id);

        Ok(path.clone())
    }

    pub fn mark_dirty(&mut self, buffer_id: BufferId) {
        self.dirty_buffers.insert(buffer_id);
    }

    pub fn is_dirty(&self, buffer_id: BufferId) -> bool {
        self.dirty_buffers.contains(&buffer_id)
    }
}
```

---

## 4. Editor (에디터 인스턴스)

### 4.1 구조

```rust
pub struct Editor {
    id: EditorId,
    buffer_id: BufferId,

    // DisplayMap (좌표 변환)
    display_map: DisplayMap,

    // 선택
    selections: SelectionSet,
    anchor_set: AnchorSet,

    // 히스토리
    edit_history: EditHistory,
    selection_history: SelectionHistory,

    // 스크롤
    scroll_offset: DisplayPosition,
    viewport_height: u32,
    viewport_width: u32,

    // 설정
    tab_size: u32,
    wrap_width: Option<u32>,
    show_line_numbers: bool,
    show_minimap: bool,

    // 캐시
    cache: EditorCache,

    // 상태
    mode: EditorMode,
    read_only: bool,
}

pub enum EditorMode {
    Normal,
    Insert,
    Visual,
}

impl Editor {
    pub fn new(buffer_id: BufferId) -> Self {
        Editor {
            id: EditorId::new(),
            buffer_id,
            display_map: DisplayMap::new(buffer_id),
            selections: SelectionSet::new(),
            anchor_set: AnchorSet::new(buffer_id),
            edit_history: EditHistory::new(),
            selection_history: SelectionHistory::new(),
            scroll_offset: DisplayPosition { line: 0, column: 0 },
            viewport_height: 0,
            viewport_width: 0,
            tab_size: 4,
            wrap_width: None,
            show_line_numbers: true,
            show_minimap: true,
            cache: EditorCache::new(),
            mode: EditorMode::Normal,
            read_only: false,
        }
    }

    // 트랜잭션 관리
    pub fn begin_transaction(&mut self) {
        self.edit_history.begin_transaction(self.selections.to_vec());
    }

    pub fn end_transaction(&mut self) -> EditorDelta {
        self.edit_history.end_transaction(self.selections.to_vec());

        // 델타 생성 (IPC 전송용)
        EditorDelta {
            buffer_id: self.buffer_id,
            // ...
        }
    }
}
```

### 4.2 에디터 매니저

```rust
impl AppState {
    pub fn create_editor(&mut self, buffer_id: BufferId) -> EditorId {
        let editor = Editor::new(buffer_id);
        let editor_id = editor.id;

        self.editors.insert(editor_id, editor);

        editor_id
    }

    pub fn close_editor(&mut self, editor_id: EditorId) {
        self.editors.remove(&editor_id);
    }

    pub fn get_editor(&self, editor_id: EditorId) -> Option<&Editor> {
        self.editors.get(&editor_id)
    }

    pub fn get_editor_mut(&mut self, editor_id: EditorId) -> Option<&mut Editor> {
        self.editors.get_mut(&editor_id)
    }
}
```

---

## 5. ProjectManager (프로젝트 관리)

### 5.1 구조

```rust
pub struct ProjectManager {
    // 현재 프로젝트
    current_project: Option<Project>,

    // 최근 프로젝트
    recent_projects: Vec<PathBuf>,
}

pub struct Project {
    root_path: PathBuf,
    name: String,

    // 워크트리 (Zed 참고)
    worktrees: Vec<Worktree>,

    // Git 저장소
    git_repos: Vec<GitRepository>,

    // 프로젝트 설정
    config: ProjectConfig,
}

pub struct Worktree {
    id: WorktreeId,
    root_path: PathBuf,

    // 파일 엔트리 (캐시)
    entries: HashMap<ProjectEntryId, Entry>,

    // 파일 감시자
    watcher: RecommendedWatcher,
}

pub struct Entry {
    id: ProjectEntryId,
    path: PathBuf,
    is_directory: bool,
    mtime: SystemTime,
    size: u64,
}
```

### 5.2 프로젝트 열기

```rust
impl ProjectManager {
    pub async fn open_project(&mut self, path: PathBuf) -> Result<()> {
        // 1. 프로젝트 구조 탐색
        let project = Project::scan(&path).await?;

        // 2. Git 저장소 감지
        project.detect_git_repos()?;

        // 3. 프로젝트 설정 로드 (.ferrum/config.toml)
        project.load_config()?;

        // 4. 현재 프로젝트로 설정
        self.current_project = Some(project);

        // 5. 최근 프로젝트에 추가
        self.add_to_recent_projects(path);

        Ok(())
    }
}
```

---

## 6. Workspace (워크스페이스 레이아웃)

### 6.1 구조 (Zed 참고)

```rust
pub struct Workspace {
    // 패널 관리
    panes: HashMap<PaneId, Pane>,
    pane_layout: PaneGroup,
    active_pane: PaneId,

    // 도킹 시스템
    left_dock: Dock,
    bottom_dock: Dock,
    right_dock: Dock,

    // 상태
    is_maximized: bool,
    fullscreen: bool,
}

pub enum PaneGroup {
    Pane(PaneId),
    Split {
        axis: SplitAxis,
        children: Vec<PaneGroup>,
        sizes: Vec<f32>,  // 0.0 ~ 1.0
    },
}

pub enum SplitAxis {
    Horizontal,
    Vertical,
}

pub struct Pane {
    id: PaneId,
    items: Vec<PaneItem>,
    active_item_index: usize,
}

pub enum PaneItem {
    Editor(EditorId),
    Terminal(TerminalId),
    Search(SearchId),
    GitPanel,
    FileExplorer,
}

pub struct Dock {
    position: DockPosition,
    panels: Vec<Panel>,
    active_panel: Option<usize>,
    is_open: bool,
    size: u32,  // 픽셀 또는 퍼센트
}

pub enum DockPosition {
    Left,
    Bottom,
    Right,
}

pub struct Panel {
    id: PanelId,
    title: String,
    content: PanelContent,
}

pub enum PanelContent {
    FileExplorer,
    Search,
    GitPanel,
    Terminal,
    Outline,
    Problems,
}
```

### 6.2 패널 분할

```rust
impl Workspace {
    pub fn split_pane(
        &mut self,
        pane_id: PaneId,
        direction: SplitDirection,
    ) -> PaneId {
        // 1. 새 패널 생성
        let new_pane_id = PaneId::new();
        self.panes.insert(new_pane_id, Pane::new());

        // 2. 레이아웃 업데이트
        self.pane_layout = self.split_group(
            &self.pane_layout,
            pane_id,
            new_pane_id,
            direction,
        );

        new_pane_id
    }

    fn split_group(
        &self,
        group: &PaneGroup,
        target_pane_id: PaneId,
        new_pane_id: PaneId,
        direction: SplitDirection,
    ) -> PaneGroup {
        match group {
            PaneGroup::Pane(id) if *id == target_pane_id => {
                // 타겟 발견, 분할 생성
                PaneGroup::Split {
                    axis: direction.to_axis(),
                    children: vec![
                        PaneGroup::Pane(target_pane_id),
                        PaneGroup::Pane(new_pane_id),
                    ],
                    sizes: vec![0.5, 0.5],
                }
            }
            PaneGroup::Split { axis, children, sizes } => {
                // 재귀적으로 탐색
                let new_children = children
                    .iter()
                    .map(|child| self.split_group(child, target_pane_id, new_pane_id, direction))
                    .collect();

                PaneGroup::Split {
                    axis: *axis,
                    children: new_children,
                    sizes: sizes.clone(),
                }
            }
            _ => group.clone(),
        }
    }
}

pub enum SplitDirection {
    Up,
    Down,
    Left,
    Right,
}

impl SplitDirection {
    fn to_axis(&self) -> SplitAxis {
        match self {
            SplitDirection::Up | SplitDirection::Down => SplitAxis::Horizontal,
            SplitDirection::Left | SplitDirection::Right => SplitAxis::Vertical,
        }
    }
}
```

---

## 7. ThemeManager (테마 관리)

### 7.1 구조

```rust
pub struct ThemeManager {
    themes: HashMap<String, Theme>,
    active_theme: String,
}

pub struct Theme {
    pub name: String,
    pub colors: ThemeColors,
    pub syntax: SyntaxTheme,
}

pub struct ThemeColors {
    pub background: Color,
    pub foreground: Color,
    pub selection: Color,
    pub cursor: Color,
    pub line_number: Color,
    pub line_number_active: Color,
    pub gutter: Color,
    pub comment: Color,
    // ...
}

pub struct SyntaxTheme {
    pub keyword: Color,
    pub string: Color,
    pub number: Color,
    pub function: Color,
    pub variable: Color,
    pub type_: Color,
    // ...
}

pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}
```

### 7.2 테마 로드

```rust
impl ThemeManager {
    pub fn load_themes(&mut self) -> Result<()> {
        // 1. 번들 테마 로드
        let bundled_themes = vec![
            include_str!("../themes/dark.toml"),
            include_str!("../themes/light.toml"),
            include_str!("../themes/monokai.toml"),
            // ...
        ];

        for theme_str in bundled_themes {
            let theme: Theme = toml::from_str(theme_str)?;
            self.themes.insert(theme.name.clone(), theme);
        }

        // 2. 사용자 테마 로드
        let user_themes_dir = Config::themes_dir();
        if user_themes_dir.exists() {
            for entry in std::fs::read_dir(user_themes_dir)? {
                let path = entry?.path();
                if path.extension() == Some(OsStr::new("toml")) {
                    let theme_str = std::fs::read_to_string(&path)?;
                    let theme: Theme = toml::from_str(&theme_str)?;
                    self.themes.insert(theme.name.clone(), theme);
                }
            }
        }

        Ok(())
    }

    pub fn set_active_theme(&mut self, name: &str) -> Result<&Theme> {
        if !self.themes.contains_key(name) {
            return Err(anyhow::anyhow!("Theme not found: {}", name));
        }

        self.active_theme = name.to_string();

        Ok(&self.themes[name])
    }

    pub fn active_theme(&self) -> &Theme {
        &self.themes[&self.active_theme]
    }
}
```

---

## 8. Config (설정 관리)

### 8.1 구조

```rust
#[derive(Serialize, Deserialize)]
pub struct Config {
    // 에디터 설정
    pub editor: EditorConfig,

    // UI 설정
    pub ui: UiConfig,

    // LSP 설정
    pub lsp: LspConfig,

    // 키바인딩
    pub keybindings: Keybindings,

    // 플러그인
    pub plugins: PluginsConfig,
}

#[derive(Serialize, Deserialize)]
pub struct EditorConfig {
    pub tab_size: u32,
    pub insert_spaces: bool,
    pub line_numbers: bool,
    pub minimap: bool,
    pub word_wrap: bool,
    pub font_family: String,
    pub font_size: u32,
}

#[derive(Serialize, Deserialize)]
pub struct UiConfig {
    pub theme: String,
    pub restore_last_project: bool,
    pub auto_save: bool,
    pub auto_save_delay_ms: u64,
}
```

### 8.2 설정 파일 위치

```rust
impl Config {
    pub fn config_dir() -> PathBuf {
        #[cfg(target_os = "macos")]
        let base = dirs::home_dir().unwrap().join("Library/Application Support");

        #[cfg(target_os = "linux")]
        let base = dirs::config_dir().unwrap();

        #[cfg(target_os = "windows")]
        let base = dirs::config_dir().unwrap();

        base.join("Ferrum")
    }

    pub fn config_file() -> PathBuf {
        Self::config_dir().join("config.toml")
    }

    pub fn load() -> Result<Self> {
        let path = Self::config_file();
        if !path.exists() {
            return Ok(Self::default());
        }

        let content = std::fs::read_to_string(&path)?;
        let config: Config = toml::from_str(&content)?;

        Ok(config)
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::config_file();
        let dir = path.parent().unwrap();

        std::fs::create_dir_all(dir)?;

        let content = toml::to_string_pretty(self)?;
        std::fs::write(&path, content)?;

        Ok(())
    }
}
```

---

## 9. 상태 동기화 (Backend → Frontend)

### 9.1 Event 발행

```rust
pub struct EventEmitter {
    app_handle: AppHandle,
}

impl EventEmitter {
    pub fn editor_text_changed(&self, event: EditorTextChangedEvent) {
        self.app_handle.emit_all("editor-text-changed", event).ok();
    }

    pub fn editor_selection_changed(&self, event: EditorSelectionChangedEvent) {
        self.app_handle.emit_all("editor-selection-changed", event).ok();
    }

    pub fn lsp_diagnostics(&self, event: LspDiagnosticsEvent) {
        self.app_handle.emit_all("lsp-diagnostics", event).ok();
    }

    pub fn theme_changed(&self, event: ThemeChangedEvent) {
        self.app_handle.emit_all("theme-changed", event).ok();
    }

    pub fn workspace_layout_changed(&self, event: WorkspaceLayoutChangedEvent) {
        self.app_handle.emit_all("workspace-layout-changed", event).ok();
    }
}

// AppState에 통합
impl AppState {
    pub fn with_event_emitter(&mut self, app_handle: AppHandle) {
        self.event_emitter = Some(EventEmitter {
            app_handle,
        });
    }

    pub fn emit_editor_text_changed(&self, buffer_id: BufferId, changes: Vec<TextChange>) {
        if let Some(emitter) = &self.event_emitter {
            emitter.editor_text_changed(EditorTextChangedEvent {
                buffer_id,
                changes,
                version: self.buffer_manager.get_buffer(buffer_id)
                    .unwrap()
                    .lock()
                    .unwrap()
                    .version(),
            });
        }
    }
}
```

---

## 10. 영속성 (Persistence)

### 10.1 세션 저장

```rust
#[derive(Serialize, Deserialize)]
pub struct Session {
    pub project_path: Option<PathBuf>,
    pub open_files: Vec<PathBuf>,
    pub workspace_layout: WorkspaceLayoutState,
    pub active_editor: Option<EditorId>,
}

#[derive(Serialize, Deserialize)]
pub struct WorkspaceLayoutState {
    pub pane_layout: PaneGroupState,
    pub left_dock: DockState,
    pub bottom_dock: DockState,
    pub right_dock: DockState,
}

impl AppState {
    pub fn save_session(&self) -> Result<()> {
        let session = Session {
            project_path: self.project_manager.current_project_path(),
            open_files: self.buffer_manager.open_files(),
            workspace_layout: self.workspace.to_state(),
            active_editor: self.workspace.active_editor(),
        };

        let session_file = Config::config_dir().join("session.json");
        let content = serde_json::to_string_pretty(&session)?;
        std::fs::write(session_file, content)?;

        Ok(())
    }

    pub async fn restore_session(&mut self) -> Result<()> {
        let session_file = Config::config_dir().join("session.json");
        if !session_file.exists() {
            return Ok(());
        }

        let content = std::fs::read_to_string(session_file)?;
        let session: Session = serde_json::from_str(&content)?;

        // 1. 프로젝트 복원
        if let Some(project_path) = session.project_path {
            self.project_manager.open_project(project_path).await?;
        }

        // 2. 파일 복원
        for file in session.open_files {
            self.buffer_manager.open_file(file)?;
        }

        // 3. 레이아웃 복원
        self.workspace.restore_layout(session.workspace_layout)?;

        Ok(())
    }
}
```

---

## 11. 구현 체크리스트

### Phase 1: 기본 상태 구조 (Week 1)
- [ ] AppState 구조
- [ ] BufferManager
- [ ] Editor 기본 구조
- [ ] ProjectManager 기본 구조

### Phase 2: 워크스페이스 (Week 2)
- [ ] Workspace 구조
- [ ] 패널 분할 로직
- [ ] 도킹 시스템

### Phase 3: 설정 및 테마 (Week 3)
- [ ] Config 로드/저장
- [ ] ThemeManager
- [ ] 테마 파일 포맷

### Phase 4: 영속성 (Week 4)
- [ ] 세션 저장/복원
- [ ] 프로젝트 상태 저장

---

## 참고 자료

- [Zed Workspace](https://github.com/zed-industries/zed/blob/main/crates/workspace/src/workspace.rs)
- [Zed GPUI App State](https://github.com/zed-industries/zed/blob/main/crates/gpui/src/app.rs)
- [Tauri State Management](https://tauri.app/v1/guides/features/command#accessing-managed-state)
