import "server-only";

import prisma from "@/lib/db";
import { AuditEventService } from "./audit-event.service";
import { callClaude, type FeatureRoute } from "./ai.service";

/**
 * NLP-Powered Compliance Scanner
 *
 * Replaces the 6-keyword string-matching approach with:
 * 1. Deterministic pattern matching (expanded keyword + regex library)
 * 2. AI-assisted NLP scanning for context-aware detection
 * 3. Per-firm configurable compliance rules from ComplianceRule table
 * 4. Reg BI and SEC Advertising Rule frameworks
 *
 * Regulatory frameworks covered:
 * - SEC Regulation Best Interest (Reg BI)
 * - SEC Advertising Rule (Rule 206(4)-1)
 * - FINRA Rule 2210 (Communications with the Public)
 * - FINRA Rule 2111 (Suitability)
 * - Investment Advisers Act Section 206 (Anti-Fraud)
 */

// ---------------------------------------------------------------------------
// Deterministic pattern library (expanded from original 6 keywords)
// ---------------------------------------------------------------------------

interface CompliancePattern {
  id: string;
  category: "RISKY_WORDING" | "REG_BI" | "AD_RULE" | "SUITABILITY" | "FIDUCIARY";
  pattern: RegExp;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  regulatoryReference?: string;
}

const DETERMINISTIC_PATTERNS: CompliancePattern[] = [
  // --- Risky Wording (expanded) ---
  {
    id: "risky_guarantee",
    category: "RISKY_WORDING",
    pattern: /\b(guarantee|guaranteed)\b/i,
    description: "Use of 'guarantee' — prohibited under FINRA Rule 2210",
    severity: "HIGH",
    regulatoryReference: "FINRA Rule 2210",
  },
  {
    id: "risky_no_risk",
    category: "RISKY_WORDING",
    pattern: /\b(no\s+risk|risk[- ]?free|without\s+risk|zero\s+risk)\b/i,
    description: "Implies absence of risk — prohibited language",
    severity: "CRITICAL",
    regulatoryReference: "SEC IA Act §206",
  },
  {
    id: "risky_beating",
    category: "RISKY_WORDING",
    pattern: /\b(market[- ]?beating|beat\s+the\s+market|outperform\s+the\s+market)\b/i,
    description: "Performance claim without substantiation",
    severity: "HIGH",
    regulatoryReference: "SEC Advertising Rule 206(4)-1",
  },
  {
    id: "risky_highest_returns",
    category: "RISKY_WORDING",
    pattern: /\b(highest\s+returns|best\s+returns|top\s+returns|maximum\s+returns)\b/i,
    description: "Unsubstantiated performance superiority claim",
    severity: "HIGH",
    regulatoryReference: "FINRA Rule 2210",
  },
  {
    id: "risky_promise",
    category: "RISKY_WORDING",
    pattern: /\b(promise|promised|we\s+promise)\b/i,
    description: "Use of 'promise' — implies guarantee",
    severity: "HIGH",
    regulatoryReference: "FINRA Rule 2210",
  },
  {
    id: "risky_sure_thing",
    category: "RISKY_WORDING",
    pattern: /\b(sure\s+thing|can't\s+lose|cannot\s+lose|safe\s+bet|slam\s+dunk)\b/i,
    description: "Colloquial guarantee language",
    severity: "HIGH",
    regulatoryReference: "SEC IA Act §206",
  },
  {
    id: "risky_always",
    category: "RISKY_WORDING",
    pattern: /\b(always\s+(goes\s+up|increases|performs|wins|profits))\b/i,
    description: "Absolute performance claim",
    severity: "MEDIUM",
    regulatoryReference: "FINRA Rule 2210",
  },
  {
    id: "risky_insider",
    category: "RISKY_WORDING",
    pattern: /\b(insider\s+(tip|information|knowledge|secret))\b/i,
    description: "Reference to insider information",
    severity: "CRITICAL",
    regulatoryReference: "SEC Section 10(b)",
  },
  // --- Reg BI Violations ---
  {
    id: "regbi_recommended_without_basis",
    category: "REG_BI",
    pattern: /\b(I\s+recommend|we\s+recommend|you\s+should\s+(buy|sell|invest\s+in|move\s+into))\b/i,
    description: "Recommendation without documented basis — potential Reg BI violation",
    severity: "HIGH",
    regulatoryReference: "SEC Reg BI §240.15l-1(d)(2)",
  },
  {
    id: "regbi_best_interest_claim",
    category: "REG_BI",
    pattern: /\b(in\s+your\s+best\s+interest|best\s+interest\s+of\s+the\s+client|acting\s+in\s+your\s+interest)\b/i,
    description: "Best interest claim — requires Reg BI disclosure and documentation",
    severity: "MEDIUM",
    regulatoryReference: "SEC Reg BI §240.15l-1(d)(3)",
  },
  // --- SEC Advertising Rule ---
  {
    id: "ad_rule_testimonial",
    category: "AD_RULE",
    pattern: /\b(testimonial|endorsement|client\s+success\s+story|happy\s+client)\b/i,
    description: "Testimonial/endorsement reference — subject to SEC Advertising Rule requirements",
    severity: "MEDIUM",
    regulatoryReference: "SEC Rule 206(4)-1(a)(1)",
  },
  {
    id: "ad_rule_performance_claim",
    category: "AD_RULE",
    pattern: /\b(\d+%\s+(return|gain|profit|yield|performance))\b/i,
    description: "Specific performance claim — requires disclosure and substantiation under Advertising Rule",
    severity: "HIGH",
    regulatoryReference: "SEC Rule 206(4)-1(a)(2)",
  },
  // --- Suitability ---
  {
    id: "suitability_universal",
    category: "SUITABILITY",
    pattern: /\b(right\s+for\s+everyone|anyone\s+can\s+invest|suitable\s+for\s+all|no\s+matter\s+your\s+situation)\b/i,
    description: "Universal suitability claim — violates FINRA Rule 2111",
    severity: "CRITICAL",
    regulatoryReference: "FINRA Rule 2111",
  },
  // --- Fiduciary ---
  {
    id: "fiduciary_omission",
    category: "FIDUCIARY",
    pattern: /\b(no\s+conflict|no\s+conflicts?\s+of\s+interest|we\s+have\s+no\s+conflicts)\b/i,
    description: "Conflict of interest denial — requires verification under fiduciary duty",
    severity: "MEDIUM",
    regulatoryReference: "SEC IA Act §206(2)",
  },
];

// ---------------------------------------------------------------------------
// Scan result types
// ---------------------------------------------------------------------------

export interface ComplianceHit {
  patternId: string;
  category: string;
  matchedText: string;
  description: string;
  severity: string;
  regulatoryReference?: string;
  source: "DETERMINISTIC" | "AI_NLP";
}

export interface ComplianceScanResult {
  isClean: boolean;
  hits: ComplianceHit[];
  riskScore: number; // 0-100
  requiresReview: boolean;
  aiAnalysis?: string;
}

// ---------------------------------------------------------------------------
// Main scanner
// ---------------------------------------------------------------------------

export class ComplianceNLPService {
  /**
   * Run deterministic pattern matching against expanded rule library.
   */
  static deterministicScan(text: string): ComplianceHit[] {
    const hits: ComplianceHit[] = [];

    for (const pattern of DETERMINISTIC_PATTERNS) {
      const match = pattern.pattern.exec(text);
      if (match) {
        hits.push({
          patternId: pattern.id,
          category: pattern.category,
          matchedText: match[0],
          description: pattern.description,
          severity: pattern.severity,
          regulatoryReference: pattern.regulatoryReference,
          source: "DETERMINISTIC",
        });
      }
    }

    return hits;
  }

  /**
   * Run AI-assisted NLP scan for context-aware compliance detection.
   * Only runs if deterministic scan is clean or as a supplementary check.
   */
  static async nlpScan(
    text: string,
    organizationId: string,
    userId?: string,
  ): Promise<{ hits: ComplianceHit[]; analysis: string }> {
    const systemPrompt = `You are a compliance scanning engine for a financial services platform.
Your job is to detect regulatory compliance risks in advisor communications.

Analyze the following text for violations of:
1. SEC Regulation Best Interest (Reg BI) — undocumented recommendations, conflict of interest omissions
2. SEC Advertising Rule (Rule 206(4)-1) — unsubstantiated performance claims, improper testimonials
3. FINRA Rule 2210 — misleading communications with the public
4. FINRA Rule 2111 — suitability violations
5. Investment Advisers Act Section 206 — anti-fraud provisions

Return a JSON object with this exact schema:
{
  "hits": [
    {
      "category": "REG_BI|AD_RULE|RISKY_WORDING|SUITABILITY|FIDUCIARY",
      "matchedText": "the exact text that triggered the flag",
      "description": "why this is a compliance risk",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "regulatoryReference": "the specific rule violated"
    }
  ],
  "analysis": "Overall compliance assessment of the text"
}

If no violations are found, return { "hits": [], "analysis": "Text appears compliant." }
Be conservative — only flag genuine compliance risks, not cautious language.`;

    try {
      const { callClaudeStructured } = await import("./ai.service");
      const result = await callClaudeStructured<{
        hits: Array<{
          category: string;
          matchedText: string;
          description: string;
          severity: string;
          regulatoryReference: string;
        }>;
        analysis: string;
      }>(systemPrompt, text, {
        feature: "COMPLIANCE_SCAN" as FeatureRoute,
        organizationId,
        userId,
        maxTokens: 2048,
        schema: {
          type: "object",
          properties: {
            hits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  matchedText: { type: "string" },
                  description: { type: "string" },
                  severity: { type: "string" },
                  regulatoryReference: { type: "string" },
                },
                required: ["category", "matchedText", "description", "severity"],
              },
            },
            analysis: { type: "string" },
          },
          required: ["hits", "analysis"],
        },
      });

      return {
        hits: result.hits.map((h) => ({
          patternId: `nlp_${h.category.toLowerCase()}`,
          category: h.category,
          matchedText: h.matchedText,
          description: h.description,
          severity: h.severity,
          regulatoryReference: h.regulatoryReference,
          source: "AI_NLP" as const,
        })),
        analysis: result.analysis,
      };
    } catch {
      // AI scan failure should not block the workflow — return empty with warning
      return {
        hits: [],
        analysis: "AI compliance scan unavailable. Deterministic scan only.",
      };
    }
  }

  /**
   * Load per-firm custom compliance rules from the database.
   */
  static async getOrgRules(organizationId: string) {
    return prisma.complianceRule.findMany({
      where: { organizationId, isActive: true },
      orderBy: { severity: "desc" },
    });
  }

  /**
   * Run a full compliance scan combining deterministic + NLP + per-firm rules.
   */
  static async fullScan(
    text: string,
    organizationId: string,
    targetId: string,
    targetType: string,
    userId?: string,
    runNlp = true,
  ): Promise<ComplianceScanResult> {
    // 1. Deterministic scan (always runs)
    let hits = this.deterministicScan(text);

    // 2. Per-firm custom rules
    const orgRules = await this.getOrgRules(organizationId);
    for (const rule of orgRules) {
      const config = rule.config as { keywords?: string[]; pattern?: string } | null;
      if (config?.keywords) {
        for (const keyword of config.keywords) {
          if (text.toLowerCase().includes(keyword.toLowerCase())) {
            hits.push({
              patternId: rule.id,
              category: rule.type,
              matchedText: keyword,
              description: `Custom rule: ${rule.name}`,
              severity: rule.severity,
              source: "DETERMINISTIC",
            });
          }
        }
      }
      if (config?.pattern) {
        try {
          const regex = new RegExp(config.pattern, "i");
          const match = regex.exec(text);
          if (match) {
            hits.push({
              patternId: rule.id,
              category: rule.type,
              matchedText: match[0],
              description: `Custom rule: ${rule.name}`,
              severity: rule.severity,
              source: "DETERMINISTIC",
            });
          }
        } catch {
          // Invalid regex in custom rule — skip
        }
      }
    }

    // 3. AI NLP scan (optional, for high-value scans)
    let aiAnalysis: string | undefined;
    if (runNlp) {
      const nlpResult = await this.nlpScan(text, organizationId, userId);
      hits = [...hits, ...nlpResult.hits];
      aiAnalysis = nlpResult.analysis;
    }

    // Deduplicate hits by matchedText + category
    const seen = new Set<string>();
    hits = hits.filter((h) => {
      const key = `${h.matchedText.toLowerCase()}:${h.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Calculate risk score
    const severityScores = { LOW: 10, MEDIUM: 25, HIGH: 50, CRITICAL: 100 };
    const riskScore = Math.min(
      100,
      hits.reduce((sum, h) => sum + (severityScores[h.severity as keyof typeof severityScores] ?? 25), 0),
    );

    const requiresReview = hits.length > 0 && hits.some((h) => h.severity === "HIGH" || h.severity === "CRITICAL");

    // Create compliance flags for hits
    if (hits.length > 0) {
      const criticalHits = hits.filter((h) => h.severity === "HIGH" || h.severity === "CRITICAL");

      for (const hit of criticalHits) {
        await prisma.complianceFlag.create({
          data: {
            organizationId,
            type: hit.category,
            severity: hit.severity,
            description: `${hit.description}. Matched: "${hit.matchedText}"${hit.regulatoryReference ? ` (${hit.regulatoryReference})` : ""}`,
            target: targetType,
            targetId,
            status: "OPEN",
            aiInvolved: hit.source === "AI_NLP",
          },
        });
      }

      // Record immutable audit event
      await AuditEventService.appendEvent({
        organizationId,
        userId,
        action: "COMPLIANCE_SCAN_FLAGGED",
        target: targetType,
        targetId,
        details: `Compliance scan flagged ${hits.length} issues (${criticalHits.length} critical/high) for ${targetType}:${targetId}`,
        aiInvolved: true,
        severity: criticalHits.length > 0 ? "WARNING" : "INFO",
        metadata: {
          hitCount: hits.length,
          criticalCount: criticalHits.length,
          categories: [...new Set(hits.map((h) => h.category))],
        },
      });
    }

    return {
      isClean: hits.length === 0,
      hits,
      riskScore,
      requiresReview,
      aiAnalysis,
    };
  }

  /**
   * Reg BI Disclosure Check
   * Verifies that Reg BI required disclosures are present in recommendations.
   */
  static checkRegBiDisclosure(text: string): {
    hasRecommendation: boolean;
    hasDisclosure: boolean;
    missingElements: string[];
  } {
    const hasRecommendation = /\b(recommend|should\s+(buy|sell|invest|consider)|advis(e|ing)\s+(to|that))\b/i.test(text);
    const hasDisclosure = /\b(disclosure|conflict\s+of\s+interest|compensation|fee\s+structure|best\s+interest)\b/i.test(text);

    const missingElements: string[] = [];
    if (hasRecommendation && !hasDisclosure) {
      missingElements.push("Reg BI Form CRS disclosure reference");
      missingElements.push("Conflict of interest acknowledgment");
      missingElements.push("Compensation/fee disclosure");
    }

    return { hasRecommendation, hasDisclosure, missingElements };
  }

  /**
   * Supervisory Review — generates a supervisory procedures report for compliance officers.
   */
  static async generateSupervisoryReport(organizationId: string) {
    const [openFlags, recentEvents, aiEvents] = await Promise.all([
      prisma.complianceFlag.findMany({
        where: { organizationId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.auditEvent.findMany({
        where: {
          organizationId,
          timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { timestamp: "desc" },
        take: 100,
      }),
      prisma.auditEvent.findMany({
        where: {
          organizationId,
          aiInvolved: true,
          timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { timestamp: "desc" },
        take: 50,
      }),
    ]);

    const chainVerification = await AuditEventService.verifyChain(organizationId);

    return {
      generatedAt: new Date(),
      period: "30 days",
      openFlags: openFlags.length,
      criticalFlags: openFlags.filter((f) => f.severity === "CRITICAL").length,
      totalAuditEvents: recentEvents.length,
      aiInvolvedEvents: aiEvents.length,
      chainIntegrity: chainVerification.isValid,
      chainBreaks: chainVerification.breaks.length,
      flags: openFlags,
      recentEvents,
      aiEvents,
    };
  }
}
