import { App, TFile } from "obsidian";
import { FilterRule } from "./config";

export interface Entity {
  file: TFile;
  type: string;
  title: string;
  fm: Record<string, any>;
}

/** Scan every markdown note's frontmatter; keep those with a `type:` field. */
export function scanEntities(app: App): Entity[] {
  const out: Entity[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (!fm || !fm.type) continue;
    out.push({
      file,
      type: String(fm.type),
      title: String(fm.title ?? file.basename),
      fm,
    });
  }
  return out;
}

export function byType(entities: Entity[], type?: string): Entity[] {
  if (!type) return entities;
  return entities.filter((e) => e.type === type);
}

export function distinctTypes(entities: Entity[]): Set<string> {
  return new Set(entities.map((e) => e.type));
}

// ---- dates --------------------------------------------------------------------------------

export function today(override?: string): Date {
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
    return new Date(override + "T00:00:00");
  }
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function parseDate(v: any): Date | null {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// ---- filtering ----------------------------------------------------------------------------

export function matchesRule(e: Entity, rule: FilterRule, now: Date): boolean {
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
      // `now` is midnight today, so a date of today is NOT overdue (only strictly earlier).
      const d = parseDate(raw);
      return d != null && d.getTime() < now.getTime();
    }
    case "within_days": {
      const d = parseDate(raw);
      if (!d) return false;
      const diff = daysBetween(now, d);
      return diff >= 0 && diff <= Number(rule.value ?? 0);
    }
    default:
      return true;
  }
}

export function applyFilters(entities: Entity[], filters: FilterRule[] | undefined, now: Date): Entity[] {
  if (!filters || !filters.length) return entities;
  return entities.filter((e) => filters.every((f) => matchesRule(e, f, now)));
}

// ---- aggregation --------------------------------------------------------------------------

export function sumField(entities: Entity[], field: string): number {
  return entities.reduce((acc, e) => {
    const n = Number(e.fm[field]);
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
}

export function groupBy(entities: Entity[], field: string): Map<string, Entity[]> {
  const m = new Map<string, Entity[]>();
  for (const e of entities) {
    const key = String(e.fm[field] ?? "—");
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(e);
  }
  return m;
}

/** Count entities of `entityType` that are missing any of `required` fields. */
export function missingFieldCount(entities: Entity[], entityType: string, required: string[]): number {
  return byType(entities, entityType).filter((e) =>
    required.some((f) => e.fm[f] == null || String(e.fm[f]).trim() === "")
  ).length;
}
