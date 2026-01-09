# Editor Engine 설계

> **목적**: Ferrum IDE의 핵심 에디터 엔진 아키텍처 정의

## 1. 개요

### 1.1 설계 원칙

- **Full Control**: 에디터 자체 구현 (Monaco/CodeMirror 사용 안 함)
- **Performance First**: 대용량 파일 (100MB+) 지원
- **Rust Backend**: 모든 텍스트 연산은 Rust에서 수행
- **Frontend Display Only**: SolidJS는 순수 View 렌더링만

### 1.2 참고 아키텍처

- **Zed Editor**: Rope + SumTree 기반 텍스트 버퍼
- **Xi Editor**: CRDT 기반 협업 편집
- **ropey**: Rust Rope 라이브러리

---

## 2. 텍스트 버퍼 (Text Buffer)

### 2.1 Rope 데이터 구조

**선택**: `ropey` 라이브러리 사용

```rust
// External crate
use ropey::Rope;

pub struct TextBuffer {
    rope: Rope,
    id: BufferId,
    path: Option<PathBuf>,
    language: LanguageId,
    dirty: bool,
    version: u64,  // 변경 추적용
}
```

**ropey 특징:**
- B-tree 기반 (Zed의 SumTree와 유사)
- O(log n) 삽입/삭제
- 다차원 인덱싱:
  - 바이트 오프셋
  - 문자 오프셋
  - 라인/컬럼
  - UTF-16 오프셋 (LSP 호환)

**성능:**
- 대용량 파일 (100MB+) 효율적 처리
- 증분 파싱 지원
- 메모리 효율적 (청크 단위 저장)

### 2.2 Buffer 연산

```rust
impl TextBuffer {
    // 기본 연산
    pub fn insert(&mut self, position: Position, text: &str) -> Edit;
    pub fn delete(&mut self, range: Range) -> Edit;
    pub fn replace(&mut self, range: Range, text: &str) -> Edit;

    // 쿼리
    pub fn line(&self, line_index: usize) -> &str;
    pub fn char_at(&self, position: Position) -> Option<char>;
    pub fn len_chars(&self) -> usize;
    pub fn len_lines(&self) -> usize;

    // 변환
    pub fn char_to_byte(&self, char_index: usize) -> usize;
    pub fn byte_to_char(&self, byte_index: usize) -> usize;
    pub fn line_to_char(&self, line: usize) -> usize;
    pub fn char_to_line(&self, char_index: usize) -> usize;

    // LSP 호환
    pub fn position_to_lsp(&self, position: Position) -> lsp_types::Position;
    pub fn lsp_to_position(&self, lsp_pos: lsp_types::Position) -> Position;

    // 스냅샷 (읽기 전용 복사)
    pub fn snapshot(&self) -> BufferSnapshot;
}
```

### 2.3 Position과 Range

```rust
// 내부 표현: 문자 오프셋
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Position {
    pub line: u32,
    pub column: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

impl Position {
    pub fn to_char_offset(&self, buffer: &TextBuffer) -> usize {
        buffer.line_to_char(self.line as usize) + self.column as usize
    }

    pub fn from_char_offset(char_offset: usize, buffer: &TextBuffer) -> Self {
        let line = buffer.char_to_line(char_offset);
        let line_start = buffer.line_to_char(line);
        let column = char_offset - line_start;
        Position {
            line: line as u32,
            column: column as u32,
        }
    }
}
```

---

## 3. Anchor 시스템

### 3.1 개념

**Anchor**: 버퍼의 특정 위치에 고정되어, 편집 시 자동으로 위치가 업데이트되는 마커

**사용 사례:**
- 커서/선택 위치
- 북마크
- 진단 (Diagnostics) 위치
- 코드 폴딩 범위
- Inlay hints 위치

### 3.2 구현 (Zed 참고)

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Bias {
    Left,   // 삽입 시 앵커가 왼쪽으로 이동
    Right,  // 삽입 시 앵커가 오른쪽으로 이동
}

#[derive(Clone, Debug)]
pub struct Anchor {
    char_offset: usize,
    bias: Bias,
    version: u64,  // 버퍼 버전 (캐시 무효화용)
}

impl Anchor {
    pub fn new(position: Position, bias: Bias, buffer: &TextBuffer) -> Self {
        Anchor {
            char_offset: position.to_char_offset(buffer),
            bias,
            version: buffer.version,
        }
    }

    pub fn to_position(&self, buffer: &TextBuffer) -> Position {
        Position::from_char_offset(self.char_offset, buffer)
    }

    // 편집 후 앵커 업데이트
    pub fn apply_edit(&mut self, edit: &Edit) {
        match edit {
            Edit::Insert { position, text } => {
                let insert_offset = position.to_char_offset(buffer);
                if insert_offset < self.char_offset
                    || (insert_offset == self.char_offset && self.bias == Bias::Right)
                {
                    self.char_offset += text.chars().count();
                }
            }
            Edit::Delete { range } => {
                let start_offset = range.start.to_char_offset(buffer);
                let end_offset = range.end.to_char_offset(buffer);

                if self.char_offset >= end_offset {
                    self.char_offset -= end_offset - start_offset;
                } else if self.char_offset > start_offset {
                    self.char_offset = start_offset;
                }
            }
        }
        self.version = edit.new_version;
    }
}
```

### 3.3 AnchorSet

```rust
pub struct AnchorSet {
    anchors: Vec<Anchor>,
    buffer_id: BufferId,
}

impl AnchorSet {
    pub fn new(buffer_id: BufferId) -> Self {
        AnchorSet {
            anchors: Vec::new(),
            buffer_id,
        }
    }

    pub fn insert(&mut self, anchor: Anchor) -> AnchorId {
        self.anchors.push(anchor);
        AnchorId(self.anchors.len() - 1)
    }

    pub fn get(&self, id: AnchorId) -> Option<&Anchor> {
        self.anchors.get(id.0)
    }

    pub fn apply_edit(&mut self, edit: &Edit) {
        for anchor in &mut self.anchors {
            anchor.apply_edit(edit);
        }
    }
}
```

---

## 4. 커서 및 선택 (Cursor & Selection)

### 4.1 Selection 구조

```rust
#[derive(Clone, Debug)]
pub struct Selection {
    pub id: SelectionId,
    pub anchor: Anchor,      // 선택 시작점 (고정)
    pub cursor: Anchor,      // 커서 위치 (이동)
    pub reversed: bool,      // cursor < anchor
    pub goal_column: Option<u32>,  // 상하 이동 시 목표 컬럼
}

impl Selection {
    pub fn is_empty(&self, buffer: &TextBuffer) -> bool {
        self.anchor.to_position(buffer) == self.cursor.to_position(buffer)
    }

    pub fn range(&self, buffer: &TextBuffer) -> Range {
        let anchor_pos = self.anchor.to_position(buffer);
        let cursor_pos = self.cursor.to_position(buffer);

        if self.reversed {
            Range {
                start: cursor_pos,
                end: anchor_pos,
            }
        } else {
            Range {
                start: anchor_pos,
                end: cursor_pos,
            }
        }
    }

    pub fn head(&self) -> &Anchor {
        &self.cursor
    }

    pub fn tail(&self) -> &Anchor {
        &self.anchor
    }
}
```

### 4.2 멀티 커서 (Zed 참고)

```rust
pub struct SelectionSet {
    selections: Vec<Selection>,
    primary_index: usize,
}

impl SelectionSet {
    // 겹치지 않는 선택만 유지
    pub fn normalize(&mut self, buffer: &TextBuffer) {
        // 1. 범위로 정렬
        self.selections.sort_by(|a, b| {
            let a_range = a.range(buffer);
            let b_range = b.range(buffer);
            a_range.start.cmp(&b_range.start)
        });

        // 2. 겹치는 선택 병합
        let mut i = 0;
        while i < self.selections.len() - 1 {
            let current_range = self.selections[i].range(buffer);
            let next_range = self.selections[i + 1].range(buffer);

            if current_range.end >= next_range.start {
                // 병합
                let merged = Selection {
                    id: self.selections[i].id,
                    anchor: self.selections[i].anchor.clone(),
                    cursor: self.selections[i + 1].cursor.clone(),
                    reversed: false,
                    goal_column: None,
                };
                self.selections[i] = merged;
                self.selections.remove(i + 1);
            } else {
                i += 1;
            }
        }
    }

    pub fn add(&mut self, selection: Selection, buffer: &TextBuffer) {
        self.selections.push(selection);
        self.normalize(buffer);
    }

    pub fn primary(&self) -> &Selection {
        &self.selections[self.primary_index]
    }

    pub fn iter(&self) -> impl Iterator<Item = &Selection> {
        self.selections.iter()
    }
}
```

### 4.3 Selection History (Undo/Redo)

```rust
pub struct SelectionHistory {
    entries: VecDeque<SelectionHistoryEntry>,
    current: usize,
    max_entries: usize,
}

struct SelectionHistoryEntry {
    selections: Vec<Selection>,
    edit_id: EditId,
}

impl SelectionHistory {
    pub fn push(&mut self, selections: Vec<Selection>, edit_id: EditId) {
        // 현재 위치 이후 제거
        self.entries.truncate(self.current + 1);

        // 새 엔트리 추가
        self.entries.push_back(SelectionHistoryEntry {
            selections,
            edit_id,
        });

        // 최대 크기 유지
        if self.entries.len() > self.max_entries {
            self.entries.pop_front();
        } else {
            self.current += 1;
        }
    }

    pub fn undo(&mut self) -> Option<&SelectionHistoryEntry> {
        if self.current > 0 {
            self.current -= 1;
            Some(&self.entries[self.current])
        } else {
            None
        }
    }

    pub fn redo(&mut self) -> Option<&SelectionHistoryEntry> {
        if self.current < self.entries.len() - 1 {
            self.current += 1;
            Some(&self.entries[self.current])
        } else {
            None
        }
    }
}
```

---

## 5. Edit 시스템

### 5.1 Edit 구조

```rust
#[derive(Clone, Debug)]
pub enum Edit {
    Insert {
        position: Position,
        text: String,
        old_version: u64,
        new_version: u64,
    },
    Delete {
        range: Range,
        deleted_text: String,
        old_version: u64,
        new_version: u64,
    },
    Replace {
        range: Range,
        old_text: String,
        new_text: String,
        old_version: u64,
        new_version: u64,
    },
}

impl Edit {
    pub fn invert(&self) -> Edit {
        match self {
            Edit::Insert { position, text, old_version, new_version } => {
                let end_position = Position {
                    line: position.line,
                    column: position.column + text.chars().count() as u32,
                };
                Edit::Delete {
                    range: Range {
                        start: *position,
                        end: end_position,
                    },
                    deleted_text: text.clone(),
                    old_version: *new_version,
                    new_version: *old_version,
                }
            }
            Edit::Delete { range, deleted_text, old_version, new_version } => {
                Edit::Insert {
                    position: range.start,
                    text: deleted_text.clone(),
                    old_version: *new_version,
                    new_version: *old_version,
                }
            }
            Edit::Replace { range, old_text, new_text, old_version, new_version } => {
                Edit::Replace {
                    range: *range,
                    old_text: new_text.clone(),
                    new_text: old_text.clone(),
                    old_version: *new_version,
                    new_version: *old_version,
                }
            }
        }
    }
}
```

### 5.2 Edit History (Undo/Redo)

```rust
pub struct EditHistory {
    undos: Vec<Transaction>,
    redos: Vec<Transaction>,
    current_transaction: Option<Transaction>,
    max_entries: usize,
}

pub struct Transaction {
    edits: Vec<Edit>,
    selections_before: Vec<Selection>,
    selections_after: Vec<Selection>,
}

impl EditHistory {
    pub fn begin_transaction(&mut self, selections: Vec<Selection>) {
        self.current_transaction = Some(Transaction {
            edits: Vec::new(),
            selections_before: selections,
            selections_after: Vec::new(),
        });
    }

    pub fn add_edit(&mut self, edit: Edit) {
        if let Some(transaction) = &mut self.current_transaction {
            transaction.edits.push(edit);
        }
    }

    pub fn end_transaction(&mut self, selections: Vec<Selection>) {
        if let Some(mut transaction) = self.current_transaction.take() {
            transaction.selections_after = selections;

            // Redo 스택 클리어
            self.redos.clear();

            // Undo 스택에 추가
            self.undos.push(transaction);

            // 최대 크기 유지
            if self.undos.len() > self.max_entries {
                self.undos.remove(0);
            }
        }
    }

    pub fn undo(&mut self, buffer: &mut TextBuffer) -> Option<Vec<Selection>> {
        if let Some(transaction) = self.undos.pop() {
            // 역순으로 편집 되돌리기
            for edit in transaction.edits.iter().rev() {
                let inverted = edit.invert();
                buffer.apply_edit(&inverted);
            }

            // Redo 스택에 추가
            self.redos.push(transaction.clone());

            Some(transaction.selections_before)
        } else {
            None
        }
    }

    pub fn redo(&mut self, buffer: &mut TextBuffer) -> Option<Vec<Selection>> {
        if let Some(transaction) = self.redos.pop() {
            // 편집 재적용
            for edit in &transaction.edits {
                buffer.apply_edit(edit);
            }

            // Undo 스택에 추가
            self.undos.push(transaction.clone());

            Some(transaction.selections_after)
        } else {
            None
        }
    }
}
```

---

## 6. DisplayMap (좌표 변환 파이프라인)

### 6.1 개념 (Zed 참고)

**목적**: 버퍼 좌표 → 화면 좌표 변환

**파이프라인:**
```
Buffer Text (실제 텍스트)
  ↓
InlayMap        (LSP 인레이 힌트 삽입)
  ↓
FoldMap         (코드 폴딩)
  ↓
TabMap          (탭 → 스페이스)
  ↓
WrapMap         (소프트 래핑)
  ↓
BlockMap        (커스텀 블록: 진단, 트리 뷰어 헤더)
  ↓
Display Coordinates (화면 좌표)
```

### 6.2 구현

```rust
pub struct DisplayMap {
    buffer: Arc<TextBuffer>,
    inlay_map: InlayMap,
    fold_map: FoldMap,
    tab_map: TabMap,
    wrap_map: WrapMap,
    block_map: BlockMap,
}

impl DisplayMap {
    pub fn buffer_to_display(&self, buffer_pos: Position) -> DisplayPosition {
        let mut pos = buffer_pos;

        // 각 레이어를 순차적으로 통과
        pos = self.inlay_map.buffer_to_inlay(pos);
        pos = self.fold_map.inlay_to_fold(pos);
        pos = self.tab_map.fold_to_tab(pos);
        pos = self.wrap_map.tab_to_wrap(pos);
        pos = self.block_map.wrap_to_block(pos);

        DisplayPosition { line: pos.line, column: pos.column }
    }

    pub fn display_to_buffer(&self, display_pos: DisplayPosition) -> Position {
        let mut pos = Position {
            line: display_pos.line,
            column: display_pos.column,
        };

        // 역순으로 통과
        pos = self.block_map.block_to_wrap(pos);
        pos = self.wrap_map.wrap_to_tab(pos);
        pos = self.tab_map.tab_to_fold(pos);
        pos = self.fold_map.fold_to_inlay(pos);
        pos = self.inlay_map.inlay_to_buffer(pos);

        pos
    }

    // 증분 업데이트
    pub fn sync(&mut self, buffer: &TextBuffer, edits: &[Edit]) {
        self.inlay_map.sync(buffer, edits);
        self.fold_map.sync(&self.inlay_map, edits);
        self.tab_map.sync(&self.fold_map, edits);
        self.wrap_map.sync(&self.tab_map, edits);
        self.block_map.sync(&self.wrap_map, edits);
    }
}
```

### 6.3 각 레이어 설계

#### InlayMap
```rust
pub struct InlayMap {
    hints: BTreeMap<Position, InlayHint>,
}

pub struct InlayHint {
    position: Position,
    text: String,
    kind: InlayHintKind,
}

pub enum InlayHintKind {
    Type,
    Parameter,
}
```

#### FoldMap
```rust
pub struct FoldMap {
    folds: BTreeMap<Range, Fold>,
}

pub struct Fold {
    range: Range,
    placeholder: String,  // 예: "..." 또는 "{ ... }"
}
```

#### TabMap
```rust
pub struct TabMap {
    tab_size: u32,  // 스페이스 개수
}

// 탭을 스페이스로 확장
impl TabMap {
    pub fn fold_to_tab(&self, pos: Position) -> Position {
        // 탭 문자를 tab_size 만큼 스페이스로 확장
        // 컬럼 조정
    }
}
```

#### WrapMap
```rust
pub struct WrapMap {
    wrap_width: Option<u32>,  // None이면 래핑 안 함
    soft_wraps: BTreeMap<u32, Vec<u32>>,  // line -> [wrap columns]
}
```

#### BlockMap
```rust
pub struct BlockMap {
    blocks: BTreeMap<u32, Block>,  // line -> block
}

pub struct Block {
    line: u32,
    height: u32,       // 라인 수
    content: BlockContent,
}

pub enum BlockContent {
    Diagnostic(Diagnostic),
    TreeViewerHeader { level: u32, text: String },
    CustomWidget { id: String },
}
```

---

## 7. BufferSnapshot (읽기 전용 복사)

### 7.1 개념

**목적**: 비동기 작업(LSP, Tree-sitter 파싱)에서 버퍼의 일관된 뷰 제공

```rust
#[derive(Clone)]
pub struct BufferSnapshot {
    rope: Rope,
    version: u64,
    buffer_id: BufferId,
}

impl BufferSnapshot {
    // TextBuffer와 동일한 읽기 메서드
    pub fn line(&self, line_index: usize) -> &str;
    pub fn len_lines(&self) -> usize;
    pub fn text(&self) -> String;
    // ...
}
```

### 7.2 사용 예

```rust
// 메인 스레드
let snapshot = buffer.snapshot();

// 백그라운드 스레드
tokio::spawn(async move {
    let tree = parse_tree_sitter(&snapshot);
    // snapshot은 안전하게 사용 가능
});
```

---

## 8. Tree-sitter 증분 파싱 (Incremental Parsing)

### 8.1 핵심 원칙

**문제**: 텍스트가 바뀔 때마다 전체를 다시 파싱하면 프레임 드랍 발생

**해결**: ropey의 변경된 구간(Span)만 tree-sitter에 전달하여 증분 파싱

### 8.2 Edit → InputEdit 변환

```rust
use tree_sitter::{InputEdit, Point, Parser, Tree};

pub struct SyntaxManager {
    parser: Parser,
    tree: Option<Tree>,
    language: tree_sitter::Language,
}

impl SyntaxManager {
    /// ropey edit을 tree-sitter InputEdit으로 변환
    fn rope_edit_to_input_edit(
        &self,
        rope: &Rope,
        edit_start_byte: usize,
        edit_old_end_byte: usize,
        edit_new_end_byte: usize,
    ) -> InputEdit {
        // Byte offset → Line/Column 변환
        let start_position = self.byte_to_point(rope, edit_start_byte);
        let old_end_position = self.byte_to_point(rope, edit_old_end_byte);
        let new_end_position = self.byte_to_point(rope, edit_new_end_byte);

        InputEdit {
            start_byte: edit_start_byte,
            old_end_byte: edit_old_end_byte,
            new_end_byte: edit_new_end_byte,
            start_position,
            old_end_position,
            new_end_position,
        }
    }

    fn byte_to_point(&self, rope: &Rope, byte_offset: usize) -> Point {
        let line = rope.byte_to_line(byte_offset);
        let line_start = rope.line_to_byte(line);
        let column = byte_offset - line_start;
        Point::new(line, column)
    }

    /// 증분 파싱 수행
    pub fn apply_edit(&mut self, rope: &Rope, edit: &TextEdit) {
        // 1. 기존 트리에 edit 적용
        if let Some(tree) = &mut self.tree {
            let input_edit = self.rope_edit_to_input_edit(
                rope,
                edit.start_byte,
                edit.old_end_byte,
                edit.new_end_byte,
            );
            tree.edit(&input_edit);
        }

        // 2. 증분 파싱 (변경된 부분만)
        self.reparse(rope);
    }

    /// Rope를 읽는 콜백 제공 (대용량 파일 최적화)
    fn reparse(&mut self, rope: &Rope) {
        // Rope 청크 단위로 읽기 (전체 문자열 변환 없음)
        let new_tree = self.parser.parse_with(
            &mut |byte_offset, _position| {
                // Rope에서 해당 위치의 청크 반환
                if byte_offset >= rope.len_bytes() {
                    return &[];
                }
                let (chunk, chunk_byte_start, _, _) = rope.chunk_at_byte(byte_offset);
                &chunk.as_bytes()[byte_offset - chunk_byte_start..]
            },
            self.tree.as_ref(), // 기존 트리 참조 (증분 파싱)
        );

        self.tree = new_tree;
    }
}
```

### 8.3 EditTransaction과 통합

```rust
impl TextBuffer {
    pub fn apply_edit(&mut self, edit: &Edit) -> EditResult {
        // 1. Edit 전 상태 저장
        let start_byte = self.rope.char_to_byte(edit.start_char());
        let old_end_byte = self.rope.char_to_byte(edit.old_end_char());

        // 2. Rope에 편집 적용
        match edit {
            Edit::Insert { position, text, .. } => {
                let char_offset = position.to_char_offset(self);
                self.rope.insert(char_offset, text);
            }
            Edit::Delete { range, .. } => {
                let start = range.start.to_char_offset(self);
                let end = range.end.to_char_offset(self);
                self.rope.remove(start..end);
            }
            Edit::Replace { range, new_text, .. } => {
                let start = range.start.to_char_offset(self);
                let end = range.end.to_char_offset(self);
                self.rope.remove(start..end);
                self.rope.insert(start, new_text);
            }
        }

        // 3. Edit 후 상태 계산
        let new_end_byte = match edit {
            Edit::Insert { position, text, .. } => {
                start_byte + text.len()
            }
            Edit::Delete { .. } => start_byte,
            Edit::Replace { new_text, .. } => {
                start_byte + new_text.len()
            }
        };

        // 4. Tree-sitter 증분 파싱 요청
        EditResult {
            invalidated_bytes: (start_byte, old_end_byte, new_end_byte),
            version: self.version,
        }
    }
}
```

### 8.4 비동기 파싱 (UI 블로킹 방지)

```rust
use tokio::sync::mpsc;

pub struct AsyncSyntaxManager {
    tx: mpsc::Sender<SyntaxRequest>,
    current_tree: Arc<RwLock<Option<Tree>>>,
}

enum SyntaxRequest {
    FullParse { rope_snapshot: Rope },
    IncrementalParse {
        rope_snapshot: Rope,
        input_edit: InputEdit,
    },
}

impl AsyncSyntaxManager {
    pub fn spawn_parser_thread(language: tree_sitter::Language) -> Self {
        let (tx, mut rx) = mpsc::channel::<SyntaxRequest>(32);
        let current_tree = Arc::new(RwLock::new(None));
        let tree_ref = current_tree.clone();

        // 별도 OS 스레드에서 파싱 수행
        std::thread::spawn(move || {
            let mut parser = Parser::new();
            parser.set_language(&language).unwrap();
            let mut tree: Option<Tree> = None;

            while let Some(request) = rx.blocking_recv() {
                match request {
                    SyntaxRequest::FullParse { rope_snapshot } => {
                        tree = parser.parse_with(
                            &mut |offset, _| rope_chunk_at(&rope_snapshot, offset),
                            None,
                        );
                    }
                    SyntaxRequest::IncrementalParse { rope_snapshot, input_edit } => {
                        if let Some(ref mut t) = tree {
                            t.edit(&input_edit);
                        }
                        tree = parser.parse_with(
                            &mut |offset, _| rope_chunk_at(&rope_snapshot, offset),
                            tree.as_ref(),
                        );
                    }
                }

                // 결과 트리 업데이트
                *tree_ref.write().unwrap() = tree.clone();
            }
        });

        Self { tx, current_tree }
    }

    pub fn request_incremental_parse(&self, rope: Rope, edit: InputEdit) {
        let _ = self.tx.try_send(SyntaxRequest::IncrementalParse {
            rope_snapshot: rope,
            input_edit: edit,
        });
    }

    pub fn get_current_tree(&self) -> Option<Tree> {
        self.current_tree.read().unwrap().clone()
    }
}

fn rope_chunk_at(rope: &Rope, byte_offset: usize) -> &[u8] {
    if byte_offset >= rope.len_bytes() {
        return &[];
    }
    let (chunk, chunk_start, _, _) = rope.chunk_at_byte(byte_offset);
    &chunk.as_bytes()[byte_offset - chunk_start..]
}
```

### 8.5 성능 벤치마크

| 작업 | 전체 파싱 | 증분 파싱 |
|------|----------|----------|
| 단일 문자 삽입 | ~50ms (10K lines) | ~0.5ms |
| 100자 붙여넣기 | ~50ms | ~2ms |
| 1000줄 삭제 | ~50ms | ~10ms |
| 프레임 드랍 없는 타이핑 | ❌ | ✅ |

---

## 9. 성능 최적화

### 9.1 증분 업데이트

**원칙**: 전체 재계산 방지, 변경된 부분만 업데이트

```rust
impl TextBuffer {
    pub fn apply_edit(&mut self, edit: &Edit) -> Vec<InvalidatedRange> {
        // 1. Rope에 편집 적용
        match edit {
            Edit::Insert { position, text, .. } => {
                let char_offset = position.to_char_offset(self);
                self.rope.insert(char_offset, text);
            }
            // ...
        }

        // 2. 버전 증가
        self.version += 1;
        self.dirty = true;

        // 3. 무효화된 범위 반환 (Tree-sitter, LSP 등에서 사용)
        vec![InvalidatedRange {
            start: edit.start(),
            end: edit.end(),
        }]
    }
}
```

### 9.2 메모리 최적화

```rust
// Rope 청크 크기 조정 (ropey 기본값 사용)
// - 작은 파일: 빠른 조회
// - 큰 파일: 메모리 효율

// AnchorSet 용량 사전 할당
impl AnchorSet {
    pub fn with_capacity(capacity: usize, buffer_id: BufferId) -> Self {
        AnchorSet {
            anchors: Vec::with_capacity(capacity),
            buffer_id,
        }
    }
}
```

### 9.3 캐싱

```rust
pub struct EditorCache {
    // 라인 높이 캐시 (렌더링용)
    line_heights: HashMap<u32, u32>,

    // 폴딩 상태 캐시
    fold_states: HashMap<Range, bool>,

    // 구문 하이라이트 캐시 (Tree-sitter 결과)
    highlight_cache: HashMap<u32, Vec<HighlightSpan>>,
}
```

---

## 10. 통합 구조

### 10.1 Editor 구조

```rust
pub struct Editor {
    buffer_id: BufferId,
    display_map: DisplayMap,
    selections: SelectionSet,
    anchor_set: AnchorSet,
    edit_history: EditHistory,
    selection_history: SelectionHistory,
    cache: EditorCache,

    // 설정
    tab_size: u32,
    wrap_width: Option<u32>,
    show_line_numbers: bool,

    // 스크롤
    scroll_offset: DisplayPosition,
    viewport_height: u32,
}

impl Editor {
    // 편집 명령
    pub fn insert_text(&mut self, text: &str);
    pub fn delete_selection(&mut self);
    pub fn backspace(&mut self);
    pub fn delete(&mut self);

    // 커서 이동
    pub fn move_cursor_up(&mut self);
    pub fn move_cursor_down(&mut self);
    pub fn move_cursor_left(&mut self);
    pub fn move_cursor_right(&mut self);

    // 선택
    pub fn select_up(&mut self);
    pub fn select_down(&mut self);
    pub fn select_all(&mut self);

    // Undo/Redo
    pub fn undo(&mut self);
    pub fn redo(&mut self);
}
```

### 10.2 BufferManager

```rust
pub struct BufferManager {
    buffers: HashMap<BufferId, Arc<Mutex<TextBuffer>>>,
    next_id: BufferId,
}

impl BufferManager {
    pub fn open_file(&mut self, path: PathBuf) -> Result<BufferId>;
    pub fn close_buffer(&mut self, id: BufferId);
    pub fn get_buffer(&self, id: BufferId) -> Option<Arc<Mutex<TextBuffer>>>;
    pub fn save_buffer(&mut self, id: BufferId) -> Result<()>;
}
```

---

## 11. Frontend 통합 (IPC)

### 11.1 Tauri Command

```rust
#[tauri::command]
async fn editor_insert_text(
    buffer_id: BufferId,
    text: String,
    state: State<'_, AppState>,
) -> Result<EditorUpdate, String> {
    let mut editor = state.get_editor(buffer_id)?;
    editor.insert_text(&text);

    // 델타 업데이트 반환
    Ok(EditorUpdate {
        buffer_id,
        text_delta: compute_delta(&editor),
        selections: editor.selections.clone(),
        scroll_offset: editor.scroll_offset,
    })
}
```

### 11.2 Frontend Event

```typescript
// SolidJS Component
function EditorView(props: { bufferId: string }) {
  const [editorState, setEditorState] = createSignal<EditorState>();

  // IPC 이벤트 수신
  listen<EditorUpdate>('editor-update', (event) => {
    if (event.payload.buffer_id === props.bufferId) {
      setEditorState(event.payload);
    }
  });

  // 텍스트 삽입 명령 전송
  const insertText = async (text: string) => {
    await invoke('editor_insert_text', {
      bufferId: props.bufferId,
      text,
    });
  };

  return <EditorCanvas state={editorState()} />;
}
```

---

## 12. 테스트 전략

### 12.1 Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rope_insert() {
        let mut buffer = TextBuffer::new();
        buffer.insert(Position { line: 0, column: 0 }, "Hello");
        assert_eq!(buffer.text(), "Hello");
    }

    #[test]
    fn test_anchor_update() {
        let mut buffer = TextBuffer::new();
        buffer.insert(Position { line: 0, column: 0 }, "Hello");

        let anchor = Anchor::new(
            Position { line: 0, column: 5 },
            Bias::Left,
            &buffer,
        );

        buffer.insert(Position { line: 0, column: 0 }, "World ");
        // anchor는 자동으로 업데이트되어야 함
        assert_eq!(anchor.to_position(&buffer), Position { line: 0, column: 11 });
    }

    #[test]
    fn test_multi_cursor_normalization() {
        let buffer = TextBuffer::new();
        let mut selections = SelectionSet::new();

        // 겹치는 선택 추가
        selections.add(
            Selection::new(
                Position { line: 0, column: 0 },
                Position { line: 0, column: 5 },
            ),
            &buffer,
        );
        selections.add(
            Selection::new(
                Position { line: 0, column: 3 },
                Position { line: 0, column: 8 },
            ),
            &buffer,
        );

        selections.normalize(&buffer);

        // 병합되어 1개만 남아야 함
        assert_eq!(selections.len(), 1);
    }
}
```

### 11.2 Integration Tests

```rust
#[tokio::test]
async fn test_edit_history() {
    let mut buffer = TextBuffer::new();
    let mut history = EditHistory::new();

    history.begin_transaction(vec![]);
    buffer.insert(Position { line: 0, column: 0 }, "Hello");
    history.end_transaction(vec![]);

    history.begin_transaction(vec![]);
    buffer.insert(Position { line: 0, column: 5 }, " World");
    history.end_transaction(vec![]);

    assert_eq!(buffer.text(), "Hello World");

    history.undo(&mut buffer);
    assert_eq!(buffer.text(), "Hello");

    history.redo(&mut buffer);
    assert_eq!(buffer.text(), "Hello World");
}
```

---

## 13. 구현 로드맵

### Phase 1: 기본 텍스트 버퍼 (Week 1-2)
- [ ] ropey 통합
- [ ] TextBuffer 구조
- [ ] Position/Range
- [ ] 기본 편집 연산 (insert, delete)

### Phase 2: Anchor 시스템 (Week 2-3)
- [ ] Anchor 구현
- [ ] AnchorSet
- [ ] Edit 시 자동 업데이트

### Phase 3: 커서/선택 (Week 3-4)
- [ ] Selection 구조
- [ ] 멀티 커서
- [ ] 정규화 (겹침 방지)

### Phase 4: Edit History (Week 4-5)
- [ ] Transaction 시스템
- [ ] Undo/Redo
- [ ] Selection History

### Phase 5: DisplayMap (Week 5-7)
- [ ] 각 레이어 구현
- [ ] 좌표 변환
- [ ] 증분 업데이트

### Phase 6: Editor 통합 (Week 7-8)
- [ ] Editor 구조
- [ ] BufferManager
- [ ] 기본 명령어

### Phase 7: Frontend 통합 (Week 8-10)
- [ ] Tauri Command
- [ ] IPC 최적화
- [ ] Canvas 렌더링

---

## 참고 자료

- [Zed Editor - Rope](https://github.com/zed-industries/zed/tree/main/crates/rope)
- [ropey Documentation](https://docs.rs/ropey/)
- [Xi Editor - Rope Science](https://xi-editor.io/docs/rope_science_00.html)
- [Text Editor Data Structures](https://cdacamar.github.io/data%20structures/algorithms/benchmarking/text%20editors/c++/editor-data-structures/)
