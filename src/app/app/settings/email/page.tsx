"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export default function EmailSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    host: "",
    port: "587",
    username: "",
    password: "",
    fromName: "",
    fromEmail: ""
  });
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

      const res = await fetch("/api/settings/smtp", {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });
      const payload = await res.json();
      if (payload?.settings) {
        setForm((prev) => ({
          ...prev,
          host: payload.settings.host || "",
          port: String(payload.settings.port || "587"),
          username: payload.settings.username || "",
          fromName: payload.settings.from_name || "",
          fromEmail: payload.settings.from_email || ""
        }));
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

    const res = await fetch("/api/settings/smtp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({
        host: form.host,
        port: Number(form.port),
        username: form.username,
        password: form.password,
        fromName: form.fromName,
        fromEmail: form.fromEmail
      })
    });

    if (!res.ok) {
      const message = await res.text();
      setError(message || "Erreur lors de l'enregistrement");
      return;
    }

    setForm((prev) => ({ ...prev, password: "" }));
    setSuccess("Configuration SMTP enregistrée.");
  };

  if (loading) {
    return <main className="app-loading" aria-live="polite"><div className="ui-skeleton-line" /><div className="ui-skeleton-line short" /></main>;
  }

  return (
    <main className="auth">
      <section className="auth-card">
        <h1>Configuration email</h1>
        <p>Ajoutez votre serveur SMTP pour envoyer les courriers.</p>
        <form onSubmit={handleSave}>
          <label>
            Hôte SMTP
            <input
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              required
            />
          </label>
          <label>
            Port
            <input
              value={form.port}
              onChange={(e) => setForm({ ...form, port: e.target.value })}
              required
            />
          </label>
          <label>
            Utilisateur
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
          <label>
            Nom expéditeur
            <input
              value={form.fromName}
              onChange={(e) => setForm({ ...form, fromName: e.target.value })}
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
