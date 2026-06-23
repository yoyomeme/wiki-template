# Wiki Template Setup Instructions

You are setting up this template into a working vault. **This template supports two modes**
— read Step 0 and pick one before doing anything else. The two modes use different parts of
the template, so doing the wrong one wastes work.

## What's in the box (so you don't get confused by the mixed contents)

This template ships artifacts for BOTH modes. That's expected — you keep the ones for your
chosen mode and delete the rest:

| Artifact | Belongs to | 
|---|---|
| `_template-*.md` (in services/types/flows/api/security/concepts) | **Code Wiki** mode |
| `api-reference.md`, `architecture.md`, `configuration.md` | **Code Wiki** mode |
| `entities/` templates, `.command-centre/dashboards.yaml`, `finance/ clients/ projects/ knowledge/` | **Knowledge Vault** mode |
| `wiki-graph.sh`, `wiki-hash.sh`, `obsidian-plugin/`, `.obsidian/`, `SCHEMA.md` | **both** |
| `wiki-federate.sh`, `FEDERATION.md`, `.wiki-roots.tsv.example` | **Hub** add-on (either mode) |

---

## Step 0 — Choose the mode (REQUIRED, do not skip)

Detect, then confirm with the user:

1. **Look at the target directory** (the place the vault will live):
   - Run `find <target> -maxdepth 3 -type f \( -name '*.kt' -o -name '*.ts' -o -name '*.swift' -o -name '*.go' -o -name '*.rs' -o -name '*.py' -o -name '*.java' -o -name '*.dart' \) | head`.
   - **Source files found** → likely **Code Wiki**.
   - **Empty or docs-only** → likely **Knowledge Vault**.
2. **Confirm with the user** before proceeding. Ask plainly:
   > "Is this vault for **(A) documenting a codebase/SDK** from its source, or **(B) a
   > personal/business knowledge vault** (clients, finance, projects, knowledge — dashboards
   > via the Command Centre plugin), or **(C) both**? And should it also be a **hub** that
   > federates other wikis on this machine?"

Then follow the matching track:
- **Mode A (Code Wiki)** → Step 1 + **Track A** + Common steps.
- **Mode B (Knowledge Vault)** → Step 1 + **Track B** + Common steps.
- **Mode C (Both)** → Step 1 + Track A + Track B + Common steps.
- **Hub** → after your track, do the **Hub add-on**.

Do NOT try to generate service/type pages from source if there is no source (Mode B). Do NOT
require entity dashboards for a pure code wiki (Mode A) — though the Command Centre's Graph
hub still works there.

## Step 1 — Install the template (all modes)

```bash
cp -r wiki-template/ <target>/wiki/
cd <target>/wiki/
```

The `wiki/` folder is the Obsidian vault. Scripts live at its root; `<target>` is the repo
root (graphify writes `graphify-out/` there).

---

## Track A — Code Wiki (document a codebase)

### A1. Analyze the codebase
Determine: **project name**, **language**, **source globs** (e.g. `src/**/*.kt`), **package
name**, **singleton access**. Scan for services/modules, public types, API endpoints,
security/crypto, key flows, cross-cutting concepts.

### A2. Replace placeholders across all files in `wiki/`
| Placeholder | Replace with |
|---|---|
| `{{PROJECT_NAME}}` | project name |
| `{{LANGUAGE}}` | language extension (`kotlin`, `typescript`, `rust`, …) |
| `{{SOURCE_PATTERNS}}` | source glob(s), e.g. `src/**/*.kt` |
| `{{PACKAGE_NAME}}` | top-level package/module |
| `{{SINGLETON_ACCESS}}` | entry-point access, e.g. `MySDK.getInstance()` |

### A3. Configure tracking
- In `wiki-hash.sh`, set `TRACK_PATTERNS` so `{{SOURCE_PATTERNS}}` becomes your real source
  globs. Keep the curated-wiki and (harmless if unused) hub-domain patterns.
- In `wiki-graph.sh`, set `GRAPH_SOURCES` to your source root(s), e.g. `GRAPH_SOURCES="src"`.
- In `.file-wiki-map.tsv`, replace the example comments with real `source_prefix<TAB>page` rows.

### A4. Generate pages
For each service/type/flow/API/security/concept: `cp` the matching `_template-*.md`, fill it
from the real source (title, where-in-code, methods/fields, examples, cross-refs, gotchas).
Then fill `overview.md`, `architecture.md`, `configuration.md`, `api-reference.md`, and link
everything in `index.md`. **Delete the `_template-*.md` starters and the `entities/` folder
and business-domain folders you aren't using.**

→ Continue to **Common steps**.

---

## Track B — Knowledge Vault (personal / business OS, works on an empty dir)

There is no source code to read here — the content is notes you (or the user) author, and the
**Command Centre plugin** renders dashboards from their frontmatter.

### B1. Name and trim
- Replace `{{PROJECT_NAME}}` with the vault name (e.g. "Ultimate Brain"). The other
  placeholders are code-oriented — set them to `n/a` or delete the code-only top pages
  (`api-reference.md`, `architecture.md`, `configuration.md`) and the
  `services/ types/ flows/ api/ security/ concepts/` folders if you won't use them.
- **Delete the `_template-*.md` starters.**

### B2. Set the graph corpus to the notes (not source)
- In `wiki-graph.sh`, set `GRAPH_SOURCES=""` (empty — there is no code). The corpus is the
  curated wiki + business domains, already in `CURATED_WIKI`.
- In `wiki-hash.sh`, remove the `{{SOURCE_PATTERNS}}` line from `TRACK_PATTERNS` (keep the
  `wiki/finance/** wiki/clients/** wiki/projects/** wiki/knowledge/**` lines).
- `.file-wiki-map.tsv` can stay empty/commented (no source→page mapping needed).

### B3. Create the domains and first notes
- Create the domain folders you need: `mkdir -p finance clients projects knowledge`.
- Seed real notes by copying from `entities/` (see `SCHEMA.md` for every field):
  - clients → `entities/client.md`; finance → `invoice.md` / `payable.md` / `quote.md`;
    projects → `project.md` / `milestone.md`; tasks/events anywhere → `task.md` / `event.md`;
    knowledge → `sop.md` / `reply.md`.
  - Each note's frontmatter `type:` is what the dashboards read. Fill at least the fields the
    widgets use (e.g. a `client` needs `stage`, `next_action_due`, `value`).
- **Keep `entities/` as a reference, or move it to `entities/_examples/`** — delete the sample
  notes once you've created real ones so they don't pollute dashboards.

### B4. Tune the dashboards (optional)
- `.command-centre/dashboards.yaml` already defines Executive / Finance / Clients / Projects /
  Knowledge. A hub only appears when its content exists (`show_if`). Delete hubs you don't
  want, or add your own (see `SCHEMA.md` → "Adding a hub").

→ Continue to **Common steps**.

---

## Common steps (all modes)

### C1. Build the knowledge graph
The semantic pass (over docs/notes) needs the LLM, so it runs through the `/graphify` skill:

```bash
bash wiki/wiki-graph.sh build      # prints the exact /graphify command for your corpus
# run that /graphify command, then:
bash wiki/wiki-graph.sh export     # publish into wiki/graph/
bash wiki/wiki-graph.sh refresh    # snapshot the hash baseline
```

(Code Wiki with only code changes can later update headlessly via `wiki-graph.sh update`.)

### C2. Build + install the Command Centre plugin

```bash
cd wiki/obsidian-plugin && npm install && npm run build && cd -
bash wiki/wiki-graph.sh install-plugin
```

### C3. Open in Obsidian
Open the `wiki/` folder as a vault → enable **Wiki Command Centre** under Settings →
Community plugins → click the gauge icon. In Mode B you'll see your business hubs; in Mode A
the Graph hub with god-nodes and a query box.

### C4. Initial snapshot + log
```bash
bash wiki/wiki-hash.sh snapshot
```
Add a dated entry to `wiki/log.md` describing what was created (mode, page/note count, corpus).

### C5. Verify
1. `bash wiki/wiki-hash.sh status` → **UP TO DATE**
2. `bash wiki/wiki-graph.sh status` → graph published, not stale
3. Mode A: every `index.md` link resolves; cross-references point to real files.
4. Mode B: open the Command Centre → the right hubs appear and show your notes.
5. Report the final structure to the user.

---

## Hub add-on (federate many wikis from one desktop vault)

Do this only if the user wants one vault to span several others. From the hub's `wiki/` dir:

```bash
bash wiki-federate.sh register projectA /path/to/projectA/wiki
bash wiki-federate.sh register finance  /path/to/finance/wiki --private   # excluded from master graph
bash wiki-federate.sh build       # merge every child graph.json → master-graph/
```

This symlinks each wiki into `repos/<name>` (one unified Obsidian Graph View) and merges
their graphs. See `FEDERATION.md` for the full lifecycle and the three-tier incremental flow.
