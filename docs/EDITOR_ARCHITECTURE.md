# Ferrum Editor Architecture

## Overview

Ferrum Editor는 확장 가능하고 고성능인 코드 에디터 아키텍처를 목표로 합니다.
토큰/블록 추적, GUI 오버레이, 플러그인 시스템 등 향후 확장을 고려한 설계입니다.

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

## Key Components

### 1. Document Model

```typescript
interface Document {
  id: string;
  uri: string;
  content: string;
  language: string;
  version: number;
  
  // Token/Block tracking
  tokens: Token[];
  blocks: Block[];
  
  // AST from tree-sitter
  syntaxTree: SyntaxTree | null;
}

interface Token {
  id: string;
  type: TokenType;
  start: Position;
  end: Position;
  text: string;
  metadata?: Record<string, unknown>;
}

interface Block {
  id: string;
  type: BlockType;
  range: Range;
  children: Block[];
  collapsed: boolean;
  decorations: Decoration[];
}
```

### 2. Decoration System

데코레이션은 에디터에 시각적 요소를 추가하는 확장 포인트입니다.

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

interface DecorationOptions {
  className?: string;
  style?: CSSProperties;
  hoverMessage?: string;
  widget?: () => JSX.Element;  // 커스텀 위젯 렌더러
}
```

### 3. Extension Points

#### 3.1 Token Tracker

토큰을 추적하여 GUI 오버레이를 생성할 수 있습니다.

```typescript
interface TokenTracker {
  // 특정 타입의 토큰 추적
  trackTokens(type: TokenType, callback: TokenCallback): Disposable;
  
  // 토큰 위치에 위젯 추가
  addWidgetAtToken(tokenId: string, widget: Widget): Disposable;
  
  // 토큰 범위 가져오기
  getTokenBounds(tokenId: string): DOMRect | null;
}

// 사용 예: 함수 호출에 인라인 타입 힌트 추가
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

#### 3.2 Block Tracker

코드 블록을 추적하여 폴딩, 아웃라인 등을 구현합니다.

```typescript
interface BlockTracker {
  // 블록 변경 감지
  onBlockChange(callback: BlockChangeCallback): Disposable;
  
  // 블록에 데코레이션 추가
  decorateBlock(blockId: string, decoration: Decoration): Disposable;
  
  // 블록 접기/펼치기
  toggleBlock(blockId: string): void;
  
  // 블록 위에 GUI 오버레이 추가
  addOverlay(blockId: string, overlay: OverlayConfig): Disposable;
}
```

#### 3.3 GUI Overlay System

에디터 위에 커스텀 GUI를 렌더링합니다.

```typescript
interface OverlayManager {
  // 특정 위치에 오버레이 추가
  addOverlay(config: OverlayConfig): OverlayHandle;
  
  // 오버레이 업데이트
  updateOverlay(handle: OverlayHandle, config: Partial<OverlayConfig>): void;
  
  // 오버레이 제거
  removeOverlay(handle: OverlayHandle): void;
}

interface OverlayConfig {
  // 위치 지정 방식
  anchor: 
    | { type: 'position'; line: number; column: number }
    | { type: 'token'; tokenId: string }
    | { type: 'block'; blockId: string }
    | { type: 'selection' };
  
  // 렌더링할 컴포넌트
  component: () => JSX.Element;
  
  // 옵션
  options?: {
    followScroll?: boolean;
    zIndex?: number;
    interactive?: boolean;
  };
}
```

### 4. Event System

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

## Scroll System

### 스크롤 관련 핵심 기능

```typescript
interface ScrollController {
  // 특정 라인으로 스크롤
  scrollToLine(line: number, options?: ScrollOptions): void;
  
  // 특정 위치로 스크롤
  scrollToPosition(position: Position, options?: ScrollOptions): void;
  
  // 커서가 보이도록 스크롤
  ensureCursorVisible(): void;
  
  // 현재 보이는 범위
  getVisibleRange(): Range;
  
  // 스크롤 위치
  getScrollPosition(): { top: number; left: number };
}

interface ScrollOptions {
  behavior?: 'auto' | 'smooth';
  block?: 'start' | 'center' | 'end';
  padding?: number;
}
```

## Virtual Scrolling

대용량 파일을 위한 가상 스크롤링 구현:

```typescript
interface VirtualScrollState {
  // 전체 라인 수
  totalLines: number;
  
  // 보이는 라인 범위
  visibleRange: { start: number; end: number };
  
  // 버퍼 (위아래 여유 라인)
  buffer: number;
  
  // 라인 높이
  lineHeight: number;
  
  // 스크롤 위치
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
// 다른 사용자의 커서 위치 표시
interface RemoteCursor {
  userId: string;
  userName: string;
  color: string;
  position: Position;
  selection?: Range;
}
```

## File Structure

```
src/components/editor/
├── Editor.tsx              # 메인 에디터 컴포넌트
├── types.ts                # 타입 정의
├── layers/
│   ├── BackgroundLayer.tsx # 배경 레이어
│   ├── TextLayer.tsx       # 텍스트 렌더링
│   ├── HighlightLayer.tsx  # 구문 강조
│   ├── CursorLayer.tsx     # 커서/선택
│   ├── DecorationLayer.tsx # 데코레이션
│   └── OverlayLayer.tsx    # 오버레이
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

## Performance Considerations

1. **Virtual Scrolling**: 보이는 라인만 렌더링
2. **Debounced Highlights**: 구문 강조 디바운싱
3. **Memoization**: SolidJS의 `createMemo`로 불필요한 재계산 방지
4. **Layer Separation**: 각 레이어 독립적 업데이트
5. **Web Workers**: 무거운 작업은 워커에서 처리

## Migration Path

현재 구조에서 확장 가능한 구조로의 마이그레이션:

1. **Phase 1**: 레이어 분리 (현재 진행 중)
2. **Phase 2**: 토큰/블록 트래커 구현
3. **Phase 3**: 데코레이션 시스템 구현
4. **Phase 4**: 오버레이 시스템 구현
5. **Phase 5**: 확장 API 공개
