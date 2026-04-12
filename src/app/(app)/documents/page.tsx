import { DocumentService } from "@/lib/services/document.service";
import { DocumentsClient } from "@/components/documents-client";
import prisma from "@/lib/db";

export const revalidate = 0;

export default async function DocumentsPage() {
  const [documents, stats, clients] = await Promise.all([
    DocumentService.getDocuments(),
    DocumentService.getStats(),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <DocumentsClient documents={documents as any} stats={stats} clients={clients} />;
}
