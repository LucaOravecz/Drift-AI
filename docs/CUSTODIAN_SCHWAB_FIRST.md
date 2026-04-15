# Custodian strategy: Schwab first

## Decision

Ship **one** custodian integration to production quality before adding others.

**Primary:** Schwab Advisor Services APIs (org already models `SCHWAB` in `IntegrationConfig`).

## Definition of done

1. OAuth token lifecycle (refresh, revoke, error surfacing) is tested in a **non-prod** Schwab developer environment.  
2. **Positions and cash** sync on a schedule plus manual sync; advisor sees last sync time and errors.  
3. **Reconciliation:** a daily or weekly report: Drift positions vs. custodian statement totals above a materiality threshold.  
4. **No silent failure:** if sync fails, UI and notifications say so; audit event recorded.  
5. Fidelity / Pershing remain **roadmap**, not parallel P0 work.

## Why one first

Split engineering across custodians → shallow integrations advisors cannot trust. Depth on Schwab → credible demo to Schwab-custodied RIAs and a path to marketplace listing requirements.
