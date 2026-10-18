import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { makeRepository } from "./data";
import type { Contribution, Repository } from "./data/repository";
import { Knowledge } from "./domain/knowledge";
import type { ObservationSet, PlayerState, PurchaseRecord } from "./domain/types";

interface AppState {
  repo: Repository;
  userId: string;
  isAdmin: boolean;
  player: PlayerState | null;
  purchases: PurchaseRecord[];
  observations: ObservationSet;
  kb: Knowledge;
  savePlayer(p: PlayerState): Promise<void>;
  recordPurchase(r: PurchaseRecord, next: PlayerState): Promise<void>;
  deletePurchase(id: string): Promise<void>;
  contribute(c: Contribution): Promise<void>;
  reloadObservations(): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

type Boot =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; repo: Repository; userId: string; isAdmin: boolean };

// Started once per page load, so React StrictMode's double effect can't create two sessions.
let bootPromise: Promise<{ repo: Repository; userId: string; isAdmin: boolean; player: PlayerState | null; purchases: PurchaseRecord[]; observations: ObservationSet }> | null = null;
function bootOnce() {
  bootPromise ??= (async () => {
    const repo = makeRepository();
    const { userId, isAdmin } = await repo.init();
    const [player, purchases, observations] = await Promise.all([repo.loadPlayer(), repo.listPurchases(), repo.loadObservations()]);
    return { repo, userId, isAdmin, player, purchases, observations };
  })();
  return bootPromise;
}

const EMPTY: ObservationSet = { prices: [], exp: [], levelReqs: [] };

export function AppProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot>({ phase: "loading" });
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [observations, setObservations] = useState<ObservationSet>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await bootOnce();
        if (cancelled) return;
        setPlayer(b.player); setPurchases(b.purchases); setObservations(b.observations);
        setBoot({ phase: "ready", repo: b.repo, userId: b.userId, isAdmin: b.isAdmin });
      } catch (e) {
        bootPromise = null;
        if (!cancelled) setBoot({ phase: "error", message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const repo = boot.phase === "ready" ? boot.repo : null;
  const kb = useMemo(() => new Knowledge(observations), [observations]);

  const reloadObservations = useCallback(async () => {
    if (repo) setObservations(await repo.loadObservations());
  }, [repo]);

  const value = useMemo<AppState | null>(() => {
    if (boot.phase !== "ready" || !repo) return null;
    return {
      repo, userId: boot.userId, isAdmin: boot.isAdmin, player, purchases, observations, kb,
      async savePlayer(p) { await repo.savePlayer(p); setPlayer(p); },
      async recordPurchase(r, next) {
        await repo.addPurchase(r);
        setPurchases((list) => [r, ...list]);
        await repo.savePlayer(next);
        setPlayer(next);
      },
      async deletePurchase(id) {
        await repo.deletePurchase(id);
        setPurchases((list) => list.filter((x) => x.id !== id));
      },
      async contribute(c) {
        await repo.contribute(c);
        await reloadObservations();
      },
      reloadObservations
    };
  }, [boot, repo, player, purchases, observations, kb, reloadObservations]);

  if (boot.phase === "loading") return <div className="splash">Loading tracker…</div>;
  if (boot.phase === "error") {
    return (
      <div className="splash error">
        <h1>Couldn't start</h1>
        <p>{boot.message}</p>
        <button className="btn" onClick={() => location.reload()}>Try again</button>
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
