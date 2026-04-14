# Drift AI Deployment Checklist

## Core release gates

- `npm test`
- `npm run lint -- --quiet`
- `npx tsc --noEmit`
- `npm run build`

## Environment variables

Required for baseline app runtime:

- `DATABASE_URL`
- `DIRECT_URL`
- `CLIENT_PORTAL_ACCESS_CODE_HASH`

Required for production URLs / integration wiring:

- `APP_BASE_URL`
- `EMAIL_DELIVERY_WEBHOOK_URL`
- `CALENDAR_SYNC_WEBHOOK_URL`

Required for AI-backed features:

- `OPENROUTER_API_KEY`

Required for billing / Stripe:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Infrastructure dependencies

- PostgreSQL reachable from the app runtime
- Persistent file storage for uploaded documents
  Current upload route stores metadata and parses content, but production should move file blobs to S3, R2, or GCS
- Outbound webhook receiver for email delivery
- Outbound webhook receiver for calendar sync

## Security checks

- Confirm session cookies are `secure` in production
- Confirm API-key permissions are scoped correctly
- Confirm document upload auth and tenant scoping are enforced
- Confirm MFA enrollment and disable flows work in the deployed environment
- Confirm audit-event and audit-log tables are writable

## Product smoke tests

- Sign in as admin
- Open dashboard, clients, agents, integrations, compliance, meetings, documents, proposals, billing, settings
- Search for a seeded client and open client detail
- Export ROI PDF
- Generate an IPS proposal for one client
- Run fee calculation for one client
- Verify `/api/clients`, `/api/v1/clients`, `/api/v1/proposals/ips`, and `/api/v1/dashboard/roi-report`

## Known externalization work

- Email send is integration-dependent
- Calendar sync is integration-dependent
- Stripe monetization is partially wired but still needs production activation
- Some connector surfaces remain configuration- or roadmap-dependent

## Current blocker to resolve before full release confidence

- Production `next start` browser validation is still inconsistent in Chromium for some authenticated routes.
- Observed server-side error:
  `Invariant: The client reference manifest for route "/account" does not exist. This is a bug in Next.js.`
- This looks like a framework/runtime issue rather than a basic TypeScript or lint problem, and it should be retested in the target deployment environment.
