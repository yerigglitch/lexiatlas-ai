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
- Email v2 workflow (drafts/templates/events) is behind `FEATURE_EMAIL_V2=true`.
- Legacy endpoints `/api/email/send` and `/api/email/logs` are deprecated and kept for compatibility.

## Feature Flags
- `FEATURE_DOCFLOW`: enable `/app/docflow` and `/api/docflow/*`.
- `FEATURE_EMAIL_V2`: enable new email APIs/flows.
- `FEATURE_APP_LITE`: enable `/app-lite`.
- `FEATURE_RSS`: enable `/api/rss`.
- `FEATURE_OAUTH_ADVANCED`: enable OAuth provider connect callbacks.

## Repository Hygiene
- Runtime API now uses App Router routes under `src/app/api/*` only.
- `examples/`, `templates/`, and `scripts/` are dev tooling assets.
- `legacy-landing/` is archived legacy material (not used by runtime routes).

## Linear Sync (Optional)
- Add `LINEAR_API_TOKEN` in `.env.local`.
- Optional filters: `LINEAR_TEAM_KEY`, `LINEAR_ASSIGNEE_EMAIL`, `LINEAR_PROJECT_ID`, `LINEAR_STATES`.
- Run `npm run linear:sync`.
- Output is generated in `tasks/linear.md` (configurable with `LINEAR_SYNC_OUTPUT`).

### Linear Triage
- Dry run onboarding cleanup: `npm run linear:triage`
- Apply onboarding cleanup (`YER-1..5` to terminal state): `npm run linear:triage -- --apply`
- Custom IDs: `npm run linear:triage -- --apply --ids=YER-1,YER-2`
