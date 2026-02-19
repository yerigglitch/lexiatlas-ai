"use client";

import Link from "next/link";

export default function AppLitePage() {
  return (
    <main className="auth">
      <section className="auth-card">
        <h1>App Lite</h1>
        <p>Page minimale pour isoler un problème de performance.</p>
        <div className="module-actions">
          <Link className="ghost" href="/app/rag">RAG</Link>
          <Link className="ghost" href="/app/templates">Templates</Link>
          <Link className="ghost" href="/app/contacts">Contacts</Link>
          <Link className="ghost" href="/app/email">Emails</Link>
        </div>
        <p className="muted">Si cette page ne fait pas monter la mémoire, le problème est dans /app.</p>
      </section>
    </main>
  );
}
