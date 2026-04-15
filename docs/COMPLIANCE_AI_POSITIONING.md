# Compliance and AI — positioning for RIAs and CCOs

## What the product does

- **Deterministic rules** (keywords, regex) plus optional **LLM-assisted** scans on advisor and client-facing text.  
- **Per-firm rules** stored in the database can extend the library.  
- **Post-meeting follow-up drafts** receive a **pre-screen** (deterministic + firm rules); summary is stored on the communication record for reviewers.  
- **High / critical** hits can create **compliance flags** for workflow (see `ComplianceNLPService.fullScan`).

## What the product does *not* do

- It is **not** a substitute for your chief compliance officer, outside counsel, or FINRA/SEC filing obligations.  
- It does **not** guarantee that any email or document is “compliant” if sent.  
- **AI can miss violations** and **false positives** occur; human review remains the control.

## Operating model (recommended)

1. **All outbound client communications** stay in `PENDING_APPROVAL` until a licensed/authorized reviewer approves.  
2. **CCO** defines which severities block send vs. informational-only.  
3. **Audit trail:** rely on `AuditEvent` / `AuditLog` for who approved what and when.  
4. **Retaining prompts and model versions** for serious incidents is a separate operational policy (logging today captures usage records in `AiUsageRecord`).

## Talking points for the pilot’s CCO

- “We treat Drift as **decision support** and **workflow**; approvals stay with the firm.”  
- “We log access and key actions for **books and records** style review.”  
- “We can **disable** NLP and run deterministic-only during evaluation if preferred.”

Update this document as your actual policies and counsel guidance evolve.
