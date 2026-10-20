import type { CatalogEntry, Category } from "./types";

const lvl = (
  id: string, name: string, category: Category, startLevel: number, maxLevel: number | null,
  download: boolean, defensiveDiscount = false
): CatalogEntry => ({ id, name, category, kind: "level", startLevel, maxLevel, store: true, download, defensiveDiscount });

const once = (id: string, name: string): CatalogEntry => ({
  id, name, category: "one_time", kind: "one_time", startLevel: 0, maxLevel: 1,
  store: true, download: false, defensiveDiscount: false
});

/** 14 level-based upgrades + 2 one-time purchases = 16 entries. Keep in sync with supabase seed. */
export const CATALOG: readonly CatalogEntry[] = [
  lvl("device", "Device", "core", 1, 12, false),
  lvl("network", "Network", "core", 1, 11, false),
  lvl("botnet", "Botnet", "core", 1, 7, false),
  lvl("firewall", "Firewall", "defensive", 1, null, true, true),
  lvl("password_encryptor", "Password Encryptor", "defensive", 1, null, true, true),
  lvl("antivirus", "Antivirus", "defensive", 0, null, true, true),
  lvl("proxy", "Proxy", "defensive", 0, null, true, true),
  lvl("trace", "Trace", "defensive", 0, null, true, true),
  lvl("bypasser", "Bypasser", "offensive", 1, null, true),
  lvl("password_cracker", "Password Cracker", "offensive", 1, null, true),
  lvl("spam", "Spam", "virus", 0, null, true),
  lvl("siphon", "Siphon", "virus", 0, null, true),
  lvl("rootkit", "Rootkit", "virus", 0, null, true),
  lvl("keygen", "Keygen", "utility", 0, null, false),
  once("message_encryptor", "Message Encryptor"),
  once("notepad", "Notepad")
];

export const CATEGORY_LABEL: Record<Category, string> = {
  core: "Core",
  defensive: "Defensive",
  offensive: "Offensive",
  virus: "Virus",
  utility: "Utility",
  one_time: "One-time"
};

export const DEFENSIVE_DISCOUNT = 0.15;

const byId = new Map(CATALOG.map((e) => [e.id, e]));

export function getEntry(id: string): CatalogEntry {
  const e = byId.get(id);
  if (!e) throw new Error(`Unknown upgrade: ${id}`);
  return e;
}

export function defaultLevels(): Record<string, number> {
  return Object.fromEntries(CATALOG.map((e) => [e.id, e.startLevel]));
}

/** Validates a level a player says they currently have. Returns an error message or null. */
export function validateLevel(entry: CatalogEntry, level: number): string | null {
  if (!Number.isInteger(level) || level < 0) return "Level must be a whole number, 0 or more";
  if (entry.kind === "one_time" && level > 1) return "One-time items are either purchased or not";
  if (entry.maxLevel !== null && level > entry.maxLevel) return `${entry.name} maxes out at level ${entry.maxLevel}`;
  return null;
}

export function methodsFor(entry: CatalogEntry): ("store" | "download")[] {
  const m: ("store" | "download")[] = [];
  if (entry.store) m.push("store");
  if (entry.download) m.push("download");
  return m;
}

/** Botnet tiers by level (hackex.net lists them as tier 0–6; tier 0 = level 1). */
export const BOTNET_TIERS: readonly { name: string; slots: number }[] = [
  { name: "Free", slots: 2 }, { name: "Node", slots: 4 }, { name: "Cluster", slots: 8 }, { name: "Grid", slots: 16 },
  { name: "Farm", slots: 28 }, { name: "Hive", slots: 44 }, { name: "Nexus", slots: 64 }
];

/** How the game names a level: Botnet tiers have names (Hive), everything else is "Lv 6". */
export function levelName(upgradeId: string, level: number): string {
  if (upgradeId === "botnet") return BOTNET_TIERS[level - 1]?.name ?? `Lv ${level}`;
  return `Lv ${level}`;
}
