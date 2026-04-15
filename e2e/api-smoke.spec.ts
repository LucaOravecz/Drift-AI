import { expect, request, test } from "@playwright/test";

const storageStatePath = "playwright/.auth/admin.json";

test.describe("public api smoke", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "API smoke only needs one browser project.");

  test("health route is reachable without auth", async () => {
    const api = await request.newContext({
      baseURL: "http://127.0.0.1:3000",
    });
    const health = await api.get("/api/health");
    expect(health.ok()).toBe(true);
    const body = await health.json();
    expect(body.ok).toBe(true);
    expect(body.database).toBe("up");
    await api.dispose();
  });
});

test.describe("authenticated api smoke", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "API smoke only needs one browser project.");

  test("core api routes return healthy responses", async () => {
    const api = await request.newContext({
      baseURL: "http://127.0.0.1:3000",
      storageState: storageStatePath,
    });

    const clientsResponse = await api.get("/api/clients");
    expect(clientsResponse.ok()).toBe(true);
    const clientsJson = await clientsResponse.json();
    expect(Array.isArray(clientsJson.data)).toBe(true);
    expect(clientsJson.count).toBeGreaterThan(0);

    const v1ClientsResponse = await api.get("/api/v1/clients");
    expect(v1ClientsResponse.ok()).toBe(true);
    const v1ClientsJson = await v1ClientsResponse.json();
    expect(Array.isArray(v1ClientsJson.data)).toBe(true);
    expect(v1ClientsJson.count).toBeGreaterThan(0);

    const firstClientId = v1ClientsJson.data[0]?.id;
    expect(firstClientId).toBeTruthy();

    const billingResponse = await api.post("/api/v1/billing/calculate", {
      data: { clientId: firstClientId },
    });
    expect(billingResponse.ok()).toBe(true);
    const billingJson = await billingResponse.json();
    expect(billingJson.data.clientId).toBe(firstClientId);
    expect(typeof billingJson.data.finalFee).toBe("number");

    const ipsResponse = await api.post("/api/v1/proposals/ips", {
      data: { clientId: firstClientId },
    });
    expect(ipsResponse.ok()).toBe(true);
    const ipsJson = await ipsResponse.json();
    expect(ipsJson.data.clientId).toBe(firstClientId);
    expect(Array.isArray(ipsJson.data.sections)).toBe(true);
    expect(ipsJson.data.sections.length).toBeGreaterThan(0);

    const roiResponse = await api.get("/api/v1/dashboard/roi-report");
    expect(roiResponse.ok()).toBe(true);
    expect(roiResponse.headers()["content-type"]).toContain("application/pdf");

    const orgSettingsResponse = await api.get("/api/admin/organization/settings");
    expect(orgSettingsResponse.ok()).toBe(true);
    const orgSettingsJson = await orgSettingsResponse.json();
    expect(typeof orgSettingsJson.data.aiFeaturesEnabled).toBe("boolean");
    expect(typeof orgSettingsJson.data.readOnlyMode).toBe("boolean");
    expect(typeof orgSettingsJson.data.syncDriftAlertBps).toBe("number");

    const exportResponse = await api.get(`/api/v1/admin/clients/${firstClientId}/export`);
    expect(exportResponse.ok()).toBe(true);
    const exportJson = await exportResponse.json();
    expect(exportJson.client?.id).toBe(firstClientId);
    expect(exportJson.schemaVersion).toBe(1);

    await api.dispose();
  });
});
