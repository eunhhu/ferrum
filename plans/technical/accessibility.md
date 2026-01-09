# Accessibility (a11y) 스펙

> **목표**: 모든 사용자가 Ferrum IDE를 효과적으로 사용할 수 있도록 보장

## 1. 접근성 원칙 (WCAG 2.1 AA 준수)

### 1.1 핵심 원칙

| 원칙 | 설명 | 적용 |
|------|------|------|
| **인식성** | 정보와 UI를 인식할 수 있어야 함 | 색상 대비, 텍스트 대안 |
| **운용성** | UI를 조작할 수 있어야 함 | 키보드 접근, 충분한 시간 |
| **이해성** | 정보와 UI 조작을 이해할 수 있어야 함 | 일관성, 입력 도움 |
| **견고성** | 다양한 보조 기술과 호환되어야 함 | 표준 준수, ARIA |

### 1.2 목표 지원 범위

- 스크린 리더 (VoiceOver, NVDA, JAWS)
- 키보드 전용 사용자
- 저시력 사용자 (고대비, 확대)
- 색각 이상 사용자
- 운동 장애 사용자 (음성 제어)

---

## 2. 키보드 접근성

### 2.1 전역 키보드 네비게이션

```
Tab / Shift+Tab     : 포커스 이동
Enter / Space       : 활성화
Escape              : 닫기 / 취소
Arrow Keys          : 목록/메뉴 탐색
F6                  : 영역 간 이동 (패널)
```

### 2.2 포커스 관리

```typescript
// 포커스 표시자 (모든 인터랙티브 요소)
.focusable:focus-visible {
    outline: 2px solid var(--focus-color);
    outline-offset: 2px;
}

// 고대비 모드
@media (prefers-contrast: high) {
    .focusable:focus-visible {
        outline: 3px solid var(--high-contrast-focus);
        outline-offset: 3px;
    }
}
```

### 2.3 포커스 트랩 (모달)

```typescript
function Modal(props: { isOpen: boolean; onClose: () => void }) {
    let firstFocusable: HTMLElement;
    let lastFocusable: HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            props.onClose();
            return;
        }

        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    };

    onMount(() => {
        // 포커스 이동 저장
        const previousFocus = document.activeElement as HTMLElement;

        // 첫 번째 포커스 가능 요소로 이동
        firstFocusable?.focus();

        onCleanup(() => {
            previousFocus?.focus();
        });
    });

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onKeyDown={handleKeyDown}
        >
            {props.children}
        </div>
    );
}
```

### 2.4 에디터 키보드 탐색

```
# 기본 이동
Arrow Keys          : 커서 이동
Cmd+Arrow           : 단어/라인 단위 이동
Cmd+Home/End        : 문서 처음/끝

# 선택
Shift+Arrow         : 선택 확장
Cmd+Shift+Arrow     : 단어/라인 선택
Cmd+A               : 전체 선택

# 편집
Cmd+Z / Cmd+Shift+Z : 실행 취소 / 다시 실행
Cmd+C / Cmd+X / Cmd+V : 복사 / 잘라내기 / 붙여넣기

# 접근성 전용
Ctrl+G              : 라인으로 이동 (다이얼로그)
F7                  : 커서 네비게이션 모드 전환
Cmd+F6              : 다음 에디터 그룹으로 이동
```

---

## 3. 스크린 리더 지원

### 3.1 ARIA 레이블

```tsx
// 파일 탐색기
<nav aria-label="File Explorer">
    <ul role="tree" aria-label="Project Files">
        <li role="treeitem" aria-expanded="true" aria-level="1">
            <span>src</span>
            <ul role="group">
                <li role="treeitem" aria-level="2">
                    <span>index.ts</span>
                </li>
            </ul>
        </li>
    </ul>
</nav>

// 에디터 탭
<div role="tablist" aria-label="Open Editors">
    <button
        role="tab"
        aria-selected="true"
        aria-controls="editor-panel-1"
        id="tab-1"
    >
        index.ts
        <span class="sr-only">, modified</span>  {/* 수정됨 표시 */}
    </button>
</div>

// 에디터 영역
<div
    role="textbox"
    aria-multiline="true"
    aria-label="Code editor, index.ts"
    aria-describedby="editor-status"
>
    {/* 에디터 콘텐츠 */}
</div>
<div id="editor-status" class="sr-only">
    Line 42, Column 15. TypeScript. 3 problems.
</div>
```

### 3.2 라이브 리전 (실시간 알림)

```tsx
// 상태 변경 알림
<div
    role="status"
    aria-live="polite"
    aria-atomic="true"
    class="sr-only"
>
    {statusMessage()}  {/* "File saved", "3 errors found" 등 */}
</div>

// 긴급 알림 (에러)
<div
    role="alert"
    aria-live="assertive"
    class="sr-only"
>
    {alertMessage()}  {/* "Build failed with 5 errors" */}
</div>

// 자동완성
<div
    role="listbox"
    aria-label="Autocomplete suggestions"
    aria-activedescendant={activeItemId()}
>
    <div
        role="option"
        id="suggestion-1"
        aria-selected={isSelected(1)}
    >
        console.log
        <span class="sr-only">- function, console module</span>
    </div>
</div>
```

### 3.3 에디터 읽기 지원

```typescript
// 커서 위치 알림
function announcePosition(line: number, column: number) {
    announce(`Line ${line}, Column ${column}`);
}

// 선택 영역 알림
function announceSelection(start: Position, end: Position, text: string) {
    if (text.length < 50) {
        announce(`Selected: ${text}`);
    } else {
        const lines = end.line - start.line + 1;
        announce(`Selected ${lines} lines from line ${start.line} to ${end.line}`);
    }
}

// 에러/경고 알림
function announceDiagnostic(diagnostic: Diagnostic) {
    const severity = diagnostic.severity === 'error' ? 'Error' : 'Warning';
    announce(`${severity} on line ${diagnostic.line}: ${diagnostic.message}`);
}

// 자동완성 알림
function announceCompletion(item: CompletionItem, index: number, total: number) {
    announce(`${item.label}, ${item.kind}, ${index} of ${total}`);
}
```

---

## 4. 시각적 접근성

### 4.1 색상 대비

```css
/* 최소 대비 비율: 4.5:1 (일반 텍스트), 3:1 (큰 텍스트) */

:root {
    /* 기본 테마 */
    --text-primary: #1a1a1a;      /* 대비 비율 16:1 on white */
    --text-secondary: #5a5a5a;    /* 대비 비율 7:1 on white */
    --background: #ffffff;

    /* 포커스 표시 */
    --focus-color: #0066cc;       /* 대비 비율 4.5:1 */

    /* 에러/경고 */
    --error-text: #d32f2f;        /* 대비 비율 5.9:1 */
    --warning-text: #f57c00;      /* 대비 비율 3.1:1 (큰 텍스트용) */
}

/* 다크 테마 */
[data-theme="dark"] {
    --text-primary: #e0e0e0;      /* 대비 비율 12:1 on dark */
    --text-secondary: #a0a0a0;    /* 대비 비율 6:1 on dark */
    --background: #1e1e1e;
}

/* 고대비 테마 */
[data-theme="high-contrast"] {
    --text-primary: #ffffff;
    --text-secondary: #ffffff;
    --background: #000000;
    --focus-color: #ffff00;
    --error-text: #ff6b6b;
}
```

### 4.2 색맹 지원

```css
/* 색상만으로 정보를 전달하지 않음 */

/* 에러 표시: 색상 + 아이콘 + 밑줄 */
.error-line {
    background-color: rgba(255, 0, 0, 0.1);
    border-left: 3px solid var(--error-color);
}

.error-line::before {
    content: "✕";  /* 아이콘 추가 */
    color: var(--error-color);
}

/* Git 상태: 색상 + 기호 */
.git-modified::before { content: "M "; }
.git-added::before { content: "+ "; }
.git-deleted::before { content: "- "; }
```

### 4.3 확대/축소 지원

```typescript
// 최소 200% 확대까지 지원
// 레이아웃 깨짐 없이 스크롤로 접근 가능

// 설정
interface ZoomSettings {
    uiScale: number;      // 1.0 ~ 3.0
    editorFontSize: number;  // 8 ~ 72
    minimapEnabled: boolean;  // 확대 시 자동 비활성화 옵션
}

// 텍스트 리플로우
.editor-container {
    min-width: 320px;  /* 최소 너비 보장 */
    overflow-x: auto;  /* 필요시 가로 스크롤 */
}
```

### 4.4 애니메이션 제어

```css
/* 움직임 감소 선호 */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }

    /* 커서 깜빡임 비활성화 */
    .cursor {
        animation: none;
    }

    /* 스크롤 애니메이션 비활성화 */
    html {
        scroll-behavior: auto;
    }
}
```

---

## 5. 운동 장애 지원

### 5.1 타겟 크기

```css
/* 최소 클릭 영역: 44x44 픽셀 (WCAG 2.2) */

.button,
.icon-button,
.menu-item {
    min-width: 44px;
    min-height: 44px;
    padding: 8px 16px;
}

/* 작은 아이콘도 클릭 영역 확보 */
.small-icon {
    width: 16px;
    height: 16px;
    padding: 14px;  /* 총 44px */
}
```

### 5.2 드래그 대안

```typescript
// 모든 드래그 작업에 키보드 대안 제공

// 탭 재정렬
// 드래그: 마우스로 탭 드래그
// 키보드: Cmd+Shift+PageUp/PageDown

// 패널 리사이징
// 드래그: 경계선 드래그
// 키보드: Cmd+B (사이드바 토글), 설정에서 크기 지정

// 파일 이동
// 드래그: 파일 탐색기에서 드래그
// 키보드: Cmd+X (잘라내기), Cmd+V (붙여넣기)
```

### 5.3 시간 제한

```typescript
// 자동 숨김 요소에 충분한 시간 제공

interface ToastOptions {
    duration: number;  // 기본 5000ms (접근성 설정 시 무제한)
    pauseOnHover: boolean;  // 호버 시 일시정지
    dismissible: boolean;  // 수동 닫기 가능
}

// 접근성 모드에서 자동 닫힘 비활성화
if (settings.accessibility.extendedTimeouts) {
    toast.duration = Infinity;  // 수동 닫기만 가능
}
```

---

## 6. 설정 UI

### 6.1 접근성 설정 패널

```
┌────────────────────────────────────────────────────┐
│ ACCESSIBILITY                                      │
├────────────────────────────────────────────────────┤
│                                                    │
│ Screen Reader                                      │
│ ☑ Optimize for screen readers                     │
│   Adds additional ARIA labels and announcements   │
│                                                    │
│ ─────────────────────────────────────────────────  │
│                                                    │
│ Keyboard                                           │
│ ☑ Show keyboard shortcuts in tooltips             │
│ ☐ Sticky keys support                             │
│ ☐ Filter keys (ignore brief keystrokes)           │
│                                                    │
│ ─────────────────────────────────────────────────  │
│                                                    │
│ Visual                                             │
│ Theme: [High Contrast Dark_______] ▼              │
│                                                    │
│ ☑ Reduce motion                                   │
│ ☐ Disable cursor blinking                         │
│ ☑ Highlight current line                          │
│                                                    │
│ Focus indicator:                                   │
│ ○ Default  ● High visibility  ○ Custom            │
│                                                    │
│ ─────────────────────────────────────────────────  │
│                                                    │
│ Timing                                             │
│ ☑ Extend time for notifications                   │
│ ☐ Disable auto-hide for tooltips                  │
│                                                    │
│ ─────────────────────────────────────────────────  │
│                                                    │
│ Audio                                              │
│ ☐ Enable audio cues                               │
│     Plays sounds for events (save, error, etc.)   │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 6.2 접근성 설정 스키마

```rust
#[derive(Serialize, Deserialize)]
pub struct AccessibilitySettings {
    // 스크린 리더
    pub optimize_for_screen_reader: bool,
    pub announce_line_numbers: bool,
    pub announce_diagnostics: bool,

    // 키보드
    pub show_keyboard_shortcuts: bool,
    pub sticky_keys: bool,
    pub filter_keys: bool,
    pub filter_keys_delay_ms: u32,

    // 시각
    pub high_contrast_theme: bool,
    pub reduce_motion: bool,
    pub disable_cursor_blink: bool,
    pub highlight_current_line: bool,
    pub focus_indicator: FocusIndicator,

    // 타이밍
    pub extended_timeouts: bool,
    pub notification_duration_ms: u32,  // 0 = 무제한

    // 오디오
    pub audio_cues: bool,
}

pub enum FocusIndicator {
    Default,
    HighVisibility,
    Custom { color: String, width: u32 },
}
```

---

## 7. 테스트

### 7.1 자동화 테스트

```typescript
// axe-core 통합
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('Editor has no accessibility violations', async () => {
    const { container } = render(<Editor />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
});

// 키보드 네비게이션 테스트
test('Can navigate file tree with keyboard', async () => {
    render(<FileExplorer />);

    // Tab으로 파일 탐색기 진입
    await userEvent.tab();
    expect(screen.getByRole('tree')).toHaveFocus();

    // Arrow Down으로 다음 항목
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('treeitem', { name: 'src' })).toHaveFocus();

    // Enter로 확장
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('treeitem', { name: 'src' })).toHaveAttribute('aria-expanded', 'true');
});
```

### 7.2 수동 테스트 체크리스트

```
□ VoiceOver (macOS)로 전체 워크플로우 테스트
□ NVDA (Windows)로 전체 워크플로우 테스트
□ 키보드만으로 모든 기능 접근 가능
□ 200% 확대에서 레이아웃 정상
□ 고대비 테마에서 모든 요소 가시성
□ 색상만으로 전달되는 정보 없음
□ 모든 이미지에 대체 텍스트
□ 포커스 표시가 항상 보임
□ 모달에서 포커스 트랩 정상 작동
□ 자동 닫힘 요소 시간 충분
```

---

## 8. 구현 로드맵

### Phase 1: 기본 (Week 1-2)
- [ ] 키보드 네비게이션 전체 구현
- [ ] 포커스 표시자 스타일링
- [ ] 기본 ARIA 레이블

### Phase 2: 스크린 리더 (Week 2-3)
- [ ] 라이브 리전 구현
- [ ] 에디터 위치/선택 알림
- [ ] 트리 구조 ARIA

### Phase 3: 시각 (Week 3-4)
- [ ] 고대비 테마
- [ ] 색맹 지원 패턴
- [ ] 확대 지원

### Phase 4: 설정 (Week 4-5)
- [ ] 접근성 설정 패널
- [ ] 설정 영속화
- [ ] 테스트 자동화
