# UI/UX Design

## Overview

UI/UX 설계 문서들. 시각적 디자인, 인터랙션 패턴, 컴포넌트 시스템 정의.

## Document Structure

모든 design 문서는 다음 구조를 따름:

```markdown
# Design: [Area]

## Overview
설계 목표

## Layout / Structure
구조 다이어그램 (ASCII 또는 설명)

## Components
### ComponentName
- 역할
- Props/State
- 시각적 명세 (크기, 색상, 타이포그래피)
- 상태별 변화 (hover, active, disabled 등)

## Interactions
### InteractionName
- Trigger (클릭, 호버, 키보드 등)
- Action
- Feedback (시각적/청각적)

## Keyboard Shortcuts
| Shortcut | Action | Context |
|----------|--------|---------|

## Accessibility
- 스크린 리더 지원
- 키보드 네비게이션
- 색상 대비

## Responsive Behavior
화면 크기별 동작

## Animation / Transition
- 애니메이션 명세
- 타이밍, 이징
```

## Design Guidelines

### 현재 적용된 디자인 원칙

Ferrum IDE는 다음 디자인 원칙을 따릅니다:

1. **Production-First Development** - 코드 변경 즉시 실제 동작 확인
2. **Figma-like Experience** - 드래그 앤 드롭, 실시간 시각적 피드백
3. **Depth-Aware Navigation** - 깊이별 색상 구분으로 구조 파악 용이

### 색상 시스템

깊이별 색상 (Tree Viewer, Code Depth):
```typescript
const DEPTH_COLORS = {
  bg: [
    "rgba(99, 102, 241, 0.08)",   // depth 0: indigo
    "rgba(139, 92, 246, 0.08)",   // depth 1: violet
    "rgba(236, 72, 153, 0.08)",   // depth 2: pink
    "rgba(249, 115, 22, 0.08)",   // depth 3: orange
    "rgba(34, 197, 94, 0.08)",    // depth 4: green
    "rgba(6, 182, 212, 0.08)",    // depth 5: cyan
  ]
};
```

## Design Documents

| Document | Status | Description |
|----------|--------|-------------|
| Layout | 📋 스펙에 통합 | 전체 레이아웃 구조 - [architecture.md](../architecture.md) 참조 |
| Components | 📋 구현 중 | 디자인 시스템, 공통 컴포넌트 - src/components 참조 |
| Interactions | 📋 스펙에 통합 | 인터랙션 패턴 - [navigation.md](../specs/navigation.md) 참조 |
| Accessibility | ✅ 완료 | 접근성 스펙 - [accessibility.md](../technical/accessibility.md) |

## Related Specs

- [navigation.md](../specs/navigation.md) - Tree Viewer 시각적 디자인 포함
- [tree-viewer.md](../specs/tree-viewer.md) - 깊이 색상, 스티키 헤더 디자인
- [context-action-palette.md](../specs/context-action-palette.md) - 팔레트 UI 디자인
- [visual-coding.md](../specs/visual-coding.md) - 노드 기반 시각적 코딩 UI

## Implementation

디자인 구현은 다음 기술을 사용:

- **SolidJS** - 반응형 UI 컴포넌트
- **TailwindCSS 4.x** - 유틸리티 CSS
- **PixiJS** - WebGPU 기반 캔버스 렌더링 (Tree Viewer 배경, Visual Coding)
- **Motion One** - WAAPI 기반 애니메이션

상세 내용은 [frontend-optimization.md](../technical/frontend-optimization.md) 참조.
