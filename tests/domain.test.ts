// Acceptance tests from the spec (section 15). Run with: npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { CATALOG, getEntry, methodsFor, validateLevel } from "../src/domain/catalog";
import { addXp, applyExp, inferExpGained } from "../src/domain/exp";
import { needsEntry, nextPriceRows } from "../src/domain/nextPrices";
import { defaultLevels } from "../src/domain/catalog";
import { consensus, Knowledge } from "../src/domain/knowledge";
import { missingKey, planPurchase, totalsWithEntered } from "../src/domain/purchase";
import { buildRecord, newLevelReqs } from "../src/domain/record";
import { computeCompleteness, summarize } from "../src/domain/completeness";
import { toCsv } from "../src/domain/export";
import { findConflicts, resolution } from "../src/domain/conflicts";
import { SEED_OBSERVATIONS } from "../src/domain/seed";
import type { ExpObservation, ObservationSet, PriceObservation } from "../src/domain/types";

const empty = (): ObservationSet => ({ prices: [], exp: [], levelReqs: [] });
let n = 0;
const id = () => `t${++n}`;
const P = (o: Partial<PriceObservation>): PriceObservation => ({
  id: id(), upgradeId: "spam", method: "store", fromLevel: 0, toLevel: 1, cost: 0, costType: "per_level",
  priceBasis: "final", keygenLevel: null, contributor: "test", createdAt: "x", status: "observed", notes: "", purchaseId: null, ...o
});
const E = (o: Partial<ExpObservation>): ExpObservation => ({
  id: id(), upgradeId: "spam", method: "store", fromLevel: 0, toLevel: 1, exp: 0, expBasis: "per_level",
  source: "entered", contributor: "test", createdAt: "x", status: "observed", notes: "", purchaseId: null, ...o
});
const noReq = () => null;

describe("Catalog", () => {
  test("16 entries: 14 level-based + 2 one-time", () => {
    assert.equal(CATALOG.length, 16);
    assert.equal(CATALOG.filter((e) => e.kind === "level").length, 14);
    assert.equal(CATALOG.filter((e) => e.kind === "one_time").length, 2);
  });

  test("starting levels match the spec", () => {
    const expected: Record<string, number> = {
      device: 1, network: 1, botnet: 1, firewall: 1, password_encryptor: 1, antivirus: 0, proxy: 0, trace: 0,
      bypasser: 1, password_cracker: 1, spam: 0, siphon: 0, rootkit: 0, keygen: 0, message_encryptor: 0, notepad: 0
    };
    for (const [k, v] of Object.entries(expected)) assert.equal(getEntry(k).startLevel, v, k);
  });

  test("Device/Network/Botnet caps are 12/11/7; others have no invented cap", () => {
    assert.equal(getEntry("device").maxLevel, 12);
    assert.equal(getEntry("network").maxLevel, 11);
    assert.equal(getEntry("botnet").maxLevel, 7);
    for (const e of CATALOG.filter((e) => e.kind === "level" && e.category !== "core")) assert.equal(e.maxLevel, null, e.id);
    assert.equal(validateLevel(getEntry("device"), 13) !== null, true);
    assert.equal(validateLevel(getEntry("spam"), 500), null);
  });

  test("Keygen starts at 0 and is store-only; core is store-only", () => {
    assert.deepEqual(methodsFor(getEntry("keygen")), ["store"]);
    for (const k of ["device", "network", "botnet"]) assert.deepEqual(methodsFor(getEntry(k)), ["store"]);
    assert.deepEqual(methodsFor(getEntry("spam")), ["store", "download"]);
  });

  test("Message Encryptor and Notepad are one-time, store-only", () => {
    for (const k of ["message_encryptor", "notepad"]) {
      const e = getEntry(k);
      assert.equal(e.kind, "one_time");
      assert.deepEqual(methodsFor(e), ["store"]);
    }
  });

  test("defensive discount applies to exactly the five defensive upgrades", () => {
    const d = CATALOG.filter((e) => e.defensiveDiscount).map((e) => e.id).sort();
    assert.deepEqual(d, ["antivirus", "firewall", "password_encryptor", "proxy", "trace"]);
  });
});

describe("EXP calculations", () => {
  test("4 at 90/130 → 5 at 10/150 means 50 EXP", () => {
    const r = inferExpGained({ level: 4, exp: 90, required: 130 }, { level: 5, exp: 10, required: 150 }, noReq);
    assert.equal(r.status, "exact");
    assert.equal(r.exp, 50);
    assert.deepEqual(r.breakdown.map((b) => b.amount), [40, 10]);
  });

  test("multi-level uses each level's own requirement", () => {
    const reqs: Record<number, number> = { 5: 100, 6: 150, 7: 200 };
    const r = inferExpGained({ level: 5, exp: 80, required: 100 }, { level: 8, exp: 30, required: null }, (l) => reqs[l] ?? null);
    assert.equal(r.status, "exact");
    assert.equal(r.exp, 20 + 150 + 200 + 30);
  });

  test("flat 100-per-level example: 80/100 + 250 → 3 levels and 30 EXP", () => {
    const p = applyExp({ level: 1, exp: 80, required: 100 }, 250, () => 100);
    assert.equal(p.status, "exact");
    assert.equal(p.levelsGained, 3);
    assert.equal(p.state?.exp, 30);
  });

  test("increasing thresholds change the projection", () => {
    const reqs: Record<number, number> = { 2: 120, 3: 140 };
    const p = applyExp({ level: 1, exp: 80, required: 100 }, 250, (l) => reqs[l] ?? null);
    assert.equal(p.status, "exact");
    assert.equal(p.levelsGained, 2); // 20 + 120 = 140, 110 left < 140
    assert.equal(p.state?.exp, 110);
  });

  test("unknown intermediate requirement → incomplete, never a fake exact number", () => {
    const r = inferExpGained({ level: 5, exp: 80, required: 100 }, { level: 8, exp: 30, required: null }, (l) => (l === 6 ? 150 : null));
    assert.equal(r.status, "incomplete");
    assert.equal(r.exp, null);
    assert.deepEqual(r.missingLevels, [7]);
    assert.ok((r.atLeast ?? 0) > 20 + 150 + 30);
  });

  test("bad inputs are invalid", () => {
    assert.equal(inferExpGained({ level: 5, exp: 10, required: 100 }, { level: 4, exp: 0, required: 90 }, noReq).status, "invalid");
    assert.equal(inferExpGained({ level: 5, exp: 50, required: 100 }, { level: 5, exp: 40, required: 100 }, noReq).status, "invalid");
    assert.equal(inferExpGained({ level: 5, exp: 120, required: 100 }, { level: 6, exp: 0, required: 100 }, noReq).status, "invalid");
  });

  test("download EXP uses destination-level reward only", () => {
    const kb = new Knowledge({ ...empty(), exp: [E({ method: "download", fromLevel: 1, toLevel: 5, exp: 5, expBasis: "per_transaction" })] });
    const plan = planPurchase({ entry: getEntry("spam"), method: "download", currentLevel: 1, targetLevel: 5, keygenLevel: 5, kb });
    assert.equal(plan.lines.length, 1);
    assert.equal(plan.totalExp, 5);
  });
});

describe("Purchase logic", () => {
  test("store purchase sums each level (Example A: 1 → 5 = 1,400 cost, 14 EXP)", () => {
    const kb = new Knowledge(SEED_OBSERVATIONS);
    const plan = planPurchase({ entry: getEntry("spam"), method: "store", currentLevel: 1, targetLevel: 5, keygenLevel: 0, kb });
    assert.deepEqual(plan.errors, []);
    assert.equal(plan.lines.length, 4);
    assert.equal(plan.totalCost, 1400);
    assert.equal(plan.totalExp, 14);
    assert.equal(plan.missing.length, 0);
    assert.equal(plan.usesUnverified, true); // each value observed only once
  });

  test("download uses combined cost and destination EXP (Example B)", () => {
    const kb = new Knowledge({
      ...empty(),
      prices: [P({ method: "download", costType: "combined", fromLevel: 1, toLevel: 5, cost: 1000, keygenLevel: 5 })],
      exp: [E({ method: "download", fromLevel: 1, toLevel: 5, exp: 5, expBasis: "per_transaction" })]
    });
    const plan = planPurchase({ entry: getEntry("spam"), method: "download", currentLevel: 1, targetLevel: 5, keygenLevel: 5, kb });
    assert.equal(plan.totalCost, 1000);
    assert.equal(plan.totalExp, 5);
  });

  test("download components are summed only as a labelled estimate", () => {
    const kb = new Knowledge({
      ...empty(),
      prices: [2, 3, 4, 5].map((l) => P({ method: "download", costType: "component", fromLevel: l - 1, toLevel: l, cost: (l - 1) * 100 }))
    });
    const plan = planPurchase({ entry: getEntry("spam"), method: "download", currentLevel: 1, targetLevel: 5, keygenLevel: 5, kb });
    assert.equal(plan.totalCost, 1000);
    assert.equal(plan.lines[0].costSource, "component_sum");
    assert.equal(plan.usesUnverified, true);
    // a real total typed by the player wins over the estimate
    const k = missingKey({ kind: "download_price", fromLevel: 1, toLevel: 5 });
    assert.equal(totalsWithEntered(plan, { [k]: 990 }).cost, 990);
  });

  test("Keygen eligibility: level 11 qualifies for 11, level 10 does not", () => {
    const kb = new Knowledge(empty());
    const ok = planPurchase({ entry: getEntry("firewall"), method: "download", currentLevel: 3, targetLevel: 11, keygenLevel: 11, kb });
    assert.deepEqual(ok.errors, []);
    const no = planPurchase({ entry: getEntry("firewall"), method: "download", currentLevel: 3, targetLevel: 11, keygenLevel: 10, kb });
    assert.equal(no.errors.length, 1);
  });

  test("store-only upgrades can't be downloaded", () => {
    const kb = new Knowledge(empty());
    for (const k of ["device", "keygen", "notepad"]) {
      const p = planPurchase({ entry: getEntry(k), method: "download", currentLevel: 0, targetLevel: 1, keygenLevel: 99, kb });
      assert.equal(p.errors.length, 1, k);
    }
  });

  test("store and download prices stay separate", () => {
    const kb = new Knowledge({ ...empty(), prices: [P({ toLevel: 2, fromLevel: 1, cost: 200 })] });
    assert.equal(kb.storeLevelPrice("spam", 2).value, 200);
    assert.equal(kb.downloadCombinedPrice("spam", 1, 2).value, null);
    assert.equal(kb.downloadComponentPrice("spam", 2).value, null);
  });

  test("one-time items can't be bought twice", () => {
    const kb = new Knowledge(empty());
    const p = planPurchase({ entry: getEntry("notepad"), method: "store", currentLevel: 1, targetLevel: 5, keygenLevel: 0, kb });
    assert.equal(p.errors.length, 1);
    const fresh = planPurchase({ entry: getEntry("notepad"), method: "store", currentLevel: 0, targetLevel: 5, keygenLevel: 0, kb });
    assert.equal(fresh.toLevel, 1);
    assert.equal(fresh.lines.length, 1);
  });

  test("caps enforced", () => {
    const p = planPurchase({ entry: getEntry("botnet"), method: "store", currentLevel: 6, targetLevel: 8, keygenLevel: 0, kb: new Knowledge(empty()) });
    assert.equal(p.errors.length, 1);
  });

  test("missing data is listed, not guessed (Trace 3 → 4)", () => {
    const p = planPurchase({ entry: getEntry("trace"), method: "store", currentLevel: 3, targetLevel: 4, keygenLevel: 0, kb: new Knowledge(empty()) });
    assert.equal(p.totalCost, null);
    assert.equal(p.totalExp, null);
    assert.deepEqual(p.missing.map((m) => m.kind), ["store_price", "store_exp"]);
    assert.equal(p.missing[0].toLevel, 4);
  });
});

describe("Data integrity", () => {
  test("conflicting observations are kept and flagged, not averaged", () => {
    const c = consensus([{ id: "a", value: 200, status: "observed" }, { id: "b", value: 210, status: "observed" }]);
    assert.equal(c.reliability, "conflict");
    assert.equal(c.value, null);
    assert.deepEqual(c.values, [200, 210]);
    assert.equal(c.count, 2);
  });

  test("repeated identical observations → repeated; rejected ones ignored; confirmed wins", () => {
    assert.equal(consensus([{ id: "a", value: 5, status: "observed" }, { id: "b", value: 5, status: "observed" }]).reliability, "repeated");
    assert.equal(consensus([{ id: "a", value: 5, status: "observed" }, { id: "b", value: 9, status: "rejected" }]).reliability, "observed_once");
    const c = consensus([{ id: "a", value: 5, status: "confirmed" }, { id: "b", value: 9, status: "observed" }]);
    assert.equal(c.value, 5);
    assert.equal(c.disputed, true);
  });

  test("recording derives one unknown level's EXP from the character change", () => {
    // Spam 1 → 3 by store; level 2 EXP known (2), level 3 unknown. Character +5 EXP → level 3 = 3.
    const obs: ObservationSet = { ...empty(), prices: [P({ fromLevel: 1, toLevel: 2, cost: 200 }), P({ fromLevel: 2, toLevel: 3, cost: 300 })], exp: [E({ fromLevel: 1, toLevel: 2, exp: 2 })] };
    const kb = new Knowledge(obs);
    const plan = planPurchase({ entry: getEntry("spam"), method: "store", currentLevel: 1, targetLevel: 3, keygenLevel: 0, kb });
    const res = buildRecord({
      plan, entered: {}, before: { level: 4, exp: 90, required: 130 }, after: { level: 4, exp: 95, required: 130 },
      keygenLevel: null, kb, reqFor: kb.reqFn(), contributor: "me", notes: "", now: "now", newId: id
    });
    assert.equal(res.record.expEarned, 5);
    assert.equal(res.record.cost, 500);
    const expCand = res.candidates.filter((c) => c.type === "exp");
    assert.equal(expCand.length, 1);
    assert.equal(expCand[0].type === "exp" && expCand[0].data.exp, 3);
    assert.equal(expCand[0].type === "exp" && expCand[0].data.source, "derived");
    for (const c of res.candidates) assert.equal(c.data.status, "observed"); // never auto-confirmed
  });

  test("mismatch between known rewards and character change is flagged, nothing inferred", () => {
    const kb = new Knowledge(SEED_OBSERVATIONS);
    const plan = planPurchase({ entry: getEntry("spam"), method: "store", currentLevel: 1, targetLevel: 2, keygenLevel: 0, kb });
    const res = buildRecord({
      plan, entered: {}, before: { level: 4, exp: 10, required: 130 }, after: { level: 4, exp: 20, required: 130 },
      keygenLevel: null, kb, reqFor: kb.reqFn(), contributor: "me", notes: "", now: "now", newId: id
    });
    assert.ok(res.warnings.some((w) => w.includes("known rewards")));
    assert.equal(res.candidates.filter((c) => c.type === "exp").length, 0);
  });

  test("provenance kept on contributed observations", () => {
    const kb = new Knowledge(empty());
    const plan = planPurchase({ entry: getEntry("trace"), method: "store", currentLevel: 3, targetLevel: 4, keygenLevel: 0, kb });
    const res = buildRecord({
      plan, entered: { [missingKey(plan.missing[0])]: 850 }, before: { level: 4, exp: 90, required: 130 },
      after: { level: 5, exp: 10, required: 150 }, keygenLevel: null, kb, reqFor: kb.reqFn(), contributor: "alice", notes: "n", now: "t", newId: id
    });
    const price = res.candidates.find((c) => c.type === "price");
    assert.ok(price && price.type === "price");
    assert.equal(price.data.contributor, "alice");
    assert.equal(price.data.purchaseId, res.record.id);
    assert.equal(price.data.cost, 850);
    const exp = res.candidates.find((c) => c.type === "exp");
    assert.ok(exp && exp.type === "exp" && exp.data.exp === 50 && exp.data.source === "inferred");
    assert.equal(res.candidates.filter((c) => c.type === "level_req").length, 2);
  });

  test("completeness reports its range and never claims full coverage of uncapped software", () => {
    const exampleA = { ...SEED_OBSERVATIONS, prices: SEED_OBSERVATIONS.prices.filter((p) => p.id.startsWith("seed-spam-store")) };
    const rows = computeCompleteness(new Knowledge(exampleA));
    const spam = rows.find((r) => r.upgradeId === "spam" && r.series === "store_price");
    assert.ok(spam);
    assert.equal(spam.rangeKind, "horizon");
    assert.equal(spam.rangeFrom, 1);
    assert.equal(spam.counts.observed_once, 4);
    const device = rows.find((r) => r.upgradeId === "device" && r.series === "store_price");
    assert.equal(device?.rangeKind, "cap");
    assert.equal(device?.rangeTo, 12);
    assert.equal(rows.some((r) => r.upgradeId === "device" && r.series.startsWith("download")), false);
    assert.ok(summarize(rows).percentKnown < 100);
  });

  test("CSV escaping", () => {
    assert.equal(toCsv([{ a: 'x,"y"', b: 1 }]), 'a,b\n"x,""y""",1\n');
  });
});

describe("Admin conflict review", () => {
  const two = (): ObservationSet => ({
    ...empty(),
    prices: [
      P({ id: "a", fromLevel: 5, toLevel: 6, cost: 600, contributor: "alice", createdAt: "2026-10-01" }),
      P({ id: "b", fromLevel: 5, toLevel: 6, cost: 650, contributor: "bob", createdAt: "2026-10-02" }),
      P({ id: "c", fromLevel: 5, toLevel: 6, cost: 600, contributor: "cara", createdAt: "2026-10-03" }),
      P({ id: "d", fromLevel: 6, toLevel: 7, cost: 700 })
    ]
  });

  test("lists each disagreeing value with who entered it", () => {
    const g = findConflicts(two());
    assert.equal(g.length, 1);
    assert.equal(g[0].subtitle, "Store price · level 6");
    assert.deepEqual(g[0].options.map((o) => o.value), [600, 650]); // most-reported first
    assert.deepEqual(g[0].options[0].rows.map((r) => r.contributor), ["alice", "cara"]);
    assert.deepEqual(g[0].options[1].rows.map((r) => r.contributor), ["bob"]);
  });

  test("admin choice confirms one value and rejects the rest; conflict then clears", () => {
    const obs = two();
    const { keep, reject } = resolution(findConflicts(obs)[0], 650);
    assert.deepEqual(keep, ["b"]);
    assert.deepEqual(reject.sort(), ["a", "c"]);
    const decided: ObservationSet = { ...obs, prices: obs.prices.map((p) => ({ ...p, status: keep.includes(p.id) ? "confirmed" : reject.includes(p.id) ? "rejected" : p.status })) };
    assert.equal(findConflicts(decided).length, 0);
    assert.equal(new Knowledge(decided).storeLevelPrice("spam", 6).value, 650);
    assert.equal(new Knowledge(decided).storeLevelPrice("spam", 6).reliability, "confirmed");
    assert.equal(decided.prices.length, 4); // nothing deleted
  });

  test("a new report that disagrees with a confirmed value comes back for review", () => {
    const obs: ObservationSet = { ...empty(), prices: [
      P({ id: "a", fromLevel: 5, toLevel: 6, cost: 600, status: "confirmed" }),
      P({ id: "b", fromLevel: 5, toLevel: 6, cost: 610 })
    ] };
    const g = findConflicts(obs);
    assert.equal(g.length, 1);
    assert.equal(g[0].challengesConfirmed, true);
  });

  test("store and download values for the same level never count as a conflict", () => {
    const obs: ObservationSet = { ...empty(), exp: [
      E({ fromLevel: 4, toLevel: 5, exp: 5 }),
      E({ method: "download", fromLevel: 1, toLevel: 5, exp: 9, expBasis: "per_transaction" })
    ] };
    assert.equal(findConflicts(obs).length, 0);
  });
});


describe("Next-level prices and XP carry-over", () => {
  test("asks for the NEXT level's price (Firewall 4 → price for 5)", () => {
    const levels = { ...defaultLevels(), firewall: 4 };
    const rows = nextPriceRows(levels, new Knowledge(empty()), "store");
    const fw = rows.find((r) => r.entry.id === "firewall")!;
    assert.equal(fw.nextLevel, 5);
    assert.equal(fw.status, "missing");
  });

  test("known prices aren't counted as missing; maxed and owned items are skipped", () => {
    const levels = { ...defaultLevels(), spam: 1, botnet: 7, notepad: 1 };
    const rows = nextPriceRows(levels, new Knowledge(SEED_OBSERVATIONS), "store");
    assert.equal(rows.find((r) => r.entry.id === "spam")!.status, "known"); // spam 2 = 200 is seeded
    assert.equal(rows.find((r) => r.entry.id === "botnet")!.status, "maxed");
    assert.equal(rows.find((r) => r.entry.id === "notepad")!.status, "owned");
    assert.equal(needsEntry(rows), rows.filter((r) => r.status === "missing").length);
  });

  test("keygen list only has downloadable software and respects Keygen level (proxy 6 → 7)", () => {
    const levels = { ...defaultLevels(), proxy: 6, keygen: 7, firewall: 9 };
    const rows = nextPriceRows(levels, new Knowledge(empty()), "download");
    assert.equal(rows.some((r) => r.entry.id === "device" || r.entry.id === "keygen"), false);
    const proxy = rows.find((r) => r.entry.id === "proxy")!;
    assert.equal(proxy.nextLevel, 7);
    assert.equal(proxy.status, "missing");
    assert.equal(rows.find((r) => r.entry.id === "firewall")!.status, "keygen_low"); // needs Keygen 10
  });

  test("keygen price for the next level is used as an exact price by Purchase", () => {
    const kb = new Knowledge({ ...empty(), prices: [P({ upgradeId: "proxy", method: "download", costType: "combined", fromLevel: 6, toLevel: 7, cost: 4200 })] });
    const plan = planPurchase({ entry: getEntry("proxy"), method: "download", currentLevel: 6, targetLevel: 7, keygenLevel: 7, kb });
    assert.equal(plan.totalCost, 4200);
    assert.equal(nextPriceRows({ ...defaultLevels(), proxy: 6, keygen: 7 }, kb, "download").find((r) => r.entry.id === "proxy")!.status, "known");
  });

  test("XP over the limit levels up and carries the rest (20 at 234/589 + 400 → 21 at 45)", () => {
    const r = addXp({ level: 20, exp: 234, required: 589 }, 400, (l) => (l === 21 ? 650 : null));
    assert.deepEqual(r, { level: 21, exp: 45, required: 650, levelsGained: 1 });
  });

  test("unknown requirement at the new level is left for the player to fill in", () => {
    const r = addXp({ level: 20, exp: 234, required: 589 }, 400, () => null);
    assert.equal(r.level, 21);
    assert.equal(r.exp, 45);
    assert.equal(r.required, null);
  });

  test("staying under the limit just adds XP", () => {
    assert.deepEqual(addXp({ level: 24, exp: 5870, required: 17993 }, 1, () => null), { level: 24, exp: 5871, required: 17993, levelsGained: 0 });
  });
});

describe("Sharing XP needed from My Device", () => {
  test("shares LVL 24 needs 17993 once, not again on the next save", () => {
    const obs: ObservationSet = empty();
    const first = newLevelReqs([{ level: 24, exp: 5870, required: 17993 }], obs, "hilltop", "t", id);
    assert.equal(first.length, 1);
    assert.equal(first[0].level, 24);
    assert.equal(first[0].expRequired, 17993);
    obs.levelReqs.push(...first);
    assert.equal(newLevelReqs([{ level: 24, exp: 6000, required: 17993 }], obs, "hilltop", "t", id).length, 0);
    assert.equal(newLevelReqs([{ level: 24, exp: 6000, required: 17993 }], obs, "bob", "t", id).length, 1); // another player adds confidence
    assert.equal(new Knowledge(obs).levelRequirement(24).value, 17993);
  });
});

describe("Starting data from hackex.net and screenshots", () => {
  const kb = new Knowledge(SEED_OBSERVATIONS);
  test("Botnet tier prices are app levels 2–7 (site tier 0 = our level 1)", () => {
    assert.deepEqual([2, 3, 4, 5, 6, 7].map((l) => kb.storeLevelPrice("botnet", l).value), [800, 3500, 15000, 42000, 95000, 180000]);
    assert.equal(kb.storeLevelPrice("botnet", 7).reliability, "repeated"); // site + store paste agree
  });
  test("store paste prices and LVL 24 XP needed are loaded", () => {
    assert.equal(kb.storeLevelPrice("firewall", 22).value, 37815);
    assert.equal(kb.storeLevelPrice("keygen", 21).value, 31408);
    assert.equal(kb.oneTimeItemPrice("notepad").value, 5000);
    assert.equal(kb.levelRequirement(24).value, 17993);
  });
  test("Device and Network tables from hackex.net", () => {
    assert.deepEqual([2, 5, 11].map((l) => kb.storeLevelPrice("device", l).value), [4000, 28000, 220000]);
    assert.equal(kb.storeLevelPrice("device", 12).value, 300000);
    assert.deepEqual([2, 10, 11].map((l) => kb.storeLevelPrice("network", l).value), [3000, 120000, 170000]);
    assert.equal(kb.storeLevelPrice("network", 10).reliability, "repeated"); // site + store paste agree
  });
});
