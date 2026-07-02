import { describe, expect, it } from "vitest";
import { getBookingDateFromLabelIso, sortBookingsNewestFirst } from "@/lib/partnerAppointmentOrdering";

const makeBooking = (dateLabel: string, time: string, referenceId: string, dateIso?: string) => ({
  dateLabel,
  time,
  referenceId,
  dateIso,
  createdAt: "2026-04-01T00:00:00.000Z",
});

describe("partner appointment ordering", () => {
  it("parses Greek date labels without relying on ASCII word boundaries", () => {
    expect(getBookingDateFromLabelIso(makeBooking("ΠΑΡΑΣΚΕΥΗ, 24 ΑΠΡΙΛΙΟΥ", "12:48", "BK-20260419-1HX9T"))).toBe("2026-04-24");
    expect(getBookingDateFromLabelIso(makeBooking("ΠΕΜΠΤΗ, 23 ΑΠΡΙΛΙΟΥ", "10:54", "BK-20260419-1CEU9"))).toBe("2026-04-23");
  });

  it("sorts the visible agenda from newest visible date and time to oldest", () => {
    const rows = [
      makeBooking("ΤΕΤΑΡΤΗ, 22 ΑΠΡΙΛΙΟΥ", "09:00", "BK-20260422-NYZ7P"),
      makeBooking("ΤΕΤΑΡΤΗ, 22 ΑΠΡΙΛΙΟΥ", "14:42", "BK-20260419-OWQDC"),
      makeBooking("ΠΕΜΠΤΗ, 23 ΑΠΡΙΛΙΟΥ", "09:57", "BK-20260420-126YU"),
      makeBooking("ΠΕΜΠΤΗ, 23 ΑΠΡΙΛΙΟΥ", "10:54", "BK-20260419-1CEU9"),
      makeBooking("ΠΑΡΑΣΚΕΥΗ, 24 ΑΠΡΙΛΙΟΥ", "12:48", "BK-20260419-1HX9T"),
      makeBooking("ΠΑΡΑΣΚΕΥΗ, 24 ΑΠΡΙΛΙΟΥ", "11:06", "BK-20260419-LPT7L"),
      makeBooking("ΠΑΡΑΣΚΕΥΗ, 24 ΑΠΡΙΛΙΟΥ", "10:54", "BK-20260419-L4YC"),
      makeBooking("ΠΑΡΑΣΚΕΥΗ, 24 ΑΠΡΙΛΙΟΥ", "10:24", "BK-20260419-SI2J3"),
    ];

    expect([...rows].sort(sortBookingsNewestFirst).map((booking) => `${booking.dateLabel} ${booking.time}`)).toEqual([
      "ΠΑΡΑΣΚΕΥΗ, 24 ΑΠΡΙΛΙΟΥ 12:48",
      "ΠΑΡΑΣΚΕΥΗ, 24 ΑΠΡΙΛΙΟΥ 11:06",
      "ΠΑΡΑΣΚΕΥΗ, 24 ΑΠΡΙΛΙΟΥ 10:54",
      "ΠΑΡΑΣΚΕΥΗ, 24 ΑΠΡΙΛΙΟΥ 10:24",
      "ΠΕΜΠΤΗ, 23 ΑΠΡΙΛΙΟΥ 10:54",
      "ΠΕΜΠΤΗ, 23 ΑΠΡΙΛΙΟΥ 09:57",
      "ΤΕΤΑΡΤΗ, 22 ΑΠΡΙΛΙΟΥ 14:42",
      "ΤΕΤΑΡΤΗ, 22 ΑΠΡΙΛΙΟΥ 09:00",
    ]);
  });

  it("uses the visible label before stale dateIso/reference data", () => {
    const sorted = [
      makeBooking("ΤΕΤΑΡΤΗ, 22 ΑΠΡΙΛΙΟΥ", "09:00", "BK-20260422-NYZ7P", "2026-04-22"),
      makeBooking("ΠΑΡΑΣΚΕΥΗ, 24 ΑΠΡΙΛΙΟΥ", "12:48", "BK-20260419-1HX9T", "2026-04-19"),
    ].sort(sortBookingsNewestFirst);

    expect(sorted[0].dateLabel).toBe("ΠΑΡΑΣΚΕΥΗ, 24 ΑΠΡΙΛΙΟΥ");
  });
});
