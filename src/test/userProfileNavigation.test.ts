import { describe, expect, it } from "vitest";
import { clearPaymentReturnParams, getPaymentReturnNotice, parseUserProfileTab } from "@/lib/userProfileNavigation";

describe("user profile navigation", () => {
  it("accepts only known account tabs", () => {
    expect(parseUserProfileTab("settings")).toBe("settings");
    expect(parseUserProfileTab("payments")).toBe("payments");
    expect(parseUserProfileTab("saved")).toBe("saved");
    expect(parseUserProfileTab("profile")).toBe("settings");
    expect(parseUserProfileTab("privacy")).toBe("settings");
    expect(parseUserProfileTab("overview")).toBe("settings");
    expect(parseUserProfileTab("documents")).toBe("settings");
    expect(parseUserProfileTab("reviews")).toBe("settings");
    expect(parseUserProfileTab("admin")).toBe("settings");
    expect(parseUserProfileTab(null)).toBe("settings");
  });

  it("maps Stripe checkout returns to user-facing notices", () => {
    expect(getPaymentReturnNotice(new URLSearchParams("checkout=success"))).toMatchObject({
      tone: "info",
      message: expect.stringContaining("επιβεβαίωση"),
    });
    expect(getPaymentReturnNotice(new URLSearchParams("setup=cancelled"))).toMatchObject({
      tone: "info",
    });
  });

  it("clears transient Stripe params while keeping users on payments", () => {
    const params = clearPaymentReturnParams(new URLSearchParams("tab=settings&checkout=success&session_id=cs_test_123"));

    expect(params.get("tab")).toBe("payments");
    expect(params.has("checkout")).toBe(false);
    expect(params.has("session_id")).toBe(false);
  });
});
