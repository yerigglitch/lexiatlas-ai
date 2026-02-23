"use client";

import { useMemo, useState } from "react";
import EmptyState from "@/components/ui/empty-state";
import PageHeader from "@/components/ui/page-header";
import { listKnowledge, renameKnowledge } from "@/lib/rag-memory";

export default function KnowledgePage() {
  const [entries, setEntries] = useState(() => listKnowledge());
  const [openId, setOpenId] = useState<string | null>(entries[0]?.id || null);

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [entries]
  );

  return (
    <main className="module knowledge-v3">
      <PageHeader
        title="Réponses sauvegardées"
        subtitle="Historique des réponses validées (différent des recherches mémorisées)."
      />

      {sorted.length === 0 && (
        <EmptyState
          title="Aucune réponse sauvegardée"
          description="Depuis Recherche, enregistrez une réponse pour la retrouver ici."
        />
      )}

      <section className="module-list knowledge-v3-list">
        {sorted.map((entry) => (
          <article key={entry.id} className="module-card knowledge-v3-item">
            <div className="history-card-header">
              <strong>{entry.title}</strong>
              <div className="module-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    const next = window.prompt("Modifier le titre", entry.title);
                    if (!next) return;
                    renameKnowledge(entry.id, next);
                    setEntries(listKnowledge());
                  }}
                >
                  Renommer
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setOpenId((prev) => (prev === entry.id ? null : entry.id))}
                >
                  {openId === entry.id ? "Replier" : "Déplier"}
                </button>
              </div>
            </div>
            <p className="muted">{entry.question}</p>
            {openId === entry.id && <p className="knowledge-v3-answer">{entry.answer}</p>}
          </article>
        ))}
      </section>
    </main>
  );
}
