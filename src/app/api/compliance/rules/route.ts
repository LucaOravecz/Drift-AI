import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/middleware/api-auth";
import { ComplianceRuleManagementService } from "@/lib/services/compliance-rule-management.service";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  try {
    const rules = await ComplianceRuleManagementService.listRulesForOrg(
      auth.context.organizationId
    );

    return NextResponse.json(rules);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  try {
    const body = await request.json();

    const {
      category,
      name,
      description,
      keywordPatterns,
      regexPatterns,
      severity,
    } = body;

    const ruleName = name ?? description;

    if (!category || !ruleName || !severity) {
      return NextResponse.json(
        { error: "Missing required fields: category, name, severity" },
        { status: 400 }
      );
    }

    const rule = await ComplianceRuleManagementService.createRule(
      auth.context.organizationId,
      {
        category,
        name: ruleName,
        description,
        keywordPatterns,
        regexPatterns,
        severity
      }
    );

    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create rule" },
      { status: 500 }
    );
  }
}
