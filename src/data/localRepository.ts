// Local mode: everything is stored in this browser's localStorage.
// Used when no Supabase settings are configured, so the app still works offline / during setup.

import { SEED_OBSERVATIONS } from "../domain/seed";
import type { ObservationSet, PlayerState, PurchaseRecord } from "../domain/types";
import { Contribution, Flag, newId, ObservationType, Repository } from "./repository";

const K = {
  user: "hx2.userId",
  player: "hx2.player",
  purchases: "hx2.purchases",
  obs: "hx2.observations",
  flags: "hx2.flags"
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error("Couldn't save in this browser (storage may be full or blocked).");
  }
}

export class LocalRepository implements Repository {
  readonly mode = "local" as const;

  async init() {
    let id = read<string | null>(K.user, null);
    if (!id) { id = newId(); write(K.user, id); }
    return { userId: id, isAdmin: true };
  }
  async loadPlayer() { return read<PlayerState | null>(K.player, null); }
  async savePlayer(p: PlayerState) { write(K.player, p); }
  async listPurchases() {
    return read<PurchaseRecord[]>(K.purchases, []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async addPurchase(r: PurchaseRecord) { write(K.purchases, [r, ...read<PurchaseRecord[]>(K.purchases, [])]); }
  async deletePurchase(id: string) { write(K.purchases, read<PurchaseRecord[]>(K.purchases, []).filter((r) => r.id !== id)); }
  async loadObservations(): Promise<ObservationSet> { return read<ObservationSet>(K.obs, SEED_OBSERVATIONS); }
  async contribute(c: Contribution) {
    const o = await this.loadObservations();
    write(K.obs, { prices: [...o.prices, ...c.prices], exp: [...o.exp, ...c.exp], levelReqs: [...o.levelReqs, ...c.levelReqs] });
  }
  async flagObservation(type: ObservationType, id: string, reason: string) {
    const f: Flag = { id: newId(), observationType: type, observationId: id, reason, createdAt: new Date().toISOString(), resolved: false };
    write(K.flags, [f, ...read<Flag[]>(K.flags, [])]);
  }
  async listFlags() { return read<Flag[]>(K.flags, []); }
  async setObservationStatus(type: ObservationType, id: string, status: "observed" | "confirmed" | "rejected") {
    const o = await this.loadObservations();
    const upd = <T extends { id: string; status: string }>(rows: T[]) => rows.map((r) => (r.id === id ? { ...r, status } : r));
    write(K.obs, {
      prices: type === "price" ? upd(o.prices) : o.prices,
      exp: type === "exp" ? upd(o.exp) : o.exp,
      levelReqs: type === "level_req" ? upd(o.levelReqs) : o.levelReqs
    });
  }
  async resolveFlag(id: string) {
    write(K.flags, read<Flag[]>(K.flags, []).map((f) => (f.id === id ? { ...f, resolved: true } : f)));
  }
}
