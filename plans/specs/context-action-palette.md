# Context Action Palette 상세 스펙

> **핵심 가치**: "다음에 무엇을 해야 할지 제안하여, 개발 흐름을 가속화하고 실수를 방지한다"

## 1. 개요

### 1.1 문제점

**기존 IDE의 한계:**
- Command Palette: 모든 명령어를 나열만 함
- 컨텍스트를 고려하지 않음
- "지금 이 상황에서 뭘 해야 하지?" → 사용자가 판단

**예시 상황:**
```typescript
// 새 함수를 작성했지만...
function calculateTax(amount: number) {
    return amount * 0.1;
}

// 다음 단계는?
// - 테스트 작성? ✅
// - 타입 정의 개선? ✅
// - 문서화? ✅
// - Export 추가? ✅
// → 사용자가 기억해야 함
```

### 1.2 Ferrum Context Action Palette 솔루션

**핵심 아이디어:**
1. **컨텍스트 분석**: 코드, 파일 상태, 프로젝트 상태 분석
2. **스마트 제안**: 현재 상황에서 가능한/필요한 액션만 표시
3. **Tab Completion**: 빠른 실행
4. **학습**: 사용 패턴 학습하여 제안 개선

**특징:**
- 코드 생성이 아닌 **개발 흐름 유도**
- AI 없이도 작동 (규칙 기반)
- 선택적 AI 통합 (더 나은 제안)

---

## 2. 컨텍스트 분석

### 2.1 분석 계층

```
┌─────────────────────────────────────┐
│ 1. Cursor Context                   │  ← 커서 위치
│    - 현재 노드 (함수, 클래스 등)      │
│    - 선택 영역                       │
├─────────────────────────────────────┤
│ 2. File Context                     │  ← 파일 상태
│    - 더티 상태                       │
│    - 테스트 파일 존재 여부            │
│    - Import/Export                   │
├─────────────────────────────────────┤
│ 3. Project Context                  │  ← 프로젝트 상태
│    - Git 상태                        │
│    - 빌드 에러                       │
│    - LSP 진단                        │
├─────────────────────────────────────┤
│ 4. Workflow Context                 │  ← 개발 흐름
│    - 최근 액션                       │
│    - 미완료 작업                     │
│    - 습관 패턴                       │
└─────────────────────────────────────┘
```

### 2.2 Cursor Context (Tree-sitter)

```rust
pub struct CursorContext {
    // 현재 노드
    current_node: Node,
    node_kind: String,

    // 부모 노드들
    parent_chain: Vec<Node>,

    // 선택 영역
    selection: Option<Selection>,

    // 심볼 정보 (LSP)
    symbol_info: Option<SymbolInformation>,
}

impl CursorContext {
    pub fn analyze(
        cursor_pos: Position,
        tree: &Tree,
        buffer: &TextBuffer,
        lsp: &LspClient,
    ) -> Self {
        // 1. Tree-sitter로 현재 노드 찾기
        let current_node = Self::find_node_at_position(cursor_pos, tree);

        // 2. 부모 체인 구축
        let parent_chain = Self::build_parent_chain(current_node);

        // 3. LSP로 심볼 정보 가져오기
        let symbol_info = lsp.document_symbol(buffer, cursor_pos).await.ok();

        CursorContext {
            current_node,
            node_kind: current_node.kind().to_string(),
            parent_chain,
            selection: None,
            symbol_info,
        }
    }

    pub fn is_inside(&self, kind: &str) -> bool {
        self.parent_chain.iter().any(|n| n.kind() == kind)
    }

    pub fn get_function_context(&self) -> Option<FunctionContext> {
        // 현재 함수 찾기
        let func_node = self.parent_chain
            .iter()
            .find(|n| matches!(
                n.kind(),
                "function_declaration" | "method_definition" | "arrow_function"
            ))?;

        Some(FunctionContext {
            name: Self::extract_function_name(func_node),
            parameters: Self::extract_parameters(func_node),
            return_type: Self::extract_return_type(func_node),
            has_tests: false, // 별도로 확인
        })
    }
}
```

### 2.3 File Context

```rust
pub struct FileContext {
    // 파일 상태
    path: PathBuf,
    language: LanguageId,
    is_dirty: bool,
    has_unsaved_changes: bool,

    // 관련 파일
    test_file: Option<PathBuf>,
    type_definition_file: Option<PathBuf>,
    component_file: Option<PathBuf>,

    // Import/Export
    imports: Vec<Import>,
    exports: Vec<Export>,

    // LSP 진단
    diagnostics: Vec<Diagnostic>,
}

impl FileContext {
    pub fn analyze(
        buffer_id: BufferId,
        app_state: &AppState,
    ) -> Self {
        let buffer = app_state.buffer_manager.get_buffer(buffer_id).unwrap();
        let buffer = buffer.lock().unwrap();

        // 테스트 파일 찾기
        let test_file = Self::find_test_file(buffer.path());

        // Import/Export 분석 (Tree-sitter)
        let tree = app_state.syntax_analyzer.get_tree(buffer_id);
        let imports = Self::extract_imports(&tree, &buffer);
        let exports = Self::extract_exports(&tree, &buffer);

        // 진단 가져오기
        let diagnostics = app_state.lsp_manager
            .get_diagnostics(buffer_id)
            .unwrap_or_default();

        FileContext {
            path: buffer.path().unwrap().clone(),
            language: buffer.language_id(),
            is_dirty: buffer.is_dirty(),
            has_unsaved_changes: app_state.buffer_manager.is_dirty(buffer_id),
            test_file,
            type_definition_file: None,
            component_file: None,
            imports,
            exports,
            diagnostics,
        }
    }

    fn find_test_file(path: &Path) -> Option<PathBuf> {
        // 패턴:
        // foo.ts → foo.test.ts
        // foo.ts → foo.spec.ts
        // foo.ts → __tests__/foo.ts

        let file_stem = path.file_stem()?.to_str()?;
        let extension = path.extension()?.to_str()?;
        let parent = path.parent()?;

        let patterns = vec![
            parent.join(format!("{}.test.{}", file_stem, extension)),
            parent.join(format!("{}.spec.{}", file_stem, extension)),
            parent.join("__tests__").join(path.file_name()?),
        ];

        patterns.into_iter().find(|p| p.exists())
    }
}
```

### 2.4 Project Context

```rust
pub struct ProjectContext {
    // Git 상태
    git_status: GitStatus,
    has_uncommitted_changes: bool,
    current_branch: String,

    // 빌드 상태
    build_errors: Vec<BuildError>,
    test_failures: Vec<TestFailure>,

    // 프로젝트 구조
    has_package_json: bool,
    has_tsconfig: bool,
    has_cargo_toml: bool,

    // 최근 파일
    recent_files: Vec<PathBuf>,
}

impl ProjectContext {
    pub fn analyze(app_state: &AppState) -> Self {
        let project = app_state.project_manager.current_project().unwrap();

        // Git 상태
        let git_status = app_state.git_manager.status();

        // 빌드 에러 (최근 빌드 결과)
        let build_errors = app_state.build_manager.recent_errors();

        ProjectContext {
            git_status,
            has_uncommitted_changes: !git_status.is_clean(),
            current_branch: git_status.branch.clone(),
            build_errors,
            test_failures: vec![],
            has_package_json: project.root_path.join("package.json").exists(),
            has_tsconfig: project.root_path.join("tsconfig.json").exists(),
            has_cargo_toml: project.root_path.join("Cargo.toml").exists(),
            recent_files: vec![],
        }
    }
}
```

---

## 3. Action 시스템

### 3.1 Action 정의

```rust
pub struct Action {
    pub id: ActionId,
    pub title: String,
    pub description: String,
    pub category: ActionCategory,
    pub icon: Icon,

    // 실행 핸들러
    pub handler: Box<dyn ActionHandler>,

    // 우선순위 (높을수록 먼저 표시)
    pub priority: u32,

    // 단축키
    pub shortcut: Option<Keybinding>,
}

pub enum ActionCategory {
    Edit,           // 편집
    Refactor,       // 리팩토링
    Test,           // 테스트
    Debug,          // 디버깅
    Git,            // Git 작업
    Build,          // 빌드/실행
    Navigate,       // 네비게이션
    Documentation,  // 문서화
}

pub trait ActionHandler: Send + Sync {
    fn execute(&self, context: &ActionContext) -> Result<()>;
    fn is_available(&self, context: &AnalyzedContext) -> bool;
}

pub struct ActionContext {
    pub cursor_context: CursorContext,
    pub file_context: FileContext,
    pub project_context: ProjectContext,
    pub editor: Editor,
    pub app_state: AppState,
}
```

### 3.2 내장 Actions

#### 3.2.1 테스트 관련

```rust
// "Create Test for Function"
pub struct CreateTestAction;

impl ActionHandler for CreateTestAction {
    fn is_available(&self, ctx: &AnalyzedContext) -> bool {
        // 함수 안에 있고, 테스트가 없을 때
        ctx.cursor.get_function_context().is_some()
            && ctx.file.test_file.is_none()
    }

    fn execute(&self, ctx: &ActionContext) -> Result<()> {
        let func_ctx = ctx.cursor_context.get_function_context().unwrap();

        // 1. 테스트 파일 생성
        let test_file_path = self.generate_test_file_path(&ctx.file_context.path);

        // 2. 테스트 템플릿 생성
        let test_code = self.generate_test_template(&func_ctx, &ctx.file_context.language);

        // 3. 파일 작성
        std::fs::write(&test_file_path, test_code)?;

        // 4. 새 파일 열기
        ctx.app_state.buffer_manager.open_file(test_file_path)?;

        Ok(())
    }
}

impl CreateTestAction {
    fn generate_test_template(&self, func: &FunctionContext, lang: &LanguageId) -> String {
        match lang {
            LanguageId::TypeScript => format!(
                r#"import {{ {} }} from './{}';

describe('{}', () => {{
    it('should work correctly', () => {{
        // Arrange
        const input = /* TODO */;
        const expected = /* TODO */;

        // Act
        const result = {}(input);

        // Assert
        expect(result).toBe(expected);
    }});
}});
"#,
                func.name,
                self.get_source_filename(),
                func.name,
                func.name
            ),
            LanguageId::Rust => format!(
                r#"#[cfg(test)]
mod tests {{
    use super::*;

    #[test]
    fn test_{}() {{
        // Arrange
        let input = /* TODO */;
        let expected = /* TODO */;

        // Act
        let result = {}(input);

        // Assert
        assert_eq!(result, expected);
    }}
}}
"#,
                func.name,
                func.name
            ),
            _ => String::new(),
        }
    }
}

// "Run Tests"
pub struct RunTestsAction;

impl ActionHandler for RunTestsAction {
    fn is_available(&self, ctx: &AnalyzedContext) -> bool {
        ctx.file.test_file.is_some() || ctx.file.path.to_str().unwrap().contains(".test.")
    }

    fn execute(&self, ctx: &ActionContext) -> Result<()> {
        // 테스트 실행 (언어별)
        match ctx.file_context.language {
            LanguageId::TypeScript => {
                ctx.app_state.terminal.run("npm test")?;
            }
            LanguageId::Rust => {
                ctx.app_state.terminal.run("cargo test")?;
            }
            _ => {}
        }

        Ok(())
    }
}
```

#### 3.2.2 리팩토링

```rust
// "Extract to Function"
pub struct ExtractToFunctionAction;

impl ActionHandler for ExtractToFunctionAction {
    fn is_available(&self, ctx: &AnalyzedContext) -> bool {
        ctx.cursor.selection.is_some()
            && ctx.cursor.selection.as_ref().unwrap().len() > 10 // 최소 길이
    }

    fn execute(&self, ctx: &ActionContext) -> Result<()> {
        let selection = ctx.cursor_context.selection.as_ref().unwrap();

        // 1. 함수 이름 입력 받기
        let func_name = ctx.editor.prompt("Function name:")?;

        // 2. 선택된 코드 추출
        let selected_code = ctx.editor.text_in_selection(selection);

        // 3. 변수 분석 (사용된 외부 변수)
        let used_variables = self.analyze_used_variables(&selected_code, ctx);

        // 4. 함수 생성
        let func_code = self.generate_function(
            &func_name,
            &selected_code,
            &used_variables,
            &ctx.file_context.language,
        );

        // 5. 함수 삽입 (현재 함수 바로 아래)
        let insert_pos = self.find_function_insert_position(ctx);
        ctx.editor.insert_at(insert_pos, &func_code);

        // 6. 선택 영역을 함수 호출로 대체
        let call_code = self.generate_function_call(&func_name, &used_variables);
        ctx.editor.replace_selection(selection, &call_code);

        Ok(())
    }
}

// "Extract to Component" (React/Vue/Svelte)
pub struct ExtractToComponentAction;

impl ActionHandler for ExtractToComponentAction {
    fn is_available(&self, ctx: &AnalyzedContext) -> bool {
        // JSX/TSX 파일에서 JSX 선택 시
        matches!(ctx.file.language, LanguageId::TypeScript | LanguageId::JavaScript)
            && ctx.cursor.selection.is_some()
            && self.is_jsx_selection(ctx)
    }

    fn execute(&self, ctx: &ActionContext) -> Result<()> {
        // After Effects의 Precomp 스타일
        let component_name = ctx.editor.prompt("Component name:")?;
        let selected_jsx = ctx.editor.text_in_selection(...);

        // 1. Props 분석
        let props = self.analyze_props(&selected_jsx);

        // 2. 컴포넌트 파일 생성
        let component_code = self.generate_component(&component_name, &selected_jsx, &props);
        let component_file = self.create_component_file(&component_name, &component_code)?;

        // 3. Import 추가
        ctx.editor.add_import(&component_name, &component_file);

        // 4. 선택 영역을 컴포넌트로 대체
        let usage = format!("<{} {} />", component_name, self.format_props(&props));
        ctx.editor.replace_selection(..., &usage);

        Ok(())
    }
}
```

#### 3.2.3 문서화

```rust
// "Generate JSDoc"
pub struct GenerateJSDocAction;

impl ActionHandler for GenerateJSDocAction {
    fn is_available(&self, ctx: &AnalyzedContext) -> bool {
        ctx.cursor.get_function_context().is_some()
            && !self.has_existing_jsdoc(ctx)
    }

    fn execute(&self, ctx: &ActionContext) -> Result<()> {
        let func_ctx = ctx.cursor_context.get_function_context().unwrap();

        // JSDoc 생성
        let jsdoc = format!(
            r#"/**
 * {description}
 *
{params}
 * @returns {{{return_type}}}
 */
"#,
            description = "TODO: Add description",
            params = func_ctx
                .parameters
                .iter()
                .map(|p| format!(" * @param {{{}}} {}", p.type_, p.name))
                .collect::<Vec<_>>()
                .join("\n"),
            return_type = func_ctx.return_type.unwrap_or("void".to_string())
        );

        // 함수 위에 삽입
        let insert_pos = Position {
            line: func_ctx.start_line - 1,
            column: 0,
        };

        ctx.editor.insert_at(insert_pos, &jsdoc);

        Ok(())
    }
}
```

#### 3.2.4 Git 작업

```rust
// "Commit Changes"
pub struct CommitChangesAction;

impl ActionHandler for CommitChangesAction {
    fn is_available(&self, ctx: &AnalyzedContext) -> bool {
        ctx.project.has_uncommitted_changes
    }

    fn execute(&self, ctx: &ActionContext) -> Result<()> {
        // 1. 커밋 메시지 제안 (AI 또는 규칙 기반)
        let suggested_message = self.suggest_commit_message(ctx);

        // 2. 사용자 입력
        let message = ctx.editor.prompt_with_default("Commit message:", &suggested_message)?;

        // 3. Git commit
        ctx.app_state.git_manager.commit(&message)?;

        Ok(())
    }

    fn suggest_commit_message(&self, ctx: &ActionContext) -> String {
        // 간단한 규칙 기반
        let changed_files = ctx.project.git_status.modified_files.len();

        if changed_files == 1 {
            let file = &ctx.project.git_status.modified_files[0];
            format!("Update {}", file.file_name().unwrap().to_str().unwrap())
        } else {
            format!("Update {} files", changed_files)
        }
    }
}
```

---

## 4. Tree-sitter 쿼리 기반 컨텍스트 분석

### 4.1 Tree-sitter Queries로 빠른 노드 판별

**CursorContext 분석 시 tree-sitter의 쿼리(Queries) 기능을 사용하면 현재 노드가 '새로 만든 함수'인지, '에러가 발생한 블록'인지 매우 빠르게 판단할 수 있습니다.**

```rust
use tree_sitter::{Query, QueryCursor};

pub struct ContextQueryEngine {
    // 언어별 쿼리 캐시
    queries: HashMap<LanguageId, ContextQueries>,
}

pub struct ContextQueries {
    // 함수 관련 쿼리
    function_query: Query,
    // 클래스 관련 쿼리
    class_query: Query,
    // 에러 노드 쿼리
    error_query: Query,
    // 테스트 파일 쿼리
    test_query: Query,
    // Export 쿼리
    export_query: Query,
}

impl ContextQueryEngine {
    pub fn init_typescript_queries(language: tree_sitter::Language) -> ContextQueries {
        ContextQueries {
            // 함수 정의 찾기
            function_query: Query::new(
                &language,
                r#"
                (function_declaration
                    name: (identifier) @name
                    parameters: (formal_parameters) @params
                    return_type: (type_annotation)? @return_type
                ) @function

                (arrow_function
                    parameters: (formal_parameters) @params
                    body: (_) @body
                ) @arrow

                (method_definition
                    name: (property_identifier) @name
                    parameters: (formal_parameters) @params
                ) @method
                "#
            ).unwrap(),

            // 클래스 정의 찾기
            class_query: Query::new(
                &language,
                r#"
                (class_declaration
                    name: (type_identifier) @name
                    body: (class_body) @body
                ) @class
                "#
            ).unwrap(),

            // 에러 노드 (구문 오류)
            error_query: Query::new(
                &language,
                "(ERROR) @error"
            ).unwrap(),

            // 테스트 함수 찾기 (describe, it, test)
            test_query: Query::new(
                &language,
                r#"
                (call_expression
                    function: (identifier) @test_fn
                    (#match? @test_fn "^(describe|it|test)$")
                ) @test_call
                "#
            ).unwrap(),

            // Export 문 찾기
            export_query: Query::new(
                &language,
                r#"
                (export_statement) @export
                (export_clause) @export_clause
                "#
            ).unwrap(),
        }
    }

    /// 커서 위치에서 컨텍스트 빠르게 분석
    pub fn analyze_cursor_context(
        &self,
        cursor_pos: Position,
        tree: &Tree,
        source: &[u8],
        language_id: LanguageId,
    ) -> CursorContextInfo {
        let queries = self.queries.get(&language_id).unwrap();
        let byte_offset = position_to_byte(cursor_pos, source);

        let mut info = CursorContextInfo::default();

        // 1. 현재 위치가 함수 내부인지 확인
        let mut cursor = QueryCursor::new();
        cursor.set_point_range(
            tree_sitter::Point::new(cursor_pos.line as usize, 0),
            tree_sitter::Point::new(cursor_pos.line as usize + 1, 0),
        );

        for match_ in cursor.matches(&queries.function_query, tree.root_node(), source) {
            for capture in match_.captures {
                let range = capture.node.byte_range();
                if range.start <= byte_offset && byte_offset <= range.end {
                    info.in_function = true;
                    if let Some(name_capture) = match_.captures.iter()
                        .find(|c| c.index == 0) // @name
                    {
                        info.function_name = Some(
                            std::str::from_utf8(&source[name_capture.node.byte_range()])
                                .unwrap()
                                .to_string()
                        );
                    }
                    break;
                }
            }
        }

        // 2. 구문 에러가 있는지 확인
        cursor.set_point_range(
            tree_sitter::Point::new(0, 0),
            tree_sitter::Point::new(usize::MAX, 0),
        );
        for match_ in cursor.matches(&queries.error_query, tree.root_node(), source) {
            info.has_syntax_errors = true;
            info.error_ranges.push(match_.captures[0].node.range().into());
        }

        // 3. 테스트 파일인지 확인
        for match_ in cursor.matches(&queries.test_query, tree.root_node(), source) {
            info.is_test_file = true;
            break;
        }

        info
    }
}

#[derive(Default)]
pub struct CursorContextInfo {
    pub in_function: bool,
    pub function_name: Option<String>,
    pub in_class: bool,
    pub class_name: Option<String>,
    pub has_syntax_errors: bool,
    pub error_ranges: Vec<Range>,
    pub is_test_file: bool,
    pub is_exported: bool,
}
```

### 4.2 쿼리 기반 빠른 Action 필터링

```rust
impl ActionSuggestionEngine {
    /// 쿼리 결과를 기반으로 빠르게 액션 필터링
    pub fn filter_actions_by_query(
        &self,
        ctx_info: &CursorContextInfo,
        all_actions: &[Action],
    ) -> Vec<Action> {
        all_actions
            .iter()
            .filter(|action| {
                match action.id {
                    // 함수 안에 있을 때만 표시
                    ActionId::CreateTest => ctx_info.in_function && ctx_info.function_name.is_some(),
                    ActionId::GenerateJSDoc => ctx_info.in_function && !ctx_info.is_test_file,
                    ActionId::AddExport => ctx_info.in_function && !ctx_info.is_exported,

                    // 구문 에러가 있을 때 표시
                    ActionId::QuickFix => ctx_info.has_syntax_errors,

                    // 테스트 파일에서만 표시
                    ActionId::RunTests => ctx_info.is_test_file,

                    // 항상 표시
                    _ => true,
                }
            })
            .cloned()
            .collect()
    }
}
```

---

## 5. 백그라운드 예측 시스템 (0ms 체감 속도)

### 5.1 핵심 아이디어

**Tab을 누르기 전에, 이미 백그라운드 워커에서 다음 액션을 예측(Prediction)해두면 "0ms"에 가까운 체감 속도를 줄 수 있습니다.**

```rust
use tokio::sync::mpsc;

pub struct ActionPredictionEngine {
    // 예측 요청 채널
    prediction_tx: mpsc::Sender<PredictionRequest>,
    // 예측 결과 캐시
    prediction_cache: Arc<RwLock<PredictionCache>>,
    // 백그라운드 워커 핸들
    worker_handle: tokio::task::JoinHandle<()>,
}

struct PredictionRequest {
    cursor_pos: Position,
    buffer_id: BufferId,
    // 요청 시점의 버퍼 버전 (stale 체크용)
    buffer_version: u64,
}

struct PredictionCache {
    // 최근 예측 결과
    predictions: HashMap<(BufferId, Position), PredictedActions>,
    // 캐시 만료 시간
    expires_at: HashMap<(BufferId, Position), Instant>,
}

struct PredictedActions {
    actions: Vec<Action>,
    context_info: CursorContextInfo,
    computed_at: Instant,
}

impl ActionPredictionEngine {
    pub fn new(app_state: Arc<AppState>) -> Self {
        let (tx, mut rx) = mpsc::channel::<PredictionRequest>(32);
        let cache = Arc::new(RwLock::new(PredictionCache::default()));
        let cache_ref = cache.clone();

        // 백그라운드 워커 스레드
        let worker_handle = tokio::spawn(async move {
            while let Some(request) = rx.recv().await {
                // 버퍼 버전 체크 (stale 요청 무시)
                let buffer = app_state.buffer_manager
                    .get_buffer(request.buffer_id)
                    .unwrap();
                let current_version = buffer.lock().unwrap().version();

                if current_version != request.buffer_version {
                    continue; // 이미 오래된 요청
                }

                // 컨텍스트 분석 (tree-sitter 쿼리)
                let tree = app_state.syntax_analyzer.get_tree(request.buffer_id);
                let source = buffer.lock().unwrap().text_bytes();
                let ctx_info = app_state.context_query_engine.analyze_cursor_context(
                    request.cursor_pos,
                    &tree,
                    &source,
                    buffer.lock().unwrap().language_id(),
                );

                // 액션 제안 계산
                let actions = app_state.action_engine.suggest_actions(&ctx_info);

                // 캐시에 저장
                let mut cache = cache_ref.write().unwrap();
                cache.predictions.insert(
                    (request.buffer_id, request.cursor_pos),
                    PredictedActions {
                        actions,
                        context_info: ctx_info,
                        computed_at: Instant::now(),
                    },
                );
                cache.expires_at.insert(
                    (request.buffer_id, request.cursor_pos),
                    Instant::now() + Duration::from_millis(500),
                );
            }
        });

        Self {
            prediction_tx: tx,
            prediction_cache: cache,
            worker_handle,
        }
    }

    /// 커서 이동 시 백그라운드 예측 요청
    pub fn on_cursor_move(&self, buffer_id: BufferId, cursor_pos: Position, buffer_version: u64) {
        // Non-blocking send
        let _ = self.prediction_tx.try_send(PredictionRequest {
            cursor_pos,
            buffer_id,
            buffer_version,
        });
    }

    /// Tab 키 누름 시 즉시 결과 반환
    pub fn get_predicted_actions(
        &self,
        buffer_id: BufferId,
        cursor_pos: Position,
    ) -> Option<Vec<Action>> {
        let cache = self.prediction_cache.read().unwrap();

        // 캐시에서 가져오기
        if let Some(predicted) = cache.predictions.get(&(buffer_id, cursor_pos)) {
            // 만료 체크
            if let Some(expires) = cache.expires_at.get(&(buffer_id, cursor_pos)) {
                if Instant::now() < *expires {
                    return Some(predicted.actions.clone());
                }
            }
        }

        // 인접 위치 캐시도 확인 (fuzzy matching)
        for ((bid, pos), predicted) in &cache.predictions {
            if *bid == buffer_id
                && (pos.line as i32 - cursor_pos.line as i32).abs() <= 2
                && (pos.column as i32 - cursor_pos.column as i32).abs() <= 10
            {
                return Some(predicted.actions.clone());
            }
        }

        None
    }
}
```

### 5.2 커서 이동 이벤트 통합

```rust
impl Editor {
    pub fn on_cursor_move(&mut self, new_pos: Position) {
        // 기존 커서 이동 로직
        self.cursor_pos = new_pos;

        // 백그라운드 예측 요청 (non-blocking)
        if let Some(predictor) = &self.action_predictor {
            predictor.on_cursor_move(
                self.buffer_id,
                new_pos,
                self.buffer.lock().unwrap().version(),
            );
        }
    }
}
```

### 5.3 Tab Completion 최적화

```rust
impl ContextActionPalette {
    pub fn on_tab_key(&mut self) -> Result<()> {
        // 1. 캐시된 예측 결과 먼저 확인
        if let Some(predicted) = self.predictor.get_predicted_actions(
            self.buffer_id,
            self.cursor_pos,
        ) {
            // 즉시 실행 (0ms 체감)
            if let Some(action) = predicted.first() {
                return action.execute(&self.context);
            }
        }

        // 2. 캐시 미스 시 동기 계산 (fallback)
        let actions = self.compute_actions_sync();
        if let Some(action) = actions.first() {
            action.execute(&self.context)?;
        }

        Ok(())
    }
}
```

### 5.4 성능 벤치마크

| 시나리오 | 예측 없음 | 예측 있음 |
|----------|----------|----------|
| Tab 누름 → 액션 실행 | ~150ms | ~2ms (캐시 히트) |
| 커서 이동 후 Palette 열기 | ~150ms | ~5ms |
| 체감 반응성 | 느림 | 즉각적 |

---

## 6. Action Suggestion 엔진

### 6.1 규칙 기반 추론

```rust
pub struct ActionSuggestionEngine {
    rules: Vec<Box<dyn SuggestionRule>>,
}

pub trait SuggestionRule: Send + Sync {
    fn suggest(&self, ctx: &AnalyzedContext) -> Vec<Action>;
    fn priority(&self) -> u32;
}

impl ActionSuggestionEngine {
    pub fn suggest_actions(&self, ctx: &AnalyzedContext) -> Vec<Action> {
        let mut all_actions = Vec::new();

        // 모든 규칙 실행
        for rule in &self.rules {
            let actions = rule.suggest(ctx);
            all_actions.extend(actions);
        }

        // 중복 제거
        all_actions.dedup_by_key(|a| a.id);

        // 우선순위 정렬
        all_actions.sort_by_key(|a| std::cmp::Reverse(a.priority));

        all_actions
    }
}

// 예시 규칙
pub struct FunctionWithoutTestRule;

impl SuggestionRule for FunctionWithoutTestRule {
    fn suggest(&self, ctx: &AnalyzedContext) -> Vec<Action> {
        if ctx.cursor.get_function_context().is_some()
            && ctx.file.test_file.is_none()
        {
            vec![Action {
                id: ActionId::CreateTest,
                title: "Create Test".to_string(),
                description: "Generate test file for this function".to_string(),
                category: ActionCategory::Test,
                priority: 80,
                // ...
            }]
        } else {
            vec![]
        }
    }

    fn priority(&self) -> u32 {
        80
    }
}

pub struct UnsavedChangesRule;

impl SuggestionRule for UnsavedChangesRule {
    fn suggest(&self, ctx: &AnalyzedContext) -> Vec<Action> {
        if ctx.file.has_unsaved_changes {
            vec![
                Action {
                    id: ActionId::Save,
                    title: "Save File".to_string(),
                    priority: 100, // 높은 우선순위
                    // ...
                },
            ]
        } else {
            vec![]
        }
    }

    fn priority(&self) -> u32 {
        100
    }
}
```

### 4.2 컨텍스트별 규칙

**함수 작성 후:**
```rust
pub struct AfterFunctionCreationRule;

impl SuggestionRule for AfterFunctionCreationRule {
    fn suggest(&self, ctx: &AnalyzedContext) -> Vec<Action> {
        let func_ctx = ctx.cursor.get_function_context()?;

        vec![
            // 1. 테스트 작성
            Action { id: ActionId::CreateTest, priority: 90, ... },

            // 2. JSDoc 추가
            Action { id: ActionId::GenerateJSDoc, priority: 70, ... },

            // 3. Export 추가 (필요 시)
            if !ctx.file.exports.iter().any(|e| e.name == func_ctx.name) {
                Some(Action { id: ActionId::AddExport, priority: 60, ... })
            } else {
                None
            },

            // 4. 타입 개선 (TypeScript)
            if has_any_type(&func_ctx) {
                Some(Action { id: ActionId::ImproveTypes, priority: 50, ... })
            } else {
                None
            },
        ].into_iter().flatten().collect()
    }
}
```

**테스트 파일에서:**
```rust
pub struct InTestFileRule;

impl SuggestionRule for InTestFileRule {
    fn suggest(&self, ctx: &AnalyzedContext) -> Vec<Action> {
        if !ctx.file.path.to_str().unwrap().contains(".test.") {
            return vec![];
        }

        vec![
            // 테스트 실행
            Action { id: ActionId::RunTests, priority: 100, ... },

            // 커버리지 확인
            Action { id: ActionId::ViewCoverage, priority: 70, ... },

            // 소스 파일로 이동
            if let Some(source_file) = self.find_source_file(ctx) {
                Some(Action {
                    id: ActionId::GoToSourceFile,
                    title: format!("Go to {}", source_file.file_name().unwrap().to_str().unwrap()),
                    priority: 80,
                    ...
                })
            } else {
                None
            },
        ].into_iter().flatten().collect()
    }
}
```

**에러/경고 있을 때:**
```rust
pub struct DiagnosticsRule;

impl SuggestionRule for DiagnosticsRule {
    fn suggest(&self, ctx: &AnalyzedContext) -> Vec<Action> {
        if ctx.file.diagnostics.is_empty() {
            return vec![];
        }

        let errors = ctx.file.diagnostics.iter().filter(|d| d.severity == DiagnosticSeverity::Error);
        let warnings = ctx.file.diagnostics.iter().filter(|d| d.severity == DiagnosticSeverity::Warning);

        vec![
            // 다음 에러로 이동
            if errors.count() > 0 {
                Some(Action {
                    id: ActionId::GoToNextError,
                    title: format!("Fix {} error(s)", errors.count()),
                    priority: 95,
                    ...
                })
            } else {
                None
            },

            // 빠른 수정 (LSP Code Actions)
            if let Some(quick_fix) = self.get_quick_fix_at_cursor(ctx) {
                Some(Action {
                    id: ActionId::QuickFix,
                    title: format!("Quick fix: {}", quick_fix.title),
                    priority: 90,
                    ...
                })
            } else {
                None
            },
        ].into_iter().flatten().collect()
    }
}
```

---

## 5. UI 설계

### 5.1 Palette 표시

**트리거:**
- 키보드 단축키: `Cmd+Shift+P` (또는 `Ctrl+Shift+P`)
- 자동 표시: 파일 저장 후, 함수 작성 후 등 (설정 가능)

**UI 레이아웃:**
```
┌─────────────────────────────────────────────────────┐
│ Context Actions                                 [X] │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 🧪 Create Test for function 'calculateTax'         │  ← Priority 90
│    Generate test file with template                │
│                                                     │
│ 📝 Add JSDoc Documentation                         │  ← Priority 70
│    Generate documentation comment                   │
│                                                     │
│ 💾 Save File                                       │  ← Priority 100
│    Unsaved changes in current file                 │
│                                                     │
│ ───────────────────────────────────────────────── │
│                                                     │
│ All Actions (15)                                   │  ← 접기/펼치기
│                                                     │
└─────────────────────────────────────────────────────┘
```

**인터랙션:**
- 위/아래 화살표: 선택 이동
- Enter: 액션 실행
- Tab: 첫 번째 액션 빠른 실행
- Esc: 닫기
- 타이핑: 필터링

### 5.2 Tab Completion

**핵심 기능: Tab 한 번에 가장 추천하는 액션 실행**

```rust
impl ContextActionPalette {
    pub fn on_tab_key(&mut self) -> Result<()> {
        // 첫 번째 (가장 높은 우선순위) 액션 실행
        if let Some(action) = self.actions.first() {
            action.execute(&self.context)?;
            self.close();
        }

        Ok(())
    }
}
```

**예시 시나리오:**
```
1. 함수 작성 완료
2. Cmd+Shift+P → Palette 열림
3. "Create Test" 가 최상단 (Priority 90)
4. Tab 누름 → 즉시 테스트 파일 생성
```

### 5.3 카테고리별 그룹핑

```
┌───────────────────────────────────┐
│ 🧪 Test (2)                       │
│   - Create Test                   │
│   - Run Tests                     │
│                                   │
│ ✏️  Edit (3)                      │
│   - Extract to Function           │
│   - Extract to Component          │
│   - Format Document               │
│                                   │
│ 📝 Documentation (1)              │
│   - Generate JSDoc                │
│                                   │
│ 🔧 Git (2)                        │
│   - Commit Changes                │
│   - Create Pull Request           │
└───────────────────────────────────┘
```

---

## 6. 학습 시스템

### 6.1 사용 패턴 추적

```rust
pub struct UsageTracker {
    // 액션 ID → 실행 횟수
    action_counts: HashMap<ActionId, u32>,

    // 컨텍스트 → 선택한 액션
    context_actions: Vec<(ContextSnapshot, ActionId)>,

    // 무시한 액션 (제안되었지만 실행 안 함)
    ignored_actions: HashMap<ActionId, u32>,
}

pub struct ContextSnapshot {
    node_kind: String,
    file_type: LanguageId,
    has_tests: bool,
    has_errors: bool,
    // ...
}

impl UsageTracker {
    pub fn record_action(&mut self, ctx: &AnalyzedContext, action: &Action) {
        // 실행 횟수 증가
        *self.action_counts.entry(action.id).or_insert(0) += 1;

        // 컨텍스트-액션 페어 저장
        self.context_actions.push((
            ContextSnapshot::from(ctx),
            action.id,
        ));

        // 영속성 (SQLite 또는 파일)
        self.save_to_disk();
    }

    pub fn record_ignored(&mut self, action: &Action) {
        *self.ignored_actions.entry(action.id).or_insert(0) += 1;
    }

    pub fn get_action_score(&self, action: &Action, ctx: &AnalyzedContext) -> u32 {
        let base_priority = action.priority;

        // 실행 횟수 보너스
        let count_bonus = self.action_counts.get(&action.id).unwrap_or(&0) / 10;

        // 비슷한 컨텍스트에서 선택한 적 있으면 보너스
        let context_bonus = self.context_actions
            .iter()
            .filter(|(c, a)| *a == action.id && c.is_similar(&ContextSnapshot::from(ctx)))
            .count() as u32 * 5;

        // 무시된 적 많으면 페널티
        let ignored_penalty = self.ignored_actions.get(&action.id).unwrap_or(&0) / 5;

        base_priority + count_bonus + context_bonus - ignored_penalty
    }
}
```

### 6.2 개인화된 제안

```rust
impl ActionSuggestionEngine {
    pub fn suggest_actions_personalized(
        &self,
        ctx: &AnalyzedContext,
        tracker: &UsageTracker,
    ) -> Vec<Action> {
        let mut actions = self.suggest_actions(ctx);

        // 개인화된 점수 재계산
        for action in &mut actions {
            action.priority = tracker.get_action_score(action, ctx);
        }

        // 재정렬
        actions.sort_by_key(|a| std::cmp::Reverse(a.priority));

        actions
    }
}
```

---

## 7. AI 통합 (선택적)

### 7.1 AI 기반 제안

```rust
pub struct AIActionSuggester {
    ai_client: OpenRouterClient,
}

impl AIActionSuggester {
    pub async fn suggest_actions(&self, ctx: &AnalyzedContext) -> Vec<Action> {
        let prompt = format!(
            r#"Given this context:
- Current code: {}
- File type: {}
- Diagnostics: {:?}

Suggest 3-5 relevant development actions the user might want to take next.
Focus on workflow improvements, not code generation.

Respond in JSON format:
[
  {{
    "title": "Create unit test",
    "description": "Generate test file for current function",
    "priority": 90
  }},
  ...
]
"#,
            ctx.cursor.current_node.utf8_text(buffer.text().as_bytes()).unwrap(),
            ctx.file.language,
            ctx.file.diagnostics
        );

        let response = self.ai_client.complete(&prompt).await?;
        let suggestions: Vec<AISuggestion> = serde_json::from_str(&response)?;

        // AI 제안을 Action으로 변환
        suggestions
            .into_iter()
            .map(|s| self.convert_to_action(s, ctx))
            .collect()
    }
}
```

### 7.2 하이브리드 접근

```rust
impl ActionSuggestionEngine {
    pub async fn suggest_with_ai(
        &self,
        ctx: &AnalyzedContext,
        ai_suggester: &AIActionSuggester,
    ) -> Vec<Action> {
        // 1. 규칙 기반 제안
        let rule_actions = self.suggest_actions(ctx);

        // 2. AI 제안 (비동기)
        let ai_actions = ai_suggester.suggest_actions(ctx).await.unwrap_or_default();

        // 3. 병합 (중복 제거, 우선순위 조정)
        let mut all_actions = rule_actions;
        all_actions.extend(ai_actions);

        all_actions.dedup_by_key(|a| a.id);
        all_actions.sort_by_key(|a| std::cmp::Reverse(a.priority));

        all_actions
    }
}
```

---

## 8. 설정

```toml
[context_action_palette]
# 활성화
enable = true

# 자동 표시 (특정 이벤트 후)
auto_show = false
auto_show_after_save = true
auto_show_after_function_creation = true

# Tab Completion
enable_tab_completion = true

# 학습
enable_learning = true

# AI 통합
enable_ai_suggestions = false
ai_provider = "openrouter"
ai_model = "anthropic/claude-3-5-sonnet"

# 최대 표시 액션 수
max_actions = 10

# 우선순위 임계값 (이 값 이하는 "All Actions"에만 표시)
priority_threshold = 50
```

---

## 9. 구현 로드맵

### Phase 1: 컨텍스트 분석 (Week 1-2)
- [ ] CursorContext (Tree-sitter)
- [ ] FileContext
- [ ] ProjectContext
- [ ] AnalyzedContext 통합

### Phase 2: Action 시스템 (Week 2-3)
- [ ] Action 구조
- [ ] ActionHandler 트레이트
- [ ] 10개 내장 Actions

### Phase 3: Suggestion 엔진 (Week 3-4)
- [ ] SuggestionRule 트레이트
- [ ] 규칙 기반 추론
- [ ] 10개 핵심 Rules

### Phase 4: UI (Week 4-5)
- [ ] Context Action Palette UI
- [ ] Tab Completion
- [ ] 카테고리 그룹핑

### Phase 5: 학습 시스템 (Week 5-6)
- [ ] UsageTracker
- [ ] 개인화된 제안
- [ ] 영속성

### Phase 6: AI 통합 (Week 6-7)
- [ ] AIActionSuggester
- [ ] 하이브리드 접근
- [ ] OpenRouter 통합

---

## 참고 자료

- [VSCode Command Palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette)
- [IntelliJ Context Actions](https://www.jetbrains.com/help/idea/intention-actions.html)
- [GitHub Copilot](https://github.com/features/copilot)
