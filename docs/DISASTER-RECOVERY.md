# Multi-Region Disaster Recovery Configuration

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   CDN / Edge                     │
│            (Cloudflare / Vercel Edge)            │
└──────────┬──────────────────┬────────────────────┘
           │                  │
    ┌──────▼──────┐   ┌──────▼──────┐
    │  Primary    │   │  Standby    │
    │  us-east-1  │   │  us-west-2  │
    │  (Active)   │   │  (Passive)  │
    ├─────────────┤   ├─────────────┤
    │ Next.js App │   │ Next.js App │
    │ PostgreSQL  │   │ PostgreSQL  │
    │   Primary   │──▶│   Replica   │
    │ Redis Cache │   │ Redis Cache │
    └─────────────┘   └─────────────┘
```

## RPO / RTO Targets

| Metric | Target | Mechanism |
|---|---|---|
| **RPO** (data loss) | < 1 hour | PostgreSQL WAL streaming replication |
| **RTO** (recovery time) | < 15 minutes | Automated DNS failover + pre-warmed standby |
| **Availability SLA** | 99.95% | Multi-AZ + multi-region |

## PostgreSQL Replication

### Primary → Standby Configuration

```sql
-- On primary (us-east-1)
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET max_wal_senders = 3;
ALTER SYSTEM SET wal_keep_size = '1GB';
```

```bash
# On standby (us-west-2)
pg_basebackup -h primary-host -U replication -D /var/lib/postgresql/data -Fp -Xs -P -R
```

### Failover Procedure

1. **Automatic Detection**: Health check every 30s from monitoring
2. **Promotion**: `pg_ctl promote` on standby
3. **DNS Update**: Route53 health check auto-failover
4. **Application Redeploy**: Vercel automatically routes to healthy region
5. **Verification**: Automated smoke tests post-failover

## Backup Strategy

| Backup Type | Frequency | Retention | Storage |
|---|---|---|---|
| Full database dump | Daily at 02:00 UTC | 30 days | S3 (cross-region) |
| WAL archive | Continuous | 7 days | S3 (cross-region) |
| Point-in-time recovery | Every 1 hour | 7 days | Built-in (PG) |
| Application config | On change | 90 days | Git + S3 |

## Automated Backup Verification

```bash
# Run weekly: restore latest backup to test instance and verify
pg_restore --clean --if-exists -d drift_test latest_backup.dump
psql -d drift_test -c "SELECT count(*) FROM clients;"
```

## Runbook: Regional Failover

### Step 1: Detect Failure (Automated)
- Health check fails for 3 consecutive checks (90s)
- Alert sent to on-call via PagerDuty

### Step 2: Promote Standby (Automated)
- Standby PostgreSQL promoted to primary
- DNS TTL set to 60s for rapid propagation

### Step 3: Verify (Manual within 5 min)
- Check application health endpoint
- Verify database connectivity
- Confirm data freshness (latest audit event timestamp)

### Step 4: Communicate
- Status page updated
- Client notification via SSE if applicable

### Step 5: Remediate Primary
- Diagnose root cause
- Rebuild primary if needed
- Re-establish replication from new primary

## Monitoring & Alerting

| Check | Interval | Threshold | Alert |
|---|---|---|---|
| DB replication lag | 30s | > 60s | P2: PagerDuty |
| Application health | 30s | 3 failures | P1: PagerDuty + SMS |
| Disk usage | 5 min | > 80% | P3: Slack |
| Connection pool | 30s | > 90% utilized | P2: PagerDuty |
| Backup completion | Daily | Not completed by 03:00 | P2: PagerDuty |

## Environment Variables for DR

```env
# Primary
DATABASE_URL=postgresql://user:pass@primary-host:5432/drift_ai?pgbouncer=true
DIRECT_URL=postgresql://user:pass@primary-host:5432/drift_ai

# Standby (read-only until failover)
STANDBY_DATABASE_URL=postgresql://user:pass@standby-host:5432/drift_ai?readonly=true

# Failover
FAILOVER_MODE=AUTO  # AUTO | MANUAL
HEALTH_CHECK_URL=https://api.drift.ai/health
```
