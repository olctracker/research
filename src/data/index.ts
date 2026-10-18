import { LocalRepository } from "./localRepository";
import type { Repository } from "./repository";
import { SupabaseRepository } from "./supabaseRepository";

/**
 * Picks the storage backend. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
 * (see README) to use the shared database; otherwise the app runs in local mode.
 * Only ever use the PUBLISHABLE key here, never the secret/service-role key.
 */
export function makeRepository(): Repository {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (url && key) {
    if (isSecretKey(key)) {
      throw new Error("A SECRET Supabase key was configured. Use the publishable key instead and rotate the secret key now.");
    }
    return new SupabaseRepository(url, key);
  }
  return new LocalRepository();
}

/** Detects new-style secret keys and legacy service_role JWTs. */
function isSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}
