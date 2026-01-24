# View Mode System Architecture

> **핵심 목표**: 파일 타입, MIME type, export 형식, 컨텍스트에 따라 무한 확장 가능한 뷰 모드 제공
> **디자인 철학**: 개발자가 "코딩"이 아닌 "코드 디자인"을 한다는 느낌 (Figma-like UX)

## 1. 핵심 개념

### 1.1 View Mode란?

View Mode는 동일한 파일/데이터를 다른 방식으로 표현하는 렌더링 레이어입니다.

**예시:**
| 파일 | 사용 가능한 View Mode |
|------|----------------------|
| `Button.tsx` | Code View, Component Canvas, Production Preview |
| `data.json` | Code View, Tree View, Table View, Graph View |
| `styles.css` | Code View, Visual Style Editor, Color Palette View |
| `api.ts` | Code View, API Flow Diagram, OpenAPI Doc View |
| `Chart.tsx` | Code View, Chart Designer, Production Preview |

### 1.2 Design Philosophy

**Production-First Development:**
- 프로덕션 환경에서 실시간으로 개발
- 코드 변경 즉시 실제 동작 확인
- Hot Module Replacement로 빠른 피드백

**Figma-like Experience:**
- 즉각적인 시각적 피드백
- 드래그 앤 드롭으로 구조 변경
- 실시간 프로퍼티 패널
- Code ↔ View 양방향 동기화

---

## 2. Architecture

### 2.1 View Mode Registry

```typescript
interface ViewModeDefinition {
  id: string;                    // e.g., "core.production-preview"
  name: string;                  // Display name
  icon: string;                  // Icon identifier
  
  // Activation conditions (언제 이 뷰모드 사용 가능?)
  matchers: ViewModeMatcher[];
  
  // Rendering
  renderer: ViewModeRenderer;
  
  // Capabilities
  capabilities: ViewModeCapabilities;
  
  // Metadata
  priority: number;              // Higher = suggested first
  category: "core" | "plugin";
}

interface ViewModeMatcher {
  type: "extension" | "mimetype" | "export" | "pattern" | "custom";
  value: string | RegExp | ((file: FileInfo) => boolean);
}

interface ViewModeCapabilities {
  twoWaySync: boolean;          // Code ↔ View 양방향 동기화
  interactive: boolean;          // 사용자 인터랙션 지원
  realtime: boolean;             // 실시간 업데이트
  splitView: boolean;            // 분할 뷰 지원
}
```

### 2.2 Matcher Examples

```typescript
// 확장자 기반
{ type: "extension", value: /\.(tsx|jsx)$/ }

// MIME type 기반
{ type: "mimetype", value: "application/json" }

// Export 분석 (파일이 특정 export를 가질 때)
{ type: "export", value: "ReactComponent" }
{ type: "export", value: /^(default|[A-Z]\w*)$/ }

// 파일 경로 패턴
{ type: "pattern", value: /api\/.*\.ts$/ }

// 커스텀 함수
{ type: "custom", value: (file) => hasChartConfig(file) }
```

### 2.3 Backend: ViewModeManager

```rust
pub struct ViewModeManager {
    registry: HashMap<String, ViewModeDefinition>,
    active_modes: HashMap<BufferId, Vec<String>>,
    user_preferences: UserViewPreferences,
}

impl ViewModeManager {
    /// 파일에 사용 가능한 모든 View Mode 반환
    pub fn get_available_modes(&self, file: &FileInfo) -> Vec<ViewModeDefinition> {
        self.registry
            .values()
            .filter(|mode| self.matches_file(mode, file))
            .sorted_by_key(|mode| std::cmp::Reverse(mode.priority))
            .collect()
    }
    
    /// 추천 View Mode 반환 (가장 높은 우선순위)
    pub fn get_recommended_mode(&self, file: &FileInfo) -> Option<ViewModeDefinition> {
        // 1. 사용자 선호도 먼저 확인
        if let Some(preferred) = self.user_preferences.get_preferred(file) {
            return self.registry.get(&preferred).cloned();
        }
        
        // 2. 자동 추천
        self.get_available_modes(file).first().cloned()
    }
    
    /// Matcher 평가
    fn matches_file(&self, mode: &ViewModeDefinition, file: &FileInfo) -> bool {
        mode.matchers.iter().any(|matcher| {
            match matcher.type_ {
                MatcherType::Extension => {
                    self.match_extension(&matcher.value, file)
                }
                MatcherType::MimeType => {
                    self.match_mimetype(&matcher.value, file)
                }
                MatcherType::Export => {
                    self.match_export(&matcher.value, file)
                }
                MatcherType::Pattern => {
                    self.match_pattern(&matcher.value, file)
                }
                MatcherType::Custom => {
                    self.match_custom(&matcher.value, file)
                }
            }
        })
    }
    
    /// Export 분석 (Tree-sitter로 파일의 export 확인)
    fn match_export(&self, pattern: &str, file: &FileInfo) -> bool {
        let exports = self.analyze_exports(file);
        exports.iter().any(|exp| {
            // React Component export 패턴 체크
            if pattern == "ReactComponent" {
                return exp.is_react_component;
            }
            // Regex 패턴 매칭
            Regex::new(pattern).map(|re| re.is_match(&exp.name)).unwrap_or(false)
        })
    }
}
```

### 2.4 Frontend: ViewModeContainer

```typescript
export function ViewModeContainer(props: {
  filePath: string;
  buffer: Buffer;
}) {
  const [availableModes, setAvailableModes] = createSignal<ViewMode[]>([]);
  const [activeMode, setActiveMode] = createSignal<string>("core.code");
  const [splitModes, setSplitModes] = createSignal<string[]>([]);

  // 파일 변경 시 사용 가능한 모드 업데이트
  createEffect(async () => {
    const modes = await getAvailableViewModes(props.filePath);
    setAvailableModes(modes);
    
    // 추천 모드 자동 선택 (Code View가 아닌 경우)
    const recommended = modes.find(m => m.priority > 10 && m.id !== "core.code");
    if (recommended) {
      setActiveMode(recommended.id);
    }
  });

  return (
    <div class="view-mode-container">
      <ViewModeToolbar
        modes={availableModes()}
        active={activeMode()}
        onSelect={setActiveMode}
        onSplit={(mode) => setSplitModes([...splitModes(), mode])}
      />
      
      <div class="view-content">
        {/* Primary View */}
        <ViewModeRenderer
          mode={activeMode()}
          filePath={props.filePath}
          buffer={props.buffer}
        />
        
        {/* Split Views */}
        <For each={splitModes()}>
          {(mode) => (
            <ViewModeRenderer
              mode={mode}
              filePath={props.filePath}
              buffer={props.buffer}
            />
          )}
        </For>
      </div>
    </div>
  );
}
```

---

## 3. Built-in View Modes

### 3.1 Core Views (Always Available)

| ID | Name | Priority | Matchers | Capabilities |
|----|------|----------|----------|--------------|
| `core.code` | Code View | 0 | `*` (모든 파일) | twoWaySync: true |
| `core.production-preview` | Production Preview | 15 | `.tsx`, `.jsx`, `.vue`, `.svelte` + previewable export | realtime: true |
| `core.component-canvas` | Component Canvas | 12 | UI framework components | twoWaySync: true, interactive: true |
| `core.visual-flow` | Visual Flow | 8 | Complex logic files | interactive: true |
| `core.api-designer` | API Designer | 10 | `api/*.ts`, `routes/*.ts` | twoWaySync: true |

### 3.2 View Mode Details

#### Code View (`core.code`)
- 기본 텍스트 에디터
- Tree-sitter 구문 강조
- LSP 통합 (자동완성, 정의 이동 등)
- 모든 파일에서 항상 사용 가능

#### Production Preview (`core.production-preview`)
- 실시간 렌더링 in isolated iframe
- Hot Module Replacement
- Props Panel (TypeScript 타입에서 자동 생성)
- State Simulator
- Responsive Viewports

```typescript
const PRODUCTION_PREVIEW: ViewModeDefinition = {
  id: "core.production-preview",
  name: "Production Preview",
  icon: "play",
  matchers: [
    { type: "extension", value: /\.(tsx|jsx|vue|svelte)$/ },
    { type: "export", value: /^(default|[A-Z]\w*)$/ },
    { type: "custom", value: (file) => hasPreviewableExport(file) },
  ],
  priority: 15,
  capabilities: {
    twoWaySync: false,  // Code → View only
    interactive: true,
    realtime: true,
    splitView: true,
  },
};
```

#### Component Canvas (`core.component-canvas`)
- Figma-like 컴포넌트 에디터
- 드래그 앤 드롭 Props 패널
- Style Inspector
- Visual State Management

```typescript
const COMPONENT_CANVAS: ViewModeDefinition = {
  id: "core.component-canvas",
  name: "Component Canvas",
  icon: "layout",
  matchers: [
    { type: "extension", value: /\.(tsx|jsx)$/ },
    { type: "export", value: "ReactComponent" },
  ],
  priority: 12,
  capabilities: {
    twoWaySync: true,   // Code ↔ View
    interactive: true,
    realtime: true,
    splitView: true,
  },
};
```

#### Visual Flow (`core.visual-flow`)
- Node-based 데이터 흐름 시각화
- Function call graph
- State transitions
- 기존 Visual Coding 기능 리팩토링

```typescript
const VISUAL_FLOW: ViewModeDefinition = {
  id: "core.visual-flow",
  name: "Visual Flow",
  icon: "git-branch",
  matchers: [
    { type: "custom", value: (file) => hasComplexLogic(file) },
    { type: "pattern", value: /\.(service|controller|handler)\.ts$/ },
  ],
  priority: 8,
  capabilities: {
    twoWaySync: true,
    interactive: true,
    realtime: true,
    splitView: true,
  },
};
```

#### API Designer (`core.api-designer`)
- REST/GraphQL 엔드포인트 디자이너
- Request/Response 미리보기
- Auto-generate OpenAPI spec

```typescript
const API_DESIGNER: ViewModeDefinition = {
  id: "core.api-designer",
  name: "API Designer",
  icon: "server",
  matchers: [
    { type: "pattern", value: /api\/.*\.ts$/ },
    { type: "pattern", value: /routes\/.*\.ts$/ },
    { type: "export", value: "APIRoute" },
  ],
  priority: 10,
  capabilities: {
    twoWaySync: true,
    interactive: true,
    realtime: true,
    splitView: true,
  },
};
```

### 3.3 Specialized Views

| ID | Name | Matchers | Purpose |
|----|------|----------|---------|
| `core.css-designer` | CSS Designer | `.css`, `.scss` | Visual CSS editor |
| `core.data-editor` | Data Editor | `.json`, `.yaml` | Tree/Table/Form view |
| `core.markdown-preview` | Markdown Preview | `.md` | Live rendering |
| `core.image-viewer` | Image Viewer | `.png`, `.jpg`, `.svg` | Image preview |

---

## 4. Two-Way Synchronization

### 4.1 Sync Protocol

```typescript
interface ViewModeRenderer {
  // View 렌더링 (Code → View)
  render(code: string, ast: ASTNode): ViewState;
  
  // 코드 생성 (View → Code)
  generateCode(viewState: ViewState): CodeChange[];
  
  // View가 현재 코드를 표현 가능한지 확인
  canRepresent(ast: ASTNode): boolean;
}

interface CodeChange {
  range: Range;
  newText: string;
  reason: string;
}
```

### 4.2 Code → View

```typescript
// Buffer 변경 시 View 업데이트
createEffect(() => {
  const buffer = props.buffer;
  const ast = parseAST(buffer.content);
  
  if (renderer.canRepresent(ast)) {
    const viewState = renderer.render(buffer.content, ast);
    updateView(viewState);
  } else {
    // View가 코드를 표현 불가 → Code View로 fallback
    switchToCodeView();
  }
});
```

### 4.3 View → Code

```typescript
// View 상태 변경 시 Code 업데이트
function onViewChange(newViewState: ViewState) {
  const changes = renderer.generateCode(newViewState);
  
  // 배치로 코드 변경 적용
  editor.applyChanges(changes);
}
```

### 4.4 Conflict Resolution

```typescript
enum SyncStrategy {
  CodeWins,      // Code 변경이 우선
  ViewWins,      // View 변경이 우선
  Merge,         // 지능적 병합 시도
  AskUser,       // 사용자에게 선택 요청
}

// 동시 편집 충돌 시
function resolveConflict(
  codeChange: CodeChange,
  viewChange: ViewChange,
  strategy: SyncStrategy
): Resolution {
  switch (strategy) {
    case SyncStrategy.CodeWins:
      return { applyCode: true, discardView: true };
    case SyncStrategy.ViewWins:
      return { applyView: true, discardCode: true };
    case SyncStrategy.Merge:
      return attemptMerge(codeChange, viewChange);
    case SyncStrategy.AskUser:
      return showConflictDialog(codeChange, viewChange);
  }
}
```

---

## 5. Plugin API for Custom View Modes

### 5.1 Plugin Registration

```typescript
// Plugin API
export interface ViewModePluginAPI {
  // 새 View Mode 등록
  registerViewMode(definition: ViewModeDefinition): Disposable;
  
  // 현재 View Mode 가져오기
  getCurrentViewMode(): string;
  
  // View Mode 전환
  switchViewMode(modeId: string): void;
  
  // View Mode 가용성 체크
  isViewModeAvailable(modeId: string): boolean;
}

// Plugin Manifest에서 선언
{
  "contributes": {
    "viewModes": [
      {
        "id": "plugin.chart-designer",
        "name": "Chart Designer",
        "icon": "bar-chart",
        "matcher": {
          "extension": ["chart.ts", "chart.tsx"],
          "export": "ChartConfig"
        },
        "main": "./dist/chart-designer.js"
      }
    ]
  }
}
```

### 5.2 Example Plugin: Chart Designer

```typescript
// chart-designer-plugin/src/index.ts
import { ViewModePluginAPI } from "@ferrum/plugin-api";

export function activate(api: ViewModePluginAPI) {
  api.registerViewMode({
    id: "plugin.chart-designer",
    name: "Chart Designer",
    icon: "bar-chart",
    matchers: [
      { type: "pattern", value: /chart.*\.ts$/ },
      { type: "export", value: "ChartConfig" },
    ],
    renderer: new ChartDesignerRenderer(),
    priority: 20,
    capabilities: {
      twoWaySync: true,
      interactive: true,
      realtime: true,
      splitView: true,
    },
  });
}

class ChartDesignerRenderer implements ViewModeRenderer {
  render(code: string, ast: ASTNode): ViewState {
    // 차트 설정 파싱
    const chartConfig = this.parseChartConfig(code);
    
    // 시각적 차트 에디터 렌더링
    return {
      type: "chart-editor",
      chartType: chartConfig.type,
      data: chartConfig.data,
      options: chartConfig.options,
    };
  }
  
  generateCode(viewState: ViewState): CodeChange[] {
    // 차트 설정을 코드로 변환
    const newCode = this.generateChartCode(viewState);
    return [{ range: fullFileRange, newText: newCode, reason: "Chart updated" }];
  }
}
```

---

## 6. Performance Optimization

### 6.1 Lazy Loading

```typescript
// View Mode 모듈은 on-demand 로딩
const viewModeModules = {
  "core.production-preview": () => import("./views/ProductionPreview"),
  "core.component-canvas": () => import("./views/ComponentCanvas"),
  "core.visual-flow": () => import("./views/VisualFlow"),
  "core.api-designer": () => import("./views/APIDesigner"),
};

async function loadViewMode(id: string) {
  const loader = viewModeModules[id];
  if (!loader) throw new Error(`Unknown view mode: ${id}`);
  
  const module = await loader();
  return module.default;
}
```

### 6.2 View State Caching

```typescript
const viewStateCache = new Map<string, WeakMap<Buffer, ViewState>>();

function getCachedViewState(modeId: string, buffer: Buffer): ViewState | undefined {
  const modeCache = viewStateCache.get(modeId);
  if (!modeCache) return undefined;
  return modeCache.get(buffer);
}

function setCachedViewState(modeId: string, buffer: Buffer, state: ViewState) {
  if (!viewStateCache.has(modeId)) {
    viewStateCache.set(modeId, new WeakMap());
  }
  viewStateCache.get(modeId)!.set(buffer, state);
}
```

### 6.3 Memory Management

```typescript
// 비활성 View 언로드
const MAX_LOADED_VIEWS = 3;

function unloadInactiveViews(loadedViews: ViewInstance[]) {
  if (loadedViews.length > MAX_LOADED_VIEWS) {
    // LRU 방식으로 가장 오래된 뷰 언로드
    const toUnload = loadedViews
      .sort((a, b) => a.lastActiveTime - b.lastActiveTime)
      .slice(0, loadedViews.length - MAX_LOADED_VIEWS);
    
    toUnload.forEach(view => view.dispose());
  }
}
```

---

## 7. User Experience

### 7.1 Mode Switching

**Keyboard Shortcuts:**
- `Cmd+1`: Code View
- `Cmd+2`: Recommended View
- `Cmd+3`: Next Available View
- `Cmd+\`: Toggle Split View
- `Cmd+K, V`: View Mode Picker

**Command Palette:**
```
> view mode
  Switch View Mode
  → Component Canvas (Recommended for Button.tsx)
  → Code View
  → Production Preview
  → Visual Flow
  ─────────────────
  Set Default View Mode for *.tsx
  View Mode Preferences
```

### 7.2 Split Views

```
┌─────────────────────────────────────┐
│  Code View  │  Production Preview   │
│             │                       │
│  function   │   [Rendered Output]   │
│  Button()   │                       │
│             │   [Live Preview]      │
└─────────────────────────────────────┘
```

### 7.3 Mode Persistence (User Preferences)

```typescript
interface UserViewPreferences {
  patterns: Record<string, string>;  // file pattern → mode ID
  defaultMode: string;
}

// Example
const preferences: UserViewPreferences = {
  patterns: {
    "*.tsx": "core.component-canvas",
    "api/*.ts": "core.api-designer",
    "*.css": "core.css-designer",
  },
  defaultMode: "core.code",
};
```

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] ViewModeDefinition 타입 정의
- [ ] ViewModeRegistry 구현 (Rust)
- [ ] ViewModeManager IPC 명령어
- [ ] ViewModeContainer 컴포넌트 (Frontend)
- [ ] 기본 Mode Switching UI

### Phase 2: Core Views (Week 3-6)
- [ ] Code View 리팩토링
- [ ] Production Preview View
  - [ ] Iframe sandbox
  - [ ] HMR 통합
  - [ ] Props Panel
- [ ] Component Canvas View (기본)
- [ ] Visual Flow View (기존 Visual Coding 리팩토링)

### Phase 3: Advanced Views (Week 7-10)
- [ ] API Designer View
- [ ] CSS Designer View
- [ ] JSON/YAML Editor Views
- [ ] Markdown Preview

### Phase 4: Plugin System (Week 11-12)
- [ ] ViewModePluginAPI 정의
- [ ] Plugin manifest `viewModes` 지원
- [ ] Example plugin 작성

### Phase 5: Polish (Week 13-14)
- [ ] Split View 지원
- [ ] User Preferences
- [ ] Performance 최적화
- [ ] Documentation

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| View Mode Switch Time | < 100ms |
| Code ↔ View Sync Latency | < 50ms |
| User Adoption (non-code views) | > 70% for applicable files |
| Plugin Ecosystem | 20+ community view modes in 6 months |

---

---

## 10. Production-First View Modes (Extended)

### 10.1 Web UI Editing Mode

**React/Vue/Svelte 컴포넌트를 Figma처럼 편집:**

```typescript
const WEB_UI_EDITING: ViewModeDefinition = {
  id: "core.web-ui-editing",
  name: "Web UI Editing",
  icon: "layout",
  priority: 20,
  
  matchers: [
    { type: "extension", value: /\.(tsx|jsx|vue|svelte)$/ },
    { type: "export", value: "ReactComponent" },
    { type: "custom", value: (file) => hasUIExport(file) },
  ],
  
  capabilities: {
    twoWaySync: true,
    interactive: true,
    realtime: true,
    splitView: true,
  },
};
```

**UI 구성:**
```
┌─────────────────────────────────────────────────────────────┐
│  [Toolbar] Select | Hand | Text | Box | Component | ...    │
├──────────┬────────────────────────────────┬─────────────────┤
│ Layers   │                                │ Properties      │
│ ──────── │                                │ ────────────    │
│ ▼ Header │    ┌──────────────────┐        │ Component:      │
│   └ Logo │    │   [Selected]     │        │   Header        │
│   └ Nav  │    │   Header         │        │                 │
│ ▼ Main   │    └──────────────────┘        │ Props:          │
│   └ Hero │                                │   title: "..."  │
│   └ ...  │    [Live Rendered UI]          │   variant: ▼    │
│          │                                │                 │
│          │    컴포넌트 직접 클릭/드래그    │ Styles:         │
│          │    Props 실시간 수정            │   padding: 16   │
│          │                                │   margin: 8     │
└──────────┴────────────────────────────────┴─────────────────┘
```

**핵심 기능:**
- 렌더링된 컴포넌트 선택 → 해당 JSX 코드 하이라이트
- Properties Panel에서 Props 수정 → 코드 자동 업데이트
- 드래그 앤 드롭으로 컴포넌트 순서 변경
- Style Inspector (CSS/Tailwind 시각적 편집)

### 10.2 API Spec Editing Mode

**Backend API를 Postman/Apidog처럼 편집:**

```typescript
const API_SPEC_EDITING: ViewModeDefinition = {
  id: "core.api-spec-editing",
  name: "API Spec Editing",
  icon: "server",
  priority: 18,
  
  matchers: [
    { type: "pattern", value: /\/(api|routes|controllers)\/.*\.(ts|js)$/ },
    { type: "export", value: /^(router|app|Elysia|Router)$/ },
    { type: "custom", value: (file) => hasAPIRouteExport(file) },
  ],
  
  capabilities: {
    twoWaySync: true,
    interactive: true,
    realtime: true,
    splitView: true,
  },
};
```

**UI 구성:**
```
┌─────────────────────────────────────────────────────────────┐
│  API Designer - users.ts                                    │
├─────────────────────────────────────────────────────────────┤
│  Routes                                                     │
│  ─────────────────────────────────────────────────────────  │
│  │ GET    │ /api/users          │ List all users   │ [▶]│  │
│  │ POST   │ /api/users          │ Create user      │ [▶]│  │
│  │ GET    │ /api/users/:id      │ Get user by ID   │ [▶]│  │
│  │ PUT    │ /api/users/:id      │ Update user      │ [▶]│  │
│  │ DELETE │ /api/users/:id      │ Delete user      │ [▶]│  │
│  └────────────────────────────────────────────────────────  │
│                                                             │
│  [+ Add Route]                                              │
├─────────────────────────────────────────────────────────────┤
│  Request Builder                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ POST /api/users                                      │   │
│  │ ───────────────────────────────────────────────────  │   │
│  │ Headers:                                             │   │
│  │   Authorization: Bearer [token]                      │   │
│  │   Content-Type: application/json                     │   │
│  │ ───────────────────────────────────────────────────  │   │
│  │ Body (JSON):                                         │   │
│  │   {                                                  │   │
│  │     "name": "John Doe",                             │   │
│  │     "email": "john@example.com"                     │   │
│  │   }                                                  │   │
│  │ ───────────────────────────────────────────────────  │   │
│  │ [Send Request]                    [Generate cURL]    │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Response                                                   │
│  Status: 201 Created  Time: 45ms  Size: 256 bytes          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ { "id": "123", "name": "John Doe", ... }            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**핵심 기능:**
- 라우트 자동 감지 (Express, Fastify, Elysia, Hono 등)
- GUI로 엔드포인트 추가 → 코드 자동 생성
- Request Builder로 즉시 테스트
- Validation Schema 시각적 편집 (Zod, TypeBox)
- OpenAPI Spec 자동 생성/내보내기

### 10.3 CLI Flow Designer Mode

**CLI 애플리케이션을 노드 기반으로 편집:**

```typescript
const CLI_FLOW_DESIGNER: ViewModeDefinition = {
  id: "core.cli-flow-designer",
  name: "CLI Flow Designer",
  icon: "terminal",
  priority: 15,
  
  matchers: [
    { type: "custom", value: (file) => hasCommanderExport(file) },
    { type: "custom", value: (file) => hasInquirerUsage(file) },
    { type: "pattern", value: /\/(cli|commands?)\/.*\.(ts|js)$/ },
  ],
  
  capabilities: {
    twoWaySync: true,
    interactive: true,
    realtime: true,
    splitView: true,
  },
};
```

**UI 구성:**
```
┌─────────────────────────────────────────────────────────────┐
│  CLI Flow Designer - my-cli.ts                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐    ┌───────────────┐    ┌───────────────┐    │
│   │  Start  │───→│    Prompt:    │───→│   Condition:  │    │
│   │         │    │ "Enter name?" │    │  if (name)    │    │
│   └─────────┘    └───────────────┘    └───────┬───────┘    │
│                                           ┌───┴────┐       │
│                                       Yes │        │ No    │
│                                           ▼        ▼       │
│   ┌─────────────────────┐         ┌─────────┐ ┌─────────┐  │
│   │    Prompt:          │         │ Action: │ │ Action: │  │
│   │ "Select framework?" │◀────────│ greet() │ │ exit()  │  │
│   │  ○ React            │         └─────────┘ └─────────┘  │
│   │  ○ Vue              │                                  │
│   │  ○ Svelte           │                                  │
│   └──────────┬──────────┘                                  │
│              │                                              │
│              ▼                                              │
│   ┌─────────────────────┐                                  │
│   │ Action: generate()  │                                  │
│   └─────────────────────┘                                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Terminal Simulation                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ $ my-cli create                                      │   │
│  │ ? Enter your name: John█                             │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**핵심 기능:**
- CLI 흐름 노드 기반 시각화
- Inquirer/prompts 시각적 편집
- Commander/Yargs 옵션 GUI
- 실시간 터미널 시뮬레이션
- 조건 분기 시각화

### 10.4 Additional Production-First Modes

| Mode ID | Name | Matchers | Purpose |
|---------|------|----------|---------|
| `core.database-schema` | Database Schema | `*.prisma`, `*.sql` | Prisma/SQL 스키마 시각화 |
| `core.graphql-designer` | GraphQL Designer | `*.graphql`, `*.gql` | GraphQL 스키마 편집 |
| `core.state-machine` | State Machine | XState 사용 파일 | 상태 머신 시각화 |
| `core.test-explorer` | Test Explorer | `*.test.ts`, `*.spec.ts` | 테스트 러너 통합 |
| `core.config-editor` | Config Editor | `*.config.ts`, `.env` | 설정 시각적 편집 |

---

## 11. Context-Aware Mode Detection

### 11.1 Export Analysis Engine

```rust
pub struct ExportAnalyzer {
    tree: Tree,
    buffer: TextBuffer,
}

impl ExportAnalyzer {
    /// 파일의 모든 export 분석
    pub fn analyze_exports(&self) -> Vec<ExportInfo> {
        let query = r#"
        ; default export
        (export_statement
            "default"
            value: (_) @value) @export_default
        
        ; named export
        (export_statement
            declaration: (function_declaration
                name: (identifier) @name)) @export_named
        
        ; named export (variable)
        (export_statement
            declaration: (lexical_declaration
                (variable_declarator
                    name: (identifier) @name))) @export_named
        "#;
        
        // Tree-sitter 쿼리 실행
        let exports = self.run_query(query);
        
        // 각 export의 타입 추론
        exports.iter().map(|exp| {
            ExportInfo {
                name: exp.name.clone(),
                export_type: self.infer_export_type(exp),
                is_default: exp.is_default,
            }
        }).collect()
    }
    
    /// Export 타입 추론 (React Component, API Route 등)
    fn infer_export_type(&self, export: &Export) -> ExportType {
        let node = export.value_node;
        
        // React Component 감지
        if self.looks_like_react_component(node) {
            return ExportType::ReactComponent;
        }
        
        // API Router 감지
        if self.looks_like_api_router(node) {
            return ExportType::APIRouter;
        }
        
        // CLI Command 감지
        if self.looks_like_cli_command(node) {
            return ExportType::CLICommand;
        }
        
        ExportType::Unknown
    }
    
    fn looks_like_react_component(&self, node: Node) -> bool {
        // JSX 반환하는 함수인지 확인
        // 대문자로 시작하는 함수 이름인지 확인
        // ...
    }
    
    fn looks_like_api_router(&self, node: Node) -> bool {
        // Elysia, Express, Fastify Router 패턴 감지
        // ...
    }
}
```

### 11.2 Mode Matcher Pipeline

```typescript
class ViewModeMatcher {
  private matchers: ViewModeMatcher[] = [];
  
  async matchFile(file: FileInfo): Promise<ViewModeMatch[]> {
    const matches: ViewModeMatch[] = [];
    
    // 1. Extension 매칭 (빠름)
    for (const mode of this.modes) {
      if (this.matchExtension(mode, file)) {
        matches.push({ mode, confidence: 0.5, reason: "extension" });
      }
    }
    
    // 2. Pattern 매칭 (빠름)
    for (const mode of this.modes) {
      if (this.matchPattern(mode, file)) {
        matches.push({ mode, confidence: 0.6, reason: "pattern" });
      }
    }
    
    // 3. Export 분석 (중간)
    const exports = await analyzeExports(file);
    for (const mode of this.modes) {
      if (this.matchExport(mode, exports)) {
        matches.push({ mode, confidence: 0.9, reason: "export" });
      }
    }
    
    // 4. Content 분석 (느림, 필요시만)
    if (matches.length === 0) {
      const content = await readFile(file.path);
      for (const mode of this.modes) {
        if (this.matchContent(mode, content)) {
          matches.push({ mode, confidence: 0.7, reason: "content" });
        }
      }
    }
    
    // 신뢰도 순 정렬
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
}
```

### 11.3 Framework Detection

```typescript
const FRAMEWORK_DETECTORS: FrameworkDetector[] = [
  // React
  {
    id: "react",
    detect: (file, exports) => {
      // JSX 반환하는 함수 또는 React.FC 타입
      return exports.some(e => 
        e.hasJSXReturn || 
        e.type.includes("React.FC") ||
        e.type.includes("React.Component")
      );
    },
    suggestedMode: "core.web-ui-editing",
  },
  
  // Vue
  {
    id: "vue",
    detect: (file) => file.extension === ".vue",
    suggestedMode: "core.web-ui-editing",
  },
  
  // Express/Fastify/Elysia
  {
    id: "express",
    detect: (file, exports, imports) => {
      return imports.some(i => 
        ["express", "fastify", "elysia", "hono", "koa"].includes(i.module)
      );
    },
    suggestedMode: "core.api-spec-editing",
  },
  
  // Commander/Yargs
  {
    id: "commander",
    detect: (file, exports, imports) => {
      return imports.some(i =>
        ["commander", "yargs", "inquirer", "prompts"].includes(i.module)
      );
    },
    suggestedMode: "core.cli-flow-designer",
  },
];
```

---

## 12. Performance Targets (Instant Mode)

### 12.1 Instant Mode: Figma 수준 반응성

**직접 조작 (Critical - 8ms 이내):**

| 동작 | 목표 시간 | 중요도 |
|------|----------|--------|
| 요소 선택 | **< 4ms** | Critical |
| 선택 하이라이트 표시 | **< 4ms** | Critical |
| 요소 드래그 피드백 | **< 8ms** | Critical |
| Properties 값 변경 (UI) | **< 8ms** | Critical |
| Canvas 팬/줌 | **< 8ms** | Critical |
| 호버 피드백 | **< 4ms** | Critical |
| 레이어 순서 변경 (UI) | **< 8ms** | Critical |

**동기화 (Async - 백그라운드):**

| 동작 | 목표 시간 | 처리 방식 |
|------|----------|----------|
| View → Code 동기화 | < 50ms | Debounced |
| Code → View 동기화 | < 100ms | 증분 업데이트 |
| LSP 정보 갱신 | < 100ms | 캐시 우선 |
| HMR/빌드 갱신 | < 200ms | 증분 빌드 |

### 12.2 표준 성능 타겟

| Metric | Target | Notes |
|--------|--------|-------|
| View Mode 전환 | < 100ms | 모듈 캐시 활용 |
| Export 분석 | < 200ms | Tree-sitter |
| Framework 감지 정확도 | > 95% | |
| 사용자 채택률 (Visual Mode) | > 70% | 해당 파일 유형 |
| 플러그인 생태계 | 30+ | 12개월 내 |

### 12.3 Instant Mode 구현 원칙

```typescript
// Instant Mode 원칙
const INSTANT_MODE_RULES = {
  // 1. UI 피드백은 항상 먼저 (Optimistic Update)
  uiFeedbackFirst: true,
  
  // 2. 무거운 연산은 항상 비동기
  heavyOpsAsync: true,
  
  // 3. 상태는 로컬 우선
  localStateFirst: true,
  
  // 4. 동기화는 debounced
  syncDebounced: true,
};

// 예시: Properties 변경
function onPropertyChange(value: string) {
  // Step 1: UI 즉시 업데이트 (< 4ms)
  updateLocalUI(value);
  
  // Step 2: 코드 동기화 (비동기, 50ms debounce)
  debouncedSyncToCode(value);
  
  // Step 3: LSP/빌드 갱신 (백그라운드)
  queueBackgroundUpdate();
}
```

---

## 13. 관련 문서

### 아키텍처
- [editor-engine.md](./editor-engine.md) - AST 엔진
- [ipc-protocol.md](./ipc-protocol.md) - IPC 통신

### 기능 스펙
- [../specs/visual-coding.md](../specs/visual-coding.md) - Visual Coding 기반
- [../specs/comment-system.md](../specs/comment-system.md) - Comment System (Visual Mode 통합)
- [../specs/design-language.md](../specs/design-language.md) - Ferrum Design Language
- [../specs/progressive-disclosure.md](../specs/progressive-disclosure.md) - Progressive Disclosure UX

### 기술 문서
- [../technical/plugin-system.md](../technical/plugin-system.md) - View Mode 플러그인 API

---

## References

- [Figma Plugin System](https://www.figma.com/plugin-docs/)
- [VSCode Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [Observable Framework](https://observablehq.com/framework/)
- [Storybook](https://storybook.js.org/)
- [Postman](https://www.postman.com/)
- [Apidog](https://apidog.com/)
- [Framer](https://www.framer.com/)
