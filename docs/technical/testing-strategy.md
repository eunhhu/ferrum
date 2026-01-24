# Testing Strategy

> **목표**: 안정적이고 유지보수 가능한 테스트 인프라 구축

## 1. 테스트 계층

```
┌───────────────────────────────────────────┐
│           E2E Tests (Playwright)           │  ← 사용자 시나리오
├───────────────────────────────────────────┤
│        Integration Tests (Tauri)           │  ← IPC, 컴포넌트 통합
├───────────────────────────────────────────┤
│   Unit Tests (Rust: cargo test, TS: vitest)│  ← 개별 함수/모듈
└───────────────────────────────────────────┘
```

---

## 2. Rust Backend 테스트

### 2.1 단위 테스트

```rust
// src/buffer/rope_buffer.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_insert_at_beginning() {
        let mut buffer = RopeBuffer::new();
        buffer.insert(0, "Hello");

        assert_eq!(buffer.text(), "Hello");
        assert_eq!(buffer.len(), 5);
    }

    #[test]
    fn test_insert_in_middle() {
        let mut buffer = RopeBuffer::from("Hello World");
        buffer.insert(6, "Beautiful ");

        assert_eq!(buffer.text(), "Hello Beautiful World");
    }

    #[test]
    fn test_delete_range() {
        let mut buffer = RopeBuffer::from("Hello World");
        buffer.delete(5..11);

        assert_eq!(buffer.text(), "Hello");
    }

    #[test]
    fn test_undo_redo() {
        let mut buffer = RopeBuffer::new();

        buffer.insert(0, "Hello");
        buffer.insert(5, " World");

        buffer.undo();
        assert_eq!(buffer.text(), "Hello");

        buffer.redo();
        assert_eq!(buffer.text(), "Hello World");
    }

    #[test]
    fn test_utf8_handling() {
        let mut buffer = RopeBuffer::from("한글 테스트");
        buffer.insert(3, " 추가 ");

        assert_eq!(buffer.text(), "한글 추가  테스트");
    }
}
```

### 2.2 프로퍼티 기반 테스트 (proptest)

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_insert_delete_roundtrip(
        initial: String,
        insert_pos in 0usize..1000,
        insert_text: String,
    ) {
        let insert_pos = insert_pos.min(initial.len());

        let mut buffer = RopeBuffer::from(&initial);
        let original_len = buffer.len();

        buffer.insert(insert_pos, &insert_text);
        buffer.delete(insert_pos..insert_pos + insert_text.len());

        prop_assert_eq!(buffer.text(), initial);
        prop_assert_eq!(buffer.len(), original_len);
    }

    #[test]
    fn test_position_offset_consistency(
        text: String,
        offset in 0usize..10000,
    ) {
        let buffer = RopeBuffer::from(&text);
        let offset = offset.min(buffer.len());

        let position = buffer.offset_to_position(offset);
        let back_to_offset = buffer.position_to_offset(position);

        prop_assert_eq!(back_to_offset, offset);
    }
}
```

### 2.3 스냅샷 테스트 (insta)

```rust
use insta::assert_snapshot;

#[test]
fn test_syntax_highlighting_typescript() {
    let code = r#"
        function greet(name: string): string {
            return `Hello, ${name}!`;
        }
    "#;

    let highlights = highlight_code(code, "typescript");
    assert_snapshot!(highlights);
}

#[test]
fn test_lsp_diagnostics_format() {
    let diagnostics = vec![
        Diagnostic {
            message: "Type 'string' is not assignable".to_string(),
            severity: DiagnosticSeverity::Error,
            range: Range::new(Position::new(1, 5), Position::new(1, 10)),
            source: Some("typescript".to_string()),
            code: Some("2322".to_string()),
        }
    ];

    assert_snapshot!(format_diagnostics(&diagnostics));
}
```

### 2.4 벤치마크 (criterion)

```rust
// benches/buffer_benchmark.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};

fn buffer_insert_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("buffer_insert");

    for size in [1000, 10000, 100000, 1000000] {
        group.bench_with_input(BenchmarkId::new("insert", size), &size, |b, &size| {
            let initial_text: String = "x".repeat(size);

            b.iter(|| {
                let mut buffer = RopeBuffer::from(&initial_text);
                buffer.insert(size / 2, black_box("inserted text"));
            });
        });
    }

    group.finish();
}

fn tree_sitter_parse_benchmark(c: &mut Criterion) {
    let typescript_code = include_str!("fixtures/large_file.ts");

    c.bench_function("tree_sitter_parse_typescript", |b| {
        b.iter(|| {
            let mut parser = Parser::new();
            parser.set_language(tree_sitter_typescript::language()).unwrap();
            parser.parse(black_box(typescript_code), None).unwrap();
        });
    });
}

criterion_group!(benches, buffer_insert_benchmark, tree_sitter_parse_benchmark);
criterion_main!(benches);
```

---

## 3. Frontend 테스트

### 3.1 단위 테스트 (Vitest + @testing-library/solid)

```typescript
// src/components/Editor.test.tsx
import { render, screen, fireEvent } from '@testing-library/solid';
import { describe, it, expect, vi } from 'vitest';
import { Editor } from './Editor';

// Mock Tauri IPC
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

describe('Editor Component', () => {
    it('renders with initial content', async () => {
        const mockInvoke = vi.mocked(invoke);
        mockInvoke.mockResolvedValue({
            text: 'Hello World',
            language: 'typescript',
        });

        render(() => <Editor bufferId="test-buffer" />);

        await screen.findByText('Hello World');
    });

    it('handles keyboard input', async () => {
        const mockInvoke = vi.mocked(invoke);

        render(() => <Editor bufferId="test-buffer" />);

        const editor = screen.getByRole('textbox');
        await fireEvent.keyDown(editor, { key: 'a' });

        expect(mockInvoke).toHaveBeenCalledWith('editor_insert', {
            bufferId: 'test-buffer',
            text: 'a',
        });
    });

    it('shows autocomplete on trigger', async () => {
        const mockInvoke = vi.mocked(invoke);
        mockInvoke.mockResolvedValue({
            items: [
                { label: 'console', kind: 'function' },
                { label: 'constructor', kind: 'keyword' },
            ],
        });

        render(() => <Editor bufferId="test-buffer" />);

        const editor = screen.getByRole('textbox');
        await fireEvent.keyDown(editor, { key: '.', ctrlKey: false });

        await screen.findByText('console');
        await screen.findByText('constructor');
    });
});
```

### 3.2 컴포넌트 스토리 (Storybook 대안: Histoire)

```typescript
// src/components/FileTree.story.tsx
import { FileTree } from './FileTree';

export default {
    title: 'Components/FileTree',
    component: FileTree,
};

export const Default = () => (
    <FileTree
        root={{
            name: 'project',
            type: 'directory',
            children: [
                { name: 'src', type: 'directory', children: [] },
                { name: 'package.json', type: 'file' },
                { name: 'README.md', type: 'file' },
            ],
        }}
        onFileSelect={console.log}
    />
);

export const WithGitStatus = () => (
    <FileTree
        root={/* ... */}
        gitStatus={{
            'src/index.ts': 'modified',
            'src/new-file.ts': 'added',
        }}
    />
);

export const LargeDirectory = () => (
    <FileTree
        root={generateLargeTree(10000)}
        virtualized
    />
);
```

### 3.3 시각적 회귀 테스트 (Playwright)

```typescript
// tests/visual/editor.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Editor Visual Tests', () => {
    test('syntax highlighting matches snapshot', async ({ page }) => {
        await page.goto('/');
        await page.click('[data-testid="open-file"]');
        await page.fill('[data-testid="file-picker"]', 'example.ts');
        await page.press('[data-testid="file-picker"]', 'Enter');

        await expect(page.locator('.editor')).toHaveScreenshot('editor-typescript.png');
    });

    test('dark theme renders correctly', async ({ page }) => {
        await page.goto('/?theme=dark');

        await expect(page.locator('body')).toHaveScreenshot('dark-theme.png');
    });

    test('autocomplete dropdown positioning', async ({ page }) => {
        await page.goto('/');
        await page.click('.editor');
        await page.type('.editor', 'console.');

        await expect(page.locator('.autocomplete')).toHaveScreenshot('autocomplete.png');
    });
});
```

---

## 4. 통합 테스트

### 4.1 IPC 통합 테스트

```rust
// tests/integration/ipc_test.rs
use tauri::test::{mock_builder, MockRuntime};

#[tokio::test]
async fn test_open_file_and_edit() {
    let app = mock_builder()
        .build()
        .expect("failed to build app");

    // 파일 열기
    let buffer_id: String = app
        .invoke("open_file", json!({ "path": "test.ts" }))
        .await
        .expect("failed to open file");

    // 텍스트 삽입
    app.invoke("editor_insert", json!({
        "buffer_id": buffer_id,
        "text": "console.log('test');"
    })).await.expect("failed to insert");

    // 내용 확인
    let content: String = app
        .invoke("get_buffer_content", json!({ "buffer_id": buffer_id }))
        .await
        .expect("failed to get content");

    assert!(content.contains("console.log('test');"));
}

#[tokio::test]
async fn test_lsp_completion() {
    let app = mock_builder().build().expect("failed to build app");

    // TypeScript 파일 열기
    let buffer_id: String = app
        .invoke("open_file", json!({ "path": "test.ts" }))
        .await
        .unwrap();

    // LSP 초기화 대기
    tokio::time::sleep(Duration::from_secs(2)).await;

    // 자동완성 요청
    let completions: Vec<CompletionItem> = app
        .invoke("request_completion", json!({
            "buffer_id": buffer_id,
            "position": { "line": 0, "character": 8 }
        }))
        .await
        .unwrap();

    assert!(!completions.is_empty());
}
```

### 4.2 LSP 통합 테스트

```rust
// tests/integration/lsp_test.rs
use ferrum::lsp::{LspClient, LspConfig};

#[tokio::test]
async fn test_typescript_server_lifecycle() {
    let config = LspConfig {
        server_path: "typescript-language-server",
        args: vec!["--stdio".to_string()],
        root_path: PathBuf::from("."),
    };

    let client = LspClient::start(config).await.expect("failed to start");

    // Initialize
    let init_result = client.initialize().await.expect("init failed");
    assert!(init_result.capabilities.completion_provider.is_some());

    // Open document
    client.did_open("test.ts", "typescript", "const x = 1;").await;

    // Request hover
    let hover = client
        .hover("test.ts", Position::new(0, 6))
        .await
        .expect("hover failed");

    assert!(hover.is_some());

    // Shutdown
    client.shutdown().await.expect("shutdown failed");
}
```

---

## 5. E2E 테스트 (Playwright)

### 5.1 테스트 설정

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,

    use: {
        baseURL: 'tauri://localhost',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            name: 'Desktop',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: 'cargo tauri dev',
        url: 'tauri://localhost',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});
```

### 5.2 사용자 시나리오 테스트

```typescript
// tests/e2e/editing.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Editing Workflow', () => {
    test('create, edit, and save file', async ({ page }) => {
        await page.goto('/');

        // 새 파일 생성
        await page.keyboard.press('Meta+n');
        await expect(page.locator('.tab.active')).toContainText('Untitled');

        // 코드 입력
        await page.type('.editor', 'function hello() {\n  console.log("Hello");\n}');

        // 구문 강조 확인
        await expect(page.locator('.syntax-keyword')).toContainText('function');

        // 저장
        await page.keyboard.press('Meta+s');
        await page.fill('.save-dialog input', 'hello.ts');
        await page.click('.save-dialog .save-button');

        // 저장 확인
        await expect(page.locator('.tab.active')).not.toContainText('●'); // dirty indicator
    });

    test('autocomplete workflow', async ({ page }) => {
        await page.goto('/');
        await page.keyboard.press('Meta+n');

        // console. 입력
        await page.type('.editor', 'console.');

        // 자동완성 대기
        await expect(page.locator('.autocomplete')).toBeVisible();

        // log 선택
        await page.click('.autocomplete-item:has-text("log")');

        // 결과 확인
        await expect(page.locator('.editor')).toContainText('console.log');
    });

    test('find and replace', async ({ page }) => {
        await page.goto('/');

        // 파일 열기
        await page.keyboard.press('Meta+o');
        await page.fill('.file-picker', 'test-fixture.ts');
        await page.keyboard.press('Enter');

        // 찾기 열기
        await page.keyboard.press('Meta+f');
        await page.fill('.find-input', 'oldName');

        // 결과 확인
        await expect(page.locator('.match-count')).toContainText('3 of 3');

        // 바꾸기로 전환
        await page.keyboard.press('Meta+h');
        await page.fill('.replace-input', 'newName');

        // 모두 바꾸기
        await page.click('.replace-all-button');

        // 결과 확인
        await expect(page.locator('.match-count')).toContainText('No results');
    });
});

test.describe('Multi-Pane Workflow', () => {
    test('split editor and edit both', async ({ page }) => {
        await page.goto('/');

        // 파일 열기
        await page.keyboard.press('Meta+o');
        await page.fill('.file-picker', 'file1.ts');
        await page.keyboard.press('Enter');

        // 분할
        await page.keyboard.press('Meta+\\');

        // 두 번째 패널에서 다른 파일 열기
        await page.keyboard.press('Meta+o');
        await page.fill('.file-picker', 'file2.ts');
        await page.keyboard.press('Enter');

        // 두 패널 모두 확인
        await expect(page.locator('.pane').first()).toContainText('file1.ts');
        await expect(page.locator('.pane').last()).toContainText('file2.ts');
    });
});
```

---

## 6. 성능 테스트

### 6.1 로드 테스트

```rust
// tests/performance/load_test.rs
use std::time::Instant;

#[test]
fn test_large_file_open_time() {
    // 1MB 파일 생성
    let large_content = "x".repeat(1_000_000);
    std::fs::write("test_large.txt", &large_content).unwrap();

    let start = Instant::now();
    let buffer = RopeBuffer::from_file("test_large.txt").unwrap();
    let elapsed = start.elapsed();

    assert!(elapsed.as_millis() < 500, "Opening 1MB file took {:?}", elapsed);

    std::fs::remove_file("test_large.txt").unwrap();
}

#[test]
fn test_typing_latency() {
    let mut buffer = RopeBuffer::new();

    let mut total_time = Duration::ZERO;
    let iterations = 10000;

    for i in 0..iterations {
        let start = Instant::now();
        buffer.insert(i, "x");
        total_time += start.elapsed();
    }

    let avg_latency = total_time / iterations as u32;
    assert!(
        avg_latency.as_micros() < 100,
        "Average insert latency: {:?}",
        avg_latency
    );
}
```

### 6.2 메모리 프로파일링

```rust
// tests/performance/memory_test.rs
#[test]
fn test_memory_usage() {
    use jemalloc_ctl::{stats, epoch};

    epoch::advance().unwrap();
    let before = stats::allocated::read().unwrap();

    // 100개 버퍼 생성
    let buffers: Vec<_> = (0..100)
        .map(|i| RopeBuffer::from(&format!("Buffer content {}", i).repeat(10000)))
        .collect();

    epoch::advance().unwrap();
    let after = stats::allocated::read().unwrap();

    let memory_per_buffer = (after - before) / 100;
    println!("Memory per buffer: {} bytes", memory_per_buffer);

    assert!(
        memory_per_buffer < 1_000_000,  // 1MB per buffer max
        "Memory usage too high: {} bytes per buffer",
        memory_per_buffer
    );
}
```

---

## 7. CI/CD 통합

### 7.1 GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  rust-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-action@stable

      - name: Cache cargo
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo/bin/
            ~/.cargo/registry/
            ~/.cargo/git/
            target/
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: Run tests
        run: cargo test --all

      - name: Run benchmarks
        run: cargo bench --no-run

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test

      - name: Run type check
        run: pnpm type-check

  e2e-tests:
    runs-on: macos-latest  # Tauri는 macOS에서 테스트
    steps:
      - uses: actions/checkout@v4

      - name: Setup
        uses: tauri-apps/tauri-action/setup@v0

      - name: Install Playwright
        run: pnpm playwright install

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload screenshots
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-screenshots
          path: tests/e2e/screenshots/
```

### 7.2 테스트 커버리지

```yaml
# .github/workflows/coverage.yml
name: Coverage

on: [push]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-action@stable
        with:
          components: llvm-tools-preview

      - name: Install cargo-llvm-cov
        run: cargo install cargo-llvm-cov

      - name: Generate coverage
        run: cargo llvm-cov --lcov --output-path lcov.info

      - name: Upload to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: lcov.info
```

---

## 8. 테스트 가이드라인

### 8.1 명명 규칙

```rust
// 좋은 예
#[test]
fn test_buffer_insert_at_end_appends_text() { ... }

#[test]
fn test_undo_after_multiple_edits_restores_previous_state() { ... }

// 나쁜 예
#[test]
fn test_insert() { ... }

#[test]
fn test1() { ... }
```

### 8.2 테스트 구조 (AAA 패턴)

```rust
#[test]
fn test_delete_selection_removes_text() {
    // Arrange
    let mut buffer = RopeBuffer::from("Hello World");
    let selection = Selection::new(0, 5);

    // Act
    buffer.delete_selection(&selection);

    // Assert
    assert_eq!(buffer.text(), " World");
}
```

### 8.3 테스트 픽스처

```rust
// tests/fixtures/mod.rs
pub fn sample_typescript_code() -> &'static str {
    include_str!("sample.ts")
}

pub fn sample_project_structure() -> TempDir {
    let dir = TempDir::new().unwrap();
    // ... 프로젝트 구조 생성
    dir
}
```

---

## 9. 목표 커버리지

| 영역 | 목표 커버리지 |
|------|--------------|
| Core (Buffer, Rope) | 90%+ |
| Editor Logic | 80%+ |
| LSP Integration | 70%+ |
| UI Components | 60%+ |
| E2E Scenarios | Critical paths |
