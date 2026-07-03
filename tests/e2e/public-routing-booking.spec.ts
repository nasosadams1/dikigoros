import { expect, test, type Page, type Route } from "@playwright/test";

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  headers: { "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body),
});

const mockPublicBackend = async (page: Page) => {
  await page.route(/\/(?:rest|functions|auth)\/v1\//, (route: Route) => {
    const url = route.request().url();

    if (url.includes("/rest/v1/lawyer_profiles")) {
      return route.fulfill(json({ message: "force fallback marketplace data for public e2e" }, 503));
    }

    if (url.includes("/rest/v1/rpc/")) return route.fulfill(json([]));
    if (url.includes("/auth/v1/user")) return route.fulfill(json({ user: null }));
    return route.fulfill(json([]));
  });
};

test.describe("public routing and booking handoff", () => {
  test("direct public deep links render React routes instead of falling through", async ({ page }) => {
    await mockPublicBackend(page);

    await page.goto("/search");
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByTestId("lawyer-result-maria-papadopoulou")).toBeVisible();

    await page.goto("/lawyer/maria-papadopoulou");
    await expect(page).toHaveURL(/\/lawyer\/maria-papadopoulou$/);
    await expect(page.getByText("Μαρία Παπαδοπούλου").first()).toBeVisible();
    await expect(page.locator('a[href*="/booking/maria-papadopoulou"]')).toHaveCount(6);

    await page.goto("/for-lawyers/portal?view=bookings");
    await expect(page).toHaveURL(/\/for-lawyers\/login$/);
    await expect(page.locator("#partner-email")).toBeVisible();
  });

  test("profile availability slots preserve date, time, and mode into booking", async ({ page }) => {
    await mockPublicBackend(page);

    await page.goto("/lawyer/maria-papadopoulou");
    const slotLink = page.locator('a[href*="/booking/maria-papadopoulou"][href*="source=profile_slot"]').first();
    await expect(slotLink).toBeVisible();

    const href = await slotLink.getAttribute("href");
    expect(href).toBeTruthy();
    const slotUrl = new URL(href || "", "http://127.0.0.1:4173");
    const requestedDate = slotUrl.searchParams.get("date");
    const requestedTime = slotUrl.searchParams.get("time");
    const requestedMode = slotUrl.searchParams.get("mode");

    expect(requestedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(requestedTime).toMatch(/^\d{2}:\d{2}$/);
    expect(requestedMode).toMatch(/^(video|phone|in-person)$/);

    await page.goto(`${slotUrl.pathname}${slotUrl.search}`);
    await expect(page).toHaveURL(new RegExp(`/booking/maria-papadopoulou.*date=${requestedDate}`));
    await expect(page.getByText("Επιλέξτε ημερομηνία και ώρα")).toBeVisible();

    await expect(page.locator('[data-testid^="booking-date-"].bg-primary')).toHaveCount(1);
    await expect(page.getByTestId(`booking-time-${requestedTime?.replace(":", "")}`)).toHaveClass(/bg-primary/);

    if (requestedMode === "phone") {
      await expect(page.getByText(/Τηλέφωνο · €50/)).toBeVisible();
    } else if (requestedMode === "video") {
      await expect(page.getByText(/Βιντεοκλήση · €60/)).toBeVisible();
    } else {
      await expect(page.getByText(/Στο γραφείο · €80/)).toBeVisible();
    }
  });
});
