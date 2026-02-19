"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export default function AppPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const featureDocflow = process.env.NEXT_PUBLIC_FEATURE_DOCFLOW === "true";
  const featureEmailV2 = process.env.NEXT_PUBLIC_FEATURE_EMAIL_V2 === "true";

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
          <a className="ghost" href="/app/rag">
            Ouvrir le RAG
          </a>
          <a className="cta" href="/app/settings">
            Réglages
          </a>
        </div>
      </header>

      <section className="dashboard-grid">
        <aside className="dash-rail">
          <a className="rail-btn" href="/app/rag">Recherche RAG</a>
          <a className="rail-btn" href="/app/templates">Modèles Word</a>
          {featureDocflow && <a className="rail-btn" href="/app/docflow">DocFlow IA</a>}
          <a className="rail-btn" href="/app/documents">Générer un document</a>
          {featureEmailV2 && <a className="rail-btn" href="/app/email">Emails</a>}
          <a className="rail-btn" href="/app/contacts">Contacts</a>
          <a className="rail-btn" href="/app/signatures">Signature qualifiée</a>
          <a className="rail-btn" href="/app/settings/email">SMTP</a>
          <a className="rail-btn" href="/app/settings/yousign">Yousign</a>
          <a className="rail-btn" href="/app/settings/stats">Statistiques</a>
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
        </div>
      </section>

      <div className="floating-actions">
        <a className="icon-btn" href="/app/settings" title="Réglages">
          <span className="icon-glyph" aria-hidden>⚙</span>
        </a>
        <button className="icon-btn" type="button" onClick={handleLogout} title="Se déconnecter">
          <span className="icon-glyph" aria-hidden>⏻</span>
        </button>
      </div>
    </main>
  );
}
