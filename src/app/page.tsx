import Link from "next/link";
import PageClient from "./page-client";

export default function HomePage() {
  return (
    <PageClient>
      <div className="background-orbs" aria-hidden="true"></div>
      <header className="top">
        <nav className="nav">
          <div className="logo">
            <span className="logo-mark">LA</span>
            <div>
              <p>LexiAtlas AI</p>
              <span>Juriste augmenté</span>
            </div>
          </div>
          <div className="nav-actions">
            <Link className="ghost" href="/login">Connexion</Link>
            <Link className="cta" href="/signup">Commencez maintenant</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy reveal">
            <p className="pill">Pour cabinets français 5 à 80 avocats</p>
            <h1>Le copilote juridique RAG qui respecte vos méthodes de cabinet.</h1>
            <p className="lead">
              Accédez instantanément aux codes, doctrine et jurisprudence, puis
              enrichissez votre base avec vos propres dossiers. Gagnez du temps sur
              la rédaction, la mise en forme, l&apos;envoi des courriers et la gestion de
              vos contacts.
            </p>
            <div className="hero-actions">
              <Link className="cta" href="/signup">Commencez maintenant</Link>
              <Link className="ghost" href="/login">Se connecter</Link>
            </div>
            <div className="trust-row">
              <span>RGPD &amp; hébergement UE</span>
              <span>Chiffrement bout en bout</span>
              <span>Auditabilité complète</span>
            </div>
          </div>
          <div className="hero-visual reveal">
            <div className="mockup">
              <div className="mockup-header">
                <div className="tabs">
                  <span className="tab active">Recherche RAG</span>
                  <span className="tab">Rédaction</span>
                  <span className="tab">Envois</span>
                </div>
                <div className="status">Synchronisé · 2.431 sources</div>
              </div>
              <div className="mockup-body">
                <div className="query">
                  <p>Question client</p>
                  <strong>Clause de non-concurrence : validité et durée ?</strong>
                </div>
                <div className="results">
                  <div className="result-card">
                    <span>Code du travail</span>
                    <h3>Articles L.1121-1, L.1221-1</h3>
                    <p>Limitations proportionnées, intérêt légitime du cabinet.</p>
                  </div>
                  <div className="result-card">
                    <span>Jurisprudence</span>
                    <h3>Cour de cassation, 10/07/2024</h3>
                    <p>Contrepartie financière suffisante, périmètre clair.</p>
                  </div>
                  <div className="result-card">
                    <span>Dossier interne</span>
                    <h3>Modèle cabinet · Clause 2025</h3>
                    <p>Version commentée par l&apos;équipe sociale.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="note note-1">Sources officielles prêtes à l&apos;emploi</div>
            <div className="note note-2">Vos pièces, mémoires et modèles ajoutés</div>
            <div className="note note-3">Rédaction + mise en forme en 1 clic</div>
          </div>
        </section>

        <section className="capabilities">
          <div className="section-title reveal">
            <h2>Tout ce qu&apos;il faut pour un cabinet agile</h2>
            <p>Des capacités pensées pour le quotidien des avocats en France.</p>
          </div>
          <div className="cap-grid">
            <article className="cap-card reveal">
              <div className="cap-visual">
                <svg
                  viewBox="0 0 320 220"
                  role="img"
                  aria-label="Recherche juridique"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <rect x="16" y="20" width="288" height="180" rx="18" fill="#fdf4e3" />
                  <rect x="36" y="44" width="180" height="18" rx="9" fill="#f3cda6" />
                  <rect x="36" y="80" width="240" height="16" rx="8" fill="#f6b9b2" />
                  <rect x="36" y="108" width="220" height="14" rx="7" fill="#eed7f7" />
                  <rect x="36" y="134" width="200" height="14" rx="7" fill="#d4ecf9" />
                  <circle cx="255" cy="60" r="28" fill="#1d3557" />
                  <text
                    x="247"
                    y="65"
                    fontSize="16"
                    fill="#fdf4e3"
                    fontFamily="'Manrope', sans-serif"
                  >
                    RAG
                  </text>
                </svg>
              </div>
              <h3>Moteur RAG juridique</h3>
              <p>Codes, doctrine, jurisprudence et commentaires intégrés avec citations et liens directs.</p>
            </article>
            <article className="cap-card reveal">
              <div className="cap-visual">
                <svg
                  viewBox="0 0 320 220"
                  role="img"
                  aria-label="Ajout de sources"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <rect x="18" y="18" width="284" height="184" rx="20" fill="#eef5ff" />
                  <rect x="42" y="46" width="236" height="26" rx="10" fill="#9cc9ff" />
                  <rect x="60" y="90" width="200" height="18" rx="9" fill="#ffd6b3" />
                  <rect x="60" y="118" width="160" height="14" rx="7" fill="#c7ead6" />
                  <rect x="60" y="142" width="140" height="14" rx="7" fill="#f4b6c2" />
                  <path d="M250 150 L278 180" stroke="#2d3a4a" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="250" cy="150" r="10" fill="#2d3a4a" />
                </svg>
              </div>
              <h3>Vos sources privées</h3>
              <p>Ajoutez contrats, mémoires, dossiers clients, modèles maison en quelques clics.</p>
            </article>
            <article className="cap-card reveal">
              <div className="cap-visual">
                <svg
                  viewBox="0 0 320 220"
                  role="img"
                  aria-label="Rédaction et envoi"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <rect x="20" y="22" width="280" height="176" rx="18" fill="#f7f0ff" />
                  <rect x="44" y="50" width="210" height="14" rx="7" fill="#bde0fe" />
                  <rect x="44" y="74" width="230" height="14" rx="7" fill="#cdb4db" />
                  <rect x="44" y="98" width="190" height="14" rx="7" fill="#ffc8dd" />
                  <rect x="44" y="122" width="160" height="14" rx="7" fill="#ffafcc" />
                  <rect x="44" y="148" width="110" height="24" rx="12" fill="#001219" />
                  <text
                    x="58"
                    y="165"
                    fontSize="12"
                    fill="#f7f0ff"
                    fontFamily="'Manrope', sans-serif"
                  >
                    Envoyer
                  </text>
                </svg>
              </div>
              <h3>Rédaction, formatage, envoi</h3>
              <p>Modèles de courriers, PDF structurés, emailing sécurisé et signatures intégrées.</p>
            </article>
          </div>
        </section>

        <section className="suite">
          <div className="section-title reveal">
            <h2>La suite complète pour votre cabinet</h2>
            <p>Plus qu&apos;un moteur, une plateforme d&apos;exécution juridique.</p>
          </div>
          <div className="feature-grid">
            <div className="feature-card reveal">
              <h4>Recherche multi-facettes</h4>
              <p>Filtres par code, juridiction, date, auteur, niveau de confidentialité.</p>
            </div>
            <div className="feature-card reveal">
              <h4>Rédaction guidée</h4>
              <p>Plans automatiques, citations prêtes à l&apos;emploi, relecture cohérente.</p>
            </div>
            <div className="feature-card reveal">
              <h4>Carnet d&apos;adresses</h4>
              <p>Contacts clients, confrères, juridictions, interlocuteurs internes.</p>
            </div>
            <div className="feature-card reveal">
              <h4>Modèles dynamiques</h4>
              <p>Variables de dossier, insertion automatique des pièces et annexes.</p>
            </div>
            <div className="feature-card reveal">
              <h4>Automatisation des envois</h4>
              <p>Courriers recommandés, emails sécurisés, suivi des accusés.</p>
            </div>
            <div className="feature-card reveal">
              <h4>Contrôle &amp; sécurité</h4>
              <p>Traçabilité des recherches, journaux d&apos;accès, gestion des droits.</p>
            </div>
          </div>
        </section>

        <section className="workflow">
          <div className="section-title reveal">
            <h2>Un flux de travail limpide</h2>
            <p>Du brief client à l&apos;envoi final, sans friction.</p>
          </div>
          <div className="steps">
            <div className="step reveal">
              <span className="step-index">1</span>
              <h4>Briefez la question</h4>
              <p>Posez la question, ajoutez le contexte et les pièces nécessaires.</p>
            </div>
            <div className="step reveal">
              <span className="step-index">2</span>
              <h4>Collectez les sources</h4>
              <p>Sources publiques + bibliothèque interne pour une réponse argumentée.</p>
            </div>
            <div className="step reveal">
              <span className="step-index">3</span>
              <h4>Produisez &amp; envoyez</h4>
              <p>Générez l&apos;acte, mettez en forme et expédiez au bon destinataire.</p>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-card reveal">
            <div>
              <h2>Prêt à transformer la productivité de votre cabinet ?</h2>
              <p>Organisons une démonstration avec vos propres dossiers, en toute confidentialité.</p>
            </div>
            <div className="cta-actions">
              <Link className="cta" href="/signup">Commencez maintenant</Link>
              <Link className="ghost" href="/login">Déjà client ?</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div>
          <strong>LexiAtlas AI</strong>
          <p>Plateforme RAG juridique pour cabinets français.</p>
        </div>
        <div>
          <p>Support dédié · SLA cabinet</p>
          <p>contact@lexiatlas.ai · +33 1 84 88 00 00</p>
        </div>
      </footer>
    </PageClient>
  );
}
