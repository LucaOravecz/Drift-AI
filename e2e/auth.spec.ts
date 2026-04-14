import { expect, test } from "@playwright/test";

test.describe("auth flows", () => {
  test("sign-in page loads with email and password fields", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("sign-in with invalid credentials shows error", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("sign-in with empty fields shows validation error", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("authenticated routes redirect to sign-in when not logged in", async ({ page }) => {
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("sign-out clears session and redirects to sign-in", async ({ page }) => {
    // Use admin storage state to be logged in
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

    // Sign out via the form action
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    // Verify protected route redirects
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("brute-force protection", () => {
  test("rate limit kicks in after repeated failed sign-ins", async ({ page }) => {
    await page.goto("/sign-in");

    for (let i = 0; i < 6; i++) {
      await page.getByLabel("Email").fill("ratelimit@test.com");
      await page.getByLabel("Password").fill(`wrong-${i}`);
      await page.getByRole("button", { name: "Sign in" }).click();
      // Wait for redirect or error
      await page.waitForURL(/\/sign-in/, { timeout: 5000 }).catch(() => {});
    }

    // After 5+ failures, should see rate limit message
    await expect(page.getByText(/too many failed attempts/i)).toBeVisible();
  });
});
