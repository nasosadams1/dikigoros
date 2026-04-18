import { expect, test, type Page, type Route } from "@playwright/test";

const demoUserId = "11111111-1111-4111-8111-111111111111";
const demoEmail = "client@example.com";

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  headers: { "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body),
});

const installDemoUser = async (page: Page) => {
  await page.addInitScript(
    ({ userId, email }) => {
      const encode = (value: unknown) =>
        btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
      const accessToken = `${encode({ alg: "none", typ: "JWT" })}.${encode({
        aud: "authenticated",
        email,
        exp: expiresAt,
        role: "authenticated",
        sub: userId,
      })}.`;
      const now = new Date().toISOString();

      localStorage.setItem(
        "codhak-auth",
        JSON.stringify({
          access_token: accessToken,
          refresh_token: "demo-refresh-token",
          expires_at: expiresAt,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: userId,
            aud: "authenticated",
            role: "authenticated",
            email,
            email_confirmed_at: now,
            created_at: now,
            updated_at: now,
            app_metadata: {},
            user_metadata: { full_name: "Stage 4 Client", name: "Stage 4 Client" },
          },
        }),
      );
    },
    { userId: demoUserId, email: demoEmail },
  );
};

const demoProfile = {
  id: demoUserId,
  name: "Stage 4 Client",
  email: demoEmail,
  phone: "",
  city: "Αθήνα",
  preferred_language: "Ελληνικά",
  preferred_consultation_mode: "any",
  preferred_legal_categories: [],
  budget_range: "",
  urgency_preference: "",
  notification_preferences: { email: true, sms: false, reminders: true },
  privacy_settings: {
    share_phone_with_booked_lawyers: true,
    allow_document_access_by_booking: true,
    product_updates: false,
  },
  saved_lawyer_ids: [],
  compared_lawyer_ids: [],
  lawyer_notes: {},
  coins: 0,
  total_coins_earned: 0,
  xp: 0,
  completed_lessons: [],
  lifetime_completed_lessons: [],
  level: 1,
  hearts: 5,
  max_hearts: 5,
  last_heart_reset: new Date().toDateString(),
  current_avatar: "default",
  owned_avatars: ["default"],
  unlocked_achievements: [],
  current_streak: 0,
  last_login_date: "",
  total_lessons_completed: 0,
  email_verified: true,
};

const mockBackend = async (page: Page) => {
  await page.route("https://checkout.stripe.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Stripe Checkout</title><h1>Stripe Checkout opened</h1>",
    }),
  );

  await page.route(/\/(?:rest|functions|auth)\/v1\//, (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/functions/v1/create-booking-checkout-session")) {
      return route.fulfill(json({ id: "cs_test_stage4", status: "setup_required", url: "https://checkout.stripe.com/c/pay/cs_test_stage4" }));
    }

    if (url.includes("/auth/v1/user")) {
      return route.fulfill(json({ ...demoProfile, app_metadata: {}, user_metadata: demoProfile }));
    }

    if (url.includes("/rest/v1/user_profiles")) {
      if (method === "PATCH" || method === "POST") return route.fulfill(json(demoProfile));
      return route.fulfill(json(demoProfile));
    }

    if (url.includes("/rest/v1/lawyer_profiles")) {
      return route.fulfill(json({ message: "backend intentionally unavailable in e2e demo" }, 503));
    }

    if (url.includes("/rest/v1/rpc/reserve_booking_slot")) {
      return route.fulfill(json({ ok: true }));
    }

    if (url.includes("/rest/v1/rpc/")) {
      return route.fulfill(json({ ok: true }));
    }

    return route.fulfill(json([]));
  });
};

test.describe("money and trust flows", () => {
  test("search to profile to booking opens server-created checkout", async ({ page }) => {
    await installDemoUser(page);
    await mockBackend(page);

    await page.goto("/search");
    await expect(page.getByTestId("lawyer-result-maria-papadopoulou")).toBeVisible();

    await page.getByTestId("lawyer-profile-maria-papadopoulou").click();
    await expect(page).toHaveURL(/\/lawyer\/maria-papadopoulou/);

    await page.getByTestId("profile-booking-link").click();
    await expect(page).toHaveURL(/\/booking\/maria-papadopoulou/);

    await page.getByTestId("consultation-option-0").click();
    await page.getByTestId("booking-next").click();

    const dateOptions = page.locator('[data-testid^="booking-date-"]');
    const timeOptions = page.locator('[data-testid^="booking-time-"]');
    for (let index = 0; index < await dateOptions.count(); index += 1) {
      await dateOptions.nth(index).click();
      if (await timeOptions.count()) break;
    }
    await expect(timeOptions.first()).toBeVisible();
    await timeOptions.first().click();
    await page.getByTestId("booking-next").click();
    await page.getByTestId("booking-full-name").fill("Stage 4 Client");
    await page.getByTestId("booking-email").fill(demoEmail);
    await page.getByTestId("booking-phone").fill("+306900000000");
    await page.getByTestId("booking-issue").fill("Need advice on a contract dispute.");

    await page.getByTestId("booking-next").click();
    const checkoutRequest = page.waitForRequest(/\/functions\/v1\/create-booking-checkout-session/);
    await page.getByTestId("booking-next").click();
    await checkoutRequest;

    await expect(page).toHaveURL(/checkout\.stripe\.com\/c\/pay\/cs_test_stage4/);
    await expect(page.getByText("Stripe Checkout opened")).toBeVisible();
  });

  test("Stripe success returns do not create receipt truth without backend confirmation", async ({ page }) => {
    await installDemoUser(page);
    await mockBackend(page);

    await page.goto("/account?tab=payments&checkout=success&bookingId=BK-RETURN");
    await expect(page.getByText(/Επιστρέψατε από το Stripe/).first()).toBeVisible();
    await expect(page.getByText(/backend/).first()).toBeVisible();
    await expect(page.getByText(/Άνοιγμα απόδειξης/)).toHaveCount(0);

    await page.goto("/booking/maria-papadopoulou?bookingId=BK-MISSING&checkout=success");
    await expect(page.getByText(/Stripe/).first()).toBeVisible();
    await expect(page.getByText(/webhook|backend/).first()).toBeVisible();
  });

  test("partner portal requires server-issued partner session", async ({ page }) => {
    await mockBackend(page);

    await page.goto("/for-lawyers/portal");
    await expect(page).toHaveURL(/\/for-lawyers\/login/);
    await expect(page.locator("#partner-email")).toBeVisible();
  });
});
