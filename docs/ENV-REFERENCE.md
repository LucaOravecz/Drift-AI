# Environment Variables Reference

## Required (Production)

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (pooled) | `postgresql://user:pass@host:5432/drift_ai?pgbouncer=true` |
| `DIRECT_URL` | PostgreSQL direct connection (for migrations) | `postgresql://user:pass@host:5432/drift_ai` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | `sk-ant-...` |
| `NEXTAUTH_SECRET` | Session encryption key | `openssl rand -base64 32` |
| `CRON_SECRET` | Secret for cron endpoint authentication | `openssl rand -base64 32` |

## Optional (Integrations)

| Variable | Description | Example |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe API key for billing | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `STRIPE_STARTER_PRICE_ID` | Stripe price ID for Starter plan | `price_...` |
| `STRIPE_PROFESSIONAL_PRICE_ID` | Stripe price ID for Professional plan | `price_...` |
| `STRIPE_ENTERPRISE_PRICE_ID` | Stripe price ID for Enterprise plan | `price_...` |
| `NEXTAUTH_URL` | Base URL for auth callbacks | `https://app.drift.ai` |
| `RESEND_API_KEY` | Resend API key for transactional email | `re_...` |
| `EMAIL_FROM_ADDRESS` | Default sender address for outbound email | `Drift AI <noreply@drift-ai.com>` |
| `NEXT_PUBLIC_APP_URL` | Public app URL for email links | `https://app.drift.ai` |

## Development

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Local PostgreSQL | `postgresql://postgres:postgres@localhost:5432/drift_ai_dev` |
| `DIRECT_URL` | Local PostgreSQL (direct) | `postgresql://postgres:postgres@localhost:5432/drift_ai_dev` |
| `ANTHROPIC_API_KEY` | Dev API key | `sk-ant-api03-...` |

## Setting Up Local Development

1. Install PostgreSQL (or use Docker):
   ```bash
   docker run -d --name drift-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=drift_ai_dev -p 5432:5432 postgres:16
   ```

2. Copy env values and set them in `.env.local`:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/drift_ai_dev"
   DIRECT_URL="postgresql://postgres:postgres@localhost:5432/drift_ai_dev"
   ANTHROPIC_API_KEY="your-key-here"
   NEXTAUTH_SECRET="any-random-string-for-dev"
   CRON_SECRET="any-random-string-for-dev"
   ```

3. Run migrations:
   ```bash
   npm run db:migrate
   ```

4. Seed the database:
   ```bash
   npm run db:seed
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```
