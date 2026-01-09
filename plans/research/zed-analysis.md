# Zed Editor 코드베이스 분석

> **분석 목적**: Ferrum IDE의 에디터 엔진, IPC 구조, 아키텍처 설계를 위한 참고 자료

**분석 대상**: [Zed Editor](https://github.com/zed-industries/zed)
**버전**: Latest (2024)
**언어**: Rust 97.7%
**아키텍처**: 네이티브 + GPUI (커스텀 GPU 가속 UI 프레임워크)

---

## 1. 전체 아키텍처

### 1.1 레이어 구조

Zed는 전통적인 프론트엔드-백엔드 분리가 아닌, **통합 네이티브 아키텍처**를 사용합니다.

```
┌─────────────────────────────────────┐
│   GPUI (UI Framework)               │  ← 커스텀 GPU 가속 UI 프레임워크
├─────────────────────────────────────┤
│   Workspace & Editor                │  ← 애플리케이션 레벨 조정
├─────────────────────────────────────┤
│   Domain Layer (Project, Language,  │  ← 비즈니스 로직
│   LSP, Git, Terminal, etc.)         │
├─────────────────────────────────────┤
│   Core Data Structures              │  ← 텍스트 버퍼, Rope, SumTree
│   (Text, Rope, MultiBuffer)         │
├─────────────────────────────────────┤
│   Platform Abstraction              │  ← FS, Network, RPC
│   (fs, net, rpc, collab)            │
└─────────────────────────────────────┘
```

**핵심 특징:**
- 209개의 모듈화된 크레이트(crate)로 구성
- 웹 기반이 아닌 완전 네이티브 애플리케이션
- 명확한 책임 분리

**핵심 파일:**
- 메인 엔트리포인트: `/crates/zed/src/main.rs`
- UI 프레임워크: `/crates/gpui/`
- 에디터 코어: `/crates/editor/`

### 1.2 Ferrum에 적용할 차이점

| 측면 | Zed | Ferrum |
|------|-----|--------|
| **UI 프레임워크** | GPUI (커스텀 Rust) | SolidJS + PixiJS |
| **프론트엔드-백엔드** | 통합 (모두 Rust) | 분리 (Tauri IPC) |
| **렌더링** | 커스텀 GPU 파이프라인 | 브라우저 엔진 + WebGPU |
| **상태 관리** | Entity 시스템 | Rust Backend 중앙화 |
| **협업** | 내장 (P2P) | 선택적 기능 |

---

## 2. 에디터 엔진

### 2.1 Rope 데이터 구조

**위치**: `/crates/rope/src/rope.rs`

```rust
pub struct Rope {
    chunks: SumTree<Chunk>,  // B+ 트리 기반
}
```

**핵심 특징:**
- **SumTree 기반**: 계층적 요약(summary)을 유지하는 B+ 트리
- **청크 단위 저장**: 텍스트를 작은 청크로 분할
- **다차원 인덱싱**: 바이트, 문자, UTF-16 오프셋, 라인/컬럼 동시 지원

**성능 특성:**
- 삽입/삭제: O(log n)
- 인덱스 접근: O(log n)
- UTF-8 경계 준수

**Ferrum 적용:**
- ✅ ropey 라이브러리 사용 (Zed와 유사한 구조)
- ✅ Rust 백엔드에서 텍스트 버퍼 관리
- ✅ 프론트엔드는 디스플레이만 담당

### 2.2 SumTree 구조

**위치**: `/crates/sum_tree/src/sum_tree.rs`

**핵심 개념:**
```rust
// B+ 트리 변형
- 리프 노드: 실제 아이템과 Summary 저장
- 내부 노드: 서브트리의 Summary 저장
- TREE_BASE = 6, 각 노드 최대 12개 아이템
```

**차원(Dimension) 기반 탐색:**
```
텍스트 차원:
- 바이트 길이
- 문자 수
- UTF-16 오프셋
- 라인/컬럼 위치 (Point, PointUtf16)
```

**주요 연산:**
- `find()` / `find_exact()`: 차원 기반 검색
- `cursor()`: 순회 가능한 커서 생성
- `edit()`: 배치 삽입/삭제
- `append()`: 트리 병합

**Ferrum 적용:**
- ✅ ropey가 내부적으로 유사한 B-tree 구조 사용
- ✅ 다차원 인덱싱 지원 (라인/바이트/UTF-16)

### 2.3 커서/선택 관리

**위치**: `/crates/editor/src/editor.rs`

```rust
// Anchor 기반 포지셔닝
Selection<Anchor> {
    id: SelectionId,
    start: Anchor,    // 편집 시 자동 업데이트
    end: Anchor,
    reversed: bool,   // 방향
    goal: SelectionGoal,
}

// 멀티 커서 관리
SelectionsCollection {
    disjoint: Arc<[Selection<Anchor>]>,  // 겹치지 않는 선택
    pending: Option<PendingSelection>,   // 진행 중인 선택
}
```

**Anchor 시스템:**
- 버퍼의 특정 위치에 고정
- 편집 시 Bias(Left/Right)에 따라 자동 리매핑
- 협업 편집에서 위치 동기화에 필수

**선택 히스토리:**
```rust
SelectionHistory {
    mode: HistoryMode,  // Normal, Undoing, Redoing, Skipping
    selections_by_transaction: VecDeque<...>,
}
```

**Ferrum 적용:**
- ✅ Rust 백엔드에서 Anchor 시스템 구현
- ✅ 멀티 커서 지원 (disjoint selections)
- ✅ Selection 히스토리 (Undo/Redo)
- ❌ Remote Selection (협업은 Post-MVP)

### 2.4 Syntax Highlighting

**위치**: `/crates/language/src/language.rs`

```rust
Language {
    config: LanguageConfig,
    grammar: Option<Arc<Grammar>>,  // Tree-sitter 문법
    queries: LanguageQueries,       // .scm 쿼리 파일
}

HighlightsConfig {
    query: Query,                   // Tree-sitter 쿼리
    capture_indices: HashMap<...>,  // 캡처 → 테마 색상 매핑
}
```

**쿼리 타입 (.scm 파일):**
- `highlights.scm`: 구문 강조
- `brackets.scm`: 괄호 매칭
- `indents.scm`: 자동 들여쓰기
- `outlines.scm`: 심볼 아웃라인
- `injections.scm`: 언어 임베딩 (예: HTML 내 JavaScript)

**통합 프로세스:**
```
Buffer → Tree-sitter Parser → Syntax Tree → Query → Highlights
```

**성능 최적화:**
- 파서 인스턴스 재사용 (풀링)
- 증분 파싱 (변경 영역만)
- 쿼리 커서 재사용
- 백그라운드 스레드에서 파싱

**Ferrum 적용:**
- ✅ tree-sitter 사용 (개요 문서에 명시됨)
- ✅ tree-sitter-highlight, tree-sitter-tags 사용
- ✅ .scm 쿼리 파일 기반 하이라이팅
- ⚠️ 파서 풀링 최적화 필요

### 2.5 DisplayMap (좌표 변환 파이프라인)

**위치**: `/crates/editor/src/display_map.rs`

**변환 파이프라인:**
```
Buffer Text
  ↓
InlayMap        (인레이 힌트 삽입)
  ↓
FoldMap         (코드 폴딩)
  ↓
TabMap          (탭 → 스페이스)
  ↓
WrapMap         (소프트 래핑)
  ↓
BlockMap        (커스텀 블록: 진단, 헤더)
  ↓
DisplayMap      (배경 강조)
  ↓
Screen Display
```

**Transform 시스템:**
```rust
enum Transform {
    Inlay,      // 입력 없음, 출력 있음 (삽입)
    Fold,       // 입력 있음, 출력 없음 (숨김)
    // ...
}

TransformSummary {
    input: TextSummary,   // 입력 차원
    output: TextSummary,  // 출력 차원
}
```

**좌표 변환 메서드:**
```rust
point_to_display_point(Point) -> DisplayPoint
display_point_to_point(DisplayPoint) -> Point
```

**증분 업데이트:**
- 각 레이어를 순차적으로 동기화
- 영향받은 영역만 무효화
- 전체 재계산 방지

**Ferrum 적용:**
- ✅ 유사한 파이프라인 구현 필요
- ✅ Inlay hints (LSP)
- ✅ 코드 폴딩
- ✅ 소프트 래핑
- ✅ 커스텀 블록 (Tree Viewer용)

---

## 3. LSP 통합

### 3.1 LSP 클라이언트 구현

**위치**: `/crates/lsp/src/lsp.rs`

**아키텍처:**
```
Editor → Language → LSP Client → Language Server (subprocess)
```

**LanguageServer 구조:**
```rust
LanguageServer {
    next_id: AtomicI32,           // 요청 ID 생성
    outbound_tx: UnboundedSender, // 송신 채널
    notification_handlers: HashMap<String, Handler>,
    response_handlers: Arc<Mutex<HashMap<RequestId, ResponseHandler>>>,
    io_tasks: Vec<Task<()>>,      // I/O 백그라운드 태스크
}
```

### 3.2 언어 서버 관리

**서버 시작:**
```rust
LanguageServer::new(
    server_id: LanguageServerId,
    binary: LanguageServerBinary,  // 실행 파일 경로
    root_path: &Path,              // 워킹 디렉토리
    code_action_kinds: Vec<...>,
    cx: AsyncApp,
) -> Result<Arc<Self>>

// 프로세스 생성
let mut command = util::command::new_smol_command(&binary.path);
command.current_dir(root_path);
command.args(&binary.arguments);

// stdin/stdout/stderr 파이프 연결
let child = command
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?;
```

**서버 레지스트리:**
```rust
LspStore {
    language_servers: HashMap<LanguageServerId, LanguageServerState>,
    // 버퍼 → 서버 매핑
    // 능력(capabilities) 추적
}
```

### 3.3 프로토콜 메시지 처리

**송신 파이프라인:**
```
요청/알림 생성
  ↓
outbound_tx 채널
  ↓
handle_outgoing_messages() 태스크
  ↓
LSP 프레이밍 (Content-Length 헤더)
  ↓
stdin 쓰기
```

**수신 파이프라인:**
```
stdout 읽기
  ↓
LspStdoutHandler
  ↓
JSON-RPC 역직렬화
  ↓
알림/응답 라우팅
  ↓
핸들러 호출
```

**요청 추적:**
```rust
// 요청 전송
let (tx, rx) = oneshot::channel();
let request_id = self.next_id.fetch_add(1, Ordering::SeqCst);
self.response_handlers.insert(
    request_id,
    ResponseHandler::new(tx)
);

// 응답 수신
match self.response_handlers.remove(&id) {
    Some(handler) => handler.handle(response),
    None => log::warn!("No handler for response {}", id),
}

// 타임아웃: 120초
const LSP_REQUEST_TIMEOUT: Duration = Duration::from_secs(120);
```

**주요 LSP 기능:**
- 자동완성 (textDocument/completion)
- 정의로 이동 (textDocument/definition)
- 참조 찾기 (textDocument/references)
- 진단 (textDocument/publishDiagnostics)
- 코드 액션 (textDocument/codeAction)
- 리네임 (textDocument/rename)
- 인레이 힌트 (textDocument/inlayHint)

**Ferrum 적용:**
- ✅ 공식 LSP 서버 사용 (개요 문서에 명시됨)
- ✅ JSON-RPC over stdin/stdout
- ✅ 비동기 요청/응답 추적
- ✅ 채널 기반 메시지 큐잉
- ✅ 120초 타임아웃
- ✅ 번들 LSP 서버 (16개 언어) - 오프라인 지원

---

## 4. IPC 통신 메커니즘

### 4.1 Zed의 RPC 시스템

**위치**: `/crates/rpc/`

```rust
// Protocol Version
pub const PROTOCOL_VERSION: u32 = 68;

// 주요 컴포넌트
- Connection: 연결 관리
- MessageStream: 메시지 스트리밍
- TypedEnvelope: 타입 안전 메시지 래핑
- Receipt: 수신 확인
```

**직렬화:**
- Protocol Buffers (protobuf) 사용
- 시맨틱 버저닝 (버전 68)

**통신 모드:**
```rust
// 3가지 동작 모드
- Local: 단독 사용자 (동기화 없음)
- Shared: 로컬 프로젝트를 다른 피어와 공유
- Remote: collab 서버를 통한 완전 분산 협업
```

### 4.2 Ferrum의 IPC 설계 (Tauri 기반)

Ferrum은 Zed와 다르게 **Tauri IPC**를 사용합니다:

**아키텍처 차이:**
```
Zed:      통합 Rust (RPC는 협업용)
Ferrum:   Frontend (SolidJS) ↔ IPC ↔ Backend (Rust)
```

**Tauri IPC 특징:**
- 타입 안전 명령어 (Command)
- 이벤트 시스템 (Frontend ← Backend)
- 비동기 처리
- Serde 기반 직렬화

**설계 원칙:**
```
1. Frontend는 순수 View (상태 없음)
2. 모든 상태/연산은 Rust Backend
3. IPC는 최소화 (성능)
4. 배치 업데이트 (빈번한 변경 시)
```

**메시지 타입 설계:**
```rust
// Command (Frontend → Backend)
- EditorCommand (insert, delete, move_cursor)
- FileCommand (open, save, close)
- LspCommand (completion, goto_definition)
- SearchCommand (find, replace)

// Event (Backend → Frontend)
- EditorEvent (text_changed, selection_changed)
- LspEvent (diagnostics, completion_result)
- FileEvent (file_changed, file_deleted)
- ThemeEvent (theme_changed)
```

**최적화 전략:**
```
1. 델타 업데이트: 전체가 아닌 변경분만 전송
2. 배칭: 여러 변경을 한 번에 전송
3. 디바운싱: 빈번한 이벤트 제한
4. 우선순위: 중요한 이벤트 먼저
```

---

## 5. 파일 시스템 추상화

### 5.1 Zed의 Fs 트레이트

**위치**: `/crates/fs/src/fs.rs`

```rust
#[async_trait]
pub trait Fs: Send + Sync {
    // 파일 작업
    async fn create_file(&self, path: &Path, options: CreateOptions) -> Result<()>;
    async fn copy_file(&self, from: &Path, to: &Path, options: CopyOptions) -> Result<()>;
    async fn rename(&self, from: &Path, to: &Path) -> Result<()>;
    async fn remove_file(&self, path: &Path) -> Result<()>;
    async fn load(&self, path: &Path) -> Result<String>;
    async fn save(&self, path: &Path, text: &str) -> Result<()>;

    // 디렉토리 작업
    async fn create_dir(&self, path: &Path) -> Result<()>;
    async fn remove_dir(&self, path: &Path) -> Result<()>;
    async fn read_dir(&self, path: &Path) -> Result<Vec<PathBuf>>;

    // 메타데이터
    async fn metadata(&self, path: &Path) -> Result<Metadata>;
    async fn canonicalize(&self, path: &Path) -> Result<PathBuf>;

    // 감시
    fn watch(&self, path: &Path, latency: Duration)
        -> Pin<Box<dyn Stream<Item = Vec<PathEvent>>>>;
}
```

**구현체:**

1. **RealFs** - 실제 파일 시스템
```rust
// 플랫폼별 구현:
// - macOS: fsevent 사용
// - Linux/FreeBSD: ashpd, fs_watcher
// - Windows: 커스텀 정규화
```

2. **FakeFs** - 테스트용 인메모리 파일 시스템
```rust
// 합성 inode, mtime
// 호출 카운팅
```

**파일 감시:**
```rust
pub enum PathEvent {
    Created(PathBuf),
    Changed(PathBuf),
    Removed(PathBuf),
}
```

### 5.2 Ferrum 적용

**Tauri의 파일 시스템 API:**
- `fs` 플러그인 사용
- 샌드박싱 (보안)
- 플랫폼별 최적화

**파일 감시:**
- Tauri의 `fs-watch` 사용
- 또는 Rust 백엔드에서 직접 구현 (notify 크레이트)

**설계:**
```rust
// Rust Backend
pub struct FileSystem {
    watcher: RecommendedWatcher,
    event_tx: Sender<FileEvent>,
}

// Frontend로 이벤트 전송
emit_file_event(FileEvent::Changed(path))
```

---

## 6. 프로젝트/워크스페이스 관리

### 6.1 Zed의 Project

**위치**: `/crates/project/src/project.rs`

```rust
// ProjectPath: 워크트리 + 상대 경로
ProjectPath {
    worktree_id: WorktreeId,
    path: Arc<Path>,  // 상대 경로
}

// 워크트리: 독립적인 디렉토리 계층
Worktree {
    id: WorktreeId,
    root_path: Arc<Path>,
    entries: HashMap<ProjectEntryId, Entry>,
}

Project {
    // 워크트리 관리
    worktrees: Vec<Entity<Worktree>>,

    // LSP 관리
    lsp_store: Entity<LspStore>,

    // 버퍼 관리
    opened_buffers: HashMap<ProjectPath, WeakEntity<Buffer>>,
}
```

**주요 기능:**
- 파일 추적 및 ProjectEntryId 할당
- LSP 서버 조정
- 진단(diagnostics) 업데이트 관리
- 리팩토링 (willRename/didRename)

### 6.2 Zed의 Workspace

**위치**: `/crates/workspace/src/workspace.rs`

```rust
Workspace {
    // 패널 관리
    center: PaneGroup,                // 중앙 편집 영역
    panes: Vec<Entity<Pane>>,         // 모든 패널
    active_pane: Entity<Pane>,        // 활성 패널

    // 도킹 시스템
    left_dock: Entity<Dock>,
    bottom_dock: Entity<Dock>,
    right_dock: Entity<Dock>,

    // 프로젝트 참조
    project: Entity<Project>,
}
```

**패널 분할:**
```rust
// 방향별 분할
workspace.split_pane(active_pane, SplitDirection::Right);
workspace.split_pane(active_pane, SplitDirection::Down);
```

**레이아웃 직렬화:**
- 패널 레이아웃 (분할 방향, 크기)
- 열린 파일/아이템
- 활성 패널 및 탭
- 스크롤 위치

### 6.3 Ferrum 적용

**프로젝트 관리:**
```rust
// Rust Backend
pub struct Project {
    root_path: PathBuf,
    worktrees: Vec<Worktree>,
    lsp_servers: HashMap<LanguageId, LspServer>,
    opened_files: HashMap<FileId, Buffer>,
    diagnostics: HashMap<FileId, Vec<Diagnostic>>,
}
```

**워크스페이스 레이아웃:**
```rust
// SolidJS Frontend (View만)
// 레이아웃 상태는 Rust Backend가 관리
pub struct WorkspaceLayout {
    panels: Vec<PanelLayout>,
    active_panel: PanelId,
    docks: DockLayout,
}
```

**영속성:**
- SQLite 또는 파일 기반 저장
- 프로젝트별 설정
- 최근 열린 파일
- 레이아웃 복원

---

## 7. 탭/패널 시스템

### 7.1 Zed의 Pane

**위치**: `/crates/workspace/src/workspace.rs`

```rust
Pane {
    items: Vec<Box<dyn Item>>,        // 탭 아이템들
    active_item_index: usize,         // 활성 탭
    focus_handle: FocusHandle,        // 포커스 관리
    toolbar: Entity<Toolbar>,
    nav_history: NavigationHistory,   // 뒤로/앞으로
}
```

**PaneGroup (분할 레이아웃):**
```rust
enum PaneGroup {
    Pane(Entity<Pane>),
    Split {
        axis: Axis,                   // Horizontal / Vertical
        members: Vec<Member>,         // 재귀적 분할
        flexes: Vec<f32>,            // 크기 비율
    }
}
```

**Dock (사이드 패널):**
```rust
Dock {
    position: DockPosition,           // Left, Bottom, Right
    panels: Vec<PanelEntry>,
    active_panel_index: Option<usize>,
    is_open: bool,
    zoom: Option<AnyEntity>,
}
```

### 7.2 Ferrum 적용

**패널 시스템 설계:**
```rust
// Rust Backend
pub struct PanelManager {
    panes: HashMap<PaneId, Pane>,
    layout: PaneGroup,
    active_pane: PaneId,
}

pub enum PaneGroup {
    Pane(PaneId),
    Split {
        axis: SplitAxis,
        children: Vec<PaneGroup>,
        sizes: Vec<f32>,
    }
}
```

**SolidJS Frontend:**
```tsx
// 재귀적 패널 렌더링
function PaneGroupView(props: { group: PaneGroup }) {
  return (
    <Match>
      <Match when={props.group.type === 'pane'}>
        <PaneView paneId={props.group.id} />
      </Match>
      <Match when={props.group.type === 'split'}>
        <SplitView axis={props.group.axis}>
          <For each={props.group.children}>
            {child => <PaneGroupView group={child} />}
          </For>
        </SplitView>
      </Match>
    </Match>
  )
}
```

**도킹 시스템:**
- Left/Bottom/Right 도크
- 패널 토글
- 리사이징
- 영속성

---

## 8. GPUI vs Ferrum Frontend

### 8.1 GPUI 프레임워크

**위치**: `/crates/gpui/`

**핵심 개념:**
```
"하이브리드 즉시(immediate) 및 보유(retained) 모드,
GPU 가속 UI 프레임워크"
```

**3계층 구조:**

1. **상태 관리 레이어**: Entity 시스템
2. **고수준 UI 레이어**: View + Render 트레이트
3. **저수준 Element 레이어**: 세밀한 제어

**Context 시스템:**
```rust
AppContext        // 전역 상태
WindowContext     // 윈도우별 상태
ViewContext<T>    // 뷰별 상태
```

**Effect 시스템:**
```
사용자 액션 → pending_effects 큐 → flush_effects() 루프
```

### 8.2 Ferrum의 SolidJS + PixiJS

**차이점:**

| 측면 | GPUI | Ferrum |
|------|------|--------|
| **언어** | Rust | TypeScript |
| **렌더링** | 커스텀 GPU | 브라우저 + WebGPU |
| **상태** | Entity 시스템 | Rust Backend |
| **반응성** | Effect 시스템 | SolidJS Signals |
| **스타일링** | Tailwind (Rust) | Tailwind CSS 4.x |

**장점:**
- 브라우저 생태계 활용
- 빠른 개발 (SolidJS)
- WebGPU/WebGL2 (PixiJS)
- 개발자 도구

**단점:**
- GPUI보다 느릴 수 있음
- 메모리 오버헤드
- IPC 통신 필요

**최적화 전략:**
1. **Virtual Scrolling**: 대용량 파일
2. **Canvas 렌더링**: 텍스트 에디터 (PixiJS 또는 Canvas API)
3. **Web Worker**: 무거운 연산
4. **배치 업데이트**: IPC 최소화

---

## 9. Extension System

### 9.1 Zed의 Extension

**위치**: `/crates/extension/src/extension.rs`

```rust
#[async_trait]
pub trait Extension: Send + Sync {
    // 언어 서버 설정
    async fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &WorktreeDelegate,
    ) -> Result<Command>;

    // 슬래시 커맨드
    async fn run_slash_command(
        &self,
        command: SlashCommand,
        args: Vec<String>,
        worktree: &WorktreeDelegate,
    ) -> Result<String>;
}
```

**WASM 실행:**
- API 버전 파싱
- "zed:api-version" 커스텀 섹션
- Delegate 패턴

### 9.2 Ferrum의 Plugin System

**개요 문서 요구사항:**
- VSCode 플러그인 생태계로부터 독립
- Microsoft 종속 탈피
- 더 높은 수준의 커스터마이징 API
- JavaScript 기반
- V8 또는 QuickJS 런타임
- 샌드박싱

**Zed에서 배울 점:**
- ✅ WASM 샌드박싱 (보안)
- ✅ Delegate 패턴 (제한된 API 접근)
- ✅ API 버전 관리
- ✅ Extension 레지스트리

**차별점:**
- UI 깊은 수준까지 커스터마이징 (Zed는 제한적)
- 독립적인 마켓플레이스
- 더 풍부한 API

---

## 10. 핵심 파일 경로 맵

### 아키텍처 핵심
```
/crates/zed/src/main.rs                    - 메인 엔트리포인트
/crates/gpui/                              - UI 프레임워크
  └─ src/app.rs                            - 애플리케이션 구조
  └─ src/window.rs                         - 윈도우 관리
  └─ README.md                             - GPUI 아키텍처 문서
```

### 에디터 코어
```
/crates/editor/src/editor.rs               - 에디터 컴포넌트
/crates/editor/src/display_map.rs          - 좌표 변환 파이프라인
/crates/rope/src/rope.rs                   - Rope 데이터 구조
/crates/sum_tree/src/sum_tree.rs           - SumTree 구현
/crates/multi_buffer/src/multi_buffer.rs   - 멀티 버퍼
```

### 언어 지원
```
/crates/language/src/language.rs           - 언어 정의 시스템
/crates/lsp/src/lsp.rs                     - LSP 클라이언트
/extensions/*/languages/*/highlights.scm   - Tree-sitter 쿼리
```

### 프로젝트 관리
```
/crates/workspace/src/workspace.rs         - 워크스페이스
/crates/project/src/project.rs             - 프로젝트 관리
/crates/fs/src/fs.rs                       - 파일 시스템 추상화
```

### 통신 레이어
```
/crates/rpc/src/rpc.rs                     - RPC 시스템
/crates/collab/src/db.rs                   - 협업 데이터베이스
```

---

## 11. 주요 설계 원칙

### 11.1 Zed의 원칙

1. **모듈성**: 209개 크레이트
2. **성능**: SumTree O(log n), 증분 파싱
3. **확장성**: WASM Extension
4. **협업**: 내장 P2P
5. **크로스 플랫폼**: 플랫폼 추상화
6. **타입 안전성**: Rust 타입 시스템

### 11.2 Ferrum에 적용할 원칙

1. **In-place Enhancement**: 기존 UI에 디테일 추가
2. **Progressive Disclosure**: 필요시 별도 뷰로 분리
3. **Performance First**: 고급 기능 + 최적 성능
4. **Full Control**: 에디터 자체 구현
5. **VSCode Parity+**: VSCode 기능 + 추가 혁신

### 11.3 차별화 포인트

Ferrum이 Zed와 다른 점:

1. **비주얼 코딩**: Node-based (PixiJS)
2. **Compile-time Preview**: HMR 적용
3. **Tree Viewer**: 깊이별 컬러 + 스티키 헤더
4. **Context Action Palette**: 다음 액션 제안
5. **Dependency Highlight**: 파일 간 의존성 시각화
6. **AI는 보조 도구**: Zed는 AI 통합이 더 깊음

---

## 12. 결론 및 적용 방향

### 12.1 Zed에서 배울 점

✅ **채택할 것:**
1. Rope + SumTree 기반 텍스트 버퍼
2. Anchor 시스템 (편집 시 위치 추적)
3. DisplayMap 파이프라인 (좌표 변환)
4. LSP 클라이언트 구조 (비동기 요청/응답)
5. 파일 시스템 추상화 (트레이트 기반)
6. 프로젝트/워크스페이스 구조
7. Extension WASM 샌드박싱
8. 증분 파싱 (Tree-sitter)
9. 파서 풀링 최적화

❌ **채택하지 않을 것:**
1. GPUI 프레임워크 (→ SolidJS + PixiJS 사용)
2. 통합 아키텍처 (→ Tauri IPC 분리)
3. 내장 협업 (→ Post-MVP)
4. Entity 시스템 (→ Rust Backend 중앙 상태 관리)

### 12.2 구현 우선순위

**Phase 1: 에디터 엔진 (Foundation)**
1. ropey 기반 텍스트 버퍼
2. Anchor 시스템
3. 멀티 커서/선택
4. Tree-sitter 통합
5. Syntax highlighting

**Phase 2: LSP 통합**
1. LSP 클라이언트 (Zed 참고)
2. 비동기 요청/응답
3. 진단, 자동완성, 정의로 이동
4. 번들 LSP (16개 언어)

**Phase 3: IPC 및 Frontend**
1. Tauri IPC 프로토콜 설계
2. SolidJS View 구현
3. PixiJS 렌더링
4. 배치 업데이트 최적화

**Phase 4: 프로젝트 관리**
1. 파일 시스템 감시
2. 프로젝트 구조
3. 워크스페이스 레이아웃
4. 영속성

**Phase 5: 고유 기능**
1. Tree Viewer
2. Visual Coding (Node-based)
3. Compile-time Preview
4. Context Action Palette

### 12.3 기술 스택 확정

| 컴포넌트 | Zed | Ferrum |
|----------|-----|--------|
| **텍스트 버퍼** | Rope (자체) | ropey |
| **트리 구조** | SumTree (자체) | ropey 내장 |
| **LSP** | 자체 구현 | 유사 구현 |
| **파싱** | tree-sitter | tree-sitter |
| **UI** | GPUI | SolidJS + PixiJS |
| **IPC** | RPC (협업용) | Tauri IPC |
| **Extension** | WASM | WASM (V8/QuickJS) |

---

## 참고 자료

- [Zed GitHub Repository](https://github.com/zed-industries/zed)
- [GPUI README](https://github.com/zed-industries/zed/blob/main/crates/gpui/README.md)
- [Tree-sitter](https://tree-sitter.github.io/)
- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
- [ropey Documentation](https://docs.rs/ropey/)
- [Tauri Documentation](https://tauri.app/)
