# Drift AI

**Canonical codebase:** this folder (`Desktop/Drift Ai/drift-ai`). Do not parallel-develop stale copies under `~/Drift-AI` or iCloud—see [`docs/CANONICAL_REPOSITORY.md`](docs/CANONICAL_REPOSITORY.md).

Drift AI is a Next.js application for financial advisory teams. It combines a CRM-style client workspace with AI-assisted tools for meeting prep, compliance review, tax workflows, document intelligence, onboarding, billing, integrations, and internal operations.

## Ops and go-to-market docs

| Doc | Purpose |
|-----|---------|
| [`docs/CUSTODIAN_SCHWAB_FIRST.md`](docs/CUSTODIAN_SCHWAB_FIRST.md) | Ship one custodian to depth first |
| [`docs/PILOT_AGREEMENT_TEMPLATE.md`](docs/PILOT_AGREEMENT_TEMPLATE.md) | Pilot contract skeleton (counsel to review) |
| [`docs/COMPLIANCE_AI_POSITIONING.md`](docs/COMPLIANCE_AI_POSITIONING.md) | CCO-facing AI + review story |
| [`docs/SOC2_TYPE1_CHECKLIST.md`](docs/SOC2_TYPE1_CHECKLIST.md) | SOC 2 prep starter checklist |
| [`docs/CASE_STUDY_TEMPLATE.md`](docs/CASE_STUDY_TEMPLATE.md) | Quantified pilot → marketing case study |

## Health check

`GET /api/health` returns JSON with database connectivity for monitors (no auth).

## Admin & compliance endpoints

- `GET/PATCH /api/admin/organization/settings` — firm operational flags (AI on/off, read-only mode, custodian sync drift threshold); requires session with `USER_MANAGE`.
- `GET /api/v1/admin/clients/:id/export` — JSON export bundle for portability; requires `USER_MANAGE`.
- `/subprocessors` — public illustrative subprocessor categories page (curate for your DPA).

## What the app includes

- Authenticated advisor workspace with role-aware navigation
- Client records, household data, opportunities, meetings, documents, and communications
- AI-assisted copilot and intelligence workflows grounded in stored firm data
- Compliance, audit, tax, onboarding, billing, and integration surfaces
- Prisma-backed persistence and seeded demo data for local development

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Prisma
- Vitest
- Playwright
- Tailwind CSS

## Local development

1. Install dependencies.
2. Copy `.env.example` into `.env.local` and adjust values if needed.
3. Start a local Postgres instance for reliable development and smoke testing.
4. Run the Prisma workflow your environment needs.
5. Start the dev server.

```bash
npm run ops:bootstrap
```

Or step by step:

```bash
npm run db:start
npm run db:migrate:local
npm run db:seed:local
```

```bash
npm run dev
```

Set `DEMO_MODE=true` in `.env.local` when you want a client-safe walkthrough environment that locks sync/import and approval actions.

When you are done with local Postgres:

```bash
npm run db:stop
```

## Validation

The repo currently passes these local checks:

```bash
npm test
npm run lint -- --quiet
npx tsc --noEmit
```

For browser-level smoke coverage against the local database:

```bash
npm run test:e2e:local
```

## Notes

- The app expects a reachable Postgres database for full runtime behavior.
- The local Docker Compose database is the most reliable path for demos and Playwright runs.
- Some AI and market-data features depend on external provider credentials.
- The project root previously had stale status docs; prefer the code and the commands above as the current source of truth.
