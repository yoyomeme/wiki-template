import { App, TFile, setIcon } from "obsidian";
import { WidgetDef } from "./config";
import {
  Entity,
  byType,
  applyFilters,
  sumField,
  groupBy,
  matchesRule,
  parseDate,
} from "./entities";

export interface RenderCtx {
  app: App;
  entities: Entity[];
  now: Date;
  openNote: (file: TFile) => void;
  runQuery: (question: string, resultEl: HTMLElement) => Promise<void>;
}

function fmtNum(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function cellText(e: Entity, field: string): string {
  if (field === "title") return e.title;
  const v = e.fm[field];
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

export function renderWidget(parent: HTMLElement, w: WidgetDef, ctx: RenderCtx): void {
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
        card.createEl("p", { cls: "cc-warn", text: `Unknown widget type: ${(w as any).type}` });
    }
  } catch (e) {
    card.createEl("p", { cls: "cc-warn", text: `Widget error: ${String(e)}` });
  }
}

function rows(w: WidgetDef, ctx: RenderCtx): Entity[] {
  return applyFilters(byType(ctx.entities, w.entity), w.filters, ctx.now);
}

function emptyHint(card: HTMLElement, w: WidgetDef): void {
  card.createEl("p", { cls: "cc-empty", text: w.entity ? `No ${w.entity} notes match.` : "Nothing to show." });
}

function renderKpi(card: HTMLElement, w: WidgetDef, ctx: RenderCtx): void {
  const data = rows(w, ctx);
  let value: number;
  if (w.agg === "sum" && w.agg_field) value = sumField(data, w.agg_field);
  else value = data.length;
  card.createDiv({ cls: "cc-kpi-value", text: fmtNum(value) });
  card.createDiv({ cls: "cc-kpi-sub", text: `${data.length} ${w.entity ?? "item"}(s)` });
}

function renderTable(card: HTMLElement, w: WidgetDef, ctx: RenderCtx): void {
  const data = rows(w, ctx);
  if (!data.length) return emptyHint(card, w);
  const fields = w.fields ?? ["title"];
  const table = card.createEl("table", { cls: "cc-table" });
  const head = table.createEl("thead").createEl("tr");
  for (const f of fields) head.createEl("th", { text: f });
  const body = table.createEl("tbody");
  for (const e of data) {
    const tr = body.createEl("tr", { cls: "cc-row" });
    for (const f of fields) tr.createEl("td", { text: cellText(e, f) });
    tr.addEventListener("click", () => ctx.openNote(e.file));
  }
}

function renderPipeline(card: HTMLElement, w: WidgetDef, ctx: RenderCtx): void {
  const data = rows(w, ctx);
  if (!data.length) return emptyHint(card, w);
  const groups = groupBy(data, w.group_by ?? "stage");
  const board = card.createDiv({ cls: "cc-pipeline" });
  for (const [stage, items] of groups) {
    const col = board.createDiv({ cls: "cc-col" });
    col.createDiv({ cls: "cc-col-head", text: `${stage} (${items.length})` });
    for (const e of items) {
      const cardEl = col.createDiv({ cls: "cc-card", text: e.title });
      const sub = (w.fields ?? []).filter((f) => f !== "title").map((f) => cellText(e, f)).filter(Boolean).join(" · ");
      if (sub) cardEl.createDiv({ cls: "cc-card-sub", text: sub });
      cardEl.addEventListener("click", () => ctx.openNote(e.file));
    }
  }
}

function renderAgenda(card: HTMLElement, w: WidgetDef, ctx: RenderCtx): void {
  const field = w.date_field ?? "due";
  const data = rows(w, ctx)
    .map((e) => ({ e, d: parseDate(e.fm[field]) }))
    .filter((x) => x.d != null)
    .sort((a, b) => a.d!.getTime() - b.d!.getTime());
  if (!data.length) return emptyHint(card, w);
  const ul = card.createEl("ul", { cls: "cc-agenda" });
  for (const { e, d } of data) {
    const li = ul.createEl("li", { cls: "cc-row" });
    li.createSpan({ cls: "cc-date", text: d!.toISOString().slice(0, 10) });
    li.createSpan({ text: " " + e.title });
    li.addEventListener("click", () => ctx.openNote(e.file));
  }
}

function renderList(card: HTMLElement, w: WidgetDef, ctx: RenderCtx): void {
  const data = rows(w, ctx);
  if (!data.length) return emptyHint(card, w);
  const ul = card.createEl("ul", { cls: "cc-list" });
  for (const e of data) {
    const li = ul.createEl("li", { cls: "cc-row", text: e.title });
    li.addEventListener("click", () => ctx.openNote(e.file));
  }
}

function renderVault(card: HTMLElement, w: WidgetDef, ctx: RenderCtx): void {
  const data = rows(w, ctx);
  if (!data.length) return emptyHint(card, w);
  const wrap = card.createDiv({ cls: "cc-vault" });
  for (const e of data) {
    const chip = wrap.createDiv({ cls: "cc-chip" });
    setIcon(chip.createSpan({ cls: "cc-chip-icon" }), "file-text");
    chip.createSpan({ text: e.title });
    chip.addEventListener("click", () => ctx.openNote(e.file));
  }
}

function renderRiskflags(card: HTMLElement, w: WidgetDef, ctx: RenderCtx): void {
  let data = rows(w, ctx);
  if (w.rule) data = data.filter((e) => matchesRule(e, w.rule!, ctx.now));
  if (!data.length) {
    card.createEl("p", { cls: "cc-ok", text: "✓ No flags." });
    return;
  }
  const fields = w.fields ?? ["title"];
  for (const e of data) {
    const flag = card.createDiv({ cls: "cc-flag cc-row" });
    flag.createSpan({ cls: "cc-flag-title", text: e.title });
    const detail = fields.filter((f) => f !== "title").map((f) => cellText(e, f)).filter(Boolean).join(" · ");
    if (detail) flag.createSpan({ cls: "cc-flag-detail", text: " — " + detail });
    flag.addEventListener("click", () => ctx.openNote(e.file));
  }
}

function renderQuery(card: HTMLElement, w: WidgetDef, ctx: RenderCtx): void {
  if (w.hint) card.createEl("p", { cls: "cc-empty", text: w.hint });
  const bar = card.createDiv({ cls: "cc-querybar" });
  const input = bar.createEl("input", { cls: "cc-query-input", attr: { type: "text", placeholder: "Ask the knowledge graph…" } });
  const btn = bar.createEl("button", { cls: "cc-btn", text: "Ask" });
  const result = card.createDiv({ cls: "cc-query-result" });
  const ask = async () => {
    const q = input.value.trim();
    if (!q) return;
    result.empty();
    result.createEl("p", { cls: "cc-empty", text: "Querying…" });
    await ctx.runQuery(q, result);
  };
  btn.addEventListener("click", ask);
  input.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Enter") ask();
  });
}
