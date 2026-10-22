import { ReactNode, useEffect, useMemo, useState } from "react";
import { needsEntry, nextPriceRows } from "./domain/nextPrices";
import Dashboard from "./screens/Dashboard";
import Calculator from "./screens/Calculator";
import DataTable from "./screens/DataTable";
import DeviceInput from "./screens/DeviceInput";
import Formulas from "./screens/Formulas";
import Device from "./screens/Device";
import History from "./screens/History";
import Prices from "./screens/Prices";
import Purchase from "./screens/Purchase";
import Research from "./screens/Research";
import Settings from "./screens/Settings";
import { useApp } from "./state";
import { Brand } from "./ui/Brand";
import { go, Route, useRoute } from "./ui/router";

type NavItem = { route: Route; label: string; icon: string; badge?: number; tone?: "bad" | "warn" };
type NavSection = { title: string; items: NavItem[] };

const ICONS = {
  home: "M3 10.5L12 3l9 7.5M5.5 9v11h13V9M10 20v-5h4v5",
  device: "M4 5h16v11H4zM9 20h6M12 16v4",
  input: "M9 4h6v3H9zM7 5.5H5v15h14v-15h-2M9 12h6M9 16h4",
  store: "M4 7h16l-1.5 12h-13zM8 7V5a4 4 0 018 0v2",
  keygen: "M15 7a4 4 0 11-3.9 4.9L4 19v-3l1-1h2v-2h2l2.1-2.1A4 4 0 0115 7zM16 9h.01",
  buy: "M12 8v8M8 12h8M12 21a9 9 0 100-18 9 9 0 000 18z",
  calc: "M6 3h12v18H6zM9 7h6M9 11h1M12 11h1M15 11h0M9 15h1M12 15h1M15 15v3",
  history: "M12 7v5l3 2M21 12a9 9 0 11-9-9 9 9 0 019 9z",
  research: "M4 20V11M10 20V5M16 20v-6M21 20H3",
  data: "M4 5h16v14H4zM4 10h16M4 15h16M10 5v14",
  formulas: "M9 11l2 2 4-4M5 4h14v16H5z",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003 15H3a2 2 0 010-4h.1a1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 009 3.1V3a2 2 0 014 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.7 1.7 0 0021 9h.1a2 2 0 010 4H21a1.7 1.7 0 00-1.6 2z"
};

const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon"><path d={d} /></svg>;

function useNav(): NavSection[] {
  const { player, kb, conflicts, isAdmin, pendingCount } = useApp();
  return useMemo(() => {
    const levels = player?.levels ?? {};
    const store = needsEntry(nextPriceRows(levels, kb, "store"));
    const keygen = needsEntry(nextPriceRows(levels, kb, "download"));
    return [
      { title: "Main", items: [{ route: "home", label: "Home", icon: ICONS.home }] },
      { title: "My info", items: [{ route: "device", label: "My Device", icon: ICONS.device }, { route: "input", label: "Device Input", icon: ICONS.input }] },
      {
        title: "Prices", items: [
          { route: "store", label: "Store Prices", icon: ICONS.store, badge: store, tone: "warn" },
          { route: "keygen", label: "Keygen Prices", icon: ICONS.keygen, badge: keygen, tone: "warn" }
        ]
      },
      {
        title: "Tracking", items: [
          { route: "buy", label: "Purchase", icon: ICONS.buy },
          { route: "calc", label: "Calculator", icon: ICONS.calc },
          { route: "history", label: "History", icon: ICONS.history }
        ]
      },
      {
        title: "Research", items: [
          { route: "data", label: "Data Table", icon: ICONS.data },
          { route: "formulas", label: "Formula Checklist", icon: ICONS.formulas },
          { route: "research", label: "Coverage & Conflicts", icon: ICONS.research, badge: isAdmin ? conflicts.length : 0, tone: "bad" }
        ]
      },
      { title: "You", items: [{ route: "settings", label: "Settings", icon: ICONS.settings, badge: isAdmin ? pendingCount : 0, tone: "bad" }] }
    ] as NavSection[];
  }, [player, kb, conflicts, isAdmin, pendingCount]);
}

function NavList({ sections, route, onPick }: { sections: NavSection[]; route: Route; onPick: () => void }) {
  return (
    <nav className="nav" aria-label="Main">
      {sections.map((s) => (
        <div key={s.title} className="nav-section">
          <div className="nav-title">{s.title}</div>
          {s.items.map((i) => (
            <a key={i.route} href={`#/${i.route}`} onClick={onPick} className={`nav-item${route === i.route ? " on" : ""}`}
              aria-current={route === i.route ? "page" : undefined}>
              <Icon d={i.icon} />
              <span className="grow">{i.label}</span>
              {!!i.badge && <span className={`nav-badge ${i.tone ?? "warn"}`} aria-label={`${i.badge} need attention`}>{i.badge}</span>}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

function Shell({ children, route }: { children: ReactNode; route: Route }) {
  const { user, isAdmin } = useApp();
  const sections = useNav();
  const [open, setOpen] = useState(false);
  const total = sections.flatMap((s) => s.items).reduce((n, i) => n + (i.badge ?? 0), 0);
  const title = sections.flatMap((s) => s.items).find((i) => i.route === route)?.label ?? "";

  useEffect(() => {
    document.body.classList.toggle("drawer-open", open);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <div className="shell">
      <header className="topbar">
        <button className="menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          {total > 0 && <span className="menu-dot" aria-hidden="true" />}
        </button>
        <div className="topbar-title">{title}</div>
        <button className="user-chip" onClick={() => go("settings")}>
          <span className="avatar" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span>
          <span className="user-name">{user.username}</span>
          {isAdmin && <span className="role">Admin</span>}
        </button>
      </header>

      <aside className={`drawer${open ? " open" : ""}`} aria-hidden={!open ? undefined : false}>
        <div className="drawer-head"><Brand /></div>
        <NavList sections={sections} route={route} onPick={() => setOpen(false)} />
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <main className="app">{children}</main>
    </div>
  );
}

export default function App() {
  const { player } = useApp();
  const route = useRoute();

  // First visit: fill in My Device before anything else.
  if (!player?.setupComplete) {
    return <Shell route="device"><Device first onDone={() => go("home")} /></Shell>;
  }

  return (
    <Shell route={route}>
      {route === "home" && <Dashboard />}
      {route === "device" && <Device onDone={() => go("home")} />}
      {route === "input" && <DeviceInput />}
      {route === "store" && <Prices method="store" />}
      {route === "keygen" && <Prices method="download" />}
      {route === "buy" && <Purchase />}
      {route === "calc" && <Calculator />}
      {route === "history" && <History />}
      {route === "data" && <DataTable />}
      {route === "formulas" && <Formulas />}
      {route === "research" && <Research />}
      {route === "settings" && <Settings />}
    </Shell>
  );
}
