"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import { listSearchMemory, renameSearchMemory, SearchMemoryEntry } from "@/lib/rag-memory";

const SHOW_DOCFLOW = process.env.NEXT_PUBLIC_FEATURE_DOCFLOW === "true";
const SHOW_EMAIL = process.env.NEXT_PUBLIC_FEATURE_EMAIL_V2 === "true";

function Icon({
  kind
}: {
  kind:
    | "search"
    | "document"
    | "template"
    | "flow"
    | "mail"
    | "contacts"
    | "sign"
    | "settings"
    | "collapse";
}) {
  if (kind === "search") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 16L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "document") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 3h7l5 5v13H7z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === "template") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "flow") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="18" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="6" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8.5 7.5L15.5 10.5M8.5 16.5L15.5 13.5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === "mail") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === "contacts") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 18c.8-2.1 2.5-3.5 4.5-3.5S12.7 15.9 13.5 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M16 8h4M16 12h4M16 16h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "sign") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 16c4.5-2.5 7.5-6 9.5-10 1 3 2.5 5.5 6.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "collapse") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 4v16M16 8l-4 4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20M6.5 6.5l1.8 1.8M15.7 15.7l1.8 1.8M17.5 6.5l-1.8 1.8M8.3 15.7l-1.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchEntries, setSearchEntries] = useState<SearchMemoryEntry[]>([]);
  const productionHref = useMemo(() => {
    if (SHOW_DOCFLOW) return "/app/docflow";
    return "/app/documents";
  }, []);
  const communicationHref = useMemo(() => {
    if (SHOW_EMAIL) return "/app/email";
    return "/app/contacts";
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("app_shell_collapsed");
    if (stored === "1") setCollapsed(true);
    setSearchEntries(listSearchMemory().slice(0, 12));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("app_shell_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    setSearchEntries(listSearchMemory().slice(0, 12));
  }, [pathname]);

  const handleLogout = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className={collapsed ? "app-shell is-collapsed" : "app-shell"}>
      <aside
        className={mobileOpen ? "app-shell-sidebar is-open" : "app-shell-sidebar"}
      >
        <div className="app-shell-sidebar-top">
          <button
            type="button"
            className="app-shell-brand app-shell-brand-trigger"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Déplier le bandeau" : "Replier le bandeau"}
          >
            <span className="app-shell-brand-mark">LA</span>
            <span className="app-shell-brand-text">Espace cabinet</span>
          </button>
          <button
            type="button"
            className={collapsed ? "app-shell-collapse-btn is-collapsed" : "app-shell-collapse-btn"}
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Déplier le bandeau" : "Replier le bandeau"}
          >
            <Icon kind="collapse" />
          </button>
        </div>

        <nav className="app-shell-nav" aria-label="Navigation principale">
          <Link
            href="/app/rag"
            className={pathname.startsWith("/app/rag") ? "app-shell-link active" : "app-shell-link"}
          >
            <span className="app-shell-link-icon"><Icon kind="search" /></span>
            <span className="app-shell-link-label">Recherche</span>
          </Link>
          <Link
            href="/app/knowledge"
            className={pathname.startsWith("/app/knowledge") ? "app-shell-link active" : "app-shell-link"}
          >
            <span className="app-shell-link-icon"><Icon kind="template" /></span>
            <span className="app-shell-link-label">Knowledge Base</span>
          </Link>

          {!collapsed && (
            <section className="app-shell-memory">
              <h2>Recherches mémorisées</h2>
              {searchEntries.length === 0 && <p className="muted">Aucune recherche enregistrée.</p>}
              {searchEntries.map((entry) => (
                <div key={entry.id} className="app-shell-memory-item">
                  <Link href={`/app/rag?entry=${entry.id}`}>{entry.title}</Link>
                  <button
                    type="button"
                    className="app-shell-mini"
                    onClick={() => {
                      const next = window.prompt("Modifier le titre", entry.title);
                      if (!next) return;
                      renameSearchMemory(entry.id, next);
                      setSearchEntries(listSearchMemory().slice(0, 12));
                    }}
                  >
                    ✎
                  </button>
                </div>
              ))}
            </section>
          )}
        </nav>

        <div className="app-shell-dock">
          <Link href={productionHref} className="app-shell-dock-btn production" aria-label="Production">
            <Icon kind="document" />
          </Link>
          <Link href={communicationHref} className="app-shell-dock-btn communication" aria-label="Communication">
            <Icon kind="mail" />
          </Link>
          <Link href="/app/settings" className="app-shell-dock-btn settings" aria-label="Réglages">
            <Icon kind="settings" />
          </Link>
        </div>
      </aside>

      <section className="app-shell-content">
        <header className="app-shell-topbar">
          <div className="app-shell-topbar-left">
            <button
              type="button"
              className="ghost app-shell-mobile-toggle"
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              Menu
            </button>
            <p>LexiAtlas</p>
          </div>
          <div className="app-shell-topbar-right">
            <span className="app-shell-topbar-tag">Recherche augmentée et production documentaire</span>
            <button type="button" className="ghost app-shell-logout-btn" onClick={handleLogout}>
              Se déconnecter
            </button>
          </div>
        </header>
        <div className="app-shell-page">{children}</div>
      </section>
    </div>
  );
}
