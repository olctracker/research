// Starting observations: real prices from hackex.net and hilltop's own game.
// The spec's Example A (Spam 200/300/400/500, 2–5 XP) and Example B were illustrative only —
// real Spam level 5 costs 14,586 — so they are NOT seeded; tests use them as practice numbers.
// Keep in sync with supabase/migrations/0002_seed.sql.

import type { ObservationSet, PriceObservation } from "./types";

const at = "2026-10-18T00:00:00.000Z";


// Real prices: Device, Network and Botnet tables from hackex.net (their tier 0 = our level 1), and the
// next-level prices from hilltop's store screen paste on Oct 18 2026.
const storeSeed = (
  key: string, upgradeId: string, fromLevel: number, toLevel: number, cost: number,
  costType: "per_level" | "one_time", contributor: string, notes: string, priceBasis: "final" | "before_discount" = "final"
): PriceObservation => ({
  id: `seed-${key}`, upgradeId, method: "store", fromLevel, toLevel, cost, costType, priceBasis,
  keygenLevel: null, contributor, createdAt: at, status: "observed", notes, purchaseId: null,
  // hilltop's paste was taken at R3; website tables don't say.
  reboots: contributor === "hilltop" ? 3 : null
});

export const SEED_OBSERVATIONS: ObservationSet = {
  prices: [
  storeSeed("botnet-site-2", "botnet", 1, 2, 800, "per_level", "hackex.net", "hackex.net Botnet Tiers: Node · 4 slots · needs player LVL 3 (site tier 0)"),
  storeSeed("botnet-site-3", "botnet", 2, 3, 3500, "per_level", "hackex.net", "hackex.net Botnet Tiers: Cluster · 8 slots (site tier 1)"),
  storeSeed("botnet-site-4", "botnet", 3, 4, 15000, "per_level", "hackex.net", "hackex.net Botnet Tiers: Grid · 16 slots (site tier 2)"),
  storeSeed("botnet-site-5", "botnet", 4, 5, 42000, "per_level", "hackex.net", "hackex.net Botnet Tiers: Farm · 28 slots (site tier 3)"),
  storeSeed("botnet-site-6", "botnet", 5, 6, 95000, "per_level", "hackex.net", "hackex.net Botnet Tiers: Hive · 44 slots (site tier 4)"),
  storeSeed("botnet-site-7", "botnet", 6, 7, 180000, "per_level", "hackex.net", "hackex.net Botnet Tiers: Nexus · 64 slots (site tier 5)"),
  storeSeed("paste-device-5", "device", 4, 5, 28000, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-network-10", "network", 9, 10, 120000, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-botnet-7", "botnet", 6, 7, 180000, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-firewall-22", "firewall", 21, 22, 37815, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-bypasser-21", "bypasser", 20, 21, 41877, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-password_encryptor-2", "password_encryptor", 1, 2, 2303, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-password_cracker-2", "password_cracker", 1, 2, 2709, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-spam-21", "spam", 20, 21, 94224, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-siphon-18", "siphon", 17, 18, 68545, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-rootkit-1", "rootkit", 0, 1, 1400, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-antivirus-2", "antivirus", 1, 2, 2094, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-proxy-21", "proxy", 20, 21, 40046, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-trace-1", "trace", 0, 1, 765, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-keygen-21", "keygen", 20, 21, 31408, "per_level", "hilltop", "Store screen paste, Oct 18 2026"),
  storeSeed("paste-notepad", "notepad", 0, 1, 5000, "one_time", "hilltop", "Store screen paste, Oct 18 2026")
,
  storeSeed("device-site-2", "device", 1, 2, 4000, "per_level", "hackex.net", "hackex.net Devices table: Raider II"),
  storeSeed("device-site-3", "device", 2, 3, 10000, "per_level", "hackex.net", "hackex.net Devices table: Raider III"),
  storeSeed("device-site-4", "device", 3, 4, 18000, "per_level", "hackex.net", "hackex.net Devices table: Bolt"),
  storeSeed("device-site-5", "device", 4, 5, 28000, "per_level", "hackex.net", "hackex.net Devices table: Bolt II"),
  storeSeed("device-site-6", "device", 5, 6, 40000, "per_level", "hackex.net", "hackex.net Devices table: Bolt III"),
  storeSeed("device-site-7", "device", 6, 7, 56000, "per_level", "hackex.net", "hackex.net Devices table: Nova"),
  storeSeed("device-site-8", "device", 7, 8, 82000, "per_level", "hackex.net", "hackex.net Devices table: Nova II"),
  storeSeed("device-site-9", "device", 8, 9, 120000, "per_level", "hackex.net", "hackex.net Devices table: Nova III"),
  storeSeed("device-site-10", "device", 9, 10, 160000, "per_level", "hackex.net", "hackex.net Devices table: Nova S"),
  storeSeed("device-site-11", "device", 10, 11, 220000, "per_level", "hackex.net", "hackex.net Devices table: Nova X"),
  storeSeed("device-site-12", "device", 11, 12, 300000, "per_level", "hackex.net", "hackex.net Devices table: Nova Ultra"),
  storeSeed("network-site-2", "network", 1, 2, 3000, "per_level", "hackex.net", "hackex.net Network table: Cable"),
  storeSeed("network-site-3", "network", 2, 3, 7000, "per_level", "hackex.net", "hackex.net Network table: Cable+"),
  storeSeed("network-site-4", "network", 3, 4, 12000, "per_level", "hackex.net", "hackex.net Network table: 4G LTE"),
  storeSeed("network-site-5", "network", 4, 5, 20000, "per_level", "hackex.net", "hackex.net Network table: 5G"),
  storeSeed("network-site-6", "network", 5, 6, 30000, "per_level", "hackex.net", "hackex.net Network table: 5G+"),
  storeSeed("network-site-7", "network", 6, 7, 44000, "per_level", "hackex.net", "hackex.net Network table: Fiber"),
  storeSeed("network-site-8", "network", 7, 8, 60000, "per_level", "hackex.net", "hackex.net Network table: Fiber+"),
  storeSeed("network-site-9", "network", 8, 9, 85000, "per_level", "hackex.net", "hackex.net Network table: 10G Fiber"),
  storeSeed("network-site-10", "network", 9, 10, 120000, "per_level", "hackex.net", "hackex.net Network table: 10G Fiber+"),
  storeSeed("network-site-11", "network", 10, 11, 170000, "per_level", "hackex.net", "hackex.net Network table: Quantum Link")
,
  // hackex.net software guide: base (level 1) price and levels 5, 10, 15
  storeSeed("guide-firewall-1", "firewall", 0, 1, 800, "per_level", "hackex.net", "hackex.net software guide: base price (before 15% defensive discount)", "before_discount"),
  storeSeed("guide-firewall-5", "firewall", 4, 5, 5511, "per_level", "hackex.net", "hackex.net software guide: Lv 5", "final"),
  storeSeed("guide-firewall-10", "firewall", 9, 10, 13569, "per_level", "hackex.net", "hackex.net software guide: Lv 10", "final"),
  storeSeed("guide-firewall-15", "firewall", 14, 15, 22985, "per_level", "hackex.net", "hackex.net software guide: Lv 15", "final"),
  storeSeed("guide-bypasser-1", "bypasser", 0, 1, 800, "per_level", "hackex.net", "hackex.net software guide: base price", "final"),
  storeSeed("guide-bypasser-5", "bypasser", 4, 5, 6483, "per_level", "hackex.net", "hackex.net software guide: Lv 5", "final"),
  storeSeed("guide-bypasser-10", "bypasser", 9, 10, 15963, "per_level", "hackex.net", "hackex.net software guide: Lv 10", "final"),
  storeSeed("guide-bypasser-15", "bypasser", 14, 15, 27041, "per_level", "hackex.net", "hackex.net software guide: Lv 15", "final"),
  storeSeed("guide-password_cracker-1", "password_cracker", 0, 1, 1100, "per_level", "hackex.net", "hackex.net software guide: base price", "final"),
  storeSeed("guide-password_cracker-5", "password_cracker", 4, 5, 8914, "per_level", "hackex.net", "hackex.net software guide: Lv 5", "final"),
  storeSeed("guide-password_cracker-10", "password_cracker", 9, 10, 21948, "per_level", "hackex.net", "hackex.net software guide: Lv 10", "final"),
  storeSeed("guide-password_cracker-15", "password_cracker", 14, 15, 37181, "per_level", "hackex.net", "hackex.net software guide: Lv 15", "final"),
  storeSeed("guide-password_encryptor-1", "password_encryptor", 0, 1, 1100, "per_level", "hackex.net", "hackex.net software guide: base price (before 15% defensive discount)", "before_discount"),
  storeSeed("guide-password_encryptor-5", "password_encryptor", 4, 5, 7577, "per_level", "hackex.net", "hackex.net software guide: Lv 5", "final"),
  storeSeed("guide-password_encryptor-10", "password_encryptor", 9, 10, 18656, "per_level", "hackex.net", "hackex.net software guide: Lv 10", "final"),
  storeSeed("guide-password_encryptor-15", "password_encryptor", 14, 15, 31604, "per_level", "hackex.net", "hackex.net software guide: Lv 15", "final"),
  storeSeed("guide-antivirus-1", "antivirus", 0, 1, 1000, "per_level", "hackex.net", "hackex.net software guide: base price (before 15% defensive discount)", "before_discount"),
  storeSeed("guide-antivirus-5", "antivirus", 4, 5, 6889, "per_level", "hackex.net", "hackex.net software guide: Lv 5", "final"),
  storeSeed("guide-antivirus-10", "antivirus", 9, 10, 16961, "per_level", "hackex.net", "hackex.net software guide: Lv 10", "final"),
  storeSeed("guide-antivirus-15", "antivirus", 14, 15, 28731, "per_level", "hackex.net", "hackex.net software guide: Lv 15", "final"),
  storeSeed("guide-spam-1", "spam", 0, 1, 1800, "per_level", "hackex.net", "hackex.net software guide: base price", "final"),
  storeSeed("guide-spam-5", "spam", 4, 5, 14586, "per_level", "hackex.net", "hackex.net software guide: Lv 5", "final"),
  storeSeed("guide-spam-10", "spam", 9, 10, 35915, "per_level", "hackex.net", "hackex.net software guide: Lv 10", "final"),
  storeSeed("guide-spam-15", "spam", 14, 15, 60841, "per_level", "hackex.net", "hackex.net software guide: Lv 15", "final"),
  storeSeed("guide-siphon-1", "siphon", 0, 1, 1600, "per_level", "hackex.net", "hackex.net software guide: base price", "final"),
  storeSeed("guide-siphon-5", "siphon", 4, 5, 12966, "per_level", "hackex.net", "hackex.net software guide: Lv 5", "final"),
  storeSeed("guide-siphon-10", "siphon", 9, 10, 31925, "per_level", "hackex.net", "hackex.net software guide: Lv 10", "final"),
  storeSeed("guide-siphon-15", "siphon", 14, 15, 54081, "per_level", "hackex.net", "hackex.net software guide: Lv 15", "final"),
  storeSeed("guide-rootkit-1", "rootkit", 0, 1, 1400, "per_level", "hackex.net", "hackex.net software guide: base price", "final"),
  storeSeed("guide-rootkit-5", "rootkit", 4, 5, 11345, "per_level", "hackex.net", "hackex.net software guide: Lv 5", "final"),
  storeSeed("guide-rootkit-10", "rootkit", 9, 10, 27934, "per_level", "hackex.net", "hackex.net software guide: Lv 10", "final"),
  storeSeed("guide-rootkit-15", "rootkit", 14, 15, 47321, "per_level", "hackex.net", "hackex.net software guide: Lv 15", "final"),
  storeSeed("guide-proxy-1", "proxy", 0, 1, 900, "per_level", "hackex.net", "hackex.net software guide: base price (before 15% defensive discount)", "before_discount"),
  storeSeed("guide-proxy-5", "proxy", 4, 5, 6200, "per_level", "hackex.net", "hackex.net software guide: Lv 5", "final"),
  storeSeed("guide-proxy-10", "proxy", 9, 10, 15265, "per_level", "hackex.net", "hackex.net software guide: Lv 10", "final"),
  storeSeed("guide-proxy-15", "proxy", 14, 15, 25858, "per_level", "hackex.net", "hackex.net software guide: Lv 15", "final"),
  storeSeed("guide-trace-1", "trace", 0, 1, 900, "per_level", "hackex.net", "hackex.net software guide: base price (before 15% defensive discount)", "before_discount"),
  storeSeed("guide-trace-5", "trace", 4, 5, 6200, "per_level", "hackex.net", "hackex.net software guide: Lv 5", "final"),
  storeSeed("guide-trace-10", "trace", 9, 10, 15265, "per_level", "hackex.net", "hackex.net software guide: Lv 10", "final"),
  storeSeed("guide-trace-15", "trace", 14, 15, 25858, "per_level", "hackex.net", "hackex.net software guide: Lv 15", "final"),
  storeSeed("guide-keygen-1", "keygen", 0, 1, 600, "per_level", "hackex.net", "hackex.net software guide: base price", "final"),
  storeSeed("guide-keygen-5", "keygen", 4, 5, 4862, "per_level", "hackex.net", "hackex.net software guide: Lv 5", "final"),
  storeSeed("guide-keygen-10", "keygen", 9, 10, 11972, "per_level", "hackex.net", "hackex.net software guide: Lv 10", "final"),
  storeSeed("guide-keygen-15", "keygen", 14, 15, 20281, "per_level", "hackex.net", "hackex.net software guide: Lv 15", "final"),
  storeSeed("guide-notepad", "notepad", 0, 1, 5000, "one_time", "hackex.net", "hackex.net software guide", "final"),
  storeSeed("guide-message_encryptor", "message_encryptor", 0, 1, 9000, "one_time", "hackex.net", "hackex.net software guide", "final")
  ],
  exp: [],
  levelReqs: [
    { id: "seed-levelreq-24", level: 24, expRequired: 17993, contributor: "hilltop", createdAt: at, status: "observed", notes: "Game home screenshot, Oct 18 2026", reboots: 3 }
  ]
};
