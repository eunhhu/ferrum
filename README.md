# Ferrum IDE

A high-performance code editor built with Tauri 2.0 + SolidJS + Rust.

## Features

- **Custom Editor Engine** - Rope-based text buffer with tree-sitter parsing
- **Multi-language LSP** - TypeScript, Rust, Python, Go, and more
- **Tree Viewer** - Figma-style depth-based code navigation
- **Visual Coding** - Node-based code visualization
- **AI Integration** - OpenRouter (cloud) and Ollama (local) support

## Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime
- [Rust](https://rustup.rs/) - Stable toolchain

### Platform Dependencies

**macOS**
```bash
xcode-select --install
```

**Ubuntu/Debian**
```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

## Getting Started

```bash
bun install
bun run dev
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Production build |
| `bun run typecheck` | TypeScript check |
| `bun run lint` | Lint with Biome |
| `bun run test:run` | Run tests |
| `bun run rust:check` | Cargo check |
| `bun run rust:test` | Cargo test |
| `bun run check:all` | Full check (TS + Biome + Clippy) |

## Project Structure

```
ferrum/
├── src/              # Frontend (SolidJS/TypeScript)
├── src-tauri/        # Tauri application
│   └── crates/       # Rust workspace
├── tests/            # E2E tests (Playwright)
└── docs/             # Documentation
```

## Documentation

See [docs/README.md](./docs/README.md) for detailed documentation.

## License

MIT
