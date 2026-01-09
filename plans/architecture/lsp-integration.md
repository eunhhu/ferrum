# LSP Integration 아키텍처

> **목적**: Ferrum IDE의 Language Server Protocol 통합 설계

## 1. 개요

### 1.1 설계 목표

- **공식 LSP 서버 사용**: 언어별 최적화된 서버
- **번들 LSP**: 오프라인 지원을 위한 16개 언어 번들
- **비동기 처리**: 블로킹 방지
- **타임아웃 관리**: 120초 (Zed 참고)
- **증분 동기화**: 전체 문서가 아닌 변경분만

### 1.2 지원 언어 (번들 LSP)

| Category | Languages |
|----------|-----------|
| **Web** | HTML, CSS, JavaScript, TypeScript |
| **Systems** | Rust, Go, C, C++, Zig |
| **Mobile** | Swift, Kotlin, Java |
| **Scripting** | Python, Ruby, PHP |
| **Other** | Erlang |

---

## 2. LSP 클라이언트 아키텍처 (Zed 참고)

### 2.1 전체 구조

```
Editor/Buffer
       ↓
LanguageRegistry (언어 감지)
       ↓
LspManager (언어별 서버 관리)
       ↓
LspClient (개별 서버 통신)
       ↓
LanguageServer (subprocess)
   (stdin/stdout JSON-RPC)
```

### 2.2 핵심 컴포넌트

```rust
// LSP 클라이언트 (Zed 참고)
pub struct LspClient {
    server_id: LanguageServerId,
    next_request_id: AtomicI32,
    capabilities: ServerCapabilities,

    // 통신 채널
    outbound_tx: UnboundedSender<LspMessage>,
    inbound_rx: Mutex<UnboundedReceiver<LspMessage>>,

    // 요청 추적
    pending_requests: Arc<Mutex<HashMap<RequestId, ResponseHandler>>>,

    // 알림 핸들러
    notification_handlers: HashMap<String, NotificationHandler>,

    // I/O 태스크
    io_tasks: Vec<Task<()>>,
}

pub struct LspManager {
    // 언어별 서버
    servers: HashMap<LanguageId, Arc<LspClient>>,

    // 버퍼 → 서버 매핑
    buffer_servers: HashMap<BufferId, LanguageServerId>,

    // 서버 바이너리 경로
    server_paths: HashMap<LanguageId, PathBuf>,
}
```

---

## 3. LSP 서버 시작 및 초기화

### 3.1 서버 시작

```rust
impl LspManager {
    pub async fn start_server(
        &mut self,
        language_id: LanguageId,
        root_path: &Path,
    ) -> Result<LanguageServerId> {
        // 1. 서버 바이너리 찾기
        let binary_path = self.find_server_binary(language_id)?;

        // 2. 프로세스 시작
        let mut command = Command::new(&binary_path);
        command.current_dir(root_path);
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        let mut child = command.spawn()?;

        // 3. I/O 채널 설정
        let stdin = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        // 4. LspClient 생성
        let (outbound_tx, outbound_rx) = unbounded_channel();
        let (inbound_tx, inbound_rx) = unbounded_channel();

        let server_id = LanguageServerId::new();
        let client = LspClient::new(server_id, outbound_tx, inbound_rx);

        // 5. I/O 태스크 시작
        tokio::spawn(Self::handle_stdin(outbound_rx, stdin));
        tokio::spawn(Self::handle_stdout(stdout, inbound_tx.clone()));
        tokio::spawn(Self::handle_stderr(stderr));

        // 6. Initialize 요청 전송
        let capabilities = client.initialize(root_path).await?;

        // 7. Initialized 알림 전송
        client.initialized().await?;

        // 8. 등록
        self.servers.insert(language_id, Arc::new(client));

        Ok(server_id)
    }
}
```

### 3.2 Initialize 프로토콜

```rust
impl LspClient {
    pub async fn initialize(&self, root_path: &Path) -> Result<ServerCapabilities> {
        let params = InitializeParams {
            process_id: Some(std::process::id()),
            root_uri: Some(Url::from_file_path(root_path).unwrap()),
            capabilities: ClientCapabilities {
                text_document: Some(TextDocumentClientCapabilities {
                    synchronization: Some(TextDocumentSyncClientCapabilities {
                        did_save: Some(true),
                        will_save: Some(true),
                        will_save_wait_until: Some(false),
                        dynamic_registration: Some(false),
                    }),
                    completion: Some(CompletionClientCapabilities {
                        completion_item: Some(CompletionItemCapability {
                            snippet_support: Some(true),
                            commit_characters_support: Some(true),
                            documentation_format: Some(vec![
                                MarkupKind::Markdown,
                                MarkupKind::PlainText,
                            ]),
                            // ...
                        }),
                        // ...
                    }),
                    hover: Some(HoverClientCapabilities {
                        content_format: Some(vec![MarkupKind::Markdown]),
                        // ...
                    }),
                    // 기타 capabilities
                }),
                // ...
            },
            // ...
        };

        let response: InitializeResult = self
            .request("initialize", params)
            .await?;

        Ok(response.capabilities)
    }

    pub async fn initialized(&self) -> Result<()> {
        self.notify("initialized", InitializedParams {}).await
    }
}
```

---

## 4. 문서 동기화

### 4.1 didOpen

```rust
impl LspClient {
    pub async fn did_open(&self, buffer: &TextBuffer) -> Result<()> {
        let params = DidOpenTextDocumentParams {
            text_document: TextDocumentItem {
                uri: buffer.uri(),
                language_id: buffer.language_id().to_string(),
                version: buffer.version() as i32,
                text: buffer.text(),
            },
        };

        self.notify("textDocument/didOpen", params).await
    }
}
```

### 4.2 didChange (증분 동기화)

```rust
impl LspClient {
    pub async fn did_change(
        &self,
        buffer: &TextBuffer,
        changes: &[TextChange],
    ) -> Result<()> {
        // 증분 동기화 지원 여부 확인
        let sync_kind = self.capabilities.text_document_sync
            .as_ref()
            .and_then(|sync| sync.change)
            .unwrap_or(TextDocumentSyncKind::None);

        let content_changes = match sync_kind {
            TextDocumentSyncKind::Full => {
                // 전체 문서 전송
                vec![TextDocumentContentChangeEvent {
                    range: None,
                    range_length: None,
                    text: buffer.text(),
                }]
            }
            TextDocumentSyncKind::Incremental => {
                // 변경분만 전송
                changes
                    .iter()
                    .map(|change| TextDocumentContentChangeEvent {
                        range: Some(buffer.range_to_lsp(change.range)),
                        range_length: None,
                        text: change.text.clone(),
                    })
                    .collect()
            }
            _ => return Ok(()),
        };

        let params = DidChangeTextDocumentParams {
            text_document: VersionedTextDocumentIdentifier {
                uri: buffer.uri(),
                version: buffer.version() as i32,
            },
            content_changes,
        };

        self.notify("textDocument/didChange", params).await
    }
}
```

### 4.3 didSave, didClose

```rust
impl LspClient {
    pub async fn did_save(&self, buffer: &TextBuffer) -> Result<()> {
        let include_text = self.capabilities.text_document_sync
            .as_ref()
            .and_then(|sync| sync.save)
            .and_then(|save| save.include_text)
            .unwrap_or(false);

        let params = DidSaveTextDocumentParams {
            text_document: TextDocumentIdentifier {
                uri: buffer.uri(),
            },
            text: if include_text {
                Some(buffer.text())
            } else {
                None
            },
        };

        self.notify("textDocument/didSave", params).await
    }

    pub async fn did_close(&self, buffer: &TextBuffer) -> Result<()> {
        let params = DidCloseTextDocumentParams {
            text_document: TextDocumentIdentifier {
                uri: buffer.uri(),
            },
        };

        self.notify("textDocument/didClose", params).await
    }
}
```

---

## 5. LSP 기능 구현

### 5.1 자동완성 (Completion)

```rust
impl LspClient {
    pub async fn completion(
        &self,
        buffer: &TextBuffer,
        position: Position,
    ) -> Result<Vec<CompletionItem>> {
        let params = CompletionParams {
            text_document_position: TextDocumentPositionParams {
                text_document: TextDocumentIdentifier {
                    uri: buffer.uri(),
                },
                position: buffer.position_to_lsp(position),
            },
            work_done_progress_params: WorkDoneProgressParams::default(),
            partial_result_params: PartialResultParams::default(),
            context: None,
        };

        let response: CompletionResponse = self
            .request("textDocument/completion", params)
            .await?;

        let items = match response {
            CompletionResponse::Array(items) => items,
            CompletionResponse::List(list) => list.items,
        };

        Ok(items)
    }
}
```

### 5.2 정의로 이동 (Go to Definition)

```rust
impl LspClient {
    pub async fn goto_definition(
        &self,
        buffer: &TextBuffer,
        position: Position,
    ) -> Result<Vec<Location>> {
        let params = GotoDefinitionParams {
            text_document_position_params: TextDocumentPositionParams {
                text_document: TextDocumentIdentifier {
                    uri: buffer.uri(),
                },
                position: buffer.position_to_lsp(position),
            },
            work_done_progress_params: WorkDoneProgressParams::default(),
            partial_result_params: PartialResultParams::default(),
        };

        let response: GotoDefinitionResponse = self
            .request("textDocument/definition", params)
            .await?;

        let locations = match response {
            GotoDefinitionResponse::Scalar(location) => vec![location],
            GotoDefinitionResponse::Array(locations) => locations,
            GotoDefinitionResponse::Link(links) => {
                links.into_iter().map(|link| link.target_uri).collect()
            }
        };

        Ok(locations)
    }
}
```

### 5.3 호버 (Hover)

```rust
impl LspClient {
    pub async fn hover(
        &self,
        buffer: &TextBuffer,
        position: Position,
    ) -> Result<Option<Hover>> {
        let params = HoverParams {
            text_document_position_params: TextDocumentPositionParams {
                text_document: TextDocumentIdentifier {
                    uri: buffer.uri(),
                },
                position: buffer.position_to_lsp(position),
            },
            work_done_progress_params: WorkDoneProgressParams::default(),
        };

        let response: Option<Hover> = self
            .request("textDocument/hover", params)
            .await?;

        Ok(response)
    }
}
```

### 5.4 진단 (Diagnostics) - 알림 처리

```rust
impl LspClient {
    pub fn on_diagnostics<F>(&mut self, handler: F)
    where
        F: Fn(PublishDiagnosticsParams) + Send + 'static,
    {
        self.notification_handlers.insert(
            "textDocument/publishDiagnostics".to_string(),
            Box::new(move |params| {
                let diagnostics: PublishDiagnosticsParams =
                    serde_json::from_value(params).unwrap();
                handler(diagnostics);
            }),
        );
    }
}

// LspManager에서 진단 처리
impl LspManager {
    pub fn setup_diagnostics_handler(&mut self, app_handle: AppHandle) {
        for (language_id, client) in &mut self.servers {
            let app_handle = app_handle.clone();
            client.on_diagnostics(move |params| {
                // Frontend로 이벤트 전송
                app_handle.emit_all("lsp-diagnostics", LspDiagnosticsEvent {
                    uri: params.uri.to_string(),
                    diagnostics: params.diagnostics,
                }).ok();
            });
        }
    }
}
```

### 5.5 코드 액션 (Code Actions)

```rust
impl LspClient {
    pub async fn code_actions(
        &self,
        buffer: &TextBuffer,
        range: Range,
        diagnostics: Vec<Diagnostic>,
    ) -> Result<Vec<CodeActionOrCommand>> {
        let params = CodeActionParams {
            text_document: TextDocumentIdentifier {
                uri: buffer.uri(),
            },
            range: buffer.range_to_lsp(range),
            context: CodeActionContext {
                diagnostics,
                only: None,
            },
            work_done_progress_params: WorkDoneProgressParams::default(),
            partial_result_params: PartialResultParams::default(),
        };

        let response: Option<Vec<CodeActionOrCommand>> = self
            .request("textDocument/codeAction", params)
            .await?;

        Ok(response.unwrap_or_default())
    }
}
```

### 5.6 인레이 힌트 (Inlay Hints)

```rust
impl LspClient {
    pub async fn inlay_hints(
        &self,
        buffer: &TextBuffer,
        range: Range,
    ) -> Result<Vec<InlayHint>> {
        if !self.capabilities.inlay_hint_provider.is_some() {
            return Ok(Vec::new());
        }

        let params = InlayHintParams {
            text_document: TextDocumentIdentifier {
                uri: buffer.uri(),
            },
            range: buffer.range_to_lsp(range),
            work_done_progress_params: WorkDoneProgressParams::default(),
        };

        let response: Option<Vec<InlayHint>> = self
            .request("textDocument/inlayHint", params)
            .await?;

        Ok(response.unwrap_or_default())
    }
}
```

---

## 6. 별도 OS 스레드에서 LSP 처리 (UI 블로킹 방지)

### 6.1 핵심 아키텍처

**대규모 프로젝트에서 인덱싱 중일 때 UI가 멈추지 않도록 LSP Client를 별도의 OS 스레드에서 돌리고, Rust의 tokio 채널을 통해 비동기적으로 결과를 수집합니다.**

```rust
use std::thread;
use tokio::sync::{mpsc, oneshot};

/// LSP 요청/응답을 별도 OS 스레드에서 처리
pub struct ThreadedLspClient {
    // 요청 전송 채널
    request_tx: mpsc::Sender<LspRequest>,
    // 알림 수신 채널 (진단, 진행 상황 등)
    notification_rx: mpsc::Receiver<LspNotification>,
    // 스레드 핸들
    thread_handle: thread::JoinHandle<()>,
}

pub struct LspRequest {
    pub id: RequestId,
    pub method: String,
    pub params: serde_json::Value,
    // 응답을 받을 oneshot 채널
    pub response_tx: oneshot::Sender<Result<serde_json::Value, LspError>>,
}

pub struct LspNotification {
    pub method: String,
    pub params: serde_json::Value,
}

impl ThreadedLspClient {
    pub fn spawn(
        server_command: &str,
        root_path: &Path,
    ) -> Result<Self> {
        let (request_tx, mut request_rx) = mpsc::channel::<LspRequest>(128);
        let (notification_tx, notification_rx) = mpsc::channel::<LspNotification>(256);

        let command = server_command.to_string();
        let root = root_path.to_path_buf();

        // 별도 OS 스레드에서 LSP 서버와 통신
        let thread_handle = thread::spawn(move || {
            // 이 스레드 전용 tokio 런타임
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();

            rt.block_on(async move {
                // LSP 서버 프로세스 시작
                let mut child = Command::new(&command)
                    .current_dir(&root)
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .expect("Failed to start LSP server");

                let stdin = child.stdin.take().unwrap();
                let stdout = child.stdout.take().unwrap();

                let (json_tx, mut json_rx) = mpsc::channel::<LspMessage>(64);
                let pending_requests: Arc<Mutex<HashMap<RequestId, oneshot::Sender<_>>>> =
                    Arc::new(Mutex::new(HashMap::new()));

                // stdout 읽기 태스크
                let pending_ref = pending_requests.clone();
                let notif_tx = notification_tx.clone();
                tokio::spawn(async move {
                    let mut reader = BufReader::new(stdout);
                    loop {
                        match read_lsp_message(&mut reader).await {
                            Ok(msg) => match msg {
                                LspMessage::Response { id, result, error } => {
                                    if let Some(tx) = pending_ref.lock().unwrap().remove(&id) {
                                        let response = match error {
                                            Some(e) => Err(e.into()),
                                            None => Ok(result.unwrap_or(serde_json::Value::Null)),
                                        };
                                        let _ = tx.send(response);
                                    }
                                }
                                LspMessage::Notification { method, params } => {
                                    let _ = notif_tx.send(LspNotification { method, params }).await;
                                }
                                _ => {}
                            },
                            Err(_) => break,
                        }
                    }
                });

                // stdin 쓰기 태스크
                let mut stdin = BufWriter::new(stdin);
                tokio::spawn(async move {
                    while let Some(msg) = json_rx.recv().await {
                        write_lsp_message(&mut stdin, &msg).await.ok();
                    }
                });

                // 요청 처리 루프
                while let Some(request) = request_rx.recv().await {
                    // oneshot 채널 등록
                    pending_requests.lock().unwrap()
                        .insert(request.id.clone(), request.response_tx);

                    // 요청 전송
                    let msg = LspMessage::Request {
                        id: request.id,
                        method: request.method,
                        params: request.params,
                    };
                    let _ = json_tx.send(msg).await;
                }
            });
        });

        Ok(Self {
            request_tx,
            notification_rx,
            thread_handle,
        })
    }

    /// 비동기 요청 (메인 스레드를 블로킹하지 않음)
    pub async fn request<P, R>(&self, method: &str, params: P) -> Result<R>
    where
        P: Serialize,
        R: DeserializeOwned,
    {
        let (tx, rx) = oneshot::channel();
        let request_id = RequestId::new();

        self.request_tx.send(LspRequest {
            id: request_id,
            method: method.to_string(),
            params: serde_json::to_value(params)?,
            response_tx: tx,
        }).await?;

        // 타임아웃 (120초)
        let result = tokio::time::timeout(
            Duration::from_secs(120),
            rx
        ).await??;

        Ok(serde_json::from_value(result?)?)
    }

    /// 알림 스트림 (진단 등)
    pub fn notifications(&mut self) -> &mut mpsc::Receiver<LspNotification> {
        &mut self.notification_rx
    }
}
```

### 6.2 프로젝트 인덱싱 중 진행 상황 표시

```rust
impl LspManager {
    pub fn setup_progress_handler(&mut self, app_handle: AppHandle) {
        let mut client = self.client.lock().unwrap();

        // 별도 태스크에서 알림 수신
        tokio::spawn(async move {
            while let Some(notification) = client.notifications().recv().await {
                match notification.method.as_str() {
                    "$/progress" => {
                        let params: ProgressParams = serde_json::from_value(notification.params).unwrap();
                        match params.value {
                            ProgressParamsValue::WorkDone(work_done) => {
                                // UI에 진행 상황 표시
                                app_handle.emit_all("lsp-progress", LspProgressEvent {
                                    token: params.token,
                                    kind: match work_done {
                                        WorkDoneProgress::Begin(b) => "begin",
                                        WorkDoneProgress::Report(r) => "report",
                                        WorkDoneProgress::End(_) => "end",
                                    },
                                    title: work_done.title(),
                                    message: work_done.message(),
                                    percentage: work_done.percentage(),
                                }).ok();
                            }
                        }
                    }
                    "textDocument/publishDiagnostics" => {
                        // 진단 처리
                        let params: PublishDiagnosticsParams =
                            serde_json::from_value(notification.params).unwrap();
                        app_handle.emit_all("lsp-diagnostics", params).ok();
                    }
                    _ => {}
                }
            }
        });
    }
}
```

### 6.3 동시 요청 처리 (병렬 완성/호버/정의)

```rust
impl LspClient {
    /// 여러 LSP 기능을 동시에 요청 (성능 최적화)
    pub async fn get_cursor_info(
        &self,
        buffer: &TextBuffer,
        position: Position,
    ) -> CursorInfo {
        // 3개 요청을 동시에 실행
        let (completion, hover, definition) = tokio::join!(
            self.completion(buffer, position),
            self.hover(buffer, position),
            self.goto_definition(buffer, position),
        );

        CursorInfo {
            completion: completion.ok(),
            hover: hover.ok(),
            definition: definition.ok(),
        }
    }
}
```

---

## 7. 요청/응답 처리 (Zed 참고)

### 7.1 요청 전송

```rust
impl LspClient {
    pub async fn request<P, R>(&self, method: &str, params: P) -> Result<R>
    where
        P: Serialize,
        R: DeserializeOwned,
    {
        // 1. 요청 ID 생성
        let request_id = self.next_request_id.fetch_add(1, Ordering::SeqCst);

        // 2. oneshot 채널 생성
        let (tx, rx) = oneshot::channel();

        // 3. 응답 핸들러 등록
        self.pending_requests.lock().unwrap().insert(
            request_id,
            ResponseHandler {
                tx,
                timeout: tokio::time::sleep(Duration::from_secs(120)),
            },
        );

        // 4. 요청 전송
        let message = LspMessage::Request {
            id: request_id,
            method: method.to_string(),
            params: serde_json::to_value(params)?,
        };

        self.outbound_tx.send(message)?;

        // 5. 응답 대기 (타임아웃 포함)
        tokio::select! {
            result = rx => {
                match result {
                    Ok(Ok(value)) => Ok(serde_json::from_value(value)?),
                    Ok(Err(error)) => Err(anyhow::anyhow!("LSP error: {:?}", error)),
                    Err(_) => Err(anyhow::anyhow!("Response channel closed")),
                }
            }
            _ = tokio::time::sleep(Duration::from_secs(120)) => {
                // 타임아웃
                self.pending_requests.lock().unwrap().remove(&request_id);
                Err(anyhow::anyhow!("Request timed out"))
            }
        }
    }
}
```

### 6.2 알림 전송

```rust
impl LspClient {
    pub async fn notify<P>(&self, method: &str, params: P) -> Result<()>
    where
        P: Serialize,
    {
        let message = LspMessage::Notification {
            method: method.to_string(),
            params: serde_json::to_value(params)?,
        };

        self.outbound_tx.send(message)?;

        Ok(())
    }
}
```

### 6.3 I/O 처리

```rust
impl LspManager {
    // stdin 쓰기
    async fn handle_stdin(
        mut rx: UnboundedReceiver<LspMessage>,
        mut stdin: ChildStdin,
    ) {
        while let Some(message) = rx.recv().await {
            // JSON-RPC 프레이밍
            let json = serde_json::to_string(&message).unwrap();
            let content = format!("Content-Length: {}\r\n\r\n{}", json.len(), json);

            if stdin.write_all(content.as_bytes()).await.is_err() {
                break;
            }
        }
    }

    // stdout 읽기
    async fn handle_stdout(
        mut stdout: ChildStdout,
        tx: UnboundedSender<LspMessage>,
    ) {
        let mut buffer = Vec::new();

        loop {
            // Content-Length 헤더 읽기
            let mut header = String::new();
            if stdout.read_line(&mut header).await.is_err() {
                break;
            }

            if !header.starts_with("Content-Length:") {
                continue;
            }

            let length: usize = header
                .trim_start_matches("Content-Length:")
                .trim()
                .parse()
                .unwrap();

            // 빈 줄 건너뛰기
            let mut blank = String::new();
            stdout.read_line(&mut blank).await.ok();

            // JSON 읽기
            buffer.resize(length, 0);
            if stdout.read_exact(&mut buffer).await.is_err() {
                break;
            }

            // 파싱
            if let Ok(message) = serde_json::from_slice::<LspMessage>(&buffer) {
                tx.send(message).ok();
            }
        }
    }

    // stderr 로깅
    async fn handle_stderr(mut stderr: ChildStderr) {
        let mut line = String::new();
        while stderr.read_line(&mut line).await.is_ok() {
            if !line.is_empty() {
                eprintln!("[LSP stderr] {}", line);
                line.clear();
            }
        }
    }
}
```

---

## 7. 번들 LSP 서버

### 7.1 번들 구조

```
ferrum/
  lsp/
    rust-analyzer/
      bin/
        rust-analyzer (or .exe)
    typescript-language-server/
      bin/
        typescript-language-server
    ...
```

### 7.2 서버 바이너리 찾기

```rust
impl LspManager {
    fn find_server_binary(&self, language_id: LanguageId) -> Result<PathBuf> {
        // 1. 사용자 설정 경로 확인
        if let Some(path) = self.config.get_server_path(language_id) {
            if path.exists() {
                return Ok(path);
            }
        }

        // 2. 번들 LSP 경로
        let bundled_path = self.get_bundled_server_path(language_id);
        if bundled_path.exists() {
            return Ok(bundled_path);
        }

        // 3. PATH 환경변수에서 찾기
        if let Some(path) = self.find_in_path(language_id) {
            return Ok(path);
        }

        Err(anyhow::anyhow!("LSP server not found for {:?}", language_id))
    }

    fn get_bundled_server_path(&self, language_id: LanguageId) -> PathBuf {
        let server_name = match language_id {
            LanguageId::Rust => "rust-analyzer",
            LanguageId::TypeScript => "typescript-language-server",
            LanguageId::Python => "pyright",
            // ...
        };

        #[cfg(target_os = "windows")]
        let binary_name = format!("{}.exe", server_name);
        #[cfg(not(target_os = "windows"))]
        let binary_name = server_name.to_string();

        let app_dir = std::env::current_exe()
            .unwrap()
            .parent()
            .unwrap()
            .to_path_buf();

        app_dir.join("lsp").join(server_name).join("bin").join(binary_name)
    }
}
```

### 7.3 언어별 서버 설정

```rust
pub struct LspServerConfig {
    pub command: String,
    pub args: Vec<String>,
    pub initialization_options: Option<serde_json::Value>,
}

impl LspManager {
    fn get_server_config(&self, language_id: LanguageId) -> LspServerConfig {
        match language_id {
            LanguageId::Rust => LspServerConfig {
                command: "rust-analyzer".to_string(),
                args: vec![],
                initialization_options: Some(json!({
                    "checkOnSave": {
                        "command": "clippy",
                    },
                })),
            },
            LanguageId::TypeScript => LspServerConfig {
                command: "typescript-language-server".to_string(),
                args: vec!["--stdio".to_string()],
                initialization_options: None,
            },
            LanguageId::Python => LspServerConfig {
                command: "pyright-langserver".to_string(),
                args: vec!["--stdio".to_string()],
                initialization_options: None,
            },
            // ...
        }
    }
}
```

---

## 8. 버퍼-LSP 통합

### 8.1 버퍼 등록

```rust
impl LspManager {
    pub async fn register_buffer(&mut self, buffer_id: BufferId) -> Result<()> {
        let buffer = self.buffer_manager.get_buffer(buffer_id)?;
        let language_id = buffer.lock().await.language_id();

        // 1. 언어 서버 시작 (아직 없으면)
        if !self.servers.contains_key(&language_id) {
            let root_path = self.project_manager.root_path();
            self.start_server(language_id, &root_path).await?;
        }

        // 2. didOpen 알림
        let client = self.servers.get(&language_id).unwrap();
        client.did_open(&buffer.lock().await).await?;

        // 3. 매핑 저장
        self.buffer_servers.insert(buffer_id, client.server_id);

        Ok(())
    }
}
```

### 8.2 버퍼 변경 동기화

```rust
impl LspManager {
    pub async fn on_buffer_changed(
        &self,
        buffer_id: BufferId,
        changes: &[TextChange],
    ) -> Result<()> {
        if let Some(server_id) = self.buffer_servers.get(&buffer_id) {
            if let Some(client) = self.get_client(*server_id) {
                let buffer = self.buffer_manager.get_buffer(buffer_id)?;
                client.did_change(&buffer.lock().await, changes).await?;
            }
        }

        Ok(())
    }
}
```

---

## 9. 성능 최적화

### 9.1 요청 캐싱

```rust
pub struct LspCache {
    // 자동완성 캐시
    completion_cache: HashMap<(BufferId, Position), (Instant, Vec<CompletionItem>)>,

    // 호버 캐시
    hover_cache: HashMap<(BufferId, Position), (Instant, Option<Hover>)>,

    // 캐시 TTL
    cache_ttl: Duration,
}

impl LspCache {
    pub fn get_completion(
        &self,
        buffer_id: BufferId,
        position: Position,
    ) -> Option<Vec<CompletionItem>> {
        if let Some((timestamp, items)) = self.completion_cache.get(&(buffer_id, position)) {
            if timestamp.elapsed() < self.cache_ttl {
                return Some(items.clone());
            }
        }
        None
    }

    pub fn set_completion(
        &mut self,
        buffer_id: BufferId,
        position: Position,
        items: Vec<CompletionItem>,
    ) {
        self.completion_cache.insert(
            (buffer_id, position),
            (Instant::now(), items),
        );
    }

    pub fn invalidate_buffer(&mut self, buffer_id: BufferId) {
        self.completion_cache.retain(|(bid, _), _| *bid != buffer_id);
        self.hover_cache.retain(|(bid, _), _| *bid != buffer_id);
    }
}
```

### 9.2 디바운싱

```rust
pub struct DebouncedLspClient {
    client: Arc<LspClient>,
    debouncer: Debouncer,
}

impl DebouncedLspClient {
    pub async fn completion_debounced(
        &self,
        buffer: &TextBuffer,
        position: Position,
    ) -> Result<Vec<CompletionItem>> {
        // 300ms 디바운스
        self.debouncer.debounce(Duration::from_millis(300)).await;

        self.client.completion(buffer, position).await
    }
}

pub struct Debouncer {
    last_call: Mutex<Instant>,
}

impl Debouncer {
    pub async fn debounce(&self, duration: Duration) {
        let mut last = self.last_call.lock().unwrap();
        let now = Instant::now();
        let elapsed = now.duration_since(*last);

        if elapsed < duration {
            tokio::time::sleep(duration - elapsed).await;
        }

        *last = Instant::now();
    }
}
```

---

## 10. 에러 처리

### 10.1 서버 크래시 처리

```rust
impl LspManager {
    async fn monitor_server(&self, server_id: LanguageServerId) {
        let client = self.get_client(server_id).unwrap();

        // 서버 프로세스 모니터링
        tokio::spawn(async move {
            // Wait for server exit
            // ...

            // 재시작 시도
            for attempt in 1..=3 {
                log::warn!("LSP server crashed, restarting (attempt {})", attempt);

                if let Ok(_) = client.restart().await {
                    log::info!("LSP server restarted successfully");
                    return;
                }

                tokio::time::sleep(Duration::from_secs(attempt * 2)).await;
            }

            log::error!("Failed to restart LSP server after 3 attempts");
        });
    }
}
```

### 10.2 타임아웃 처리

```rust
impl LspClient {
    async fn request_with_timeout<P, R>(
        &self,
        method: &str,
        params: P,
        timeout: Duration,
    ) -> Result<R>
    where
        P: Serialize,
        R: DeserializeOwned,
    {
        tokio::time::timeout(timeout, self.request(method, params))
            .await
            .map_err(|_| anyhow::anyhow!("LSP request timed out"))?
    }
}
```

---

## 11. 구현 체크리스트

### Phase 1: 기본 LSP 클라이언트 (Week 1-2)
- [ ] LspClient 구조
- [ ] JSON-RPC 통신
- [ ] Initialize 프로토콜
- [ ] 문서 동기화 (didOpen, didChange, didSave, didClose)

### Phase 2: LSP 기능 (Week 2-3)
- [ ] 자동완성
- [ ] 정의로 이동
- [ ] 호버
- [ ] 진단
- [ ] 코드 액션
- [ ] 인레이 힌트

### Phase 3: 번들 LSP (Week 3-4)
- [ ] 16개 언어 서버 번들
- [ ] 서버 바이너리 찾기
- [ ] 언어별 설정

### Phase 4: 최적화 (Week 4-5)
- [ ] 요청 캐싱
- [ ] 디바운싱
- [ ] 서버 크래시 복구

---

## 참고 자료

- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
- [Zed LSP Implementation](https://github.com/zed-industries/zed/tree/main/crates/lsp)
- [lsp-types Crate](https://docs.rs/lsp-types/)
- [tower-lsp](https://docs.rs/tower-lsp/) - LSP 서버 구현용
