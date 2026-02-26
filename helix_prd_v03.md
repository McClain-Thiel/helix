# Helix — Product Requirements Document v0.3

**An Open-Source Molecular Cloning & Sequence Design Platform**

| | |
|---|---|
| **Version** | 0.3 — Engineering Handoff Draft |
| **Date** | 2026-02-26 |
| **Author** | McClain Thiel |
| **License** | AGPL-3.0 |

---

## 0. Decisions Log

Resolved decisions to prevent re-litigation:

| Decision | Choice | Rationale |
|---|---|---|
| Name | Helix (working name) | Good enough for now, revisit before public launch |
| License | AGPL-3.0 | Prevents proprietary forks; community contributions stay open |
| File format standard | GenBank primary, SBOL as optional export | GenBank is what people actually use; SBOL Visual glyphs for rendering are worth adopting but full SBOL 3 data model compliance is overengineering for v1 |
| Component library hosting | Self-hosted (Supabase) | Community-owned data, not dependent on third-party API access |
| Addgene integration | Deferred | API access unclear; not blocking for v1 |
| AI features | Deferred to plugin system | Architecture accommodates it; v1 ships without it |
| Governance | Organic growth → foundation later | Don't over-structure before there's a community |
| Monorepo | Yes (pnpm workspaces) | Simplest option; no build tool lock-in |
| Desktop framework | Tauri 2.x (Rust) | Small binaries, cross-platform, good Python sidecar support |
| Map renderer | Pixi.js | See Section 8.1 for analysis |
| Python support | Sidecar (PyInstaller-bundled) for plugins + BioPython | See Section 8.3 for architecture |
| Version control backend | Custom format, not raw git | See Section 6 for rationale |

---

## 1. What Is This Document

This PRD is meant to be handed to an engineering team (or an initial set of contributors) to begin building. It contains enough specificity to start coding but flags open questions where they exist. It is intentionally opinionated about scope — things cut from v1 are listed explicitly so they don't creep back in.

### 1.1 What's Cut for v1

These are real features that real users will ask for. We are saying no to them for now:

- **AI/ML features** — No codon optimization, expression prediction, or auto-annotation. The predictions panel exists but only shows computed properties (GC content, Tm, codon stats). Plugin API is designed to accommodate these later.
- **Real-time collaboration** — No live co-editing. Sharing is read-only links. Multi-user editing is a v2 problem.
- **Sequence alignment** — No pairwise or multiple sequence alignment. Separate tools (Clustal, MUSCLE) handle this well enough. Plugin candidate.
- **Addgene integration** — No direct API. Users import GenBank files downloaded from Addgene manually.
- **Mobile support** — Desktop and web only. No iOS/Android.
- **SBOL 3 data model compliance** — We use SBOL Visual glyphs for rendering standard parts. We do not store data in SBOL 3 format internally. Import/export of SBOL files can be added later as a plugin.
- **Self-hosted server option** — The component library is cloud-hosted. We don't ship a self-hostable server in v1.
- **Batch operations / CLI tool** — Desktop app only. CLI and Python SDK are Phase 3.

### 1.2 What Engineering Needs to Know But This PRD Doesn't Cover

- **Detailed API contracts** — Tauri command signatures, REST API schemas, plugin API TypeScript definitions. These need separate design docs before implementation.
- **CI/CD and release engineering** — Auto-update strategy, code signing, platform-specific packaging. Needs its own doc.
- **Security model** — Plugin sandboxing, auth token storage, cloud API security. Needs a threat model.
- **Accessibility** — Screen reader support, keyboard navigation completeness. Needs an a11y audit plan.

---

## 2. Problem (Brief)

SnapGene costs $1,140–$3,540/year per seat. Benchling is cloud-only with data sovereignty issues. ApE is free but unmaintained and the UI is from 2005. No existing tool has a community-curated parts library or meaningful sequence versioning.

Helix fills this gap: a free, modern, open-source desktop app for molecular cloning with two features no one else has — a shared component library and plasmid version history.

---

## 3. Target Users (Prioritized)

1. **Grad students and postdocs** — Price-sensitive, do 80% of hands-on cloning, will evangelize in their labs
2. **Synbio engineers** — Need component reuse, versioning, and extensibility
3. **Lab PIs** — Make purchasing decisions, care about cost and data ownership
4. **iGEM teams** — Early adopters, community builders, will contribute parts
5. **Bioinformatics engineers** — Will build plugins and integrations (Phase 2+ users)

---

## 4. Core Features — v1

### 4.1 Sequence Viewer & Editor

The editor is the product. If the map rendering isn't at least as good as SnapGene, nothing else matters.

**Map views:**
- Circular plasmid map (the hero view — this is what people screenshot and put in papers)
- Linear map view
- Toggle between them with a single keypress
- Smooth zoom and pan (60fps target)
- Interactive feature selection — click an annotation on the map, it highlights in the sequence view and vice versa

**Sequence text view:**
- Base-level display with configurable coloring (by feature, by base identity, by reading frame)
- Six-frame translation display (toggle on/off per frame)
- ORF detection with automatic highlighting
- Find/search with regex support
- Copy sequence, reverse complement, translate selection

**Annotation management:**
- Create, edit, delete annotations with name, type, color, directionality
- SBOL Visual glyphs for standard feature types (promoter, terminator, CDS, RBS, etc.)
- Label placement that avoids overlaps (this is surprisingly hard and important)
- Feature table view for bulk editing

### 4.2 File Format Support

**Import (v1):**
- GenBank (.gb, .gbk) — primary format, must be bulletproof
- FASTA (.fa, .fasta)
- SnapGene (.dna) — use existing open-source parser (Edinburgh Genome Foundry's `snapgene_reader` as reference; port to Rust or call via Python sidecar)
- EMBL

**Export (v1):**
- GenBank (canonical output format)
- FASTA
- SVG, PNG, PDF (for map images — publication quality)

**Deferred:** SBOL import/export, .ape, Serial Cloner (.xdna), Geneious formats.

**UX details:**
- Drag-and-drop file opening
- Recent files list
- Session restore (reopen last files on launch)
- Auto-detect file format on import

### 4.3 Restriction Enzyme Analysis

- REBASE-derived enzyme database (600+ enzymes, updated periodically)
- Display cut sites on both map views and sequence view
- Filter enzymes by: cut frequency (unique cutters, 2-cutters, etc.), overhang type (blunt, 5', 3'), commercial availability, buffer compatibility
- Virtual gel electrophoresis simulation (show predicted band pattern for a given enzyme or multi-enzyme digest)
- Save custom enzyme panels ("my favorite enzymes")

### 4.4 Cloning Simulation

This is the feature set that makes Helix a real SnapGene replacement rather than just a viewer.

**Supported cloning methods (v1):**
- Restriction enzyme cloning (digest + ligate between two sequences)
- Gibson Assembly (auto-calculate overlaps, generate primers with overhangs)
- Golden Gate assembly (BsaI/BbsI type IIS enzyme workflows)
- Gateway cloning (BP and LR reactions)

**For each method:**
- Step-by-step wizard UI that guides the user through the workflow
- Compatibility checking (will these fragments ligate? are the overlaps long enough?)
- Automatic primer generation where applicable
- Result preview showing the assembled product as a new annotated sequence
- Undo/redo for all operations
- Cloning history log (what operations produced this construct)

### 4.5 Primer Design

- Manual primer placement by selecting a region on the map or sequence
- Automated primer design with constraints: target Tm, length range, max self-complementarity, GC clamp
- Primer binding site visualization on maps (small arrows)
- Primer pair management (name, sequence, Tm, notes)
- PCR product prediction
- Import/export primer lists (CSV)

---

## 5. Component Library

### 5.1 What It Is

A community-curated database of biological parts. Each part is a characterized DNA sequence with metadata. This is the "npm registry" for DNA components.

### 5.2 Data Model

```
Component {
  id:           string      // helix:prom:cmv:v1
  name:         string      // "CMV Promoter"  
  type:         enum        // promoter | terminator | ori | resistance | 
                            // tag | linker | cds | rbs | enhancer | other
  sequence:     string      // ATCG...
  length:       int         // computed
  topology:     enum        // linear | circular
  annotations:  Feature[]   // positional annotations
  organism_tags: string[]   // ["E. coli", "HEK293", "mammalian"]
  description:  string      // free text
  source: {
    origin:     string      // "Addgene #12345" | "Custom" | "iGEM BBa_K123"
    reference:  string?     // DOI or URL
    license:    string      // "OpenMTA" | "CC-BY-4.0" | "public-domain"
  }
  metadata: {
    // Extensible key-value pairs — schema evolves via community RFCs
    // Examples:
    // antibiotic_concentration: "100 µg/mL"
    // copy_number: "high"
    // inducer: "IPTG"
  }
  curation: {
    tier:       enum        // unverified | community | characterized | curated
    reviews:    int         // number of community reviews
    verified_by: string[]   // user IDs who validated
  }
  version:      string      // semver
  created_by:   string      // user ID
  created_at:   datetime
  updated_at:   datetime
}
```

### 5.3 Schema Governance

The schema is the most important thing to get community consensus on. Process:

1. **Initial schema** (above) ships with v1 — intentionally minimal
2. **`metadata` field is extensible** — communities can add domain-specific fields without schema changes
3. **Major schema changes** require a GitHub RFC with 2-week comment period
4. **Advisory group** — recruit 5–8 researchers across subfields (mammalian, microbial, plant, metabolic engineering) before launch to review initial schema

### 5.4 Hosting & Infrastructure

- **Database**: Supabase (PostgreSQL + Auth + Storage + REST API)
- **Why Supabase**: Generous free tier to start, open-source itself, easy auth, real-time subscriptions for future features, row-level security for access control
- **Read access**: Public, no auth required (anonymous API key)
- **Write access**: Requires GitHub OAuth login
- **Search**: Supabase full-text search for v1; Typesense/Meilisearch if we outgrow it

### 5.5 Contribution Flow

```
User submits part (via web portal or desktop app)
  │
  ▼
Auto-validation
  - Valid DNA sequence (ATCG only, or with standard ambiguity codes)
  - Required fields present (name, type, sequence, source)
  - Duplicate check (BLAST-like similarity search against existing parts)
  - Sequence length sanity check
  │
  ▼
Published as "unverified" (immediately searchable, marked with ○)
  │
  ▼
Community review (other users can validate, flag issues, add metadata)
  - 3+ positive reviews → "community verified" (◉)
  │
  ▼
Curator promotion (optional, for high-value parts)
  - Linked to experimental data → "characterized" (★)
  - Core maintainer reviewed → "curated" (✦)
```

### 5.6 Integration with Editor

- **Left sidebar panel**: Search the component library by name, type, organism, or free text
- **Drag-and-drop**: Drag a component from the library onto the map → inserts at the drop position with full annotations
- **Publish from editor**: Right-click any annotation → "Share as Component" → pre-fills the submission form
- **Offline cache**: Desktop app syncs a local copy of the library for offline use. Configurable: cache everything, cache favorites only, or cache nothing.

---

## 6. Sequence Versioning

### 6.1 Why Not Git Directly

We considered using libgit2 directly on JSON files. Problems:

1. **Git diffs are text-based** — A single base insertion shifts every downstream position in the sequence string. Git sees the entire sequence as changed. This makes diffs useless for understanding what biologically happened.
2. **Merge conflicts are meaningless** — Git doesn't know that a conflict at position 1847 is inside the GFP coding sequence. A biologist can't resolve a three-way merge of DNA strings.
3. **Storage overhead** — Storing full sequence strings per commit is wasteful for sequences that change by a few bases.
4. **UX mismatch** — Git's staging/commit/push model is foreign to biologists. Even a simplified wrapper leaks git concepts.

### 6.2 Custom Version Format

Instead, Helix uses a **structured delta format** stored in SQLite:

```
Version {
  id:           uuid
  sequence_id:  uuid        // which plasmid this version belongs to
  parent_id:    uuid?       // null for initial import
  branch:       string      // "main" by default
  timestamp:    datetime
  author:       string      // user or "auto"
  description:  string      // "Added His6 tag at C-terminus"
  
  delta: {
    sequence_ops: [         // ordered list of sequence operations
      { op: "insert", position: 1847, bases: "CATCACCATCACCATCAC" },
      { op: "delete", position: 892, length: 24 },
      { op: "replace", position: 500, length: 3, bases: "ATG" },
    ],
    annotation_ops: [       // annotation changes
      { op: "add", feature: { name: "His6", type: "tag", start: 1847, end: 1865, ... } },
      { op: "remove", feature_id: "feat_003" },
      { op: "modify", feature_id: "feat_001", changes: { name: "GFP-opt" } },
    ],
    metadata_ops: [         // metadata changes
      { op: "set", key: "description", value: "Added purification tag" },
    ]
  }
}
```

**Advantages:**
- Diffs are biologically meaningful ("inserted 18 bases at position 1847" vs. "entire file changed")
- Deltas are tiny (only what changed, not the whole sequence)
- Any version can be reconstructed by replaying deltas from the initial state
- Branching and comparison are straightforward operations on the delta chain
- No git concepts leak into the UI

### 6.3 User-Facing Timeline

Users see a visual timeline (described in v0.2 PRD) with these interactions:

- **Auto-versioning**: A version is automatically created when a cloning operation completes, when a file is imported, or when the user explicitly saves a version (Cmd+S triggers auto-version if changes exist)
- **Manual descriptions**: Users can add descriptions to versions ("Swapped KanR for AmpR")
- **Compare**: Select two versions → see a side-by-side map with changes highlighted (insertions in green, deletions in red, modifications in yellow)
- **Restore**: Click any version → "Restore this version" → current state becomes a new version pointing back, nothing is ever deleted
- **Branching**: "Create a variant" → forks the timeline. User picks a name. Branches are shown as visual forks in the timeline.
- **No merging in v1** — Branches are independent. If you want to combine changes from two branches, you do it manually. Merge is a v2 feature.

### 6.4 Storage

All versions are stored in a local SQLite database per project. No network required. Optional cloud sync (v2) would push the version database to Supabase.

---

## 7. UI & Interaction Design

### 7.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  [☰]  Helix   [pET28a-GFP]  [pUC19-insert]  [+]          [⚙️]  │
├──────────┬───────────────────────────────────┬───────────────────┤
│          │                                   │                   │
│  LEFT    │        MAIN EDITOR                │    RIGHT          │
│  PANEL   │                                   │    PANEL          │
│          │   ┌───────────────────────┐       │                   │
│ 🔍 Search│   │   Circular/Linear     │       │  Properties       │
│ [______] │   │   Map View            │       │  ─────────        │
│          │   │                       │       │  Name: GFP        │
│ 📦 Parts │   │      ┌──┐             │       │  Type: CDS        │
│   Library│   │     /    \            │       │  Pos: 1204-1921   │
│          │   │    │      │           │       │  Frame: +1        │
│ 📁 Files │   │     \    /            │       │                   │
│          │   │      └──┘             │       │  Computed         │
│ 🕐 Recent│   │                       │       │  ─────────        │
│          │   └───────────────────────┘       │  GC: 54.2%        │
│          │                                   │  Tm: 72.3°C       │
│          │   ┌───────────────────────┐       │  Rare codons: 3   │
│          │   │ ATGGTGAGCAAGGGCGAG   │       │                   │
│          │   │ Sequence Text View    │       │  Timeline         │
│          │   └───────────────────────┘       │  ─────────        │
│          │                                   │  ● Current        │
├──────────┴───────────────────────────────────│  ● Feb 24         │
│  Bottom: [Enzymes] [Primers] [Features]      │  ● Feb 22         │
│          [Cloning Log] [Console]             │  ● Feb 20         │
└──────────────────────────────────────────────┴───────────────────┘
```

All panels are collapsible, resizable, and rearrangeable. Positions persist across sessions.

### 7.2 Interaction Principles

**Drag-and-drop:**
- .gb/.fasta file → app window → opens the file
- Component from library → map → inserts at position
- Enzyme from enzyme panel → map → highlights cut sites

**Right-click context menus everywhere:**
- On a feature → Edit, Delete, Copy Sequence, Share as Component
- On the map background → Insert Component, Add Annotation, Set Origin
- On a restriction site → Cut Here, Show Compatible Enzymes, Simulate Digest

**Command palette (Cmd+K):**
- Search for any action, file, component, enzyme, or setting
- This is the power-user escape hatch — every action in the app is reachable from here

**Keyboard shortcuts (all customizable):**
- `Space` — toggle circular/linear view
- `Cmd+D` — toggle enzyme site display
- `Cmd+K` — command palette
- `Cmd+S` — save version
- `Cmd+Z` / `Cmd+Shift+Z` — undo/redo
- `Cmd+F` — find in sequence
- `1`–`6` — toggle reading frame display

### 7.3 Visual Design

- **Dark theme by default** with a light theme option. Many researchers work late.
- **Neutral UI chrome** — color is reserved for biological meaning (annotations, enzymes, reading frames). The UI shouldn't compete with the data.
- **Monospace font for sequences** — JetBrains Mono or similar (must render well on all platforms)
- **Annotation color palette** — Carefully chosen defaults that are distinguishable, colorblind-friendly, and not the garish SnapGene rainbow. Users can customize.
- **SBOL Visual glyphs** — Use standardized glyphs for promoters (→), terminators (T), CDS (→block), RBS (semicircle), etc. on the map. This costs nothing and makes maps immediately readable to synbio people.
- **60fps interactions** — Zoom, pan, selection must feel fluid. This is a hard requirement for the renderer.

### 7.4 The Predictions Panel (Future-Proofing)

The right panel has a "Computed" section that in v1 shows:

- GC content (overall + windowed plot)
- Codon usage statistics vs. selected organism
- Rare codon clusters
- Tm of selected region
- Repeat regions / hairpin prediction (basic thermodynamic model)

This panel is the **designated extension point for AI/ML features**. The plugin API exposes `registerPrediction()` so plugins can add cards here. Potential future cards (for plugin developers, not v1):

- Expression level prediction
- Protein thermostability (ESM-based)
- Solubility prediction
- Promoter strength
- RBS strength (Salis calculator)
- mRNA secondary structure / folding energy
- Toxicity to host organism

### 7.5 The Web Portal

Companion web app at helix.bio (or similar). Shares the same React rendering components as the desktop app.

**v1 web portal scope:**
1. **Component Library Hub** — Browse, search, submit, review parts. This is the primary contribution interface.
2. **Sequence Viewer** — Shareable links. View plasmid maps, annotations, sequence in the browser. Read-only. No editing.
3. **Auth** — GitHub OAuth. Links to desktop app for syncing component library access.

**Explicitly not in web v1:** Editing, cloning simulation, versioning, plugin system.

---

## 8. Technical Architecture

### 8.1 Map Renderer: Pixi.js

We evaluated three options:

| | Pixi.js | Custom Canvas 2D | D3.js |
|---|---|---|---|
| **Rendering engine** | WebGL (Canvas fallback) | Canvas 2D API | SVG (DOM-based) |
| **Performance at scale** | Excellent — 10K+ elements at 60fps | Good — fine for most plasmids, degrades on BACs | Poor — DOM overhead kills perf above ~1000 elements |
| **Hit detection** | Built-in (sprite-level events) | Manual (coordinate math or hidden canvas) | Built-in (DOM events) |
| **Text rendering** | Decent (BitmapText for perf) | Native (good quality) | Native (good quality) |
| **Learning curve** | Moderate (game-engine style API) | Low (vanilla API) | High (unique paradigm) |
| **Community size** | Large (game dev) | N/A | Very large (data viz) |
| **Bundle size** | ~200KB min | 0 | ~85KB min |

**Decision: Pixi.js** — The WebGL acceleration matters for smooth zoom/pan interactions on large sequences. Built-in hit detection saves significant development time (critical for interactive maps where you need to know which annotation the user clicked). The game-engine-style scene graph maps well to our rendering model (plasmid map = a scene with annotation sprites, enzyme markers, labels, etc.). D3 is the wrong tool here — it's designed for data-driven DOM manipulation, not interactive canvas graphics. Custom Canvas 2D is viable but means reimplementing hit detection, text layout, and interaction handling that Pixi gives us for free.

**Risks:** Pixi's text rendering is weaker than native Canvas — we may need BitmapText for sequence rendering and careful font atlas management. Monitor perf on low-end hardware (chromebooks used in teaching labs).

### 8.2 Stack Summary

| Layer | Technology | Notes |
|---|---|---|
| **Desktop shell** | Tauri 2.x | Rust backend, webview frontend |
| **Frontend** | React + TypeScript | Shared between desktop and web |
| **Map rendering** | Pixi.js (v8) | WebGL with Canvas fallback |
| **Bioinformatics core** | Rust | Restriction analysis, sequence ops, format parsing |
| **Local storage** | SQLite (via `rusqlite`) | Sequence metadata, version history, settings |
| **Python sidecar** | PyInstaller-bundled | For BioPython-dependent features + Python plugins |
| **Web portal** | Next.js + shared React components | Component library, sharing, auth |
| **Cloud backend** | Supabase | Component library DB, auth, storage |
| **Monorepo** | pnpm workspaces | Simple, no extra build tool |

### 8.3 Python Integration Strategy

The biology community writes Python. If we want community plugins, Python support isn't optional. But bundling a Python runtime in a desktop app is a known pain point. Here's the approach:

**Architecture: Python sidecar via PyInstaller**

```
┌────────────────────┐     IPC (JSON over stdin/stdout)     ┌──────────────────┐
│   Tauri (Rust)     │ ◄──────────────────────────────────► │  Python Sidecar  │
│                    │                                       │  (PyInstaller)   │
│  - Core editor     │                                       │  - BioPython     │
│  - Rust compute    │                                       │  - Plugin runtime│
│  - UI (React)      │                                       │  - snapgene_reader│
└────────────────────┘                                       └──────────────────┘
```

**How it works:**
1. The Python sidecar is a PyInstaller-bundled executable shipped alongside the Tauri app
2. Tauri spawns it as a child process on startup
3. Communication is JSON-RPC over stdin/stdout (Tauri's built-in sidecar IPC)
4. The sidecar provides: SnapGene .dna file parsing (via `snapgene_reader`), BioPython-dependent operations, Python plugin execution runtime

**Plugin architecture (Python):**
```python
# helix_plugin.py — Example Python plugin
from helix_sdk import Plugin, PredictionCard

class CodonOptimizer(Plugin):
    name = "Codon Optimizer"
    version = "0.1.0"
    
    def on_activate(self, context):
        context.register_prediction(
            id="codon-usage",
            name="Codon Usage Analysis",
            compute=self.analyze,
        )
    
    def analyze(self, sequence: str, organism: str) -> PredictionCard:
        # BioPython CodonUsage available here
        from Bio.SeqUtils import CodonUsage
        # ... analysis ...
        return PredictionCard(
            title="Codon Usage",
            score=0.73,
            details="..."
        )
```

**Tradeoffs acknowledged:**
- PyInstaller bundles add 30–80MB to app size (vs. our <50MB target for Tauri alone). We accept this — Python plugin support is worth the size.
- Sidecar startup adds 1–3 seconds. Mitigate by spawning lazily (only when a Python feature is first needed) and keeping the process alive.
- Cross-platform PyInstaller builds require CI for each platform. Standard but tedious.

**Alternative considered: `tauri-plugin-python` (PyO3)**
This embeds CPython directly in the Rust process via PyO3. Faster IPC (no serialization), but deployment is harder (must ship libpython, manage paths). If sidecar performance becomes a bottleneck, we can migrate to PyO3 later without changing the plugin API.

### 8.4 Repository Structure

```
helix/
├── apps/
│   ├── desktop/              # Tauri app
│   │   ├── src-tauri/        # Rust backend
│   │   └── src/              # React frontend (imports from @helix/ui)
│   ├── web/                  # Next.js web portal
│   └── python-sidecar/       # Python sidecar + plugin runtime
│       ├── helix_sidecar/    # Core sidecar code
│       ├── helix_sdk/        # SDK for Python plugin developers
│       └── pyproject.toml
├── packages/
│   ├── ui/                   # Shared React components (map, sequence view, etc.)
│   ├── core-wasm/            # Rust core compiled to WASM (for web portal)
│   └── plugin-api/           # TypeScript plugin API definitions
├── crates/
│   ├── helix-core/           # Rust bioinformatics library
│   ├── helix-formats/        # GenBank, FASTA, EMBL parsers
│   └── helix-version/        # Version/delta storage engine
├── docs/
│   ├── rfcs/                 # Architecture decision records
│   ├── plugin-guide/         # Plugin developer docs (JS + Python)
│   └── component-schema/     # Component library schema spec
├── pnpm-workspace.yaml
└── README.md
```

---

## 9. Plugin System (v1 — Foundation Only)

### 9.1 What Ships in v1

The plugin runtime and API ship in v1, but the plugin marketplace does not. v1 plugins are installed manually (drop a folder into `~/.helix/plugins/`).

### 9.2 Two Plugin Runtimes

**TypeScript plugins** — Run in an isolated JavaScript context within the Tauri webview. Best for UI extensions (new panels, visualization, context menu items).

**Python plugins** — Run in the Python sidecar process. Best for bioinformatics computation (anything that needs BioPython, NumPy, or custom ML models).

Both runtimes expose the same logical API surface:

| Extension Point | TS | Python | Example |
|---|---|---|---|
| Prediction card | ✅ | ✅ | Expression score, stability |
| Sidebar panel | ✅ | ❌ | BLAST search panel |
| File format importer | ✅ | ✅ | .ape, .xdna, SBOL |
| Context menu action | ✅ | ❌ | "Send to IDT for synthesis" |
| Command palette action | ✅ | ✅ | "Optimize codons for E. coli" |
| Analysis (headless) | ❌ | ✅ | Batch codon analysis |

### 9.3 Agent/AI Pattern (Designed Now, Built Later)

The plugin API includes a reserved `registerAgent()` method that is documented but not implemented in v1. This signals to the community that agent-based plugins are a first-class concept:

```typescript
// Reserved for v2+ — documented in plugin guide as "coming soon"
interface AgentPlugin {
  handleInstruction(
    instruction: string, 
    context: SequenceContext
  ): Promise<{
    proposedChanges: SequenceOp[];
    explanation: string;
    confidence: number;
  }>;
}
```

This accommodates future PlasmidGPT integration, natural language interfaces ("add a His-tag to the C-terminus"), and automated design agents.

---

## 10. Milestones

### Phase 1: Core Editor (Months 1–4)

**Month 1 — Foundation**
- Monorepo scaffolding (Tauri + React + pnpm workspaces)
- Rust: GenBank parser, FASTA parser, sequence data model
- React: Basic sequence text view component
- Pixi.js: Proof-of-concept circular map render (static, no interaction)

**Month 2 — Map Rendering**
- Pixi.js: Interactive circular map (zoom, pan, selection)
- Pixi.js: Linear map view
- Annotation rendering with SBOL Visual glyphs
- Label layout algorithm (non-overlapping)
- View synchronization (map ↔ sequence text)

**Month 3 — Analysis & Cloning**
- REBASE enzyme database import + restriction analysis engine (Rust)
- Enzyme site display on maps
- Virtual gel simulation
- Basic cloning: restriction digest + ligation
- Primer design tool
- Python sidecar: scaffold + SnapGene .dna import

**Month 4 — Cloning Completion + Alpha**
- Gibson Assembly wizard
- Golden Gate wizard  
- Gateway cloning
- File export (GenBank, FASTA, SVG/PNG/PDF)
- Version timeline UI (local SQLite, delta format)
- Polish: dark/light themes, keyboard shortcuts, command palette
- **Public alpha release** on GitHub

### Phase 2: Component Library + Plugins (Months 5–8)

**Month 5–6 — Web Portal & Component DB**
- Supabase setup (schema, auth, RLS policies)
- Next.js web portal: component browser, search, submission form
- Desktop app: component library sidebar, drag-and-drop insertion
- Offline component cache
- Shared map rendering component (same Pixi code in web + desktop)

**Month 7 — Plugin System**
- TypeScript plugin runtime (isolated context)
- Python plugin runtime (sidecar integration)
- Plugin API: predictions, commands, file formats
- 3 example plugins: BLAST search, codon usage table, primer quality checker
- Plugin developer documentation

**Month 8 — Versioning + Sharing**
- Full version timeline (branching, compare, restore)
- Visual diff viewer (side-by-side maps with change highlighting)
- Shareable web links (view-only plasmid maps in browser)
- **Public beta release**

### Phase 3: Polish & Community (Months 9–12)

- Community onboarding (Good First Issues, contributor docs)
- Performance optimization (large sequences, startup time)
- Component library seeding (iGEM Registry bulk import, curated standard parts)
- Plugin marketplace on web portal
- Cross-platform testing and bug fixes
- **v1.0 stable release**

---

## 11. Success Metrics (12 Months Post-Alpha)

| Metric | Target | Signal |
|---|---|---|
| GitHub stars | 5,000+ | Community interest |
| MAU (desktop) | 2,000+ | Real adoption |
| Component library parts | 200+ (50 curated) | Core value prop working |
| Community contributors | 25+ | Sustainability |
| Plugins published | 10+ | Ecosystem emerging |
| SnapGene features covered | Core cloning workflows | Practical switching feasibility |

---

## 12. Open Questions for Engineering

1. **Pixi.js v8 stability** — v8 was a major rewrite. Do we start with v8 or stick with the battle-tested v7? Need a spike.
2. **WASM compilation of Rust core** — How much of `helix-core` can compile to WASM for the web portal? Test with GenBank parser and restriction analysis first.
3. **SQLite for versioning** — Is the delta-replay approach fast enough for sequences with 100+ versions? Need benchmarks. If not, consider snapshotting every N versions.
4. **PyInstaller cross-compilation** — CI pipeline for building Python sidecar for macOS (universal), Windows (x64), Linux (x64/arm64). Who owns this?
5. **Supabase free tier limits** — At what point do we need to upgrade? Model expected traffic from component library usage.
6. **Plugin sandboxing** — How strict? TypeScript plugins in iframes? Python plugins in subprocess jails? What's the threat model?
7. **Auto-update mechanism** — Tauri has built-in updater. How do we handle the Python sidecar update separately?
8. **REBASE data licensing** — Can we redistribute the enzyme database? Need to verify NEB's terms.
9. **Label layout algorithm** — This is a surprisingly hard computational geometry problem. Existing solutions? Papers to reference?
10. **Test strategy** — Snapshot testing for map rendering? Golden file tests for parsers? How do we test cloning simulation correctness?
