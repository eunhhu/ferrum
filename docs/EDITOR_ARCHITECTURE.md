# Ferrum Editor Architecture

## 개요

Ferrum Editor는 확장 가능하고 고성능인 코드 에디터 아키텍처를 목표로 합니다.
이 문서는 프론트엔드 레이어 구조와 확장 시스템에 대한 개요를 제공합니다.

> **상세 백엔드 아키텍처**: `plans/architecture/editor-engine.md` 참조  
> **IPC 프로토콜**: `plans/architecture/ipc-protocol.md` 참조

---

## 설계 원칙

| 원칙 | 설명 |
|------|------|
| **Full Control** | Monaco/CodeMirror 없이 에디터 자체 구현 |
| **Performance First** | 대용량 파일 (100MB+) 지원 |
| **Rust Backend** | 모든 텍스트 연산은 Rust에서 수행 |
| **Frontend Display Only** | SolidJS는 순수 View 렌더링만 담당 |

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        App Shell                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ StickyHeader│  │  Minimap    │  │   Command Palette   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     Editor Container                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Layer Stack                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ L5: Overlay Layer (tooltips, autocomplete)      │  │  │
│  │  ├─────────────────────────────────────────────────┤  │  │
│  │  │ L4: Decoration Layer (inline widgets, badges)   │  │  │
│  │  ├─────────────────────────────────────────────────┤  │  │
│  │  │ L3: Cursor & Selection Layer                    │  │  │
│  │  ├─────────────────────────────────────────────────┤  │  │
│  │  │ L2: Syntax Highlight Layer                      │  │  │
│  │  ├─────────────────────────────────────────────────┤  │  │
│  │  │ L1: Text Content Layer                          │  │  │
│  │  ├─────────────────────────────────────────────────┤  │  │
│  │  │ L0: Background Layer (line highlights, etc)     │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 백엔드 핵심 컴포넌트

### 1. Text Buffer (ropey)

Rope 데이터 구조 기반의 고성능 텍스트 버퍼입니다.

```rust
pub struct TextBuffer {
    rope: Rope,           // ropey 라이브러리
    id: BufferId,
    path: Option<PathBuf>,
    language: LanguageId,
    dirty: bool,
    version: u64,
}
```

**성능 특성:**
- O(log n) 삽입/삭제
- 100MB+ 파일 효율적 처리
- 증분 파싱 지원

### 2. Anchor 시스템

편집 시 자동으로 위치가 업데이트되는 마커 시스템입니다.

```rust
pub struct Anchor {
    char_offset: usize,
    bias: Bias,      // Left 또는 Right
    version: u64,
}
```

**사용처:**
- 커서/선택 위치
- 북마크
- 진단 (Diagnostics) 위치
- 코드 폴딩 범위

### 3. DisplayMap (좌표 변환)

버퍼 좌표 → 화면 좌표 변환 파이프라인입니다.

```
Buffer Text → InlayMap → FoldMap → TabMap → WrapMap → BlockMap → Display
```

각 레이어:
- **InlayMap**: LSP 인레이 힌트 삽입
- **FoldMap**: 코드 폴딩
- **TabMap**: 탭 → 스페이스 변환
- **WrapMap**: 소프트 래핑
- **BlockMap**: 커스텀 블록 (진단, 위젯)

---

## 프론트엔드 컴포넌트

### Document Model

```typescript
interface Document {
  id: string;
  uri: string;
  content: string;
  language: string;
  version: number;
  
  // Token/Block tracking (백엔드에서 제공)
  tokens: Token[];
  blocks: Block[];
  syntaxTree: SyntaxTree | null;
}

interface Token {
  id: string;
  type: TokenType;
  start: Position;
  end: Position;
  text: string;
}

interface Block {
  id: string;
  type: BlockType;
  range: Range;
  children: Block[];
  collapsed: boolean;
}
```

### Decoration System

에디터에 시각적 요소를 추가하는 확장 포인트입니다.

```typescript
interface Decoration {
  id: string;
  type: DecorationType;
  range: Range;
  options: DecorationOptions;
}

type DecorationType = 
  | 'highlight'      // 배경 하이라이트
  | 'underline'      // 밑줄
  | 'badge'          // 인라인 배지
  | 'widget'         // 커스텀 위젯
  | 'gutter-icon'    // 거터 아이콘
  | 'line-class';    // 라인 전체 스타일
```

---

## Extension Points

### Token Tracker

토큰을 추적하여 GUI 오버레이를 생성합니다.

```typescript
// 함수 호출에 인라인 타입 힌트 추가 예시
tokenTracker.trackTokens('function_call', (token) => {
  const typeHint = inferType(token);
  return {
    decoration: {
      type: 'badge',
      content: typeHint,
      position: 'after'
    }
  };
});
```

### Block Tracker

코드 블록을 추적하여 폴딩, 아웃라인 등을 구현합니다.

```typescript
interface BlockTracker {
  onBlockChange(callback: BlockChangeCallback): Disposable;
  decorateBlock(blockId: string, decoration: Decoration): Disposable;
  toggleBlock(blockId: string): void;
  addOverlay(blockId: string, overlay: OverlayConfig): Disposable;
}
```

### GUI Overlay System

에디터 위에 커스텀 GUI를 렌더링합니다.

```typescript
interface OverlayConfig {
  anchor: 
    | { type: 'position'; line: number; column: number }
    | { type: 'token'; tokenId: string }
    | { type: 'block'; blockId: string }
    | { type: 'selection' };
  
  component: () => JSX.Element;
  
  options?: {
    followScroll?: boolean;
    zIndex?: number;
    interactive?: boolean;
  };
}
```

---

## Event System

```typescript
interface EditorEvents {
  // 문서 이벤트
  onDocumentChange: Event<DocumentChangeEvent>;
  onDocumentSave: Event<DocumentSaveEvent>;
  
  // 커서/선택 이벤트
  onCursorChange: Event<CursorChangeEvent>;
  onSelectionChange: Event<SelectionChangeEvent>;
  
  // 스크롤 이벤트
  onScroll: Event<ScrollEvent>;
  onVisibleRangeChange: Event<VisibleRangeEvent>;
  
  // 토큰/블록 이벤트
  onTokenHover: Event<TokenHoverEvent>;
  onBlockEnter: Event<BlockEvent>;
  onBlockLeave: Event<BlockEvent>;
}
```

---

## Virtual Scrolling

대용량 파일을 위한 가상 스크롤링 구현입니다.

```typescript
interface VirtualScrollState {
  totalLines: number;
  visibleRange: { start: number; end: number };
  buffer: number;        // 위아래 여유 라인
  lineHeight: number;
  scrollTop: number;
}

// 보이는 라인만 렌더링
const visibleLines = createMemo(() => {
  const { start, end } = visibleRange();
  return lines.slice(start, end).map((content, i) => ({
    number: start + i,
    content,
  }));
});
```

---

## Scroll Controller

```typescript
interface ScrollController {
  scrollToLine(line: number, options?: ScrollOptions): void;
  scrollToPosition(position: Position, options?: ScrollOptions): void;
  ensureCursorVisible(): void;
  getVisibleRange(): Range;
  getScrollPosition(): { top: number; left: number };
}

interface ScrollOptions {
  behavior?: 'auto' | 'smooth';
  block?: 'start' | 'center' | 'end';
  padding?: number;
}
```

---

## Future Extensions

### 1. Inline Type Hints
```typescript
// TypeScript 타입 추론 결과를 인라인으로 표시
const x = getValue(); // : string
```

### 2. Code Lens
```typescript
// 함수 위에 참조 횟수, 테스트 실행 버튼 등 표시
// 3 references | Run Test | Debug
function myFunction() { ... }
```

### 3. Inline Diff
```typescript
// Git 변경사항을 인라인으로 표시
- const old = "value";
+ const new = "newValue";
```

### 4. Collaborative Cursors
```typescript
// 다른 사용자의 커서 위치 표시 (협업 기능)
interface RemoteCursor {
  userId: string;
  userName: string;
  color: string;
  position: Position;
  selection?: Range;
}
```

---

## File Structure

```
src/components/editor/
├── Editor.tsx              # 메인 에디터 컴포넌트
├── types.ts                # 타입 정의
├── layers/
│   ├── BackgroundLayer.tsx # L0: 배경 레이어
│   ├── TextLayer.tsx       # L1: 텍스트 렌더링
│   ├── HighlightLayer.tsx  # L2: 구문 강조
│   ├── CursorLayer.tsx     # L3: 커서/선택
│   ├── DecorationLayer.tsx # L4: 데코레이션
│   └── OverlayLayer.tsx    # L5: 오버레이
├── hooks/
│   ├── useDocument.ts      # 문서 상태 관리
│   ├── useTokenTracker.ts  # 토큰 추적
│   ├── useBlockTracker.ts  # 블록 추적
│   ├── useScroll.ts        # 스크롤 관리
│   └── useDecorations.ts   # 데코레이션 관리
└── extensions/
    ├── Extension.ts        # 확장 베이스 클래스
    ├── TypeHints.ts        # 타입 힌트 확장
    ├── CodeLens.ts         # 코드 렌즈 확장
    └── InlineDiff.ts       # 인라인 diff 확장
```

---

## Performance Considerations

| 최적화 | 설명 |
|--------|------|
| **Virtual Scrolling** | 보이는 라인만 렌더링 |
| **Debounced Highlights** | 구문 강조 디바운싱 (50ms) |
| **Memoization** | SolidJS `createMemo`로 재계산 방지 |
| **Layer Separation** | 각 레이어 독립적 업데이트 |
| **Web Workers** | 무거운 작업은 워커에서 처리 |
| **Incremental Parsing** | tree-sitter 증분 파싱 |

### 성능 타겟

| 지표 | 목표 |
|------|------|
| 입력 지연 | < 16ms (60fps) |
| 초기 로딩 | < 500ms |
| 대용량 파일 (10MB) | < 50ms 입력 지연 |
| 구문 강조 | < 50ms (증분) |

---

## 관련 문서

- **백엔드 엔진**: `plans/architecture/editor-engine.md`
- **IPC 프로토콜**: `plans/architecture/ipc-protocol.md`
- **플러그인 시스템**: `plans/architecture/plugin-system.md`
- **View Mode 시스템**: `plans/architecture/view-mode-system.md`

---

## Migration Path

현재 구조에서 확장 가능한 구조로의 마이그레이션:

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | 레이어 분리 | ✅ 완료 |
| 2 | 토큰/블록 트래커 구현 | 🔄 진행 중 |
| 3 | 데코레이션 시스템 구현 | ⏳ 예정 |
| 4 | 오버레이 시스템 구현 | ⏳ 예정 |
| 5 | 확장 API 공개 | ⏳ 예정 |
