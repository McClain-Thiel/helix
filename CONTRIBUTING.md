# Contributing to Helix

Helix is an open-source molecular cloning & sequence design desktop app built with **Tauri 2.x** (Rust backend) and **React 19** (frontend). This guide covers everything you need to get the project running locally.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Rust** | stable (2021 edition) | [rustup.rs](https://rustup.rs/) |
| **Node.js** | >= 22.0 | `brew install node` or [nodejs.org](https://nodejs.org/) |
| **pnpm** | >= 10.0 | `npm install -g pnpm` |
| **Tauri system deps** | Tauri 2.x | See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) |

On macOS, Xcode Command Line Tools are also required (`xcode-select --install`).

## Repository Structure

```
helix/
├── apps/
│   └── desktop/              # Tauri desktop app
│       ├── src/              # React frontend (entry, layout, hooks)
│       └── src-tauri/        # Rust backend (commands, DTOs, Tauri config)
├── packages/
│   └── ui/                   # @helix/ui — shared React components
│       └── src/
│           ├── components/   # Map renderers, sequence view, common UI
│           ├── store/        # Zustand stores (editor, selection, view)
│           ├── theme/        # Design tokens, feature colors, ThemeProvider
│           └── types/        # TypeScript DTOs mirroring Rust structs
├── crates/
│   ├── helix-core/           # Sequence model, operations, search
│   ├── helix-formats/        # GenBank, FASTA parsers and serializers
│   └── helix-version/        # Delta versioning engine (SQLite)
├── Cargo.toml                # Rust workspace root
├── pnpm-workspace.yaml       # pnpm workspace config
└── package.json              # Root scripts
```

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/McClain-Thiel/helix.git
cd helix

# 2. Install Node dependencies
pnpm install

# 3. Run the dev server (starts Vite + compiles Rust + opens Tauri window)
pnpm dev
```

The first `pnpm dev` will compile all Rust crates from scratch, which takes a few minutes. Subsequent runs are incremental and fast.

## Available Commands

### From the repo root

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start Tauri dev server (Vite + Rust hot reload) |
| `pnpm build` | Production build of the desktop app |
| `pnpm test` | Run all frontend tests |
| `pnpm test:rust` | Run all Rust tests (`cargo test --workspace`) |
| `pnpm typecheck` | TypeScript type checking across all packages |
| `pnpm lint` | Run linters across all packages |

### Rust-specific

```bash
# Run all Rust tests
cargo test --workspace

# Check compilation without building
cargo check --workspace

# Format Rust code
cargo fmt --all

# Run clippy lints
cargo clippy --workspace
```

### Frontend-specific

```bash
# Type check the desktop app
cd apps/desktop && npx tsc --noEmit

# Run Vite dev server only (no Tauri)
cd apps/desktop && pnpm dev:frontend
```

## Architecture Overview

All bioinformatics computation happens in **Rust**. The React frontend is purely rendering and interaction.

```
┌─────────────────────────────────────────────┐
│  React Frontend (packages/ui + apps/desktop) │
│  - Pixi.js map renderers (imperative)        │
│  - Zustand state stores                      │
│  - Sequence text view                        │
├──────────────── Tauri IPC ───────────────────┤
│  Rust Backend (crates/ + apps/desktop/src-tauri) │
│  - Sequence parsing (GenBank, FASTA)         │
│  - Sequence operations (translate, RC, GC)   │
│  - File I/O                                  │
└─────────────────────────────────────────────┘
```

**Tauri commands** are the only bridge between Rust and the frontend. DTOs in `apps/desktop/src-tauri/src/dto.rs` are flat JSON-friendly structs that mirror the TypeScript types in `packages/ui/src/types/sequence.ts`.

**Three Zustand stores** manage frontend state:
- `editorStore` — open sequences, tabs, feature CRUD
- `selectionStore` — selection range, selected feature, cursor position
- `viewStore` — map mode, zoom/pan, visibility toggles

**Pixi.js v8** is used imperatively (not through React reconciliation). The `CircularMapRenderer` and `LinearMapRenderer` classes own the Pixi scene graph directly. React mounts a container `<div>`, and the renderer creates its own `<canvas>` inside it.

## Development Workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```

2. **Make your changes.** Key guidelines:
   - Bioinformatics logic goes in Rust (`crates/`), never in TypeScript
   - New Tauri commands go in `apps/desktop/src-tauri/src/commands/`
   - New DTOs need both a Rust struct (in `dto.rs`) and a TypeScript interface (in `packages/ui/src/types/`)
   - UI components go in `packages/ui/src/components/`
   - Use design tokens from `packages/ui/src/theme/tokens.ts` — don't hardcode colors

3. **Verify your changes:**
   ```bash
   cargo test --workspace       # Rust tests
   cargo check --workspace      # Rust compilation
   cd apps/desktop && npx tsc --noEmit  # TypeScript types
   pnpm dev                     # Manual testing
   ```

4. **Open a PR** against `main`.

## Testing

### Rust tests

Unit tests live in `#[cfg(test)] mod tests` blocks within each source file. Integration tests with real GenBank fixtures are in `crates/helix-formats/tests/`.

```bash
# Run all tests
cargo test --workspace

# Run a specific crate's tests
cargo test -p helix-core
cargo test -p helix-formats
```

### Test data

Real GenBank files for testing are in `crates/helix-formats/tests/fixtures/`. You can also place `.gb` or `.fasta` files in a `data/` folder at the repo root for manual testing with the app.

## Tauri Permissions

Tauri v2 uses a capabilities system for plugin permissions. The capability file is at `apps/desktop/src-tauri/capabilities/default.json`. If you add a new Tauri plugin, you must grant its permissions there:

```json
{
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    "shell:default",
    "your-new-plugin:default"
  ]
}
```

Without the capability grant, the frontend will get a permission denied error when calling the plugin.

## Key Constraints

- `helix-core` and `helix-formats` must not have OS-specific dependencies (they need to compile to WASM for the web portal in Phase 2)
- Don't add `anyhow` in library crates — use `thiserror` for typed errors
- Don't use React-Pixi bindings — map renderers are imperative
- Don't pass a `<canvas>` ref directly to Pixi.js — use the container div pattern (see `CircularMap.tsx`)
- GenBank positions are 1-based in files, 0-based internally (convert at parse/serialize boundary)

## License

Helix is licensed under AGPL-3.0. See the `LICENSE` file for details.
