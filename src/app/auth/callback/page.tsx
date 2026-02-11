"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export const dynamic = "force-dynamic";

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const run = async () => {
      try {
        const code = params?.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        setTimeout(() => router.replace("/app"), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
    };
    run();
  }, [params, router]);

  return (
    <main className="auth">
      <section className="auth-card">
        <h1>Merci, votre email est confirmé</h1>
        <p>Vous allez être redirigé automatiquement vers votre espace.</p>
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<main className="auth"><p>Validation en cours...</p></main>}>
      <CallbackInner />
    </Suspense>
  );
}
