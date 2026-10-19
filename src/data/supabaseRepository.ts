// Shared mode: personal data and shared research live in Supabase.
// Uses only the PUBLISHABLE key; Row Level Security in supabase/migrations decides
// what each player may read or write.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { CATALOG } from "../domain/catalog";
import type {
  ExpObservation, LevelRequirementObservation, ObservationSet, ObservationStatus, PlayerState, PriceObservation, PurchaseRecord
} from "../domain/types";
import {
  checkCredentials, Contribution, Flag, normalizeUsername, ObservationType, PlayerSummary, Repository, SessionUser
} from "./repository";

/** Username + PIN are turned into the email/password Supabase Auth expects. Must match the SQL (admin_reset_pin). */
const EMAIL_DOMAIN = "users.hedb.app";
const emailFor = (username: string) => `${normalizeUsername(username)}@${EMAIL_DOMAIN}`;
const passwordFor = (pin: string) => `hedb#${pin}#pin`;

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const TABLE: Record<ObservationType, string> = {
  price: "price_observations", exp: "exp_observations", level_req: "level_requirement_observations"
};

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const who = (r: Row) => (r.contributor_alias as string) || (r.contributor_id ? `player-${String(r.contributor_id).slice(0, 6)}` : "unknown");

const toPrice = (r: Row): PriceObservation => ({
  id: r.id as string, upgradeId: r.upgrade_id as string, method: r.method as PriceObservation["method"],
  fromLevel: Number(r.from_level), toLevel: Number(r.to_level), cost: Number(r.cost),
  costType: r.cost_type as PriceObservation["costType"], priceBasis: r.price_basis as PriceObservation["priceBasis"],
  keygenLevel: num(r.keygen_level), contributor: who(r), createdAt: r.created_at as string,
  status: r.status as PriceObservation["status"], notes: (r.notes as string) ?? "", purchaseId: (r.purchase_id as string) ?? null,
  reboots: num(r.reboots)
});
const toExp = (r: Row): ExpObservation => ({
  id: r.id as string, upgradeId: r.upgrade_id as string, method: r.method as ExpObservation["method"],
  fromLevel: Number(r.from_level), toLevel: Number(r.to_level), exp: Number(r.exp),
  expBasis: r.exp_basis as ExpObservation["expBasis"], source: r.source as ExpObservation["source"],
  contributor: who(r), createdAt: r.created_at as string, status: r.status as ExpObservation["status"],
  notes: (r.notes as string) ?? "", purchaseId: (r.purchase_id as string) ?? null, reboots: num(r.reboots)
});
const toReq = (r: Row): LevelRequirementObservation => ({
  id: r.id as string, level: Number(r.level), expRequired: Number(r.exp_required), contributor: who(r),
  createdAt: r.created_at as string, status: r.status as LevelRequirementObservation["status"], notes: (r.notes as string) ?? "",
  reboots: num(r.reboots)
});

export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;
  readonly requiresAccount = true;
  private sb: SupabaseClient;
  private userId = "";
  private username = "";

  constructor(url: string, publishableKey: string) {
    this.sb = createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true } });
  }

  /** Loads username and admin flag for the signed-in account. */
  private async describe(userId: string): Promise<SessionUser> {
    const [prof, admin] = await Promise.all([
      this.sb.from("player_profiles").select("username, approved").eq("user_id", userId).maybeSingle(),
      this.sb.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle()
    ]);
    const p = check(prof) as Row | null;
    const username = (p?.username as string) ?? "";
    this.userId = userId;
    this.username = username;
    return { userId, username, isAdmin: !!admin.data, approved: !!p?.approved };
  }

  async init() {
    const { data } = await this.sb.auth.getSession();
    return data.session ? this.describe(data.session.user.id) : null;
  }

  async signIn(username: string, pin: string) {
    const bad = checkCredentials(username, pin);
    if (bad) throw new Error(bad);
    const u = normalizeUsername(username);
    const wait = Number(check(await this.sb.rpc("login_wait", { p_username: u })) ?? 0);
    if (wait > 0) throw new Error(`Too many wrong PINs. Try again in ${Math.ceil(wait / 60)} minute${wait > 60 ? "s" : ""}.`);
    const res = await this.sb.auth.signInWithPassword({ email: emailFor(u), password: passwordFor(pin) });
    if (res.error || !res.data.session) {
      if (res.error && /invalid login credentials/i.test(res.error.message)) {
        const left = Number(check(await this.sb.rpc("login_failed", { p_username: u })) ?? 0);
        throw new Error(left > 0 ? `Wrong username or PIN. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong PINs. Locked for 15 minutes.");
      }
      throw new Error(res.error?.message ?? "Couldn't sign in");
    }
    await this.sb.rpc("login_ok");
    return this.describe(res.data.session.user.id);
  }

  async signUp(username: string, pin: string) {
    const bad = checkCredentials(username, pin);
    if (bad) throw new Error(bad);
    const u = normalizeUsername(username);
    const res = await this.sb.auth.signUp({ email: emailFor(u), password: passwordFor(pin), options: { data: { username: u } } });
    if (res.error) {
      if (/already registered|already exists|duplicate/i.test(res.error.message)) throw new Error("That username is taken");
      throw new Error(res.error.message);
    }
    if (!res.data.session) {
      // Supabase hides "already registered" when email confirmation is on, and returns no session.
      throw new Error("Account not active. Admin: turn OFF Authentication → Email → “Confirm email” in Supabase (see README).");
    }
    return this.describe(res.data.session.user.id);
  }

  async signOut() {
    await this.sb.auth.signOut();
    this.userId = ""; this.username = "";
  }

  async changePin(oldPin: string, newPin: string) {
    if (!/^\d{4}$/.test(newPin)) throw new Error("PIN must be exactly 4 digits");
    const verify = await this.sb.auth.signInWithPassword({ email: emailFor(this.username), password: passwordFor(oldPin) });
    if (verify.error) throw new Error("Current PIN is wrong");
    const res = await this.sb.auth.updateUser({ password: passwordFor(newPin) });
    if (res.error) throw new Error(res.error.message);
  }

  async loadPlayer(): Promise<PlayerState | null> {
    const [prog, lv] = await Promise.all([
      this.sb.from("player_progress").select("*").eq("user_id", this.userId).maybeSingle(),
      this.sb.from("player_upgrade_state").select("upgrade_id, level").eq("user_id", this.userId)
    ]);
    const p = check(prog) as Row | null;
    if (!p) return null;
    const levels: Record<string, number> = Object.fromEntries(CATALOG.map((e) => [e.id, e.startLevel]));
    for (const r of (check(lv) as Row[]) ?? []) levels[r.upgrade_id as string] = Number(r.level);
    return {
      alias: this.username,
      character: { level: Number(p.level), exp: Number(p.exp), required: num(p.required) },
      levels, setupComplete: !!p.setup_complete, updatedAt: p.updated_at as string, reboots: Number(p.reboots ?? 0)
    };
  }

  async savePlayer(p: PlayerState) {
    check(await this.sb.from("player_progress").upsert({
      user_id: this.userId, level: p.character.level, exp: p.character.exp, required: p.character.required,
      setup_complete: p.setupComplete, updated_at: p.updatedAt, reboots: p.reboots ?? 0
    }));
    check(await this.sb.from("player_upgrade_state").upsert(
      Object.entries(p.levels).map(([upgrade_id, level]) => ({ user_id: this.userId, upgrade_id, level, updated_at: p.updatedAt })),
      { onConflict: "user_id,upgrade_id" }
    ));
  }

  async listPurchases(): Promise<PurchaseRecord[]> {
    const rows = check(await this.sb.from("purchase_history").select("*").order("created_at", { ascending: false }).limit(1000)) as Row[];
    return rows.map((r) => ({
      id: r.id as string, createdAt: r.created_at as string, upgradeId: r.upgrade_id as string,
      method: r.method as PurchaseRecord["method"], fromLevel: Number(r.from_level), toLevel: Number(r.to_level),
      keygenLevel: num(r.keygen_level), cost: num(r.cost), costSource: r.cost_source as PurchaseRecord["costSource"],
      expEarned: num(r.exp_earned), expExpected: num(r.exp_expected),
      before: { level: Number(r.before_level), exp: Number(r.before_exp), required: num(r.before_required) },
      after: { level: Number(r.after_level), exp: Number(r.after_exp), required: num(r.after_required) },
      confidence: r.confidence as PurchaseRecord["confidence"], dataSources: (r.data_sources as string[]) ?? [],
      notes: (r.notes as string) ?? ""
    }));
  }

  async addPurchase(r: PurchaseRecord) {
    check(await this.sb.from("purchase_history").insert({
      id: r.id, user_id: this.userId, upgrade_id: r.upgradeId, method: r.method, from_level: r.fromLevel, to_level: r.toLevel,
      keygen_level: r.keygenLevel, cost: r.cost, cost_source: r.costSource, exp_earned: r.expEarned, exp_expected: r.expExpected,
      before_level: r.before.level, before_exp: r.before.exp, before_required: r.before.required,
      after_level: r.after.level, after_exp: r.after.exp, after_required: r.after.required,
      confidence: r.confidence, data_sources: r.dataSources, notes: r.notes, created_at: r.createdAt
    }));
  }

  async deletePurchase(id: string) {
    check(await this.sb.from("purchase_history").delete().eq("id", id));
  }

  /** Reads a whole table in pages of 1000 (Supabase's default row limit). */
  private async all(table: string): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const rows = check(await this.sb.from(table).select("*").order("created_at").range(from, from + 999)) as Row[];
      out.push(...rows);
      if (rows.length < 1000) return out;
    }
  }

  async loadObservations(): Promise<ObservationSet> {
    const [p, e, r] = await Promise.all([this.all(TABLE.price), this.all(TABLE.exp), this.all(TABLE.level_req)]);
    return { prices: p.map(toPrice), exp: e.map(toExp), levelReqs: r.map(toReq) };
  }

  async contribute(c: Contribution) {
    // contributor_alias is filled in by the database from your profile.
    const meta = { contributor_id: this.userId, status: "observed" };
    if (c.prices.length) check(await this.sb.from(TABLE.price).insert(c.prices.map((p) => ({
      ...meta, id: p.id, upgrade_id: p.upgradeId, method: p.method, from_level: p.fromLevel, to_level: p.toLevel,
      cost: p.cost, cost_type: p.costType, price_basis: p.priceBasis, keygen_level: p.keygenLevel,
      notes: p.notes, purchase_id: p.purchaseId, reboots: p.reboots ?? null
    }))));
    if (c.exp.length) check(await this.sb.from(TABLE.exp).insert(c.exp.map((x) => ({
      ...meta, id: x.id, upgrade_id: x.upgradeId, method: x.method, from_level: x.fromLevel, to_level: x.toLevel,
      exp: x.exp, exp_basis: x.expBasis, source: x.source, notes: x.notes, purchase_id: x.purchaseId, reboots: x.reboots ?? null
    }))));
    if (c.levelReqs.length) check(await this.sb.from(TABLE.level_req).insert(c.levelReqs.map((x) => ({
      ...meta, id: x.id, level: x.level, exp_required: x.expRequired, notes: x.notes, reboots: x.reboots ?? null
    }))));
  }

  async flagObservation(type: ObservationType, id: string, reason: string) {
    check(await this.sb.from("observation_flags").insert({ observation_type: type, observation_id: id, reason, flagged_by: this.userId }));
  }

  async listFlags(): Promise<Flag[]> {
    const rows = check(await this.sb.from("observation_flags").select("*").order("created_at", { ascending: false }).limit(500)) as Row[];
    return rows.map((r) => ({
      id: r.id as string, observationType: r.observation_type as ObservationType, observationId: r.observation_id as string,
      reason: r.reason as string, createdAt: r.created_at as string, resolved: !!r.resolved
    }));
  }

  async setObservationStatus(type: ObservationType, id: string, status: ObservationStatus) {
    const res = await this.sb.from(TABLE[type]).update({ status }).eq("id", id).select("id");
    if (!check(res)?.length) throw new Error("Not allowed (admins only).");
  }

  async resolveConflict(type: ObservationType, keepIds: string[], rejectIds: string[]) {
    check(await this.sb.rpc("admin_resolve", { p_table: TABLE[type], p_keep: keepIds, p_reject: rejectIds }));
  }

  async withdrawObservation(type: ObservationType, id: string) {
    check(await this.sb.rpc("withdraw_observation", { p_type: type, p_id: id }));
  }

  async editObservation(type: ObservationType, id: string, toLevel: number, value: number, movePurchase: boolean) {
    check(await this.sb.rpc("admin_edit_observation", { p_type: type, p_id: id, p_to_level: toLevel, p_value: value, p_move_purchase: movePurchase }));
  }

  async resolveFlag(id: string) {
    const res = await this.sb.from("observation_flags").update({ resolved: true }).eq("id", id).select("id");
    if (!check(res)?.length) throw new Error("Not allowed (admins only).");
  }

  async listPlayers(): Promise<PlayerSummary[]> {
    const [rows, admins] = await Promise.all([
      this.sb.from("player_profiles").select("user_id, username, created_at, approved").order("username"),
      this.sb.from("app_admins").select("user_id")
    ]);
    const adminIds = new Set(((check(admins) as Row[]) ?? []).map((a) => a.user_id as string));
    return (check(rows) as Row[]).map((r) => ({
      userId: r.user_id as string, username: r.username as string, createdAt: r.created_at as string,
      approved: !!r.approved, isAdmin: adminIds.has(r.user_id as string)
    }));
  }

  async resetPin(userId: string, pin: string) {
    check(await this.sb.rpc("admin_reset_pin", { p_user_id: userId, p_pin: pin }));
  }

  async setApproved(userId: string, approved: boolean) {
    check(await this.sb.rpc("admin_set_approved", { p_user_id: userId, p_approved: approved }));
  }

  async renamePlayer(userId: string, username: string) {
    check(await this.sb.rpc("admin_rename", { p_user_id: userId, p_username: normalizeUsername(username) }));
    if (userId === this.userId) this.username = normalizeUsername(username);
  }

  async deletePlayer(userId: string) {
    check(await this.sb.rpc("admin_delete_user", { p_user_id: userId }));
  }
}
