import { expect, test } from "@playwright/test";

const E2E_SECRET = process.env.E2E_TEST_SECRET ?? "e2e-secret";

test("signup → verify (forced) → signin → onboarding → dashboard", async ({ page, request }) => {
  const email = `e2e+${Date.now()}@hawkky.test`;
  const password = "test-password-123";

  // 1) Signup
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: /créer mon compte/i }).click();
  await expect(page.getByText(/Vérifie ta boîte mail/i)).toBeVisible();

  // 2) Force verify (bypass Resend en E2E)
  const r = await request.post("/api/test/force-verify", {
    headers: { "x-test-secret": E2E_SECRET, "content-type": "application/json" },
    data: { email },
  });
  expect(r.ok()).toBeTruthy();

  // 3) Signin
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();

  // 4) Onboarding step 1
  await page.waitForURL(/\/onboarding/);
  await expect(page.getByText(/Tu es plutôt/)).toBeVisible();
  await page.getByText(/Développeur/).click();

  // 5) Onboarding step 2
  await page.waitForURL(/step=2/);
  await page.getByText("IA", { exact: true }).first().click();
  await page.getByText("Frontend").click();
  await page.getByRole("button", { name: /continuer/i }).click();

  // 6) Step 3 dev
  await page.waitForURL(/step=3/);
  await page.getByText("TypeScript").first().click();
  await page.getByText("Next.js").click();
  await page.getByRole("button", { name: /continuer/i }).click();

  // 7) Step 4 livraison
  await page.waitForURL(/step=4/);
  await page.getByRole("button", { name: /Recevoir mon premier briefing/ }).click();

  // 8) Step 5 done → dashboard
  await page.waitForURL(/step=5/);
  await page.getByRole("button", { name: /Aller au dashboard/ }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText(/Prochain briefing/)).toBeVisible();
});
