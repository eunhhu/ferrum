# Ferrum IDE Runbook

운영 및 배포를 위한 런북입니다.

## 목차

- [배포 절차](#배포-절차)
- [시스템 요구사항](#시스템-요구사항)
- [모니터링](#모니터링)
- [일반적인 문제 및 해결책](#일반적인-문제-및-해결책)
- [성능 최적화](#성능-최적화)
- [롤백 절차](#롤백-절차)

---

## 배포 절차

### 1. 빌드 준비

```bash
# 의존성 확인
bun install

# 전체 검사 (필수)
bun run check

# 테스트 실행
bun run test:run
bun run test:e2e

# Rust 테스트
cargo test --workspace
```

### 2. 프로덕션 빌드

```bash
# Tauri 프로덕션 빌드
bun run build
```

### 빌드 결과물 위치

| 플랫폼 | 경로 | 형식 |
|--------|------|------|
| **macOS** | `src-tauri/target/release/bundle/dmg/` | `.dmg` |
| **Windows** | `src-tauri/target/release/bundle/msi/` | `.msi` |
| **Linux** | `src-tauri/target/release/bundle/deb/` | `.deb`, `.AppImage` |

### 3. 배포 체크리스트

- [ ] 모든 테스트 통과
- [ ] `bun run check` 통과
- [ ] 테스트 커버리지 80% 이상
- [ ] 버전 번호 업데이트
  - `package.json`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/Cargo.toml`
- [ ] CHANGELOG 업데이트
- [ ] 릴리즈 노트 작성

---

## 시스템 요구사항

### 최소 사양

| 항목 | 요구사항 |
|------|----------|
| **OS** | macOS 10.15+, Windows 10+, Ubuntu 20.04+ |
| **RAM** | 4GB (권장 8GB) |
| **디스크** | 500MB 여유 공간 |
| **CPU** | 듀얼 코어 이상 |

### 권장 사양 (대용량 파일 작업 시)

| 항목 | 요구사항 |
|------|----------|
| **RAM** | 16GB+ |
| **디스크** | SSD |
| **CPU** | 쿼드 코어 이상 |

---

## 모니터링

### 로그 위치

#### 개발 모드
- **프론트엔드**: 브라우저 개발자 도구 콘솔
- **백엔드**: 터미널 출력 (`RUST_LOG=debug bun run dev`)

#### 프로덕션

| 플랫폼 | 로그 경로 |
|--------|----------|
| **macOS** | `~/Library/Logs/ferrum/` |
| **Windows** | `%APPDATA%\ferrum\logs\` |
| **Linux** | `~/.local/share/ferrum/logs/` |

### 로그 레벨 설정

```bash
# 환경 변수로 로그 레벨 설정
RUST_LOG=debug ./ferrum        # 상세 로그
RUST_LOG=info ./ferrum         # 일반 정보
RUST_LOG=warn ./ferrum         # 경고만
RUST_LOG=error ./ferrum        # 에러만

# 모듈별 설정
RUST_LOG=ferrum_lsp=debug,ferrum_buffer=info ./ferrum
```

### 성능 지표

| 항목 | 정상 범위 | 경고 | 위험 |
|------|----------|------|------|
| **메모리 사용량** | < 300MB | 300-500MB | > 500MB |
| **CPU 사용량** | < 30% | 30-50% | > 50% (지속) |
| **LSP 응답시간** | < 100ms | 100-500ms | > 500ms |
| **파싱 시간** | < 50ms | 50-200ms | > 200ms |

---

## 일반적인 문제 및 해결책

### 빌드 문제

#### Rust 컴파일 에러

**증상**: `cargo build` 실패

**해결**:
```bash
# 1. Rust 툴체인 업데이트
rustup update stable

# 2. 클린 빌드
cargo clean
bun run build

# 3. 캐시 완전 정리
rm -rf target/
rm -rf node_modules/.vite/
```

#### Node 의존성 문제

**증상**: `bun install` 실패 또는 모듈 not found

**해결**:
```bash
# node_modules 재설치
rm -rf node_modules
rm bun.lock
bun install
```

#### Tauri 빌드 실패

**증상**: `tauri build` 에러

**해결**:
```bash
# 1. Tauri CLI 재설치
bun add -D @tauri-apps/cli@latest

# 2. 캐시 정리
rm -rf src-tauri/target

# 3. 시스템 의존성 확인 (Linux)
sudo apt install libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev

# 4. 다시 빌드
bun run build
```

---

### 런타임 문제

#### LSP 연결 실패

**증상**: 코드 자동완성, 정의 이동 안됨

**진단**:
```bash
# LSP 서버 설치 확인
which rust-analyzer
which typescript-language-server
which pyright
```

**해결**:

1. **언어별 LSP 서버 설치**

| 언어 | 서버 | 설치 명령 |
|------|------|----------|
| Rust | rust-analyzer | `rustup component add rust-analyzer` |
| TypeScript/JavaScript | typescript-language-server | `bun add -g typescript-language-server` |
| Python | pyright | `bun add -g pyright` |
| Go | gopls | `go install golang.org/x/tools/gopls@latest` |

2. **프로젝트 루트 확인**
   - TypeScript: `tsconfig.json` 또는 `package.json` 존재
   - Rust: `Cargo.toml` 존재
   - Python: `pyproject.toml` 또는 `requirements.txt`

3. **LSP 로그 확인**
```bash
RUST_LOG=ferrum_lsp=debug bun run dev
```

#### 구문 강조 안됨

**증상**: 코드 색상 없음, 흑백 텍스트

**해결**:

1. **지원 언어 확인**
   - 지원: Rust, TypeScript, JavaScript, Python, Go, C, C++, Java, HTML, CSS, JSON, Markdown

2. **tree-sitter 쿼리 확인**
```bash
ls crates/ferrum_buffer/queries/
```

#### AI 기능 안됨

**Cloud AI (OpenRouter)**:

1. API 키 설정 확인
```bash
echo $OPENROUTER_API_KEY
```

2. 네트워크 연결 확인
```bash
curl https://openrouter.ai/api/v1/models
```

**Local AI (Ollama)**:

1. Ollama 서비스 실행 확인
```bash
ollama serve
```

2. 모델 설치 확인
```bash
ollama list
```

3. 모델 다운로드
```bash
ollama pull codellama
ollama pull llama3.2
```

---

### 성능 문제

#### 대용량 파일 느림

**증상**: 10MB+ 파일에서 입력 지연

**해결**:

1. **가상 스크롤링 확인** - 보이는 라인만 렌더링
2. **구문 강조 최적화** - 증분 파싱으로 < 50ms 유지

**성능 타겟**:

| 파일 크기 | 입력 지연 목표 |
|----------|---------------|
| < 1MB | < 8ms |
| 1-10MB | < 16ms |
| 10-100MB | < 50ms |

#### 높은 CPU 사용량

**증상**: 지속적으로 CPU 50% 이상

**일반적인 원인**:
- LSP 서버 과부하 → 재시작
- tree-sitter 무한 루프 → 파일 닫기 후 재오픈
- 플러그인 문제 → 플러그인 비활성화

---

## 성능 최적화

### 권장 설정

```json
// 대용량 파일 작업 시
{
  "editor.minimap": false,
  "editor.softWrap": false,
  "editor.renderWhitespace": "none"
}
```

### 메모리 관리

- **버퍼 제한**: 동시에 열 수 있는 파일 수 제한 (기본: 50)
- **캐시 정리**: LRU 캐시로 오래된 항목 자동 제거

### LSP 최적화

- 디바운싱: 입력 후 150ms 대기 후 요청
- 배치 처리: 여러 진단을 한 번에 처리
- 캐싱: 정의/참조 결과 캐싱

---

## 롤백 절차

### 1. 이전 버전 확인

```bash
git log --oneline -10
git tag -l 'v*'
```

### 2. 롤백 실행

```bash
# 특정 커밋으로
git checkout <commit-hash>

# 또는 이전 태그로
git checkout v0.0.9

# 의존성 재설치
bun install
cargo build --release
```

### 3. 재빌드 및 배포

```bash
bun run build
```

### 4. 롤백 후 확인

- [ ] 앱 정상 실행
- [ ] 핵심 기능 테스트 (파일 열기, 편집, 저장)
- [ ] LSP 연결 확인
- [ ] AI 기능 확인

---

## 버전 정보

| 항목 | 버전 |
|------|------|
| **Ferrum IDE** | 0.1.0 |
| **Tauri** | v2 |
| **SolidJS** | ^1.9.3 |
| **Rust** | stable |
| **tree-sitter** | 0.24+ |
| **ropey** | 1.6+ |

---

## 관련 문서

- **기여 가이드**: `docs/CONTRIB.md`
- **아키텍처 설계**: `docs/architecture/`
- **기능 스펙**: `docs/specs/`
- **기술 문서**: `docs/technical/`
