import Buy from "./screens/Buy";
import Dashboard from "./screens/Dashboard";
import History from "./screens/History";
import Research from "./screens/Research";
import Settings from "./screens/Settings";
import Setup from "./screens/Setup";
import { useApp } from "./state";
import { go, Route, useRoute } from "./ui/router";

const NAV: { route: Route; label: string; icon: string }[] = [
  { route: "home", label: "Home", icon: "M3 11l9-7 9 7M5 10v10h14V10" },
  { route: "buy", label: "Buy", icon: "M12 5v14M5 12h14" },
  { route: "history", label: "History", icon: "M12 7v5l3 2M3 12a9 9 0 1018 0 9 9 0 00-18 0" },
  { route: "research", label: "Research", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { route: "settings", label: "More", icon: "M5 12h.01M12 12h.01M19 12h.01" }
];

export default function App() {
  const { player } = useApp();
  const route = useRoute();

  if (!player?.setupComplete) {
    return <main className="app no-tabbar"><Setup onDone={() => go("home")} /></main>;
  }

  return (
    <>
      <main className="app">
        {route === "home" && <Dashboard />}
        {route === "buy" && <Buy />}
        {route === "history" && <History />}
        {route === "research" && <Research />}
        {route === "settings" && <Settings />}
        {route === "setup" && <Setup onDone={() => go("home")} />}
      </main>
      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.route} href={`#/${n.route}`} className={route === n.route ? "on" : ""} aria-current={route === n.route ? "page" : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={n.icon} /></svg>
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
