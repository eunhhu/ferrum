# Comment System (Figma-style 코드 코멘트)

> **핵심 가치**: "디자인 도구처럼 코드에 대화형 피드백과 리뷰를 남긴다"

## 1. 개요

### 1.1 컨셉

**Figma의 Comment 기능을 코드에 적용**

기존 코드 리뷰 방식의 한계:
- Git 기반 리뷰 (PR)는 커밋 후에만 가능
- 라인 기반 코멘트는 코드 변경 시 위치 추적 어려움
- 비개발자 (QA, 디자이너, PM)의 피드백 참여 어려움

Ferrum Comment System:
- **실시간 코멘트**: 커밋 전에도 피드백 가능
- **AST 기반 타겟팅**: 라인이 아닌 "노드" 단위 연결
- **프로젝트 로컬 저장**: `.ferrum/comments`에 저장
- **QA 친화적**: 비주얼 모드에서도 코멘트 가능

### 1.2 사용 시나리오

**시나리오 1: 실시간 코드 리뷰**
```
1. 개발자 A가 코드 작성 중
2. 개발자 B가 같은 파일 열고 "이 함수 이름 변경하면 좋겠어요" 코멘트
3. 개발자 A가 코멘트 확인하고 수정
4. 코멘트 resolved 처리
```

**시나리오 2: QA 피드백**
```
1. QA가 Production Preview에서 버그 발견
2. 해당 컴포넌트에 직접 코멘트: "이 버튼 클릭 시 오류 발생"
3. 개발자가 코드 뷰에서 해당 코멘트 확인 (AST로 정확한 위치)
4. 수정 후 resolved
```

**시나리오 3: 설계 논의**
```
1. 팀원이 Visual Flow에서 복잡한 로직 발견
2. "이 분기 단순화 가능할 것 같아요" 코멘트
3. 스레드 형태로 토론
4. 결론 도출 후 코드 수정
```

---

## 2. 데이터 모델

### 2.1 Comment Structure

```typescript
interface Comment {
  id: CommentId;              // UUID
  threadId: ThreadId;         // 스레드 그룹 (reply chain)
  
  // 타겟 (어디에 달린 코멘트인가?)
  target: CommentTarget;
  
  // 내용
  author: CommentAuthor;
  content: string;            // Markdown 지원
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  
  // 상태
  status: CommentStatus;
  
  // 메타데이터
  reactions?: Reaction[];
  mentions?: UserId[];
}

interface CommentTarget {
  // 파일 레벨
  filePath: string;
  
  // 위치 타겟 (택일)
  targeting: 
    | { type: "line"; line: number; column?: number }
    | { type: "range"; start: Position; end: Position }
    | { type: "node"; nodeId: ASTNodeId; nodeType: string }
    | { type: "element"; elementId: string; viewMode: string }  // Visual 모드용
    | { type: "file" };  // 파일 전체
  
  // 코드 스냅샷 (위치 추적용)
  codeSnapshot?: {
    content: string;        // 타겟 영역의 코드 텍스트
    hash: string;           // 빠른 비교용
  };
  
  // Tree-sitter 노드 경로 (위치 복원용)
  astPath?: string[];       // e.g., ["function:processUser", "if:0", "call:sendEmail"]
}

interface CommentAuthor {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

enum CommentStatus {
  Open = "open",
  Resolved = "resolved",
  Outdated = "outdated",    // 코드 변경으로 위치 불명확
  Deleted = "deleted",
}

interface Reaction {
  emoji: string;
  userId: string;
}
```

### 2.2 Thread Structure

```typescript
interface CommentThread {
  id: ThreadId;
  rootComment: Comment;
  replies: Comment[];
  
  // 스레드 상태
  status: ThreadStatus;
  resolvedBy?: CommentAuthor;
  resolvedAt?: Timestamp;
  
  // 메타데이터
  participantIds: string[];
  lastActivityAt: Timestamp;
}

enum ThreadStatus {
  Open = "open",
  Resolved = "resolved",
  Archived = "archived",
}
```

### 2.3 Storage Format

**`.ferrum/comments/` 디렉토리 구조:**
```
.ferrum/
├── comments/
│   ├── index.json           # 전체 코멘트 인덱스
│   ├── threads/
│   │   ├── {thread-id-1}.json
│   │   ├── {thread-id-2}.json
│   │   └── ...
│   └── attachments/         # 스크린샷 등
│       ├── {attachment-id}.png
│       └── ...
└── config.json              # 프로젝트 설정
```

**threads/{thread-id}.json:**
```json
{
  "id": "thread-uuid-123",
  "rootComment": {
    "id": "comment-uuid-456",
    "target": {
      "filePath": "src/components/Button.tsx",
      "targeting": {
        "type": "node",
        "nodeId": "function_declaration_0",
        "nodeType": "function_declaration"
      },
      "astPath": ["function:Button"],
      "codeSnapshot": {
        "content": "function Button({ onClick, children })",
        "hash": "a3f2b1c"
      }
    },
    "author": {
      "id": "user-1",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "content": "이 컴포넌트 `disabled` prop 추가하면 좋겠어요",
    "createdAt": "2024-01-15T10:30:00Z",
    "status": "open"
  },
  "replies": [
    {
      "id": "comment-uuid-789",
      "author": { "id": "user-2", "name": "Jane Smith" },
      "content": "동의합니다. 접근성을 위해서도 필요해요.",
      "createdAt": "2024-01-15T10:35:00Z",
      "status": "open"
    }
  ],
  "status": "open",
  "participantIds": ["user-1", "user-2"],
  "lastActivityAt": "2024-01-15T10:35:00Z"
}
```

---

## 3. AST 기반 위치 추적

### 3.1 핵심 문제

**라인 기반 코멘트의 한계:**
```typescript
// Line 10에 코멘트 달림
function processUser(user) {
  // ...
}

// 코드 추가 후 → 원래 함수가 Line 15로 이동
// 코멘트는 Line 10 (잘못된 위치)
import { something } from './utils';
import { another } from './helpers';
import { more } from './lib';

function processUser(user) {  // Line 15
  // ...
}
```

### 3.2 AST Path 기반 추적

```typescript
// AST Path: ["function:processUser"]
// 라인이 변경되어도 함수 이름으로 추적

interface ASTPathResolver {
  // 코멘트 생성 시: 현재 위치 → AST Path
  resolveToPath(target: Position, tree: Tree): string[];
  
  // 코멘트 표시 시: AST Path → 현재 위치
  resolveFromPath(path: string[], tree: Tree): Range | null;
}
```

**AST Path 예시:**
```typescript
// 코드
function UserProfile({ user }) {
  if (user.isPremium) {
    return <PremiumBadge />;
  }
  return <StandardBadge />;
}

// AST Paths
"function:UserProfile"                        → 함수 전체
"function:UserProfile/if:0"                   → 첫 번째 if문
"function:UserProfile/if:0/return:0"          → if 내부 return
"function:UserProfile/return:1"               → 마지막 return
```

### 3.3 Fuzzy Matching (코드 변경 시)

```rust
pub struct CommentLocationResolver {
    tree: Tree,
    buffer: TextBuffer,
}

impl CommentLocationResolver {
    /// AST Path로 위치 찾기 (정확한 매치)
    pub fn resolve_exact(&self, path: &[String]) -> Option<Range> {
        let mut current_node = self.tree.root_node();
        
        for segment in path {
            let (node_type, identifier) = parse_segment(segment)?;
            current_node = self.find_child(current_node, node_type, identifier)?;
        }
        
        Some(current_node.range().into())
    }
    
    /// Fuzzy Matching (코드 스냅샷 기반)
    pub fn resolve_fuzzy(&self, target: &CommentTarget) -> Option<(Range, f64)> {
        let snapshot = target.code_snapshot.as_ref()?;
        
        // 1. 정확한 매치 시도
        if let Some(range) = self.find_exact_match(&snapshot.content) {
            return Some((range, 1.0));
        }
        
        // 2. 유사도 기반 매치
        let candidates = self.find_similar_ranges(&snapshot.content);
        candidates
            .into_iter()
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
            .filter(|(_, similarity)| *similarity > 0.8) // 80% 이상 유사도
    }
    
    fn find_similar_ranges(&self, target: &str) -> Vec<(Range, f64)> {
        // Levenshtein distance 또는 semantic similarity
        // ...
    }
}
```

### 3.4 Outdated 감지

```rust
pub enum CommentLocationStatus {
    Valid(Range),              // 정확한 위치 확인
    Moved(Range, f64),         // 위치 변경됨 (유사도 점수)
    Outdated,                  // 위치 추적 실패
}

impl CommentManager {
    pub fn check_location_status(&self, comment: &Comment) -> CommentLocationStatus {
        let resolver = CommentLocationResolver::new(&self.tree, &self.buffer);
        
        // 1. AST Path 기반 시도
        if let Some(range) = resolver.resolve_exact(&comment.target.ast_path) {
            // 코드 스냅샷 비교
            let current_text = self.buffer.text_in_range(range);
            if current_text == comment.target.code_snapshot.content {
                return CommentLocationStatus::Valid(range);
            }
        }
        
        // 2. Fuzzy matching 시도
        if let Some((range, similarity)) = resolver.resolve_fuzzy(&comment.target) {
            return CommentLocationStatus::Moved(range, similarity);
        }
        
        // 3. 추적 실패
        CommentLocationStatus::Outdated
    }
}
```

---

## 4. UI/UX

### 4.1 Code View 통합

**에디터 여백 마커:**
```
   │ 1  import React from 'react';
   │ 2
💬 │ 3  function Button({ onClick }) {  ← 코멘트 마커
   │ 4    return (
⚠️ │ 5      <button onClick={onClick}>  ← Outdated 코멘트
   │ 6        Click me
   │ 7      </button>
   │ 8    );
   │ 9  }
```

**마커 클릭 시 스레드 패널:**
```
┌─────────────────────────────────────────┐
│ 💬 Comment Thread                   [X] │
├─────────────────────────────────────────┤
│ [Avatar] John Doe              10:30 AM │
│ ─────────────────────────────────────── │
│ 이 컴포넌트 `disabled` prop 추가하면    │
│ 좋겠어요                                │
│                                         │
│   [Reply] [👍 2] [✓ Resolve]           │
├─────────────────────────────────────────┤
│ [Avatar] Jane Smith            10:35 AM │
│ ─────────────────────────────────────── │
│ 동의합니다. 접근성을 위해서도 필요해요. │
│                                         │
│   [Reply] [👍 1]                        │
├─────────────────────────────────────────┤
│ [Write a reply...]                      │
└─────────────────────────────────────────┘
```

### 4.2 새 코멘트 생성

**코드 선택 후 우클릭:**
```
┌─────────────────────────┐
│ Copy                    │
│ Cut                     │
│ Paste                   │
│ ──────────────────────  │
│ 💬 Add Comment          │  ← 선택 영역에 코멘트
│ 📌 Add Bookmark         │
│ ──────────────────────  │
│ Go to Definition        │
└─────────────────────────┘
```

**단축키:**
- `Cmd+Shift+C`: 커서/선택 영역에 코멘트 추가
- `Cmd+Alt+C`: 코멘트 패널 토글
- `F8`: 다음 코멘트로 이동

### 4.3 Visual Mode 통합

**Production Preview / Component Canvas에서:**

```
┌─────────────────────────────────────────┐
│  [Production Preview]                    │
│                                         │
│  ┌─────────────────┐                    │
│  │    [Button]     │ ← 💬 클릭 시 코멘트│
│  └─────────────────┘                    │
│                                         │
│  이 버튼 호버 시 색상                    │
│  변경이 필요해요 💬                      │
│                                         │
└─────────────────────────────────────────┘
```

**Element → Code 연결:**
```typescript
interface VisualCommentTarget {
  // Visual 요소 ID
  elementId: string;        // e.g., "button-123"
  viewMode: string;         // e.g., "core.production-preview"
  
  // 연결된 코드 위치 (자동 추적)
  codeTarget?: CommentTarget;
}

// Visual 요소 클릭 시 해당 코드 위치도 함께 저장
function createVisualComment(element: VisualElement, viewMode: string) {
  const codeLocation = mapElementToCode(element);
  
  return {
    target: {
      filePath: codeLocation.filePath,
      targeting: {
        type: "element",
        elementId: element.id,
        viewMode: viewMode,
      },
      astPath: codeLocation.astPath,
    },
  };
}
```

### 4.4 Comments Panel

**전체 프로젝트 코멘트 뷰:**
```
┌─────────────────────────────────────────┐
│ 💬 Comments                        [X]  │
├─────────────────────────────────────────┤
│ 🔍 [Search comments...]                 │
│                                         │
│ Filter: [All ▼] [Open ▼] [Mine ▼]      │
├─────────────────────────────────────────┤
│ ▼ src/components/Button.tsx (3)        │
│   ├─ 💬 Add disabled prop              │
│   │   John Doe • 2 replies • Open      │
│   ├─ 💬 Style improvements             │
│   │   Jane Smith • Resolved            │
│   └─ ⚠️ Performance concern            │
│       Team • Outdated                   │
│                                         │
│ ▼ src/pages/Dashboard.tsx (1)          │
│   └─ 💬 Loading state missing          │
│       QA Team • Open                    │
└─────────────────────────────────────────┘
```

---

## 5. Collaboration Features

### 5.1 Mentions

```markdown
@john 이 부분 확인해주세요.
@design-team UI 검토 부탁드립니다.
```

**자동완성:**
```
@jo → 
  @john (John Doe)
  @jordan (Jordan Kim)
```

### 5.2 Labels & Tags

```typescript
interface CommentLabel {
  id: string;
  name: string;
  color: string;
}

// 기본 라벨
const DEFAULT_LABELS = [
  { id: "bug", name: "Bug", color: "#e53e3e" },
  { id: "enhancement", name: "Enhancement", color: "#38a169" },
  { id: "question", name: "Question", color: "#3182ce" },
  { id: "discussion", name: "Discussion", color: "#805ad5" },
  { id: "blocked", name: "Blocked", color: "#dd6b20" },
];
```

### 5.3 Attachments

```typescript
interface CommentAttachment {
  id: string;
  type: "image" | "video" | "file";
  filename: string;
  path: string;           // .ferrum/comments/attachments/
  thumbnailPath?: string;
}

// 스크린샷 붙여넣기 지원
async function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      const attachment = await saveAttachment(file);
      insertAttachment(attachment);
    }
  }
}
```

---

## 6. Git Integration

### 6.1 `.gitignore` 옵션

```bash
# .ferrum/comments를 git에 포함할지 선택
# 팀 협업 시: 포함
# 개인 메모 시: 제외

# Option 1: 포함 (기본)
# (nothing to add to .gitignore)

# Option 2: 제외
.ferrum/comments/
```

### 6.2 Commit 연동

```typescript
interface CommitLinkage {
  commentId: string;
  commitHash: string;
  message: string;
}

// 코멘트 resolve 시 자동 커밋 메시지 제안
function suggestCommitMessage(resolvedComments: Comment[]): string {
  const summaries = resolvedComments.map(c => 
    `- ${c.content.slice(0, 50)}...`
  );
  
  return `fix: Address code review comments\n\n${summaries.join('\n')}`;
}
```

### 6.3 PR 연동 (선택적)

```typescript
// GitHub/GitLab PR 코멘트와 동기화 (선택 기능)
interface PRSyncConfig {
  enabled: boolean;
  provider: "github" | "gitlab" | "bitbucket";
  syncDirection: "push" | "pull" | "bidirectional";
}
```

---

## 7. Backend Implementation

### 7.1 CommentManager (Rust)

```rust
pub struct CommentManager {
    project_root: PathBuf,
    index: CommentIndex,
    file_watcher: FileWatcher,
}

impl CommentManager {
    pub fn new(project_root: PathBuf) -> Self {
        let comments_dir = project_root.join(".ferrum/comments");
        fs::create_dir_all(&comments_dir).ok();
        
        let index = Self::load_index(&comments_dir);
        
        Self {
            project_root,
            index,
            file_watcher: FileWatcher::new(),
        }
    }
    
    /// 새 스레드 생성
    pub fn create_thread(&mut self, comment: Comment) -> Result<ThreadId> {
        let thread = CommentThread {
            id: ThreadId::new(),
            root_comment: comment,
            replies: vec![],
            status: ThreadStatus::Open,
            participant_ids: vec![comment.author.id.clone()],
            last_activity_at: Utc::now(),
        };
        
        self.save_thread(&thread)?;
        self.index.add_thread(&thread);
        
        Ok(thread.id)
    }
    
    /// 스레드에 답글 추가
    pub fn add_reply(&mut self, thread_id: ThreadId, reply: Comment) -> Result<()> {
        let mut thread = self.load_thread(thread_id)?;
        thread.replies.push(reply.clone());
        thread.last_activity_at = Utc::now();
        
        if !thread.participant_ids.contains(&reply.author.id) {
            thread.participant_ids.push(reply.author.id.clone());
        }
        
        self.save_thread(&thread)?;
        Ok(())
    }
    
    /// 파일의 모든 코멘트 가져오기
    pub fn get_comments_for_file(&self, file_path: &Path) -> Vec<CommentThread> {
        self.index
            .threads_by_file
            .get(file_path)
            .cloned()
            .unwrap_or_default()
    }
    
    /// 코멘트 위치 업데이트 (파일 변경 시)
    pub fn update_locations(&mut self, file_path: &Path, tree: &Tree) -> Vec<LocationUpdate> {
        let resolver = CommentLocationResolver::new(tree);
        let threads = self.get_comments_for_file(file_path);
        let mut updates = vec![];
        
        for thread in threads {
            let status = resolver.check_status(&thread.root_comment.target);
            
            match status {
                CommentLocationStatus::Moved(new_range, _) => {
                    updates.push(LocationUpdate::Moved {
                        thread_id: thread.id,
                        new_range,
                    });
                }
                CommentLocationStatus::Outdated => {
                    updates.push(LocationUpdate::Outdated {
                        thread_id: thread.id,
                    });
                }
                _ => {}
            }
        }
        
        updates
    }
}
```

### 7.2 IPC Commands

```rust
#[tauri::command]
async fn create_comment(
    target: CommentTarget,
    content: String,
    author: CommentAuthor,
    state: State<'_, CommentManager>,
) -> Result<ThreadId, Error> {
    let comment = Comment {
        id: CommentId::new(),
        thread_id: ThreadId::new(),
        target,
        content,
        author,
        created_at: Utc::now(),
        status: CommentStatus::Open,
        ..Default::default()
    };
    
    state.lock().await.create_thread(comment)
}

#[tauri::command]
async fn get_file_comments(
    file_path: String,
    state: State<'_, CommentManager>,
) -> Result<Vec<CommentThread>, Error> {
    let path = PathBuf::from(file_path);
    Ok(state.lock().await.get_comments_for_file(&path))
}

#[tauri::command]
async fn resolve_thread(
    thread_id: String,
    resolved_by: CommentAuthor,
    state: State<'_, CommentManager>,
) -> Result<(), Error> {
    state.lock().await.resolve_thread(
        ThreadId::from(thread_id),
        resolved_by,
    )
}
```

---

## 8. 성능 고려사항

### 8.1 인덱싱

```rust
pub struct CommentIndex {
    // 파일 → 스레드 ID 매핑
    threads_by_file: HashMap<PathBuf, Vec<ThreadId>>,
    
    // 작성자 → 스레드 ID 매핑
    threads_by_author: HashMap<String, Vec<ThreadId>>,
    
    // 상태별 카운트
    open_count: usize,
    resolved_count: usize,
}
```

### 8.2 Lazy Loading

```typescript
// 대용량 프로젝트에서 코멘트 lazy load
const commentStore = createStore({
  loadedFiles: new Set<string>(),
  threads: new Map<string, CommentThread[]>(),
  
  async loadFileComments(filePath: string) {
    if (this.loadedFiles.has(filePath)) return;
    
    const threads = await invoke('get_file_comments', { filePath });
    this.threads.set(filePath, threads);
    this.loadedFiles.add(filePath);
  },
});
```

### 8.3 위치 캐싱

```typescript
// 파일당 위치 캐시 (파일 변경 시 무효화)
const locationCache = new Map<string, {
  version: number;
  positions: Map<string, Range>;
}>();
```

---

## 9. 성능 타겟

| 작업 | 목표 시간 | 비고 |
|------|----------|------|
| 코멘트 생성 | < 50ms | |
| 파일 코멘트 로드 | < 100ms | 캐시 후 < 10ms |
| 위치 추적 업데이트 | < 200ms | 파일 변경 시 |
| 스레드 패널 표시 | < 50ms | |
| 전체 인덱스 로드 | < 500ms | 프로젝트 열기 시 |

---

## 10. 구현 로드맵

### Phase 1: 기본 시스템 (Week 1-2)
- [ ] Comment 데이터 모델
- [ ] `.ferrum/comments` 저장소
- [ ] CommentManager (Rust)
- [ ] 기본 IPC 명령어

### Phase 2: UI 통합 (Week 3-4)
- [ ] Code View 마커 렌더링
- [ ] 스레드 패널 UI
- [ ] 새 코멘트 생성 UI
- [ ] 키보드 단축키

### Phase 3: AST 추적 (Week 5-6)
- [ ] AST Path 생성/해석
- [ ] Fuzzy matching
- [ ] Outdated 감지
- [ ] 위치 자동 업데이트

### Phase 4: Visual Mode 통합 (Week 7-8)
- [ ] Production Preview 코멘트
- [ ] Component Canvas 코멘트
- [ ] Element → Code 매핑

### Phase 5: Collaboration (Week 9-10)
- [ ] Mentions
- [ ] Labels
- [ ] Attachments
- [ ] Comments Panel

---

## 11. 관련 문서

### 아키텍처
- [editor-engine.md](../architecture/editor-engine.md) - AST 엔진
- [view-mode-system.md](../architecture/view-mode-system.md) - View Mode 통합
- [ipc-protocol.md](../architecture/ipc-protocol.md) - IPC 명령어

### 기능 스펙
- [visual-coding.md](./visual-coding.md) - Visual Mode
- [context-action-palette.md](./context-action-palette.md) - 코멘트 액션
- [additional-features.md](./additional-features.md) - Collaboration

### 기술 문서
- [plugin-system.md](../technical/plugin-system.md) - 코멘트 플러그인 확장

---

## 참고 자료

- [Figma Comments](https://help.figma.com/hc/en-us/articles/360039825314-Comments)
- [GitHub Code Review](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests)
- [Linear Comments](https://linear.app/docs/comments)
- [VSCode Live Share](https://docs.microsoft.com/en-us/visualstudio/liveshare/)
