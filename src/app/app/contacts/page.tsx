"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import EmptyState from "@/components/ui/empty-state";
import InlineAlert from "@/components/ui/inline-alert";
import PageHeader from "@/components/ui/page-header";

type Contact = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  role?: string;
  notes?: string;
  address_line?: string;
  postal_code?: string;
  city?: string;
  country?: string;
};

export default function ContactsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    organization: "",
    role: "",
    notes: "",
    address_line: "",
    postal_code: "",
    city: "",
    country: "France"
  });
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showOcr, setShowOcr] = useState(false);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchOrg, setSearchOrg] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [searchPhone, setSearchPhone] = useState("");

  const loadContacts = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const res = await fetch("/api/contacts", {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`
      }
    });

    const payload = await res.json();
    setContacts(payload.contacts || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify(form)
    });

    if (!res.ok) {
      const message = await res.text();
      setError(message || "Erreur lors de l'ajout");
      return;
    }

    setForm({
      name: "",
      email: "",
      phone: "",
      organization: "",
      role: "",
      notes: "",
      address_line: "",
      postal_code: "",
      city: "",
      country: "France"
    });
    setShowAdd(false);
    loadContacts();
  };

  const handleOcr = async () => {
    if (!ocrFile) {
      setOcrError("Sélectionnez une image.");
      return;
    }
    setOcrLoading(true);
    setOcrError(null);

    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }

    const formData = new FormData();
    formData.append("file", ocrFile);

    const res = await fetch("/api/contacts/ocr", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      body: formData
    });

    if (!res.ok) {
      const message = await res.text();
      setOcrError(message || "Erreur OCR");
      setOcrLoading(false);
      return;
    }

    const payload = await res.json();
    const parsed = payload.parsed || {};
    setForm((prev) => ({
      ...prev,
      name: parsed.name || prev.name,
      email: parsed.email || prev.email,
      phone: parsed.phone || prev.phone,
      organization: parsed.organization || prev.organization,
      address_line: parsed.address_line || prev.address_line,
      postal_code: parsed.postal_code || prev.postal_code,
      city: parsed.city || prev.city,
      country: parsed.country || prev.country
    }));
    setShowOcr(false);
    setShowAdd(true);
    setOcrLoading(false);
  };

  const filteredContacts = useMemo(() => {
    const qName = searchName.trim().toLowerCase();
    const qOrg = searchOrg.trim().toLowerCase();
    const qCity = searchCity.trim().toLowerCase();
    const qEmail = searchEmail.trim().toLowerCase();
    const qPhone = searchPhone.trim().toLowerCase();

    return contacts.filter((contact) => {
      const name = (contact.name || "").toLowerCase();
      const organization = (contact.organization || "").toLowerCase();
      const city = (contact.city || "").toLowerCase();
      const email = (contact.email || "").toLowerCase();
      const phone = (contact.phone || "").toLowerCase();
      const role = (contact.role || "").toLowerCase();
      const country = (contact.country || "").toLowerCase();
      const notes = (contact.notes || "").toLowerCase();

      if (qName && !name.includes(qName)) return false;
      if (qOrg && !(organization.includes(qOrg) || role.includes(qOrg) || notes.includes(qOrg))) return false;
      if (qCity && !(city.includes(qCity) || country.includes(qCity))) return false;
      if (qEmail && !email.includes(qEmail)) return false;
      if (qPhone && !phone.includes(qPhone)) return false;
      return true;
    });
  }, [contacts, searchName, searchOrg, searchCity, searchEmail, searchPhone]);

  if (loading) {
    return <main className="app-loading" aria-live="polite"><div className="ui-skeleton-line" /><div className="ui-skeleton-line short" /></main>;
  }

  return (
    <main className="module contacts-v3">
      <PageHeader
        title="Carnet d'adresses"
        subtitle="Clients, confrères, juridictions et partenaires."
        actions={
          <>
            <button className="ghost" onClick={() => router.push("/app")}>
              Retour
            </button>
            <button className="cta" onClick={() => setShowAdd(true)}>
              Ajouter un contact
            </button>
          </>
        }
      />

      <section className="module-grid">
        <div className="module-list">
          <article className="module-card contacts-search-card">
            <h3>Recherche contacts</h3>
            <div className="contacts-search-grid">
              <label>
                Nom
                <input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Ex: Dupont" />
              </label>
              <label>
                Société / institution
                <input value={searchOrg} onChange={(e) => setSearchOrg(e.target.value)} placeholder="Ex: Tribunal, ACME" />
              </label>
              <label>
                Ville / pays
                <input value={searchCity} onChange={(e) => setSearchCity(e.target.value)} placeholder="Ex: Paris" />
              </label>
              <label>
                Email
                <input value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} placeholder="Ex: @cabinet.fr" />
              </label>
              <label>
                Téléphone
                <input value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} placeholder="Ex: 06" />
              </label>
            </div>
          </article>

          {contacts.length === 0 && (
            <EmptyState
              title="Aucun contact enregistré"
              description="Créez le premier contact du cabinet."
              action={
                <button className="cta" onClick={() => setShowAdd(true)}>
                  Ajouter le premier contact
                </button>
              }
            />
          )}
          {contacts.length > 0 && filteredContacts.length === 0 && (
            <EmptyState
              title="Aucun contact ne correspond aux filtres"
              description="Ajustez vos critères de recherche."
            />
          )}

          {filteredContacts.map((contact) => (
            <article key={contact.id} className="module-card">
              <h3>{contact.name}</h3>
              <p>{contact.organization || "Cabinet / Organisation"}</p>
              <div className="contact-meta">
                <span>{contact.email || "Email non renseigné"}</span>
                <span>{contact.phone || "Téléphone non renseigné"}</span>
              </div>
              {(contact.address_line || contact.city) && (
                <p className="contact-notes">
                  {contact.address_line || ""} {contact.postal_code || ""}{" "}
                  {contact.city || ""} {contact.country || ""}
                </p>
              )}
              {contact.role && <p className="contact-role">{contact.role}</p>}
              {contact.notes && <p className="contact-notes">{contact.notes}</p>}
            </article>
          ))}
        </div>

        <aside className="module-panel">
          <h2>Raccourcis</h2>
          <p className="muted">
            Ajoutez un contact à partir d&apos;une photo de carte de visite.
          </p>
          <button className="cta" onClick={() => setShowOcr(true)}>
            Scanner une carte (OCR)
          </button>
          <div className="module-note">
            L&apos;OCR pré-remplit les champs, vous gardez le contrôle.
          </div>
        </aside>
      </section>

      {showAdd && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <strong>Ajouter un contact</strong>
              <button className="ghost" type="button" onClick={() => setShowAdd(false)}>
                Fermer
              </button>
            </div>
            <form className="modal-body contacts-modal-form" onSubmit={handleSubmit}>
              <label>
                Nom
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label>
                Téléphone
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label>
                Organisation
                <input
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                />
              </label>
              <label>
                Rôle
                <input
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                />
              </label>
              <label>
                Adresse
                <input
                  value={form.address_line}
                  onChange={(e) => setForm({ ...form, address_line: e.target.value })}
                />
              </label>
              <div className="form-row">
                <label>
                  Code postal
                  <input
                    value={form.postal_code}
                    onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                  />
                </label>
                <label>
                  Ville
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Pays
                <input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </label>
              <label>
                Notes
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              <div className="modal-footer">
                {error && <InlineAlert tone="error">{error}</InlineAlert>}
                <button className="cta" type="submit">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOcr && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <strong>Scanner une carte</strong>
              <button className="ghost" type="button" onClick={() => setShowOcr(false)}>
                Fermer
              </button>
            </div>
            <div className="modal-body">
              <label>
                Photo (PNG/JPG)
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => setOcrFile(e.target.files?.[0] || null)}
                />
              </label>
              {ocrError && <InlineAlert tone="error">{ocrError}</InlineAlert>}
              <button className="cta" type="button" onClick={handleOcr} disabled={ocrLoading}>
                {ocrLoading ? "Analyse..." : "Lancer l'OCR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
