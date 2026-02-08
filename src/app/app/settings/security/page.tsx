"use client";

import { useRouter } from "next/navigation";

export default function SecurityPage() {
  const router = useRouter();

  return (
    <main className="module">
      <header className="module-header">
        <div>
          <h1>Sécurité</h1>
          <p>Contrôles, audit et bonnes pratiques de conformité.</p>
        </div>
        <div className="module-actions">
          <button className="ghost" onClick={() => router.push("/app/settings")}>Retour</button>
        </div>
      </header>

      <section className="module-grid">
        <div className="module-list">
          <div className="module-card">
            <h2>Journalisation</h2>
            <p className="muted">Historique des actions et accès aux données.</p>
            <button className="ghost" type="button">Voir les logs</button>
          </div>

          <div className="module-card">
            <h2>Accès sensibles</h2>
            <ul>
              <li>Stockage chiffré des clés API.</li>
              <li>Restriction par tenant.</li>
              <li>Suivi des exports et partages.</li>
            </ul>
          </div>
        </div>

        <aside className="module-panel">
          <h2>Checklist</h2>
          <ul>
            <li>Activer le MFA pour les comptes admin.</li>
            <li>Limiter l&apos;accès aux emails sortants.</li>
            <li>Revoir les rôles tous les trimestres.</li>
          </ul>
          <div className="module-note">
            Bientôt : alertes de sécurité personnalisées.
          </div>
        </aside>
      </section>
    </main>
  );
}
