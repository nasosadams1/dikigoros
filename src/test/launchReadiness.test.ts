import { describe, expect, it } from "vitest";
import {
  getBookingPaymentEvidenceChecks,
  getDynamicLaunchGates,
  getFunnelEventCoverage,
  supportWorkflows,
  type LaunchEvidenceCase,
} from "@/lib/operations";
import type { FunnelEvent, FunnelEventName } from "@/lib/funnelAnalytics";

const closedEvidenceCase = (title: string, area: LaunchEvidenceCase["area"], evidence: string[]): LaunchEvidenceCase => ({
  area,
  title,
  summary: evidence.join(" "),
  status: "resolved",
  evidence,
});

const event = (name: FunnelEventName, daysAgo: number): FunnelEvent => ({
  id: `${name}-${daysAgo}`,
  name,
  occurredAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  sessionId: "session",
  userId: "user",
  lawyerId: "lawyer",
  bookingId: "booking",
  city: "Αθήνα",
  category: "Οικογενειακό",
  source: "test",
});

describe("launch readiness gates", () => {
  it("requires explicit closed payment evidence for each live payment scenario", () => {
    const checks = getBookingPaymentEvidenceChecks([
      closedEvidenceCase("Payment success proof", "payments", ["successful live booking", "payment succeeded", "receipt visible"]),
      closedEvidenceCase("Failed payment proof", "payments", ["failed payment", "checkout failed"]),
    ]);

    expect(checks.find((check) => check.label === "επιτυχής κράτηση παραγωγής")?.ready).toBe(true);
    expect(checks.find((check) => check.label === "αποτυχημένη πληρωμή")?.ready).toBe(true);
    expect(checks.find((check) => check.label === "ακύρωση με επιστροφή")?.ready).toBe(false);
    expect(checks.find((check) => check.label === "ακύρωση από δικηγόρο")?.ready).toBe(false);
  });

  it("requires all funnel events and a seven-day evidence window", () => {
    const partialCoverage = getFunnelEventCoverage([event("homepage_search", 1), event("payment_opened", 0)]);
    expect(partialCoverage.checks.every((check) => check.ready)).toBe(false);
    expect(partialCoverage.observedDays).toBeLessThan(7);

    const fullCoverage = getFunnelEventCoverage([
      event("homepage_search", 8),
      event("search_profile_opened", 7),
      event("profile_booking_start", 6),
      event("booking_created", 5),
      event("payment_opened", 4),
      event("payment_completed", 3),
      event("consultation_completed", 2),
      event("review_submitted", 1),
      event("lawyer_application_submitted", 8),
      event("lawyer_application_approved", 7),
      event("approved_lawyer_first_completed_consultation", 0),
    ]);

    expect(fullCoverage.checks.every((check) => check.ready)).toBe(true);
    expect(fullCoverage.observedDays).toBeGreaterThanOrEqual(7);
  });

  it("keeps launch gates open when operational evidence or supply density is missing", () => {
    const gates = getDynamicLaunchGates({
      lawyers: [],
      funnelEvents: [],
      operationalCases: supportWorkflows.map((workflow) =>
        closedEvidenceCase(workflow.label, workflow.area, [workflow.id.replace(/_/g, " "), workflow.label]),
      ),
      operationalCasesSource: "backend",
    });

    expect(gates.find((gate) => gate.label === "Οι λειτουργίες δίνουν προτεραιότητα στο σύστημα")?.ready).toBe(true);
    expect(gates.find((gate) => gate.label === "Η βασική πυκνότητα πόλης/δικαίου έχει επιτευχθεί")?.ready).toBe(false);
    expect(gates.find((gate) => gate.label === "Τα αναλυτικά στοιχεία διαδρομής γράφονται στο σύστημα")?.ready).toBe(false);
  });
});
