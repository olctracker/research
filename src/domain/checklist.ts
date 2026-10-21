// What still needs testing before each formula is 100%. Items tick themselves off from the shared data
// and say whether the new number matched the formula.

import { getEntry } from "./catalog";
import { charTarget, formulaKeyPrice, formulaStorePrice, hardwareXp, predictedStoreXp } from "./formulas";
import type { Knowledge } from "./knowledge";
import type { ObservationSet } from "./types";

export interface Evidence { text: string; match: boolean | null; note?: string }
export interface CheckItem { id: string; title: string; how: string; evidence: Evidence[] }
export interface CheckGroup { id: string; title: string; formula: string; status: string; items: CheckItem[] }

const n = (v: number) => v.toLocaleString("en-US");
const name = (id: string) => getEntry(id).name;
const HARDWARE = new Set(["device", "network", "botnet"]);
const ONE_TIME = new Set(["notepad", "message_encryptor"]);

export function buildChecklist(obs: ObservationSet, kb: Knowledge): CheckGroup[] {
  const prices = obs.prices.filter((p) => p.status !== "rejected" && p.priceBasis === "final");
  const keys = prices.filter((p) => p.method === "download" && p.costType === "combined");
  const store = prices.filter((p) => p.method === "store" && p.costType === "per_level" && !HARDWARE.has(p.upgradeId));
  const xp = obs.exp.filter((e) => e.status !== "rejected");
  const storeXp = xp.filter((e) => e.method === "store" && e.expBasis === "per_level");
  const reqs = obs.levelReqs.filter((r) => r.status !== "rejected");

  const keyEv = (list: typeof keys): Evidence[] => list.map((k) => {
    const f = formulaKeyPrice(k.upgradeId, k.fromLevel, k.toLevel);
    return { text: `${name(k.upgradeId)} ${k.fromLevel}→${k.toLevel}: ${n(k.cost)}`, match: f === null ? null : f === k.cost, note: f !== null && f !== k.cost ? `formula said ${n(f)}` : undefined };
  });
  const storeEv = (list: typeof store): Evidence[] => list.map((p) => {
    const f = formulaStorePrice(p.upgradeId, p.toLevel);
    return { text: `${name(p.upgradeId)} Lv ${p.toLevel}: ${n(p.cost)}${p.reboots != null ? ` (R${p.reboots})` : ""}`, match: f === null ? null : f === p.cost, note: f !== null && f !== p.cost ? `formula said ${n(f)}` : undefined };
  });
  const xpEv = (list: typeof xp): Evidence[] => list.map((e) => {
    const text = `${name(e.upgradeId)} ${e.method === "download" ? `${e.fromLevel}→${e.toLevel} (key)` : `Lv ${e.toLevel}`}: +${n(e.exp)} XP`;
    const known = predictedStoreXp(e.upgradeId, e.toLevel);
    if (known) return { text, match: known.value === e.exp, note: known.value !== e.exp ? `formula said ${n(known.value)}` : undefined };
    if (HARDWARE.has(e.upgradeId)) {
      const price = kb.storeLevelPrice(e.upgradeId, e.toLevel).value;
      if (price === null) return { text, match: null, note: "need this level's price to compare" };
      const h = hardwareXp(e.upgradeId, price);
      if (!h) return { text, match: null, note: `${((e.exp / price) * 100).toFixed(1)}% of its price` };
      return { text, match: h.value === e.exp, note: h.value === e.exp ? ({ device: "exactly 25% of the price", network: "exactly 20% of the price" } as Record<string, string>)[e.upgradeId] ?? "exactly the price ÷ 6" : `expected ${n(h.value)}` };
    }
    if (ONE_TIME.has(e.upgradeId)) {
      const price = kb.oneTimeItemPrice(e.upgradeId).value;
      return { text, match: null, note: price !== null ? `${((e.exp / price) * 100).toFixed(1)}% of its price` : undefined };
    }
    return { text, match: null };
  });
  const reqEv = (list: typeof reqs): Evidence[] => list.map((r) => {
    const f = charTarget(r.level);
    return { text: `LVL ${r.level}: ${n(r.expRequired)}${r.reboots != null ? ` (R${r.reboots})` : ""}`, match: f === r.expRequired, note: f !== r.expRequired && f !== null ? `formula said ${n(f)}` : undefined };
  });

  const jump = (k: (typeof keys)[number]) => k.toLevel - k.fromLevel;
  const tally = <T,>(list: T[], ok: (x: T) => boolean | null) => {
    const checked = list.map(ok).filter((v) => v !== null);
    return `${checked.filter(Boolean).length} of ${checked.length} match`;
  };
  const keyTally = tally(keys, (k) => { const f = formulaKeyPrice(k.upgradeId, k.fromLevel, k.toLevel); return f === null ? null : f === k.cost; });
  const minJump = keys.length ? Math.min(...keys.map(jump)) : null;
  const storeTally = tally(store, (p) => { const f = formulaStorePrice(p.upgradeId, p.toLevel); return f === null ? null : f === p.cost; });
  const reqTally = tally(reqs, (q) => charTarget(q.level) === q.expRequired);
  const softXp = xp.filter((e) => (e.method === "download" || e.expBasis === "per_level") && predictedStoreXp(e.upgradeId, e.toLevel) !== null);
  const xpTally = tally(softXp, (e) => predictedStoreXp(e.upgradeId, e.toLevel)!.value === e.exp);
  // Reboots only go up, so a player's real reboot count is the highest they've ever reported
  // (a stray R0 on an old report doesn't count as a different reboot).
  const highest = new Map<string, number>();
  for (const r of [...prices, ...xp, ...reqs]) if (r.reboots != null) highest.set(r.contributor, Math.max(highest.get(r.contributor) ?? 0, r.reboots));
  const otherRebootRow = (r: { contributor: string; reboots?: number | null }) => r.reboots != null && r.reboots !== 3 && highest.get(r.contributor) === r.reboots;

  return [
    {
      id: "keys", title: "Keygen key prices", status: `Verified for jumps of ${minJump ?? "?"}+ levels (${keyTally})`,
      formula: "store price of the target level × 0.5 × (0.3 + 0.7 × (jump − 1) ÷ 19), max 1, rounded up",
      items: [
        { id: "key-1", title: "A key that jumps 1 level", how: "Any program. Paste an Apps screen showing a LOCKED key just 1 level above the current level.", evidence: keyEv(keys.filter((k) => jump(k) === 1)) },
        { id: "key-2", title: "A key that jumps 2 levels", how: "Any program.", evidence: keyEv(keys.filter((k) => jump(k) === 2)) },
        { id: "key-3", title: "A key that jumps 3–4 levels", how: "Any program.", evidence: keyEv(keys.filter((k) => jump(k) === 3 || jump(k) === 4)) },
        { id: "key-buy", title: "Actually buy a key and record it", how: "Record it on Purchase with Keygen. Proves the price charged is the price shown.", evidence: keyEv(keys.filter((k) => k.purchaseId)) }
      ]
    },
    {
      id: "store", title: "Store prices", status: `Verified (${storeTally})`,
      formula: "base × LVL^1.3 rounded up; defensive programs then × 0.85 rounded up. Device / Network / Botnet use fixed tables.",
      items: [
        { id: "store-high", title: "A store price above level 40", how: "Any program. Checks the curve holds at high levels.", evidence: storeEv(store.filter((p) => p.toLevel > 40)) },
        { id: "store-reboot", title: "A store price from a different reboot (not R3)", how: "Any program, from anyone who isn't on R3. Shows whether reboots change prices.", evidence: storeEv(store.filter(otherRebootRow)) }
      ]
    },
    {
      id: "xp", title: "Upgrade XP", status: `Verified for software (${xpTally}) · hardware partly`,
      formula: "20% × (base × LVL^1.25 rounded up, × 0.85 for defensive rounded up), rounded down. A key gives the XP of the level it lands on. Device: 25% of its price. Network: 20%. Botnet: price ÷ 6 (likely).",
      items: [
        { id: "xp-high", title: "Software XP above level 30", how: "Any program, store or key. Checks the curve holds at high levels.", evidence: xpEv(softXp.filter((e) => e.toLevel > 30)) },
        { id: "xp-keyjump", title: "XP from a key that jumps 2+ levels", how: "Any program. Does a bigger jump still give only the landing level's XP?", evidence: xpEv(xp.filter((e) => e.method === "download" && e.toLevel - e.fromLevel >= 2)) },
        { id: "xp-botnet", title: "XP for a third Botnet tier", how: "Botnet looks like price ÷ 6 from 2 tiers. One more confirms it.", evidence: (() => { const b = xpEv(storeXp.filter((e) => e.upgradeId === "botnet")); return b.length >= 3 ? b : []; })() },
        // One-time items each get their own test: no shared formula is assumed.
        { id: "xp-notepad", title: "XP for Notepad", how: "Buy Notepad and enter your stats after. Its XP is recorded on its own.", evidence: xpEv(storeXp.filter((e) => e.upgradeId === "notepad")) },
        { id: "xp-msgenc", title: "XP for Message Encryptor", how: "Buy Message Encryptor and enter your stats after. Its XP is recorded on its own.", evidence: xpEv(storeXp.filter((e) => e.upgradeId === "message_encryptor")) }
      ]
    },
    {
      id: "char", title: "Character XP targets", status: `Verified (${reqTally}; also LVL 1 = 589 from a fresh account)`,
      formula: "230 × (LVL + 1)^1.3544, rounded up",
      items: [
        { id: "char-low", title: "A target from LVL 2–10", how: "From anyone low level. Paste their Home screen in Device Input.", evidence: reqEv(reqs.filter((r) => r.level >= 1 && r.level <= 10)) },
        { id: "char-high", title: "A target above LVL 40", how: "From anyone high level.", evidence: reqEv(reqs.filter((r) => r.level > 40)) },
        { id: "char-reboot", title: "A target from a different reboot (not R3)", how: "Anyone not on R3.", evidence: reqEv(reqs.filter(otherRebootRow)) }
      ]
    }
  ];
}

/** An item is done once it has evidence; it "passes" if every piece of evidence that can be checked matched. */
export const isDone = (i: CheckItem) => i.evidence.length > 0;
export const failed = (i: CheckItem) => i.evidence.some((e) => e.match === false);
