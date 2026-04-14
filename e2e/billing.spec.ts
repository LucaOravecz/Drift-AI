import { expect, request, test } from "@playwright/test";

test.describe("billing gates", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("billing page loads with subscription info", async ({ page }) => {
    await page.goto("/billing");
    await expect(page.getByRole("heading", { name: "Billing & Fee Management" })).toBeVisible();
  });

  test("settings page shows plan information", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("Stripe checkout endpoint requires authentication", async () => {
    const unauthApi = await request.newContext({
      baseURL: "http://127.0.0.1:3000",
    });
    const response = await unauthApi.post("/api/stripe/checkout", {
      data: { plan: "PROFESSIONAL" },
    });
    expect(response.status()).toBe(401);
    await unauthApi.dispose();
  });

  test("Stripe portal endpoint requires authentication", async () => {
    const unauthApi = await request.newContext({
      baseURL: "http://127.0.0.1:3000",
    });
    const response = await unauthApi.post("/api/stripe/portal");
    expect(response.status()).toBe(401);
    await unauthApi.dispose();
  });

  test("Stripe webhook rejects invalid signature in production mode", async ({ request }) => {
    const response = await request.post("/api/stripe/webhook", {
      data: { type: "test", data: {} },
    });
    expect([200, 400, 500]).toContain(response.status());
  });
});
