// The game only shows the price of the NEXT level (Firewall 4 → you see the price for 5).
// These rows drive the Store Prices and Keygen Prices pages and their "missing" badges.

import { CATALOG } from "./catalog";
import { Knowledge, Lookup } from "./knowledge";
import type { CatalogEntry, Method } from "./types";

export type NextPriceStatus = "known" | "missing" | "conflict" | "maxed" | "owned" | "keygen_low";

export interface NextPriceRow {
  entry: CatalogEntry;
  method: Method;
  currentLevel: number;
  nextLevel: number;
  lookup: Lookup | null;
  status: NextPriceStatus;
}

export function nextPriceRows(levels: Record<string, number>, kb: Knowledge, method: Method): NextPriceRow[] {
  const keygen = levels.keygen ?? 0;
  const rows: NextPriceRow[] = [];
  for (const entry of CATALOG) {
    if (method === "download" && !entry.download) continue;
    if (method === "store" && !entry.store) continue;
    const currentLevel = levels[entry.id] ?? entry.startLevel;
    const nextLevel = entry.kind === "one_time" ? 1 : currentLevel + 1;
    const base = { entry, method, currentLevel, nextLevel };

    if (entry.kind === "one_time" && currentLevel >= 1) { rows.push({ ...base, lookup: null, status: "owned" }); continue; }
    if (entry.maxLevel !== null && currentLevel >= entry.maxLevel) { rows.push({ ...base, lookup: null, status: "maxed" }); continue; }

    const lookup = entry.kind === "one_time" ? kb.oneTimeItemPrice(entry.id)
      : method === "store" ? kb.storeLevelPrice(entry.id, nextLevel)
      : kb.downloadCombinedPrice(entry.id, currentLevel, nextLevel);

    let status: NextPriceStatus = lookup.value !== null ? "known" : lookup.reliability === "conflict" ? "conflict" : "missing";
    if (method === "download" && keygen < nextLevel) status = "keygen_low";
    rows.push({ ...base, lookup, status });
  }
  return rows;
}

/** How many prices this player can see in the game but the database doesn't have yet. */
export const needsEntry = (rows: NextPriceRow[]) => rows.filter((r) => r.status === "missing" || r.status === "conflict").length;
