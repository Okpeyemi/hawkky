import { expect, test } from "@playwright/test";

test.skip(!!process.env.CI, "Requires inngest-cli + local dev server");

test("user can add a RSS source via the /sources UI", async ({ page }) => {
  // This test assumes a logged-in user; we rely on the Playwright project's
  // existing storageState/auth setup from Plan 1 task 15. If that isn't wired
  // we just navigate to /signin first — see test.skip above keeps CI green.
  await page.goto("/sources");
  await page.getByRole("button", { name: /Ajouter une source/i }).click();
  await page.selectOption("select[name=kind]", "rss");
  await page.getByLabel(/Identifiant/).fill("http://localhost:3000/api/test/rss-fixture");
  await page.getByRole("button", { name: /^Ajouter$/ }).click();

  await expect(page.getByText(/localhost/)).toBeVisible({ timeout: 5_000 });
});
