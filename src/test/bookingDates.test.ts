import { describe, expect, it } from "vitest";
import { formatLocalDateIso } from "@/lib/bookingDates";

describe("booking date formatting", () => {
  it("formats the calendar day without UTC conversion", () => {
    expect(formatLocalDateIso(new Date(2026, 6, 2))).toBe("2026-07-02");
    expect(formatLocalDateIso(new Date(2026, 3, 9))).toBe("2026-04-09");
  });
});
