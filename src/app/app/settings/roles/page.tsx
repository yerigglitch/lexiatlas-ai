"use client";

import { useRouter } from "next/navigation";

export default function RolesPage() {
  const router = useRouter();

  return (
    <main className="module">
      <header className="module-header">
        <div>
          <h1>Accès & rôles</h1>
          <p>Gestion des collaborateurs et des permissions du cabinet.</p>
        </div>
        <div className="module-actions">
          <button className="ghost" onClick={() => router.push("/app/settings")}>Retour</button>
        </div>
      </header>

      <section className="module-grid">
        <div className="module-list">
          <div className="module-card">
            <h2>Collaborateurs</h2>
            <p className="muted">Invitez un membre et attribuez un rôle.</p>
            <button className="cta" type="button">Inviter un collaborateur</button>
          </div>

          <div className="module-card">
            <h2>Rôles disponibles</h2>
            <ul>
              <li>Administrateur — accès complet.</li>
              <li>Avocat — accès RAG, documents, emails.</li>
              <li>Assistant — accès limité aux tâches déléguées.</li>
            </ul>
          </div>
        </div>

        <aside className="module-panel">
          <h2>Bonnes pratiques</h2>
          <ul>
            <li>Attribuez le rôle minimal nécessaire.</li>
            <li>Vérifiez les accès avant chaque onboarding.</li>
          </ul>
          <div className="module-note">
            Journalisation détaillée disponible dans Sécurité.
          </div>
        </aside>
      </section>
    </main>
  );
}
