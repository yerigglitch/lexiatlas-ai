"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

type PreviewPayload = {
  docType: "NOTE" | "COURRIER";
  markdown: string;
  style: Record<string, unknown>;
  provider: string;
  model: string;
};

export default function DocFlowPage() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<"pdf" | "docx" | null>(null);
  const [htmlPreview, setHtmlPreview] = useState<string>("");
  const [htmlCss, setHtmlCss] = useState<string>("");
  const htmlEditorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [outputUrl]);

  useEffect(() => {
    // Invalidate previous generated file when target format changes.
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
      setOutputName(null);
      setOutputFormat(null);
      setHtmlPreview("");
      setHtmlCss("");
      setInfo("Format modifié. Cliquez sur “Prévisualiser” pour régénérer.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  async function getToken() {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return null;
    }
    return data.session.access_token;
  }

  async function handlePreview() {
    setError(null);
    setInfo(null);
    setPreview(null);
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
      setOutputName(null);
      setOutputFormat(null);
    }
    if (!rawText.trim()) {
      setError("Ajoutez un texte brut.");
      return;
    }
    setLoadingPreview(true);
    const token = await getToken();
    if (!token) return;

    const res = await fetch("/api/docflow/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ rawText })
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Erreur pendant l'analyse IA");
      setLoadingPreview(false);
      return;
    }

    setPreview(payload as PreviewPayload);
    setInfo("Analyse prête. Vous pouvez maintenant prévisualiser le document.");
    setLoadingPreview(false);
  }

  async function handleGeneratePreview() {
    if (!preview) {
      setError("Analysez d'abord le texte.");
      return;
    }
    setLoadingGenerate(true);
    setError(null);
    setInfo("Génération en cours...");
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch("/api/docflow/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          markdown: preview.markdown,
          docType: preview.docType,
          style: preview.style,
          format
        })
      });
      if (!res.ok) {
        const text = await res.text();
        try {
          const payload = JSON.parse(text);
          setError(payload.error || "Erreur de génération");
        } catch {
          setError(text || "Erreur de génération");
        }
        return;
      }

      const blob = await res.blob();
      const contentType = res.headers.get("content-type") || "";
      const detectedFormat: "pdf" | "docx" =
        contentType.includes("application/pdf") ? "pdf" : "docx";
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
      const url = URL.createObjectURL(blob);
      const name = `${preview.docType.toLowerCase()}-${Date.now()}.${detectedFormat}`;
      setOutputUrl(url);
      setOutputName(name);
      setOutputFormat(detectedFormat);
      if (detectedFormat === "pdf") {
        setHtmlPreview("");
        setHtmlCss("");
        setInfo("Prévisualisation PDF prête.");
      } else {
        const htmlRes = await fetch("/api/docflow/html", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            markdown: preview.markdown,
            docType: preview.docType,
            style: preview.style
          })
        });
        const htmlPayload = await htmlRes.json();
        if (!htmlRes.ok) {
          setError(htmlPayload.error || "DOCX prêt, mais aperçu HTML indisponible.");
          setHtmlPreview("");
          setHtmlCss("");
        } else {
          setHtmlPreview(String(htmlPayload.html || ""));
          setHtmlCss(String(htmlPayload.css || ""));
          setInfo("Aperçu HTML prêt. Vous pouvez éditer la mise en forme.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue");
    } finally {
      setLoadingGenerate(false);
    }
  }

  function applyFormat(command: string, value?: string) {
    const editor = htmlEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, value);
    setHtmlPreview(editor.innerHTML);
  }

  function handleDownload() {
    if (!outputUrl || !outputName) return;
    const a = document.createElement("a");
    a.href = outputUrl;
    a.download = outputName;
    a.click();
  }

  function handlePrintHtml() {
    if (!htmlPreview) return;
    setError(null);
    const css = `
      ${htmlCss}
      @page { margin: 2cm; }
      body { background: #fff; }
    `;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
      setError("Impossible de préparer l'impression.");
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Export</title><style>${css}</style></head><body>${htmlPreview}</body></html>`
    );
    doc.close();

    const triggerPrint = () => {
      const win = iframe.contentWindow;
      if (!win) {
        setError("Impossible d'ouvrir l'impression.");
        document.body.removeChild(iframe);
        return;
      }
      win.focus();
      win.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    };

    setTimeout(triggerPrint, 150);
  }

  return (
    <main className="module">
      <header className="module-header">
        <div>
          <h1>DocFlow IA</h1>
          <p>Texte brut → classification → Markdown → PDF/DOCX (Pandoc)</p>
        </div>
        <div className="module-actions">
          <button className="ghost" onClick={() => router.push("/app")}>Retour</button>
        </div>
      </header>

      <section className="module-grid">
        <section className="module-card">
          <h2>Entrée</h2>
          <label>
            Texte brut
            <textarea
              rows={14}
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="Collez votre texte ici..."
            />
          </label>
          <div className="module-actions">
            <button className="cta" onClick={handlePreview} disabled={loadingPreview}>
              {loadingPreview ? "Analyse..." : "Analyser avec le backoffice"}
            </button>
          </div>
        </section>

        <aside className="module-panel">
          <h2>Résultat IA</h2>
          {!preview && <p>Aucun résultat pour le moment.</p>}
          {preview && (
            <>
              <p><strong>Type:</strong> {preview.docType}</p>
              <p><strong>Modèle:</strong> {preview.provider} / {preview.model}</p>
              <label>
                Markdown structuré
                <textarea rows={12} value={preview.markdown} readOnly />
              </label>
              <label>
                Format de sortie
                <select value={format} onChange={(event) => setFormat(event.target.value as "pdf" | "docx")}>
                  <option value="pdf">PDF</option>
                  <option value="docx">DOCX</option>
                </select>
              </label>
              <button className="cta" onClick={handleGeneratePreview} disabled={loadingGenerate}>
                {loadingGenerate ? "Préparation..." : "Prévisualiser"}
              </button>
              {outputUrl && (
                <button className="ghost" onClick={handleDownload}>
                  Télécharger
                </button>
              )}
              {outputFormat === "docx" && htmlPreview && (
                <button className="ghost" onClick={handlePrintHtml}>
                  Exporter PDF (impression)
                </button>
              )}
            </>
          )}
          {error && <p className="error">{error}</p>}
          {info && <p className="success">{info}</p>}
        </aside>
      </section>
      {outputUrl && outputFormat === "pdf" && (
        <section className="module-card">
          <h2>Aperçu PDF</h2>
          <iframe
            title="Aperçu PDF"
            src={outputUrl}
            style={{ width: "100%", minHeight: 820, border: "1px solid #ead7d0", borderRadius: 12 }}
          />
        </section>
      )}
      {outputUrl && outputFormat === "docx" && (
        <section className="module-card">
          <h2>Aperçu HTML (DOCX)</h2>
          <div className="module-actions">
            <button className="ghost" type="button" onClick={() => applyFormat("bold")}>Gras</button>
            <button className="ghost" type="button" onClick={() => applyFormat("italic")}>Italique</button>
            <button className="ghost" type="button" onClick={() => applyFormat("underline")}>Souligné</button>
            <button className="ghost" type="button" onClick={() => applyFormat("formatBlock", "H1")}>Titre 1</button>
            <button className="ghost" type="button" onClick={() => applyFormat("formatBlock", "H2")}>Titre 2</button>
            <button className="ghost" type="button" onClick={() => applyFormat("formatBlock", "P")}>Paragraphe</button>
            <button className="ghost" type="button" onClick={() => applyFormat("insertUnorderedList")}>Liste</button>
            <button className="ghost" type="button" onClick={() => applyFormat("removeFormat")}>Nettoyer</button>
          </div>
          <div
            ref={htmlEditorRef}
            contentEditable
            suppressContentEditableWarning
            className="module-card"
            style={{ minHeight: 520, border: "1px solid #ead7d0", borderRadius: 12, background: "#fff" }}
            onInput={(event) => setHtmlPreview((event.target as HTMLDivElement).innerHTML)}
            dangerouslySetInnerHTML={{ __html: htmlPreview || "<p>(Aucun aperçu HTML)</p>" }}
          />
        </section>
      )}
    </main>
  );
}
