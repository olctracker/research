// Tiny hash router (#/home, #/buy …). Hash URLs work on GitHub Pages without server config.
import { useEffect, useState } from "react";

export type Route = "home" | "buy" | "history" | "research" | "settings" | "setup";
const ROUTES: Route[] = ["home", "buy", "history", "research", "settings", "setup"];

function current(): Route {
  const r = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0] as Route;
  return ROUTES.includes(r) ? r : "home";
}

export function go(r: Route) {
  if (current() === r) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = `#/${r}`;
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(current);
  useEffect(() => {
    const f = () => setR(current());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return r;
}
