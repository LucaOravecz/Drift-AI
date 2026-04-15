# PRODUCTION READINESS CHECKLIST

## Infrastructure (Pre-Launch)
- [ ] PostgreSQL provisioned (Neon or self-hosted)
- [ ] Vercel project created and connected
- [ ] Inngest account configured
- [ ] Sentry project created
- [ ] All backups automated

## Secrets & Configuration
- [ ] .env.production.local filled with all values
- [ ] Vercel environment variables configured
- [ ] Database migrations: npx prisma migrate deploy
- [ ] Test all integrations in staging first
- [ ] Secrets rotated and documented

## Security Hardening
- [ ] HTTPS enforced (HSTS headers added)
- [ ] All API routes authenticated
- [ ] Rate limiting enabled (5 attempts / 15 min)
- [ ] MFA secrets encrypted at rest ✅
- [ ] Audit logging enabled ✅
- [ ] Data encrypted in transit (TLS)

## Observability & Monitoring
- [ ] Sentry configured for error tracking
- [ ] Structured logging setup
- [ ] Web Vitals monitoring enabled
- [ ] Database query monitoring
- [ ] Uptime monitoring configured

## Data Integrity
- [ ] Database backups tested and working
- [ ] Tenant isolation verified
- [ ] Financial calculations audited
- [ ] Timezone handling standardized to UTC

## Testing & QA
- [ ] Sign-in flow tested end-to-end
- [ ] Dashboard loads without errors
- [ ] Create/edit/delete client works
- [ ] AI service calls complete successfully
- [ ] Custodian sync tested with real OAuth

## Operations
- [ ] Runbooks created (incident response procedures)
- [ ] Team trained on monitoring and escalation
- [ ] Incident response plan reviewed
- [ ] Rollback procedure tested

## Launch Day Checklist
- [ ] Final staging smoke tests pass
- [ ] Team online and ready
- [ ] Slack incident channel ready
- [ ] Monitor Sentry for errors (first 5 min)
- [ ] Monitor latency and error rate
- [ ] Check backup completion

## Monitoring (First Week)
- [ ] Error rate < 0.1% ✅
- [ ] API latency p99 < 500ms ✅
- [ ] Database connections healthy ✅
- [ ] All AI calls completing ✅
- [ ] Stripe webhooks processed ✅
- [ ] Custodian syncs running ✅

## Critical Verification Queries
```sql
-- Data integrity
SELECT COUNT(*) FROM holdings WHERE symbol IS NULL;
-- Should return 0

-- Tenant isolation (query as admin)
SELECT COUNT(*) FROM clients WHERE organization_id = 'org1' 
AND organization_id != (SELECT organization_id FROM users WHERE id = $user_id);
-- Should return 0

-- MFA encryption
SELECT COUNT(*) FROM users WHERE mfa_secret IS NOT NULL 
AND mfa_secret NOT LIKE '%:%:%';
-- Should return 0 (all encrypted)
```

## Monthly Operations
- [ ] Review error logs for patterns
- [ ] Rotate secrets
- [ ] Analyze costs
- [ ] Database maintenance (VACUUM ANALYZE)
- [ ] Performance optimization review
