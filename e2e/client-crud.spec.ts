import { expect, test } from "@playwright/test";

test.describe("client CRUD", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("clients list page loads and shows existing clients", async ({ page }) => {
    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
  });

  test("client search filters results", async ({ page }) => {
    await page.goto("/clients");
    const search = page.getByLabel("Search clients");
    await search.fill("Peterson");
    await search.press("Tab");
    await expect(page.locator("tr").filter({ hasText: /Peterson/ })).toBeVisible();
  });

  test("client detail page loads with key sections", async ({ page }) => {
    await page.goto("/clients");
    // Click first client link
    const firstClientLink = page.locator('a[href^="/clients/"]').first();
    if (await firstClientLink.isVisible()) {
      await firstClientLink.click();
      await expect(page).toHaveURL(/\/clients\/.+$/);
      // Client detail should have at least a heading
      await expect(page.locator("h1, h2").first()).toBeVisible();
    }
  });

  test("clients API returns data with correct structure", async ({ request }) => {
    const response = await request.get("/api/clients");
    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(typeof json.count).toBe("number");

    if (json.data.length > 0) {
      const client = json.data[0];
      expect(client.id).toBeTruthy();
      expect(client.firstName || client.name).toBeTruthy();
    }
  });
});
