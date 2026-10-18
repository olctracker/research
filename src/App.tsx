import Buy from "./screens/Buy";
import Dashboard from "./screens/Dashboard";
import History from "./screens/History";
import Research from "./screens/Research";
import Settings from "./screens/Settings";
import Setup from "./screens/Setup";
import { useApp } from "./state";
import { Brand } from "./ui/Brand";
import { go, Route, useRoute } from "./ui/router";

const NAV: { route: Route; label: string; icon: string }[] = [
  { route: "home", label: "Home", icon: "M3 10.5L12 3l9 7.5M5.5 9v11h13V9M10 20v-5h4v5" },
  { route: "buy", label: "Record", icon: "M12 8v8M8 12h8M12 21a9 9 0 100-18 9 9 0 000 18z" },
  { route: "history", label: "History", icon: "M12 7v5l3 2M21 12a9 9 0 11-9-9 9 9 0 019 9z" },
  { route: "research", label: "Research", icon: "M4 20V11M10 20V5M16 20v-6M21 20H3" },
  { route: "settings", label: "More", icon: "M4 7h16M4 12h16M4 17h16" }
];

function TopBar() {
  const { user, isAdmin, conflicts } = useApp();
  return (
    <header className="topbar">
      <button className="topbar-brand" onClick={() => go("home")} aria-label="Home"><Brand /></button>
      <button className="user-chip" onClick={() => go("settings")}>
        {isAdmin && conflicts.length > 0 && <span className="dot-alert" aria-label={`${conflicts.length} conflicts`} />}
        <span className="avatar" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span>
        <span className="user-name">{user.username}</span>
        {isAdmin && <span className="role">Admin</span>}
      </button>
    </header>
  );
}

export default function App() {
  const { player } = useApp();
  const route = useRoute();

  if (!player?.setupComplete) {
    return (
      <>
        <TopBar />
        <main className="app no-tabbar"><Setup onDone={() => go("home")} /></main>
      </>
    );
  }

  return (
    <>
      <TopBar />
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
