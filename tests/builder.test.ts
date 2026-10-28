import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { buildCharacter, endingLevel, floorLevel } from "../src/domain/builder";
import { Knowledge } from "../src/domain/knowledge";
import { SEED_OBSERVATIONS } from "../src/domain/seed";
import { formulaKeyPrice, formulaStorePrice, formulaXp } from "../src/domain/formulas";

const kb = new Knowledge(SEED_OBSERVATIONS);

describe("Character builder", () => {
  test("store, single jump and 2/3-level mixes for one app", () => {
    const r = buildCharacter(kb, { spam: { from: 0, to: 7 } });
    let store = 0, xp = 0;
    for (let l = 1; l <= 7; l++) { store += formulaStorePrice("spam", l)!; xp += formulaXp("spam", l)!; }
    assert.equal(r.store.cost, store);
    assert.equal(r.store.xp, xp);
    assert.equal(r.jump.cost, formulaKeyPrice("spam", 0, 7));
    assert.equal(r.jump.xp, formulaXp("spam", 7));
    // 3 at a time: 0→3, 3→6, 6→7
    assert.equal(r.mix3.cost, formulaKeyPrice("spam", 0, 3)! + formulaKeyPrice("spam", 3, 6)! + formulaKeyPrice("spam", 6, 7)!);
    assert.equal(r.mix3.xp, formulaXp("spam", 3)! + formulaXp("spam", 6)! + formulaXp("spam", 7)!);
    assert.equal(r.keygenNeeded, 7);
  });
  test("hardware, Keygen and one-time items are store-only in every option", () => {
    const r = buildCharacter(kb, { network: { from: 9, to: 11 }, keygen: { from: 0, to: 2 }, notepad: { from: 0, to: 1 } });
    for (const s of [r.store, r.singleKeys, r.jump, r.mix2, r.mix3]) assert.equal(s.cost, r.store.cost);
    assert.equal(r.store.cost, 120000 + 170000 + formulaStorePrice("keygen", 1)! + formulaStorePrice("keygen", 2)! + 5000);
    assert.equal(r.keygenNeeded, 0);
  });
  test("ending level carries XP over (real game: LVL 26 6,232 + 34,000 → LVL 27 20,262)", () => {
    assert.deepEqual(endingLevel(26, 6232, 34000), { level: 27, exp: 20262, required: 20978, levelsGained: 1 });
  });
  test("hardware can't go below level 1", () => {
    assert.equal(floorLevel("botnet"), 1);
    assert.equal(floorLevel("antivirus"), 0);
  });
});
