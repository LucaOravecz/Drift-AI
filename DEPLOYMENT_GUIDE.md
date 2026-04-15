# DEPLOYMENT GUIDE

## Quick Start
```bash
# 1. Set up database (Neon recommended)
# 2. Copy .env.production.example → .env.production.local
# 3. Fill in all secrets
# 4. Run: npx prisma migrate deploy
# 5. Deploy: git push origin main (Vercel auto-deploys)
```

## Step-by-Step

### Database Setup (Neon)
```bash
# 1. Sign up: https://console.neon.tech
# 2. Create project
# 3. Copy connection string
# Add to .env.production.local:
DATABASE_URL=postgresql://user:password@host/dbname
DIRECT_URL=postgresql://user:password@host/dbname?sslmode=require
```

### Environment Variables
```bash
# Copy template
cp .env.production.example .env.production.local

# Edit with your secrets
nano .env.production.local

# Minimum required:
# - DATABASE_URL
# - ANTHROPIC_API_KEY
# - All OAuth credentials (Schwab, Fidelity)
# - All security secrets (SESSION_SECRET, JWT_SECRET, MFA_ENCRYPTION_KEY, CRON_SECRET)
```

### Deploy to Vercel
```bash
# 1. Connect repo to Vercel (vercel.com)
# 2. Add environment variables to Vercel dashboard
# 3. Deploy: git push origin main
# Auto-deploys to production on merge to main
```

### Database Migrations
```bash
# Run locally (before pushing)
DATABASE_URL=postgresql://... npx prisma migrate deploy

# Or Vercel runs automatically during build
npx tsc --noEmit  # Check for errors first
```

### Configure Webhooks
- Stripe: https://your-domain.com/api/stripe/webhook
- Custodian OAuth: https://your-domain.com/api/v1/integrations/custodian/auth

### Verify Deployment
```bash
# Build succeeds
npm run build

# No TypeScript errors
npx tsc --noEmit

# Database connected
DATABASE_URL=postgresql://... psql -c "SELECT 1"

# All routes accessible
curl -X GET https://your-domain.com/api/v1/integrations/custodian/status
```

## Troubleshooting

**Build fails**: `rm -rf node_modules .next && npm install && npm run build`

**Database connection error**: Verify credentials, check firewall, test with psql

**Migrations fail**: `git revert HEAD && git push` to rollback

**Stripe webhooks not received**: Verify URL is HTTPS, check `STRIPE_WEBHOOK_SECRET`

## Rollback
```bash
# Option 1: Revert code
git revert HEAD
git push origin main

# Option 2: Use Vercel dashboard
# Deployments → Click "Rollback" on previous build

# Option 3: Restore database
# Neon dashboard → Restore from backup
```

## Monitoring Post-Deploy
- First 5 min: Watch Sentry, check latency
- First hour: Monitor error rate (target: < 0.1%)
- First 24 hours: Check Stripe, custodian sync

See PRODUCTION_CHECKLIST.md for detailed monitoring
