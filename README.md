# Helix

**An open-source molecular cloning & sequence design platform.**

Helix is a free, modern desktop application for visualizing, annotating, and designing DNA sequences. It aims to replace expensive commercial tools like SnapGene ($1,140-$3,540/yr) and cloud-dependent platforms like Benchling with a fast, offline-first application built on open standards.

## What It Does

- **Circular & linear plasmid maps** rendered at 60fps with Pixi.js (WebGL)
- **Sequence text view** with color-coded bases, six-frame translation, and ORF detection
- **GenBank & FASTA** file import/export with full annotation round-trip
- **Restriction enzyme analysis** with cut site visualization and virtual gel simulation
- **Cloning simulation** -- restriction digest + ligation, Gibson Assembly, Golden Gate, Gateway
- **Primer design** with Tm calculation (nearest-neighbor method)
- **Sequence versioning** via structured deltas stored in SQLite (not raw git)
- **Community component library** for sharing characterized DNA parts (Phase 2)

## Architecture

```
Rust Backend (crates/)          React Frontend (packages/ui/)
┌─────────────────────┐        ┌──────────────────────────┐
│ helix-core           │        │ Pixi.js circular/linear  │
│   sequence model     │◄──────►│   map renderers          │
│   operations         │ Tauri  │ Virtualized sequence view │
│ helix-formats        │ IPC    │ Zustand state stores     │
│   GenBank/FASTA      │        │ Design system (tokens)   │
│ helix-version        │        └──────────────────────────┘
│   SQLite deltas      │
└─────────────────────┘
```

All bioinformatics computation happens in Rust. The React frontend is purely rendering + interaction. Tauri 2.x bridges the two layers.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2.x (Rust) |
| Frontend | React 19 + TypeScript |
| Map rendering | Pixi.js v8 (WebGL) |
| State management | Zustand 5 |
| Bioinformatics | Rust (helix-core, helix-formats) |
| Local storage | SQLite via rusqlite |
| Monorepo | pnpm workspaces + Cargo workspace |

## Getting Started

### Prerequisites

- **Rust** (1.75+): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js** (22+): via [fnm](https://github.com/Schniz/fnm), nvm, or direct install
- **pnpm** (10+): `corepack enable && corepack prepare pnpm@latest --activate`

### Development

```bash
# Install dependencies
pnpm install

# Start the desktop app (Tauri dev mode with hot reload)
pnpm dev

# Run all Rust tests
cargo test --workspace

# TypeScript typecheck
pnpm typecheck

# Build for production
pnpm build
```

### Project Structure

```
helix/
├── apps/
│   ├── desktop/           # Tauri desktop app
│   │   ├── src-tauri/     # Rust backend + Tauri commands
│   │   └── src/           # React desktop shell
│   └── web/               # Phase 2 web portal (placeholder)
├── packages/
│   ├── ui/                # @helix/ui - shared React components
│   │   ├── components/    # CircularMap, SequenceView, FeatureIcon
│   │   ├── store/         # Zustand stores (editor, selection, view)
│   │   └── theme/         # Design tokens, feature colors
│   └── plugin-api/        # TypeScript plugin API types (stub)
├── crates/
│   ├── helix-core/        # Sequence model, operations, codons, search
│   ├── helix-formats/     # GenBank, FASTA parsers + serializers
│   └── helix-version/     # SQLite delta versioning engine
└── docs/rfcs/
```

## Target Users

1. **Grad students & postdocs** -- price-sensitive, do most hands-on cloning
2. **Synbio engineers** -- need component reuse, versioning, extensibility
3. **Lab PIs** -- care about cost and data ownership
4. **iGEM teams** -- early adopters, community builders

## Roadmap

- **Phase 1** (Months 1-4): Core editor through alpha release
- **Phase 2** (Months 5-8): Component library, plugin system, web portal
- **Phase 3** (Months 9-12): Polish, community building, v1.0

## License

AGPL-3.0 -- see [LICENSE](LICENSE) for details.
# helix
# helix
