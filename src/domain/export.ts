// CSV / JSON export. Raw observations are exported exactly as stored.

import type { ObservationSet, PlayerState, PurchaseRecord } from "./types";

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends object>(rows: T[], columns?: (keyof T)[]): string {
  if (!rows.length && !columns) return "";
  const cols = columns ?? ([...new Set(rows.flatMap((r) => Object.keys(r)))] as (keyof T)[]);
  const lines = [cols.map((c) => cell(String(c))).join(",")];
  for (const r of rows) lines.push(cols.map((c) => cell(r[c])).join(","));
  return lines.join("\n") + "\n";
}

export function flattenPurchases(rows: PurchaseRecord[]) {
  return rows.map((r) => ({
    id: r.id, createdAt: r.createdAt, upgradeId: r.upgradeId, method: r.method,
    fromLevel: r.fromLevel, toLevel: r.toLevel, keygenLevel: r.keygenLevel,
    cost: r.cost, costSource: r.costSource, expEarned: r.expEarned, expExpected: r.expExpected,
    beforeLevel: r.before.level, beforeExp: r.before.exp, beforeRequired: r.before.required,
    afterLevel: r.after.level, afterExp: r.after.exp, afterRequired: r.after.required,
    confidence: r.confidence, notes: r.notes
  }));
}

export interface ExportBundle {
  exportedAt: string;
  app: "hackex2-upgrade-tracker";
  formatVersion: 1;
  player: PlayerState | null;
  purchases: PurchaseRecord[];
  observations: ObservationSet;
}

export const toJson = (b: ExportBundle) => JSON.stringify(b, null, 2);
