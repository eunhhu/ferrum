# Feature Specifications

## Overview

각 기능의 상세 명세를 정의하는 문서들.

## Document Structure

모든 spec 문서는 다음 구조를 따름:

```markdown
# Feature Name

## Summary
한 줄 요약

## Motivation
왜 이 기능이 필요한지

## User Stories
- As a [user], I want to [action] so that [benefit]

## Detailed Design

### Data Types
```rust
// Rust types
```

```typescript
// TypeScript types
```

### IPC Commands
| Command | Input | Output | Description |
|---------|-------|--------|-------------|

### IPC Events
| Event | Payload | Description |
|-------|---------|-------------|

### State Management
어떤 상태가 어디에 저장되는지

### Algorithm / Flow
동작 흐름, 알고리즘

## Edge Cases
- Case 1: ...
- Case 2: ...

## Dependencies
- 다른 기능과의 의존성

## Open Questions
- 아직 결정 안 된 것들
```

## Specs

| Spec | Priority | Description |
|------|----------|-------------|
| [navigation.md](./navigation.md) | P0 | 핵심 차별점 - Tree, Fold, Trail |
| [editor.md](./editor.md) | P0 | 기초 - 에디터 엔진 |
| [visual.md](./visual.md) | P1 | Visual Coding, Preview |
| [productivity.md](./productivity.md) | P1 | Action Palette, Env Manager |
| [ai.md](./ai.md) | P2 | AI 연동 |
| [plugin.md](./plugin.md) | P2 | Plugin 시스템 |
