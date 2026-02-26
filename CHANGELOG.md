# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0-alpha.1] - 2026-02-26

### Added

**Monorepo & Infrastructure**
- pnpm workspaces monorepo with Cargo workspace
- Tauri 2.x desktop app scaffold (`apps/desktop/`)
- Shared UI package (`packages/ui/` as `@helix/ui`)
- Plugin API type stubs (`packages/plugin-api/`)
- Phase 2 web portal placeholder (`apps/web/`)
- TypeScript path aliases (`@helix/ui` -> `packages/ui/src/`)
- Vite 6 + React 19 frontend build

**Rust Core (`crates/helix-core/`)**
- `Sequence` data model with topology (linear/circular), features, metadata
- `Feature` model with typed `FeatureType` enum, `Location` (Simple/Join/Complement), `Strand`
- Codon tables: standard genetic code (NCBI table 1) and bacterial (table 11)
- Operations: `reverse_complement`, `translate`, `gc_content`, `gc_content_windowed`
- ORF finder across all 6 reading frames
- Sequence editing: `insert_bases`, `delete_bases`, `replace_bases`
- Pattern search with circular sequence support and reverse complement matching
- Regex search support

**Parsers (`crates/helix-formats/`)**
- GenBank parser: LOCUS, DEFINITION, FEATURES (with complex locations), ORIGIN, qualifiers
- GenBank serializer with round-trip support
- FASTA parser/serializer (multi-sequence)
- Format auto-detection from content and file extension
- pUC19.gb test fixture with integration tests

**Tauri Command Bridge**
- `open_sequence_file` -- parse GenBank/FASTA files via native file dialog
- `save_sequence_file` -- write sequence data to disk
- `detect_file_format` -- identify file format from extension
- `reverse_complement`, `translate`, `gc_content` -- expose core operations
- `find_orfs` -- ORF detection with configurable minimum length
- `search_sequence` -- pattern search with circular support
- Flat DTO types (`SequenceDto`, `FeatureDto`, `MatchDto`, `OrfDto`)

**Design System (`packages/ui/src/theme/`)**
- Dark theme design tokens extracted from UI mockup
- Feature color mapping for all annotation types
- `ThemeProvider` React context
- Base color scheme: A=teal, T=red, G=amber, C=blue

**Sequence Text View (`packages/ui/src/components/sequence/`)**
- Virtualized rendering via `@tanstack/react-virtual` for large sequences
- Color-coded bases with feature highlighting
- Click+drag range selection synced to `selectionStore`
- Toggle-able complement strand display
- Toggle-able six-frame translation rows
- Position ruler

**Circular Map (`packages/ui/src/components/map/`)**
- Imperative Pixi.js v8 renderer (not React-reconciled, JBrowse 2 pattern)
- 7-layer scene graph: backbone, selection, features, enzymes, ticks, labels, center
- Feature arcs with per-type colors and direction arrows
- Selected feature glow effect
- Enzyme cut site markers (amber lines with labels)
- Center text: plasmid name, base pair count, topology
- Click hit testing for feature selection
- Container div pattern: renderer creates its own canvas per mount, avoiding WebGL context conflicts with React StrictMode

**Desktop Shell (`apps/desktop/src/`)**
- Full layout matching mockup: title bar, left sidebar, center editor, bottom panel, right panel
- View switching: circular map / linear map / sequence text
- Feature list sidebar with selection highlighting
- Properties panel showing selected feature details
- Computed panel (GC content, length)
- Enzyme grid in bottom panel
- File open via Tauri dialog

**State Management**
- `editorStore` -- sequence/tab management with open/close/activate
- `selectionStore` -- range selection, feature selection, cursor position
- `viewStore` -- map mode, zoom, pan, visibility toggles

**Version Engine Stub (`crates/helix-version/`)**
- Delta types: `SequenceOp`, `AnnotationOp`, `MetadataOp`
- `Version` and `Delta` structs for future timeline implementation

**Tests**
- 41 Rust tests passing across all crates
- GenBank parser integration test with real pUC19.gb fixture
- Round-trip test: parse -> serialize -> re-parse -> verify identical

### Fixed
- Pixi.js v8 `_cancelResize` crash caused by React StrictMode double-mount destroying an uninitialized Application
- WebGL `shaderSource` / `context already lost` errors when switching views by using container div pattern with fresh canvas per mount
- Lazy Pixi.js `Application` creation (only inside `init()`, not constructor) to prevent destroy-before-init race conditions
