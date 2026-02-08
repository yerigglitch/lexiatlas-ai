import "./globals.css";

export const metadata = {
  title: "LexiAtlas AI | Assistant juridique pour cabinets français",
  description:
    "Le copilote juridique RAG qui respecte vos méthodes de cabinet. Codes, jurisprudence, sources privées et rédaction accélérée."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
