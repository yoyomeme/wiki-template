# Wiki Template

A reusable, schema-first wiki system with hash-based change detection, a graphify knowledge
graph, and an interactive **Command Centre** Obsidian plugin. Designed for AI-agent maintenance.

## Two modes — pick one before setup

This template runs in either of two modes (and a hub that spans many). The biggest setup
mistake is mixing them, so decide first:

- **Code Wiki** — document an existing SDK/codebase; pages are generated from source.
- **Knowledge Vault** — a personal/business OS with entity dashboards (clients, finance,
  projects, knowledge) via the Command Centre plugin. Works on an empty/new directory.
- **Hub** — a vault that also federates other wikis on your machine (see `FEDERATION.md`).

**For agent-driven setup, follow [`SETUP_PROMPT.md`](SETUP_PROMPT.md) — it starts by picking
the mode, then branches.** The Quick Start below is the Code Wiki path; for a Knowledge Vault,
use `SETUP_PROMPT.md` Track B.

## Quick Start (Code Wiki mode)

### 1. Copy into your repo

```bash
cp -r wiki-template/ your-repo/wiki/
cd your-repo/wiki/
```

### 2. Replace placeholders

Search and replace these across all files:

| Placeholder | Replace with | Example |
|---|---|---|
| `{{PROJECT_NAME}}` | Your SDK/library name | `AuthKit`, `PaymentSDK` |
| `{{LANGUAGE}}` | Primary source language | `kotlin`, `typescript`, `swift` |
| `{{SOURCE_PATTERNS}}` | Glob patterns for source tracking | `src/**/*.kt` |
| `{{PACKAGE_NAME}}` | Top-level package/module | `com.example.sdk` |
| `{{SINGLETON_ACCESS}}` | How to access the singleton | `AuthKit.shared`, `AuthKit.getInstance()` |

```bash
# Example with sed:
find . -name '*.md' -exec sed -i '' 's/{{PROJECT_NAME}}/MySDK/g' {} +
find . -name '*.md' -exec sed -i '' 's/{{LANGUAGE}}/kotlin/g' {} +
find . -name '*.md' -exec sed -i '' 's/{{SOURCE_PATTERNS}}/src\/\*\*\/\*.kt/g' {} +
find . -name '*.md' -exec sed -i '' 's/{{PACKAGE_NAME}}/com.example.sdk/g' {} +
find . -name '*.md' -exec sed -i '' 's/{{SINGLETON_ACCESS}}/MySDK.getInstance()/g' {} +
```

### 3. Update wiki-hash.sh

Edit the `TRACK_PATTERNS` array in `wiki-hash.sh` to match your source layout:

```bash
TRACK_PATTERNS=(
  "src/**/*.kt"        # your source files
  "docs/**/*.md"       # your docs
)
```

### 4. Set up file-to-wiki mapping

Edit `.file-wiki-map.tsv` — each line maps a source path prefix to a wiki page:

```tsv
src/services/AuthService.kt	services/auth-service.md
src/types/	types/auth-types.md
```

### 5. Create the initial snapshot

```bash
bash wiki/wiki-hash.sh snapshot
```

### 6. Create your wiki pages

Use the `_template-*.md` files as starters. For each page:

1. Copy the relevant template: `cp _template-service.md my-service.md`
2. Fill in the sections following the page structure below
3. Add cross-references to related pages
4. Update `index.md` with a link to the new page

### 7. Verify

```bash
bash wiki/wiki-hash.sh status    # should say "UP TO DATE"
```

### 8. Set up daily sync (optional)

Use a scheduled task to run:

```bash
bash wiki/wiki-auto-update.sh detect
# If stale → read affected pages + source → update pages → refresh
bash wiki/wiki-auto-update.sh refresh
```

---

## Page Structure

Every wiki page follows this mandatory section order:

```
# Title

> One-line summary of what this page covers.

## Where in code
- `path/to/source/file.ext` -- brief description

## Purpose
Why this exists and what problem it solves.

## Details
Main content — code, diagrams, tables, sub-sections.

## Cross-references
- Related: [page-name](path/to/page.md)

## Gotchas
Non-obvious behavior or common pitfalls.
```

## Directory Layout

```
wiki/                    ← open this folder as an Obsidian vault
├── WIKI.md              Schema (this system's rules)
├── SCHEMA.md            Command Centre entity frontmatter contracts
├── FEDERATION.md        Hub mode: spanning many wikis
├── index.md             Navigation hub
├── overview.md          One-page synthesis
├── api-reference.md     Condensed public API lookup
├── architecture.md      Layer diagram, service topology
├── configuration.md     Init/setup, singleton pattern
├── log.md               Chronological change log
├── services/ types/ flows/ api/ security/ concepts/   Code-wiki domains
├── finance/ clients/ projects/ knowledge/             Hub-vault business domains
├── entities/            Frontmatter note templates (client, invoice, project, task, …)
├── graph/               Generated graphify graph (graph.html, GRAPH_REPORT.md, nodes/)
├── obsidian-plugin/     The Command Centre Obsidian plugin (TypeScript source)
├── .command-centre/     dashboards.yaml — hub/widget config
├── .obsidian/           Vault config (graph colors, enabled plugins)
├── .file-wiki-map.tsv   Source-to-wiki page mapping
├── .source-hashes.json  Hash baseline (auto-generated)
├── wiki-hash.sh         SHA-256 change detection
├── wiki-sync.sh         File-to-page sync
├── wiki-graph.sh        graphify orchestration (build/update/export/install-plugin)
├── wiki-federate.sh     Hub federation across many wikis
└── wiki-auto-update.sh  Daily automation driver
```

## Knowledge graph + Command Centre (Obsidian)

This template doubles as an Obsidian vault with a graphify knowledge graph and an
interactive **Command Centre** plugin (domain dashboards: Executive, Finance, Clients,
Projects, Knowledge). After the steps above:

```bash
# 1. Build the graph (semantic pass runs through the /graphify skill; see wiki-graph.sh build)
bash wiki/wiki-graph.sh build

# 2. Build + install the Command Centre plugin
cd wiki/obsidian-plugin && npm install && npm run build && cd -
bash wiki/wiki-graph.sh install-plugin

# 3. Open the wiki/ folder as an Obsidian vault, enable "Wiki Command Centre"
#    under Settings → Community plugins, and click the gauge icon.
```

Dashboards read note **frontmatter** — see [SCHEMA.md](SCHEMA.md) and the `entities/`
templates. To span many wikis from one desktop hub, see [FEDERATION.md](FEDERATION.md).

When source or curated wiki pages change, `wiki-hash.sh` flags it; `wiki-graph.sh update`
rebuilds the graph incrementally (code-only changes run headlessly; doc/wiki changes route
to `/graphify --update`).

## Naming Conventions

- **Files**: `kebab-case` matching the source type (e.g., `auth-service.md` for `AuthService.kt`)
- **Directories**: organized by domain
- **One topic per file**
- **Concept pages**: describe the idea (e.g., `concurrency-model.md`, `error-strategy.md`)
