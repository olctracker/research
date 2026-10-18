// The app talks to storage only through this interface, so the UI never cares
// whether data lives in this browser (local mode) or in Supabase (shared mode).

import type {
  ExpObservation, LevelRequirementObservation, ObservationSet, PlayerState, PriceObservation, PurchaseRecord
} from "../domain/types";

export type ObservationType = "price" | "exp" | "level_req";

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
  /** Signs in (Supabase: anonymous session) and returns a stable id for this player. */
  init(): Promise<{ userId: string; isAdmin: boolean }>;
  loadPlayer(): Promise<PlayerState | null>;
  savePlayer(p: PlayerState): Promise<void>;
  listPurchases(): Promise<PurchaseRecord[]>;
  addPurchase(r: PurchaseRecord): Promise<void>;
  deletePurchase(id: string): Promise<void>;
  loadObservations(): Promise<ObservationSet>;
  contribute(c: Contribution): Promise<void>;
  flagObservation(type: ObservationType, id: string, reason: string): Promise<void>;
  listFlags(): Promise<Flag[]>;
  /** Admin only. */
  setObservationStatus(type: ObservationType, id: string, status: "observed" | "confirmed" | "rejected"): Promise<void>;
  resolveFlag(id: string): Promise<void>;
}

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
