# Frontend 성능 최적화

> **목적**: SolidJS 기반 프런트엔드의 렌더링 최적화 및 애니메이션 성능 가이드

## 1. 컴포넌트 렌더링 최적화

### 1.1 Fine-grained Signals 원칙

**components.md에서 정의한 수많은 컴포넌트들을 SolidJS로 구현할 때, 최대한 미세 조정(Fine-grained)된 Signal을 사용해야 합니다.**

**문제**: 트리 뷰의 아이템 하나가 Hover될 때 전체 트리가 리렌더링됨

**해결**: 개별 컴포넌트 내부에서 상태를 닫아두기

```typescript
// BAD: 전체 트리가 리렌더링됨
function FileTree(props: { files: FileNode[] }) {
    const [hoveredId, setHoveredId] = createSignal<string | null>(null);

    return (
        <For each={props.files}>
            {(file) => (
                // hoveredId가 바뀔 때마다 모든 FileItem이 리렌더링
                <FileItem
                    file={file}
                    isHovered={hoveredId() === file.id}
                    onHover={() => setHoveredId(file.id)}
                />
            )}
        </For>
    );
}

// GOOD: 각 아이템이 자체 hover 상태 관리
function FileTree(props: { files: FileNode[] }) {
    return (
        <For each={props.files}>
            {(file) => <FileItem file={file} />}
        </For>
    );
}

function FileItem(props: { file: FileNode }) {
    // 개별 컴포넌트 내부에서 hover 상태 관리
    const [isHovered, setIsHovered] = createSignal(false);

    return (
        <div
            class="file-item"
            classList={{ hovered: isHovered() }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <FileIcon type={props.file.type} />
            <span class="file-name">{props.file.name}</span>
        </div>
    );
}
```

### 1.2 Signal Granularity (신호 세분화)

```typescript
// BAD: 하나의 큰 객체로 관리
interface EditorState {
    content: string;
    cursor: Position;
    selections: Selection[];
    scrollTop: number;
    theme: Theme;
}
const [editorState, setEditorState] = createSignal<EditorState>({...});

// content만 바뀌어도 cursor, selections 등을 사용하는 컴포넌트도 리렌더링

// GOOD: 세분화된 Signal
const [content, setContent] = createSignal('');
const [cursor, setCursor] = createSignal<Position>({ line: 0, column: 0 });
const [selections, setSelections] = createSignal<Selection[]>([]);
const [scrollTop, setScrollTop] = createSignal(0);
const [theme, setTheme] = createSignal<Theme>(defaultTheme);

// 각 Signal은 해당 데이터를 사용하는 컴포넌트만 업데이트
```

### 1.3 createMemo로 파생 상태 최적화

```typescript
function EditorLine(props: { lineNumber: number }) {
    const store = useEditorStore();

    // BAD: 매 렌더링마다 재계산
    const isCurrentLine = () => store.cursor().line === props.lineNumber;
    const hasSelection = () => store.selections().some(s =>
        s.start.line <= props.lineNumber && s.end.line >= props.lineNumber
    );

    // GOOD: 의존성이 바뀔 때만 재계산
    const isCurrentLine = createMemo(() => store.cursor().line === props.lineNumber);
    const hasSelection = createMemo(() => store.selections().some(s =>
        s.start.line <= props.lineNumber && s.end.line >= props.lineNumber
    ));

    return (
        <div classList={{
            'current-line': isCurrentLine(),
            'has-selection': hasSelection(),
        }}>
            {/* ... */}
        </div>
    );
}
```

### 1.4 컴포넌트 분리 전략

```typescript
// 자주 업데이트되는 부분과 정적인 부분 분리

// BAD: 커서가 움직일 때마다 전체 라인 리렌더링
function EditorLine(props: { line: string; lineNumber: number }) {
    const cursor = useEditorStore().cursor;

    return (
        <div class="line">
            <LineNumber number={props.lineNumber} />
            <LineContent content={props.line} />
            <Show when={cursor().line === props.lineNumber}>
                <Cursor position={cursor().column} />
            </Show>
        </div>
    );
}

// GOOD: 커서를 별도 레이어로 분리
function EditorLines(props: { lines: string[] }) {
    return (
        <For each={props.lines}>
            {(line, i) => <StaticLine line={line} lineNumber={i()} />}
        </For>
    );
}

// 커서는 별도의 절대 위치 레이어
function CursorLayer() {
    const cursor = useEditorStore().cursor;

    return (
        <div
            class="cursor"
            style={{
                transform: `translate(${cursor().column * charWidth}px, ${cursor().line * lineHeight}px)`,
            }}
        />
    );
}
```

### 1.5 Index 활용 (배열 순서 변경 최적화)

```typescript
// 배열 아이템 순서가 바뀔 때 리렌더링 최소화
function TabList(props: { tabs: Tab[] }) {
    return (
        <For each={props.tabs}>
            {(tab, index) => (
                // index()를 key로 사용하지 않고, 고유 ID 사용
                <TabItem
                    tab={tab}
                    // SolidJS의 For는 참조 기반으로 최적화
                />
            )}
        </For>
    );
}
```

---

## 2. CSS Containment 활용

### 2.1 contain 속성

```css
/* 에디터 라인: 레이아웃과 페인트 격리 */
.editor-line {
    contain: layout style paint;
    /* 이 요소의 변화가 외부에 영향 주지 않음 */
}

/* 스크롤 가능 컨테이너 */
.editor-viewport {
    contain: strict;
    /* 가장 강력한 격리 */
    overflow: hidden;
}

/* 독립적인 위젯 */
.autocomplete-popup {
    contain: layout paint;
}
```

### 2.2 content-visibility (Lazy Rendering)

```css
/* 뷰포트 밖의 콘텐츠는 렌더링하지 않음 */
.editor-line {
    content-visibility: auto;
    contain-intrinsic-size: auto 20px; /* 예상 높이 */
}

/* 긴 파일에서 수천 줄의 DOM이 있어도 */
/* 뷰포트 내 라인만 실제로 렌더링됨 */
```

---

## 3. 애니메이션 성능: WAAPI (Web Animations API)

### 3.1 Motion One 활용

**interactions.md에 명시된 타이밍과 이징(Easing)을 구현할 때는 WAAPI(Motion One)를 적극 활용합니다.**

```typescript
import { animate, spring, stagger } from 'motion';

// 패널 열기/닫기 애니메이션
function togglePanel(element: HTMLElement, isOpen: boolean) {
    animate(
        element,
        {
            width: isOpen ? '300px' : '0px',
            opacity: isOpen ? 1 : 0,
        },
        {
            duration: 0.2,
            easing: [0.25, 0.1, 0.25, 1], // ease-out
        }
    );
}

// 스프링 애니메이션 (자연스러운 물리 기반)
function bounceElement(element: HTMLElement) {
    animate(
        element,
        { scale: [1, 1.1, 1] },
        { easing: spring({ stiffness: 300, damping: 10 }) }
    );
}

// 순차 애니메이션 (목록 아이템)
function animateListItems(items: HTMLElement[]) {
    animate(
        items,
        { opacity: [0, 1], y: [20, 0] },
        {
            duration: 0.3,
            delay: stagger(0.05), // 각 아이템 50ms 간격
        }
    );
}
```

### 3.2 GPU 가속 활용

```css
/* GPU 레이어로 승격되는 속성만 애니메이션 */
.panel {
    /* GOOD: GPU 가속 */
    transform: translateX(0);
    opacity: 1;
    will-change: transform, opacity;
}

.panel.closing {
    transform: translateX(-100%);
    opacity: 0;
}

/* BAD: 레이아웃 트리거 (느림) */
.panel-bad {
    width: 300px; /* 애니메이션하면 레이아웃 재계산 */
    left: 0; /* 레이아웃 재계산 */
}
```

### 3.3 레이아웃 전환 시 GPU 가속

```typescript
// FLIP 애니메이션 (First, Last, Invert, Play)
function layoutTransition(element: HTMLElement) {
    // First: 현재 위치 저장
    const first = element.getBoundingClientRect();

    // (레이아웃 변경 발생)
    element.classList.toggle('expanded');

    // Last: 새 위치 측정
    const last = element.getBoundingClientRect();

    // Invert: 차이 계산
    const deltaX = first.left - last.left;
    const deltaY = first.top - last.top;
    const deltaW = first.width / last.width;
    const deltaH = first.height / last.height;

    // Play: GPU 가속 애니메이션으로 전환
    animate(
        element,
        {
            transform: [
                `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`,
                'translate(0, 0) scale(1, 1)',
            ],
        },
        { duration: 0.3, easing: 'ease-out' }
    );
}
```

### 3.4 SolidJS 트랜지션 통합

```typescript
import { Transition } from 'solid-transition-group';
import { animate } from 'motion';

function FadeTransition(props: { children: JSX.Element }) {
    return (
        <Transition
            onEnter={(el, done) => {
                animate(el, { opacity: [0, 1] }, { duration: 0.2 }).finished.then(done);
            }}
            onExit={(el, done) => {
                animate(el, { opacity: 0 }, { duration: 0.15 }).finished.then(done);
            }}
        >
            {props.children}
        </Transition>
    );
}

// 사용
function App() {
    const [showPanel, setShowPanel] = createSignal(false);

    return (
        <FadeTransition>
            <Show when={showPanel()}>
                <Panel />
            </Show>
        </FadeTransition>
    );
}
```

### 3.5 60fps 보장 패턴

```typescript
// requestAnimationFrame으로 배치 업데이트
class RenderScheduler {
    private pendingUpdates: Set<() => void> = new Set();
    private rafId: number | null = null;

    schedule(update: () => void) {
        this.pendingUpdates.add(update);

        if (this.rafId === null) {
            this.rafId = requestAnimationFrame(() => {
                this.rafId = null;
                const updates = Array.from(this.pendingUpdates);
                this.pendingUpdates.clear();

                // 모든 업데이트를 한 프레임에 배치
                for (const update of updates) {
                    update();
                }
            });
        }
    }
}

const scheduler = new RenderScheduler();

// 사용: 스크롤 중 빈번한 업데이트
function handleScroll(scrollTop: number) {
    scheduler.schedule(() => {
        updateVisibleRange(scrollTop);
        updateMinimapPosition(scrollTop);
        updateStickyHeaders(scrollTop);
    });
}
```

---

## 4. 성능 벤치마크 목표

| 지표 | 목표 |
|------|------|
| First Contentful Paint | < 500ms |
| 키 입력 → 화면 반영 | < 16ms (60fps) |
| 스크롤 프레임 드랍 | 0 |
| 10K 라인 파일 열기 | < 200ms |
| 트리 뷰 확장/축소 | < 100ms |
| 패널 전환 애니메이션 | 60fps |
| 메모리 사용량 (10K 라인) | < 100MB |

---

## 5. 디버깅 도구

### 5.1 SolidJS DevTools

```typescript
// 개발 모드에서 리렌더링 추적
import { createEffect } from 'solid-js';

function debugRenders(componentName: string) {
    if (import.meta.env.DEV) {
        createEffect(() => {
            console.log(`[Render] ${componentName}`);
        });
    }
}
```

### 5.2 Performance API

```typescript
// 성능 측정
function measurePerformance<T>(name: string, fn: () => T): T {
    performance.mark(`${name}-start`);
    const result = fn();
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);

    if (import.meta.env.DEV) {
        const measure = performance.getEntriesByName(name)[0];
        console.log(`[Perf] ${name}: ${measure.duration.toFixed(2)}ms`);
    }

    return result;
}
```

---

## 참고 자료

- [SolidJS Fine-Grained Reactivity](https://www.solidjs.com/guides/reactivity)
- [Motion One](https://motion.dev/)
- [CSS Containment](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment)
- [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
- [FLIP Animation Technique](https://aerotwist.com/blog/flip-your-animations/)
