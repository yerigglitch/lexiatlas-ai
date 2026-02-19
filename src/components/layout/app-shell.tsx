"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

type NavItem = {
  href: string;
  label: string;
  icon: "search" | "document" | "template" | "flow" | "mail" | "contacts" | "sign" | "settings";
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const SHOW_DOCFLOW = process.env.NEXT_PUBLIC_FEATURE_DOCFLOW === "true";
const SHOW_EMAIL = process.env.NEXT_PUBLIC_FEATURE_EMAIL_V2 === "true";

function NavIcon({
  kind
}: {
  kind: "search" | "document" | "template" | "flow" | "mail" | "contacts" | "sign" | "settings";
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

  const groups: NavGroup[] = [
    {
      title: "Recherche",
      items: [{ href: "/app/rag", label: "RAG juridique", icon: "search" }]
    },
    {
      title: "Production",
      items: [
        { href: "/app/documents", label: "Documents", icon: "document" },
        { href: "/app/templates", label: "Modèles Word", icon: "template" },
        ...(SHOW_DOCFLOW ? [{ href: "/app/docflow", label: "DocFlow IA", icon: "flow" as const }] : [])
      ]
    },
    {
      title: "Communication",
      items: [
        ...(SHOW_EMAIL ? [{ href: "/app/email", label: "Emails", icon: "mail" as const }] : []),
        { href: "/app/contacts", label: "Contacts", icon: "contacts" },
        { href: "/app/signatures", label: "Signatures", icon: "sign" }
      ]
    },
    {
      title: "Administration",
      items: [{ href: "/app/settings", label: "Paramètres", icon: "settings" }]
    }
  ];

  const handleLogout = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const stored = window.localStorage.getItem("app_shell_collapsed");
    if (stored === "1") {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("app_shell_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className={collapsed ? "app-shell is-collapsed" : "app-shell"}>
      <aside className={mobileOpen ? "app-shell-sidebar is-open" : "app-shell-sidebar"}>
        <Link href="/app" className="app-shell-brand">
          <span className="app-shell-brand-mark">LA</span>
          <span className="app-shell-brand-text">Espace cabinet</span>
        </Link>
        <button
          type="button"
          className="ghost app-shell-collapse"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Étendre la barre latérale" : "Replier la barre latérale"}
        >
          {collapsed ? "Déplier" : "Replier"}
        </button>
        <nav className="app-shell-nav" aria-label="Navigation principale">
          {groups.map((group) => (
            <section key={group.title} className="app-shell-group">
              <h2>{group.title}</h2>
              <div className="app-shell-links">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={active ? "app-shell-link active" : "app-shell-link"}
                    >
                      <span className="app-shell-link-icon">
                        <NavIcon kind={item.icon} />
                      </span>
                      <span className="app-shell-link-label">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <button type="button" className="ghost app-shell-logout" onClick={handleLogout}>
          Déconnexion
        </button>
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
          <span>Assistant juridique opérationnel</span>
        </header>
        <div className="app-shell-page">{children}</div>
      </section>
    </div>
  );
}
