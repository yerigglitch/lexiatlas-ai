"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      if (!data.session) {
        throw new Error(
          "Confirmez votre email puis reconnectez-vous pour activer le cabinet."
        );
      }

      const res = await fetch("/api/auth/onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`
        },
        body: JSON.stringify({ tenantName, fullName })
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Onboarding échoué");
      }

      router.push("/app");
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
          {error && <p className="error">{error}</p>}
          <button type="submit" className="cta" disabled={loading}>
            {loading ? "Création..." : "Créer le cabinet"}
          </button>
        </form>
        <button className="ghost" onClick={() => router.push("/login")}>J'ai déjà un compte</button>
      </section>
    </main>
  );
}
