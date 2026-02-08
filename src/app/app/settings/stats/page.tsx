"use client";

import { useRouter } from "next/navigation";

export default function StatsPage() {
  const router = useRouter();

  return (
    <main className="module">
      <header className="module-header">
        <div>
          <h1>Statistiques</h1>
          <p>Suivi informatif de la consommation et des outputs.</p>
        </div>
        <div className="module-actions">
          <button className="ghost" onClick={() => router.push("/app/settings")}>Retour</button>
        </div>
      </header>

      <section className="module-grid">
        <div className="module-list">
          <div className="module-card">
            <h2>Consommation API</h2>
            <div className="dash-stats">
              <div>
                <strong>—</strong>
                <span>Tokens RAG</span>
              </div>
              <div>
                <strong>—</strong>
                <span>Appels modèles</span>
              </div>
              <div>
                <strong>—</strong>
                <span>Embeddings</span>
              </div>
            </div>
            <p className="muted">Données purement informatives, mise à jour quotidienne.</p>
          </div>

          <div className="module-card">
            <h2>Production</h2>
            <div className="dash-stats">
              <div>
                <strong>—</strong>
                <span>Docs générés</span>
              </div>
              <div>
                <strong>—</strong>
                <span>Emails envoyés</span>
              </div>
              <div>
                <strong>—</strong>
                <span>Sources importées</span>
              </div>
            </div>
          </div>
        </div>

        <aside className="module-panel">
          <h2>Notes</h2>
          <ul>
            <li>Les valeurs affichées sont des estimations.</li>
            <li>Synchronisation par défaut toutes les 24h.</li>
          </ul>
          <div className="module-note">
            Bientôt : export CSV et alertes de dépassement.
          </div>
        </aside>
      </section>
    </main>
  );
}
