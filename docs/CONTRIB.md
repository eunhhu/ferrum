# Contributing to Ferrum IDE

Ferrum IDE 개발에 기여하기 위한 가이드입니다.

## 목차

- [개발 환경 설정](#개발-환경-설정)
- [사용 가능한 스크립트](#사용-가능한-스크립트)
- [개발 워크플로우](#개발-워크플로우)
- [프로젝트 구조](#프로젝트-구조)
- [아키텍처 개요](#아키텍처-개요)
- [코딩 컨벤션](#코딩-컨벤션)
- [테스트 가이드](#테스트-가이드)
- [Pull Request 가이드](#pull-request-가이드)

---

## 개발 환경 설정

### 필수 요구사항

| 도구 | 버전 | 설명 |
|------|------|------|
| **Bun** | 최신 | JavaScript 런타임 |
| **Rust** | stable (최신) | 백엔드 개발 |
| **Tauri CLI** | v2 | 데스크톱 앱 빌드 |

### 설치

```bash
# 저장소 클론
git clone https://github.com/anthropics/ferrum.git
cd ferrum

# 의존성 설치
bun install

# Rust 툴체인 확인
rustup update stable

# 개발 서버 시작
bun run dev
```

### 권장 IDE 설정

**VS Code 사용 시:**
- rust-analyzer
- Biome
- Tauri

---

## 사용 가능한 스크립트

### 개발

| 스크립트 | 명령어 | 설명 |
|---------|--------|------|
| `dev` | `bun run dev` | Tauri 개발 서버 (핫 리로드) |
| `vite` | `bun run vite` | Vite 개발 서버만 (프론트엔드) |

### 빌드

| 스크립트 | 명령어 | 설명 |
|---------|--------|------|
| `build` | `bun run build` | Tauri 프로덕션 빌드 |
| `vite:build` | `bun run vite:build` | Vite 프로덕션 빌드 |
| `vite:preview` | `bun run vite:preview` | 빌드 결과 미리보기 |

### 코드 품질

| 스크립트 | 명령어 | 설명 |
|---------|--------|------|
| `lint` | `bun run lint` | Biome 코드 검사 |
| `lint:fix` | `bun run lint:fix` | Biome 자동 수정 |
| `format` | `bun run format` | Biome 포맷팅 |
| `typecheck` | `bun run typecheck` | TypeScript 타입 검사 |
| `check` | `bun run check` | typecheck + biome 전체 검사 |

### 테스트

| 스크립트 | 명령어 | 설명 |
|---------|--------|------|
| `test` | `bun run test` | Vitest 테스트 (watch 모드) |
| `test:run` | `bun run test:run` | 테스트 1회 실행 |
| `test:coverage` | `bun run test:coverage` | 커버리지 리포트 (80%+ 유지) |
| `test:e2e` | `bun run test:e2e` | Playwright E2E 테스트 |
| `test:e2e:ui` | `bun run test:e2e:ui` | Playwright UI 모드 |
| `test:e2e:debug` | `bun run test:e2e:debug` | Playwright 디버그 모드 |

### Rust

| 스크립트 | 명령어 | 설명 |
|---------|--------|------|
| `rust:check` | `bun run rust:check` | cargo check |
| `rust:clippy` | `bun run rust:clippy` | cargo clippy |
| `rust:test` | `bun run rust:test` | cargo test |
| `rust:fmt` | `bun run rust:fmt` | cargo fmt |

---

## 개발 워크플로우

### 1. 기능 개발

```bash
# 1. 기능 브랜치 생성
git checkout -b feat/my-feature

# 2. 개발 서버 시작
bun run dev

# 3. 코드 작성 후 타입 검사
bun run typecheck

# 4. 커밋 전 전체 검사
bun run check
```

### 2. 테스트

```bash
# 단위 테스트 (TDD 권장)
bun run test

# 커버리지 확인 (80% 이상 유지 필수)
bun run test:coverage

# E2E 테스트
bun run test:e2e

# Rust 테스트
cargo test --workspace
```

### 3. 코드 품질

```bash
# 전체 검사
bun run check:all

# 자동 수정
bun run lint:fix
bun run format
```

---

## 프로젝트 구조

```
ferrum/
├── crates/                     # Rust 백엔드 크레이트
│   ├── ferrum_buffer/          # 텍스트 버퍼 (ropey), Tree-sitter 파싱
│   ├── ferrum_core/            # 공통 타입, 에러 정의
│   ├── ferrum_editor/          # 에디터 상태, 폴딩, DisplayMap
│   ├── ferrum_lsp/             # LSP 클라이언트/매니저
│   ├── ferrum_git/             # Git 통합 (git2)
│   └── ferrum_plugin/          # 플러그인 시스템
│
├── src/                        # TypeScript/SolidJS 프론트엔드
│   ├── components/             # UI 컴포넌트
│   │   ├── editor/             # 에디터 레이어 (6단계)
│   │   ├── tree-viewer/        # 파일 탐색기
│   │   └── ai/                 # AI 패널
│   ├── ipc/                    # Tauri IPC 명령어
│   ├── stores/                 # 상태 관리
│   └── hooks/                  # 커스텀 훅
│
├── src-tauri/                  # Tauri 설정 및 명령어
│   ├── src/
│   │   ├── commands/           # IPC 커맨드 핸들러
│   │   └── main.rs
│   └── tauri.conf.json
│
├── tests/                      # E2E 테스트 (Playwright)
└── docs/                       # 문서
```

---

## 아키텍처 개요

Ferrum IDE는 **Rust 백엔드 + SolidJS 프론트엔드** 아키텍처를 사용합니다.

### 핵심 기술 스택

| 레이어 | 기술 | 역할 |
|--------|------|------|
| **Frontend** | SolidJS + TypeScript | UI 렌더링 (Display Only) |
| **IPC** | Tauri Commands/Events | 프론트엔드-백엔드 통신 |
| **Backend** | Rust + Tokio | 모든 비즈니스 로직 |
| **Text Buffer** | ropey (Rope) | O(log n) 텍스트 연산 |
| **Parsing** | tree-sitter | 증분 구문 분석 |
| **LSP** | tower-lsp | 언어 서버 통합 |

### 데이터 흐름

```
사용자 입력
    ↓
SolidJS (키보드 이벤트 캡처)
    ↓
Tauri IPC (invoke/emit)
    ↓
Rust Backend (TextBuffer, Editor)
    ↓
Delta Update 계산
    ↓
Frontend 렌더링 (Layer Stack)
```

### 에디터 레이어 구조

```
L5: Overlay Layer      (툴팁, 자동완성)
L4: Decoration Layer   (인라인 위젯, 배지)
L3: Cursor Layer       (커서, 선택 영역)
L2: Highlight Layer    (구문 강조)
L1: Text Layer         (텍스트 렌더링)
L0: Background Layer   (라인 하이라이트)
```

자세한 아키텍처는 `docs/architecture/` 디렉토리를 참조하세요.

---

## 코딩 컨벤션

### TypeScript/SolidJS

```typescript
// ✅ 컴포넌트는 함수형으로
export function EditorView(props: EditorViewProps) {
  const [state, setState] = createSignal<EditorState>();
  
  // createMemo로 파생 상태 캐싱
  const visibleLines = createMemo(() => 
    computeVisibleLines(state())
  );
  
  return <div>{/* ... */}</div>;
}

// ✅ 타입은 명시적으로 정의
interface EditorViewProps {
  bufferId: string;
  readonly?: boolean;
}

// ✅ IPC 호출은 try-catch로 감싸기
async function insertText(text: string) {
  try {
    await invoke('editor_insert_text', { text });
  } catch (error) {
    console.error('Insert failed:', error);
  }
}
```

### Rust

```rust
// ✅ 에러는 thiserror로 정의
#[derive(Debug, thiserror::Error)]
pub enum BufferError {
    #[error("Position out of bounds: {0}")]
    OutOfBounds(Position),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

// ✅ 비동기는 tokio 사용
#[tauri::command]
async fn open_file(path: String) -> Result<BufferId, String> {
    // ...
}

// ✅ cargo fmt 및 cargo clippy 준수
```

### 린트 규칙

- Biome 설정 준수 (`biome.json`)
- `cargo fmt` 및 `cargo clippy` 통과 필수
- 커밋 전 `bun run check` 실행

---

## 테스트 가이드

### TDD 원칙

Ferrum IDE는 **TDD (Test-Driven Development)** 를 권장합니다.

1. **RED**: 실패하는 테스트 먼저 작성
2. **GREEN**: 테스트 통과하는 최소 코드 작성
3. **REFACTOR**: 코드 개선 (테스트는 계속 통과)

### 커버리지 요구사항

- **최소 80%** 코드 커버리지 유지
- 핵심 로직 (TextBuffer, Editor, LSP)은 90%+ 목표

### 테스트 종류

| 종류 | 비율 | 도구 | 대상 |
|------|------|------|------|
| Unit | 80% | Vitest, Rust test | 개별 함수/모듈 |
| Integration | 15% | Vitest | 컴포넌트 상호작용 |
| E2E | 5% | Playwright | 전체 사용자 플로우 |

### 예시

```typescript
// 단위 테스트 예시 (Vitest)
describe('calculateTotal', () => {
  it('should sum array of numbers', () => {
    // Arrange
    const numbers = [1, 2, 3];
    
    // Act
    const result = calculateTotal(numbers);
    
    // Assert
    expect(result).toBe(6);
  });
  
  it('should return 0 for empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });
});
```

```rust
// Rust 테스트 예시
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_buffer_insert() {
        let mut buffer = TextBuffer::new();
        buffer.insert(Position::new(0, 0), "Hello");
        assert_eq!(buffer.text(), "Hello");
    }
}
```

---

## Pull Request 가이드

### PR 체크리스트

PR 생성 전 다음 항목을 확인하세요:

- [ ] `bun run check` 통과
- [ ] `bun run test:run` 통과
- [ ] `cargo test --workspace` 통과
- [ ] 테스트 커버리지 80% 이상 유지
- [ ] 변경사항에 대한 테스트 추가
- [ ] 문서 업데이트 (필요시)

### 커밋 메시지 규칙

```
<type>: <subject>

예시:
feat: add multi-cursor support
fix: resolve LSP connection timeout
docs: update architecture diagram
refactor: simplify buffer operations
test: add unit tests for anchor system
chore: update dependencies
```

### PR 프로세스

1. `main` 브랜치에서 기능 브랜치 생성
2. 변경사항 작성 및 테스트
3. `bun run check` 통과 확인
4. PR 생성
5. 코드 리뷰 요청
6. 리뷰 반영 후 머지

---

## 환경 변수

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `OPENROUTER_API_KEY` | OpenRouter API 키 (Cloud AI) | 선택 |

> **참고**: Ollama를 사용한 로컬 AI는 API 키 없이 사용 가능합니다.

---

## 관련 문서

- **아키텍처 설계**: `docs/architecture/`
- **기능 스펙**: `docs/specs/`
- **기술 문서**: `docs/technical/`
- **런북**: `docs/RUNBOOK.md`
