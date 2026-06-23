import { ItemView, WorkspaceLeaf, TFile, Notice, setIcon, debounce } from "obsidian";
import type WikiCommandCentrePlugin from "./main";
import { DashboardsConfig, HubDef, loadDashboards } from "./config";
import { scanEntities, distinctTypes, today, Entity, missingFieldCount } from "./entities";
import { renderWidget, RenderCtx } from "./widgets";
import {
  GraphStatus,
  parseGraphReport,
  parseRegistry,
  parseStatusJson,
  readVaultFile,
} from "./data";

export const VIEW_TYPE_CC = "wiki-command-centre-view";

export class CommandCentreView extends ItemView {
  plugin: WikiCommandCentrePlugin;
  private config: DashboardsConfig | null = null;
  private activeHub = "executive";
  private bodyEl!: HTMLElement;
  private navEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: WikiCommandCentrePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_CC;
  }
  getDisplayText(): string {
    return "Command Centre";
  }
  getIcon(): string {
    return "gauge";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("cc-root");
    this.navEl = this.contentEl.createDiv({ cls: "cc-nav" });
    this.bodyEl = this.contentEl.createDiv({ cls: "cc-body" });

    this.config = await loadDashboards(this.app, this.plugin.settings.dashboardsConfig);

    if (this.plugin.settings.liveRefresh) {
      const rerender = debounce(() => this.renderActive(), 400, true);
      this.registerEvent(this.app.metadataCache.on("changed", () => rerender()));
    }

    await this.renderNav();
    await this.renderActive();
  }

  private visibleHubs(entities: Entity[]): HubDef[] {
    const types = distinctTypes(entities);
    const hubs = this.config?.hubs ?? [];
    return hubs.filter((h) => {
      if (h.builtin === "graph") return true;
      if (!h.show_if) return true;
      if (h.show_if.entity) return types.has(h.show_if.entity);
      if (h.show_if.folder) {
        return this.app.vault.getMarkdownFiles().some((f) => f.path.includes(`/${h.show_if!.folder}/`) || f.path.startsWith(`${h.show_if!.folder}/`));
      }
      return true;
    });
  }

  private async renderNav(): Promise<void> {
    this.navEl.empty();
    const entities = scanEntities(this.app);
    const hubs = this.visibleHubs(entities);
    if (!hubs.some((h) => h.id === this.activeHub)) {
      this.activeHub = hubs[0]?.id ?? "graph";
    }
    for (const hub of hubs) {
      const tab = this.navEl.createDiv({ cls: "cc-tab" + (hub.id === this.activeHub ? " cc-active" : "") });
      if (hub.icon) setIcon(tab.createSpan({ cls: "cc-tab-icon" }), hub.icon);
      tab.createSpan({ text: hub.title });
      tab.addEventListener("click", async () => {
        this.activeHub = hub.id;
        await this.renderNav();
        await this.renderActive();
      });
    }
  }

  private openNote = (file: TFile) => {
    this.app.workspace.getLeaf(false).openFile(file);
  };

  private runQuery = async (question: string, resultEl: HTMLElement): Promise<void> => {
    const res = await this.plugin.runner.query(question);
    resultEl.empty();
    const text = (res.stdout || res.stderr || "").trim();
    if (res.code !== 0 && !text) {
      resultEl.createEl("p", { cls: "cc-warn", text: `Query failed (exit ${res.code}). Is the graph built?` });
      return;
    }
    resultEl.createEl("pre", { cls: "cc-pre", text: text || "(no answer)" });
  };

  private async renderActive(): Promise<void> {
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
    const ctx: RenderCtx = {
      app: this.app,
      entities,
      now: today(this.plugin.settings.todayOverride),
      openNote: this.openNote,
      runQuery: this.runQuery,
    };

    // Per-hub data-quality hint: count notes of each entity type missing a `title`.
    this.renderQualityHint(hub, entities);

    const grid = this.bodyEl.createDiv({ cls: "cc-grid" });
    for (const w of hub.widgets) renderWidget(grid, w, ctx);
  }

  private renderQualityHint(hub: HubDef, entities: Entity[]): void {
    // For each widget, the fields it actually reads become the "required" set for its entity.
    let gaps = 0;
    for (const w of hub.widgets) {
      if (!w.entity) continue;
      const required = new Set<string>();
      (w.fields ?? []).forEach((f) => f !== "title" && f !== "link" && required.add(f));
      if (w.group_by) required.add(w.group_by);
      if (w.date_field) required.add(w.date_field);
      if (w.agg_field) required.add(w.agg_field);
      if (required.size === 0) continue;
      gaps += missingFieldCount(entities, w.entity, Array.from(required));
    }
    if (gaps > 0) {
      this.bodyEl.createEl("p", {
        cls: "cc-empty",
        text: `${gaps} field gap(s) across this hub's notes — some widgets may show fewer rows. See SCHEMA.md.`,
      });
    }
  }

  // ---- Graph + Federation hub --------------------------------------------------------------

  private async renderGraphHub(): Promise<void> {
    const wrap = this.bodyEl.createDiv({ cls: "cc-grid" });

    // Status panel
    const statusCard = wrap.createDiv({ cls: "cc-widget" });
    statusCard.createEl("h3", { text: "Knowledge graph", cls: "cc-widget-title" });
    const statusLine = statusCard.createDiv({ cls: "cc-status", text: "Checking…" });

    const log = this.bodyEl.createEl("pre", { cls: "cc-pre cc-log", text: "" });
    const append = (s: string) => {
      log.setText((log.getText() + s).slice(-8000));
    };

    const btns = statusCard.createDiv({ cls: "cc-btnrow" });
    const mkBtn = (label: string, fn: () => Promise<void>) => {
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
      const st: GraphStatus | null = parseStatusJson(res.stdout);
      statusLine.empty();
      if (!st) {
        statusLine.createSpan({ cls: "cc-warn", text: "Could not read graph status. Check the Scripts directory in settings." });
        return;
      }
      const badge = st.stale ? "cc-badge-stale" : "cc-badge-ok";
      statusLine.createSpan({ cls: `cc-badge ${badge}`, text: st.stale ? "STALE" : "CURRENT" });
      statusLine.createSpan({
        text: ` graph ${st.graph_exists ? "built" : "not built"} · ${st.changed} changed (${st.code_changed} code / ${st.doc_changed} doc)`,
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
        // electron shell — desktop only
        const electron = (window as any).require?.("electron");
        if (electron?.shell?.openPath) await electron.shell.openPath(path);
        else new Notice(`Open in browser: ${path}`);
      } catch {
        new Notice(`Open in browser: ${path}`);
      }
    });

    await refreshStatus();

    // Insights from GRAPH_REPORT.md
    const report = await readVaultFile(this.app, "graph/GRAPH_REPORT.md");
    if (report) {
      const sec = parseGraphReport(report);
      this.renderInsight(wrap, "God Nodes", sec.godNodes);
      this.renderInsight(wrap, "Surprising Connections", sec.surprising);
      this.renderInsight(wrap, "Suggested Questions", sec.questions);
    } else {
      wrap.createDiv({ cls: "cc-widget" }).createEl("p", {
        cls: "cc-empty",
        text: "No GRAPH_REPORT.md yet — build the graph to populate insights.",
      });
    }

    // Query box against the active graph
    renderWidget(
      wrap,
      { type: "query", title: "Ask the graph", hint: "e.g. How does auth connect to the API layer?" },
      {
        app: this.app,
        entities: [],
        now: today(this.plugin.settings.todayOverride),
        openNote: this.openNote,
        runQuery: this.runQuery,
      }
    );

    // Federation panel (hub mode)
    await this.renderFederation(wrap, append);
  }

  private renderInsight(parent: HTMLElement, title: string, items: string[]): void {
    const card = parent.createDiv({ cls: "cc-widget" });
    card.createEl("h3", { text: title, cls: "cc-widget-title" });
    if (!items.length) {
      card.createEl("p", { cls: "cc-empty", text: "—" });
      return;
    }
    const ul = card.createEl("ul", { cls: "cc-list" });
    for (const it of items.slice(0, 12)) ul.createEl("li", { text: it });
  }

  private async renderFederation(parent: HTMLElement, append: (s: string) => void): Promise<void> {
    const tsv = await readVaultFile(this.app, ".wiki-roots.tsv");
    if (!tsv) return; // not a hub vault
    const rows = parseRegistry(tsv);
    const card = parent.createDiv({ cls: "cc-widget cc-fed" });
    card.createEl("h3", { text: "Federation — registered wikis", cls: "cc-widget-title" });

    const btns = card.createDiv({ cls: "cc-btnrow" });
    const fbtn = btns.createEl("button", { cls: "cc-btn", text: "Federate (merge graphs)" });
    fbtn.addEventListener("click", async () => {
      fbtn.setAttr("disabled", "true");
      append("\n$ wiki-federate.sh update\n");
      const r = await this.plugin.runner.federateUpdate();
      append(r.stdout + r.stderr);
      fbtn.removeAttribute("disabled");
    });

    if (!rows.length) {
      card.createEl("p", { cls: "cc-empty", text: "No wikis registered. Run: wiki-federate.sh register <name> <path>" });
      return;
    }
    const table = card.createEl("table", { cls: "cc-table" });
    const head = table.createEl("thead").createEl("tr");
    ["domain", "path", "flags"].forEach((h) => head.createEl("th", { text: h }));
    const body = table.createEl("tbody");
    for (const r of rows) {
      const tr = body.createEl("tr");
      tr.createEl("td", { text: r.name });
      tr.createEl("td", { text: r.path });
      tr.createEl("td", { text: r.flags });
    }
  }
}
