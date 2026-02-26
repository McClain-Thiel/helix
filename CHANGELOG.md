# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0-alpha.2] - 2026-02-26

### Added

**Component Database (`crates/helix-components/`)**
- New `helix-components` crate with SQLite-backed component storage
- 164 built-in components (67 DNA, 97 protein) converted from ApE default features
- CSV seed data at `crates/helix-components/data/components.csv`
- Categories: promoter, cds, terminator, ori, resistance, primer, recombination, misc, signal_peptide
- CRUD operations via `ComponentDb` (list, get, insert by category)

**Auto-Annotation Engine**
- Banded Smith-Waterman local alignment (`crates/helix-core/src/alignment.rs`) with affine gap penalties
- Both-strand alignment (forward + reverse complement)
- Annotation orchestrator (`crates/helix-components/src/annotate.rs`): configurable identity/coverage thresholds, overlap resolution via greedy interval scheduling
- Tauri commands: `list_components`, `auto_annotate`
- DTO types: `ComponentDto`, `AnnotationHitDto`

**Component Library Sidebar**
- Left sidebar component library with expandable categories sorted by type
- Search bar for filtering components by name
- Auto-Annotate button (runs SW alignment against all DNA components)
- Annotation hits panel with per-hit apply and bulk apply-all
- Hits display identity %, position range, and strand direction

**Empty Sequence Handling**
- Circular map renders visible teal-tinted backbone ring for empty sequences
- Center text shows "Empty sequence" with "Paste or import a sequence to begin" hint
- Linear map renders placeholder backbone with name and hint text
- Guards against NaN from division by zero in position calculations

### Fixed
- ResizeObserver not attaching when transitioning from welcome screen to editor (empty `[]` dependency)
- Tab bar + button dropdown clipped by `overflow: hidden` (now uses `position: fixed`)
- Division by zero in `CircularMapRenderer.angleFor()` and `LinearMapRenderer.posToX()` for empty sequences
- 3 pre-existing alignment test assertions that were too strict for local alignment behavior

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
- 7-layer scene graph: backbone, selection, features, ticks, labels, center
- Feature arcs with per-type colors and direction arrows
- Selected feature glow effect (wider stroke + outer glow)
- Center text: plasmid name, base pair count, topology
- Container div pattern: renderer creates its own canvas per mount, avoiding WebGL context conflicts with React StrictMode
- Interactive zoom (scroll wheel, 0.8x-2.5x), pan (click-drag), hover effects
- Feature click hit testing for selection
- Label displacement algorithm with leader lines to resolve overlaps
- Angular padding on feature arcs to eliminate gaps between adjacent annotations

**Linear Map (`packages/ui/src/components/map/`)**
- Imperative Pixi.js v8 renderer matching circular map interaction model
- Horizontal backbone with tick marks and position labels
- Track packing algorithm: features sorted by start, assigned to first non-overlapping row
- Colored rounded-rect features with direction arrows and labels
- Zoom-toward-cursor with panX adjustment
- Same event/selection model as circular map

**Desktop Shell (`apps/desktop/src/`)**
- Welcome screen with Open File / New Sequence buttons and keyboard hints
- Full layout: title bar with tab bar, left sidebar, center editor, bottom panel, right panel
- Store-driven tab bar with click-to-switch, close buttons, dirty indicators
- View switching: circular map / linear map / sequence text (Space key toggles map/linear)
- Feature list sidebar with selection highlighting
- Properties panel showing selected feature details
- Computed panel (GC content bar, length, feature count, file format)
- Feature grid in bottom panel
- File open via Tauri native dialog (Cmd+O) with format filtering
- New sequence creation (Cmd+N), close tab (Cmd+W)
- Error banner for failed file opens
- ResizeObserver-based responsive map sizing

**File Open Architecture**
- `open_sequence_file` returns `OpenFileResult` with all sequences, file path, and format
- Content-based format detection with extension fallback
- Multi-sequence support (FASTA files, capped at 10)
- `EditorTab` tracks `filePath` and `fileFormat` per tab
- Sequence cleanup on tab close (removes from store when unreferenced)
- Tauri v2 capabilities configured for dialog, fs, and shell plugins

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
- Gaps between adjacent feature arcs on circular map (angular padding fix)
- Label overlaps on circular map (displacement algorithm with leader lines)
- Inconsistent arc radius between backbone and features (unified `midR`)
- Circular map rendering in small square frame (now fills full editor area)
- `FileFormat` visibility error in Rust (use `helix_formats::FileFormat`, not private `detect::FileFormat`)
- Tauri v2 dialog permission denied (`capabilities/default.json` was missing)
