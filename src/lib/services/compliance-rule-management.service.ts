import "server-only";

import prisma from "@/lib/db";
import { ComplianceRule } from "@prisma/client";

export class ComplianceRuleManagementService {
  /**
   * List all custom rules for organization
   */
  static async listRulesForOrg(orgId: string): Promise<ComplianceRule[]> {
    return prisma.complianceRule.findMany({
      where: { organizationId: orgId },
      orderBy: { category: "asc" }
    });
  }

  /**
   * Create custom rule with validation
   */
  static async createRule(
    orgId: string,
    data: {
      name?: string;
      category: string;
      description?: string;
      keywordPatterns?: string[];
      regexPatterns?: string[];
      severity: string;
    }
  ) {
    // Validate regex patterns before storing
    for (const pattern of data.regexPatterns || []) {
      try {
        new RegExp(pattern);
      } catch (e) {
        throw new Error(`Invalid regex pattern: ${pattern}`);
      }
    }

    return prisma.complianceRule.create({
      data: {
        organizationId: orgId,
        name: data.name ?? data.description ?? `${data.category} rule`,
        type: data.category,
        category: data.category,
        severity: data.severity,
        config: {
          description: data.description ?? null,
          keywords: data.keywordPatterns || [],
          regexPatterns: data.regexPatterns || []
        } as any,
        isActive: true
      }
    });
  }

  /**
   * Update rule
   */
  static async updateRule(
    ruleId: string,
    data: Partial<{
      name: string;
      description: string;
      severity: string;
      keywordPatterns: string[];
      regexPatterns: string[];
      isActive: boolean;
    }>
  ) {
    // Validate new regex patterns if provided
    if (data.regexPatterns) {
      for (const pattern of data.regexPatterns) {
        try {
          new RegExp(pattern);
        } catch (e) {
          throw new Error(`Invalid regex pattern: ${pattern}`);
        }
      }
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description && !data.name) updateData.name = data.description;
    if (data.severity) updateData.severity = data.severity;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.keywordPatterns || data.regexPatterns) {
      const rule = await prisma.complianceRule.findUnique({ where: { id: ruleId } });
      if (!rule) throw new Error("Rule not found");

      updateData.config = {
        description: data.description ?? (rule.config as any)?.description ?? null,
        keywords: data.keywordPatterns || (rule.config as any)?.keywords || [],
        regexPatterns: data.regexPatterns || (rule.config as any)?.regexPatterns || []
      };
    } else if (data.description) {
      const rule = await prisma.complianceRule.findUnique({ where: { id: ruleId } });
      if (!rule) throw new Error("Rule not found");
      updateData.config = {
        ...(rule.config as any),
        description: data.description,
      };
    }

    return prisma.complianceRule.update({
      where: { id: ruleId },
      data: updateData
    });
  }

  /**
   * Delete rule
   */
  static async deleteRule(ruleId: string) {
    return prisma.complianceRule.delete({ where: { id: ruleId } });
  }

  /**
   * Deactivate rule (soft delete)
   */
  static async deactivateRule(ruleId: string) {
    return prisma.complianceRule.update({
      where: { id: ruleId },
      data: { isActive: false }
    });
  }
}
