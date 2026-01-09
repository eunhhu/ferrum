# Ferrum IDE 문서 검토 리포트

> **검토 목적**: 구현 전 문서 완성도 점검 및 성능 병목 분석

---

## 1. 문서 완성도 평가

### 1.1 잘 작성된 부분

| 문서 | 강점 |
|------|------|
| **editor-engine.md** | DisplayMap 파이프라인, Rope 구조 상세 설명 |
| **ipc-protocol.md** | 메시지 타입 정의, 배칭 전략 명확 |
| **lsp-integration.md** | 공식 LSP 서버 목록, 프로토콜 처리 흐름 |
| **tree-viewer.md** | 깊이 분석 알고리즘, 렌더링 최적화 |
| **zed-analysis.md** | Zed 아키텍처 분석, 적용 방향 명확 |

### 1.2 누락/보완 필요 항목

#### A. 아키텍처 수준

| 항목 | 현황 | 필요 내용 |
|------|------|----------|
| **에러 처리 전략** | 언급 없음 | 전역 에러 핸들링, 사용자 피드백 정책 |
| **로깅/텔레메트리** | 언급 없음 | 로그 레벨, 수집 범위, 개인정보 정책 |
| **테스트 전략** | 부분적 | 단위/통합/E2E 테스트 계획 |
| **빌드/배포** | 언급 없음 | CI/CD, 크로스 플랫폼 빌드 |
| **접근성(a11y)** | 언급 없음 | 키보드 네비게이션, 스크린 리더 |
| **국제화(i18n)** | 언급 없음 | 다국어 지원 전략 |

#### B. 기능 수준

| 항목 | 현황 | 필요 내용 |
|------|------|----------|
| **파일 탐색기** | 언급 없음 | 트리 구조, 가상화, 성능 |
| **검색/바꾸기** | 언급 없음 | 전역 검색, 정규식, ripgrep 통합 |
| **터미널 통합** | overview에 언급 | 상세 스펙 필요 |
| **Git 통합** | overview에 언급 | 상세 스펙 필요 |
| **디버거** | 언급 없음 | DAP 통합 계획 |
| **설정 시스템** | 부분적 | UI, 스키마, 동기화 |

#### C. 기술 수준

| 항목 | 현황 | 필요 내용 |
|------|------|----------|
| **메모리 관리** | 부분적 | 버퍼 해제 전략, 메모리 한계 |
| **동시성 모델** | 부분적 | 스레드 풀, async 런타임 선택 |
| **캐싱 전략** | 부분적 | 캐시 무효화, 크기 제한 |
| **오프라인 모드** | 언급 없음 | LSP 번들링 상세 |

---

## 2. 성능 병목 분석

### 2.1 Critical Path (핵심 경로)

```
키 입력 → 버퍼 수정 → 파싱 → 하이라이팅 → 렌더링 → 화면 표시
목표: < 16ms (60fps)
```

### 2.2 식별된 병목 지점

#### 병목 #1: IPC 통신 오버헤드

**위치**: Frontend ↔ Backend 통신

**문제**:
- 키 입력마다 IPC 왕복 발생
- JSON 직렬화/역직렬화 비용
- 대용량 텍스트 전송 시 지연

**현재 문서 대응**: ipc-protocol.md에 배칭, 델타 업데이트 언급

**보완 필요**:
```
1. 입력 디바운싱 구체적 시간 (현재: "16ms~100ms" 범위로 언급)
   → 명확히: 타이핑 중 = 16ms, 유휴 시 = 100ms

2. 바이너리 프로토콜 고려
   → MessagePack 또는 Protocol Buffers
   → JSON 대비 2-3배 빠름

3. WebSocket vs Tauri Command 벤치마크
   → 어떤 채널이 더 효율적인지 측정 필요
```

#### 병목 #2: Tree-sitter 파싱

**위치**: 텍스트 변경 후 구문 분석

**문제**:
- 대용량 파일 초기 파싱 시간
- 복잡한 언어(TypeScript)의 증분 파싱 비용
- 파서 인스턴스 생성 오버헤드

**현재 문서 대응**: editor-engine.md에 "증분 파싱" 언급

**보완 필요**:
```
1. 파서 풀링 상세
   - 언어당 파서 인스턴스 수
   - 풀 크기 제한 (메모리 vs 성능)

2. 파싱 우선순위
   - 뷰포트 내 영역 먼저 파싱
   - 백그라운드에서 전체 파싱

3. 대용량 파일 처리
   - 10,000줄 이상: 부분 파싱 전략
   - 100,000줄 이상: 비활성화 또는 경고
```

#### 병목 #3: 렌더링 파이프라인

**위치**: DisplayMap → Frontend 렌더링

**문제**:
- 긴 라인 렌더링 (soft wrap)
- 많은 decoration (진단, highlight)
- PixiJS WebGPU 초기화 시간

**현재 문서 대응**: tree-viewer.md에 "뷰포트 클리핑" 언급

**보완 필요**:
```
1. 가상 스크롤링 상세
   - 버퍼 영역 (뷰포트 ± N줄)
   - 스크롤 중 렌더링 최적화

2. Canvas vs DOM 하이브리드
   - 텍스트: Canvas (성능)
   - UI 요소: DOM (접근성)

3. 레이어 분리
   - 배경 레이어 (depth color)
   - 텍스트 레이어
   - 오버레이 레이어 (커서, 선택)
   → 변경된 레이어만 다시 그리기
```

#### 병목 #4: LSP 응답 지연

**위치**: 자동완성, 정의로 이동 등

**문제**:
- 서버 응답 대기 시간 (수백ms~수초)
- 대규모 프로젝트에서 인덱싱 시간
- 동시 요청 처리

**현재 문서 대응**: lsp-integration.md에 "타임아웃 120초" 언급

**보완 필요**:
```
1. 요청 취소 전략
   - 새 요청 시 이전 요청 취소
   - 디바운싱으로 불필요한 요청 방지

2. 캐싱
   - 정의 위치 캐싱 (파일 변경 시 무효화)
   - 자동완성 결과 부분 캐싱

3. 프로그레스 표시
   - 인덱싱 진행률
   - "LSP 준비 중" 상태 표시
```

#### 병목 #5: 메모리 사용량

**위치**: 다중 버퍼, LSP 데이터, 캐시

**문제**:
- 큰 파일 여러 개 열 때 메모리 폭증
- LSP 진단 데이터 누적
- Undo 히스토리 무제한 증가

**현재 문서 대응**: state-management.md에 "버퍼 관리" 언급

**보완 필요**:
```
1. 메모리 한계 설정
   - 총 메모리 사용량 모니터링
   - 임계값 도달 시 LRU 버퍼 해제

2. Undo 히스토리 제한
   - 트랜잭션 수 제한 (예: 1000개)
   - 오래된 히스토리 병합

3. LSP 데이터 정리
   - 닫힌 파일의 진단 제거
   - 주기적 가비지 컬렉션
```

### 2.3 성능 목표 명시

```
| 작업 | 목표 시간 | 비고 |
|------|----------|------|
| 키 입력 → 화면 반영 | < 16ms | 60fps 유지 |
| 파일 열기 (10KB) | < 100ms | |
| 파일 열기 (1MB) | < 500ms | |
| 자동완성 표시 | < 100ms | 첫 결과 |
| 정의로 이동 | < 200ms | 캐시된 경우 < 50ms |
| 전역 검색 시작 | < 50ms | 첫 결과 스트리밍 |
| 앱 시작 | < 2s | 콜드 스타트 |
```

---

## 3. 권장 도구/스택 구체화

### 3.1 현재 스택 (문서 기준)

| 레이어 | 기술 | 상태 |
|--------|------|------|
| Frontend | SolidJS + TailwindCSS 4.x | 확정 |
| 에디터 렌더링 | PixiJS (WebGPU) | 확정 |
| Backend | Rust + Tauri | 확정 |
| 텍스트 버퍼 | ropey | 확정 |
| 파싱 | tree-sitter | 확정 |
| LSP | 공식 서버 번들링 | 확정 |
| 플러그인 런타임 | QuickJS (MVP) | 확정 |

### 3.2 추가 권장 도구

#### Rust 크레이트

```toml
# 비동기 런타임
tokio = { version = "1.x", features = ["full"] }

# 직렬화 (JSON 대안)
rmp-serde = "1.x"  # MessagePack - IPC 최적화용
bincode = "2.x"    # 바이너리 직렬화 (내부 상태)

# 검색
ripgrep = "0.x"    # 또는 grep 크레이트 직접 사용
ignore = "0.x"     # .gitignore 처리

# 파일 감시
notify = "6.x"     # 크로스 플랫폼 파일 감시

# 동시성
parking_lot = "0.12"  # 더 빠른 Mutex/RwLock
dashmap = "5.x"       # 동시성 HashMap

# 로깅
tracing = "0.1"       # 구조화된 로깅
tracing-subscriber = "0.3"

# 에러 처리
thiserror = "2.x"
anyhow = "1.x"

# 테스트
insta = "1.x"         # 스냅샷 테스트
criterion = "0.5"     # 벤치마크
```

#### Frontend 라이브러리

```json
{
  "dependencies": {
    "solid-js": "^1.9",
    "@tauri-apps/api": "^2.x",
    "pixi.js": "^8.x",
    "elkjs": "^0.9",           // 노드 레이아웃 (Visual Coding)
    "fuse.js": "^7.x",         // 퍼지 검색 (Command Palette)
    "virtua": "^0.x"           // 가상 스크롤링
  },
  "devDependencies": {
    "vite": "^6.x",
    "vitest": "^2.x",
    "@testing-library/solid": "^1.x",
    "playwright": "^1.x"       // E2E 테스트
  }
}
```

### 3.3 아키텍처 조정 권장사항

#### 조정 #1: IPC 프로토콜 이원화

```
빈번한 작업 (타이핑, 스크롤):
  → MessagePack 바이너리
  → WebSocket 스트리밍

비빈번한 작업 (파일 열기, 설정 변경):
  → Tauri Command (JSON)
  → Request/Response
```

#### 조정 #2: 렌더링 하이브리드

```
Canvas 렌더링:
  - 텍스트 콘텐츠
  - 구문 강조
  - 깊이 배경

DOM 렌더링:
  - 커서 (CSS 애니메이션)
  - 자동완성 드롭다운
  - 툴팁
  - 스티키 헤더
```

#### 조정 #3: Worker 분리

```
Main Thread:
  - UI 렌더링
  - 사용자 입력 처리

Web Worker:
  - 검색/바꾸기
  - 대용량 파일 처리
  - 포맷팅

Rust Backend:
  - 텍스트 버퍼 관리
  - Tree-sitter 파싱
  - LSP 통신
  - 파일 I/O
```

---

## 4. 누락 문서 보완 목록

### 4.1 신규 문서 필요

1. **plans/architecture/file-explorer.md**
   - 트리 구조 관리
   - 가상화 (대규모 디렉토리)
   - 검색 통합
   - Git 상태 표시

2. **plans/architecture/search-system.md**
   - 파일 검색 (fuzzy)
   - 텍스트 검색 (ripgrep)
   - 심볼 검색 (LSP)
   - 결과 스트리밍

3. **plans/architecture/terminal-integration.md**
   - PTY 통합
   - 쉘 감지
   - 테마 동기화
   - 분할 터미널

4. **plans/architecture/git-integration.md**
   - 상태 표시
   - Diff 뷰어
   - 커밋/푸시
   - 브랜치 관리

5. **plans/technical/testing-strategy.md**
   - 단위 테스트 (Rust + TS)
   - 통합 테스트
   - E2E 테스트 (Playwright)
   - 성능 벤치마크

6. **plans/technical/error-handling.md**
   - 에러 분류
   - 사용자 피드백
   - 로깅 전략
   - 복구 전략

7. **plans/technical/build-deploy.md**
   - CI/CD 파이프라인
   - 크로스 플랫폼 빌드
   - 자동 업데이트
   - 배포 채널

### 4.2 기존 문서 보완

| 문서 | 보완 항목 |
|------|----------|
| overview.md | 성능 목표 명시, 비기능 요구사항 |
| editor-engine.md | 파서 풀링 상세, 메모리 제한 |
| ipc-protocol.md | MessagePack 옵션, 벤치마크 계획 |
| state-management.md | 메모리 한계, GC 전략 |

---

## 5. 다음 단계 권장

### 즉시 (문서 보완)
1. 누락된 핵심 문서 작성 (file-explorer, search-system)
2. 성능 목표 overview.md에 명시
3. 에러 처리 전략 문서화

### 단기 (프로토타입)
1. IPC 벤치마크 (JSON vs MessagePack)
2. Tree-sitter 파서 풀링 프로토타입
3. Canvas + DOM 하이브리드 렌더링 테스트

### 중기 (MVP 기반)
1. 테스트 인프라 구축
2. CI/CD 파이프라인
3. 성능 프로파일링 자동화
