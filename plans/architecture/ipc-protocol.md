# IPC Protocol 설계

> **목적**: Ferrum IDE의 Frontend (SolidJS) ↔ Backend (Rust) 통신 프로토콜 정의

## 1. 개요

### 1.1 설계 원칙

- **Frontend는 View만**: 상태 없음, 순수 렌더링
- **Backend는 Single Source of Truth**: 모든 상태/연산
- **최소 IPC**: 성능을 위해 통신 최소화
- **타입 안전**: Serde 기반 직렬화
- **비동기 우선**: 블로킹 방지

### 1.2 Tauri IPC 특징

```
Frontend (TypeScript)
        ↕ (JSON Serialization)
Tauri Bridge
        ↕
Backend (Rust)
```

**통신 방식:**
1. **Command**: Frontend → Backend (RPC 스타일)
2. **Event**: Backend → Frontend (Pub/Sub 스타일)

---

## 2. Message 아키텍처

### 2.1 Command (Frontend → Backend)

```rust
// Command는 Tauri의 #[tauri::command] 매크로로 정의
#[tauri::command]
async fn command_name(
    param1: Type1,
    param2: Type2,
    state: State<'_, AppState>,
) -> Result<ResponseType, String> {
    // 처리 로직
    Ok(result)
}
```

**카테고리:**
- Editor Commands (편집 작업)
- File Commands (파일 I/O)
- LSP Commands (언어 서버)
- Search Commands (검색/치환)
- Project Commands (프로젝트 관리)
- UI Commands (레이아웃, 테마)

### 2.2 Event (Backend → Frontend)

```rust
// Event는 Backend에서 emit
app_handle.emit_all("event-name", payload)?;

// 또는 특정 윈도우로만
window.emit("event-name", payload)?;
```

**카테고리:**
- Editor Events (텍스트 변경, 선택 변경)
- File Events (파일 변경 감지)
- LSP Events (진단, 자동완성 결과)
- UI Events (테마 변경, 레이아웃 업데이트)

---

## 3. Editor Commands

### 3.1 텍스트 편집

```rust
// 텍스트 삽입
#[tauri::command]
async fn editor_insert(
    buffer_id: BufferId,
    position: Position,
    text: String,
    state: State<'_, AppState>,
) -> Result<EditorDelta, String> {
    let mut app_state = state.inner().lock().await;
    let editor = app_state.get_editor_mut(buffer_id)?;

    editor.begin_transaction();
    editor.insert_at(position, &text);
    let delta = editor.end_transaction();

    Ok(delta)
}

// 텍스트 삭제
#[tauri::command]
async fn editor_delete(
    buffer_id: BufferId,
    range: Range,
    state: State<'_, AppState>,
) -> Result<EditorDelta, String> {
    let mut app_state = state.inner().lock().await;
    let editor = app_state.get_editor_mut(buffer_id)?;

    editor.begin_transaction();
    editor.delete_range(range);
    let delta = editor.end_transaction();

    Ok(delta)
}

// 텍스트 치환
#[tauri::command]
async fn editor_replace(
    buffer_id: BufferId,
    range: Range,
    text: String,
    state: State<'_, AppState>,
) -> Result<EditorDelta, String> {
    let mut app_state = state.inner().lock().await;
    let editor = app_state.get_editor_mut(buffer_id)?;

    editor.begin_transaction();
    editor.replace_range(range, &text);
    let delta = editor.end_transaction();

    Ok(delta)
}
```

**EditorDelta 구조:**
```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EditorDelta {
    pub buffer_id: BufferId,
    pub version: u64,
    pub changes: Vec<TextChange>,
    pub selections: Vec<Selection>,
    pub scroll_if_needed: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TextChange {
    pub range: Range,
    pub text: String,
}
```

### 3.2 커서/선택

```rust
// 커서 이동
#[tauri::command]
async fn editor_move_cursor(
    buffer_id: BufferId,
    direction: CursorDirection,
    extend_selection: bool,
    state: State<'_, AppState>,
) -> Result<SelectionUpdate, String> {
    let mut app_state = state.inner().lock().await;
    let editor = app_state.get_editor_mut(buffer_id)?;

    match direction {
        CursorDirection::Up => editor.move_cursor_up(extend_selection),
        CursorDirection::Down => editor.move_cursor_down(extend_selection),
        CursorDirection::Left => editor.move_cursor_left(extend_selection),
        CursorDirection::Right => editor.move_cursor_right(extend_selection),
    }

    Ok(SelectionUpdate {
        buffer_id,
        selections: editor.selections.clone(),
        scroll_to_cursor: true,
    })
}

#[derive(Serialize, Deserialize)]
pub enum CursorDirection {
    Up,
    Down,
    Left,
    Right,
}

// 선택 설정
#[tauri::command]
async fn editor_set_selection(
    buffer_id: BufferId,
    selections: Vec<Selection>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut app_state = state.inner().lock().await;
    let editor = app_state.get_editor_mut(buffer_id)?;

    editor.set_selections(selections);

    Ok(())
}

// 멀티 커서 추가
#[tauri::command]
async fn editor_add_cursor(
    buffer_id: BufferId,
    position: Position,
    state: State<'_, AppState>,
) -> Result<SelectionUpdate, String> {
    let mut app_state = state.inner().lock().await;
    let editor = app_state.get_editor_mut(buffer_id)?;

    editor.add_cursor_at(position);

    Ok(SelectionUpdate {
        buffer_id,
        selections: editor.selections.clone(),
        scroll_to_cursor: false,
    })
}
```

### 3.3 Undo/Redo

```rust
#[tauri::command]
async fn editor_undo(
    buffer_id: BufferId,
    state: State<'_, AppState>,
) -> Result<EditorDelta, String> {
    let mut app_state = state.inner().lock().await;
    let editor = app_state.get_editor_mut(buffer_id)?;

    if let Some(delta) = editor.undo() {
        Ok(delta)
    } else {
        Err("Nothing to undo".to_string())
    }
}

#[tauri::command]
async fn editor_redo(
    buffer_id: BufferId,
    state: State<'_, AppState>,
) -> Result<EditorDelta, String> {
    let mut app_state = state.inner().lock().await;
    let editor = app_state.get_editor_mut(buffer_id)?;

    if let Some(delta) = editor.redo() {
        Ok(delta)
    } else {
        Err("Nothing to redo".to_string())
    }
}
```

---

## 4. File Commands

### 4.1 파일 열기/닫기

```rust
// 파일 열기
#[tauri::command]
async fn file_open(
    path: String,
    state: State<'_, AppState>,
) -> Result<FileOpenResult, String> {
    let mut app_state = state.inner().lock().await;

    let buffer_id = app_state.buffer_manager.open_file(PathBuf::from(&path))?;
    let buffer = app_state.buffer_manager.get_buffer(buffer_id)?;

    Ok(FileOpenResult {
        buffer_id,
        path,
        content: buffer.lock().await.text(),
        language: detect_language(&path),
        read_only: false,
    })
}

#[derive(Serialize)]
pub struct FileOpenResult {
    pub buffer_id: BufferId,
    pub path: String,
    pub content: String,
    pub language: String,
    pub read_only: bool,
}

// 파일 닫기
#[tauri::command]
async fn file_close(
    buffer_id: BufferId,
    force: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut app_state = state.inner().lock().await;

    let buffer = app_state.buffer_manager.get_buffer(buffer_id)?;
    let is_dirty = buffer.lock().await.is_dirty();

    if is_dirty && !force {
        return Err("Buffer has unsaved changes".to_string());
    }

    app_state.buffer_manager.close_buffer(buffer_id);

    Ok(())
}
```

### 4.2 파일 저장

```rust
// 파일 저장
#[tauri::command]
async fn file_save(
    buffer_id: BufferId,
    state: State<'_, AppState>,
) -> Result<FileSaveResult, String> {
    let mut app_state = state.inner().lock().await;

    let saved_path = app_state.buffer_manager.save_buffer(buffer_id)?;

    Ok(FileSaveResult {
        buffer_id,
        path: saved_path.to_string_lossy().to_string(),
    })
}

// 다른 이름으로 저장
#[tauri::command]
async fn file_save_as(
    buffer_id: BufferId,
    path: String,
    state: State<'_, AppState>,
) -> Result<FileSaveResult, String> {
    let mut app_state = state.inner().lock().await;

    app_state.buffer_manager.save_buffer_as(
        buffer_id,
        PathBuf::from(&path),
    )?;

    Ok(FileSaveResult {
        buffer_id,
        path,
    })
}

#[derive(Serialize)]
pub struct FileSaveResult {
    pub buffer_id: BufferId,
    pub path: String,
}
```

---

## 5. LSP Commands

### 5.1 자동완성

```rust
#[tauri::command]
async fn lsp_completion(
    buffer_id: BufferId,
    position: Position,
    state: State<'_, AppState>,
) -> Result<Vec<CompletionItem>, String> {
    let app_state = state.inner().lock().await;

    let lsp_client = app_state.lsp_manager.get_client_for_buffer(buffer_id)?;
    let buffer = app_state.buffer_manager.get_buffer(buffer_id)?;

    let lsp_position = buffer.lock().await.position_to_lsp(position);

    let items = lsp_client
        .completion(buffer_id, lsp_position)
        .await
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[derive(Serialize, Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: CompletionItemKind,
    pub detail: Option<String>,
    pub documentation: Option<String>,
    pub insert_text: String,
}
```

### 5.2 정의로 이동

```rust
#[tauri::command]
async fn lsp_goto_definition(
    buffer_id: BufferId,
    position: Position,
    state: State<'_, AppState>,
) -> Result<Vec<Location>, String> {
    let app_state = state.inner().lock().await;

    let lsp_client = app_state.lsp_manager.get_client_for_buffer(buffer_id)?;
    let buffer = app_state.buffer_manager.get_buffer(buffer_id)?;

    let lsp_position = buffer.lock().await.position_to_lsp(position);

    let locations = lsp_client
        .goto_definition(buffer_id, lsp_position)
        .await
        .map_err(|e| e.to_string())?;

    Ok(locations)
}

#[derive(Serialize, Deserialize)]
pub struct Location {
    pub path: String,
    pub range: Range,
}
```

### 5.3 진단 (Diagnostics)

진단은 LSP 서버에서 비동기적으로 전송되므로 **Event**로 처리합니다.

```rust
// Backend에서 LSP 진단 수신 시
pub async fn handle_lsp_diagnostics(
    app_handle: &AppHandle,
    buffer_id: BufferId,
    diagnostics: Vec<Diagnostic>,
) {
    app_handle.emit_all("lsp-diagnostics", DiagnosticsEvent {
        buffer_id,
        diagnostics,
    }).ok();
}

#[derive(Serialize, Clone)]
pub struct DiagnosticsEvent {
    pub buffer_id: BufferId,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Diagnostic {
    pub range: Range,
    pub severity: DiagnosticSeverity,
    pub message: String,
    pub source: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Information,
    Hint,
}
```

---

## 6. Search Commands

### 6.1 프로젝트 전체 검색

```rust
#[tauri::command]
async fn search_project(
    query: String,
    options: SearchOptions,
    state: State<'_, AppState>,
) -> Result<SearchId, String> {
    let app_state = state.inner().lock().await;

    let search_id = app_state.search_manager.start_search(query, options);

    // 백그라운드에서 검색 수행, 결과는 Event로 전송

    Ok(SearchId(search_id))
}

#[derive(Serialize, Deserialize)]
pub struct SearchOptions {
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub regex: bool,
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
}

// 검색 결과는 Event로 전송
#[derive(Serialize, Clone)]
pub struct SearchResultEvent {
    pub search_id: SearchId,
    pub results: Vec<SearchMatch>,
    pub completed: bool,
}

#[derive(Serialize, Clone)]
pub struct SearchMatch {
    pub path: String,
    pub line: u32,
    pub column: u32,
    pub text: String,
    pub match_range: Range,
}
```

### 6.2 검색 취소

```rust
#[tauri::command]
async fn search_cancel(
    search_id: SearchId,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut app_state = state.inner().lock().await;

    app_state.search_manager.cancel_search(search_id);

    Ok(())
}
```

---

## 7. Project Commands

### 7.1 프로젝트 열기

```rust
#[tauri::command]
async fn project_open(
    path: String,
    state: State<'_, AppState>,
) -> Result<ProjectInfo, String> {
    let mut app_state = state.inner().lock().await;

    let project = app_state.project_manager.open_project(PathBuf::from(&path))?;

    Ok(ProjectInfo {
        root_path: path,
        name: project.name.clone(),
        language_servers: project.active_language_servers(),
    })
}

#[derive(Serialize)]
pub struct ProjectInfo {
    pub root_path: String,
    pub name: String,
    pub language_servers: Vec<String>,
}
```

### 7.2 파일 트리 (File Explorer)

```rust
#[tauri::command]
async fn project_list_files(
    path: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<FileEntry>, String> {
    let app_state = state.inner().lock().await;

    let project = app_state.project_manager.current_project()?;
    let entries = project.list_files(path.map(PathBuf::from))?;

    Ok(entries)
}

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileEntry>>,
}
```

---

## 8. UI Commands

### 8.1 레이아웃

```rust
#[tauri::command]
async fn ui_split_pane(
    pane_id: PaneId,
    direction: SplitDirection,
    state: State<'_, AppState>,
) -> Result<PaneId, String> {
    let mut app_state = state.inner().lock().await;

    let new_pane_id = app_state.workspace.split_pane(pane_id, direction)?;

    Ok(new_pane_id)
}

#[derive(Serialize, Deserialize)]
pub enum SplitDirection {
    Horizontal,
    Vertical,
}

#[tauri::command]
async fn ui_close_pane(
    pane_id: PaneId,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut app_state = state.inner().lock().await;

    app_state.workspace.close_pane(pane_id)?;

    Ok(())
}
```

### 8.2 테마

```rust
#[tauri::command]
async fn ui_set_theme(
    theme_name: String,
    state: State<'_, AppState>,
) -> Result<Theme, String> {
    let mut app_state = state.inner().lock().await;

    let theme = app_state.theme_manager.load_theme(&theme_name)?;
    app_state.theme_manager.set_active_theme(theme.clone());

    // Frontend로 테마 변경 이벤트 전송
    // (AppHandle 필요)

    Ok(theme)
}

#[derive(Serialize, Clone)]
pub struct Theme {
    pub name: String,
    pub colors: ThemeColors,
    pub syntax: SyntaxTheme,
}
```

---

## 9. Events (Backend → Frontend)

### 9.1 Editor Events

```rust
// 텍스트 변경 이벤트
#[derive(Serialize, Clone)]
pub struct EditorTextChangedEvent {
    pub buffer_id: BufferId,
    pub version: u64,
    pub changes: Vec<TextChange>,
}

// 선택 변경 이벤트
#[derive(Serialize, Clone)]
pub struct EditorSelectionChangedEvent {
    pub buffer_id: BufferId,
    pub selections: Vec<Selection>,
}

// 스크롤 이벤트
#[derive(Serialize, Clone)]
pub struct EditorScrollEvent {
    pub buffer_id: BufferId,
    pub scroll_offset: DisplayPosition,
}
```

### 9.2 File Events

```rust
// 파일 변경 감지 (fs watcher)
#[derive(Serialize, Clone)]
pub struct FileChangedEvent {
    pub path: String,
    pub change_type: FileChangeType,
}

#[derive(Serialize, Clone)]
pub enum FileChangeType {
    Created,
    Modified,
    Deleted,
}

// 파일 저장 완료
#[derive(Serialize, Clone)]
pub struct FileSavedEvent {
    pub buffer_id: BufferId,
    pub path: String,
}
```

### 9.3 LSP Events

```rust
// 진단 업데이트
#[derive(Serialize, Clone)]
pub struct LspDiagnosticsEvent {
    pub buffer_id: BufferId,
    pub diagnostics: Vec<Diagnostic>,
}

// 자동완성 결과 (스트리밍)
#[derive(Serialize, Clone)]
pub struct LspCompletionEvent {
    pub request_id: RequestId,
    pub items: Vec<CompletionItem>,
}

// Inlay hints 업데이트
#[derive(Serialize, Clone)]
pub struct LspInlayHintsEvent {
    pub buffer_id: BufferId,
    pub hints: Vec<InlayHint>,
}
```

---

## 10. 최적화 전략

### 10.1 배치 업데이트 (Batching)

**문제**: 빈번한 IPC는 성능 저하

**해결**:
```rust
pub struct UpdateBatcher {
    pending_updates: Vec<EditorUpdate>,
    flush_interval: Duration,
}

impl UpdateBatcher {
    pub fn add_update(&mut self, update: EditorUpdate) {
        self.pending_updates.push(update);

        // 일정 시간 후 또는 일정 개수 이상이면 flush
        if self.pending_updates.len() >= 10 {
            self.flush();
        }
    }

    pub fn flush(&mut self) {
        if self.pending_updates.is_empty() {
            return;
        }

        // 배치로 전송
        app_handle.emit_all("editor-batch-update", BatchUpdate {
            updates: std::mem::take(&mut self.pending_updates),
        }).ok();
    }
}
```

### 10.2 델타 전송 (Delta Updates)

**문제**: 전체 텍스트 전송은 비효율적

**해결**:
```rust
#[derive(Serialize)]
pub struct TextDelta {
    pub version: u64,
    pub changes: Vec<TextChange>,
}

#[derive(Serialize)]
pub struct TextChange {
    pub start: usize,      // char offset
    pub old_end: usize,    // char offset
    pub new_text: String,
}

// Frontend에서 델타 적용
function applyTextDelta(text: string, delta: TextDelta): string {
    let result = text;
    for (const change of delta.changes.reverse()) {
        result = result.slice(0, change.start)
            + change.new_text
            + result.slice(change.old_end);
    }
    return result;
}
```

### 10.3 디바운싱 (Debouncing)

**문제**: 타이핑 중 매 키마다 IPC는 과도함

**해결**:
```typescript
// Frontend
const debouncedInsert = debounce(async (text: string) => {
    await invoke('editor_insert', { bufferId, text });
}, 16); // ~60 FPS

// 로컬에서 즉시 반영 (낙관적 업데이트)
function handleInput(text: string) {
    // 1. 로컬 상태 즉시 업데이트 (UI 반응성)
    setLocalText((prev) => prev + text);

    // 2. Backend로 디바운스 전송
    debouncedInsert(text);
}
```

### 10.4 우선순위 큐

**중요한 이벤트를 먼저 처리:**
```rust
pub enum EventPriority {
    Critical,   // 사용자 입력
    High,       // LSP 진단
    Normal,     // 파일 변경
    Low,        // 백그라운드 작업
}

pub struct PrioritizedEvent {
    priority: EventPriority,
    event: AppEvent,
}

impl EventQueue {
    pub fn push(&mut self, event: AppEvent, priority: EventPriority) {
        self.queue.push(PrioritizedEvent { priority, event });
        self.queue.sort_by_key(|e| e.priority);
    }
}
```

---

## 11. 에러 처리

### 11.1 에러 타입

```rust
#[derive(Serialize, Deserialize, Debug)]
pub enum AppError {
    BufferNotFound(BufferId),
    FileNotFound(String),
    FileAccessDenied(String),
    LspError(String),
    InvalidPosition { line: u32, column: u32 },
    InvalidRange { start: Position, end: Position },
    Internal(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            AppError::BufferNotFound(id) => write!(f, "Buffer {} not found", id.0),
            AppError::FileNotFound(path) => write!(f, "File not found: {}", path),
            // ...
        }
    }
}

impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}
```

### 11.2 Frontend 에러 처리

```typescript
try {
    await invoke('editor_insert', { bufferId, text });
} catch (error) {
    if (error === 'Buffer not found') {
        // 버퍼가 닫혔을 수 있음
        closeEditorView(bufferId);
    } else {
        // 일반 에러
        showErrorToast(error);
    }
}
```

---

## 12. Frontend Integration (TypeScript)

### 12.1 Tauri API 래퍼

```typescript
// src/lib/ipc.ts

import { invoke, listen } from '@tauri-apps/api';

export const editorAPI = {
    insert: (bufferId: string, position: Position, text: string) =>
        invoke<EditorDelta>('editor_insert', { bufferId, position, text }),

    delete: (bufferId: string, range: Range) =>
        invoke<EditorDelta>('editor_delete', { bufferId, range }),

    moveCursor: (bufferId: string, direction: CursorDirection, extendSelection: boolean) =>
        invoke<SelectionUpdate>('editor_move_cursor', {
            bufferId,
            direction,
            extendSelection,
        }),

    undo: (bufferId: string) =>
        invoke<EditorDelta>('editor_undo', { bufferId }),

    redo: (bufferId: string) =>
        invoke<EditorDelta>('editor_redo', { bufferId }),
};

export const fileAPI = {
    open: (path: string) =>
        invoke<FileOpenResult>('file_open', { path }),

    close: (bufferId: string, force: boolean) =>
        invoke<void>('file_close', { bufferId, force }),

    save: (bufferId: string) =>
        invoke<FileSaveResult>('file_save', { bufferId }),

    saveAs: (bufferId: string, path: string) =>
        invoke<FileSaveResult>('file_save_as', { bufferId, path }),
};

export const lspAPI = {
    completion: (bufferId: string, position: Position) =>
        invoke<CompletionItem[]>('lsp_completion', { bufferId, position }),

    gotoDefinition: (bufferId: string, position: Position) =>
        invoke<Location[]>('lsp_goto_definition', { bufferId, position }),
};
```

### 12.2 Event Listeners

```typescript
// src/lib/events.ts

import { listen, UnlistenFn } from '@tauri-apps/api/event';

export function onEditorTextChanged(
    callback: (event: EditorTextChangedEvent) => void
): Promise<UnlistenFn> {
    return listen<EditorTextChangedEvent>('editor-text-changed', (event) => {
        callback(event.payload);
    });
}

export function onLspDiagnostics(
    callback: (event: LspDiagnosticsEvent) => void
): Promise<UnlistenFn> {
    return listen<LspDiagnosticsEvent>('lsp-diagnostics', (event) => {
        callback(event.payload);
    });
}

// Cleanup
export function cleanupListeners(listeners: UnlistenFn[]) {
    listeners.forEach((unlisten) => unlisten());
}
```

### 12.3 SolidJS Integration

```typescript
// src/components/Editor.tsx

import { createSignal, onMount, onCleanup } from 'solid-js';
import { editorAPI, onEditorTextChanged } from '@/lib/ipc';

function Editor(props: { bufferId: string }) {
    const [editorState, setEditorState] = createSignal<EditorState>();
    let unlistenTextChanged: UnlistenFn | null = null;

    onMount(async () => {
        // Event listener 등록
        unlistenTextChanged = await onEditorTextChanged((event) => {
            if (event.buffer_id === props.bufferId) {
                setEditorState((prev) => ({
                    ...prev,
                    text: applyTextDelta(prev.text, event.changes),
                    version: event.version,
                }));
            }
        });
    });

    onCleanup(() => {
        // Cleanup
        unlistenTextChanged?.();
    });

    const handleInput = async (text: string) => {
        try {
            const delta = await editorAPI.insert(
                props.bufferId,
                getCursorPosition(),
                text
            );
            // Delta는 이미 Event로 수신됨, 여기서는 에러 처리만
        } catch (error) {
            console.error('Failed to insert text:', error);
        }
    };

    return <EditorCanvas state={editorState()} onInput={handleInput} />;
}
```

---

## 13. Shared Memory (고성능 대용량 데이터 전송)

### 13.1 문제점

**기존 JSON IPC의 한계:**
- Visual Coding의 수만 개 노드 위치 데이터
- 대용량 파일 텍스트
- 고빈도 업데이트 (60fps 애니메이션)

이러한 데이터를 JSON으로 직렬화하면:
- 직렬화/역직렬화 오버헤드
- 메모리 복사 비용
- GC 압박 (JavaScript 측)

### 13.2 해결책: SharedArrayBuffer

**Tauri v2 + SharedArrayBuffer를 활용한 Zero-copy 데이터 공유**

```rust
// Rust (Backend)
use std::sync::atomic::{AtomicUsize, Ordering};

pub struct SharedBuffer {
    // 공유 메모리 영역
    data: SharedMemory,
    // 동기화용 atomic
    version: AtomicUsize,
}

pub struct VisualCodingSharedState {
    // 노드 위치 데이터 (Float32Array 형태)
    // [x0, y0, x1, y1, x2, y2, ...]
    node_positions: SharedBuffer,

    // 연결선 데이터
    // [src0, dst0, src1, dst1, ...]
    edge_data: SharedBuffer,

    // 노드 상태 (선택, 호버 등)
    node_states: SharedBuffer,
}

impl VisualCodingSharedState {
    pub fn update_node_position(&self, node_idx: usize, x: f32, y: f32) {
        let offset = node_idx * 2;
        unsafe {
            let ptr = self.node_positions.data.as_ptr() as *mut f32;
            *ptr.add(offset) = x;
            *ptr.add(offset + 1) = y;
        }
        self.node_positions.version.fetch_add(1, Ordering::Release);
    }

    pub fn get_shared_buffer_handle(&self) -> SharedBufferHandle {
        // Frontend로 전달할 핸들 생성
        SharedBufferHandle {
            positions_ptr: self.node_positions.data.as_ptr() as usize,
            positions_len: self.node_positions.data.len(),
            edges_ptr: self.edge_data.data.as_ptr() as usize,
            edges_len: self.edge_data.data.len(),
            states_ptr: self.node_states.data.as_ptr() as usize,
            states_len: self.node_states.data.len(),
        }
    }
}
```

```typescript
// TypeScript (Frontend)
class SharedVisualCodingBuffer {
    private nodePositions: Float32Array;
    private edgeData: Uint32Array;
    private nodeStates: Uint8Array;
    private lastVersion: number = 0;

    async initialize() {
        // Rust에서 SharedArrayBuffer 핸들 획득
        const handle = await invoke<SharedBufferHandle>('get_visual_coding_shared_buffer');

        // SharedArrayBuffer 매핑
        this.nodePositions = new Float32Array(
            new SharedArrayBuffer(handle.positions_len * 4)
        );
        this.edgeData = new Uint32Array(
            new SharedArrayBuffer(handle.edges_len * 4)
        );
        this.nodeStates = new Uint8Array(
            new SharedArrayBuffer(handle.states_len)
        );

        // Rust와 메모리 공유 설정
        await invoke('map_shared_buffer', {
            positions: this.nodePositions.buffer,
            edges: this.edgeData.buffer,
            states: this.nodeStates.buffer
        });
    }

    // Zero-copy 읽기
    getNodePosition(nodeIdx: number): { x: number; y: number } {
        const offset = nodeIdx * 2;
        return {
            x: this.nodePositions[offset],
            y: this.nodePositions[offset + 1]
        };
    }

    // 배치 읽기 (PixiJS 렌더링용)
    getAllPositions(): Float32Array {
        return this.nodePositions; // 복사 없이 직접 반환
    }
}
```

### 13.3 External Buffer (대용량 파일)

**대용량 파일 텍스트를 위한 External Buffer:**

```rust
// Rust
use tauri::ipc::Response;

#[tauri::command]
fn read_large_file(path: String) -> Response {
    let content = std::fs::read(&path).unwrap();

    // External Buffer로 반환 (zero-copy)
    Response::new(content)
}
```

```typescript
// TypeScript
async function openLargeFile(path: string): Promise<Uint8Array> {
    // ArrayBuffer로 직접 수신 (JSON 파싱 없음)
    const buffer = await invoke<ArrayBuffer>('read_large_file', { path });
    return new Uint8Array(buffer);
}
```

### 13.4 MessagePack for Structured Data

**JSON 대신 MessagePack 사용 (더 작고 빠른 직렬화):**

```rust
// Rust
use rmp_serde::{Serializer, Deserializer};

#[tauri::command]
fn get_syntax_tree_msgpack(buffer_id: String) -> Vec<u8> {
    let tree = get_syntax_tree(buffer_id);
    rmp_serde::to_vec(&tree).unwrap()
}
```

```typescript
// TypeScript
import { decode } from '@msgpack/msgpack';

async function getSyntaxTree(bufferId: string): Promise<SyntaxTree> {
    const bytes = await invoke<Uint8Array>('get_syntax_tree_msgpack', { bufferId });
    return decode(bytes) as SyntaxTree;
}
```

### 13.5 적용 시나리오

| 시나리오 | 데이터 크기 | 방식 |
|----------|------------|------|
| 일반 명령/이벤트 | < 1KB | JSON IPC |
| 중간 크기 구조체 | 1KB ~ 100KB | MessagePack |
| 대용량 파일 | > 100KB | External Buffer |
| 실시간 동기화 데이터 | 수만 개 요소 | SharedArrayBuffer |
| 60fps 애니메이션 | 빈번한 업데이트 | SharedArrayBuffer |

---

## 14. 성능 벤치마크 목표

| 작업 | 목표 레이턴시 |
|------|---------------|
| 키 입력 → 화면 업데이트 | < 16ms (60 FPS) |
| 파일 열기 (1MB) | < 100ms |
| 파일 저장 (1MB) | < 50ms |
| LSP 자동완성 | < 200ms |
| 프로젝트 검색 (10K 파일) | < 500ms |
| Visual Coding 노드 렌더링 (10K) | < 16ms |
| SharedBuffer 동기화 | < 1ms |

---

## 15. 구현 체크리스트

### Phase 1: 기본 IPC (Week 1-2)
- [ ] Tauri Command 구조
- [ ] Event 시스템
- [ ] 기본 Editor Commands
- [ ] 기본 File Commands

### Phase 2: LSP Integration (Week 2-3)
- [ ] LSP Commands
- [ ] LSP Events
- [ ] 비동기 처리

### Phase 3: 최적화 (Week 3-4)
- [ ] 배치 업데이트
- [ ] 델타 전송
- [ ] 디바운싱
- [ ] 우선순위 큐

### Phase 4: Frontend Integration (Week 4-5)
- [ ] TypeScript API 래퍼
- [ ] Event Listeners
- [ ] SolidJS 통합
- [ ] 에러 처리

---

## 참고 자료

- [Tauri IPC Documentation](https://tauri.app/v1/guides/features/command)
- [Tauri Events](https://tauri.app/v1/guides/features/events)
- [Serde Documentation](https://serde.rs/)
- [Zed RPC System](https://github.com/zed-industries/zed/tree/main/crates/rpc)
