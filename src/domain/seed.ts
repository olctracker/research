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

export const SEED_OBSERVATIONS: ObservationSet = {
  prices: [price(2, 200), price(3, 300), price(4, 400), price(5, 500)],
  exp: [exp(2, 2), exp(3, 3), exp(4, 4), exp(5, 5)],
  levelReqs: []
};
