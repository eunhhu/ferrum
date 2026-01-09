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
- **[editor-engine.md](./architecture/editor-engine.md)** ✅ - 에디터 엔진 설계
  - Rope 데이터 구조 (ropey)
  - Anchor 시스템
  - 멀티 커서/선택
  - Edit History (Undo/Redo)
  - DisplayMap (좌표 변환 파이프라인)

- **[ipc-protocol.md](./architecture/ipc-protocol.md)** ✅ - Tauri IPC 프로토콜
  - Command (Frontend → Backend)
  - Event (Backend → Frontend)
  - 최적화 (배치 업데이트, 델타 전송, 디바운싱)
  - TypeScript API 래퍼

- **[lsp-integration.md](./architecture/lsp-integration.md)** ✅ - LSP 통합
  - LSP 클라이언트 구조
  - 16개 언어 번들 LSP 서버
  - JSON-RPC 통신
  - 증분 동기화
  - 성능 최적화

- **[state-management.md](./architecture/state-management.md)** ✅ - 상태 관리
  - AppState 구조
  - BufferManager
  - Editor, ProjectManager, Workspace
  - ThemeManager, Config
  - 세션 저장/복원

### 4. Core Features (핵심 기능 스펙)

#### 4.1 혁신 기능
- **[tree-viewer.md](./specs/tree-viewer.md)** ✅ - Tree Viewer & Tree Fold
  - 깊이별 컬러 컨테이닝
  - 스티키 헤더 (Monaco Sticky Scroll++)
  - 피그마식 Tree Fold (n-depth 접기)
  - Depth Navigation (같은 깊이 블록 간 이동)
  - Breadcrumb Navigation
  - Depth Highlight on Hover
  - Structural Minimap

- **[context-action-palette.md](./specs/context-action-palette.md)** ✅ - Context Action Palette
  - 컨텍스트 분석 (Cursor, File, Project, Workflow)
  - 스마트 액션 제안 (테스트 생성, 리팩토링, 문서화, Git)
  - Tab Completion (가장 추천하는 액션 즉시 실행)
  - 학습 시스템 (사용 패턴 추적)
  - AI 통합 (선택적, OpenRouter)

- **[visual-coding.md](./specs/visual-coding.md)** ✅ - Visual Coding (Node-based)
  - Code ↔ Visual 양방향 동기화
  - PixiJS 기반 렌더링 (WebGPU/WebGL2)
  - 노드 시스템 (Data, Operations, Control Flow, I/O)
  - 자동 레이아웃 (ELK)
  - 실시간 동기화
  - 노드 팔레트, 미니맵

#### 4.2 추가 기능
- **[additional-features.md](./specs/additional-features.md)** ✅ - 기타 혁신 기능
  - Navigation Trail (브라우저 뒤로/앞으로 스타일)
  - Dependency Highlight (파일 간 의존성 시각화)
  - Related Files (Component + Test + Types + Styles)
  - Componentify (After Effects Precomp 스타일)
  - Error Flow Inline (에러 전파 경로 시각화)
  - Env Manager (환경변수 자동 감지 & 관리)
  - Smart Selection Expansion (AST 기반)
  - Peek View (인라인 정의 팝업)
  - Inline Blame (Git Lens 스타일)
  - Block Region Highlight

### 5. Technical (기술 설계)
- **[plugin-system.md](./technical/plugin-system.md)** ✅ - Plugin System
  - QuickJS 런타임 (작은 크기, 빠른 시작)
  - Plugin API (Editor, UI, FileSystem)
  - 권한 시스템 (샌드박싱)
  - Plugin Manifest
  - 마켓플레이스

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
| **Plugin Runtime** | QuickJS | 작은 크기, 샌드박싱 |
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
│  │  │              │  │    (grep)    │  │  Management │  │  │
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
- [ ] Plugin System (QuickJS)
- [ ] Plugin API (Editor, UI, FS)

#### Phase 5: AI (Week 33-36)
- [ ] OpenRouter SDK 연동
- [ ] 로컬 오픈소스 모델 연동
- [ ] Context Action Palette AI 통합

### Post-MVP
- [ ] Plugin Marketplace
- [ ] Theme System 확장
- [ ] Mobile (클라우드 + 비주얼 코딩 전용)
- [ ] 제스처 시스템

---

## 📊 완성된 설계 문서 요약

### Research (1개)
✅ **Zed 분석** - 209개 크레이트 구조, Rope + SumTree, GPUI, LSP, IPC 전체 분석

### Architecture (4개)
1. ✅ **Editor Engine** - Rope, Anchor, Selection, DisplayMap (10주 로드맵)
2. ✅ **IPC Protocol** - Command/Event, 최적화 (배치, 델타, 디바운싱)
3. ✅ **LSP Integration** - 클라이언트 구조, 번들 LSP, 성능 최적화
4. ✅ **State Management** - AppState, BufferManager, Workspace, 세션 저장

### Core Features (4개)
1. ✅ **Tree Viewer** - 깊이 컬러, 스티키 헤더, n-depth 접기, Navigation (10주)
2. ✅ **Context Action Palette** - 컨텍스트 분석, 스마트 제안, 학습, AI (7주)
3. ✅ **Visual Coding** - Code↔Visual 동기화, PixiJS, 노드 시스템 (10주)
4. ✅ **Additional Features** - 12개 혁신 기능 (Navigation Trail, Dependency Highlight 등)

### Technical (1개)
✅ **Plugin System** - QuickJS 런타임, API, 권한, Marketplace (8주)

**총 10개 핵심 설계 문서 완성**

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

## 🔍 주요 최적화 전략

### 에디터 엔진
- Rope 데이터 구조로 O(log n) 편집
- 증분 업데이트 (전체 재계산 방지)
- 뷰포트 클리핑 (보이는 부분만 렌더링)
- 캐싱 (Depth Map, Syntax Highlights)

### IPC
- 배치 업데이트 (여러 변경을 한 번에)
- 델타 전송 (전체가 아닌 변경분만)
- 디바운싱 (빈번한 이벤트 제한)
- 우선순위 큐 (중요한 이벤트 먼저)

### Visual Coding
- 뷰포트 클리핑 (PixiJS)
- LOD (Level of Detail)
- Object Pooling
- WebGPU 활용

---

## 📖 문서 읽는 순서

### 프로젝트 이해 (처음 시작)
1. `overview.md` - 프로젝트 전체 개요
2. `research/zed-analysis.md` - 참고 아키텍처 (Zed)

### 아키텍처 설계 (기술 파악)
3. `architecture/editor-engine.md` - 에디터 엔진 (가장 중요)
4. `architecture/ipc-protocol.md` - Frontend-Backend 통신
5. `architecture/lsp-integration.md` - LSP 통합
6. `architecture/state-management.md` - 상태 관리

### 핵심 기능 (차별화 포인트)
7. `specs/tree-viewer.md` - Tree Viewer (가장 혁신적)
8. `specs/context-action-palette.md` - Context Action Palette
9. `specs/visual-coding.md` - Visual Coding
10. `specs/additional-features.md` - 기타 12개 혁신 기능
11. `technical/plugin-system.md` - Plugin System

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
2. 테스트 전략 포함
3. 성능 벤치마크 목표 달성
4. 사용자 편의성 우선

---

## 📝 라이센스

**유료 제품** (오픈소스 아님)

판매 방식: TBD (라이센스? 구독?)

---

## 📧 Contact

프로젝트 관련 문의: [TBD]

---

**Last Updated**: 2024-01-09
**Version**: 1.0.0 (Design Phase)
**Total Documents**: 10 (완성)
