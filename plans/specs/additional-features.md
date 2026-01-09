# Additional Features 통합 스펙

> 나머지 핵심 기능들의 설계 개요

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

## 참고 자료

- [VSCode Features](https://code.visualstudio.com/docs/editor/editingevolved)
- [IntelliJ IDEA Features](https://www.jetbrains.com/help/idea/discover-intellij-idea.html)
- [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens)
