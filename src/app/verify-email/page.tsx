import Link from "next/link";

export default function VerifyEmailPage({
  searchParams
}: {
  searchParams?: { email?: string };
}) {
  const email = searchParams?.email || "";

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
        <Link className="cta" href="/login">
          J&apos;ai confirmé, me connecter
        </Link>
        <Link className="ghost" href="/signup">
          Retour à l&apos;inscription
        </Link>
      </section>
    </main>
  );
}
