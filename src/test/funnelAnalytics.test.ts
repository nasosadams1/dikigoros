import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFunnelEvents, getFunnelEvents, getFunnelMetrics, trackFunnelEvent } from "@/lib/funnelAnalytics";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: new Error("offline") })),
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));

describe("funnel analytics", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("persists events to the backend table shape and keeps only a pending offline queue locally", async () => {
    const event = trackFunnelEvent("payment_opened", {
      userId: "11111111-1111-1111-1111-111111111111",
      lawyerId: "maria-papadopoulou",
      bookingId: "22222222-2222-2222-2222-222222222222",
      city: "Αθήνα",
      category: "Οικογενειακό",
      source: "account",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(supabase.from).toHaveBeenCalledWith("funnel_events");
    expect(event.lawyerId).toBe("maria-papadopoulou");
    expect(getFunnelEvents()).toHaveLength(1);
    expect(getFunnelMetrics(getFunnelEvents()).find((metric) => metric.name === "payment_opened")?.count).toBe(1);
  });

  it("can clear the offline queue without changing the event taxonomy", async () => {
    trackFunnelEvent("homepage_search", { city: "Θεσσαλονίκη" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    clearFunnelEvents();

    expect(getFunnelEvents()).toEqual([]);
  });
});
