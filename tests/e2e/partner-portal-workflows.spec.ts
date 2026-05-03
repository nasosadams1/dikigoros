import { expect, test, type Page, type Route } from "@playwright/test";

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  headers: { "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body),
});

const partnerEmail = "partner@lawfirm.gr";

const installPartnerSession = async (page: Page) => {
  await page.addInitScript(({ email }) => {
    const now = new Date();
    localStorage.setItem(
      "dikigoros.partnerSession.v1",
      JSON.stringify({
        email,
        sessionToken: "e2e-partner-session",
        verifiedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        role: "partner",
        approved: true,
      }),
    );
  }, { email: partnerEmail });
};

const mockPartnerBackend = async (page: Page) => {
  await page.route(/\/(?:rest|functions|auth)\/v1\//, (route: Route) => {
    const url = route.request().url();

    if (url.includes("/rest/v1/rpc/")) return route.fulfill(json([]));
    if (url.includes("/rest/v1/partner_profile_settings")) return route.fulfill(json([]));
    return route.fulfill(json([]));
  });
};

test.describe("partner portal workflow guardrails", () => {
  test("closed availability day disables time fields", async ({ page }) => {
    await installPartnerSession(page);
    await mockPartnerBackend(page);

    await page.goto("/for-lawyers/portal?view=availability");

    await expect(page.getByRole("button", { name: "Άνοιγμα ημέρας" })).toBeVisible();
    await expect(page.locator('input[type="time"]:disabled')).toHaveCount(2);
  });

  test("removed profile view falls back to the case queue", async ({ page }) => {
    await installPartnerSession(page);
    await mockPartnerBackend(page);

    await page.goto("/for-lawyers/portal?view=profile");

    await expect(page).toHaveURL(/view=pipeline/);
    await expect(page.getByRole("button", { name: /Ροή υποθέσεων/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Προφίλ/ })).toHaveCount(0);
  });
});
