import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateApiRequest,
  hasPermission,
  clientFindFirst,
  documentCreate,
  auditLogCreate,
  extractPDFContent,
  inferDocumentType,
  extract,
} = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  hasPermission: vi.fn(),
  clientFindFirst: vi.fn(),
  documentCreate: vi.fn(),
  auditLogCreate: vi.fn(),
  extractPDFContent: vi.fn(),
  inferDocumentType: vi.fn(),
  extract: vi.fn(),
}));

vi.mock("@/lib/middleware/api-auth", () => ({
  authenticateApiRequest,
  hasPermission,
}));

vi.mock("@/lib/db", () => ({
  default: {
    client: { findFirst: clientFindFirst },
    document: { create: documentCreate },
    auditLog: { create: auditLogCreate },
  },
}));

vi.mock("@/lib/services/document.service", () => ({
  DocumentService: {
    extractPDFContent,
    inferDocumentType,
    extract,
  },
}));

import { POST } from "@/app/api/documents/upload/route";

describe("POST /api/documents/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasPermission.mockReturnValue(true);
    authenticateApiRequest.mockResolvedValue({
      authenticated: true,
      context: {
        organizationId: "org_123",
        userId: "user_123",
        authMethod: "SESSION",
      },
    });
    clientFindFirst.mockResolvedValue({
      id: "client_123",
      name: 'Peterson Household',
      organizationId: "org_123",
    });
    inferDocumentType.mockResolvedValue({ type: "FINANCIAL_PLAN", confidence: 0.91 });
    extract.mockResolvedValue({
      keyPoints: ["Point 1"],
      actionItems: ["Action 1"],
      riskItems: ["Risk 1"],
    });
    documentCreate.mockResolvedValue({ id: "doc_123" });
    auditLogCreate.mockResolvedValue(undefined);
    extractPDFContent.mockResolvedValue("Extracted text");
  });

  it("rejects unauthenticated uploads", async () => {
    authenticateApiRequest.mockResolvedValue({
      authenticated: false,
      error: "Authentication required",
      statusCode: 401,
    });

    const form = new FormData();
    form.set("file", new File(["hello"], "notes.txt", { type: "text/plain" }));
    form.set("clientId", "client_123");

    const response = await POST({ formData: async () => form } as never);

    expect(response.status).toBe(401);
    expect(documentCreate).not.toHaveBeenCalled();
  });

  it("rejects unsupported file types", async () => {
    const form = new FormData();
    form.set("file", new File(["hello"], "image.png", { type: "image/png" }));
    form.set("clientId", "client_123");

    const response = await POST({ formData: async () => form } as never);

    expect(response.status).toBe(415);
    expect(clientFindFirst).not.toHaveBeenCalled();
  });

  it("enforces tenant scoping on the target client", async () => {
    clientFindFirst.mockResolvedValue(null);

    const form = new FormData();
    form.set("file", new File(["hello"], "notes.txt", { type: "text/plain" }));
    form.set("clientId", "client_other_tenant");

    const response = await POST({ formData: async () => form } as never);

    expect(response.status).toBe(404);
    expect(documentCreate).not.toHaveBeenCalled();
  });

  it("creates the document and audit log for a valid upload", async () => {
    const form = new FormData();
    form.set("file", new File(["hello"], "plan.pdf", { type: "application/pdf" }));
    form.set("clientId", "client_123");

    const response = await POST({ formData: async () => form } as never);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(extractPDFContent).toHaveBeenCalled();
    expect(documentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "client_123",
          fileName: "plan.pdf",
          documentType: "FINANCIAL_PLAN",
        }),
      }),
    );
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org_123",
          userId: "user_123",
          action: "DOCUMENT_UPLOADED",
        }),
      }),
    );
    expect(body.document).toEqual({ id: "doc_123" });
  });
});
