# SOC 2 Type II Compliance Framework

## Overview

Drift AI is designed to meet SOC 2 Type II trust service criteria for financial services SaaS platforms. This document outlines the controls, policies, and technical implementations that support our compliance posture.

## Trust Service Criteria

### 1. Security (Common Criteria)

#### CC6.1 — Logical and Physical Access Controls
- **Authentication**: Multi-factor authentication (MFA) required for all users
- **SSO**: SAML 2.0 / OIDC support for enterprise SSO (Okta, Azure AD, Google)
- **Session Management**: Encrypted session tokens with configurable expiry
- **IP Allowlisting**: Per-organization CIDR-based IP restrictions
- **API Keys**: SHA-256 hashed storage, never stored plaintext, HMAC-signed webhooks
- **Rate Limiting**: Per-user, per-IP, and per-API-key rate limits

#### CC6.2 — Authentication and Authorization
- **Role-Based Access Control**: ADMIN, SENIOR_ADVISOR, ADVISOR, COMPLIANCE_OFFICER, ANALYST, READ_ONLY
- **API Permissions**: Granular read/write permissions per API key
- **Approval Workflows**: Communications require compliance officer approval before sending
- **MFA**: TOTP-based MFA with recovery codes

#### CC6.3 — Data Encryption
- **In Transit**: TLS 1.3 enforced on all endpoints
- **At Rest**: PostgreSQL with encryption enabled (configurable per org)
- **Sensitive Fields**: API keys stored as SHA-256 hashes; secrets encrypted at application layer
- **Webhook Secrets**: HMAC-SHA256 for payload signing

#### CC7.1 — System Monitoring
- **Immutable Audit Log**: Tamper-evident hash chain (AuditEvent model)
- **AI Usage Tracking**: Per-call token counts, costs, latency, success/failure
- **Compliance Scanning**: NLP-based detection with deterministic + AI-assisted rules
- **Supervisory Reports**: Automated 30-day compliance summaries

### 2. Availability

#### A1.2 — System Backups
- **Database**: PostgreSQL with automated daily backups (via hosting provider)
- **Point-in-Time Recovery**: Enabled via PostgreSQL WAL archiving
- **RPO**: < 1 hour; **RTO**: < 4 hours

### 3. Processing Integrity

#### PI1.2 — Data Validation
- **Structured AI Outputs**: Tool_use-based JSON extraction (no regex parsing)
- **Explainable AI**: Every AI output includes reasoning trace and data lineage
- **Before/After Snapshots**: AuditLog captures state changes for all mutations
- **Compliance Rules**: Per-firm configurable with auto-escalation

### 4. Confidentiality

#### C1.2 — Data Classification and Handling
- **Data Isolation**: Multi-tenant with organization-level data isolation
- **Soft Deletes**: Critical entities use soft deletes to preserve audit trail
- **Data Retention**: Configurable per-org (default 7 years per SEC Rule 17a-4)
- **Immutable Records**: AuditEvent model is append-only with Restrict on delete

### 5. Privacy

#### P1.2 — Personal Data Handling
- **PII Fields**: Email, phone, name stored with access controls
- **Data Minimization**: AI prompts include only necessary client data
- **Right to Deletion**: Soft delete with configurable retention period
- **Consent Tracking**: Via IntelligenceProfile and Communication records

## Audit Trail Architecture

### Dual-Layer Audit System

1. **AuditLog** (Operational) — Mutable, queryable, supports dashboard views
2. **AuditEvent** (Regulatory) — Immutable, tamper-evident, hash-chained

### Hash Chain Integrity

Each AuditEvent includes:
- `eventHash`: SHA-256 of the event payload
- `previousHash`: Links to the prior event, forming a chain
- `organizationId` scope: Each org has its own chain

Verification: `AuditEventService.verifyChain()` detects any tampering by recomputing hashes.

## Regulatory Compliance

| Regulation | Implementation | Status |
|---|---|---|
| SEC Rule 17a-4 | Immutable audit events, 7-year retention | ✅ Implemented |
| FINRA Rule 4511 | Electronic record retention | ✅ Implemented |
| SEC Reg BI | Disclosure checks, recommendation flagging | ✅ Implemented |
| SEC Advertising Rule 206(4)-1 | Performance claim detection, testimonial flagging | ✅ Implemented |
| FINRA Rule 2210 | Risky wording detection (NLP + deterministic) | ✅ Implemented |
| FINRA Rule 2111 | Suitability violation detection | ✅ Implemented |
| SEC IA Act §206 | Anti-fraud language detection | ✅ Implemented |

## Incident Response

1. **Detection**: Compliance flags auto-generated on violation detection
2. **Escalation**: Auto-escalation to compliance officer for HIGH/CRITICAL flags
3. **Notification**: Real-time SSE push to compliance officers
4. **Documentation**: All actions recorded in immutable audit ledger
5. **Resolution**: ComplianceFlag lifecycle: OPEN → UNDER_REVIEW → RESOLVED/DISMISSED

## Vendor Security

| Vendor | Purpose | SOC 2 | Data Access |
|---|---|---|---|
| Anthropic | AI model inference | Yes | Prompt data (no training) |
| Stripe | Payment processing | Yes | Billing data only |
| PostgreSQL (hosted) | Database | Yes | All application data |
| Vercel/AWS | Application hosting | Yes | Application runtime |

## Next Steps for SOC 2 Audit

- [ ] Engage SOC 2 auditor (recommended: Johanson Group, Linford & Co)
- [ ] Complete security questionnaire for all vendors
- [ ] Implement infrastructure monitoring (Datadog/New Relic)
- [ ] Add vulnerability scanning (Snyk, Dependabot)
- [ ] Document employee onboarding/offboarding procedures
- [ ] Establish change management process
- [ ] Create incident response playbook
- [ ] Schedule annual penetration test
