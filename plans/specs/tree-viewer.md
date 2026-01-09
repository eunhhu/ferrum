# Tree Viewer & Tree Fold 상세 스펙

> **핵심 가치**: "피그마처럼 코드를 깊이별로 탐색하여, 복잡한 코드베이스를 빠르게 이해한다"

## 1. 개요

### 1.1 문제점 (기존 IDE의 한계)

**VSCode/기존 IDE:**
```
function processUser(user) {
  if (user.isActive) {
    const profile = loadProfile(user.id);
    if (profile.premium) {
      sendNotification(user.email, {
        type: 'premium',
        data: getRecommendations(user.preferences)
      });
    } else {
      // ... 100줄 더
    }
  }
  // ... 200줄 더
}
```

**문제:**
- 중첩 깊이가 깊어지면 컨텍스트 파악 어려움
- 스크롤 많이 필요
- "지금 어느 레벨의 코드를 보고 있는지" 불명확

### 1.2 Ferrum Tree Viewer 솔루션

**핵심 아이디어:**
1. **깊이별 컬러 컨테이닝**: 각 중첩 레벨마다 다른 배경색
2. **스티키 헤더**: 스크롤 시 현재 스코프의 헤더가 상단에 고정
3. **피그마식 Tree Fold**: n-depth 이하 자동 접기로 빠른 구조 파악
4. **시각적 가이드**: 중첩 깊이를 한눈에 파악

---

## 2. 깊이별 컬러 컨테이닝

### 2.1 비주얼 디자인

**컬러 팔레트 (Dark Theme 기준):**
```
Depth 0 (Global):     Background: #1e1e1e (기본)
Depth 1 (Function):   Background: #252525 (약간 밝음)
Depth 2 (If/Loop):    Background: #2a2a2a
Depth 3 (Nested):     Background: #2f2f2f
Depth 4+:             Background: #343434 (최대치)
```

**알고리즘:**
```rust
fn depth_to_color(depth: u32, theme: &Theme) -> Color {
    let base = theme.colors.background;
    let increment = theme.colors.depth_increment; // 예: 5

    let lightness = base.lightness() + (depth.min(5) * increment);
    base.with_lightness(lightness)
}
```

**Light Theme:**
```
Depth 0:  #ffffff (기본)
Depth 1:  #fafafa (약간 어두움)
Depth 2:  #f5f5f5
Depth 3:  #f0f0f0
Depth 4+: #ebebeb
```

### 2.2 깊이 계산 (Tree-sitter 기반)

```rust
pub struct DepthAnalyzer {
    tree: Tree,
    depth_map: HashMap<Range, u32>,
}

impl DepthAnalyzer {
    pub fn analyze(&mut self, buffer: &TextBuffer) {
        let tree = self.tree;
        let root = tree.root_node();

        self.depth_map.clear();
        self.traverse(root, 0);
    }

    fn traverse(&mut self, node: Node, depth: u32) {
        // 블록 스코프를 생성하는 노드만 깊이 증가
        let increases_depth = matches!(
            node.kind(),
            "block"
            | "function_declaration"
            | "arrow_function"
            | "class_declaration"
            | "if_statement"
            | "for_statement"
            | "while_statement"
            | "try_statement"
            | "catch_clause"
        );

        let current_depth = if increases_depth { depth + 1 } else { depth };

        // 범위 저장
        self.depth_map.insert(
            Range {
                start: node.start_position(),
                end: node.end_position(),
            },
            current_depth,
        );

        // 자식 노드 순회
        for child in node.children(&mut node.walk()) {
            self.traverse(child, current_depth);
        }
    }

    pub fn get_depth(&self, position: Position) -> u32 {
        self.depth_map
            .iter()
            .filter(|(range, _)| range.contains(position))
            .map(|(_, depth)| *depth)
            .max()
            .unwrap_or(0)
    }
}
```

### 2.3 렌더링 최적화

**문제**: 모든 라인마다 배경색을 그리면 성능 저하

**해결**: Depth Region Merging
```rust
pub struct DepthRegion {
    start_line: u32,
    end_line: u32,
    depth: u32,
}

pub fn merge_depth_regions(depth_map: &HashMap<Range, u32>) -> Vec<DepthRegion> {
    let mut regions = Vec::new();
    let mut current_region: Option<DepthRegion> = None;

    for line in 0..total_lines {
        let depth = get_line_depth(line, depth_map);

        match &mut current_region {
            Some(region) if region.depth == depth => {
                // 같은 깊이면 확장
                region.end_line = line;
            }
            _ => {
                // 깊이가 변경되면 새 리전 시작
                if let Some(region) = current_region.take() {
                    regions.push(region);
                }
                current_region = Some(DepthRegion {
                    start_line: line,
                    end_line: line,
                    depth,
                });
            }
        }
    }

    if let Some(region) = current_region {
        regions.push(region);
    }

    regions
}

// 렌더링: 리전 단위로 배경 사각형 그리기
fn render_depth_backgrounds(regions: &[DepthRegion], canvas: &Canvas) {
    for region in regions {
        let color = depth_to_color(region.depth);
        let rect = Rect {
            x: 0,
            y: region.start_line * line_height,
            width: canvas.width,
            height: (region.end_line - region.start_line + 1) * line_height,
        };
        canvas.fill_rect(rect, color);
    }
}
```

### 2.4 추가 기능: Depth Indicator (여백 시각화)

**좌측 여백에 깊이 표시:**
```
|         function foo() {
| |         if (condition) {
| | |         console.log('nested');
| | |       }
| |       }
|       }
```

```rust
fn render_depth_indicators(depth: u32, x: f32, y: f32, canvas: &Canvas) {
    let indicator_width = 2.0;
    let indicator_spacing = 4.0;

    for i in 0..depth {
        let x_offset = x + i as f32 * indicator_spacing;
        canvas.draw_line(
            Point { x: x_offset, y },
            Point { x: x_offset, y: y + line_height },
            depth_to_color(i + 1),
            indicator_width,
        );
    }
}
```

---

## 3. 스티키 헤더 (Sticky Headers)

### 3.1 개념

**Monaco Editor의 Sticky Scroll + 개선:**

스크롤 시 현재 컨텍스트의 헤더들이 화면 상단에 고정됩니다.

**예시:**
```
[고정된 헤더 영역]
class UserService {
  processUser(user: User) {
    if (user.isActive) {
      // ← 현재 스크롤 위치

[스크롤 가능 영역]
      const profile = loadProfile(user.id);
      if (profile.premium) {
        // 여기를 보고 있어도 상위 컨텍스트가 보임
      }
```

### 3.2 헤더 추출 (Tree-sitter)

```rust
pub struct StickyHeader {
    line: u32,
    text: String,
    depth: u32,
    node_kind: String,
}

pub struct StickyHeaderTracker {
    headers: Vec<StickyHeader>,
}

impl StickyHeaderTracker {
    pub fn extract_headers(&mut self, tree: &Tree, buffer: &TextBuffer) {
        self.headers.clear();

        let root = tree.root_node();
        self.traverse_for_headers(root, buffer);
    }

    fn traverse_for_headers(&mut self, node: Node, buffer: &TextBuffer) {
        // 헤더가 될 수 있는 노드 종류
        let is_header = matches!(
            node.kind(),
            "function_declaration"
            | "method_definition"
            | "class_declaration"
            | "interface_declaration"
            | "if_statement"
            | "for_statement"
            | "while_statement"
            | "switch_statement"
            | "try_statement"
        );

        if is_header {
            let start_pos = node.start_position();
            let line = start_pos.row as u32;

            // 헤더 텍스트 추출 (첫 줄만)
            let text = self.extract_header_text(node, buffer);

            self.headers.push(StickyHeader {
                line,
                text,
                depth: self.get_node_depth(node),
                node_kind: node.kind().to_string(),
            });
        }

        // 재귀
        for child in node.children(&mut node.walk()) {
            self.traverse_for_headers(child, buffer);
        }
    }

    fn extract_header_text(&self, node: Node, buffer: &TextBuffer) -> String {
        // 노드의 첫 줄만 가져오기
        let start = node.start_position();
        let end = Position {
            line: start.row,
            column: u32::MAX, // 라인 끝까지
        };

        let text = buffer.text_in_range(Range {
            start: start.into(),
            end: end.into(),
        });

        // 여는 중괄호 제거, 공백 정리
        text.trim_end_matches('{').trim().to_string()
    }

    pub fn get_sticky_headers(&self, scroll_line: u32, max_depth: u32) -> Vec<&StickyHeader> {
        let mut stack: Vec<&StickyHeader> = Vec::new();

        for header in &self.headers {
            if header.line > scroll_line {
                break;
            }

            // 깊이가 같거나 얕으면 이전 헤더 제거
            while let Some(last) = stack.last() {
                if last.depth >= header.depth {
                    stack.pop();
                } else {
                    break;
                }
            }

            stack.push(header);

            // 최대 깊이 제한
            if stack.len() > max_depth as usize {
                stack.remove(0);
            }
        }

        stack
    }
}
```

### 3.3 렌더링

```rust
fn render_sticky_headers(
    headers: &[&StickyHeader],
    canvas: &Canvas,
    theme: &Theme,
) {
    let header_height = line_height;
    let total_height = headers.len() as f32 * header_height;

    // 배경 (반투명)
    canvas.fill_rect(
        Rect {
            x: 0.0,
            y: 0.0,
            width: canvas.width,
            height: total_height,
        },
        theme.colors.sticky_header_background.with_alpha(0.95),
    );

    // 하단 구분선
    canvas.draw_line(
        Point { x: 0.0, y: total_height },
        Point { x: canvas.width, y: total_height },
        theme.colors.sticky_header_border,
        1.0,
    );

    // 각 헤더 렌더링
    for (i, header) in headers.iter().enumerate() {
        let y = i as f32 * header_height;

        // 배경 (깊이별 색상)
        let bg_color = depth_to_color(header.depth, theme);
        canvas.fill_rect(
            Rect {
                x: 0.0,
                y,
                width: canvas.width,
                height: header_height,
            },
            bg_color,
        );

        // 인덴트
        let indent = header.depth as f32 * indent_width;

        // 아이콘 (노드 종류별)
        let icon = get_icon_for_node_kind(&header.node_kind);
        canvas.draw_icon(icon, Point { x: indent, y });

        // 텍스트
        canvas.draw_text(
            &header.text,
            Point { x: indent + 20.0, y },
            theme.colors.foreground,
        );
    }
}
```

### 3.4 인터랙션

**클릭 시 해당 헤더로 점프:**
```rust
fn on_sticky_header_click(header: &StickyHeader, editor: &mut Editor) {
    editor.scroll_to_line(header.line);
    editor.set_cursor(Position {
        line: header.line,
        column: 0,
    });
}
```

**호버 시 미리보기:**
```rust
fn on_sticky_header_hover(header: &StickyHeader) -> Tooltip {
    Tooltip {
        title: format!("{} (Line {})", header.node_kind, header.line),
        content: get_full_context(header),
    }
}
```

---

## 4. Tree Fold (피그마식 깊이 접기)

### 4.1 개념

**피그마의 레이어 패널처럼:**
- 깊이별로 접기/펼치기
- "n-depth 이하만 보기" 기능
- 빠른 구조 파악

**예시: "Depth 2까지만 보기"**
```
Before (모두 펼침):
class UserService {
  constructor() { ... }
  processUser(user) {
    if (user.isActive) {
      const profile = loadProfile(user.id);
      if (profile.premium) {
        sendNotification(...);
      } else {
        // ...
      }
    }
  }
}

After (Depth 2까지):
class UserService {                      ← Depth 0
  constructor() { ... }                  ← Depth 1
  processUser(user) {                    ← Depth 1
    if (user.isActive) { ... }           ← Depth 2 (접혀있음)
  }
}
```

### 4.2 Fold State 관리

```rust
#[derive(Clone)]
pub struct FoldState {
    // 접힌 범위들
    folded_ranges: HashSet<Range>,

    // 현재 표시할 최대 깊이 (None이면 제한 없음)
    max_visible_depth: Option<u32>,
}

impl FoldState {
    pub fn fold_to_depth(&mut self, max_depth: u32, tree: &Tree) {
        self.folded_ranges.clear();
        self.max_visible_depth = Some(max_depth);

        // Tree-sitter로 모든 폴드 가능한 노드 찾기
        let foldable_nodes = self.find_foldable_nodes(tree);

        for (node, depth) in foldable_nodes {
            if depth > max_depth {
                // 최대 깊이 초과 시 접기
                self.folded_ranges.insert(Range {
                    start: node.start_position().into(),
                    end: node.end_position().into(),
                });
            }
        }
    }

    pub fn toggle_fold(&mut self, range: Range) {
        if self.folded_ranges.contains(&range) {
            self.folded_ranges.remove(&range);
        } else {
            self.folded_ranges.insert(range);
        }
    }

    pub fn is_folded(&self, range: Range) -> bool {
        self.folded_ranges.contains(&range)
    }

    pub fn unfold_all(&mut self) {
        self.folded_ranges.clear();
        self.max_visible_depth = None;
    }
}
```

### 4.3 Foldable 노드 감지 (Tree-sitter)

```rust
fn find_foldable_nodes(&self, tree: &Tree) -> Vec<(Node, u32)> {
    let mut foldable = Vec::new();
    self.traverse_foldable(tree.root_node(), 0, &mut foldable);
    foldable
}

fn traverse_foldable(&self, node: Node, depth: u32, output: &mut Vec<(Node, u32)>) {
    let is_foldable = matches!(
        node.kind(),
        "block"
        | "function_declaration"
        | "arrow_function"
        | "class_declaration"
        | "if_statement"
        | "for_statement"
        | "while_statement"
        | "switch_statement"
        | "try_statement"
        | "object_expression"
        | "array_expression"
    );

    let current_depth = if is_foldable { depth + 1 } else { depth };

    if is_foldable {
        output.push((node, current_depth));
    }

    for child in node.children(&mut node.walk()) {
        self.traverse_foldable(child, current_depth, output);
    }
}
```

### 4.4 FoldMap 통합 (DisplayMap)

**Editor Engine의 FoldMap에 통합:**
```rust
impl FoldMap {
    pub fn apply_tree_fold(&mut self, fold_state: &FoldState) {
        // 기존 폴드 유지 + Tree Fold 추가
        for range in &fold_state.folded_ranges {
            self.folds.insert(*range, Fold {
                range: *range,
                placeholder: "{ ... }".to_string(),
            });
        }
    }

    pub fn get_placeholder(&self, range: Range, node_kind: &str) -> String {
        match node_kind {
            "function_declaration" => "fn { ... }".to_string(),
            "class_declaration" => "class { ... }".to_string(),
            "if_statement" => "if { ... }".to_string(),
            "for_statement" => "for { ... }".to_string(),
            "object_expression" => "{ ... }".to_string(),
            "array_expression" => "[ ... ]".to_string(),
            _ => "...".to_string(),
        }
    }
}
```

### 4.5 UI 컨트롤

**Depth Slider (UI 상단):**
```
┌─────────────────────────────────────┐
│ [파일 탐색기] [에디터]               │
│                                     │
│ Show Depth: [0][1][2][3][4][All]   │  ← 깊이 선택 버튼
│              ▲                      │
│         현재 Depth 2                │
│                                     │
│ class UserService { ...             │
└─────────────────────────────────────┘
```

**키보드 단축키:**
```
Cmd+K Cmd+0  : Fold All
Cmd+K Cmd+1  : Show Depth 1
Cmd+K Cmd+2  : Show Depth 2
Cmd+K Cmd+3  : Show Depth 3
Cmd+K Cmd+J  : Unfold All
```

**컨텍스트 메뉴:**
```
우클릭 →
  - Fold Block
  - Unfold Block
  - Fold to Depth 1
  - Fold to Depth 2
  - Fold to Depth 3
  - Unfold All
```

---

## 5. 추가 기능: Minimap 통합

### 5.1 Structural Minimap (개요 문서 명시)

**기존 Minimap 문제:**
- 코드 "모양"만 보임
- 구조 파악 어려움

**Ferrum Structural Minimap:**
- 함수/클래스/블록을 색으로 구분
- 깊이별 색상 적용
- 클릭 시 해당 위치로 점프

```rust
pub struct StructuralMinimap {
    blocks: Vec<MinimapBlock>,
}

pub struct MinimapBlock {
    range: Range,
    kind: BlockKind,
    depth: u32,
}

pub enum BlockKind {
    Function,
    Class,
    IfStatement,
    Loop,
    Other,
}

impl StructuralMinimap {
    pub fn build(tree: &Tree, buffer: &TextBuffer) -> Self {
        let mut blocks = Vec::new();
        Self::traverse(tree.root_node(), &mut blocks);

        StructuralMinimap { blocks }
    }

    fn render(&self, canvas: &Canvas, viewport: Viewport, theme: &Theme) {
        let scale = canvas.height / buffer.total_lines() as f32;

        for block in &self.blocks {
            let y = block.range.start.line as f32 * scale;
            let height = (block.range.end.line - block.range.start.line) as f32 * scale;

            let color = match block.kind {
                BlockKind::Function => theme.colors.minimap_function,
                BlockKind::Class => theme.colors.minimap_class,
                BlockKind::IfStatement => theme.colors.minimap_control_flow,
                BlockKind::Loop => theme.colors.minimap_loop,
                BlockKind::Other => depth_to_color(block.depth, theme),
            };

            canvas.fill_rect(
                Rect {
                    x: 0.0,
                    y,
                    width: canvas.width,
                    height: height.max(1.0),
                },
                color.with_alpha(0.3),
            );
        }

        // 현재 뷰포트 표시
        self.render_viewport_indicator(canvas, viewport, scale);
    }
}
```

---

## 6. 성능 최적화

### 6.1 증분 업데이트

**문제**: 편집 시마다 전체 트리 재분석은 비효율적

**해결**: Tree-sitter 증분 파싱 + 캐시
```rust
pub struct TreeViewerCache {
    // 깊이 맵 캐시
    depth_map: HashMap<Range, u32>,
    depth_map_version: u64,

    // 스티키 헤더 캐시
    sticky_headers: Vec<StickyHeader>,
    sticky_headers_version: u64,

    // 폴드 가능 노드 캐시
    foldable_nodes: Vec<(Range, u32)>,
    foldable_nodes_version: u64,
}

impl TreeViewerCache {
    pub fn invalidate_range(&mut self, range: Range) {
        // 영향받은 범위만 무효화
        self.depth_map.retain(|r, _| !r.overlaps(range));
        self.sticky_headers.retain(|h| {
            let h_range = Range {
                start: Position { line: h.line, column: 0 },
                end: Position { line: h.line + 1, column: 0 },
            };
            !h_range.overlaps(range)
        });
    }

    pub fn sync(&mut self, buffer: &TextBuffer, tree: &Tree) {
        if buffer.version() != self.depth_map_version {
            // 증분 업데이트
            let changed_ranges = buffer.changed_ranges();
            for range in changed_ranges {
                self.invalidate_range(range);
            }

            // 무효화된 부분만 재계산
            self.recompute_depth_map(tree, buffer);
            self.depth_map_version = buffer.version();
        }
    }
}
```

### 6.2 렌더링 최적화

**뷰포트 클리핑:**
```rust
fn render_depth_backgrounds_optimized(
    regions: &[DepthRegion],
    viewport: Viewport,
    canvas: &Canvas,
) {
    let visible_start = viewport.scroll_line;
    let visible_end = viewport.scroll_line + viewport.height_lines;

    for region in regions {
        // 뷰포트 밖이면 스킵
        if region.end_line < visible_start || region.start_line > visible_end {
            continue;
        }

        // 클리핑
        let render_start = region.start_line.max(visible_start);
        let render_end = region.end_line.min(visible_end);

        let rect = Rect {
            x: 0.0,
            y: (render_start - visible_start) as f32 * line_height,
            width: canvas.width,
            height: (render_end - render_start + 1) as f32 * line_height,
        };

        canvas.fill_rect(rect, depth_to_color(region.depth));
    }
}
```

---

## 7. 사용자 편의성 개선

### 7.1 Depth Navigation (깊이 간 이동)

**새 기능: 같은 깊이의 다음/이전 블록으로 이동**

**키보드 단축키:**
```
Cmd+Shift+↓  : 같은 깊이의 다음 블록으로 이동
Cmd+Shift+↑  : 같은 깊이의 이전 블록으로 이동
Cmd+Shift+←  : 상위 깊이로 이동 (부모 블록)
Cmd+Shift+→  : 하위 깊이로 이동 (첫 자식 블록)
```

```rust
impl Editor {
    pub fn navigate_to_next_sibling_block(&mut self) {
        let current_pos = self.cursor_position();
        let current_depth = self.depth_analyzer.get_depth(current_pos);

        // 같은 깊이의 다음 블록 찾기
        let foldable_nodes = self.tree_folder.foldable_nodes();

        for (node, depth) in foldable_nodes {
            if depth == current_depth && node.start_position().line > current_pos.line {
                self.scroll_to_line(node.start_position().line);
                return;
            }
        }
    }

    pub fn navigate_to_parent_block(&mut self) {
        let current_pos = self.cursor_position();
        let current_depth = self.depth_analyzer.get_depth(current_pos);

        if current_depth == 0 {
            return; // 이미 최상위
        }

        // 상위 블록 찾기
        let foldable_nodes = self.tree_folder.foldable_nodes();

        for (node, depth) in foldable_nodes.iter().rev() {
            if *depth == current_depth - 1
                && node.start_position().line < current_pos.line
                && node.end_position().line > current_pos.line
            {
                self.scroll_to_line(node.start_position().line);
                return;
            }
        }
    }
}
```

### 7.2 Breadcrumb Navigation (현재 위치 표시)

**상단에 현재 위치를 빵가루 형태로 표시:**
```
┌──────────────────────────────────────────────┐
│ UserService > processUser > if (isActive) >  │  ← Breadcrumb
│                                              │
│ class UserService {                          │
│   processUser(user) {                        │
│     if (user.isActive) {                     │
│       █ ← 현재 커서                           │
└──────────────────────────────────────────────┘
```

```rust
pub struct Breadcrumb {
    items: Vec<BreadcrumbItem>,
}

pub struct BreadcrumbItem {
    text: String,
    line: u32,
    depth: u32,
}

impl Breadcrumb {
    pub fn build(cursor_pos: Position, sticky_headers: &[StickyHeader]) -> Self {
        let items = sticky_headers
            .iter()
            .map(|header| BreadcrumbItem {
                text: header.text.clone(),
                line: header.line,
                depth: header.depth,
            })
            .collect();

        Breadcrumb { items }
    }

    pub fn render(&self, canvas: &Canvas, theme: &Theme) {
        let mut x = 10.0;
        let y = 5.0;

        for (i, item) in self.items.iter().enumerate() {
            // 텍스트
            canvas.draw_text(&item.text, Point { x, y }, theme.colors.breadcrumb);
            x += measure_text(&item.text) + 5.0;

            // 구분자
            if i < self.items.len() - 1 {
                canvas.draw_text(">", Point { x, y }, theme.colors.breadcrumb_separator);
                x += 15.0;
            }
        }
    }
}
```

**클릭 시 해당 위치로 점프:**
```rust
fn on_breadcrumb_click(item: &BreadcrumbItem, editor: &mut Editor) {
    editor.scroll_to_line(item.line);
}
```

### 7.3 Depth Highlight on Hover

**마우스 호버 시 현재 블록의 깊이 영역 하이라이트:**

```rust
fn on_mouse_hover(position: Position, editor: &Editor, canvas: &Canvas) {
    let depth = editor.depth_analyzer.get_depth(position);

    // 같은 깊이의 범위 찾기
    let ranges = editor.depth_analyzer.get_ranges_at_depth(depth);

    for range in ranges {
        if range.contains(position) {
            // 하이라이트 (테두리)
            canvas.stroke_rect(
                range_to_rect(range),
                theme.colors.depth_highlight,
                2.0,
            );
            break;
        }
    }
}
```

---

## 8. 언어별 최적화

### 8.1 언어별 Depth 규칙

**JavaScript/TypeScript:**
```rust
fn is_depth_increasing_node_js(node: Node) -> bool {
    matches!(
        node.kind(),
        "function_declaration"
        | "arrow_function"
        | "method_definition"
        | "class_declaration"
        | "if_statement"
        | "for_statement"
        | "while_statement"
        | "switch_statement"
        | "try_statement"
        | "catch_clause"
        | "finally_clause"
    )
}
```

**Python:**
```rust
fn is_depth_increasing_node_python(node: Node) -> bool {
    matches!(
        node.kind(),
        "function_definition"
        | "class_definition"
        | "if_statement"
        | "for_statement"
        | "while_statement"
        | "with_statement"
        | "try_statement"
        | "except_clause"
    )
}
```

**Rust:**
```rust
fn is_depth_increasing_node_rust(node: Node) -> bool {
    matches!(
        node.kind(),
        "function_item"
        | "impl_item"
        | "trait_item"
        | "struct_item"
        | "enum_item"
        | "if_expression"
        | "match_expression"
        | "for_expression"
        | "while_expression"
        | "loop_expression"
        | "block"
    )
}
```

### 8.2 언어별 Sticky Header 포맷

**TypeScript:**
```
interface User {                    ← 헤더
  id: number;
  processOrder(order: Order) {      ← 헤더
    if (order.isPremium) {          ← 헤더
```

**Python:**
```
class UserService:                  ← 헤더
    def process_user(self, user):   ← 헤더
        if user.is_active:          ← 헤더
```

---

## 9. 설정 (Config)

```toml
[tree_viewer]
# 깊이별 컬러 활성화
enable_depth_colors = true

# 컬러 증가량 (밝기)
depth_color_increment = 5

# 최대 표시 깊이 (None이면 무제한)
max_depth_colors = 5

# 스티키 헤더 활성화
enable_sticky_headers = true

# 스티키 헤더 최대 개수
max_sticky_headers = 5

# 스티키 헤더 투명도 (0.0 ~ 1.0)
sticky_header_opacity = 0.95

# Tree Fold 활성화
enable_tree_fold = true

# 기본 폴드 깊이 (None이면 모두 펼침)
default_fold_depth = null

# Depth Indicator 표시
show_depth_indicators = true

# Breadcrumb 표시
show_breadcrumb = true

# Structural Minimap 활성화
enable_structural_minimap = true
```

---

## 10. 구현 로드맵

### Phase 1: 깊이 분석 (Week 1-2)
- [ ] DepthAnalyzer (Tree-sitter 통합)
- [ ] 깊이별 컬러 계산
- [ ] Depth Region Merging

### Phase 2: 렌더링 (Week 2-3)
- [ ] 깊이별 배경 렌더링
- [ ] Depth Indicator 렌더링
- [ ] 테마 통합

### Phase 3: 스티키 헤더 (Week 3-4)
- [ ] StickyHeaderTracker
- [ ] 헤더 추출 (Tree-sitter)
- [ ] 스티키 헤더 렌더링
- [ ] 인터랙션 (클릭, 호버)

### Phase 4: Tree Fold (Week 4-6)
- [ ] FoldState 관리
- [ ] Foldable 노드 감지
- [ ] FoldMap 통합
- [ ] Depth Slider UI

### Phase 5: 추가 기능 (Week 6-8)
- [ ] Depth Navigation
- [ ] Breadcrumb
- [ ] Depth Highlight on Hover
- [ ] Structural Minimap

### Phase 6: 최적화 (Week 8-10)
- [ ] 캐싱
- [ ] 증분 업데이트
- [ ] 뷰포트 클리핑
- [ ] 성능 프로파일링

---

## 11. 테스트 전략

### 11.1 Unit Tests

```rust
#[test]
fn test_depth_calculation() {
    let code = r#"
    function foo() {
        if (true) {
            console.log('nested');
        }
    }
    "#;

    let tree = parse_typescript(code);
    let analyzer = DepthAnalyzer::new(tree);

    assert_eq!(analyzer.get_depth(Position { line: 0, column: 0 }), 0); // function
    assert_eq!(analyzer.get_depth(Position { line: 1, column: 0 }), 1); // if
    assert_eq!(analyzer.get_depth(Position { line: 2, column: 0 }), 2); // console.log
}

#[test]
fn test_sticky_headers() {
    let tracker = StickyHeaderTracker::new();
    let headers = tracker.get_sticky_headers(10, 3);

    assert_eq!(headers.len(), 3);
    assert_eq!(headers[0].depth, 0);
    assert_eq!(headers[1].depth, 1);
}
```

### 11.2 Integration Tests

```rust
#[test]
fn test_tree_fold_integration() {
    let mut editor = Editor::new(buffer_id);
    editor.tree_fold.fold_to_depth(2, &tree);

    // Depth 3+ 블록은 접혀야 함
    let visible_lines = editor.display_map.visible_lines();
    assert!(visible_lines < original_lines);
}
```

---

## 참고 자료

- [Figma Layers](https://www.figma.com/best-practices/layer-organization-in-figma/)
- [Monaco Sticky Scroll](https://github.com/microsoft/monaco-editor/issues/2825)
- [Tree-sitter Queries](https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries)
- [Indent Rainbow (VSCode Extension)](https://marketplace.visualstudio.com/items?itemName=oderwat.indent-rainbow)
