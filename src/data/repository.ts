// The app talks to storage only through this interface, so the UI never cares
// whether data lives in this browser (local mode) or in Supabase (shared mode).

import type {
  ExpObservation, LevelRequirementObservation, ObservationSet, ObservationStatus, PlayerState, PriceObservation, PurchaseRecord
} from "../domain/types";

export type ObservationType = "price" | "exp" | "level_req";

export interface SessionUser {
  userId: string;
  username: string;
  isAdmin: boolean;
  /** New accounts wait for the admin's approval before they can see or add data. */
  approved: boolean;
}

export interface PlayerSummary {
  userId: string;
  username: string;
  createdAt: string;
  approved: boolean;
  isAdmin: boolean;
}

export interface Flag {
  id: string;
  observationType: ObservationType;
  observationId: string;
  reason: string;
  createdAt: string;
  resolved: boolean;
}

export interface Contribution {
  prices: PriceObservation[];
  exp: ExpObservation[];
  levelReqs: LevelRequirementObservation[];
}

export interface Repository {
  readonly mode: "local" | "supabase";
  /** True when players must sign in with a username + PIN. */
  readonly requiresAccount: boolean;
  /** Restores a saved session. null = nobody signed in yet. */
  init(): Promise<SessionUser | null>;
  signIn(username: string, pin: string): Promise<SessionUser>;
  signUp(username: string, pin: string): Promise<SessionUser>;
  signOut(): Promise<void>;
  changePin(oldPin: string, newPin: string): Promise<void>;

  loadPlayer(): Promise<PlayerState | null>;
  savePlayer(p: PlayerState): Promise<void>;
  listPurchases(): Promise<PurchaseRecord[]>;
  addPurchase(r: PurchaseRecord): Promise<void>;
  deletePurchase(id: string): Promise<void>;
  loadObservations(): Promise<ObservationSet>;
  contribute(c: Contribution): Promise<void>;
  flagObservation(type: ObservationType, id: string, reason: string): Promise<void>;
  listFlags(): Promise<Flag[]>;
  /** Takes back your own report (wrong button). It stays on record, marked rejected. */
  withdrawObservation(type: ObservationType, id: string): Promise<void>;

  // ---- admin only (the database refuses these for everyone else) ----
  setObservationStatus(type: ObservationType, id: string, status: ObservationStatus): Promise<void>;
  resolveConflict(type: ObservationType, keepIds: string[], rejectIds: string[]): Promise<void>;
  resolveFlag(id: string): Promise<void>;
  /**
   * Moves a report to the right destination level and/or corrects its value. The old values are kept in its notes.
   * movePurchase: the purchase's other reports for the same software move by the same number of levels (and to the new program).
   * upgradeId: move the report to a different program (wrong program picked).
   */
  editObservation(type: ObservationType, id: string, toLevel: number, value: number, movePurchase: boolean, upgradeId?: string): Promise<void>;
  listPlayers(): Promise<PlayerSummary[]>;
  resetPin(userId: string, pin: string): Promise<void>;
  setApproved(userId: string, approved: boolean): Promise<void>;
  /** Changes a player's username (their sign-in name). Their PIN stays the same. */
  renamePlayer(userId: string, username: string): Promise<void>;
  /** Deletes a player's account and private data. Shared reports stay on record. */
  deletePlayer(userId: string): Promise<void>;
}

export const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;
export const PIN_RULE = /^\d{4}$/;
export const normalizeUsername = (u: string) => u.trim().toLowerCase();

export function checkCredentials(username: string, pin: string): string | null {
  if (!USERNAME_RULE.test(normalizeUsername(username))) return "Username must be 3–20 characters: letters, numbers or _";
  if (!PIN_RULE.test(pin)) return "PIN must be exactly 4 digits";
  return null;
}

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
