# Ferrum IDE Documentation

## Quick Navigation

| Document | Description |
|----------|-------------|
| [Overview](./overview.md) | 비전, 철학, 타겟 유저, 로드맵 |
| [Architecture](./architecture.md) | 시스템 구조, 데이터 타입, IPC 프로토콜 |

## Feature Specifications (`specs/`)

기능별 상세 명세. 각 기능이 **무엇**을 하는지, **어떻게 동작**하는지 정의.

| Spec | Status | Description |
|------|--------|-------------|
| [Navigation](./specs/navigation.md) | 🔜 | Tree Viewer, Fold, Trail, Dependency Highlight |
| [Editor](./specs/editor.md) | 🔜 | 에디터 엔진, 커서, 선택, 하이라이팅 |
| [Visual](./specs/visual.md) | 🔜 | Visual Coding, Compile-time Preview |
| [Productivity](./specs/productivity.md) | 🔜 | Action Palette, Env Manager, Componentify |
| [AI](./specs/ai.md) | 🔜 | OpenRouter 연동, 로컬 모델 |
| [Plugin](./specs/plugin.md) | 🔜 | Plugin 시스템, API |

## UI/UX Design (`design/`)

UI/UX 설계. **어떻게 보이는지**, 인터랙션 패턴 정의.

| Design | Status | Description |
|--------|--------|-------------|
| [Layout](./design/layout.md) | 🔜 | 전체 레이아웃 구조 |
| [Components](./design/components.md) | 🔜 | 디자인 시스템, 컴포넌트 |
| [Interactions](./design/interactions.md) | 🔜 | 인터랙션 패턴, 키보드 단축키 |
| [Mobile](./design/mobile.md) | 🔜 | 모바일 UI, 제스처 |

## Technical Details (`technical/`)

기술 구현 상세. 성능, 최적화, 통합 전략.

| Document | Status | Description |
|----------|--------|-------------|
| [IPC Protocol](./technical/ipc-protocol.md) | 🔜 | Frontend-Backend 통신 상세 |
| [LSP Integration](./technical/lsp-integration.md) | 🔜 | LSP 서버 관리, 통신 |
| [Indexing](./technical/indexing.md) | 🔜 | 파일/심볼/의존성 인덱싱 |
| [Performance](./technical/performance.md) | 🔜 | 성능 최적화 전략 |

---

## Reading Order

### 처음 프로젝트 파악
1. `overview.md` - 전체 그림
2. `architecture.md` - 기술 구조

### 기능 구현 시
1. 해당 기능의 `specs/*.md`
2. 관련된 `design/*.md`
3. 필요시 `technical/*.md`

---

## Document Status

| Status | Meaning |
|--------|---------|
| ✅ | 완료 |
| 🔜 | 작성 예정 |
| 🚧 | 작성 중 |
| 📝 | 업데이트 필요 |
