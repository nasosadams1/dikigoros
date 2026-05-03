import { beforeEach, describe, expect, it } from "vitest";
import {
  completeStoredBooking,
  createBooking,
  createPartnerSession,
  createReferenceId,
  getBookingSlotKey,
  getStoredPaymentsForUser,
  getPartnerSession,
  recordLocalCheckoutReturn,
} from "@/lib/platformRepository";
import { buildAvailabilityTimeSlots } from "@/lib/partnerWorkspace";

describe("platform repository contracts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates readable operational reference ids", () => {
    expect(createReferenceId("BK")).toMatch(/^BK-\d{8}-[A-Z0-9]{1,5}$/);
    expect(createReferenceId("PA")).toMatch(/^PA-\d{8}-[A-Z0-9]{1,5}$/);
  });

  it("uses a deterministic booking slot key for local locking", () => {
    expect(
      getBookingSlotKey({
        lawyerId: "maria-papadopoulou",
        dateLabel: "Δευτέρα, 13 Απριλίου",
        time: "14:00",
      }),
    ).toBe("maria-papadopoulou::Δευτέρα, 13 Απριλίου::14:00");
  });

  it("persists partner verification session with normalized email", () => {
    createPartnerSession(
      " Partner@LawFirm.GR ",
      "server-issued-token",
      new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    );

    expect(getPartnerSession()?.email).toBe("partner@lawfirm.gr");
    expect(getPartnerSession()?.role).toBe("partner");
    expect(getPartnerSession()?.sessionToken).toBe("server-issued-token");
  });

  it("refuses partner sessions that are not issued by the backend", () => {
    expect(() => createPartnerSession("partner@lawfirm.gr")).toThrow("PARTNER_SESSION_REQUIRES_BACKEND_TOKEN");
  });

  it("generates booking slots from partner availability and buffer time", () => {
    expect(
      buildAvailabilityTimeSlots(
        { day: "Δευτέρα", enabled: true, start: "09:00", end: "11:00", note: "" },
        30,
        15,
      ),
    ).toEqual(["09:00", "09:45", "10:30"]);
  });

  it("never exposes booking slots during the closed night window", () => {
    expect(
      buildAvailabilityTimeSlots(
        { day: "Δευτέρα", enabled: true, start: "07:00", end: "23:00", note: "" },
        30,
        15,
      ),
    ).toEqual([
      "08:00",
      "08:45",
      "09:30",
      "10:15",
      "11:00",
      "11:45",
      "12:30",
      "13:15",
      "14:00",
      "14:45",
      "15:30",
      "16:15",
      "17:00",
      "17:45",
      "18:30",
      "19:15",
      "20:00",
      "20:45",
      "21:30",
    ]);
    expect(
      buildAvailabilityTimeSlots(
        { day: "Δευτέρα", enabled: true, start: "22:00", end: "23:00", note: "" },
        30,
        0,
      ),
    ).toEqual([]);
  });

  it("rejects booking payloads that start during closed night hours", async () => {
    await expect(
      createBooking({
        userId: "11111111-1111-4111-8111-111111111111",
        lawyerId: "maria-papadopoulou",
        lawyerName: "Maria",
        consultationType: "Video",
        consultationMode: "video",
        price: 60,
        duration: "30 minutes",
        dateLabel: "Monday",
        time: "22:00",
        clientName: "Client",
        clientEmail: "client@example.com",
        clientPhone: "6900000000",
      }),
    ).rejects.toThrow("BOOKING_TIME_OUTSIDE_AVAILABILITY_HOURS");
  });

  it("does not mark a booking payment paid just because the appointment was completed", () => {
    localStorage.setItem(
      "dikigoros.bookingRequests.v1",
      JSON.stringify([
        {
          id: "booking-1",
          userId: "user-1",
          lawyerId: "maria-papadopoulou",
          lawyerName: "Maria",
          consultationType: "Video",
          consultationMode: "video",
          price: 60,
          duration: "30 minutes",
          dateLabel: "Monday",
          time: "09:00",
          clientName: "Client",
          clientEmail: "client@example.com",
          clientPhone: "6900000000",
          referenceId: "BK-20260412-TEST",
          status: "confirmed_unpaid",
          createdAt: new Date().toISOString(),
          persistenceSource: "local",
        },
      ]),
    );

    completeStoredBooking("booking-1");

    expect(getStoredPaymentsForUser("user-1", "client@example.com")[0]?.status).toBe("not_opened");
  });

  it("keeps checkout-opened separate from paid and never downgrades a paid payment", () => {
    localStorage.setItem(
      "dikigoros.bookingRequests.v1",
      JSON.stringify([
        {
          id: "booking-2",
          userId: "user-1",
          lawyerId: "maria-papadopoulou",
          lawyerName: "Maria",
          consultationType: "Video",
          consultationMode: "video",
          price: 60,
          duration: "30 minutes",
          dateLabel: "Monday",
          time: "10:00",
          clientName: "Client",
          clientEmail: "client@example.com",
          clientPhone: "6900000000",
          referenceId: "BK-20260412-TEST2",
          status: "confirmed_unpaid",
          createdAt: new Date().toISOString(),
          persistenceSource: "local",
        },
      ]),
    );

    expect(recordLocalCheckoutReturn("booking-2", "checkout_opened", "cs_test_1")?.status).toBe("checkout_opened");
    expect(recordLocalCheckoutReturn("booking-2", "paid", "cs_test_1")?.status).toBe("paid");
    expect(recordLocalCheckoutReturn("booking-2", "failed", "cs_test_1")?.status).toBe("paid");
  });
});
