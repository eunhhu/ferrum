# Additional Features 통합 스펙

> 나머지 핵심 기능들의 설계 개요 (20개 기능)

## 목차

### Core Features
1. [Navigation Trail](#1-navigation-trail) - 네비게이션 히스토리
2. [Dependency Highlight](#2-dependency-highlight-파일-간-의존성-시각화) - 파일 간 의존성 시각화
3. [Related Files](#3-related-files-연관-파일-그룹핑) - 연관 파일 그룹핑
4. [Componentify](#4-componentify-컴포넌트-추출) - 컴포넌트 추출
5. [Error Flow Inline](#5-error-flow-inline-에러-전파-경로-시각화) - 에러 전파 시각화
6. [Env Manager](#6-env-manager-환경변수-관리) - 환경변수 관리
7. [Structural Minimap](#7-structural-minimap) - 구조적 미니맵
8. [Inline Blame](#8-inline-blame-git-lens-스타일) - Git Blame
9. [Smart Selection Expansion](#9-smart-selection-expansion-ast-기반) - AST 기반 선택 확장
10. [Peek View](#10-peek-view-인라인-팝업) - 인라인 정의 팝업
11. [Block Region Highlight](#11-block-region-highlight) - 블록 영역 하이라이트

### Collaboration & Productivity ⭐
12. [구현 우선순위](#12-구현-우선순위) - 우선순위 정리
13. [Terminal Integration](#13-terminal-integration-통합-터미널) - 통합 터미널 ⭐
14. [Vim Mode](#14-vim-mode-vim-에뮬레이션) - Vim 에뮬레이션 ⭐
15. [Collaboration](#15-collaboration-실시간-협업) - 실시간 협업 ⭐
16. [Template System](#16-template-system-코드-템플릿) - 코드 템플릿 ⭐

### Production-First Features ⭐⭐
17. [Comment System](#17-comment-system-figma-스타일-코멘트) - Figma 스타일 코멘트 ⭐⭐
18. [Web UI Editing](#18-web-ui-editing-프론트엔드-직접-편집) - 프론트엔드 직접 편집 ⭐⭐
19. [API Spec Editing](#19-api-spec-editing-백엔드-api-디자이너) - 백엔드 API 디자이너 ⭐⭐
20. [CLI Flow Designer](#20-cli-flow-designer-cli-시각화) - CLI 시각화 ⭐⭐

> ⭐ = Zed IDE 분석 후 추가된 기능
> ⭐⭐ = Production-First Development 비전에 따른 신규 기능

---

## 1. Navigation Trail

### 1.1 개념
**"어떻게 여기까지 왔는지" 히스토리 추적**

브라우저의 뒤로/앞으로 버튼처럼, 코드 네비게이션 히스토리를 관리합니다.

### 1.2 구조

```rust
pub struct NavigationTrail {
    history: VecDeque<NavigationEntry>,
    current_index: usize,
    max_entries: usize,
}

pub struct NavigationEntry {
    file_path: PathBuf,
    position: Position,
    timestamp: SystemTime,
    reason: NavigationReason,
}

pub enum NavigationReason {
    UserClick,
    GotoDefinition,
    FindReferences,
    Search,
    TreeNavigation,
    BreadcrumbClick,
}
```

### 1.3 UI

**Breadcrumb Trail (상단):**
```
Home > UserService.ts > processUser() > if (isPremium) > sendEmail()
```

**Navigation History Panel:**
```
┌──────────────────────────────────────┐
│ Navigation History              [X]  │
├──────────────────────────────────────┤
│ ← 10:35  UserService.ts:45           │  ← 뒤로 갈 수 있음
│   10:36  AuthService.ts:120          │
│ ▶ 10:37  UserModel.ts:23       [Now] │  ← 현재 위치
│   10:38  Dashboard.tsx:156           │  ← 앞으로 갈 수 있음
│   10:39  Header.tsx:89               │
└──────────────────────────────────────┘
```

### 1.4 키보드 단축키

```
Cmd+[  : 뒤로 가기
Cmd+]  : 앞으로 가기
Cmd+Shift+H : Navigation History Panel 열기
```

---

## 2. Dependency Highlight (파일 간 의존성 시각화)

### 2.1 개념

**File Explorer에서 의존 관계를 시각적으로 표시**

현재 파일이 import하는 파일들과, 현재 파일을 import하는 파일들을 하이라이트합니다.

### 2.2 시각화

**File Explorer:**
```
src/
  components/
    ┃ Header.tsx              ← 현재 파일
    ├─ Button.tsx            🔵 (Header가 import)
    ├─ Icon.tsx              🔵
  pages/
    ├─ Dashboard.tsx         🟢 (Header를 import)
    └─ Settings.tsx          🟢
  styles/
    └─ theme.ts              🔵
```

**색상:**
- 🔵 파란색: 현재 파일이 의존하는 파일 (dependencies)
- 🟢 초록색: 현재 파일을 의존하는 파일 (dependents)

### 2.3 라인 연결

**마우스 호버 시 연결선 표시:**
```
Header.tsx ────┐
               ├─→ Button.tsx
               ├─→ Icon.tsx
               └─→ theme.ts
```

### 2.4 구현

```rust
pub struct DependencyAnalyzer {
    // 파일 → 의존하는 파일들
    dependencies: HashMap<PathBuf, HashSet<PathBuf>>,

    // 파일 → 의존받는 파일들 (역방향)
    dependents: HashMap<PathBuf, HashSet<PathBuf>>,
}

impl DependencyAnalyzer {
    pub fn analyze_file(&mut self, path: &Path, tree: &Tree) {
        // Tree-sitter로 import 문 추출
        let imports = self.extract_imports(tree);

        for import in imports {
            let resolved_path = self.resolve_import_path(&import, path);

            // dependencies 업데이트
            self.dependencies
                .entry(path.to_path_buf())
                .or_insert_with(HashSet::new)
                .insert(resolved_path.clone());

            // dependents 업데이트 (역방향)
            self.dependents
                .entry(resolved_path)
                .or_insert_with(HashSet::new)
                .insert(path.to_path_buf());
        }
    }

    fn extract_imports(&self, tree: &Tree) -> Vec<ImportStatement> {
        // Tree-sitter 쿼리
        let query = r#"
        (import_statement
            source: (string) @source)
        "#;

        // ...
    }
}
```

---

## 3. Related Files (연관 파일 그룹핑)

### 3.1 개념

**관련된 파일들을 그룹으로 표시**

예: Component + Test + Types + Styles

### 3.2 패턴

```
Button.tsx
├─ Button.test.tsx       (테스트)
├─ Button.types.ts       (타입 정의)
├─ Button.module.css     (스타일)
└─ Button.stories.tsx    (Storybook)
```

### 3.3 File Explorer 통합

**접기/펼치기:**
```
📁 components/
  📄 Button.tsx ▼
     ├─ Button.test.tsx
     ├─ Button.types.ts
     └─ Button.module.css
  📄 Header.tsx ▶ (3 files)
```

### 3.4 빠른 전환

**키보드 단축키:**
```
Cmd+Shift+T : Go to Test File
Cmd+Shift+Y : Go to Types File
Cmd+Shift+S : Go to Style File
```

---

## 4. Componentify (컴포넌트 추출)

### 4.1 개념

**After Effects의 Precomp처럼, 선택 영역을 컴포넌트로 추출**

### 4.2 프로세스

**Before:**
```tsx
function Dashboard() {
    return (
        <div>
            <h1>Dashboard</h1>
            <div className="user-info">    ← 선택 시작
                <img src={user.avatar} />
                <span>{user.name}</span>
                <button>Logout</button>
            </div>                          ← 선택 끝
        </div>
    );
}
```

**After:**
```tsx
// Dashboard.tsx
function Dashboard() {
    return (
        <div>
            <h1>Dashboard</h1>
            <UserInfo user={user} onLogout={handleLogout} />
        </div>
    );
}

// UserInfo.tsx (새 파일)
interface UserInfoProps {
    user: User;
    onLogout: () => void;
}

export function UserInfo({ user, onLogout }: UserInfoProps) {
    return (
        <div className="user-info">
            <img src={user.avatar} />
            <span>{user.name}</span>
            <button onClick={onLogout}>Logout</button>
        </div>
    );
}
```

### 4.3 자동 분석

```rust
pub struct ComponentExtractor {
    // 사용된 변수 분석 → Props
    // 사용된 함수 분석 → Callbacks
    // 사용된 타입 분석 → Interface
}

impl ComponentExtractor {
    pub fn extract(&self, jsx: &str, context: &FileContext) -> ExtractedComponent {
        // 1. Props 분석
        let props = self.analyze_used_variables(jsx);

        // 2. 콜백 분석
        let callbacks = self.analyze_event_handlers(jsx);

        // 3. 타입 정의 생성
        let interface = self.generate_interface(&props, &callbacks);

        // 4. 컴포넌트 코드 생성
        let component_code = self.generate_component(jsx, &interface);

        ExtractedComponent {
            name: "NewComponent".to_string(),
            props,
            interface,
            code: component_code,
        }
    }
}
```

---

## 5. Error Flow Inline (에러 전파 경로 시각화)

### 5.1 개념

**에러가 어디서 발생하고, 어떻게 전파되는지 시각화**

### 5.2 시각화

```typescript
function loadUser(id: string) {
    const user = await fetchUser(id);  // ❌ Error: 404

    if (!user) {
        throw new Error('User not found');  // 🔴 Thrown here
    }

    return user;
}

function Dashboard() {
    try {
        const user = loadUser('123');      // 🟡 Propagates through
    } catch (error) {
        console.error(error);              // 🟢 Caught here
    }
}
```

**시각화 (에디터 여백):**
```
│  function loadUser(id: string) {
│      const user = await fetchUser(id);
🔴     if (!user) {
│          throw new Error('User not found');
│      }
│      return user;
│  }
│
│  function Dashboard() {
│      try {
🟡         const user = loadUser('123');
│      } catch (error) {
🟢         console.error(error);
│      }
│  }
```

### 5.3 Call Stack Trace

**에러 클릭 시 call stack 표시:**
```
┌────────────────────────────────────┐
│ Error: User not found              │
├────────────────────────────────────┤
│ at loadUser (User.ts:45)      ← 🔴 │
│ at Dashboard (Dashboard.tsx:12) ← 🟡│
│ at App (App.tsx:89)                │
└────────────────────────────────────┘
```

---

## 6. Env Manager (환경변수 관리)

### 6.1 개념

**환경변수를 자동 감지하고 관리**

### 6.2 기능

**1. 자동 감지:**
```typescript
// 코드에서 process.env 사용 감지
const apiKey = process.env.API_KEY;  // ← 자동 감지
const dbUrl = process.env.DATABASE_URL;
```

**2. .env.example 자동 생성:**
```
API_KEY=
DATABASE_URL=
PORT=3000
```

**3. 타입 정의 생성 (TypeScript):**
```typescript
// env.d.ts
declare namespace NodeJS {
    interface ProcessEnv {
        API_KEY: string;
        DATABASE_URL: string;
        PORT: string;
    }
}
```

**4. UI Panel:**
```
┌──────────────────────────────────────┐
│ Environment Variables           [X]  │
├──────────────────────────────────────┤
│ API_KEY          [**********]    ✓  │
│ DATABASE_URL     [postgres://]   ✓  │
│ PORT             [3000]          ✓  │
│                                      │
│ [+ Add Variable]                     │
└──────────────────────────────────────┘
```

---

## 7. Structural Minimap

### 7.1 개념 (overview.md 명시)

**코드 "모양"이 아닌 "구조"를 미니맵으로 표시**

### 7.2 시각화

**기존 Minimap (VSCode):**
```
│ ▓▓▓▓▓▓▓
│ ▓░░░░▓
│ ▓▓▓▓▓▓
│ ░░░░░░
│ ▓▓▓░░▓
```
→ 코드 "모양"만 보임, 구조 파악 어려움

**Structural Minimap (Ferrum):**
```
│ 🟦 Class UserService
│ 🟩   function constructor
│ 🟩   function processUser
│ 🟨     if (isPremium)
│ 🟩   function validateUser
│ 🟦 Class AuthService
│ 🟩   function login
```

### 7.3 색상 구분

```
🟦 파란색: Class/Interface
🟩 초록색: Function/Method
🟨 노란색: Control Flow (if/for/while)
🟥 빨간색: Error/Exception
```

---

## 8. Inline Blame (Git Lens 스타일)

### 8.1 기능

**각 라인 끝에 Git blame 정보 표시**

```typescript
function processUser(user: User) {     // John Doe, 2 days ago
    if (user.isPremium) {               // Jane Smith, 1 week ago
        sendNotification(user);         // John Doe, 2 days ago
    }
}
```

### 8.2 호버 시 상세 정보

```
┌────────────────────────────────────┐
│ John Doe                           │
│ 2 days ago (2024-01-07)            │
│ Commit: a3f4b2c                    │
│                                    │
│ "Add premium user handling"        │
│                                    │
│ [Show Commit] [Blame File]        │
└────────────────────────────────────┘
```

---

## 9. Smart Selection Expansion (AST 기반)

### 9.1 개념

**구문 단위로 선택 확장 (Expand Selection)**

### 9.2 동작

**초기 커서 위치:**
```typescript
const userName = user.name.toUpperCase();
              │
            커서
```

**첫 번째 확장 (단어):**
```typescript
const userName = user.name.toUpperCase();
              ^^^^^^^^
```

**두 번째 확장 (멤버 접근):**
```typescript
const userName = user.name.toUpperCase();
              ^^^^^^^^^^^^^^^^^^^^^^^^^
```

**세 번째 확장 (할당문):**
```typescript
const userName = user.name.toUpperCase();
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

### 9.3 키보드 단축키

```
Cmd+Shift+↑ : Expand Selection
Cmd+Shift+↓ : Shrink Selection
```

---

## 10. Peek View (인라인 팝업)

### 10.1 개념

**정의로 이동하지 않고, 현재 위치에서 팝업으로 확인**

### 10.2 UI

```typescript
function Dashboard() {
    const user = loadUser('123');
                 │
                 └─ Peek Definition
                    ┌────────────────────────────┐
                    │ User.ts:45                │
                    ├────────────────────────────┤
                    │ function loadUser(id) {   │
                    │     return fetch(...)     │
                    │ }                         │
                    └────────────────────────────┘
}
```

### 10.3 종류

- Peek Definition
- Peek References
- Peek Implementations
- Peek Type Definition

---

## 11. Block Region Highlight

### 11.1 개념

**스코프/블록을 시각적으로 구분**

Tree Viewer와 통합되어, 현재 블록을 하이라이트합니다.

### 11.2 시각화

```typescript
function processOrder(order: Order) {
┌─────────────────────────────────────┐  ← 블록 시작
│   if (order.isPremium) {            │
│   ┌─────────────────────────────┐   │  ← 중첩 블록
│   │   applyDiscount(order);     │   │
│   │   sendConfirmation();       │   │
│   └─────────────────────────────┘   │
│   }                                 │
└─────────────────────────────────────┘
}
```

---

## 12. 구현 우선순위

### High Priority (MVP)
1. Navigation Trail
2. Smart Selection Expansion
3. Peek View
4. Inline Blame
5. Structural Minimap

### Medium Priority
1. Dependency Highlight
2. Related Files
3. Block Region Highlight

### Low Priority (Post-MVP)
1. Componentify
2. Error Flow Inline
3. Env Manager

---

## 13. Terminal Integration (통합 터미널)

### 13.1 개념

**IDE 내 통합 터미널 제공**

Zed, VSCode와 동일하게 내장 터미널 제공.

### 13.2 핵심 기능

**1. PTY (Pseudo-Terminal) 통합:**
```rust
pub struct Terminal {
    pty: Pty,
    shell: ShellType,
    working_directory: PathBuf,
    env: HashMap<String, String>,
}

pub enum ShellType {
    Bash,
    Zsh,
    Fish,
    PowerShell,
    Cmd,
    Custom(String),
}
```

**2. 쉘 자동 감지:**
```rust
fn detect_shell() -> ShellType {
    // macOS/Linux: $SHELL 환경변수
    // Windows: PowerShell 우선, Cmd 폴백
}
```

**3. 터미널 분할:**
```
┌─────────────────────────────────────┐
│ Terminal 1           │ Terminal 2  │
├─────────────────────────────────────┤
│ $ npm run dev        │ $ git status│
│ > running on :3000   │ M  src/..   │
│                      │             │
└─────────────────────────────────────┘
```

### 13.3 키보드 단축키

```
Ctrl+`       : 터미널 토글
Cmd+Shift+T  : 새 터미널 탭
Cmd+\        : 터미널 분할
Cmd+W        : 터미널 탭 닫기
```

### 13.4 테마 동기화

에디터 테마와 터미널 테마 자동 동기화.

### 13.5 구현

**Rust Backend:**
```rust
// portable-pty 크레이트 사용
use portable_pty::{CommandBuilder, PtySize, native_pty_system};

pub struct TerminalManager {
    terminals: HashMap<TerminalId, Terminal>,
    active_terminal: Option<TerminalId>,
}

impl TerminalManager {
    pub fn create_terminal(&mut self, cwd: &Path) -> Result<TerminalId> {
        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let cmd = CommandBuilder::new(detect_shell());
        cmd.cwd(cwd);
        
        let child = pair.slave.spawn_command(cmd)?;
        
        // ...
    }
}
```

**Frontend (xterm.js):**
```typescript
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

function TerminalView(props: { terminalId: string }) {
    let termRef: HTMLDivElement;
    
    onMount(() => {
        const term = new Terminal({
            theme: getEditorTheme(),
            fontFamily: 'JetBrains Mono',
            fontSize: 14,
        });
        
        term.loadAddon(new FitAddon());
        term.loadAddon(new WebLinksAddon());
        term.open(termRef);
        
        // Tauri 이벤트로 PTY 출력 수신
        listen('terminal-output', (event) => {
            term.write(event.payload.data);
        });
        
        // 입력을 PTY로 전송
        term.onData((data) => {
            invoke('terminal_write', { terminalId: props.terminalId, data });
        });
    });
    
    return <div ref={termRef!} class="terminal-container" />;
}
```

---

## 14. Vim Mode (Vim 에뮬레이션)

### 14.1 개념

**Vim 키바인딩 에뮬레이션**

Vim 사용자를 위한 모달 편집 모드 지원.

### 14.2 모드

```rust
pub enum VimMode {
    Normal,
    Insert,
    Visual,
    VisualLine,
    VisualBlock,
    Command,
    Replace,
}
```

### 14.3 핵심 명령어

**Normal Mode:**
```
h, j, k, l    : 이동
w, b, e       : 단어 단위 이동
0, $          : 라인 시작/끝
gg, G         : 파일 시작/끝
i, a, o, O    : Insert 모드 진입
v, V, Ctrl+v  : Visual 모드 진입
d, c, y       : 삭제, 변경, 복사
p, P          : 붙여넣기
u, Ctrl+r     : Undo, Redo
/             : 검색
```

**Visual Mode:**
```
d, c, y       : 선택 영역에 동작
>, <          : 들여쓰기
=             : 자동 포맷
```

**Command Mode:**
```
:w            : 저장
:q            : 종료
:wq           : 저장 후 종료
:e <file>     : 파일 열기
:%s/old/new/g : 전체 바꾸기
```

### 14.4 구현

```rust
pub struct VimEmulator {
    mode: VimMode,
    pending_operator: Option<VimOperator>,
    register: VimRegister,
    repeat_count: Option<u32>,
    command_buffer: String,
}

impl VimEmulator {
    pub fn handle_key(&mut self, key: Key, editor: &mut Editor) -> VimResult {
        match self.mode {
            VimMode::Normal => self.handle_normal_mode(key, editor),
            VimMode::Insert => self.handle_insert_mode(key, editor),
            VimMode::Visual => self.handle_visual_mode(key, editor),
            VimMode::Command => self.handle_command_mode(key, editor),
            // ...
        }
    }
}
```

### 14.5 설정

```toml
[editor.vim]
enabled = true
relative_line_numbers = true
clipboard = "system"  # system, vim
# 커스텀 매핑
[editor.vim.mappings]
"jk" = "Escape"  # Insert에서 jk로 Normal 모드
```

---

## 15. Collaboration (실시간 협업)

### 15.1 개념

**실시간 다중 사용자 협업 편집**

> **Note**: Post-MVP 기능. 기본 아키텍처만 설계.

### 15.2 아키텍처

**CRDT (Conflict-free Replicated Data Type) 기반:**
```rust
pub struct CollaborativeDocument {
    // Automerge 또는 Y.js 사용
    doc: AutomergeDoc,
    local_changes: Vec<Change>,
    peer_id: PeerId,
}

pub struct CollabSession {
    session_id: SessionId,
    host: PeerId,
    participants: Vec<Participant>,
    document: CollaborativeDocument,
}
```

### 15.3 원격 커서

```typescript
interface RemoteCursor {
    peerId: string;
    userName: string;
    color: string;
    position: Position;
    selection?: Range;
}

function RemoteCursorView(props: { cursor: RemoteCursor }) {
    return (
        <div
            class="remote-cursor"
            style={{
                '--cursor-color': props.cursor.color,
                left: `${props.cursor.position.column * charWidth}px`,
                top: `${props.cursor.position.line * lineHeight}px`,
            }}
        >
            <span class="cursor-label">{props.cursor.userName}</span>
        </div>
    );
}
```

### 15.4 통신 프로토콜

```rust
// WebSocket + WebRTC (P2P)
pub enum CollabMessage {
    // 세션 관리
    JoinSession { session_id: SessionId, user: User },
    LeaveSession { session_id: SessionId },
    
    // 문서 동기화
    SyncDocument { changes: Vec<Change> },
    
    // 커서 동기화
    CursorMove { position: Position },
    SelectionChange { range: Range },
    
    // 파일 동기화
    FileOpen { path: PathBuf },
    FileClose { path: PathBuf },
}
```

### 15.5 권한 시스템

```rust
pub enum CollabPermission {
    ReadOnly,     // 보기만 가능
    Edit,         // 편집 가능
    Full,         // 터미널 실행 포함
}
```

---

## 16. Template System (코드 템플릿)

### 16.1 개념

**자주 사용하는 코드 패턴을 템플릿으로 저장하고 재사용**

### 16.2 빌트인 템플릿

```
▼ React
  📄 Functional Component
  📄 Component with Props
  📄 Custom Hook
  📄 Context Provider

▼ TypeScript
  📄 Interface
  📄 Type with Generics
  📄 Enum

▼ Testing
  📄 Jest Test Suite
  📄 React Testing Library
```

### 16.3 템플릿 문법

```handlebars
{{!-- component.tsx.hbs --}}
import React from 'react';
{{#if hasStyles}}
import styles from './{{ComponentName}}.module.css';
{{/if}}

interface {{ComponentName}}Props {
    {{#each props}}
    {{name}}: {{type}};
    {{/each}}
}

export function {{ComponentName}}({{#if hasProps}}props: {{ComponentName}}Props{{/if}}) {
    return (
        <div {{#if hasStyles}}className={styles.container}{{/if}}>
            {/* TODO: Implement {{ComponentName}} */}
        </div>
    );
}
```

### 16.4 멀티파일 템플릿

```json
{
    "name": "React Feature",
    "files": [
        {
            "path": "{{FeatureName}}/{{FeatureName}}.tsx",
            "template": "component.tsx.hbs"
        },
        {
            "path": "{{FeatureName}}/use{{FeatureName}}.ts",
            "template": "hook.ts.hbs"
        },
        {
            "path": "{{FeatureName}}/{{FeatureName}}.test.tsx",
            "template": "test.tsx.hbs"
        }
    ]
}
```

---

## 17. Comment System (Figma 스타일 코멘트)

> **상세 스펙**: [comment-system.md](./comment-system.md)

### 17.1 개념

**Figma의 Comment 기능을 코드에 적용**
- 실시간 코멘트: 커밋 전에도 피드백 가능
- AST 기반 타겟팅: 라인이 아닌 "노드" 단위 연결
- 프로젝트 로컬 저장: `.ferrum/comments`에 저장
- QA 친화적: 비주얼 모드에서도 코멘트 가능

### 17.2 핵심 기능

| 기능 | 설명 |
|------|------|
| **AST 기반 위치 추적** | 코드 변경 시에도 코멘트 위치 유지 |
| **스레드 형태 대화** | Reply chain으로 토론 가능 |
| **Visual Mode 통합** | Production Preview에서도 코멘트 가능 |
| **Mentions & Labels** | @user, #bug 등 협업 기능 |
| **Attachments** | 스크린샷 첨부 가능 |

### 17.3 UI

```
   │ 1  import React from 'react';
   │ 2
💬 │ 3  function Button({ onClick }) {  ← 코멘트 마커
   │ 4    return (
⚠️ │ 5      <button onClick={onClick}>  ← Outdated 코멘트
   │ 6        Click me
```

---

## 18. Web UI Editing (프론트엔드 직접 편집)

> **상세 스펙**: [view-mode-system.md](../architecture/view-mode-system.md#101-web-ui-editing-mode)

### 18.1 개념

**Figma/Framer 스타일로 React/Vue/Svelte 컴포넌트 직접 편집**

### 18.2 핵심 기능

| 기능 | 설명 |
|------|------|
| **렌더링된 UI 선택** | 컴포넌트 클릭 → 해당 코드 하이라이트 |
| **Props Panel** | Properties 실시간 수정 |
| **Layers Panel** | 컴포넌트 계층 구조 시각화 |
| **드래그 앤 드롭** | 컴포넌트 순서 변경 |
| **Style Inspector** | CSS/Tailwind 시각적 편집 |

### 18.3 UI

```
┌──────────┬────────────────────────────────┬─────────────────┐
│ Layers   │    [Live Rendered UI]          │ Properties      │
│ ──────── │                                │ ────────────    │
│ ▼ Header │    컴포넌트 직접 클릭/드래그    │ Props:          │
│   └ Logo │    Props 실시간 수정            │   title: "..."  │
│   └ Nav  │                                │   variant: ▼    │
└──────────┴────────────────────────────────┴─────────────────┘
```

---

## 19. API Spec Editing (백엔드 API 디자이너)

> **상세 스펙**: [view-mode-system.md](../architecture/view-mode-system.md#102-api-spec-editing-mode)

### 19.1 개념

**Postman/Apidog 스타일로 Express/Fastify/Elysia API 편집**

### 19.2 핵심 기능

| 기능 | 설명 |
|------|------|
| **라우트 자동 감지** | Express, Fastify, Elysia, Hono 지원 |
| **GUI 엔드포인트 편집** | 코드 자동 생성 |
| **Request Builder** | 즉시 테스트 |
| **Validation Schema** | Zod/TypeBox 시각적 편집 |
| **OpenAPI 자동 생성** | Spec 내보내기 |

### 19.3 UI

```
┌─────────────────────────────────────────────────────────────┐
│  API Designer - users.ts                                    │
├─────────────────────────────────────────────────────────────┤
│  │ GET    │ /api/users     │ List all users   │ [▶ Test]│  │
│  │ POST   │ /api/users     │ Create user      │ [▶ Test]│  │
│  │ GET    │ /api/users/:id │ Get user by ID   │ [▶ Test]│  │
└─────────────────────────────────────────────────────────────┘
```

---

## 20. CLI Flow Designer (CLI 시각화)

> **상세 스펙**: [view-mode-system.md](../architecture/view-mode-system.md#103-cli-flow-designer-mode)

### 20.1 개념

**CLI 애플리케이션을 노드 기반으로 시각화하고 편집**

### 20.2 핵심 기능

| 기능 | 설명 |
|------|------|
| **노드 기반 흐름** | CLI 명령 흐름 시각화 |
| **Inquirer 편집** | 프롬프트 시각적 편집 |
| **Commander/Yargs** | 옵션 GUI 편집 |
| **터미널 시뮬레이션** | 실시간 미리보기 |
| **조건 분기 시각화** | if/switch 흐름도 |

### 20.3 UI

```
┌─────────┐    ┌───────────────┐    ┌───────────────┐
│  Start  │───→│    Prompt:    │───→│   Condition:  │
│         │    │ "Enter name?" │    │  if (name)    │
└─────────┘    └───────────────┘    └───────────────┘
                                           │
                                    ┌──────┴──────┐
                                Yes │             │ No
                                    ▼             ▼
                             ┌─────────┐   ┌─────────┐
                             │ greet() │   │ exit()  │
                             └─────────┘   └─────────┘
```

---

## 구현 우선순위 (업데이트)

### Phase 2: Core DX (MVP)
1. Navigation Trail ✅
2. Smart Selection Expansion ✅
3. Peek View ✅
4. Inline Blame ✅
5. Structural Minimap ✅
6. **Terminal Integration** ⭐ (추가)
7. **Comment System** ⭐⭐ (추가)

### Phase 3: Advanced
1. Dependency Highlight
2. Related Files
3. Block Region Highlight
4. **Vim Mode** ⭐ (추가)
5. **Template System** ⭐ (추가)

### Phase 4: Production-First ⭐⭐
1. **Web UI Editing** - Figma 스타일 컴포넌트 편집
2. **API Spec Editing** - Postman 스타일 API 디자이너
3. **CLI Flow Designer** - CLI 흐름 시각화

### Post-MVP
1. Componentify
2. Error Flow Inline
3. Env Manager
4. **Collaboration** ⭐ (추가)

---

## 성능 타겟 (Instant Mode 기준)

> 상세: [review/document-review.md](../review/document-review.md)
> Instant Mode 원칙: [overview.md](../overview.md#instant-mode-8ms-피드백-보장)

### Instant Mode (직접 조작 - 8ms 이내)

**Figma 수준의 즉각적 반응:**

| 동작 | 목표 시간 | 중요도 |
|------|----------|--------|
| Block 선택 | **< 4ms** | Critical |
| 선택 하이라이트 | **< 4ms** | Critical |
| Block 드래그 | **< 8ms** | Critical |
| Properties 변경 (UI) | **< 8ms** | Critical |
| Canvas 팬/줌 | **< 8ms** | Critical |
| 호버 피드백 | **< 4ms** | Critical |
| Layers 순서 변경 | **< 8ms** | Critical |
| Smart Selection | **< 8ms** | Critical |
| Vim 명령 실행 | **< 5ms** | Critical |

### Standard Performance (일반 기능)

| 기능 | 목표 시간 | 비고 |
|------|----------|------|
| Navigation Trail 이동 | < 50ms | |
| View ↔ Code 동기화 | < 50ms | Debounced |
| Comment 생성 | < 50ms | ⭐⭐ |
| Peek View 표시 | < 100ms | LSP 연동 |
| Inline Blame | < 100ms | Git 캐싱 |
| Web UI Editing 전환 | < 100ms | ⭐⭐ |
| CLI Flow 파싱 | < 150ms | ⭐⭐ |
| Dependency 분석 | < 200ms | 초기 분석 |
| API Spec 분석 | < 200ms | ⭐⭐ |
| Terminal 시작 | < 200ms | PTY 생성 |

---

## 관련 문서

### 아키텍처
- [editor-engine.md](../architecture/editor-engine.md) - 에디터 엔진
- [file-explorer.md](../architecture/file-explorer.md) - 파일 탐색기
- [search-system.md](../architecture/search-system.md) - 검색 시스템
- [lsp-integration.md](../architecture/lsp-integration.md) - LSP 통합
- [view-mode-system.md](../architecture/view-mode-system.md) - Production-First View Modes ⭐⭐

### 기능 스펙
- [navigation.md](./navigation.md) - Navigation 전체 개요
- [tree-viewer.md](./tree-viewer.md) - Tree Viewer
- [context-action-palette.md](./context-action-palette.md) - Context Action Palette
- [visual-coding.md](./visual-coding.md) - Visual Coding
- [comment-system.md](./comment-system.md) - Figma 스타일 코멘트 ⭐⭐
- [design-language.md](./design-language.md) - Ferrum Design Language ⭐⭐
- [progressive-disclosure.md](./progressive-disclosure.md) - Progressive Disclosure UX ⭐⭐

### 기술 문서
- [plugin-system.md](../technical/plugin-system.md) - 플러그인 확장
- [testing-strategy.md](../technical/testing-strategy.md) - 테스트 전략
- [accessibility.md](../technical/accessibility.md) - 접근성

### 리서치
- [zed-analysis.md](../research/zed-analysis.md) - Zed 분석 (Terminal, Vim, Collaboration)

---

## 참고 자료

### 기존 참고
- [VSCode Features](https://code.visualstudio.com/docs/editor/editingevolved)
- [IntelliJ IDEA Features](https://www.jetbrains.com/help/idea/discover-intellij-idea.html)
- [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens)
- [Zed Collaboration](https://zed.dev/docs/collaboration)
- [xterm.js](https://xtermjs.org/)
- [Automerge](https://automerge.org/)
- [neovim](https://neovim.io/)

### Production-First 참고 ⭐⭐
- [Figma Comments](https://help.figma.com/hc/en-us/articles/360039825314-Comments)
- [Figma Developer Mode](https://www.figma.com/dev-mode/)
- [Framer](https://www.framer.com/)
- [Postman](https://www.postman.com/)
- [Apidog](https://apidog.com/)
- [Linear Comments](https://linear.app/docs/comments)
