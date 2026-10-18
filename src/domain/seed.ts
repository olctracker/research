// Starting observations from the project spec (Example A: Spam store levels 2–5).
// They are ordinary "observed once" records, not confirmed rules.
// Example B (download cost components 100/200/300/400, 5 XP) is NOT seeded because the
// software it came from wasn't recorded. Record it again with the software name.
// Keep in sync with supabase/migrations/0002_seed.sql.

import type { ExpObservation, ObservationSet, PriceObservation } from "./types";

const at = "2026-10-18T00:00:00.000Z";
const SEED_CONTRIBUTOR = "spec-example";

const price = (toLevel: number, cost: number): PriceObservation => ({
  id: `seed-spam-store-price-${toLevel}`, upgradeId: "spam", method: "store", fromLevel: toLevel - 1, toLevel,
  cost, costType: "per_level", priceBasis: "final", keygenLevel: null, contributor: SEED_CONTRIBUTOR,
  createdAt: at, status: "observed", notes: "Spec Example A (store 1 → 5)", purchaseId: null
});
const exp = (toLevel: number, value: number): ExpObservation => ({
  id: `seed-spam-store-exp-${toLevel}`, upgradeId: "spam", method: "store", fromLevel: toLevel - 1, toLevel,
  exp: value, expBasis: "per_level", source: "entered", contributor: SEED_CONTRIBUTOR,
  createdAt: at, status: "observed", notes: "Spec Example A (store 1 → 5)", purchaseId: null
});

// Real prices: Device, Network and Botnet tables from hackex.net (their tier 0 = our level 1), and the
// next-level prices from hilltop's store screen paste on Oct 18 2026.
const storeSeed = (
  key: string, upgradeId: string, fromLevel: number, toLevel: number, cost: number,
  costType: "per_level" | "one_time", contributor: string, notes: string
): PriceObservation => ({
  id: `seed-${key}`, upgradeId, method: "store", fromLevel, toLevel, cost, costType, priceBasis: "final",
  keygenLevel: null, contributor, createdAt: at, status: "observed", notes, purchaseId: null
});

export const SEED_OBSERVATIONS: ObservationSet = {
  prices: [
  price(2, 200), price(3, 300), price(4, 400), price(5, 500),
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
  ],
  exp: [exp(2, 2), exp(3, 3), exp(4, 4), exp(5, 5)],
  levelReqs: [
    { id: "seed-levelreq-24", level: 24, expRequired: 17993, contributor: "hilltop", createdAt: at, status: "observed", notes: "Game home screenshot, Oct 18 2026" }
  ]
};
