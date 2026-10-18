// Shared types for the Hack EX2 upgrade tracker.
// Everything in src/domain is pure logic: no React, no database, no browser APIs.

export type Category = "core" | "defensive" | "offensive" | "virus" | "utility" | "one_time";
export type UpgradeKind = "level" | "one_time";
export type Method = "store" | "download";

export interface CatalogEntry {
  id: string;
  name: string;
  category: Category;
  kind: UpgradeKind;
  /** Level on a brand-new game (0 = not owned yet). One-time items use 0 = not purchased. */
  startLevel: number;
  /** null = no known cap. Never invent one. */
  maxLevel: number | null;
  store: boolean;
  download: boolean;
  /** Store purchases get the 15% defensive discount. */
  defensiveDiscount: boolean;
}

/** Moderator-controlled status on a raw observation. Contributors can only create "observed". */
export type ObservationStatus = "observed" | "confirmed" | "rejected";

/**
 * How a price was measured.
 * per_level  – one store level (fromLevel = toLevel - 1)
 * combined   – one download transaction covering fromLevel -> toLevel
 * component  – a per-destination-level download cost component (fromLevel = toLevel - 1)
 * one_time   – a one-time item (fromLevel 0 -> toLevel 1)
 */
export type CostType = "per_level" | "combined" | "component" | "one_time";

/** "final" = what the game charged (after any discount). "before_discount" = list price. */
export type PriceBasis = "final" | "before_discount";

export interface PriceObservation {
  id: string;
  upgradeId: string;
  method: Method;
  fromLevel: number;
  toLevel: number;
  cost: number;
  costType: CostType;
  priceBasis: PriceBasis;
  keygenLevel: number | null;
  contributor: string;
  createdAt: string;
  status: ObservationStatus;
  notes: string;
  purchaseId: string | null;
}

/**
 * per_level        – XP for one store level (or one-time item)
 * per_transaction  – XP for a whole transaction (downloads, or a multi-level store buy we could not split)
 */
export type ExpBasis = "per_level" | "per_transaction";

/**
 * entered  – the player read it from the game
 * inferred – calculated from the before/after character state
 * derived  – calculated as (inferred transaction total − other known level rewards)
 */
export type ExpSource = "entered" | "inferred" | "derived";

export interface ExpObservation {
  id: string;
  upgradeId: string;
  method: Method;
  fromLevel: number;
  toLevel: number;
  exp: number;
  expBasis: ExpBasis;
  source: ExpSource;
  contributor: string;
  createdAt: string;
  status: ObservationStatus;
  notes: string;
  purchaseId: string | null;
}

/** "Character level N needs X XP to reach level N+1." */
export interface LevelRequirementObservation {
  id: string;
  level: number;
  expRequired: number;
  contributor: string;
  createdAt: string;
  status: ObservationStatus;
  notes: string;
}

export interface CharacterState {
  level: number;
  /** XP inside the current level. */
  exp: number;
  /** XP needed to go from this level to the next. null if the player did not enter it. */
  required: number | null;
}

export interface PlayerState {
  alias: string;
  character: CharacterState;
  /** upgradeId -> level. One-time items use 0/1. */
  levels: Record<string, number>;
  setupComplete: boolean;
  updatedAt: string;
}

export type Confidence = "exact" | "uses_unverified" | "incomplete" | "estimate";

export interface PurchaseRecord {
  id: string;
  createdAt: string;
  upgradeId: string;
  method: Method;
  fromLevel: number;
  toLevel: number;
  keygenLevel: number | null;
  cost: number | null;
  costSource: "observed" | "entered" | "estimate" | "missing";
  expEarned: number | null;
  expExpected: number | null;
  before: CharacterState;
  after: CharacterState;
  confidence: Confidence;
  dataSources: string[];
  notes: string;
}

export interface ObservationSet {
  prices: PriceObservation[];
  exp: ExpObservation[];
  levelReqs: LevelRequirementObservation[];
}
