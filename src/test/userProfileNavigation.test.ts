import { describe, expect, it } from "vitest";
import { clearPaymentReturnParams, getPaymentReturnNotice, parseUserProfileTab } from "@/lib/userProfileNavigation";

describe("user profile navigation", () => {
  it("accepts only known account tabs", () => {
    expect(parseUserProfileTab("profile")).toBe("profile");
    expect(parseUserProfileTab("messages")).toBe("messages");
    expect(parseUserProfileTab("payments")).toBe("payments");
    expect(parseUserProfileTab("documents")).toBe("documents");
    expect(parseUserProfileTab("admin")).toBe("overview");
    expect(parseUserProfileTab(null)).toBe("overview");
  });

  it("maps Stripe checkout returns to user-facing notices", () => {
    expect(getPaymentReturnNotice(new URLSearchParams("checkout=success"))).toMatchObject({
      tone: "info",
      message: expect.stringContaining("backend"),
    });
    expect(getPaymentReturnNotice(new URLSearchParams("setup=cancelled"))).toMatchObject({
      tone: "info",
    });
  });

  it("clears transient Stripe params while keeping users on payments", () => {
    const params = clearPaymentReturnParams(new URLSearchParams("tab=overview&checkout=success&session_id=cs_test_123"));

    expect(params.get("tab")).toBe("payments");
    expect(params.has("checkout")).toBe(false);
    expect(params.has("session_id")).toBe(false);
  });
});
