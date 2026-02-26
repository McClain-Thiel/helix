# AGENTS.md

Instructions for AI agents (Claude Code, Cursor, Copilot, etc.) working on this codebase.

## Project Context

Helix is an open-source molecular cloning & sequence design desktop app built with Tauri 2.x (Rust backend) + React 19 (frontend). The PRD is at `helix_prd_v03.md` and the UI mockup is at `helix-mockup.jsx`.

## Architecture Rules

1. **All bioinformatics computation happens in Rust.** The React frontend is purely rendering + interaction. Never implement sequence operations, parsing, or analysis in TypeScript.

2. **Pixi.js is used imperatively, not through React reconciliation.** The `CircularMapRenderer` class owns the Pixi scene graph directly. React creates a container `<div>`, and the renderer creates its own `<canvas>` inside it on each mount. This avoids WebGL context conflicts with React StrictMode's double-mount. Sync data via `useEffect`. Do not use React-Pixi bindings.

3. **Three Zustand stores** manage all state:
   - `editorStore` -- open sequences, tabs, feature CRUD
   - `selectionStore` -- selection range, selected feature, cursor position
   - `viewStore` -- map mode, zoom/pan, visibility toggles

4. **`helix-core` and `helix-formats` must not have OS-specific dependencies.** They need to compile to WASM for the web portal in Phase 2.

5. **Tauri commands are the only bridge between Rust and React.** DTOs in `dto.rs` are flat, JSON-friendly structs that mirror the TypeScript types in `packages/ui/src/types/sequence.ts`.

## Coding Conventions

### Rust
- Use `thiserror` for error types, not `anyhow` in library crates
- All public types derive `Serialize, Deserialize` from serde
- Tests go in `#[cfg(test)] mod tests` within each file
- Integration tests with real GenBank files go in `crates/helix-formats/tests/`
- GenBank positions are 1-based in files, 0-based internally (convert at parse/serialize boundary)

### TypeScript/React
- Functional components only, no class components
- Zustand stores in `packages/ui/src/store/`
- Design tokens from `packages/ui/src/theme/tokens.ts` -- never hardcode colors
- Feature colors via `getFeatureColor()` from `featureColors.ts`
- Path alias `@helix/ui` resolves to `packages/ui/src/` via Vite config

### Testing
- Rust: `cargo test --workspace` must pass
- TypeScript: `npx tsc --noEmit` in `apps/desktop/` must pass
- Frontend build: `npx vite build` in `apps/desktop/` must succeed

## Environment Setup

```bash
# Prerequisites: Rust (via rustup), Node.js, pnpm
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"

# Install deps
pnpm install

# Dev server (starts Vite + Tauri)
cd apps/desktop && pnpm dev
```

See `CONTRIBUTING.md` for full setup instructions.

## Key Files to Understand

| File | Purpose |
|---|---|
| `crates/helix-core/src/sequence.rs` | Core Sequence type with topology, features, metadata |
| `crates/helix-core/src/operations.rs` | Pure functions: reverse_complement, translate, gc_content, find_orfs |
| `crates/helix-formats/src/genbank.rs` | GenBank parser + serializer (most complex parser) |
| `apps/desktop/src-tauri/src/dto.rs` | Rust-to-JSON DTOs with From impls |
| `apps/desktop/src-tauri/src/commands/` | Tauri command handlers |
| `packages/ui/src/components/map/CircularMapRenderer.ts` | Imperative Pixi.js renderer |
| `packages/ui/src/store/editorStore.ts` | Primary state store for sequences and tabs |
| `packages/ui/src/theme/tokens.ts` | All design tokens (colors, fonts, radii) |
| `apps/desktop/src/App.tsx` | Root layout matching mockup |

## What NOT to Do

- Don't add React-Pixi or @pixi/react -- we render imperatively
- Don't put bioinformatics logic in TypeScript
- Don't use `anyhow` in library crates (only in the Tauri app binary)
- Don't modify the design tokens without checking the mockup (`helix-mockup.jsx`)
- Don't add heavyweight deps to `helix-core` or `helix-formats` (WASM target)
- Don't use git-based versioning for sequences -- we use structured deltas in SQLite
- Don't pass a `<canvas>` ref directly to Pixi.js -- use a container `<div>` and let the renderer create/destroy its own canvas to avoid WebGL context reuse issues with React StrictMode

## Current Status

Phase 1, Steps 1-8 complete:
1. Monorepo scaffolding
2. Rust core data model + GenBank/FASTA parsers (41 tests)
3. Tauri command bridge
4. Design system + shared UI package
5. Virtualized sequence text view
6. Pixi.js v8 circular map static PoC
7. Interactive circular map (zoom, pan, hover, selection, label displacement)
8. Linear map view (track packing, same interaction model)

Also complete: Real file-open architecture (Tauri dialog + Rust parser + store), welcome screen, multi-tab editor with file metadata tracking.

Next: Steps 9-17 (SBOL glyphs, view sync, restriction enzymes, cloning, primer design, versioning).
