# Ferrum IDE

A high-performance code editor built with Tauri 2.0 + SolidJS + Rust.

## Prerequisites

- [Bun](https://bun.sh/) (recommended runtime)
- [Rust](https://rustup.rs/) (stable)
- Platform-specific dependencies for Tauri

### macOS

```bash
xcode-select --install
```

### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

## Getting Started

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build
```

## Development Commands

### Frontend

```bash
bun run typecheck    # TypeScript type checking
bun run lint         # Lint with Biome
bun run lint:fix     # Fix lint issues
bun run format       # Format code with Biome
bun run test         # Run tests in watch mode
bun run test:run     # Run tests once
bun run test:coverage # Run tests with coverage
```

### Backend (Rust)

```bash
bun run rust:check   # cargo check
bun run rust:clippy  # cargo clippy with warnings as errors
bun run rust:test    # cargo test
bun run rust:fmt     # cargo fmt
```

### Full Check

```bash
bun run check:all    # TypeScript + Biome + Clippy
```

## Project Structure

```
ferrum/
├── src/              # Frontend (SolidJS/TypeScript)
├── src-tauri/        # Tauri application
│   └── crates/       # Rust workspace crates
│       ├── ferrum_core/
│       ├── ferrum_buffer/
│       ├── ferrum_editor/
│       ├── ferrum_lsp/
│       └── ...
├── tests/            # E2E tests (Playwright)
└── .vscode/          # VS Code configuration
```

## IDE Setup

VS Code is recommended with the following extensions:
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
- [Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)

Debug configurations are provided in `.vscode/launch.json`.

## License

MIT
