# LexiAtlas AI MVP

## Setup
1. Copy `.env.example` to `.env.local` and fill values.
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`

## Notes
- We use Supabase (Postgres + pgvector + Auth + Storage).
- Users can bring their own Mistral API key; a fallback server key is optional.
- Use `/app/settings` to register the key (stored encrypted).
- PDF fidelity requires the local LibreOffice converter (`docker-compose up pdf-converter`)
- OCR fallback requires the local OCR service (`docker-compose up ocr-service`)
- RAG pipeline will ingest internal sources and query official datasets.
