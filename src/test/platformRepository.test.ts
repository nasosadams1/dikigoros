import { beforeEach, describe, expect, it } from "vitest";
import {
  completeStoredBooking,
  createLocalPartnerAccessCode,
  createPartnerSession,
  createReferenceId,
  getBookingSlotKey,
  getStoredPaymentsForUser,
  getPartnerSession,
  isLocalApprovedPartner,
  localPartnerAccessCode,
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
    createPartnerSession(" Partner@LawFirm.GR ");

    expect(getPartnerSession()?.email).toBe("partner@lawfirm.gr");
    expect(getPartnerSession()?.role).toBe("partner");
  });

  it("seeds a local partner access code for the approved dev account", () => {
    const codeRecord = createLocalPartnerAccessCode(" NasoosAdamopoylos@gmail.com ");

    expect(isLocalApprovedPartner("nasoosadamopoylos@gmail.com")).toBe(true);
    expect(codeRecord?.email).toBe("nasoosadamopoylos@gmail.com");
    expect(codeRecord?.code).toBe(localPartnerAccessCode);
  });

  it("does not issue local partner codes for unapproved emails", () => {
    expect(isLocalApprovedPartner("visitor@example.com")).toBe(false);
    expect(createLocalPartnerAccessCode("visitor@example.com")).toBeNull();
  });

  it("generates booking slots from partner availability and buffer time", () => {
    expect(
      buildAvailabilityTimeSlots(
        { day: "Δευτέρα", enabled: true, start: "09:00", end: "11:00", note: "" },
        30,
        15,
      ),
    ).toEqual(["09:00", "09:45"]);
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
