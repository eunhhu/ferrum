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

## Core Specs (Phase 1 - MVP)

| Spec | Priority | Status | Description |
|------|----------|--------|-------------|
| [navigation.md](./navigation.md) | P0 | ✅ 완료 | Tree Viewer, Tree Fold, Navigation Trail, Dependency Highlight |
| [tree-viewer.md](./tree-viewer.md) | P0 | ✅ 완료 | 깊이별 컬러 컨테이닝, 스티키 헤더 |
| [context-action-palette.md](./context-action-palette.md) | P0 | ✅ 완료 | 컨텍스트 인식 액션 제안 |

## Extended Specs (Phase 2)

| Spec | Priority | Status | Description |
|------|----------|--------|-------------|
| [visual-coding.md](./visual-coding.md) | P1 | ✅ 완료 | Node-based Visual Coding, Code↔Visual 양방향 동기화 |
| [additional-features.md](./additional-features.md) | P1 | ✅ 완료 | 12개 추가 기능 (Componentify, Template 등) |

## Planned Specs (Phase 3)

다음 스펙들은 아키텍처 문서 참조:

| Spec | Priority | Architecture Doc | Description |
|------|----------|------------------|-------------|
| Terminal Integration | P1 | TBD | 통합 터미널, PTY, 쉘 감지 |
| Debugger | P2 | TBD | DAP 통합, 브레이크포인트, 변수 조사 |
| Collaboration | P2 | TBD | 실시간 협업, CRDT, 원격 커서 |

## Related Architecture Docs

스펙 구현에 필요한 아키텍처 문서들:

- [editor-engine.md](../architecture/editor-engine.md) - 에디터 엔진 설계
- [lsp-integration.md](../architecture/lsp-integration.md) - LSP 통합
- [file-explorer.md](../architecture/file-explorer.md) - 파일 탐색기
- [search-system.md](../architecture/search-system.md) - 검색 시스템
- [state-management.md](../architecture/state-management.md) - 상태 관리
- [view-mode-system.md](../architecture/view-mode-system.md) - View Mode 시스템
