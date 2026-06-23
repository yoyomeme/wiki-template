var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => WikiCommandCentrePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  scriptsDir: "",
  graphifyBin: "graphify",
  todayOverride: "",
  liveRefresh: true,
  dashboardsConfig: ".command-centre/dashboards.yaml"
};
var CommandCentreSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Wiki Command Centre" });
    new import_obsidian.Setting(containerEl).setName("Scripts directory").setDesc("Absolute path to the wiki dir containing wiki-graph.sh / wiki-federate.sh. Leave blank to use the vault root.").addText(
      (t) => t.setPlaceholder("/Users/me/Desktop/knowledge/wiki").setValue(this.plugin.settings.scriptsDir).onChange(async (v) => {
        this.plugin.settings.scriptsDir = v.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("graphify binary").setDesc("Path or name of the graphify executable used for queries.").addText(
      (t) => t.setValue(this.plugin.settings.graphifyBin).onChange(async (v) => {
        this.plugin.settings.graphifyBin = v.trim() || "graphify";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Dashboards config").setDesc("Vault-relative path to dashboards.yaml.").addText(
      (t) => t.setValue(this.plugin.settings.dashboardsConfig).onChange(async (v) => {
        this.plugin.settings.dashboardsConfig = v.trim() || DEFAULT_SETTINGS.dashboardsConfig;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName('"Today" override').setDesc("Optional YYYY-MM-DD used as today for overdue/this-week calculations. Blank = real date.").addText(
      (t) => t.setPlaceholder("2026-06-23").setValue(this.plugin.settings.todayOverride).onChange(async (v) => {
        this.plugin.settings.todayOverride = v.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Live refresh").setDesc("Re-render dashboards when note frontmatter changes.").addToggle(
      (t) => t.setValue(this.plugin.settings.liveRefresh).onChange(async (v) => {
        this.plugin.settings.liveRefresh = v;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/runner.ts
var import_child_process = require("child_process");
function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child;
    try {
      child = (0, import_child_process.spawn)(cmd, args, { cwd, shell: false });
    } catch (e) {
      resolve({ code: -1, stdout: "", stderr: String(e) });
      return;
    }
    child.stdout?.on("data", (d) => stdout += d.toString());
    child.stderr?.on("data", (d) => stderr += d.toString());
    child.on("error", (e) => resolve({ code: -1, stdout, stderr: stderr + String(e) }));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}
var SAFE_DIR = /^[A-Za-z0-9 _./~-]+$/;
var Runner = class {
  constructor(scriptsDir, graphifyBin) {
    this.scriptsDir = scriptsDir;
    this.graphifyBin = graphifyBin;
  }
  dirOk() {
    return this.scriptsDir.length > 0 && SAFE_DIR.test(this.scriptsDir);
  }
  sh(script, args) {
    if (!this.dirOk()) {
      return Promise.resolve({
        code: -1,
        stdout: "",
        stderr: `Scripts directory is empty or contains unsafe characters: "${this.scriptsDir}". Set a valid absolute path in the plugin settings.`
      });
    }
    return run("bash", [`${this.scriptsDir}/${script}`, ...args], this.scriptsDir);
  }
  graphStatus() {
    return this.sh("wiki-graph.sh", ["status", "--json"]);
  }
  graphBuild() {
    return this.sh("wiki-graph.sh", ["build"]);
  }
  graphUpdate() {
    return this.sh("wiki-graph.sh", ["update"]);
  }
  graphRefresh() {
    return this.sh("wiki-graph.sh", ["refresh"]);
  }
  federateStatus() {
    return this.sh("wiki-federate.sh", ["status", "--json"]);
  }
  federateUpdate() {
    return this.sh("wiki-federate.sh", ["update"]);
  }
  federateBuild() {
    return this.sh("wiki-federate.sh", ["build"]);
  }
  /**
   * Run a natural-language query against the built graph. Delegated to wiki-graph.sh, which
   * runs `graphify query` from the directory where graphify-out/graph.json lives.
   */
  query(question) {
    return this.sh("wiki-graph.sh", ["query", question]);
  }
};

// src/view.ts
var import_obsidian4 = require("obsidian");

// src/config.ts
var import_obsidian2 = require("obsidian");
async function loadDashboards(app, relPath) {
  try {
    if (await app.vault.adapter.exists(relPath)) {
      const raw = await app.vault.adapter.read(relPath);
      const parsed = (0, import_obsidian2.parseYaml)(raw);
      if (parsed && Array.isArray(parsed.hubs) && parsed.hubs.length) {
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
var GRAPH_HUB = {
  id: "graph",
  title: "Graph",
  icon: "git-fork",
  builtin: "graph",
  widgets: []
};
var DEFAULT_HUBS = [
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
          { field: "due", op: "within_days", value: 0 }
        ]
      },
      {
        type: "riskflags",
        title: "Overdue tasks",
        entity: "task",
        fields: ["title", "due", "link"],
        rule: { field: "due", op: "overdue" },
        filters: [{ field: "status", op: "not", value: "done" }]
      },
      {
        type: "table",
        title: "Waiting for reply",
        entity: "task",
        fields: ["title", "waiting_on", "due"],
        filters: [{ field: "status", op: "equals", value: "waiting" }]
      },
      {
        type: "agenda",
        title: "This week",
        entity: "event",
        date_field: "date",
        filters: [{ field: "date", op: "within_days", value: 7 }]
      },
      {
        type: "pipeline",
        title: "Proposal pipeline",
        entity: "proposal",
        group_by: "stage",
        fields: ["title", "client", "amount"]
      },
      {
        type: "riskflags",
        title: "Project risk flags",
        entity: "project",
        fields: ["title", "client", "deadline", "blockers"],
        rule: { field: "blockers", op: "nonempty" }
      }
    ]
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
      { type: "vault", title: "Tax document vault", entity: "document", category_field: "category", filters: [{ field: "category", op: "equals", value: "tax" }] }
    ]
  },
  {
    id: "client",
    title: "Clients",
    icon: "users",
    show_if: { entity: "client" },
    widgets: [
      { type: "table", title: "Master client list", entity: "client", fields: ["title", "stage", "last_contact", "next_action", "next_action_due", "proposal_status", "value"] },
      { type: "pipeline", title: "Lead stage", entity: "client", group_by: "stage", fields: ["title", "next_action", "value"] },
      { type: "query", title: "Ask about a client", hint: "e.g. Which clients are connected to Project Atlas?" }
    ]
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
      { type: "vault", title: "Output documents", entity: "document", category_field: "category", filters: [{ field: "category", op: "equals", value: "output" }] }
    ]
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
      { type: "query", title: "Search the knowledge base", hint: "e.g. What's our scope boundary for fixed-price engagements?" }
    ]
  },
  GRAPH_HUB
];

// src/entities.ts
function scanEntities(app) {
  const out = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (!fm || !fm.type)
      continue;
    out.push({
      file,
      type: String(fm.type),
      title: String(fm.title ?? file.basename),
      fm
    });
  }
  return out;
}
function byType(entities, type) {
  if (!type)
    return entities;
  return entities.filter((e) => e.type === type);
}
function distinctTypes(entities) {
  return new Set(entities.map((e) => e.type));
}
function today(override) {
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
    return /* @__PURE__ */ new Date(override + "T00:00:00");
  }
  const n = /* @__PURE__ */ new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function parseDate(v) {
  if (!v)
    return null;
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m)
    return null;
  const d = /* @__PURE__ */ new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}
function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 864e5);
}
function matchesRule(e, rule, now) {
  const raw = e.fm[rule.field];
  switch (rule.op) {
    case "equals":
      return String(raw ?? "") === String(rule.value ?? "");
    case "not":
      return String(raw ?? "") !== String(rule.value ?? "");
    case "in":
      return Array.isArray(rule.value) && rule.value.map(String).includes(String(raw ?? ""));
    case "nonempty":
      return raw != null && String(raw).trim() !== "" && !(Array.isArray(raw) && raw.length === 0);
    case "lt":
      return Number(raw) < Number(rule.value);
    case "gt":
      return Number(raw) > Number(rule.value);
    case "overdue": {
      const d = parseDate(raw);
      return d != null && d.getTime() < now.getTime();
    }
    case "within_days": {
      const d = parseDate(raw);
      if (!d)
        return false;
      const diff = daysBetween(now, d);
      return diff >= 0 && diff <= Number(rule.value ?? 0);
    }
    default:
      return true;
  }
}
function applyFilters(entities, filters, now) {
  if (!filters || !filters.length)
    return entities;
  return entities.filter((e) => filters.every((f) => matchesRule(e, f, now)));
}
function sumField(entities, field) {
  return entities.reduce((acc, e) => {
    const n = Number(e.fm[field]);
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
}
function groupBy(entities, field) {
  const m = /* @__PURE__ */ new Map();
  for (const e of entities) {
    const key = String(e.fm[field] ?? "\u2014");
    if (!m.has(key))
      m.set(key, []);
    m.get(key).push(e);
  }
  return m;
}
function missingFieldCount(entities, entityType, required) {
  return byType(entities, entityType).filter(
    (e) => required.some((f) => e.fm[f] == null || String(e.fm[f]).trim() === "")
  ).length;
}

// src/widgets.ts
var import_obsidian3 = require("obsidian");
function fmtNum(n) {
  return n.toLocaleString(void 0, { maximumFractionDigits: 2 });
}
function cellText(e, field) {
  if (field === "title")
    return e.title;
  const v = e.fm[field];
  if (v == null)
    return "";
  if (Array.isArray(v))
    return v.join(", ");
  return String(v);
}
function renderWidget(parent, w, ctx) {
  const card = parent.createDiv({ cls: "cc-widget" });
  card.createEl("h3", { text: w.title, cls: "cc-widget-title" });
  try {
    switch (w.type) {
      case "kpi":
        return renderKpi(card, w, ctx);
      case "table":
        return renderTable(card, w, ctx);
      case "pipeline":
        return renderPipeline(card, w, ctx);
      case "agenda":
        return renderAgenda(card, w, ctx);
      case "list":
        return renderList(card, w, ctx);
      case "vault":
        return renderVault(card, w, ctx);
      case "riskflags":
        return renderRiskflags(card, w, ctx);
      case "query":
        return renderQuery(card, w, ctx);
      default:
        card.createEl("p", { cls: "cc-warn", text: `Unknown widget type: ${w.type}` });
    }
  } catch (e) {
    card.createEl("p", { cls: "cc-warn", text: `Widget error: ${String(e)}` });
  }
}
function rows(w, ctx) {
  return applyFilters(byType(ctx.entities, w.entity), w.filters, ctx.now);
}
function emptyHint(card, w) {
  card.createEl("p", { cls: "cc-empty", text: w.entity ? `No ${w.entity} notes match.` : "Nothing to show." });
}
function renderKpi(card, w, ctx) {
  const data = rows(w, ctx);
  let value;
  if (w.agg === "sum" && w.agg_field)
    value = sumField(data, w.agg_field);
  else
    value = data.length;
  card.createDiv({ cls: "cc-kpi-value", text: fmtNum(value) });
  card.createDiv({ cls: "cc-kpi-sub", text: `${data.length} ${w.entity ?? "item"}(s)` });
}
function renderTable(card, w, ctx) {
  const data = rows(w, ctx);
  if (!data.length)
    return emptyHint(card, w);
  const fields = w.fields ?? ["title"];
  const table = card.createEl("table", { cls: "cc-table" });
  const head = table.createEl("thead").createEl("tr");
  for (const f of fields)
    head.createEl("th", { text: f });
  const body = table.createEl("tbody");
  for (const e of data) {
    const tr = body.createEl("tr", { cls: "cc-row" });
    for (const f of fields)
      tr.createEl("td", { text: cellText(e, f) });
    tr.addEventListener("click", () => ctx.openNote(e.file));
  }
}
function renderPipeline(card, w, ctx) {
  const data = rows(w, ctx);
  if (!data.length)
    return emptyHint(card, w);
  const groups = groupBy(data, w.group_by ?? "stage");
  const board = card.createDiv({ cls: "cc-pipeline" });
  for (const [stage, items] of groups) {
    const col = board.createDiv({ cls: "cc-col" });
    col.createDiv({ cls: "cc-col-head", text: `${stage} (${items.length})` });
    for (const e of items) {
      const cardEl = col.createDiv({ cls: "cc-card", text: e.title });
      const sub = (w.fields ?? []).filter((f) => f !== "title").map((f) => cellText(e, f)).filter(Boolean).join(" \xB7 ");
      if (sub)
        cardEl.createDiv({ cls: "cc-card-sub", text: sub });
      cardEl.addEventListener("click", () => ctx.openNote(e.file));
    }
  }
}
function renderAgenda(card, w, ctx) {
  const field = w.date_field ?? "due";
  const data = rows(w, ctx).map((e) => ({ e, d: parseDate(e.fm[field]) })).filter((x) => x.d != null).sort((a, b) => a.d.getTime() - b.d.getTime());
  if (!data.length)
    return emptyHint(card, w);
  const ul = card.createEl("ul", { cls: "cc-agenda" });
  for (const { e, d } of data) {
    const li = ul.createEl("li", { cls: "cc-row" });
    li.createSpan({ cls: "cc-date", text: d.toISOString().slice(0, 10) });
    li.createSpan({ text: " " + e.title });
    li.addEventListener("click", () => ctx.openNote(e.file));
  }
}
function renderList(card, w, ctx) {
  const data = rows(w, ctx);
  if (!data.length)
    return emptyHint(card, w);
  const ul = card.createEl("ul", { cls: "cc-list" });
  for (const e of data) {
    const li = ul.createEl("li", { cls: "cc-row", text: e.title });
    li.addEventListener("click", () => ctx.openNote(e.file));
  }
}
function renderVault(card, w, ctx) {
  const data = rows(w, ctx);
  if (!data.length)
    return emptyHint(card, w);
  const wrap = card.createDiv({ cls: "cc-vault" });
  for (const e of data) {
    const chip = wrap.createDiv({ cls: "cc-chip" });
    (0, import_obsidian3.setIcon)(chip.createSpan({ cls: "cc-chip-icon" }), "file-text");
    chip.createSpan({ text: e.title });
    chip.addEventListener("click", () => ctx.openNote(e.file));
  }
}
function renderRiskflags(card, w, ctx) {
  let data = rows(w, ctx);
  if (w.rule)
    data = data.filter((e) => matchesRule(e, w.rule, ctx.now));
  if (!data.length) {
    card.createEl("p", { cls: "cc-ok", text: "\u2713 No flags." });
    return;
  }
  const fields = w.fields ?? ["title"];
  for (const e of data) {
    const flag = card.createDiv({ cls: "cc-flag cc-row" });
    flag.createSpan({ cls: "cc-flag-title", text: e.title });
    const detail = fields.filter((f) => f !== "title").map((f) => cellText(e, f)).filter(Boolean).join(" \xB7 ");
    if (detail)
      flag.createSpan({ cls: "cc-flag-detail", text: " \u2014 " + detail });
    flag.addEventListener("click", () => ctx.openNote(e.file));
  }
}
function renderQuery(card, w, ctx) {
  if (w.hint)
    card.createEl("p", { cls: "cc-empty", text: w.hint });
  const bar = card.createDiv({ cls: "cc-querybar" });
  const input = bar.createEl("input", { cls: "cc-query-input", attr: { type: "text", placeholder: "Ask the knowledge graph\u2026" } });
  const btn = bar.createEl("button", { cls: "cc-btn", text: "Ask" });
  const result = card.createDiv({ cls: "cc-query-result" });
  const ask = async () => {
    const q = input.value.trim();
    if (!q)
      return;
    result.empty();
    result.createEl("p", { cls: "cc-empty", text: "Querying\u2026" });
    await ctx.runQuery(q, result);
  };
  btn.addEventListener("click", ask);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter")
      ask();
  });
}

// src/data.ts
async function readVaultFile(app, relPath) {
  try {
    const exists = await app.vault.adapter.exists(relPath);
    if (!exists)
      return null;
    return await app.vault.adapter.read(relPath);
  } catch {
    return null;
  }
}
function extractSection(md, heading) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let inSection = false;
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      if (inSection)
        break;
      inSection = new RegExp(`^#{1,6}\\s+.*${heading}`, "i").test(line);
      continue;
    }
    if (inSection) {
      const t = line.trim();
      if (t.startsWith("-") || t.startsWith("*") || /^\d+\./.test(t)) {
        out.push(t.replace(/^[-*]\s?|^\d+\.\s?/, "").trim());
      }
    }
  }
  return out;
}
function parseGraphReport(md) {
  return {
    godNodes: extractSection(md, "God Node"),
    surprising: extractSection(md, "Surprising Connection"),
    questions: extractSection(md, "Suggested Question")
  };
}
function parseRegistry(tsv) {
  const rows2 = [];
  for (const line of tsv.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#"))
      continue;
    const cols = line.split("	");
    if (cols.length < 2)
      continue;
    rows2.push({
      name: cols[0]?.trim() ?? "",
      path: cols[1]?.trim() ?? "",
      graphJson: cols[2]?.trim() ?? "",
      flags: cols[3]?.trim() ?? ""
    });
  }
  return rows2;
}
function parseStatusJson(out) {
  const start = out.indexOf("{");
  const end = out.lastIndexOf("}");
  if (start < 0 || end < 0)
    return null;
  try {
    return JSON.parse(out.slice(start, end + 1));
  } catch {
    return null;
  }
}

// src/view.ts
var VIEW_TYPE_CC = "wiki-command-centre-view";
var CommandCentreView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.config = null;
    this.activeHub = "executive";
    this.openNote = (file) => {
      this.app.workspace.getLeaf(false).openFile(file);
    };
    this.runQuery = async (question, resultEl) => {
      const res = await this.plugin.runner.query(question);
      resultEl.empty();
      const text = (res.stdout || res.stderr || "").trim();
      if (res.code !== 0 && !text) {
        resultEl.createEl("p", { cls: "cc-warn", text: `Query failed (exit ${res.code}). Is the graph built?` });
        return;
      }
      resultEl.createEl("pre", { cls: "cc-pre", text: text || "(no answer)" });
    };
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_CC;
  }
  getDisplayText() {
    return "Command Centre";
  }
  getIcon() {
    return "gauge";
  }
  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("cc-root");
    this.navEl = this.contentEl.createDiv({ cls: "cc-nav" });
    this.bodyEl = this.contentEl.createDiv({ cls: "cc-body" });
    this.config = await loadDashboards(this.app, this.plugin.settings.dashboardsConfig);
    if (this.plugin.settings.liveRefresh) {
      const rerender = (0, import_obsidian4.debounce)(() => this.renderActive(), 400, true);
      this.registerEvent(this.app.metadataCache.on("changed", () => rerender()));
    }
    await this.renderNav();
    await this.renderActive();
  }
  visibleHubs(entities) {
    const types = distinctTypes(entities);
    const hubs = this.config?.hubs ?? [];
    return hubs.filter((h) => {
      if (h.builtin === "graph")
        return true;
      if (!h.show_if)
        return true;
      if (h.show_if.entity)
        return types.has(h.show_if.entity);
      if (h.show_if.folder) {
        return this.app.vault.getMarkdownFiles().some((f) => f.path.includes(`/${h.show_if.folder}/`) || f.path.startsWith(`${h.show_if.folder}/`));
      }
      return true;
    });
  }
  async renderNav() {
    this.navEl.empty();
    const entities = scanEntities(this.app);
    const hubs = this.visibleHubs(entities);
    if (!hubs.some((h) => h.id === this.activeHub)) {
      this.activeHub = hubs[0]?.id ?? "graph";
    }
    for (const hub of hubs) {
      const tab = this.navEl.createDiv({ cls: "cc-tab" + (hub.id === this.activeHub ? " cc-active" : "") });
      if (hub.icon)
        (0, import_obsidian4.setIcon)(tab.createSpan({ cls: "cc-tab-icon" }), hub.icon);
      tab.createSpan({ text: hub.title });
      tab.addEventListener("click", async () => {
        this.activeHub = hub.id;
        await this.renderNav();
        await this.renderActive();
      });
    }
  }
  async renderActive() {
    this.bodyEl.empty();
    const hub = (this.config?.hubs ?? []).find((h) => h.id === this.activeHub);
    if (!hub) {
      this.bodyEl.createEl("p", { text: "No hub selected." });
      return;
    }
    if (hub.builtin === "graph") {
      await this.renderGraphHub();
      return;
    }
    const entities = scanEntities(this.app);
    const ctx = {
      app: this.app,
      entities,
      now: today(this.plugin.settings.todayOverride),
      openNote: this.openNote,
      runQuery: this.runQuery
    };
    this.renderQualityHint(hub, entities);
    const grid = this.bodyEl.createDiv({ cls: "cc-grid" });
    for (const w of hub.widgets)
      renderWidget(grid, w, ctx);
  }
  renderQualityHint(hub, entities) {
    let gaps = 0;
    for (const w of hub.widgets) {
      if (!w.entity)
        continue;
      const required = /* @__PURE__ */ new Set();
      (w.fields ?? []).forEach((f) => f !== "title" && f !== "link" && required.add(f));
      if (w.group_by)
        required.add(w.group_by);
      if (w.date_field)
        required.add(w.date_field);
      if (w.agg_field)
        required.add(w.agg_field);
      if (required.size === 0)
        continue;
      gaps += missingFieldCount(entities, w.entity, Array.from(required));
    }
    if (gaps > 0) {
      this.bodyEl.createEl("p", {
        cls: "cc-empty",
        text: `${gaps} field gap(s) across this hub's notes \u2014 some widgets may show fewer rows. See SCHEMA.md.`
      });
    }
  }
  // ---- Graph + Federation hub --------------------------------------------------------------
  async renderGraphHub() {
    const wrap = this.bodyEl.createDiv({ cls: "cc-grid" });
    const statusCard = wrap.createDiv({ cls: "cc-widget" });
    statusCard.createEl("h3", { text: "Knowledge graph", cls: "cc-widget-title" });
    const statusLine = statusCard.createDiv({ cls: "cc-status", text: "Checking\u2026" });
    const log = this.bodyEl.createEl("pre", { cls: "cc-pre cc-log", text: "" });
    const append = (s) => {
      log.setText((log.getText() + s).slice(-8e3));
    };
    const btns = statusCard.createDiv({ cls: "cc-btnrow" });
    const mkBtn = (label, fn) => {
      const b = btns.createEl("button", { cls: "cc-btn", text: label });
      b.addEventListener("click", async () => {
        b.setAttr("disabled", "true");
        try {
          await fn();
        } finally {
          b.removeAttribute("disabled");
        }
      });
    };
    const refreshStatus = async () => {
      const res = await this.plugin.runner.graphStatus();
      const st = parseStatusJson(res.stdout);
      statusLine.empty();
      if (!st) {
        statusLine.createSpan({ cls: "cc-warn", text: "Could not read graph status. Check the Scripts directory in settings." });
        return;
      }
      const badge = st.stale ? "cc-badge-stale" : "cc-badge-ok";
      statusLine.createSpan({ cls: `cc-badge ${badge}`, text: st.stale ? "STALE" : "CURRENT" });
      statusLine.createSpan({
        text: ` graph ${st.graph_exists ? "built" : "not built"} \xB7 ${st.changed} changed (${st.code_changed} code / ${st.doc_changed} doc)`
      });
    };
    mkBtn("Build", async () => {
      append("\n$ wiki-graph.sh build\n");
      const r = await this.plugin.runner.graphBuild();
      append(r.stdout + r.stderr);
      await refreshStatus();
    });
    mkBtn("Update", async () => {
      append("\n$ wiki-graph.sh update\n");
      const r = await this.plugin.runner.graphUpdate();
      append(r.stdout + r.stderr);
      await refreshStatus();
    });
    mkBtn("Refresh baseline", async () => {
      append("\n$ wiki-graph.sh refresh\n");
      const r = await this.plugin.runner.graphRefresh();
      append(r.stdout + r.stderr);
      await refreshStatus();
    });
    mkBtn("Open interactive graph", async () => {
      const path = `${this.plugin.scriptsDir()}/graph/graph.html`;
      try {
        const electron = window.require?.("electron");
        if (electron?.shell?.openPath)
          await electron.shell.openPath(path);
        else
          new import_obsidian4.Notice(`Open in browser: ${path}`);
      } catch {
        new import_obsidian4.Notice(`Open in browser: ${path}`);
      }
    });
    await refreshStatus();
    const report = await readVaultFile(this.app, "graph/GRAPH_REPORT.md");
    if (report) {
      const sec = parseGraphReport(report);
      this.renderInsight(wrap, "God Nodes", sec.godNodes);
      this.renderInsight(wrap, "Surprising Connections", sec.surprising);
      this.renderInsight(wrap, "Suggested Questions", sec.questions);
    } else {
      wrap.createDiv({ cls: "cc-widget" }).createEl("p", {
        cls: "cc-empty",
        text: "No GRAPH_REPORT.md yet \u2014 build the graph to populate insights."
      });
    }
    renderWidget(
      wrap,
      { type: "query", title: "Ask the graph", hint: "e.g. How does auth connect to the API layer?" },
      {
        app: this.app,
        entities: [],
        now: today(this.plugin.settings.todayOverride),
        openNote: this.openNote,
        runQuery: this.runQuery
      }
    );
    await this.renderFederation(wrap, append);
  }
  renderInsight(parent, title, items) {
    const card = parent.createDiv({ cls: "cc-widget" });
    card.createEl("h3", { text: title, cls: "cc-widget-title" });
    if (!items.length) {
      card.createEl("p", { cls: "cc-empty", text: "\u2014" });
      return;
    }
    const ul = card.createEl("ul", { cls: "cc-list" });
    for (const it of items.slice(0, 12))
      ul.createEl("li", { text: it });
  }
  async renderFederation(parent, append) {
    const tsv = await readVaultFile(this.app, ".wiki-roots.tsv");
    if (!tsv)
      return;
    const rows2 = parseRegistry(tsv);
    const card = parent.createDiv({ cls: "cc-widget cc-fed" });
    card.createEl("h3", { text: "Federation \u2014 registered wikis", cls: "cc-widget-title" });
    const btns = card.createDiv({ cls: "cc-btnrow" });
    const fbtn = btns.createEl("button", { cls: "cc-btn", text: "Federate (merge graphs)" });
    fbtn.addEventListener("click", async () => {
      fbtn.setAttr("disabled", "true");
      append("\n$ wiki-federate.sh update\n");
      const r = await this.plugin.runner.federateUpdate();
      append(r.stdout + r.stderr);
      fbtn.removeAttribute("disabled");
    });
    if (!rows2.length) {
      card.createEl("p", { cls: "cc-empty", text: "No wikis registered. Run: wiki-federate.sh register <name> <path>" });
      return;
    }
    const table = card.createEl("table", { cls: "cc-table" });
    const head = table.createEl("thead").createEl("tr");
    ["domain", "path", "flags"].forEach((h) => head.createEl("th", { text: h }));
    const body = table.createEl("tbody");
    for (const r of rows2) {
      const tr = body.createEl("tr");
      tr.createEl("td", { text: r.name });
      tr.createEl("td", { text: r.path });
      tr.createEl("td", { text: r.flags });
    }
  }
};

// src/main.ts
var WikiCommandCentrePlugin = class extends import_obsidian5.Plugin {
  async onload() {
    await this.loadSettings();
    this.rebuildRunner();
    this.registerView(VIEW_TYPE_CC, (leaf) => new CommandCentreView(leaf, this));
    this.addRibbonIcon("gauge", "Wiki Command Centre", () => this.activateView());
    this.addCommand({
      id: "open",
      name: "Open Command Centre",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "rebuild-graph",
      name: "Rebuild knowledge graph",
      callback: async () => {
        new import_obsidian5.Notice("Building graph\u2026");
        const r = await this.runner.graphBuild();
        new import_obsidian5.Notice(r.code === 0 ? "Graph build finished." : "Graph build returned a notice \u2014 open the Command Centre log.");
      }
    });
    this.addCommand({
      id: "update-graph",
      name: "Update knowledge graph (incremental)",
      callback: async () => {
        new import_obsidian5.Notice("Updating graph\u2026");
        const r = await this.runner.graphUpdate();
        new import_obsidian5.Notice(r.code === 0 ? "Graph update finished." : "Graph update needs attention \u2014 open the Command Centre log.");
      }
    });
    this.addCommand({
      id: "federate",
      name: "Federate all wikis (merge graphs)",
      callback: async () => {
        new import_obsidian5.Notice("Federating\u2026");
        const r = await this.runner.federateUpdate();
        new import_obsidian5.Notice(r.code === 0 ? "Federation finished." : "Federation returned a notice \u2014 open the Command Centre log.");
      }
    });
    this.addSettingTab(new CommandCentreSettingTab(this.app, this));
  }
  onunload() {
  }
  rebuildRunner() {
    this.runner = new Runner(this.scriptsDir(), this.settings.graphifyBin);
  }
  /** Directory that holds the wiki-*.sh scripts (and graph/). Defaults to the vault root. */
  scriptsDir() {
    return this.settings.scriptsDir || this.vaultBasePath();
  }
  vaultBasePath() {
    const adapter = this.app.vault.adapter;
    if (adapter instanceof import_obsidian5.FileSystemAdapter)
      return adapter.getBasePath();
    return "";
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CC)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_CC, active: true });
    }
    workspace.revealLeaf(leaf);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.rebuildRunner();
  }
};
