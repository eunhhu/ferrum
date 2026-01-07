# Ferrum IDE Overview

## Vision

기존 IDE들이 AI Agent에만 집중하는 사이, Ferrum은 **개발자가 직접 코드베이스를 직관적으로 탐색/수정/설계**할 수 있는 도구에 집중한다.

> "UI 버그 하나 고치는데 AI한테 자연어로 설명하는 건 오버헤드다."

**핵심 가치:**
- 문제 지점으로 빠르게 접근
- 구조 시각화를 직관적으로 제공
- 코드 탐색과 다음 액션 제안
- 개발 생산성과 정확도 대폭 향상

---

## Philosophy & Priorities

### 우선순위
```
DX (개발 편의성) > 생산성 > 성능 > 확장성 > 디자인 > 기타
```

### 설계 원칙

| 원칙 | 설명 |
|------|------|
| **In-place Enhancement** | 새로운 뷰를 만들기보다 기존 UI에 디테일 추가 |
| **Progressive Disclosure** | 기능이 많아지면 그때 별도 뷰로 분리 |
| **Performance First** | 고급 기능을 넣더라도 성능은 최적 유지 |
| **Full Control** | 에디터 자체 구현으로 완전한 커스터마이징 |
| **VSCode Parity+** | VSCode 편의 기능 전부 포함 + 추가 혁신 |

---

## Target Users

- **모든 개발자** (언어/생태계 무관)
- 초보자: 빠르고 쉽게 배울 수 있음
- 시니어/파워유저: 더욱 빠르게 코딩 가능

---

## Business Model

- **유료 제품** (오픈소스 아님)
- 판매 방식: TBD (라이센스? 구독?)

---

## Platform Support

### Desktop (Primary)
- macOS, Windows, Linux
- 로컬 개발 환경
- 풀 기능 지원

### Mobile (Secondary)
- iOS, Android
- **클라우드 기반 개발만** (로컬 개발 미지원)
- **텍스트 코딩 미지원** → 비주얼 코딩 전용
- 별도 UI 설계
- 모바일 전용 제스처 지원

---

## Architecture

### Desktop

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

### Mobile

```
┌─────────────────────────────────────────┐
│              Mobile App                  │
│  ┌───────────────────────────────────┐  │
│  │     Mobile-specific UI            │  │
│  │  - Touch/Gesture optimized        │  │
│  │  - Visual Coding only             │  │
│  │  - PixiJS (Node-based editor)     │  │
│  └─────────────────┬─────────────────┘  │
│                    │                     │
│                    │ API                 │
│                    ▼                     │
│  ┌───────────────────────────────────┐  │
│  │         Cloud Backend             │  │
│  │  - Remote development env         │  │
│  │  - File sync                      │  │
│  │  - Build/Run                      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 역할 분리

| Layer | 역할 |
|-------|------|
| **SolidJS** | 순수 View 렌더링만 (상태/연산 없음) |
| **PixiJS** | 고성능 시각화 (프리뷰, 비주얼 코딩, 오버레이) |
| **Rust** | 상태관리, 연산, 파싱, 인덱싱, 검색 전부 |

---

## Tech Stack

| Category | Choice | Reason |
|----------|--------|--------|
| **Framework** | Tauri 2.0 | Native 성능, 작은 번들 |
| **Frontend** | SolidJS | No VDOM, 최고 성능 |
| **Styling** | Tailwind CSS 4.x | 빠른 개발 |
| **Visualization** | PixiJS | WebGPU/WebGL2, 2D Canvas 대비 고성능 |
| **Text Buffer** | ropey | Rope 자료구조, 대용량 파일 편집 |
| **AST Parsing** | tree-sitter | 범용 언어 지원, 증분 파싱 |
| **AST Utilities** | tree-sitter-highlight, tree-sitter-tags | 하이라이팅, 심볼 태깅 |
| **LSP** | 공식 LSP 서버 | 오프라인시 번들 LSP fallback |
| **Plugin Runtime** | JavaScript (V8/QuickJS) | 접근성, 생태계 |
| **Language** | Rust + TypeScript | Backend/Frontend |

### Bundled LSP Servers (Offline)

| Category | Languages |
|----------|-----------|
| **Web** | HTML, CSS, JavaScript, TypeScript |
| **Systems** | Rust, Go, C, C++, Zig |
| **Mobile** | Swift, Kotlin, Java |
| **Scripting** | Python, Ruby, PHP |
| **Other** | Erlang |

---

## AI Features

### Philosophy
- AI는 **보조 도구**이지 핵심이 아님
- 사용자가 직접 코드를 이해하고 제어하는 것이 우선

### Implementation

| Feature | Provider | Notes |
|---------|----------|-------|
| **AI Agent** | OpenRouter SDK | 사용자가 직접 API key 등록 |
| **기타 AI 기능** | 오픈소스 모델 (로컬) | 임베딩, 코드 검색 등 |

### AI Agent 기능 (via OpenRouter)
- 코드 생성/수정 제안
- 질의응답
- 리팩토링 제안

### 로컬 AI 기능 (오픈소스 모델)
- 코드 임베딩/시맨틱 검색
- 자동 완성 (소형 모델)
- 코드 요약

---

## Core Features

### Editor (자체 구현)

| Feature | Description |
|---------|-------------|
| Custom Cursoring | 다중 커서, 블록 선택 |
| Syntax Highlighting | Tree-sitter 기반 |
| Block Region Highlight | 스코프/블록 시각적 구분 |
| Block Commenting | 블록 단위 주석 |
| Drop Menu Customization | 컨텍스트 메뉴 완전 커스텀 |
| Smart Selection Expansion | AST 기반 구문 단위 선택 확장 |
| Peek View | 정의로 이동 없이 인라인 팝업 |
| Inline Blame | Git lens 스타일 줄별 blame |

### Navigation & Exploration

| Feature | Description |
|---------|-------------|
| **Tree Viewer** | 깊이별 컬러 컨테이닝 + 스티키 헤더 (Monaco sticky headline의 트리 버전) |
| **Tree Fold** | 피그마식 레이어 접근 + n-depth 이하 fold로 탐색 시간 단축 |
| **Navigation Trail** | 브레드크럼 + "어떻게 여기까지 왔는지" 히스토리 |
| **Dependency Highlight** | File Explorer에서 의존 파일에 라인 연결 / BG 하이라이트 |
| **Related Files** | 연관 파일 그룹핑 (Component + Test + Types + Styles) |

### Productivity

| Feature | Description |
|---------|-------------|
| **Context Action Palette** | Tab completion + 다음 액션 제안 (코드 생성 외 개발 흐름 유도) |
| **Error Flow Inline** | 에러 전파 경로를 기존 UI에서 인라인 하이라이트 |
| **Structural Minimap** | 함수/클래스/import 블록을 색으로 구분 (코드 "모양"이 아닌 "구조") |
| **Env Manager** | 환경변수 자동 감지 → .env.example / 스키마 빌더 자동 대입 |
| **Componentify** | 선택 영역 → 컴포넌트 추출 (After Effects precomp 스타일) |

### Visual Features (PixiJS)

| Feature | Description |
|---------|-------------|
| **Code/View Mode** | 코드 ↔ 비주얼 모드 전환 |
| **Compile-time Preview** | HMR 적용, 런타임 아닌 컴파일타임 프리뷰 |
| **Visual Coding** | Node-based (언어/프레임워크별 스펙 상이) |

---

## Plugin System

### 철학
- **VSCode 플러그인 생태계로부터 독립**
- Microsoft 종속 탈피
- 더 높은 수준의 커스터마이징 API 제공

### 기술 스택
- **구현 언어: JavaScript**
- 런타임: V8 또는 QuickJS (TBD)
- 샌드박싱 적용

### 요구사항
- 에디터 UI 깊은 수준까지 커스터마이징 가능
- 성능 저하 최소화
- 보안 (샌드박싱)

### TBD
- JS 런타임 선택 (V8 vs QuickJS)
- API 범위 설계
- 마켓플레이스 구조

---

## Roadmap

### MVP (현재 목표)
모든 구상된 기능 포함:

#### Foundation
- [ ] 자체 에디터 엔진 (ropey + tree-sitter)
- [ ] 기본 파일 탐색기
- [ ] 기본 탭 시스템
- [ ] LSP 연동
- [ ] 신택스 하이라이팅
- [ ] 번들 LSP (16개 언어)

#### Core DX
- [ ] Tree Viewer (깊이별 컬러)
- [ ] Tree Fold (피그마식)
- [ ] Navigation Trail
- [ ] Smart Selection Expansion
- [ ] Context Action Palette
- [ ] Peek View
- [ ] Inline Blame

#### Visual
- [ ] Code/View Mode 전환
- [ ] Compile-time Preview
- [ ] Structural Minimap
- [ ] Dependency Highlight

#### Advanced
- [ ] Visual Coding (Node-based)
- [ ] Env Manager
- [ ] Componentify
- [ ] Error Flow Visualization

#### AI
- [ ] OpenRouter SDK 연동
- [ ] 로컬 오픈소스 모델 연동

### Post-MVP

#### Ecosystem
- [ ] Plugin System (JS)
- [ ] Plugin Marketplace
- [ ] Theme System

#### Mobile
- [ ] 모바일 UI 설계
- [ ] 클라우드 백엔드
- [ ] 비주얼 코딩 (모바일 최적화)
- [ ] 제스처 시스템

---

## Open Questions

1. **Visual Coding 스펙** - 언어/프레임워크별 구체 설계
2. **JS Plugin 런타임** - V8 vs QuickJS?
3. **클라우드 백엔드 (모바일)** - 자체 구축? 기존 서비스 연동?
4. **로컬 AI 모델** - 어떤 오픈소스 모델?
5. **판매 모델** - 라이센스? 구독? Freemium?
