import { App } from "obsidian";

export interface GraphStatus {
  graph_exists: boolean;
  stale: boolean;
  changed: number;
  code_changed: number;
  doc_changed: number;
  report?: string;
  html?: string;
}

export interface ReportSections {
  godNodes: string[];
  surprising: string[];
  questions: string[];
}

export interface RegistryRow {
  name: string;
  path: string;
  graphJson: string;
  flags: string;
}

/** Read a vault-relative file, or null if it doesn't exist. */
export async function readVaultFile(app: App, relPath: string): Promise<string | null> {
  try {
    const exists = await app.vault.adapter.exists(relPath);
    if (!exists) return null;
    return await app.vault.adapter.read(relPath);
  } catch {
    return null;
  }
}

/** Pull bullet/line items out of the named markdown section until the next heading. */
function extractSection(md: string, heading: string): string[] {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      if (inSection) break; // next heading ends the section
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

export function parseGraphReport(md: string): ReportSections {
  return {
    godNodes: extractSection(md, "God Node"),
    surprising: extractSection(md, "Surprising Connection"),
    questions: extractSection(md, "Suggested Question"),
  };
}

export function parseRegistry(tsv: string): RegistryRow[] {
  const rows: RegistryRow[] = [];
  for (const line of tsv.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const cols = line.split("\t");
    if (cols.length < 2) continue;
    rows.push({
      name: cols[0]?.trim() ?? "",
      path: cols[1]?.trim() ?? "",
      graphJson: cols[2]?.trim() ?? "",
      flags: cols[3]?.trim() ?? "",
    });
  }
  return rows;
}

export function parseStatusJson(out: string): GraphStatus | null {
  const start = out.indexOf("{");
  const end = out.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(out.slice(start, end + 1));
  } catch {
    return null;
  }
}
