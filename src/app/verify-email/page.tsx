"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const router = useRouter();
  const email = params?.get("email") || "";

  return (
    <main className="auth">
      <section className="auth-card">
        <h1>Vérifiez votre email</h1>
        <p>
          Nous avons envoyé un lien de confirmation
          {email ? ` à ${email}` : ""}. Cliquez sur le lien pour activer votre
          compte.
        </p>
        <p className="muted">
          Pensez à vérifier les spams si vous ne voyez rien sous 2 minutes.
        </p>
        <button className="cta" onClick={() => router.push("/login")}>
          J&apos;ai confirmé, me connecter
        </button>
        <button className="ghost" onClick={() => router.push("/signup")}>
          Retour à l&apos;inscription
        </button>
      </section>
    </main>
  );
}
