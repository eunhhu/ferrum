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

## Documents

| Document | Description |
|----------|-------------|
| [layout.md](./layout.md) | 전체 레이아웃 구조 |
| [components.md](./components.md) | 디자인 시스템, 공통 컴포넌트 |
| [interactions.md](./interactions.md) | 인터랙션 패턴, 단축키 맵 |
| [mobile.md](./mobile.md) | 모바일 전용 UI, 제스처 |
