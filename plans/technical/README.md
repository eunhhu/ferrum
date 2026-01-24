# Technical Details

## Overview

구현 상세, 성능 최적화, 시스템 통합 전략.

## Document Structure

```markdown
# Technical: [Topic]

## Overview
무엇을 다루는지

## Architecture
관련 시스템 구조

## Implementation Details
### Subsection
- 구현 방식
- 코드 예시
- 주의사항

## Performance Considerations
- 병목 지점
- 최적화 전략
- 벤치마크 목표

## Error Handling
- 에러 케이스
- 복구 전략

## Testing Strategy
- 단위 테스트
- 통합 테스트
- 성능 테스트

## Future Improvements
- 개선 가능 지점
```

## Technical Documents

### Core Documents (완료)

| Document | Status | Description |
|----------|--------|-------------|
| [frontend-optimization.md](./frontend-optimization.md) | ✅ 완료 | SolidJS 최적화, CSS Containment, WAAPI |
| [plugin-system.md](./plugin-system.md) | ✅ 완료 | WASM 플러그인, 권한 시스템, 샌드박스 |
| [testing-strategy.md](./testing-strategy.md) | ✅ 완료 | 테스트 피라미드, Rust/TS 테스트 |
| [accessibility.md](./accessibility.md) | ✅ 완료 | WCAG 2.1 AA 준수, 스크린 리더 지원 |
| [internationalization.md](./internationalization.md) | ✅ 완료 | i18n, 다국어 지원, RTL |

### Architecture Documents (plans/architecture/)

IPC 및 시스템 통합 관련 문서는 architecture 디렉토리로 이동:

| Document | Location | Description |
|----------|----------|-------------|
| IPC Protocol | [ipc-protocol.md](../architecture/ipc-protocol.md) | Frontend-Backend IPC 상세 |
| LSP Integration | [lsp-integration.md](../architecture/lsp-integration.md) | LSP 서버 생명주기, 통신 |
| Editor Engine | [editor-engine.md](../architecture/editor-engine.md) | Rope, Anchor, DisplayMap |
| State Management | [state-management.md](../architecture/state-management.md) | 상태 관리 아키텍처 |
| Search System | [search-system.md](../architecture/search-system.md) | 검색, ripgrep 통합 |
| File Explorer | [file-explorer.md](../architecture/file-explorer.md) | 파일 트리, Git 상태 |
| View Mode System | [view-mode-system.md](../architecture/view-mode-system.md) | 다중 뷰 모드 |

### Planned Documents (작성 예정)

| Document | Priority | Description |
|----------|----------|-------------|
| error-handling.md | P1 | 전역 에러 처리, 사용자 피드백, 로깅 |
| build-deploy.md | P1 | CI/CD, 크로스 플랫폼 빌드, 자동 업데이트 |
| security.md | P2 | 보안 고려사항, 플러그인 샌드박스 |

## Performance Targets

[document-review.md](../review/document-review.md)에서 정의한 성능 목표:

| 작업 | 목표 시간 | 비고 |
|------|----------|------|
| 키 입력 → 화면 반영 | < 16ms | 60fps 유지 |
| 파일 열기 (10KB) | < 100ms | |
| 파일 열기 (1MB) | < 500ms | |
| 자동완성 표시 | < 100ms | 첫 결과 |
| 정의로 이동 | < 200ms | 캐시된 경우 < 50ms |
| 전역 검색 시작 | < 50ms | 첫 결과 스트리밍 |
| 앱 시작 | < 2s | 콜드 스타트 |

## Tech Stack Summary

### Backend (Rust)

```toml
# 핵심 의존성
tauri = "2.x"
tokio = { features = ["full"] }
ropey = "1.x"          # Rope 데이터 구조
tree-sitter = "0.x"    # 증분 파싱
wasmtime = "x.x"       # WASM 플러그인 런타임

# 유틸리티
serde = { features = ["derive"] }
parking_lot = "0.12"   # 빠른 Mutex/RwLock
tracing = "0.1"        # 구조화된 로깅
thiserror = "2.x"      # 에러 정의
```

### Frontend (TypeScript/SolidJS)

```json
{
  "dependencies": {
    "solid-js": "^1.9",
    "@tauri-apps/api": "^2.x",
    "pixi.js": "^8.x",
    "elkjs": "^0.9"
  },
  "devDependencies": {
    "vite": "^6.x",
    "vitest": "^2.x",
    "playwright": "^1.x"
  }
}
```

## Related Documents

- [overview.md](../overview.md) - 프로젝트 비전, 기술 스택
- [architecture.md](../architecture.md) - 전체 아키텍처
- [document-review.md](../review/document-review.md) - 문서 검토 및 성능 분석
