# SOC 2 Type I — practical checklist (starter)

Use with a compliance automation vendor (e.g. Vanta, Drata) and your auditor. This is **not** an audit program—just engineering prep aligned with common Trust Services Criteria.

## CC (Common Criteria / Security)

- [ ] **Access control:** RBAC enforced in app and API; session management documented.  
- [ ] **Vendor inventory:** cloud host, DB, Stripe, Sentry, Upstash, email, LLM provider.  
- [ ] **Change management:** PR reviews, protected `main`, tagged releases.  
- [ ] **Vulnerability management:** Dependabot or equivalent; patch SLAs documented.  
- [ ] **Logging & monitoring:** production errors tracked; critical actions audited.

## A1 (Availability) — if in scope

- [ ] **Backups:** Postgres automated backups; tested restore.  
- [ ] **Uptime expectations:** documented for customers (even if “best effort” initially).

## C1 (Confidentiality)

- [ ] **Encryption in transit:** TLS everywhere.  
- [ ] **Encryption at rest:** database and object storage as applicable.  
- [ ] **Secrets:** no keys in repo; rotation policy.

## PI (Privacy) — if in scope

- [ ] **Data map:** categories of PII, where stored, retention.  
- [ ] **DPA templates** with subprocessors (LLM, email, analytics).

## What to do first

1. Pick **in-scope** services (often: production app + DB + auth).  
2. Run a **readiness gap** with your vendor’s questionnaire.  
3. Freeze “**policies**” (access, incident response, SDLC) even if lightweight—auditors read policies.

When ready, engage a CPA firm for SOC 2 Type I **readiness** then examination.
