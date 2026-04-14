import { requireActiveSession } from "@/lib/auth";
import { ComplianceRuleManagementService } from "@/lib/services/compliance-rule-management.service";
import { ComplianceRulesClient } from "@/components/compliance-rules-client";

export const revalidate = 0;

export default async function ComplianceRulesPage() {
  const session = await requireActiveSession();
  const rules = await ComplianceRuleManagementService.listRulesForOrg(
    session.user.organizationId
  );

  return <ComplianceRulesClient initialRules={rules} />;
}
