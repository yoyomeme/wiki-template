import { App, parseYaml } from "obsidian";

export type WidgetType =
  | "kpi"
  | "table"
  | "pipeline"
  | "agenda"
  | "list"
  | "vault"
  | "riskflags"
  | "query";

export interface FilterRule {
  field: string;
  // one of: equals / in / not / lt / gt / nonempty / before_today / overdue / within_days
  op: string;
  value?: any;
}

export interface WidgetDef {
  type: WidgetType;
  title: string;
  entity?: string; // entity type this widget reads (e.g. "client")
  fields?: string[]; // columns for table / fields to show
  group_by?: string; // pipeline column field
  date_field?: string; // agenda / date math
  filters?: FilterRule[];
  agg?: "sum" | "count"; // kpi aggregation
  agg_field?: string; // field to sum
  category_field?: string; // list/vault grouping (e.g. "category")
  rule?: FilterRule; // riskflags highlight rule
  hint?: string; // freeform helper text
}

export interface HubDef {
  id: string;
  title: string;
  icon?: string;
  // show_if: { folder: "finance" } or { entity: "client" } — omit to always show.
  show_if?: { folder?: string; entity?: string };
  widgets: WidgetDef[];
  builtin?: "graph"; // special non-data hub
}

export interface DashboardsConfig {
  hubs: HubDef[];
}

/** Load dashboards.yaml from the vault; fall back to the built-in defaults. */
export async function loadDashboards(app: App, relPath: string): Promise<DashboardsConfig> {
  try {
    if (await app.vault.adapter.exists(relPath)) {
      const raw = await app.vault.adapter.read(relPath);
      const parsed = parseYaml(raw) as DashboardsConfig;
      if (parsed && Array.isArray(parsed.hubs) && parsed.hubs.length) {
        // Always keep the Graph hub available even if the user omitted it.
        if (!parsed.hubs.some((h) => h.builtin === "graph")) {
          parsed.hubs.push(GRAPH_HUB);
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error("[command-centre] failed to parse dashboards.yaml:", e);
  }
  return { hubs: DEFAULT_HUBS };
}

export const GRAPH_HUB: HubDef = {
  id: "graph",
  title: "Graph",
  icon: "git-fork",
  builtin: "graph",
  widgets: [],
};

export const DEFAULT_HUBS: HubDef[] = [
  {
    id: "executive",
    title: "Executive",
    icon: "gauge",
    widgets: [
      {
        type: "table",
        title: "Today's priorities",
        entity: "task",
        fields: ["title", "due", "priority", "link"],
        filters: [
          { field: "status", op: "not", value: "done" },
          { field: "due", op: "within_days", value: 0 },
        ],
      },
      {
        type: "riskflags",
        title: "Overdue tasks",
        entity: "task",
        fields: ["title", "due", "link"],
        rule: { field: "due", op: "overdue" },
        filters: [{ field: "status", op: "not", value: "done" }],
      },
      {
        type: "table",
        title: "Waiting for reply",
        entity: "task",
        fields: ["title", "waiting_on", "due"],
        filters: [{ field: "status", op: "equals", value: "waiting" }],
      },
      {
        type: "agenda",
        title: "This week",
        entity: "event",
        date_field: "date",
        filters: [{ field: "date", op: "within_days", value: 7 }],
      },
      {
        type: "pipeline",
        title: "Proposal pipeline",
        entity: "proposal",
        group_by: "stage",
        fields: ["title", "client", "amount"],
      },
      {
        type: "riskflags",
        title: "Project risk flags",
        entity: "project",
        fields: ["title", "client", "deadline", "blockers"],
        rule: { field: "blockers", op: "nonempty" },
      },
    ],
  },
  {
    id: "finance",
    title: "Finance",
    icon: "dollar-sign",
    show_if: { folder: "finance" },
    widgets: [
      { type: "kpi", title: "Receivables", entity: "invoice", agg: "sum", agg_field: "amount", filters: [{ field: "status", op: "in", value: ["sent", "overdue"] }] },
      { type: "kpi", title: "Payables", entity: "payable", agg: "sum", agg_field: "amount", filters: [{ field: "status", op: "not", value: "paid" }] },
      { type: "kpi", title: "Revenue (paid)", entity: "invoice", agg: "sum", agg_field: "amount", filters: [{ field: "status", op: "equals", value: "paid" }] },
      { type: "table", title: "Invoice status", entity: "invoice", fields: ["title", "client", "amount", "status", "due"] },
      { type: "pipeline", title: "Quote tracker", entity: "quote", group_by: "stage", fields: ["title", "client", "amount"] },
      { type: "table", title: "Project profitability", entity: "project", fields: ["title", "revenue", "cost"] },
      { type: "vault", title: "Tax document vault", entity: "document", category_field: "category", filters: [{ field: "category", op: "equals", value: "tax" }] },
    ],
  },
  {
    id: "client",
    title: "Clients",
    icon: "users",
    show_if: { entity: "client" },
    widgets: [
      { type: "table", title: "Master client list", entity: "client", fields: ["title", "stage", "last_contact", "next_action", "next_action_due", "proposal_status", "value"] },
      { type: "pipeline", title: "Lead stage", entity: "client", group_by: "stage", fields: ["title", "next_action", "value"] },
      { type: "query", title: "Ask about a client", hint: "e.g. Which clients are connected to Project Atlas?" },
    ],
  },
  {
    id: "projects",
    title: "Projects",
    icon: "folder-kanban",
    show_if: { entity: "project" },
    widgets: [
      { type: "table", title: "Active projects", entity: "project", fields: ["title", "client", "status", "deadline", "approval_status"], filters: [{ field: "status", op: "equals", value: "active" }] },
      { type: "agenda", title: "Milestones & deliverables", entity: "milestone", date_field: "due", fields: ["title", "project", "status"] },
      { type: "riskflags", title: "Blockers", entity: "project", fields: ["title", "blockers"], rule: { field: "blockers", op: "nonempty" } },
      { type: "list", title: "Fieldwork logs", entity: "fieldwork" },
      { type: "vault", title: "Output documents", entity: "document", category_field: "category", filters: [{ field: "category", op: "equals", value: "output" }] },
    ],
  },
  {
    id: "knowledge",
    title: "Knowledge",
    icon: "book-open",
    show_if: { folder: "knowledge" },
    widgets: [
      { type: "list", title: "SOPs", entity: "sop" },
      { type: "list", title: "Pricing models", entity: "pricing" },
      { type: "list", title: "Proposal templates", entity: "template" },
      { type: "list", title: "Case studies", entity: "case_study" },
      { type: "list", title: "Reply snippets", entity: "reply" },
      { type: "query", title: "Search the knowledge base", hint: "e.g. What's our scope boundary for fixed-price engagements?" },
    ],
  },
  GRAPH_HUB,
];
