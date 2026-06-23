# Federation — the desktop hub that spans all your wikis

When you run many wikis on one machine — several code repos plus personal domains (clients,
finance, projects, knowledge) — a **hub vault** can penetrate into all of them: one Obsidian
vault that spans every wiki, and one **master knowledge graph** merged from every child
graph so you can query across domains.

The hub is just an ordinary wiki (this template) with three extra pieces: a registry, the
symlinked `repos/`, and a merged `master-graph/`. Everything lives inside the hub's wiki dir,
which is the Obsidian vault.

```
<hub>/wiki/                       ← open THIS folder as the Obsidian vault
├── wiki-graph.sh wiki-hash.sh wiki-federate.sh ...
├── finance/ clients/ projects/ knowledge/    ← the hub's own domains (real folders)
├── graph/                        ← the hub's own knowledge graph
├── repos/                        ← symlinks into other repos' wiki dirs
│   ├── projectA → /…/projectA/wiki
│   └── projectB → /…/projectB/wiki
├── .wiki-roots.tsv               ← registry (created by `register`)
├── master-graph/                 ← merged master graph (graph.json, graph.html, nodes/)
├── .federation-hashes.json       ← meta-hash baseline of each child graph
└── .obsidian/plugins/wiki-command-centre/
```

## Setup

```bash
# From the hub's wiki dir:
bash wiki-federate.sh register projectA /Users/me/code/projectA/wiki
bash wiki-federate.sh register projectB /Users/me/code/projectB/wiki
bash wiki-federate.sh register finance  /Users/me/Desktop/finance/wiki --private
```

`register` appends to `.wiki-roots.tsv` and symlinks the wiki into `repos/<name>` so its
notes show up in the hub vault and its `[[links]]` join the unified Graph View. `--private`
keeps a domain as its own vault but excludes its nodes from the merged master graph.

Each child must have built its own graph first (`bash wiki-graph.sh build` in that wiki).
Then merge:

```bash
bash wiki-federate.sh build      # merge-graphs over all non-private children → master-graph/
```

Open the hub in Obsidian → the Command Centre's **Graph hub shows the federation panel**
(registry table + "Federate" button), and `master-graph/graph.html` is the cross-domain map
(nodes carry their origin domain, so you can colour/filter by source).

## Three-tier, hash-gated incrementality

The same "wiki hash check" idea applied recursively, so work is proportional to what changed:

1. **file → child graph** — a child's `wiki-hash.sh diff` gates `wiki-graph.sh update`.
2. **child graph → master graph** — `.federation-hashes.json` meta-hashes each child
   `graph.json`; `wiki-federate.sh update` re-merges **only** when some child graph changed.
   Merging is `graphify merge-graphs` — deterministic, no LLM.
3. End to end: edit a file in projectA → its graph re-extracts (LLM only if a doc changed) →
   its `graph.json` changes → meta-hash flags drift → master re-merges → hub refreshes.

```bash
bash wiki-federate.sh status     # which children drifted since the last merge
bash wiki-federate.sh update     # re-merge only if there's drift (else no-op)
```

## Obsidian notes

- The hub vault indexes all symlinked children's markdown. Each child's own `.obsidian/` is
  an ignored dotfolder — harmless.
- Obsidian must follow symlinks (default on macOS/Windows desktop).
- Don't open a child vault **and** the hub vault at the same time (overlapping config writes).
- `repos/`, `master-graph/`, `.wiki-roots.tsv`, and `.federation-hashes.json` are gitignored —
  they're machine-local wiring, not template content.
