# Plugin System 설계

> **목표**: VSCode 생태계로부터 독립하여, 더 강력한 커스터마이징 API를 제공하는 플러그인 시스템

## 1. 핵심 원칙

- **VSCode 독립**: Microsoft 종속 탈피
- **JavaScript 기반**: 접근성 및 생태계
- **깊은 커스터마이징**: UI/에디터/워크플로우 모두 확장 가능
- **안전한 샌드박싱**: WASM 또는 격리된 런타임
- **타입 안전**: TypeScript 우선 지원

## 2. 런타임 선택: WASM (WebAssembly)

### 2.1 WASM (Wasmtime) 선택 이유

**장점:**
- **최고의 성능**: 네이티브에 근접한 속도로 플러그인 연산 수행
- **언어 중립**: Rust, Go, C++, AssemblyScript 등 다양한 언어로 개발 가능
- **엄격한 샌드박싱**: 메모리 및 리소스 접근을 완벽하게 격리
- **보안**: 권한 기반 API 호출 (Capability-based security)

**단점:**
- JavaScript에 비해 학습 곡선이 있음 (SDK 제공으로 해결)

**결정: WASM (Wasmtime) 기반 런타임**
- 플러그인은 WASM 모듈로 컴파일되어 실행
- Ferrum Host API를 통해 에디터와 통신

---

## 3. Plugin API 설계

### 3.1 API 계층

```typescript
// Level 1: Core APIs (안전, 항상 허용)
ferrum.workspace.openFile(path: string): Promise<Editor>
ferrum.editor.getText(): string
ferrum.editor.insertText(text: string): void
ferrum.diagnostics.add(diagnostic: Diagnostic): void

// Level 2: Extended APIs (권한 필요)
ferrum.fs.readFile(path: string): Promise<string>
ferrum.fs.writeFile(path: string, content: string): Promise<void>
ferrum.process.spawn(command: string): Promise<Process>

// Level 3: UI APIs (강력한 커스터마이징)
ferrum.ui.registerPanel(panel: Panel): void
ferrum.ui.registerCommand(command: Command): void
ferrum.ui.registerTheme(theme: Theme): void
```

### 3.2 Plugin Manifest

```json
{
    "name": "my-plugin",
    "version": "1.0.0",
    "displayName": "My Awesome Plugin",
    "description": "Does something cool",
    "author": "Your Name",

    "engine": {
        "ferrum": "^1.0.0"
    },

    "main": "dist/index.js",

    "permissions": [
        "workspace.read",
        "editor.modify",
        "fs.read",
        "fs.write",
        "network.request"
    ],

    "contributes": {
        "commands": [
            {
                "id": "myPlugin.doSomething",
                "title": "Do Something",
                "keybinding": "Cmd+Shift+D"
            }
        ],
        "themes": [
            {
                "id": "my-dark-theme",
                "label": "My Dark Theme",
                "path": "./themes/dark.json"
            }
        ],
        "languages": [
            {
                "id": "mylang",
                "extensions": [".ml"],
                "configuration": "./language-configuration.json"
            }
        ]
    },

    "dependencies": {
        "lodash": "^4.17.21"
    }
}
```

---

## 4. 실행 환경

### 4.1 Rust → WASM (Wasmtime) 통합

```rust
use wasmtime::*;

pub struct PluginRuntime {
    engine: Engine,
    linker: Linker<PluginState>,
    store: Store<PluginState>,
    instance: Instance,
}

impl PluginRuntime {
    pub fn new(wasm_bytes: &[u8], plugin_id: PluginId) -> Result<Self> {
        let engine = Engine::default();
        let mut linker = Linker::new(&engine);
        
        // Host API 등록
        linker.func_wrap("ferrum", "open_file", |mut caller: Caller<'_, PluginState>, path: String| {
            plugin_workspace_open_file(&mut caller.data_mut(), path)
        })?;

        let mut store = Store::new(&engine, PluginState::new(plugin_id));
        let module = Module::from_binary(&engine, wasm_bytes)?;
        let instance = linker.instantiate(&mut store, &module)?;

        Ok(PluginRuntime {
            engine,
            linker,
            store,
            instance,
        })
    }

    pub fn execute_function(&mut self, function_name: &str) -> Result<()> {
        let func = self.instance.get_typed_func::<(), ()>(&mut self.store, function_name)?;
        func.call(&mut self.store, ())?;
        Ok(())
    }
}
```

### 4.2 권한 시스템

```rust
pub struct PermissionManager {
    granted_permissions: HashMap<PluginId, HashSet<Permission>>,
}

pub enum Permission {
    WorkspaceRead,
    WorkspaceWrite,
    EditorRead,
    EditorModify,
    FileSystemRead,
    FileSystemWrite,
    NetworkRequest,
    ProcessSpawn,
}

impl PermissionManager {
    pub fn check_permission(&self, plugin_id: PluginId, perm: Permission) -> bool {
        self.granted_permissions
            .get(&plugin_id)
            .map(|perms| perms.contains(&perm))
            .unwrap_or(false)
    }

    pub fn request_permission(&mut self, plugin_id: PluginId, perm: Permission) -> bool {
        // 사용자에게 권한 요청 (UI 다이얼로그)
        if self.show_permission_dialog(plugin_id, perm) {
            self.granted_permissions
                .entry(plugin_id)
                .or_insert_with(HashSet::new)
                .insert(perm);
            true
        } else {
            false
        }
    }
}
```

---

## 5. Plugin API 구현 예시

### 5.1 Editor API

```typescript
// Plugin TypeScript Definitions
declare namespace ferrum {
    namespace editor {
        function getText(): string;
        function insertText(text: string, position?: Position): void;
        function replaceRange(range: Range, text: string): void;
        function getSelection(): Selection[];
        function setSelection(selection: Selection[]): void;

        function onTextChange(callback: (event: TextChangeEvent) => void): Disposable;
        function onSelectionChange(callback: (event: SelectionChangeEvent) => void): Disposable;
    }
}

// Rust Implementation
fn plugin_editor_insert_text(plugin_id: PluginId, text: String, position: Option<Position>) -> Result<()> {
    // 권한 확인
    if !permission_manager.check_permission(plugin_id, Permission::EditorModify) {
        return Err(Error::PermissionDenied);
    }

    // 에디터 찾기
    let editor = app_state.get_active_editor()?;

    // 텍스트 삽입
    let pos = position.unwrap_or_else(|| editor.cursor_position());
    editor.insert_at(pos, &text);

    Ok(())
}
```

### 5.2 UI API

```typescript
// Plugin Code
ferrum.ui.registerPanel({
    id: 'my-panel',
    title: 'My Panel',
    position: 'left',
    render: () => {
        return `
            <div>
                <h2>My Custom Panel</h2>
                <button onclick="doSomething()">Click Me</button>
            </div>
        `;
    }
});

// Rust Implementation
fn plugin_ui_register_panel(plugin_id: PluginId, panel: PanelDefinition) -> Result<()> {
    // HTML 렌더링 (샌드박스 iframe 또는 컴포넌트)
    let panel_view = PanelView::new(panel);

    app_state.workspace.add_panel(panel_view);

    Ok(())
}
```

---

## 6. 디버깅 지원

```typescript
// Plugin 내에서
ferrum.debug.log('Hello from plugin');
ferrum.debug.warn('Something might be wrong');
ferrum.debug.error('Error occurred');

// Rust
fn plugin_debug_log(plugin_id: PluginId, level: LogLevel, message: String) {
    log::log!(
        target: &format!("plugin:{}", plugin_id),
        level.to_log_level(),
        "{}",
        message
    );

    // Plugin Console Panel로 전송
    app_state.plugin_console.append(plugin_id, level, message);
}
```

---

## 7. 마켓플레이스

### 7.1 플러그인 배포

```bash
# Build
ferrum-plugin build

# Package
ferrum-plugin package

# Publish
ferrum-plugin publish --token YOUR_TOKEN
```

### 7.2 플러그인 설치

```bash
# CLI
ferrum plugin install plugin-name

# UI
[Extensions Panel] → Search → Install
```

---

## 8. 구현 로드맵

### Phase 1: 런타임 (Week 1-2)
- [ ] QuickJS 통합
- [ ] 기본 API 주입
- [ ] 권한 시스템

### Phase 2: Core APIs (Week 2-4)
- [ ] Editor API
- [ ] Workspace API
- [ ] FileSystem API

### Phase 3: UI APIs (Week 4-6)
- [ ] Panel 등록
- [ ] Command 등록
- [ ] Theme 등록

### Phase 4: 마켓플레이스 (Week 6-8)
- [ ] 플러그인 빌드 도구
- [ ] 마켓플레이스 백엔드
- [ ] 설치/업데이트 시스템

---

## 참고 자료

- [QuickJS](https://bellard.org/quickjs/)
- [rquickjs (Rust bindings)](https://github.com/DelSkayn/rquickjs)
- [Zed Extension System](https://github.com/zed-industries/zed/tree/main/crates/extension)
- [VSCode Extension API](https://code.visualstudio.com/api/references/vscode-api)
