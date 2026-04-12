import { ResearchService } from "@/lib/services/research.service";
import { ResearchClient } from "@/components/research-client";
import prisma from "@/lib/db";

export const revalidate = 0;

export default async function ResearchPage() {
  const [memos, insights, flags, clients] = await Promise.all([
    ResearchService.getMemos(),
    ResearchService.getInsights(),
    ResearchService.getConcentrationFlags(),
    prisma.client.findMany({ select: { id: true, name: true }, take: 20 }),
  ]);
  return <ResearchClient memos={memos as any} insights={insights as any} flags={flags as any} clients={clients} />;
}
