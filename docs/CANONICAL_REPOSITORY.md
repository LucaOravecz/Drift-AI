# Canonical repository

**Source of truth for Drift AI development:**  
`/Users/lucaoravecz/Desktop/Drift Ai/drift-ai`

That tree includes:

- PostgreSQL Prisma schema and baseline migrations  
- Hardened API RBAC, optional Upstash rate limiting, health probe  
- Docker Compose Postgres for local and CI-style runs  
- `npm run ops:bootstrap` — Postgres up → migrate → seed  

Other folders (e.g. `~/Drift-AI`, iCloud copies) should be treated as **archives** unless you explicitly merge them into the canonical path. Working from multiple roots causes migration, env, and Stripe divergence.
