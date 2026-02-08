"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/settings/mistral-key", {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        }
      });
      const payload = await res.json();
      setHasKey(Boolean(payload?.hasKey));
      setLoading(false);
    });
  }, [router]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const res = await fetch("/api/settings/mistral-key", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({ apiKey })
    });

    if (!res.ok) {
      const message = await res.text();
      setError(message || "Erreur lors de l'enregistrement");
      return;
    }

    setHasKey(true);
    setApiKey("");
    setSuccess("Clé Mistral enregistrée.");
  };

  if (loading) {
    return <main className="auth"><p>Chargement...</p></main>;
  }

  return (
    <main className="module">
      <header className="module-header">
        <div>
          <h1>Réglages</h1>
          <p>Clés API, sécurité, rôles et statistiques.</p>
        </div>
        <div className="module-actions">
          <button className="ghost" onClick={() => router.push("/app")}>Retour</button>
        </div>
      </header>

      <section className="module-grid">
        <div className="module-list">
          <form className="module-card" onSubmit={handleSave}>
            <h2>Clé API Mistral</h2>
            <p className="muted">
              {hasKey
                ? "Une clé Mistral est déjà enregistrée."
                : "Ajoutez votre clé Mistral pour activer l'IA."}
            </p>
            <label>
              Clé API
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            {success && <p className="success">{success}</p>}
            <button className="cta" type="submit">
              Enregistrer
            </button>
          </form>

          <div className="module-card">
            <h2>Accès & rôles</h2>
            <p className="muted">Gérez les collaborateurs et leurs permissions.</p>
            <button className="ghost" type="button" onClick={() => router.push("/app/settings/roles")}>
              Ouvrir
            </button>
          </div>

          <div className="module-card">
            <h2>Sécurité</h2>
            <p className="muted">Journalisation, contrôles et bonnes pratiques.</p>
            <button className="ghost" type="button" onClick={() => router.push("/app/settings/security")}>
              Ouvrir
            </button>
          </div>
        </div>

        <aside className="module-panel">
          <h2>Raccourcis</h2>
          <ul>
            <li>Configurer SMTP pour l&apos;envoi.</li>
            <li>Configurer Yousign pour signatures.</li>
            <li>Consulter l&apos;usage dans Statistiques.</li>
          </ul>
          <button className="ghost" onClick={() => router.push("/app/settings/email")}>
            SMTP
          </button>
          <button className="ghost" onClick={() => router.push("/app/settings/yousign")}>
            Yousign
          </button>
          <button className="ghost" onClick={() => router.push("/app/settings/stats")}>
            Statistiques
          </button>
        </aside>
      </section>
    </main>
  );
}
