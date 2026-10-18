// Local mode: everything is stored in this browser's localStorage.
// Used when no Supabase settings are configured (development and testing).
// It mimics accounts so the sign-in screens can be tried, but it is NOT secure:
// anyone with this browser can read the data. The first account created is the admin.

import { SEED_OBSERVATIONS } from "../domain/seed";
import type { ObservationSet, ObservationStatus, PlayerState, PurchaseRecord } from "../domain/types";
import {
  checkCredentials, Contribution, Flag, newId, normalizeUsername, ObservationType, PlayerSummary, Repository, SessionUser
} from "./repository";

interface LocalAccount { userId: string; username: string; pin: string; createdAt: string; isAdmin: boolean }

const K = {
  accounts: "hedb.accounts",
  session: "hedb.session",
  obs: "hedb.observations",
  flags: "hedb.flags",
  player: (u: string) => `hedb.player.${u}`,
  purchases: (u: string) => `hedb.purchases.${u}`
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
  readonly requiresAccount = true;
  private user: SessionUser | null = null;

  private accounts() { return read<LocalAccount[]>(K.accounts, []); }
  private toUser(a: LocalAccount): SessionUser { return { userId: a.userId, username: a.username, isAdmin: a.isAdmin }; }
  private me(): SessionUser {
    if (!this.user) throw new Error("Not signed in");
    return this.user;
  }

  async init() {
    const id = read<string | null>(K.session, null);
    const a = this.accounts().find((x) => x.userId === id);
    this.user = a ? this.toUser(a) : null;
    return this.user;
  }
  async signIn(username: string, pin: string) {
    const bad = checkCredentials(username, pin);
    if (bad) throw new Error(bad);
    const a = this.accounts().find((x) => x.username === normalizeUsername(username));
    if (!a || a.pin !== pin) throw new Error("Wrong username or PIN");
    write(K.session, a.userId);
    this.user = this.toUser(a);
    return this.user;
  }
  async signUp(username: string, pin: string) {
    const bad = checkCredentials(username, pin);
    if (bad) throw new Error(bad);
    const list = this.accounts();
    const u = normalizeUsername(username);
    if (list.some((x) => x.username === u)) throw new Error("That username is taken");
    const a: LocalAccount = { userId: newId(), username: u, pin, createdAt: new Date().toISOString(), isAdmin: list.length === 0 };
    write(K.accounts, [...list, a]);
    write(K.session, a.userId);
    this.user = this.toUser(a);
    return this.user;
  }
  async signOut() { write(K.session, null); this.user = null; }
  async changePin(oldPin: string, newPin: string) {
    const me = this.me();
    const list = this.accounts();
    const a = list.find((x) => x.userId === me.userId);
    if (!a || a.pin !== oldPin) throw new Error("Current PIN is wrong");
    if (!/^\d{4}$/.test(newPin)) throw new Error("PIN must be exactly 4 digits");
    write(K.accounts, list.map((x) => (x.userId === me.userId ? { ...x, pin: newPin } : x)));
  }

  async loadPlayer() { return read<PlayerState | null>(K.player(this.me().userId), null); }
  async savePlayer(p: PlayerState) { write(K.player(this.me().userId), p); }
  async listPurchases() {
    return read<PurchaseRecord[]>(K.purchases(this.me().userId), []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async addPurchase(r: PurchaseRecord) {
    const k = K.purchases(this.me().userId);
    write(k, [r, ...read<PurchaseRecord[]>(k, [])]);
  }
  async deletePurchase(id: string) {
    const k = K.purchases(this.me().userId);
    write(k, read<PurchaseRecord[]>(k, []).filter((r) => r.id !== id));
  }
  async loadObservations(): Promise<ObservationSet> {
    // Add any starting data this browser doesn't have yet (new seeds ship with app updates).
    const o = read<ObservationSet>(K.obs, { prices: [], exp: [], levelReqs: [] });
    const add = <T extends { id: string }>(have: T[], seed: T[]) => [...have, ...seed.filter((x) => !have.some((h) => h.id === x.id))];
    return { prices: add(o.prices, SEED_OBSERVATIONS.prices), exp: add(o.exp, SEED_OBSERVATIONS.exp), levelReqs: add(o.levelReqs, SEED_OBSERVATIONS.levelReqs) };
  }
  async contribute(c: Contribution) {
    const name = this.me().username;
    const o = await this.loadObservations();
    const stamp = <T extends { contributor: string; status: ObservationStatus }>(rows: T[]) =>
      rows.map((r) => ({ ...r, contributor: name, status: "observed" as const }));
    write(K.obs, {
      prices: [...o.prices, ...stamp(c.prices)], exp: [...o.exp, ...stamp(c.exp)], levelReqs: [...o.levelReqs, ...stamp(c.levelReqs)]
    });
  }
  async flagObservation(type: ObservationType, id: string, reason: string) {
    const f: Flag = { id: newId(), observationType: type, observationId: id, reason, createdAt: new Date().toISOString(), resolved: false };
    write(K.flags, [f, ...read<Flag[]>(K.flags, [])]);
  }
  async listFlags() { return read<Flag[]>(K.flags, []); }

  private requireAdmin() { if (!this.me().isAdmin) throw new Error("Admins only"); }
  async setObservationStatus(type: ObservationType, id: string, status: ObservationStatus) {
    this.requireAdmin();
    await this.applyStatus(type, new Map([[id, status]]));
  }
  async resolveConflict(type: ObservationType, keepIds: string[], rejectIds: string[]) {
    this.requireAdmin();
    const m = new Map<string, ObservationStatus>();
    keepIds.forEach((i) => m.set(i, "confirmed"));
    rejectIds.forEach((i) => m.set(i, "rejected"));
    await this.applyStatus(type, m);
  }
  private async applyStatus(type: ObservationType, m: Map<string, ObservationStatus>) {
    const o = await this.loadObservations();
    const upd = <T extends { id: string; status: ObservationStatus }>(rows: T[]) => rows.map((r) => (m.has(r.id) ? { ...r, status: m.get(r.id)! } : r));
    write(K.obs, {
      prices: type === "price" ? upd(o.prices) : o.prices,
      exp: type === "exp" ? upd(o.exp) : o.exp,
      levelReqs: type === "level_req" ? upd(o.levelReqs) : o.levelReqs
    });
  }
  async resolveFlag(id: string) {
    this.requireAdmin();
    write(K.flags, read<Flag[]>(K.flags, []).map((f) => (f.id === id ? { ...f, resolved: true } : f)));
  }
  async listPlayers(): Promise<PlayerSummary[]> {
    this.requireAdmin();
    return this.accounts().map((a) => ({ userId: a.userId, username: a.username, createdAt: a.createdAt }));
  }
  async resetPin(userId: string, pin: string) {
    this.requireAdmin();
    if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits");
    write(K.accounts, this.accounts().map((a) => (a.userId === userId ? { ...a, pin } : a)));
  }
}
