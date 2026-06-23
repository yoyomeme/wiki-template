# {{PROJECT_NAME}} Wiki — Index

> Structured knowledge base for {{PROJECT_NAME}}.
> An Obsidian vault with a graphify knowledge graph and an interactive Command Centre.
> Purpose: enable people and AI agents to navigate, query, and maintain this knowledge.

## Command Centre

> The interactive Command Centre is the **Obsidian plugin** (gauge icon / command palette →
> "Open Command Centre") — domain dashboards over note frontmatter with a knowledge-graph
> backbone. No-plugin fallback: open [graph/graph.html](graph/graph.html) for the interactive graph.
>
> - [SCHEMA](SCHEMA.md) — entity frontmatter contracts and how dashboards auto-appear
> - [FEDERATION](FEDERATION.md) — span many wikis from one desktop hub

## Schema & maintenance

- [WIKI](WIKI.md) — three-layer model, page template, maintenance rules, hash-gated graph automation

---
<!-- ===== Code Wiki mode: sections generated from source. Delete in a pure Knowledge Vault. ===== -->

## Overview (Code Wiki)

- [overview](overview.md) — What {{PROJECT_NAME}} is, design goals, technology stack
- [architecture](architecture.md) — Layer diagram, service topology, data flow
- [configuration](configuration.md) — SDK init, singleton pattern, identity values
- [api-reference](api-reference.md) — Condensed quick lookup for all public types and methods

## Services

<!-- Add one line per service: - [service-name](services/service-name.md) — One-line description -->

## Types

<!-- Add one line per type page: - [type-name](types/type-name.md) — One-line description -->

## Flows

<!-- Add one line per flow: - [flow-name](flows/flow-name.md) — One-line description -->

## API

<!-- Add one line per API page: - [endpoint-name](api/endpoint-name.md) — One-line description -->

## Security

<!-- Add one line per security page: - [security-topic](security/security-topic.md) — One-line description -->

## Concepts

<!-- Add one line per concept: - [concept-name](concepts/concept-name.md) — One-line description -->

---
<!-- ===== Knowledge Vault mode: business domains. Dashboards auto-appear via the plugin. Delete in a pure Code Wiki. ===== -->

## Business domains (Knowledge Vault)

These folders feed the Command Centre hubs (see [SCHEMA](SCHEMA.md)). A hub appears only when
its content exists.

- **Clients** (`clients/`) → Clients hub — master list, lead stage, next actions
- **Finance** (`finance/`) → Finance hub — invoices, receivables, payables, quotes, profitability
- **Projects** (`projects/`) → Projects hub — active projects, milestones, blockers, outputs
- **Knowledge** (`knowledge/`) → Knowledge hub — SOPs, pricing, templates, case studies, replies

<!-- Tasks (type: task) and events (type: event) can live anywhere and feed the Executive hub. -->

