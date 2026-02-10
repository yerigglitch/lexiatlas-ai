"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  useEffect(() => {
    if (!turnstileKey) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [turnstileKey]);

  useEffect(() => {
    if (!turnstileKey || !turnstileRef.current) return;
    const interval = window.setInterval(() => {
      const turnstile = (window as any).turnstile;
      if (turnstile) {
        turnstile.render(turnstileRef.current, {
          sitekey: turnstileKey,
          callback: (token: string) => setTurnstileToken(token)
        });
        window.clearInterval(interval);
      }
    }, 300);
    return () => window.clearInterval(interval);
  }, [turnstileKey]);

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("Impossible de créer le compte.");
      }

      const onboard = await fetch("/api/auth/onboard-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: data.user.id,
          tenantName,
          fullName,
          email,
          inviteCode,
          turnstileToken
        })
      });

      if (!onboard.ok) {
        const message = await onboard.text();
        throw new Error(message || "Onboarding échoué");
      }

      setSuccess("Compte créé. Confirmez votre email puis connectez-vous.");
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth">
      <section className="auth-card">
        <h1>Créer un cabinet</h1>
        <p>Démarrez votre espace sécurisé en 2 minutes.</p>
        <form onSubmit={handleSignup}>
          <label>
            Nom du cabinet
            <input
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
            />
          </label>
          <label>
            Nom complet
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>
          <label>
            Email professionnel
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <label>
            Code d&apos;invitation
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Reçu par email"
            />
          </label>
          {turnstileKey && <div ref={turnstileRef} />}
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
          <button type="submit" className="cta" disabled={loading}>
            {loading ? "Création..." : "Créer le cabinet"}
          </button>
        </form>
        <button className="ghost" onClick={() => router.push("/login")}>J&apos;ai déjà un compte</button>
      </section>
    </main>
  );
}
