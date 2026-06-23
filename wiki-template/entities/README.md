# Entity templates

Starter notes for the Command Centre dashboards. Each has a `type:` in its frontmatter —
that's what the plugin scans. Copy one into the matching domain folder and fill it in:

| template | drop into | feeds hub |
|---|---|---|
| `client.md` | `clients/` | Clients, Executive |
| `invoice.md` · `payable.md` · `quote.md` | `finance/` | Finance |
| `project.md` · `milestone.md` | `projects/` | Projects, Executive |
| `task.md` · `event.md` | anywhere | Executive |
| `document.md` | `finance/` or `projects/` | Finance (tax vault), Projects (outputs) |
| `sop.md` · `reply.md` | `knowledge/` | Knowledge |

`quote.md` doubles as `proposal`, `payable.md` as `expense`, `milestone.md` as
`deliverable`, and `sop.md` as `template`/`pricing`/`case_study`/`credential` — just change
the `type:`. Full field contracts are in [`../SCHEMA.md`](../SCHEMA.md).

These are examples — delete them once you've created real notes, or keep them in a
`_examples/` folder you exclude from the vault.
