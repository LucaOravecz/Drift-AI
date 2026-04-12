import { OnboardingService } from "@/lib/services/onboarding.service";
import { OnboardingClient } from "@/components/onboarding-client";

export const revalidate = 0;

export default async function OnboardingPage() {
  const [workflows, stats] = await Promise.all([
    OnboardingService.getWorkflows(),
    OnboardingService.getStats(),
  ]);
  return <OnboardingClient workflows={workflows as any} stats={stats} />;
}
