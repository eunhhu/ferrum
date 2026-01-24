# Ferrum IDE 설계 문서

> **월드베스트 IDE를 위한 철저한 기획 및 아키텍처 설계**

## 📚 문서 구조

### 1. 프로젝트 개요
- **[overview.md](./overview.md)** ✅ - 프로젝트 비전, 철학, 기술 스택, 로드맵

### 2. Research (리서치)
- **[zed-analysis.md](./research/zed-analysis.md)** ✅ - Zed 에디터 코드베이스 전체 분석
  - 에디터 엔진 (Rope, SumTree, Anchor)
  - LSP 통합
  - IPC 통신
  - GPUI 프레임워크
  - Ferrum 적용 방향

### 3. Architecture (아키텍처)

#### 3.1 핵심 시스템
| Document | Status | Description |
|----------|--------|-------------|
| [architecture.md](./architecture.md) | ✅ | 전체 아키텍처 개요, 데이터 타입, IPC |
| [editor-engine.md](./architecture/editor-engine.md) | ✅ | Rope, Anchor, DisplayMap, Edit History |
| [ipc-protocol.md](./architecture/ipc-protocol.md) | ✅ | Tauri IPC, 배치 업데이트, MessagePack |
| [lsp-integration.md](./architecture/lsp-integration.md) | ✅ | LSP 클라이언트, 16개 언어 번들 |
| [state-management.md](./architecture/state-management.md) | ✅ | AppState, BufferManager, 세션 저장 |
| [file-explorer.md](./architecture/file-explorer.md) | ✅ | 파일 트리, Git 상태, 가상화 |
| [search-system.md](./architecture/search-system.md) | ✅ | 파일/텍스트/심볼 검색, 스트리밍 |
| [view-mode-system.md](./architecture/view-mode-system.md) | ✅ | 다중 뷰 모드, 플러그인 확장 |

### 4. Core Features (핵심 기능 스펙)

#### 4.1 혁신 기능
| Document | Status | Description |
|----------|--------|-------------|
| [navigation.md](./specs/navigation.md) | ✅ | Tree Viewer, Tree Fold, Navigation Trail, Dependency Highlight |
| [tree-viewer.md](./specs/tree-viewer.md) | ✅ | 깊이별 컬러, 스티키 헤더, Depth Navigation |
| [context-action-palette.md](./specs/context-action-palette.md) | ✅ | 컨텍스트 분석, 스마트 제안, Tab Completion |
| [visual-coding.md](./specs/visual-coding.md) | ✅ | Node-based, Code↔Visual 양방향 동기화 |
| [additional-features.md](./specs/additional-features.md) | ✅ | 12개 추가 기능 (Componentify, Template 등) |

### 5. Technical (기술 설계)
| Document | Status | Description |
|----------|--------|-------------|
| [plugin-system.md](./technical/plugin-system.md) | ✅ | WASM 런타임, Plugin API, 권한 시스템 |
| [frontend-optimization.md](./technical/frontend-optimization.md) | ✅ | SolidJS 최적화, WAAPI, GPU 가속 |
| [testing-strategy.md](./technical/testing-strategy.md) | ✅ | 테스트 피라미드, Rust/TS 테스트 |
| [accessibility.md](./technical/accessibility.md) | ✅ | WCAG 2.1 AA, 스크린 리더, 키보드 |
| [internationalization.md](./technical/internationalization.md) | ✅ | i18n, 다국어, RTL 지원 |

### 6. Design (디자인)
- **[design/README.md](./design/README.md)** - 디자인 가이드라인 인덱스

### 7. Review (검토)
- **[document-review.md](./review/document-review.md)** ✅ - 문서 완성도 평가, 성능 병목 분석

### 8. Scenarios (시나리오)
- **[ide-scenarios.md](./scenarios/ide-scenarios.md)** ✅ - 12개 상세 사용 시나리오

---

## 🎯 프로젝트 비전

### 핵심 차별점

**AI Agent가 아닌, 개발자의 직접적인 코드베이스 탐색/수정/설계에 집중**

> "UI 버그 하나 고치는데 AI한테 자연어로 설명하는 건 오버헤드다."

### 3대 혁신 기능

1. **Tree Viewer & Fold** - 피그마처럼 코드를 깊이별로 탐색
2. **Context Action Palette** - 다음 액션을 제안하여 개발 흐름 가속화
3. **Visual Coding** - 복잡한 로직을 시각적으로 표현

---

## 🏗️ 기술 스택

| Category | Technology | Reason |
|----------|-----------|--------|
| **Framework** | Tauri 2.0 | Native 성능, 작은 번들 |
| **Frontend** | SolidJS | No VDOM, 최고 성능 |
| **Styling** | Tailwind CSS 4.x | 빠른 개발 |
| **Visualization** | PixiJS | WebGPU/WebGL2 고성능 |
| **Text Buffer** | ropey | Rope 자료구조, 대용량 파일 |
| **AST Parsing** | tree-sitter | 범용 언어, 증분 파싱 |
| **LSP** | 공식 LSP 서버 | 오프라인 번들 LSP |
| **Plugin Runtime** | Wasmtime (WASM) | 고성능, 샌드박싱 |
| **Language** | Rust + TypeScript | Backend/Frontend |

---

## 📐 아키텍처 개요

### Desktop 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │    SolidJS      │  │           PixiJS                │   │
│  │  (Pure View)    │  │  (WebGPU/WebGL2 Visualization)  │   │
│  │                 │  │  - Compile-time Preview         │   │
│  │  - DOM Text     │  │  - Visual Coding (Node-based)   │   │
│  │  - UI Components│  │  - High-perf Overlays           │   │
│  └────────┬────────┘  └────────────────┬────────────────┘   │
│           │                            │                     │
│           └────────────┬───────────────┘                     │
│                        │ IPC (Tauri)                         │
├────────────────────────┼────────────────────────────────────┤
│                        │                                     │
│  ┌─────────────────────▼─────────────────────────────────┐  │
│  │                   Rust Backend                         │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │ Text Buffer  │  │  AST Engine  │  │  LSP Client │  │  │
│  │  │   (ropey)    │  │ (tree-sitter)│  │  (Official) │  │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │   Indexing   │  │    Search    │  │    State    │  │  │
│  │  │              │  │   (ripgrep)  │  │  Management │  │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                        Backend                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 구현 로드맵

### MVP (모든 구상 기능 포함)

#### Phase 1: Foundation (Week 1-8)
- [ ] 자체 에디터 엔진 (ropey + tree-sitter)
- [ ] Tauri IPC 프로토콜
- [ ] LSP 통합 (번들 LSP 16개 언어)
- [ ] 기본 파일 탐색기, 탭 시스템
- [ ] Syntax Highlighting

#### Phase 2: Core DX (Week 9-16)
- [ ] Tree Viewer (깊이별 컬러, 스티키 헤더)
- [ ] Tree Fold (피그마식)
- [ ] Navigation Trail
- [ ] Smart Selection Expansion
- [ ] Context Action Palette
- [ ] Peek View
- [ ] Inline Blame

#### Phase 3: Visual (Week 17-24)
- [ ] Code/View Mode 전환
- [ ] Compile-time Preview
- [ ] Visual Coding (Node-based, PixiJS)
- [ ] Structural Minimap
- [ ] Dependency Highlight

#### Phase 4: Advanced (Week 25-32)
- [ ] Env Manager
- [ ] Componentify
- [ ] Error Flow Visualization
- [ ] Plugin System (WASM)
- [ ] Plugin API (Editor, UI, FS)

#### Phase 5: AI & Polish (Week 33-40)
- [ ] OpenRouter SDK 연동
- [ ] 로컬 오픈소스 모델 연동
- [ ] Context Action Palette AI 통합
- [ ] 접근성 (Accessibility)
- [ ] 국제화 (i18n)

### Post-MVP
- [ ] Plugin Marketplace
- [ ] Theme System 확장
- [ ] Collaboration (실시간 협업)
- [ ] Terminal Integration
- [ ] Debugger (DAP 통합)
- [ ] Mobile (클라우드 + 비주얼 코딩 전용)

---

## 📊 완성된 설계 문서 요약

### Research (1개)
✅ **Zed 분석** - 209개 크레이트 구조, Rope + SumTree, GPUI, LSP, IPC 전체 분석

### Architecture (8개)
1. ✅ **Architecture Overview** - 전체 아키텍처, 데이터 타입, IPC
2. ✅ **Editor Engine** - Rope, Anchor, Selection, DisplayMap
3. ✅ **IPC Protocol** - Command/Event, 최적화 (배치, 델타, 디바운싱)
4. ✅ **LSP Integration** - 클라이언트 구조, 번들 LSP, 성능 최적화
5. ✅ **State Management** - AppState, BufferManager, Workspace, 세션 저장
6. ✅ **File Explorer** - 파일 트리, Git 상태, 가상화
7. ✅ **Search System** - 파일/텍스트/심볼 검색, 스트리밍 결과
8. ✅ **View Mode System** - 다중 뷰 모드, Production Preview

### Core Features (5개)
1. ✅ **Navigation** - Tree Viewer, Tree Fold, Navigation Trail, Dependency Highlight
2. ✅ **Tree Viewer** - 깊이 컬러, 스티키 헤더, n-depth 접기
3. ✅ **Context Action Palette** - 컨텍스트 분석, 스마트 제안, 학습
4. ✅ **Visual Coding** - Code↔Visual 동기화, PixiJS, 노드 시스템
5. ✅ **Additional Features** - 12개 혁신 기능

### Technical (5개)
1. ✅ **Plugin System** - WASM 런타임, API, 권한, Marketplace
2. ✅ **Frontend Optimization** - SolidJS 렌더링, 애니메이션, 성능 최적화
3. ✅ **Testing Strategy** - 테스트 피라미드, Rust/TS 테스트
4. ✅ **Accessibility** - WCAG 2.1 AA, 스크린 리더, 키보드
5. ✅ **Internationalization** - i18n, 다국어, RTL 지원

### Review & Scenarios (2개)
1. ✅ **Document Review** - 문서 완성도 평가, 성능 병목 분석, 권장 도구
2. ✅ **IDE Scenarios** - 12개 상세 사용 시나리오

**총 21개 핵심 설계 문서 완성**

---

## 🎨 설계 원칙

| 원칙 | 설명 |
|------|------|
| **In-place Enhancement** | 새로운 뷰를 만들기보다 기존 UI에 디테일 추가 |
| **Progressive Disclosure** | 기능이 많아지면 그때 별도 뷰로 분리 |
| **Performance First** | 고급 기능을 넣더라도 성능은 최적 유지 |
| **Full Control** | 에디터 자체 구현으로 완전한 커스터마이징 |
| **VSCode Parity+** | VSCode 편의 기능 전부 포함 + 추가 혁신 |

---

## 📈 성능 목표

| 작업 | 목표 시간 | 비고 |
|------|----------|------|
| 키 입력 → 화면 반영 | < 16ms | 60fps 유지 |
| 파일 열기 (10KB) | < 100ms | |
| 파일 열기 (1MB) | < 500ms | |
| 자동완성 표시 | < 100ms | 첫 결과 |
| 정의로 이동 | < 200ms | 캐시된 경우 < 50ms |
| 전역 검색 시작 | < 50ms | 첫 결과 스트리밍 |
| 앱 시작 | < 2s | 콜드 스타트 |

상세 분석: [document-review.md](./review/document-review.md)

---

## 🔍 주요 최적화 전략

### 에디터 엔진
- Rope 데이터 구조로 O(log n) 편집
- **Tree-sitter 증분 파싱** (변경된 부분만 재파싱)
- 뷰포트 클리핑 (보이는 부분만 렌더링)
- 캐싱 (Depth Map, Syntax Highlights)

### IPC
- 배치 업데이트 (여러 변경을 한 번에)
- 델타 전송 (전체가 아닌 변경분만)
- 디바운싱 (빈번한 이벤트 제한)
- **SharedArrayBuffer** (대용량 데이터 zero-copy)
- **MessagePack** (JSON보다 빠른 직렬화)

### Frontend (SolidJS)
- **Fine-grained Signals** (개별 컴포넌트 내부 상태 관리)
- **Optimistic Updates** (낙관적 업데이트로 즉각 반응)
- **Virtual List** (대량 아이템 렌더링)
- **CSS Containment** (레이아웃 격리)
- **WAAPI/Motion One** (GPU 가속 애니메이션)

### 검색
- **스트리밍 결과** (첫 결과 즉시 표시)
- 배치 전송 (16ms/10개 단위)
- ignore 크레이트 병렬 처리

---

## 📖 문서 읽는 순서

### 프로젝트 이해 (처음 시작)
1. `overview.md` - 프로젝트 전체 개요
2. `research/zed-analysis.md` - 참고 아키텍처 (Zed)

### 아키텍처 이해 (구현 준비)
3. `architecture.md` - 전체 아키텍처
4. `architecture/editor-engine.md` - 에디터 엔진
5. `architecture/ipc-protocol.md` - IPC 프로토콜
6. `architecture/state-management.md` - 상태 관리

### 핵심 기능 (차별화 포인트)
7. `specs/navigation.md` - Navigation 전체
8. `specs/tree-viewer.md` - Tree Viewer (가장 혁신적)
9. `specs/context-action-palette.md` - Context Action Palette
10. `specs/visual-coding.md` - Visual Coding

### 기술 상세 (구현 시 참조)
11. `technical/plugin-system.md` - 플러그인 시스템
12. `technical/frontend-optimization.md` - 프론트엔드 최적화
13. `review/document-review.md` - 성능 목표, 권장 도구

---

## 💡 핵심 혁신 요약

### 1. Tree Viewer & Fold
- **깊이별 컬러 컨테이닝**: 각 중첩 레벨마다 다른 배경색
- **스티키 헤더**: 스크롤 시 현재 컨텍스트 상단 고정
- **피그마식 Fold**: n-depth 이하 자동 접기
- **Depth Navigation**: 같은 깊이 블록 간 이동 (Cmd+Shift+↑↓)

### 2. Context Action Palette
- **컨텍스트 분석**: 커서 위치, 파일 상태, 프로젝트 상태 종합 분석
- **스마트 제안**: 현재 상황에서 필요한 액션만 표시
- **Tab Completion**: Tab 한 번에 가장 추천하는 액션 즉시 실행
- **학습 시스템**: 사용 패턴 추적하여 개인화된 제안

### 3. Visual Coding
- **양방향 동기화**: Code ↔ Visual 실시간 동기화
- **PixiJS 렌더링**: WebGPU/WebGL2 고성능
- **자동 레이아웃**: ELK 알고리즘으로 노드 자동 배치
- **노드 팔레트**: 드래그 앤 드롭으로 노드 추가

---

## 🤝 기여 가이드

이 문서들은 **설계 단계**입니다. 실제 구현 시:

1. 각 문서의 "구현 로드맵" 섹션 참고
2. 테스트 전략 포함 (`testing-strategy.md`)
3. 성능 벤치마크 목표 달성 (`document-review.md`)
4. 접근성 준수 (`accessibility.md`)

---

## 📝 라이센스

**유료 제품** (오픈소스 아님)

판매 방식: TBD (라이센스? 구독?)

---

**Last Updated**: 2026-01-24
**Version**: 1.2.0 (Design Phase - Full Documentation)
**Total Documents**: 21 (완성)
