# Wiki Command Centre (Obsidian plugin)

Domain-aware business dashboards over note frontmatter, with a graphify knowledge-graph
backbone. Desktop only (it shells out to the `wiki-*.sh` scripts).

## What it does

- **Dashboards that adapt to your vault.** Hubs appear only when their content exists:
  Executive, Finance, Clients, Projects, Knowledge — plus a Graph hub that's always on.
- **Reads structured data from note frontmatter** (`type:` + fields) via Obsidian's
  metadataCache. The same notes are also graphify graph nodes. No Dataview required.
- **Config-driven.** `.command-centre/dashboards.yaml` defines each hub and its widgets.
  Add or edit hubs without touching code.
- **Interactive graph controls.** Build / Update / Refresh the graph and run natural-language
  `graphify query` from inside Obsidian. In a hub vault it also shows the federation panel.

## Build & install

```bash
npm install
npm run build        # produces main.js
```

Then copy `manifest.json`, `main.js`, `styles.css` into
`<vault>/.obsidian/plugins/wiki-command-centre/` (or run `bash ../wiki-graph.sh install-plugin`),
and enable it under Settings → Community plugins.

## Settings

- **Scripts directory** — absolute path to the wiki dir holding `wiki-graph.sh` /
  `wiki-federate.sh`. Defaults to the vault root.
- **graphify binary**, **dashboards config path**, **"today" override** (for testing date math),
  **live refresh** toggle.

## Data contract

See `../SCHEMA.md` for the frontmatter every entity type expects and how a hub auto-appears.
Notes missing required fields are skipped (not errored); a per-hub hint surfaces the gap.
