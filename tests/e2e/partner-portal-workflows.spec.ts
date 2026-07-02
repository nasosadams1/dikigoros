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

    if (url.includes("/rest/v1/rpc/get_partner_workspace_as_partner")) {
      return route.fulfill(json([{
        partner_email: partnerEmail,
        lawyer_id: "maria-papadopoulou",
        profile: { lawyerId: "maria-papadopoulou" },
        availability: [
          { day: "Δευτέρα", enabled: true, start: "09:00", end: "17:00", note: "" },
          { day: "Τρίτη", enabled: true, start: "10:00", end: "18:00", note: "" },
          { day: "Τετάρτη", enabled: true, start: "12:00", end: "16:00", note: "" },
          { day: "Πέμπτη", enabled: true, start: "09:30", end: "16:30", note: "" },
          { day: "Παρασκευή", enabled: false, start: "09:00", end: "15:00", note: "Urgent only" },
        ],
        reviews: [],
        notifications: { bookingEmail: true, bookingSms: true, weeklyDigest: false },
        published_profile: { lawyerId: "maria-papadopoulou" },
        published_availability: [
          { day: "Δευτέρα", enabled: true, start: "09:00", end: "17:00", note: "" },
          { day: "Τρίτη", enabled: true, start: "10:00", end: "18:00", note: "" },
          { day: "Τετάρτη", enabled: true, start: "12:00", end: "16:00", note: "" },
          { day: "Πέμπτη", enabled: true, start: "09:30", end: "16:30", note: "" },
          { day: "Παρασκευή", enabled: false, start: "09:00", end: "15:00", note: "Urgent only" },
        ],
        is_public: true,
        updated_at: new Date().toISOString(),
      }]));
    }
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

    await expect(page.locator('input[type="time"]:disabled')).toHaveCount(6);
  });

  test("profile route opens the listing setup workspace", async ({ page }) => {
    await installPartnerSession(page);
    await mockPartnerBackend(page);

    await page.goto("/for-lawyers/profile");

    await expect(page).toHaveURL(/\/for-lawyers\/profile$/);
    await expect(page.locator("aside nav button")).toHaveCount(5);
    await expect(page.locator('a[href^="/lawyer/"]')).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("legacy pipeline view redirects to cases and payments workspace", async ({ page }) => {
    await installPartnerSession(page);
    await mockPartnerBackend(page);

    await page.goto("/for-lawyers/portal?view=pipeline");

    await expect(page).toHaveURL(/view=casePayments/);
    await expect(page.locator("aside nav button")).toHaveCount(5);

    await page.goto("/for-lawyers/portal?view=payments");

    await expect(page).toHaveURL(/view=casePayments/);
  });
});
