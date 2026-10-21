// Local mode: everything is stored in this browser's localStorage.
// Used when no Supabase settings are configured (development and testing).
// It mimics accounts so the sign-in screens can be tried, but it is NOT secure:
// anyone with this browser can read the data. The first account created is the admin.

import { SEED_OBSERVATIONS } from "../domain/seed";
import { getEntry } from "../domain/catalog";
import type { ObservationSet, ObservationStatus, PlayerState, PurchaseRecord } from "../domain/types";
import {
  checkCredentials, Contribution, Flag, newId, normalizeUsername, ObservationType, PlayerSummary, Repository, SessionUser
} from "./repository";

interface LocalAccount { userId: string; username: string; pin: string; createdAt: string; isAdmin: boolean; approved?: boolean }

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
  private toUser(a: LocalAccount): SessionUser {
    // Accounts created before approval existed count as approved.
    return { userId: a.userId, username: a.username, isAdmin: a.isAdmin, approved: a.isAdmin || a.approved !== false };
  }
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
    const first = list.length === 0;
    const a: LocalAccount = { userId: newId(), username: u, pin, createdAt: new Date().toISOString(), isAdmin: first, approved: first };
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
    const stored = read<ObservationSet>(K.obs, { prices: [], exp: [], levelReqs: [] });
    // Retired starting data: the spec's made-up Spam example (real Spam 5 costs 14,586).
    const keep = <T extends { id: string }>(rows: T[]) => rows.filter((r) => !r.id.startsWith("seed-spam-store-"));
    const o = { prices: keep(stored.prices), exp: keep(stored.exp), levelReqs: stored.levelReqs };
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
  async withdrawObservation(type: ObservationType, id: string) {
    const me = this.me();
    const o = await this.loadObservations();
    const rows: { id: string; contributor: string; status: ObservationStatus; notes: string }[] =
      type === "price" ? o.prices : type === "exp" ? o.exp : o.levelReqs;
    const r = rows.find((x) => x.id === id);
    if (!r || r.contributor !== me.username || r.status !== "observed") throw new Error("You can only remove your own reports that the admin hasn't confirmed yet");
    r.status = "rejected";
    r.notes = `${r.notes} [Withdrawn by reporter]`.trim();
    write(K.obs, o);
  }
  async editObservation(type: ObservationType, id: string, toLevel: number, value: number, movePurchase: boolean, upgradeId?: string) {
    this.requireAdmin();
    if (!(value >= 0)) throw new Error("Enter a value of 0 or more");
    if (!(toLevel >= 1)) throw new Error("Level must be 1 or more");
    const o = await this.loadObservations();
    const day = new Date().toISOString().slice(0, 10);
    if (type === "level_req") {
      const r = o.levelReqs.find((x) => x.id === id);
      if (!r) throw new Error("Report not found");
      if (value === 0) throw new Error("XP needed must be more than 0");
      r.notes = `${r.notes} [Admin fixed ${day}: was LVL ${r.level}, ${r.expRequired} XP]`.trim();
      r.level = toLevel; r.expRequired = value;
      write(K.obs, o);
      return;
    }
    const r = type === "price" ? o.prices.find((x) => x.id === id) : o.exp.find((x) => x.id === id);
    if (!r) throw new Error("Report not found");
    const delta = toLevel - r.toLevel;
    if (r.fromLevel + delta < 0) throw new Error("That level is too low for this report");
    const oldProg = r.upgradeId;
    const prog = upgradeId || oldProg;
    const progNote = prog !== oldProg ? `${oldProg} ` : "";
    if (prog !== oldProg) {
      const e = getEntry(prog);
      if (r.method === "download" && !e.download) throw new Error(`${e.name} cannot be downloaded`);
    }
    if ("cost" in r) { r.notes = `${r.notes} [Admin fixed ${day}: was ${progNote}Lv ${r.fromLevel}→${r.toLevel}, cost ${r.cost}]`.trim(); r.cost = value; }
    else { r.notes = `${r.notes} [Admin fixed ${day}: was ${progNote}Lv ${r.fromLevel}→${r.toLevel}, ${r.exp} XP]`.trim(); r.exp = value; }
    r.fromLevel += delta; r.toLevel += delta; r.upgradeId = prog;
    if (movePurchase && r.purchaseId && (delta !== 0 || prog !== oldProg)) {
      for (const x of [...o.prices, ...o.exp]) {
        if (x.id === id || x.purchaseId !== r.purchaseId || x.upgradeId !== oldProg || x.fromLevel + delta < 0) continue;
        x.notes = `${x.notes} [Admin moved ${day}: was ${progNote}Lv ${x.fromLevel}→${x.toLevel}]`.trim();
        x.fromLevel += delta; x.toLevel += delta; x.upgradeId = prog;
      }
    }
    write(K.obs, o);
  }
  async resolveFlag(id: string) {
    this.requireAdmin();
    write(K.flags, read<Flag[]>(K.flags, []).map((f) => (f.id === id ? { ...f, resolved: true } : f)));
  }
  async listPlayers(): Promise<PlayerSummary[]> {
    this.requireAdmin();
    return this.accounts().map((a) => ({ userId: a.userId, username: a.username, createdAt: a.createdAt, approved: this.toUser(a).approved, isAdmin: a.isAdmin }));
  }
  async setApproved(userId: string, approved: boolean) {
    this.requireAdmin();
    write(K.accounts, this.accounts().map((a) => (a.userId === userId ? { ...a, approved } : a)));
  }
  async renamePlayer(userId: string, username: string) {
    this.requireAdmin();
    const u = normalizeUsername(username);
    if (!/^[a-z0-9_]{3,20}$/.test(u)) throw new Error("Username must be 3–20 letters, numbers or _");
    const list = this.accounts();
    const old = list.find((a) => a.userId === userId);
    if (!old) throw new Error("Player not found");
    if (list.some((a) => a.username === u && a.userId !== userId)) throw new Error("That username is taken");
    write(K.accounts, list.map((a) => (a.userId === userId ? { ...a, username: u } : a)));
    const o = await this.loadObservations();
    const relabel = <T extends { contributor: string }>(rows: T[]) => rows.map((r) => (r.contributor === old.username ? { ...r, contributor: u } : r));
    write(K.obs, { prices: relabel(o.prices), exp: relabel(o.exp), levelReqs: relabel(o.levelReqs) });
    if (this.user?.userId === userId) this.user = { ...this.user, username: u };
  }
  async deletePlayer(userId: string) {
    this.requireAdmin();
    if (userId === this.me().userId) throw new Error("You can't delete your own account here");
    write(K.accounts, this.accounts().filter((a) => a.userId !== userId));
    try { localStorage.removeItem(K.player(userId)); localStorage.removeItem(K.purchases(userId)); } catch { /* ignore */ }
  }
  async resetPin(userId: string, pin: string) {
    this.requireAdmin();
    if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits");
    write(K.accounts, this.accounts().map((a) => (a.userId === userId ? { ...a, pin } : a)));
  }
}
