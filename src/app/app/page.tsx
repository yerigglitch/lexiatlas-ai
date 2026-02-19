"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import PageHeader from "@/components/ui/page-header";

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

  if (loading) {
    return <main className="auth"><p>Chargement...</p></main>;
  }

  return (
    <main className="dashboard">
      <PageHeader
        title="Espace cabinet"
        subtitle={`Bienvenue ${email}. Voici votre tableau de bord quotidien.`}
        actions={
          <>
            <a className="ghost" href="/app/settings">
              Réglages
            </a>
            <a className="cta" href="/app/rag">
              Ouvrir le RAG
            </a>
          </>
        }
      />

      <section className="dashboard-overview-grid">
        <article className="dash-card">
          <h2>Démarrer une tâche</h2>
          <div className="quick-actions">
            <a className="ghost" href="/app/rag">
              Recherche RAG
            </a>
            <a className="ghost" href="/app/documents">
              Générer un document
            </a>
            {featureDocflow && (
              <a className="ghost" href="/app/docflow">
                DocFlow IA
              </a>
            )}
            {featureEmailV2 && (
              <a className="ghost" href="/app/email">
                Ouvrir les emails
              </a>
            )}
          </div>
        </article>

        <article className="dash-card">
          <h2>Actions recommandees</h2>
          <ul>
            <li>Importer vos premières sources (codes, jurisprudence, notes).</li>
            <li>Ajouter un modèle Word (ex: courrier de relance).</li>
            <li>Vérifier SMTP avant votre premier envoi client.</li>
          </ul>
        </article>

        <article className="dash-card">
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
              <span>Emails</span>
            </div>
          </div>
          <p className="muted">Les statistiques détaillées sont disponibles dans Paramètres.</p>
        </article>
      </section>

      <section className="dash-card">
        <h2>Raccourcis utiles</h2>
        <div className="dashboard-actions">
          <a className="ghost" href="/app/rag">
            Recherche
          </a>
          <a className="ghost" href="/app/templates">
            Modèles Word
          </a>
          <a className="ghost" href="/app/contacts">
            Contacts
          </a>
          <a className="ghost" href="/app/signatures">
            Signatures
          </a>
          <a className="ghost" href="/app/settings">
            Paramètres
          </a>
        </div>
      </section>
    </main>
  );
}
