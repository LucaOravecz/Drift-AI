import { NextRequest, NextResponse } from "next/server";
import { requireActiveSession } from "@/lib/auth";
import { ComplianceRuleManagementService } from "@/lib/services/compliance-rule-management.service";
import prisma from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireActiveSession();

    // Verify rule belongs to user's organization
    const rule = await prisma.complianceRule.findUnique({
      where: { id: params.id }
    });

    if (!rule) {
      return NextResponse.json(
        { error: "Rule not found" },
        { status: 404 }
      );
    }

    if (rule.organizationId !== session.user.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    await ComplianceRuleManagementService.deleteRule(params.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete rule" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireActiveSession();
    const body = await request.json();

    // Verify rule belongs to user's organization
    const rule = await prisma.complianceRule.findUnique({
      where: { id: params.id }
    });

    if (!rule) {
      return NextResponse.json(
        { error: "Rule not found" },
        { status: 404 }
      );
    }

    if (rule.organizationId !== session.user.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const updated = await ComplianceRuleManagementService.updateRule(params.id, body);

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update rule" },
      { status: 500 }
    );
  }
}
