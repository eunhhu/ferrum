# File Explorer 상세 스펙

> **핵심 가치**: "대규모 프로젝트에서도 빠르게 파일을 탐색하고 관리한다"

## 1. 개요

### 1.1 핵심 기능

- 트리 구조 파일 탐색
- 가상화 (대규모 디렉토리 성능)
- Git 상태 표시
- 파일 검색 통합
- 드래그 앤 드롭
- 컨텍스트 메뉴

### 1.2 성능 목표

| 작업 | 목표 시간 |
|------|----------|
| 디렉토리 확장 (100 항목) | < 50ms |
| 디렉토리 확장 (10,000 항목) | < 200ms (가상화) |
| Git 상태 업데이트 | < 100ms |
| 검색 결과 표시 | < 50ms (첫 결과) |

---

## 2. 데이터 구조

### 2.1 파일 트리 모델

```rust
pub struct FileTree {
    root: FileTreeNode,
    expanded_dirs: HashSet<PathBuf>,
    selected_items: Vec<PathBuf>,
    focused_item: Option<PathBuf>,
}

pub struct FileTreeNode {
    pub path: PathBuf,
    pub name: String,
    pub node_type: NodeType,
    pub children: Option<Vec<FileTreeNode>>,  // None = 미로드
    pub metadata: FileMetadata,
    pub git_status: Option<GitStatus>,
}

pub enum NodeType {
    File { extension: Option<String> },
    Directory { is_symlink: bool },
}

pub struct FileMetadata {
    pub size: u64,
    pub modified: SystemTime,
    pub is_hidden: bool,
}

pub enum GitStatus {
    Modified,
    Added,
    Deleted,
    Renamed,
    Untracked,
    Ignored,
    Conflicted,
}
```

### 2.2 Lazy Loading

```rust
impl FileTree {
    /// 디렉토리 확장 시 자식 로드
    pub async fn expand_directory(&mut self, path: &Path) -> Result<()> {
        if self.expanded_dirs.contains(path) {
            return Ok(());
        }

        // 자식 노드 로드
        let children = self.load_children(path).await?;

        // 트리에 삽입
        if let Some(node) = self.find_node_mut(path) {
            node.children = Some(children);
        }

        self.expanded_dirs.insert(path.to_path_buf());

        // Git 상태 비동기 로드
        self.load_git_status(path);

        Ok(())
    }

    async fn load_children(&self, path: &Path) -> Result<Vec<FileTreeNode>> {
        let mut entries = Vec::new();
        let mut dir = tokio::fs::read_dir(path).await?;

        while let Some(entry) = dir.next_entry().await? {
            let node = self.create_node_from_entry(&entry).await?;
            entries.push(node);
        }

        // 정렬: 디렉토리 먼저, 그 다음 알파벳순
        entries.sort_by(|a, b| {
            match (&a.node_type, &b.node_type) {
                (NodeType::Directory { .. }, NodeType::File { .. }) => Ordering::Less,
                (NodeType::File { .. }, NodeType::Directory { .. }) => Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });

        Ok(entries)
    }
}
```

---

## 3. 가상화 (Virtualization)

### 3.1 뷰포트 기반 렌더링

```typescript
// Frontend: SolidJS + virtua
import { Virtualizer } from 'virtua/solid';

function FileExplorer(props: { tree: FlattenedTree }) {
    // 트리를 평탄화된 배열로 변환
    const flatItems = createMemo(() => flattenTree(props.tree));

    return (
        <Virtualizer
            data={flatItems()}
            itemSize={24}  // 행 높이 24px
            overscan={10}  // 뷰포트 외 10개 미리 렌더링
        >
            {(item, index) => (
                <FileTreeRow
                    item={item}
                    index={index}
                    depth={item.depth}
                />
            )}
        </Virtualizer>
    );
}

// 트리 평탄화 (expanded 디렉토리만 포함)
function flattenTree(tree: FileTree): FlatItem[] {
    const result: FlatItem[] = [];

    function traverse(node: FileTreeNode, depth: number) {
        result.push({ ...node, depth });

        if (node.nodeType === 'directory' && tree.expandedDirs.has(node.path)) {
            for (const child of node.children ?? []) {
                traverse(child, depth + 1);
            }
        }
    }

    traverse(tree.root, 0);
    return result;
}
```

### 3.2 대규모 디렉토리 처리

```rust
// 10,000개 이상 항목: 청크 로딩
const CHUNK_SIZE: usize = 500;

impl FileTree {
    pub async fn load_children_chunked(&self, path: &Path) -> Result<ChildrenStream> {
        let dir = tokio::fs::read_dir(path).await?;

        // 스트림으로 청크 반환
        let stream = async_stream::stream! {
            let mut batch = Vec::with_capacity(CHUNK_SIZE);

            while let Some(entry) = dir.next_entry().await? {
                batch.push(self.create_node_from_entry(&entry).await?);

                if batch.len() >= CHUNK_SIZE {
                    batch.sort_by(...);
                    yield std::mem::take(&mut batch);
                }
            }

            if !batch.is_empty() {
                batch.sort_by(...);
                yield batch;
            }
        };

        Ok(stream)
    }
}
```

---

## 4. Git 통합

### 4.1 상태 로딩

```rust
use git2::Repository;

pub struct GitStatusManager {
    repo: Option<Repository>,
    status_cache: HashMap<PathBuf, GitStatus>,
}

impl GitStatusManager {
    pub fn load_status(&mut self, worktree_path: &Path) -> Result<()> {
        let repo = Repository::discover(worktree_path)?;
        let statuses = repo.statuses(None)?;

        self.status_cache.clear();

        for entry in statuses.iter() {
            if let Some(path) = entry.path() {
                let status = self.convert_status(entry.status());
                self.status_cache.insert(
                    worktree_path.join(path),
                    status
                );
            }
        }

        self.repo = Some(repo);
        Ok(())
    }

    fn convert_status(&self, status: git2::Status) -> GitStatus {
        if status.contains(git2::Status::CONFLICTED) {
            GitStatus::Conflicted
        } else if status.is_wt_new() || status.is_index_new() {
            GitStatus::Added
        } else if status.is_wt_modified() || status.is_index_modified() {
            GitStatus::Modified
        } else if status.is_wt_deleted() || status.is_index_deleted() {
            GitStatus::Deleted
        } else if status.is_wt_renamed() || status.is_index_renamed() {
            GitStatus::Renamed
        } else if status.is_ignored() {
            GitStatus::Ignored
        } else {
            GitStatus::Untracked
        }
    }
}
```

### 4.2 시각적 표시

```typescript
// 상태별 스타일
const gitStatusStyles: Record<GitStatus, string> = {
    modified: 'text-yellow-500',
    added: 'text-green-500',
    deleted: 'text-red-500 line-through',
    renamed: 'text-blue-500',
    untracked: 'text-gray-400',
    ignored: 'text-gray-600 opacity-50',
    conflicted: 'text-red-600 font-bold',
};

// 디렉토리에 변경된 파일이 있으면 상위 디렉토리도 표시
function DirectoryBadge(props: { path: string, gitStatus: Map<string, GitStatus> }) {
    const hasChanges = createMemo(() => {
        for (const [filePath, status] of props.gitStatus) {
            if (filePath.startsWith(props.path) && status !== 'ignored') {
                return true;
            }
        }
        return false;
    });

    return (
        <Show when={hasChanges()}>
            <span class="w-2 h-2 rounded-full bg-yellow-500 ml-1" />
        </Show>
    );
}
```

---

## 5. 파일 감시 (File Watching)

### 5.1 Notify 통합

```rust
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Event};

pub struct FileWatcher {
    watcher: RecommendedWatcher,
    event_tx: mpsc::Sender<FileEvent>,
}

impl FileWatcher {
    pub fn new() -> Result<(Self, mpsc::Receiver<FileEvent>)> {
        let (tx, rx) = mpsc::channel(1000);
        let event_tx = tx.clone();

        let watcher = notify::recommended_watcher(move |res: Result<Event, _>| {
            if let Ok(event) = res {
                let file_event = match event.kind {
                    EventKind::Create(_) => FileEvent::Created(event.paths),
                    EventKind::Modify(_) => FileEvent::Modified(event.paths),
                    EventKind::Remove(_) => FileEvent::Removed(event.paths),
                    _ => return,
                };

                let _ = tx.blocking_send(file_event);
            }
        })?;

        Ok((FileWatcher { watcher, event_tx }, rx))
    }

    pub fn watch(&mut self, path: &Path) -> Result<()> {
        self.watcher.watch(path, RecursiveMode::Recursive)?;
        Ok(())
    }
}

pub enum FileEvent {
    Created(Vec<PathBuf>),
    Modified(Vec<PathBuf>),
    Removed(Vec<PathBuf>),
}
```

### 5.2 트리 업데이트

```rust
impl FileTree {
    pub fn handle_file_event(&mut self, event: FileEvent) {
        match event {
            FileEvent::Created(paths) => {
                for path in paths {
                    if let Some(parent) = path.parent() {
                        if self.expanded_dirs.contains(parent) {
                            // 부모가 확장되어 있으면 새 노드 추가
                            self.add_node(&path);
                        }
                    }
                }
            }
            FileEvent::Modified(paths) => {
                for path in paths {
                    // 메타데이터 업데이트
                    self.update_metadata(&path);
                }
            }
            FileEvent::Removed(paths) => {
                for path in paths {
                    self.remove_node(&path);
                }
            }
        }

        // Git 상태 갱신 (디바운스)
        self.schedule_git_status_update();
    }
}
```

---

## 6. 사용자 인터랙션

### 6.1 키보드 네비게이션

```
↑/↓         : 이전/다음 항목
←           : 디렉토리 접기 / 상위로 이동
→           : 디렉토리 확장 / 파일 열기
Enter       : 파일 열기 / 디렉토리 토글
Space       : 선택 (멀티셀렉트)
Cmd+↑       : 상위 디렉토리로 이동
Cmd+↓       : 선택된 디렉토리 진입
F2          : 이름 변경
Delete      : 삭제 (확인 다이얼로그)
Cmd+C       : 복사
Cmd+V       : 붙여넣기
Cmd+X       : 잘라내기
```

### 6.2 드래그 앤 드롭

```typescript
function FileTreeRow(props: { item: FlatItem }) {
    const [isDragging, setIsDragging] = createSignal(false);
    const [isDragOver, setIsDragOver] = createSignal(false);

    const handleDragStart = (e: DragEvent) => {
        e.dataTransfer?.setData('ferrum/file-path', props.item.path);
        setIsDragging(true);
    };

    const handleDragOver = (e: DragEvent) => {
        if (props.item.nodeType === 'directory') {
            e.preventDefault();
            setIsDragOver(true);
        }
    };

    const handleDrop = async (e: DragEvent) => {
        e.preventDefault();
        const sourcePath = e.dataTransfer?.getData('ferrum/file-path');

        if (sourcePath && props.item.nodeType === 'directory') {
            await invoke('move_file', {
                source: sourcePath,
                destination: props.item.path
            });
        }

        setIsDragOver(false);
    };

    return (
        <div
            draggable={true}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            class={classList({
                'opacity-50': isDragging(),
                'bg-blue-500/20': isDragOver(),
            })}
        >
            {/* ... */}
        </div>
    );
}
```

### 6.3 컨텍스트 메뉴

```typescript
const fileContextMenu = [
    { label: 'Open', action: 'open', shortcut: 'Enter' },
    { label: 'Open to the Side', action: 'openSide', shortcut: 'Cmd+Enter' },
    { type: 'separator' },
    { label: 'Cut', action: 'cut', shortcut: 'Cmd+X' },
    { label: 'Copy', action: 'copy', shortcut: 'Cmd+C' },
    { label: 'Copy Path', action: 'copyPath', shortcut: 'Cmd+Shift+C' },
    { label: 'Copy Relative Path', action: 'copyRelativePath' },
    { type: 'separator' },
    { label: 'Rename', action: 'rename', shortcut: 'F2' },
    { label: 'Delete', action: 'delete', shortcut: 'Delete' },
    { type: 'separator' },
    { label: 'Reveal in Finder', action: 'revealInFinder' },
    { label: 'Open in Terminal', action: 'openInTerminal' },
];

const directoryContextMenu = [
    ...fileContextMenu,
    { type: 'separator' },
    { label: 'New File', action: 'newFile', shortcut: 'Cmd+N' },
    { label: 'New Folder', action: 'newFolder', shortcut: 'Cmd+Shift+N' },
    { label: 'Find in Folder', action: 'findInFolder' },
];
```

---

## 7. 검색 통합

### 7.1 파일 필터

```typescript
function FileExplorerHeader() {
    const [filter, setFilter] = createSignal('');

    // 디바운스된 필터
    const debouncedFilter = useDebounce(filter, 150);

    createEffect(() => {
        const query = debouncedFilter();
        if (query) {
            invoke('filter_file_tree', { query });
        } else {
            invoke('clear_file_filter');
        }
    });

    return (
        <div class="p-2 border-b">
            <input
                type="text"
                placeholder="Filter files..."
                value={filter()}
                onInput={(e) => setFilter(e.target.value)}
                class="w-full px-2 py-1 bg-gray-800 rounded"
            />
        </div>
    );
}
```

### 7.2 Fuzzy 매칭

```rust
use fuzzy_matcher::FuzzyMatcher;
use fuzzy_matcher::skim::SkimMatcherV2;

pub struct FileFilter {
    matcher: SkimMatcherV2,
}

impl FileFilter {
    pub fn filter(&self, tree: &FileTree, query: &str) -> Vec<FilteredNode> {
        let mut results = Vec::new();

        self.filter_recursive(&tree.root, query, &mut results);

        // 점수순 정렬
        results.sort_by(|a, b| b.score.cmp(&a.score));

        results
    }

    fn filter_recursive(
        &self,
        node: &FileTreeNode,
        query: &str,
        results: &mut Vec<FilteredNode>,
    ) {
        if let Some(score) = self.matcher.fuzzy_match(&node.name, query) {
            results.push(FilteredNode {
                path: node.path.clone(),
                score,
            });
        }

        if let Some(children) = &node.children {
            for child in children {
                self.filter_recursive(child, query, results);
            }
        }
    }
}
```

---

## 8. IPC 메시지

```rust
// Commands (Frontend → Backend)
#[tauri::command]
async fn expand_directory(path: String) -> Result<Vec<FileTreeNode>, String>;

#[tauri::command]
async fn collapse_directory(path: String) -> Result<(), String>;

#[tauri::command]
async fn create_file(path: String, name: String) -> Result<PathBuf, String>;

#[tauri::command]
async fn create_directory(path: String, name: String) -> Result<PathBuf, String>;

#[tauri::command]
async fn rename_file(old_path: String, new_name: String) -> Result<PathBuf, String>;

#[tauri::command]
async fn delete_files(paths: Vec<String>) -> Result<(), String>;

#[tauri::command]
async fn move_file(source: String, destination: String) -> Result<PathBuf, String>;

#[tauri::command]
async fn copy_file(source: String, destination: String) -> Result<PathBuf, String>;

// Events (Backend → Frontend)
enum FileExplorerEvent {
    TreeUpdated { nodes: Vec<FileTreeNode> },
    GitStatusChanged { statuses: HashMap<PathBuf, GitStatus> },
    FileCreated { path: PathBuf },
    FileDeleted { path: PathBuf },
    FileRenamed { old_path: PathBuf, new_path: PathBuf },
}
```

---

## 9. 설정

```toml
[file_explorer]
# 숨김 파일 표시
show_hidden_files = false

# Git 무시 파일 표시
show_git_ignored = true

# 자동 확장 (열린 파일 위치)
auto_reveal = true

# 정렬 순서
sort_order = "name"  # name, type, modified, size

# 디렉토리 우선
folders_first = true

# 심볼릭 링크 따라가기
follow_symlinks = true

# 파일 아이콘 표시
show_file_icons = true

# 축소 모드 (아이콘만)
compact_mode = false
```

---

## 10. 구현 로드맵

### Phase 1: 기본 트리 (Week 1-2)
- [ ] FileTree 데이터 구조
- [ ] Lazy loading
- [ ] 기본 렌더링

### Phase 2: 가상화 (Week 2-3)
- [ ] virtua 통합
- [ ] 청크 로딩
- [ ] 스크롤 성능 최적화

### Phase 3: Git 통합 (Week 3-4)
- [ ] git2 통합
- [ ] 상태 표시
- [ ] 상위 디렉토리 뱃지

### Phase 4: 파일 감시 (Week 4-5)
- [ ] notify 통합
- [ ] 실시간 업데이트
- [ ] 디바운싱

### Phase 5: 인터랙션 (Week 5-6)
- [ ] 키보드 네비게이션
- [ ] 드래그 앤 드롭
- [ ] 컨텍스트 메뉴

### Phase 6: 검색/필터 (Week 6-7)
- [ ] Fuzzy 필터
- [ ] 검색 하이라이트
