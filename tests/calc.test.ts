import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { planRow, planTotals } from "../src/domain/calc";
import { Knowledge } from "../src/domain/knowledge";
import { SEED_OBSERVATIONS } from "../src/domain/seed";
import { formulaStorePrice, formulaXp, formulaKeyPrice } from "../src/domain/formulas";

const kb = new Knowledge(SEED_OBSERVATIONS);

describe("Upgrade calculator", () => {
  test("store adds each level; key jumps straight there", () => {
    const r = planRow(kb, "firewall", 26, 28);
    assert.equal(r.store.cost, formulaStorePrice("firewall", 27)! + formulaStorePrice("firewall", 28)!);
    assert.equal(r.store.xp, 8370 + formulaXp("firewall", 28)!);
    assert.equal(r.key!.cost, formulaKeyPrice("firewall", 26, 28));
    assert.equal(r.key!.xp, formulaXp("firewall", 28)); // landing level only
    assert.equal(r.key!.keygenNeeded, 28);
    assert.equal(r.key!.keyXpUntested, true);
  });
  test("hardware uses the price table and its XP share; no key", () => {
    const r = planRow(kb, "network", 9, 11);
    assert.equal(r.store.cost, 120000 + 170000);
    assert.equal(r.store.xp, 24000 + 34000);
    assert.equal(r.key, null);
  });
  test("totals level the character up with carry-over (real game: 6,232/19,970 + 34,000 → LVL 27 at 20,262)", () => {
    const rows = [planRow(kb, "network", 10, 11)];
    const t = planTotals(kb, rows, {}, { level: 26, exp: 6232, required: 19970 }, 20);
    assert.equal(t.cost, 170000);
    assert.deepEqual(t.after, { level: 27, exp: 20262, required: 20978, levelsGained: 1 });
  });
  test("choosing a key above your Keygen level is flagged", () => {
    const rows = [planRow(kb, "spam", 20, 32)];
    const t = planTotals(kb, rows, { spam: "key" }, { level: 30, exp: 0, required: 24079 }, 20);
    assert.deepEqual(t.keygenShort, [{ upgradeId: "spam", needs: 32 }]);
    assert.equal(t.cost, 57451); // friend A saw this exact key price
  });
});
