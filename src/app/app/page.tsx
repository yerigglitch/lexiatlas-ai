"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export default function AppPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [rssItems, setRssItems] = useState<
    Array<{ title: string; link: string; date: string; source: string }>
  >([]);
  const [rssLoading, setRssLoading] = useState(false);
  const [rssError, setRssError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [customFeed, setCustomFeed] = useState("");
  const [feeds, setFeeds] = useState<
    Array<{ id: string; name: string; url: string; enabled: boolean }>
  >([
    {
      id: "ce",
      name: "Conseil d'État (avis)",
      url: "https://www.conseil-etat.fr/content/download/265602/2660854/version/1/file/avis.xml",
      enabled: true
    },
    {
      id: "cc",
      name: "Conseil constitutionnel",
      url: "https://www.conseil-constitutionnel.fr/rss",
      enabled: true
    },
    {
      id: "dalloz",
      name: "Dalloz actualités",
      url: "https://feeds.feedburner.com/dalloz-actualite",
      enabled: false
    }
  ]);

  const activeFeeds = useMemo(() => feeds.filter((f) => f.enabled), [feeds]);

  useEffect(() => {
    const supabase = createBrowserSupabase();

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
        return;
      }
      setEmail(data.session.user.email || null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.push("/login");
        }
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, [router]);

  const fetchRss = useCallback(async () => {
    if (!activeFeeds.length) {
      setRssItems([]);
      return;
    }
    setRssLoading(true);
    setRssError(null);
    try {
      const responses = await Promise.all(
        activeFeeds.map(async (feed) => {
          const res = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);
          if (!res.ok) {
            return { feed, items: [] };
          }
          const payload = await res.json();
          return {
            feed,
            items: (payload.items || []).map((item: any) => ({
              ...item,
              source: feed.name
            }))
          };
        })
      );
      const merged = responses.flatMap((r) => r.items || []);
      setRssItems(merged);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("rss-feeds", JSON.stringify(feeds));
      }
    } catch {
      setRssError("Impossible de charger le flux.");
    } finally {
      setRssLoading(false);
    }
  }, [activeFeeds, feeds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedFeeds = window.localStorage.getItem("rss-feeds");
    const storedEnabled = window.localStorage.getItem("rss-notify");
    if (storedFeeds) {
      try {
        const parsed = JSON.parse(storedFeeds) as Array<{
          id: string;
          name: string;
          url: string;
          enabled: boolean;
        }>;
        if (parsed.length) setFeeds(parsed);
      } catch {
        // ignore
      }
    }
    if (storedEnabled === "true") setNotificationsEnabled(true);
    setTimeout(() => {
      fetchRss();
    }, 100);
  }, [fetchRss]);

  const enableNotifications = async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setRssError("Notifications non supportées par ce navigateur.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      window.localStorage.setItem("rss-notify", "true");
      new Notification("LexiAtlas AI", {
        body: "Alertes desktop activées pour votre flux RSS."
      });
    }
  };

  useEffect(() => {
    if (!notificationsEnabled) return;
    let lastNotified = window.localStorage.getItem("rss-last") || "";
    const poll = async () => {
      const res = await Promise.all(
        activeFeeds.map(async (feed) => {
          const r = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);
          if (!r.ok) return [];
          const payload = await r.json();
          return (payload.items || []).map((item: any) => ({
            ...item,
            source: feed.name
          }));
        })
      );
      const items = res.flat();
      if (items[0]?.link && items[0].link !== lastNotified) {
        lastNotified = items[0].link;
        window.localStorage.setItem("rss-last", lastNotified);
        new Notification("Nouvelle alerte juridique", {
          body: `${items[0].source} — ${items[0].title}`
        });
      }
    };
    const interval = window.setInterval(poll, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [notificationsEnabled, activeFeeds]);

  const handleLogout = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return <main className="auth"><p>Chargement...</p></main>;
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Espace cabinet</h1>
          <p>Bienvenue {email}. Voici votre tableau de bord quotidien.</p>
        </div>
        <div className="dashboard-actions">
          <Link className="ghost" href="/app/rag">
            Ouvrir le RAG
          </Link>
          <Link className="cta" href="/app/settings">
            Réglages
          </Link>
        </div>
      </header>

      <section className="dashboard-grid">
        <aside className="dash-rail">
          <Link className="rail-btn" href="/app/rag">Recherche RAG</Link>
          <Link className="rail-btn" href="/app/templates">Modèles Word</Link>
          <Link className="rail-btn" href="/app/documents">Générer un document</Link>
          <Link className="rail-btn" href="/app/email">Emails</Link>
          <Link className="rail-btn" href="/app/contacts">Contacts</Link>
          <Link className="rail-btn" href="/app/signatures">Signature qualifiée</Link>
          <Link className="rail-btn" href="/app/settings/email">SMTP</Link>
          <Link className="rail-btn" href="/app/settings/yousign">Yousign</Link>
          <Link className="rail-btn" href="/app/settings/stats">Statistiques</Link>
        </aside>

        <div className="dash-main">
          <div className="dash-card">
            <h2>À faire aujourd&apos;hui</h2>
            <ul>
              <li>Importer vos premières sources (codes, jurisprudence, notes).</li>
              <li>Ajouter un modèle Word (ex: courrier de relance).</li>
              <li>Configurer l&apos;envoi email du cabinet.</li>
            </ul>
          </div>
          <div className="dash-card">
            <h2>Vue d&apos;ensemble</h2>
            <div className="dash-stats">
              <div>
                <strong>—</strong>
                <span>Sources</span>
              </div>
              <div>
                <strong>—</strong>
                <span>Documents</span>
              </div>
              <div>
                <strong>—</strong>
                <span>Emails envoyés</span>
              </div>
            </div>
            <p className="muted">
              Les statistiques détaillées sont disponibles dans l&apos;onglet Statistiques.
            </p>
          </div>
          <div className="dash-card">
            <h2>Conseils d&apos;usage</h2>
            <p>
              Pour des réponses fiables, sélectionnez toujours les sources pertinentes
              et privilégiez la recherche “par source” lorsque vous comparez plusieurs
              documents.
            </p>
          </div>
          <div className="dash-card">
            <h2>Veille juridique (RSS)</h2>
            <div className="rss-controls">
              <input
                value={customFeed}
                onChange={(e) => setCustomFeed(e.target.value)}
                placeholder="Ajouter un flux RSS..."
              />
              <button className="ghost" type="button" onClick={fetchRss} disabled={rssLoading}>
                {rssLoading ? "..." : "Charger"}
              </button>
              <button className="cta" type="button" onClick={enableNotifications}>
                Alertes desktop
              </button>
            </div>
            {rssError && <p className="error">{rssError}</p>}
            <div className="rss-feeds">
              {feeds.map((feed) => (
                <label key={feed.id} className="rss-feed">
                  <input
                    type="checkbox"
                    checked={feed.enabled}
                    onChange={(e) =>
                      setFeeds((prev) =>
                        prev.map((f) =>
                          f.id === feed.id ? { ...f, enabled: e.target.checked } : f
                        )
                      )
                    }
                  />
                  <span>{feed.name}</span>
                </label>
              ))}
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  if (!customFeed.trim()) return;
                  const id = `custom-${Date.now()}`;
                  setFeeds((prev) => [
                    ...prev,
                    { id, name: "Flux personnalisé", url: customFeed.trim(), enabled: true }
                  ]);
                  setCustomFeed("");
                }}
              >
                Ajouter le flux
              </button>
            </div>
            <div className="rss-list">
              {rssItems.length === 0 && <p className="muted">Aucun élément chargé.</p>}
              {rssItems.map((item) => (
                <a key={item.link} className="rss-item" href={item.link} target="_blank" rel="noreferrer">
                  <strong>{item.title}</strong>
                  <span>{item.source} · {item.date}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="floating-actions">
        <Link className="icon-btn" href="/app/settings" title="Réglages">
          <span className="icon-glyph" aria-hidden>⚙</span>
        </Link>
        <button className="icon-btn" type="button" onClick={handleLogout} title="Se déconnecter">
          <span className="icon-glyph" aria-hidden>⏻</span>
        </button>
      </div>
    </main>
  );
}
