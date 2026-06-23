# Command Centre — Entity Schema

The Command Centre plugin builds dashboards from **note frontmatter**. Every business
entity is a normal markdown note whose YAML frontmatter starts with a `type:` field. The
plugin scans all notes via Obsidian's metadataCache; the same notes are also graphify graph
nodes, so structured dashboards and the knowledge graph share one source of truth.

Starter notes live in `entities/` — copy one, drop it in the right domain folder, fill the
frontmatter. Notes missing required fields are **skipped** in a widget (not errored); each
hub shows a "N notes missing required frontmatter" hint so gaps are visible.

## Entity types

All entities support `type` (required) and `title` (defaults to the filename).

| type | fields |
|---|---|
| `client` | `stage` (lead/qualified/proposal/won/lost), `last_contact` (YYYY-MM-DD), `next_action`, `next_action_due` (date), `proposal_status`, `value` (number), `decision_makers`, `contract` (link) |
| `invoice` | `client`, `amount` (number), `status` (draft/sent/paid/overdue), `issued` (date), `due` (date) |
| `quote` / `proposal` | `client`, `amount` (number), `stage` (sent/negotiation/accepted/rejected), `date`, `project` |
| `payable` / `expense` | `vendor`, `amount` (number), `status` (paid/unpaid), `due` (date), `month` (YYYY-MM) |
| `project` | `client`, `status` (active/on-hold/done), `start` (date), `deadline` (date), `approval_status`, `blockers`, `revenue` (number), `cost` (number) |
| `milestone` / `deliverable` | `project`, `due` (date), `status` |
| `task` | `due` (date), `status` (todo/doing/waiting/done), `waiting_on`, `priority` (high/med/low), `link` |
| `meeting` | `client`/`project`, `date`, `summary`, `attendees` |
| `event` | `date` (YYYY-MM-DD) |
| `document` | `category` (tax/output/contract/…), `tags` |
| knowledge: `sop`, `template`, `pricing`, `case_study`, `credential`, `reply` | `category`, `tags` |
| `fieldwork` | `project`, `date` |

Dates must be `YYYY-MM-DD` (the plugin reads the leading date). Numbers must be unquoted.

## How hubs appear (auto-detection)

In `.command-centre/dashboards.yaml`, each hub has an optional `show_if`:

- `show_if: { entity: client }` → the hub shows only if at least one `type: client` note exists.
- `show_if: { folder: finance }` → shows only if the vault has a `finance/` folder with notes.
- no `show_if` → always shown.

The `graph` builtin hub is always available.

## Adding a hub

Append a hub to `dashboards.yaml`:

```yaml
  - id: hiring
    title: Hiring
    icon: user-plus
    show_if: { entity: candidate }
    widgets:
      - type: pipeline
        title: Candidate pipeline
        entity: candidate
        group_by: stage
        fields: [title, role, next_step]
```

Reload the Command Centre — the hub appears, no code change. Define the new entity's
frontmatter the same way (a `candidate.md` template in `entities/`).

## Widget reference

| type | purpose | key keys |
|---|---|---|
| `kpi` | single number | `agg` (sum/count), `agg_field`, `filters` |
| `table` | sortable rows, click → open note | `fields`, `filters` |
| `pipeline` | cards grouped by a stage field | `group_by`, `fields` |
| `agenda` | date-sorted upcoming list | `date_field`, `filters` |
| `list` | flat note list | `entity` |
| `vault` | file chips (document library) | `category_field`, `filters` |
| `riskflags` | highlight rows matching a rule | `rule`, `filters` |
| `query` | natural-language `graphify query` box | `hint` |

Filter ops: `equals`, `not`, `in`, `nonempty`, `lt`, `gt`, `overdue`, `within_days`.
