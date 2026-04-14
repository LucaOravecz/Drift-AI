import { expect, test } from "@playwright/test";

async function gotoStable(page: import("@playwright/test").Page, path: string) {
  try {
    await page.goto(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("ERR_CONNECTION_REFUSED")) {
      throw error;
    }
    await page.waitForTimeout(1000);
    await page.goto(path);
  }

  const errorHeading = page.getByRole("heading", { name: "This page couldn’t load" });
  if (await errorHeading.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Reload" }).click();
  }
}

test.describe("public auth", () => {
  test("sign-in page renders stored-account login", async ({ page }) => {
    await gotoStable(page, "/sign-in");
    await expect(page.locator('div[data-slot="card-title"]').filter({ hasText: /^Sign in$/ })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});

test.describe("authenticated client demo smoke", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  const routeChecks = [
    { path: "/account", heading: "Account" },
    { path: "/billing", heading: "Billing & Fee Management" },
    { path: "/communications", heading: "Follow-up queue" },
    { path: "/compliance", heading: "Compliance Command Center" },
    { path: "/documents", heading: "Document Intelligence" },
    { path: "/intelligence", heading: "Drift Intelligence Engine" },
    { path: "/meetings", heading: "Meeting prep board" },
    { path: "/notifications", heading: "Notifications" },
    { path: "/onboarding", heading: "Onboarding" },
    { path: "/opportunities", heading: "Revenue Engine" },
    { path: "/proposals", heading: "IPS & Proposal Generator" },
    { path: "/research", heading: "Investment Research Copilot" },
    { path: "/sales", heading: "Sales & Leads" },
    { path: "/settings", heading: "Settings" },
    { path: "/tax", heading: "Tax Intelligence" },
  ] as const;

  test("dashboard loads the advisor command center", async ({ page }) => {
    await gotoStable(page, "/");
    await expect(page.getByText("Start the day with the next conversation already prepared.")).toBeVisible();
    await expect(page.getByText("Firm-wide flow, made legible")).toBeVisible();
    await expect(page.locator("main").getByText("Meeting prep to follow-up autopilot")).toBeVisible();
  });

  test("clients list supports search and opens a client detail", async ({ page }) => {
    await gotoStable(page, "/clients");
    await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();

    const search = page.getByLabel("Search clients");
    await search.fill("Peterson Household");
    await search.press("Tab");

    const matchingRow = page.locator("tr").filter({ hasText: /^Peterson Household/ });
    await expect(matchingRow).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/clients\/.+$/),
      matchingRow.locator('a[href^="/clients/"]').first().click(),
    ]);
    await expect(page.getByRole("heading", { name: "Peterson Household" })).toBeVisible();
    await expect(page.getByText("Book of household value")).toBeVisible();
  });

  test("agents page renders the command center", async ({ page }) => {
    await gotoStable(page, "/agents");
    await expect(page.getByRole("heading", { name: "Workforce Analytics" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agent Command Center" })).toBeVisible();
  });

  for (const routeCheck of routeChecks) {
    test(`${routeCheck.path} renders its primary workflow`, async ({ page }) => {
      await gotoStable(page, routeCheck.path);
      await expect(page.getByRole("heading", { name: routeCheck.heading })).toBeVisible();
    });
  }

  test("integrations page shows live and planned readiness", async ({ page }) => {
    await gotoStable(page, "/integrations");
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await expect(page.getByText("Implementation Snapshot")).toBeVisible();
    await expect(page.getByText("LIVE").first()).toBeVisible();
    await expect(page.getByText("PLANNED").first()).toBeVisible();
  });

  test("scenario deep link opens the matching spotlight story", async ({ page }) => {
    await gotoStable(page, "/integrations?demo=1&track=compliance&persona=comms-review&scenario=compliance-escalation");
    await expect(page.locator("button").filter({ hasText: "Communications Review" }).first()).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "Compliance Escalation" }).first()).toBeVisible();
    await expect(page.getByText("Scenario Hook")).toBeVisible();
  });

  test("dashboard links into renewal center and exports the ROI report", async ({ page }) => {
    await gotoStable(page, "/");
    await expect(page.getByText("Start the day with the next conversation already prepared.")).toBeVisible();

    await page.locator('a[href="/renewal-readiness"]').first().click();
    await expect(page).toHaveURL(/\/renewal-readiness$/);
    await expect(page.getByText("Advisor And Team Readiness")).toBeVisible();
    await expect(page.getByRole("link", { name: "ROI PDF" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "ROI PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^roi_report_.*\.pdf$/);
  });
});
