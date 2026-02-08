"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export default function YousignSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    environment: "sandbox",
    apiKey: "",
    legalName: "LexiAtlas AI",
    fromEmail: ""
  });
  const [hasKey, setHasKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/settings/yousign", {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });
      const payload = await res.json();
      if (payload?.settings) {
        setForm((prev) => ({
          ...prev,
          environment: payload.settings.environment || "sandbox",
          legalName: payload.settings.legal_name || "LexiAtlas AI",
          fromEmail: payload.settings.from_email || ""
        }));
        setHasKey(payload.settings.hasKey);
      }
      setLoading(false);
    };

    load();
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

    const res = await fetch("/api/settings/yousign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({
        environment: form.environment,
        apiKey: form.apiKey || undefined,
        legalName: form.legalName,
        fromEmail: form.fromEmail || undefined
      })
    });

    if (!res.ok) {
      const message = await res.text();
      setError(message || "Erreur lors de l'enregistrement");
      return;
    }

    setHasKey(Boolean(form.apiKey) || hasKey);
    setForm((prev) => ({ ...prev, apiKey: "" }));
    setSuccess("Paramètres Yousign enregistrés.");
  };

  if (loading) {
    return <main className="auth"><p>Chargement...</p></main>;
  }

  return (
    <main className="auth">
      <section className="auth-card">
        <h1>Signature qualifiée (Yousign)</h1>
        <p>
          {hasKey
            ? "Clé API enregistrée."
            : "Ajoutez une clé API pour activer la signature qualifiée."}
        </p>
        <form onSubmit={handleSave}>
          <label>
            Environnement
            <select
              value={form.environment}
              onChange={(e) => setForm({ ...form, environment: e.target.value })}
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </label>
          <label>
            Clé API Yousign
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="ys_..."
            />
          </label>
          <label>
            Nom légal
            <input
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            />
          </label>
          <label>
            Email expéditeur
            <input
              type="email"
              value={form.fromEmail}
              onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
            />
          </label>
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
          <button className="cta" type="submit">Enregistrer</button>
        </form>
        <button className="ghost" onClick={() => router.push("/app")}>Retour</button>
      </section>
    </main>
  );
}
