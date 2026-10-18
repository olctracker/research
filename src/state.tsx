import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { makeRepository } from "./data";
import type { Contribution, Repository, SessionUser } from "./data/repository";
import { newId } from "./data/repository";
import { newLevelReqs } from "./domain/record";
import { findConflicts, ConflictGroup } from "./domain/conflicts";
import { Knowledge } from "./domain/knowledge";
import type { ObservationSet, PlayerState, PurchaseRecord } from "./domain/types";
import Login from "./screens/Login";
import { Brand } from "./ui/Brand";

interface AppState {
  repo: Repository;
  user: SessionUser;
  isAdmin: boolean;
  player: PlayerState | null;
  purchases: PurchaseRecord[];
  observations: ObservationSet;
  kb: Knowledge;
  conflicts: ConflictGroup[];
  savePlayer(p: PlayerState): Promise<void>;
  recordPurchase(r: PurchaseRecord, next: PlayerState): Promise<void>;
  deletePurchase(id: string): Promise<void>;
  contribute(c: Contribution): Promise<void>;
  reloadObservations(): Promise<void>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

interface Data { player: PlayerState | null; purchases: PurchaseRecord[]; observations: ObservationSet }

type Boot =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "signed_out"; repo: Repository }
  | { phase: "ready"; repo: Repository; user: SessionUser };

// Started once per page load, so React StrictMode's double effect can't run it twice.
let bootPromise: Promise<{ repo: Repository; user: SessionUser | null }> | null = null;
function bootOnce() {
  bootPromise ??= (async () => {
    const repo = makeRepository();
    return { repo, user: await repo.init() };
  })();
  return bootPromise;
}

async function loadData(repo: Repository): Promise<Data> {
  const [player, purchases, observations] = await Promise.all([repo.loadPlayer(), repo.listPurchases(), repo.loadObservations()]);
  return { player, purchases, observations };
}

const EMPTY: ObservationSet = { prices: [], exp: [], levelReqs: [] };

export function AppProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot>({ phase: "loading" });
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [observations, setObservations] = useState<ObservationSet>(EMPTY);

  const enter = useCallback(async (repo: Repository, user: SessionUser) => {
    const d = await loadData(repo);
    // Catch up: share this player's current level "XP needed" if they never have (older data, edits).
    if (d.player?.setupComplete) {
      const reqs = newLevelReqs([d.player.character], d.observations, user.username, new Date().toISOString(), newId);
      if (reqs.length) {
        try { await repo.contribute({ prices: [], exp: [], levelReqs: reqs }); d.observations = await repo.loadObservations(); }
        catch { /* not critical */ }
      }
    }
    setPlayer(d.player); setPurchases(d.purchases); setObservations(d.observations);
    setBoot({ phase: "ready", repo, user });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await bootOnce();
        if (cancelled) return;
        if (b.user) await enter(b.repo, b.user);
        else setBoot({ phase: "signed_out", repo: b.repo });
      } catch (e) {
        bootPromise = null;
        if (!cancelled) setBoot({ phase: "error", message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => { cancelled = true; };
  }, [enter]);

  const repo = boot.phase === "ready" || boot.phase === "signed_out" ? boot.repo : null;
  const kb = useMemo(() => new Knowledge(observations), [observations]);
  const conflicts = useMemo(() => findConflicts(observations), [observations]);

  const reloadObservations = useCallback(async () => {
    if (repo) setObservations(await repo.loadObservations());
  }, [repo]);

  const value = useMemo<AppState | null>(() => {
    if (boot.phase !== "ready") return null;
    const r = boot.repo;
    return {
      repo: r, user: boot.user, isAdmin: boot.user.isAdmin, player, purchases, observations, kb, conflicts,
      async savePlayer(p) { await r.savePlayer(p); setPlayer(p); },
      async recordPurchase(rec, next) {
        await r.addPurchase(rec);
        setPurchases((list) => [rec, ...list]);
        await r.savePlayer(next);
        setPlayer(next);
      },
      async deletePurchase(id) {
        await r.deletePurchase(id);
        setPurchases((list) => list.filter((x) => x.id !== id));
      },
      async contribute(c) {
        await r.contribute(c);
        await reloadObservations();
      },
      reloadObservations,
      async signOut() {
        await r.signOut();
        setPlayer(null); setPurchases([]); setObservations(EMPTY);
        location.hash = "#/home";
        setBoot({ phase: "signed_out", repo: r });
      }
    };
  }, [boot, player, purchases, observations, kb, conflicts, reloadObservations]);

  if (boot.phase === "loading") {
    return <div className="splash"><Brand large /><div className="spinner" aria-label="Loading" /></div>;
  }
  if (boot.phase === "error") {
    return (
      <div className="splash error">
        <Brand large />
        <h1>Couldn't start</h1>
        <p>{boot.message}</p>
        <button className="btn primary" onClick={() => location.reload()}>Try again</button>
      </div>
    );
  }
  if (boot.phase === "signed_out") {
    return <Login repo={boot.repo} onSignedIn={(user) => enter(boot.repo, user)} />;
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
