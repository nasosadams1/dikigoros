import type { Lawyer } from "@/data/lawyers";
import type { FunnelEvent } from "@/lib/funnelAnalytics";
import { getLawyerMarketplaceSignals, includesMarketplaceText, isAvailableToday, isAvailableTomorrow } from "@/lib/marketplace";

export type OperationalArea =
  | "payments"
  | "supply"
  | "verification"
  | "reviews"
  | "bookingDisputes"
  | "support"
  | "privacyDocuments"
  | "security";

export interface OperatingRule {
  area: OperationalArea;
  title: string;
  owner: string;
  sla: string;
  trigger: string;
  evidenceNeeded: string[];
  actions: string[];
  userOutcome: string;
  escalation: string;
  closeCondition: string;
  clientCopy: string;
}

export interface SupportWorkflow {
  id: string;
  label: string;
  area: OperationalArea;
  owner: string;
  sla: string;
  requiredEvidence: string[];
  escalationRule: string;
  userFacingResponse: string;
  closeCondition: string;
}

export interface LaunchGate {
  label: string;
  owner: string;
  ready: boolean;
  evidence: string;
}

export interface LaunchEvidenceCase {
  area: OperationalArea;
  title: string;
  summary: string;
  status: string;
  evidence: string[];
}

export interface LaunchGateInputs {
  lawyers: Lawyer[];
  funnelEvents: FunnelEvent[];
  operationalCases: LaunchEvidenceCase[];
  operationalCasesSource: "backend" | "fallback";
}

export interface PaymentReadinessCheck {
  label: string;
  ready: boolean;
  detail: string;
}

export const coreLaunchCities = [
  { label: "Αθήνα", query: "Αθήνα", minimumVerified: 8 },
  { label: "Θεσσαλονίκη", query: "Θεσσαλονίκη", minimumVerified: 5 },
];

export const highIntentCategories = [
  { label: "Οικογενειακό / διαζύγιο", queries: ["family", "divorce", "custody", "οικογεν", "διαζ"] },
  { label: "Εργατικό", queries: ["employment", "dismissal", "εργα", "απολυ"] },
  { label: "Ακίνητα", queries: ["property", "real estate", "ακιν", "κτηματο"] },
  { label: "Κληρονομικά", queries: ["inheritance", "will", "κληρο"] },
  { label: "Ποινικό", queries: ["criminal", "ποιν"] },
];

export const discoveryDensityThresholds = {
  minimumVerifiedLawyers: 3,
  minimumWithPrice: 3,
  minimumAvailableSoon: 2,
  minimumReviewed: 2,
  minimumBookable: 3,
};

export const operatingRules: OperatingRule[] = [
  {
    area: "payments",
    title: "Payment failures and checkout state",
    owner: "Payments operator",
    sla: "Same business day for payment failures; immediate review for duplicate-charge concerns.",
    trigger: "Checkout success, cancellation, async failure, refund request, or missing receipt.",
    evidenceNeeded: ["Booking reference", "Payment reference or checkout session", "Client email", "Visible payment state in account"],
    actions: [
      "Confirm booking payment row exists and matches booking amount.",
      "Confirm Stripe checkout session, payment intent, webhook event, and receipt URL.",
      "Route eligible refunds through the original payment method.",
      "Never expose processor error payloads directly to clients.",
      "In production, require live Stripe keys and a live webhook secret before checkout can operate.",
    ],
    userOutcome: "The user sees paid, failed, refunded, or pending with one retry/support action.",
    escalation: "Escalate to the payments operator immediately for duplicate charge, missing receipt after success, or webhook mismatch.",
    closeCondition: "Stripe session, payment row, booking state, user-facing message, and receipt/refund state agree.",
    clientCopy: "Payment did not complete. Your card was not charged. Try again or contact support.",
  },
  {
    area: "payments",
    title: "Refund review",
    owner: "Payments operator",
    sla: "Same business day for lawyer cancellation or duplicate-charge concern; 2 business days for late-cancellation review.",
    trigger: "Paid booking cancellation, refund request, lawyer cancellation, no-show dispute, or processor refund failure.",
    evidenceNeeded: ["Booking reference", "Payment or invoice reference", "Cancellation time", "Cancellation reason", "Communication history"],
    actions: [
      "Confirm whether the booking was paid, cancelled, completed, or disputed.",
      "Apply the 24-hour rule and lawyer-cancellation exception before deciding the refund route.",
      "Use the original payment method for eligible refunds.",
      "Open a support case when policy, timing, or processor state is unclear.",
    ],
    userOutcome: "The user sees whether the refund started, is pending review, or is not eligible with a support path.",
    escalation: "Escalate to support lead when cancellation facts conflict; escalate to security/privacy lead for suspicious payment activity.",
    closeCondition: "Refund is paid, explicitly rejected with reason, or waiting on processor with user-facing tracking.",
    clientCopy: "The cancellation was recorded. Support is reviewing whether a refund applies.",
  },
  {
    area: "verification",
    title: "Partner profile verification",
    owner: "Verification reviewer",
    sla: "2-3 business days after a complete application.",
    trigger: "New lawyer application, profile update, missing evidence, suspension signal.",
    evidenceNeeded: ["Identity details", "License or registry number", "Bar association", "Practice details", "Profile readiness fields"],
    actions: [
      "Check identity, license, bar association, professional details, and profile readiness.",
      "Approve only when consultation options, prices, languages, and availability are usable.",
      "Reject or request retry with a specific missing-evidence reason.",
      "Suspend or remove profiles when verification becomes stale or disputed.",
    ],
    userOutcome: "The lawyer sees approved, under review, needs changes, or rejected with a concrete reason.",
    escalation: "Escalate stale or disputed verification to the verification reviewer before public profile changes stay live.",
    closeCondition: "Profile is approved, rejected, suspended, or returned with exact missing evidence.",
    clientCopy: "This profile is visible only after identity, license, professional details, and readiness checks.",
  },
  {
    area: "reviews",
    title: "Review moderation",
    owner: "Trust reviewer",
    sla: "48 hours for normal moderation; same business day for fraud or abuse flags.",
    trigger: "Completed booking review, lawyer dispute, abuse flag, fraud signal.",
    evidenceNeeded: ["Booking reference", "Completion state", "Review text", "Ratings", "Dispute or abuse reason when present"],
    actions: [
      "Accept only reviews tied to completed bookings.",
      "Send review requests only after the booking is completed and the payment is settled or verified.",
      "Block private case details, abuse, conflicts of interest, spam, or unrelated content.",
      "Allow lawyer replies without exposing confidential details.",
      "Hold disputed reviews until moderation finishes.",
    ],
    userOutcome: "The client sees whether the review is submitted, held, published, or removed; the lawyer sees reply/dispute options.",
    escalation: "Escalate fraud, abuse, or confidential case-detail exposure to trust reviewer immediately.",
    closeCondition: "Review is published, rejected, or held with a documented moderation reason and reply/dispute path.",
    clientCopy: "Reviews are published only after completed bookings and moderation checks.",
  },
  {
    area: "reviews",
    title: "Review disputes",
    owner: "Trust reviewer",
    sla: "48 hours for normal disputes; same business day for abuse, fraud, or confidential details.",
    trigger: "Lawyer disputes a review, client reports review handling, or moderation flags private case facts.",
    evidenceNeeded: ["Review id", "Booking reference", "Dispute reason", "Relevant public reply", "Any private-detail concern"],
    actions: [
      "Hold or hide the review while the disputed content is checked.",
      "Separate opinion from factual claims and confidential case details.",
      "Allow a public lawyer reply when the review remains published.",
      "Record removal reason when a review is blocked or removed.",
    ],
    userOutcome: "Both sides see whether the review is live, held for review, edited, removed, or open for reply.",
    escalation: "Escalate repeated abuse, fraud signals, or threats to security/privacy lead.",
    closeCondition: "Disputed review has a final publication state, removal reason, or permitted public reply.",
    clientCopy: "The review is being checked before any public change is made.",
  },
  {
    area: "bookingDisputes",
    title: "Booking disputes",
    owner: "Booking support",
    sla: "Same business day for slot conflicts and no-shows; 2 business days for refund review.",
    trigger: "Client cancellation, lawyer cancellation, no-show, reschedule request, slot conflict.",
    evidenceNeeded: ["Booking reference", "Selected slot", "Booking status", "Payment state", "Requester email"],
    actions: [
      "Confirm booking status, slot, payment state, and communication history.",
      "Apply free cancellation or reschedule when outside the 24-hour window.",
      "Route late cancellation and no-show cases to support review.",
      "Keep messages human-readable and avoid internal status codes.",
    ],
    userOutcome: "The user sees choose another time, retry payment, track refund, or support case opened.",
    escalation: "Escalate paid cancellations, lawyer cancellation, and no-shows to booking support with payments copied when money moved.",
    closeCondition: "Booking is rescheduled, cancelled without charge, refund-reviewed, or closed with a written reason.",
    clientCopy: "We are checking the booking details and will confirm the next step by email.",
  },
  {
    area: "bookingDisputes",
    title: "Lawyer cancellation",
    owner: "Booking support",
    sla: "Same business day; urgent if the consultation is within 24 hours.",
    trigger: "Lawyer cancels, requests a reschedule, or cannot attend a confirmed consultation.",
    evidenceNeeded: ["Booking reference", "Lawyer id", "Client email", "Payment state", "Reason for cancellation"],
    actions: [
      "Offer the client reschedule, comparable alternative, or refund path.",
      "Keep the booking state from implying paid/attended when the consultation will not happen.",
      "Create a refund review when the booking was paid.",
      "Flag repeated lawyer cancellations for verification or profile review.",
    ],
    userOutcome: "The client sees reschedule, refund review, or support follow-up without needing to diagnose the issue.",
    escalation: "Escalate repeated or last-minute lawyer cancellations to verification reviewer and support lead.",
    closeCondition: "Client selected reschedule, comparable alternative, refund review, or cancellation closure.",
    clientCopy: "The lawyer cannot attend this time. We will help you reschedule or review the refund path.",
  },
  {
    area: "support",
    title: "Support routing",
    owner: "Support lead",
    sla: "Urgent booking/payment: same business day. General account/privacy: 2 business days.",
    trigger: "Help center contact, failed checkout, booking failure, account access issue, complaint.",
    evidenceNeeded: ["Requester email", "Topic type", "Reference id when available", "Short description", "Urgency"],
    actions: [
      "Tag the case by booking, payment, account, document, complaint, or privacy path.",
      "Prioritize urgent bookings and payment failures.",
      "Escalate privacy/security concerns immediately.",
      "Close with a user-facing explanation and next step.",
    ],
    userOutcome: "The requester receives a case reference and a clear next step.",
    escalation: "Escalate privacy/security immediately; escalate booking/payment blockers when a consultation or charge is at risk.",
    closeCondition: "Requester has the case outcome, owner notes, and no unresolved urgent blocker remains.",
    clientCopy: "Support has received your request and will route it to the right team.",
  },
  {
    area: "support",
    title: "Account access",
    owner: "Support lead",
    sla: "2 business days; same business day when access blocks an upcoming paid consultation.",
    trigger: "Login failure, email mismatch, missing account history, receipt access issue, or saved workspace issue.",
    evidenceNeeded: ["Account email", "Booking/payment reference if any", "Access symptom", "Device/browser note when useful"],
    actions: [
      "Confirm the requester controls the email before discussing account details.",
      "Check booking, payment, document, and saved-lawyer visibility for the account.",
      "Restore access path or explain what information is missing.",
      "Escalate suspicious access patterns to security.",
    ],
    userOutcome: "The user sees how to regain access or which exact record support is checking.",
    escalation: "Escalate immediately for suspected account takeover or sensitive document exposure.",
    closeCondition: "Access is restored, identity is verified with next steps, or security escalation owns the case.",
    clientCopy: "We are checking account access and will only discuss private records after email verification.",
  },
  {
    area: "privacyDocuments",
    title: "Document access and retention",
    owner: "Privacy operator",
    sla: "2 business days for access/deletion intake; urgent exposure concerns same business day.",
    trigger: "Document upload, visibility change, deletion request, access request, privacy complaint.",
    evidenceNeeded: ["Account email", "Document id or name", "Linked booking reference", "Visibility state", "Request type"],
    actions: [
      "Show documents to the selected lawyer only when linked to a booking and marked visible.",
      "Record access and deletion requests with the related booking/account context.",
      "Retain only what is needed for account, booking, payment, support, and legal obligations.",
      "Confirm deletion or retention reason in plain language.",
    ],
    userOutcome: "The user sees whether the document is private, visible to the booked lawyer, deleted, or retained for a stated reason.",
    escalation: "Escalate accidental exposure, unauthorized access, or legal deletion conflict to privacy/security lead.",
    closeCondition: "Visibility, deletion request, retention reason, and audit entry are recorded and explained to the user.",
    clientCopy: "Your documents are visible to the booked lawyer only when you allow access.",
  },
  {
    area: "security",
    title: "Sensitive data incident handling",
    owner: "Security/privacy lead",
    sla: "Immediate triage; containment before normal support handling.",
    trigger: "Unauthorized access concern, payment/security mismatch, data exposure, suspicious account activity.",
    evidenceNeeded: ["Reporter email", "Affected account or reference", "Incident description", "Time noticed", "Potential exposed data"],
    actions: [
      "Contain access and preserve relevant audit context.",
      "Assess affected accounts, bookings, payments, and documents.",
      "Notify users according to severity and legal requirements.",
      "Record corrective controls before closing.",
    ],
    userOutcome: "Affected users receive confirmed information, containment status, and next steps when facts are verified.",
    escalation: "Escalate immediately to security/privacy lead; do not leave in normal support queue.",
    closeCondition: "Incident is contained, affected scope is known, notifications are decided, and corrective controls are recorded.",
    clientCopy: "We are reviewing a security concern and will contact affected users with confirmed information.",
  },
];

export const supportWorkflows: SupportWorkflow[] = [
  {
    id: "booking_failure",
    label: "Booking failure",
    area: "bookingDisputes",
    owner: "Booking support",
    sla: "Same business day",
    requiredEvidence: ["Booking reference", "selected slot", "client email", "visible error"],
    escalationRule: "Escalate if the slot is within 24 hours or payment moved.",
    userFacingResponse: "We are checking the booking and will confirm whether to retry, choose another time, or open support.",
    closeCondition: "User has a confirmed booking, a different available slot, or written no-charge closure.",
  },
  {
    id: "lawyer_cancellation",
    label: "Lawyer cancellation",
    area: "bookingDisputes",
    owner: "Booking support",
    sla: "Same business day; urgent within 24 hours",
    requiredEvidence: ["Booking reference", "lawyer id", "reason", "payment state"],
    escalationRule: "Escalate repeated or last-minute cancellations to verification.",
    userFacingResponse: "The lawyer cannot attend this time. We will help you reschedule or review the refund path.",
    closeCondition: "Client chose reschedule, alternative, refund review, or cancellation closure.",
  },
  {
    id: "slot_conflict",
    label: "Slot conflict",
    area: "bookingDisputes",
    owner: "Booking support",
    sla: "Same business day",
    requiredEvidence: ["Lawyer id", "date", "time", "booking attempt"],
    escalationRule: "Escalate repeated conflicts on the same lawyer to availability review.",
    userFacingResponse: "Η ώρα δεν είναι πλέον διαθέσιμη. Επιλέξτε άλλη ώρα.",
    closeCondition: "Conflicting slot is released or blocked and the user has a new path.",
  },
  {
    id: "payment_failure",
    label: "Payment failure",
    area: "payments",
    owner: "Payments operator",
    sla: "Same business day; immediate for duplicate charge concern",
    requiredEvidence: ["Booking reference", "Checkout session", "payment row", "user email"],
    escalationRule: "Escalate duplicate charge, webhook mismatch, or missing receipt immediately.",
    userFacingResponse: "Η πληρωμή δεν ολοκληρώθηκε. Δεν έγινε χρέωση.",
    closeCondition: "Payment is paid, failed with retry path, or escalated with processor evidence.",
  },
  {
    id: "refund_request",
    label: "Refund request",
    area: "payments",
    owner: "Payments operator",
    sla: "Same business day for eligible cancellation",
    requiredEvidence: ["Booking", "payment", "cancellation time", "reason"],
    escalationRule: "Escalate unclear policy facts to support lead.",
    userFacingResponse: "Η ακύρωση καταχωρίστηκε. Ελέγχουμε αν προβλέπεται επιστροφή.",
    closeCondition: "Refund is executed, rejected with reason, or waiting on processor.",
  },
  {
    id: "refund_review",
    label: "Refund review",
    area: "payments",
    owner: "Payments operator",
    sla: "2 business days",
    requiredEvidence: ["Booking timeline", "payment state", "messages", "cancellation reason"],
    escalationRule: "Escalate disputes or repeated partner issues to support lead.",
    userFacingResponse: "Η επιστροφή εξετάζεται από την υποστήριξη.",
    closeCondition: "Review decision and user-facing explanation are recorded.",
  },
  {
    id: "account_access",
    label: "Account access issue",
    area: "support",
    owner: "Support lead",
    sla: "2 business days; same day if it blocks paid consultation",
    requiredEvidence: ["Account email", "booking/payment reference", "access symptom"],
    escalationRule: "Escalate suspected takeover to security/privacy lead.",
    userFacingResponse: "Ελέγχουμε την πρόσβαση και θα μιλήσουμε για ιδιωτικά στοιχεία μόνο μετά την επαλήθευση email.",
    closeCondition: "Access is restored, verified, or security owns the unresolved case.",
  },
  {
    id: "document_request",
    label: "Document deletion/visibility request",
    area: "privacyDocuments",
    owner: "Privacy operator",
    sla: "2 business days; same day for exposure concern",
    requiredEvidence: ["Document id/name", "account email", "booking reference", "request type"],
    escalationRule: "Escalate unauthorized access or legal retention conflict.",
    userFacingResponse: "Ελέγχουμε ποιος μπορεί να δει το αρχείο και τι μπορεί να διαγραφεί.",
    closeCondition: "Visibility, deletion request, retention reason, and audit event are recorded.",
  },
  {
    id: "privacy_request",
    label: "Privacy request",
    area: "privacyDocuments",
    owner: "Privacy operator",
    sla: "2 business days",
    requiredEvidence: ["Account email", "request scope", "affected record"],
    escalationRule: "Escalate legal conflict or suspected exposure to security/privacy lead.",
    userFacingResponse: "Το αίτημα απορρήτου δρομολογήθηκε για έλεγχο.",
    closeCondition: "User receives access, deletion, retention reason, or escalation notice.",
  },
  {
    id: "lawyer_complaint",
    label: "Complaint against lawyer",
    area: "bookingDisputes",
    owner: "Support lead",
    sla: "2 business days; same day for abuse/safety",
    requiredEvidence: ["Booking/profile reference", "complaint reason", "messages or facts"],
    escalationRule: "Escalate repeated behavior to verification reviewer.",
    userFacingResponse: "Το παράπονο καταχωρίστηκε και θα ελεγχθεί με βάση τα στοιχεία.",
    closeCondition: "Complaint is resolved, profile action is recorded, or verification owns follow-up.",
  },
  {
    id: "review_dispute",
    label: "Review dispute",
    area: "reviews",
    owner: "Trust reviewer",
    sla: "48 hours; same day for abuse/private details",
    requiredEvidence: ["Review id", "booking reference", "dispute reason"],
    escalationRule: "Escalate threats, fraud, or confidential detail exposure.",
    userFacingResponse: "Η κριτική κρατήθηκε για έλεγχο πριν αλλάξει δημόσια.",
    closeCondition: "Review is published, rejected, edited, or open for lawyer reply.",
  },
  {
    id: "security_incident",
    label: "Security incident",
    area: "security",
    owner: "Security/privacy lead",
    sla: "Immediate triage",
    requiredEvidence: ["Reporter email", "affected record", "incident time", "data possibly exposed"],
    escalationRule: "Do not leave in normal support; contain first.",
    userFacingResponse: "Ελέγχουμε θέμα ασφάλειας και θα ενημερώσουμε με επιβεβαιωμένα στοιχεία.",
    closeCondition: "Containment, affected scope, notification decision, and corrective action are recorded.",
  },
];

export const launchGates: LaunchGate[] = [
  {
    label: "Booking and payment exception flows tested end to end",
    owner: "Payments operator",
    ready: false,
    evidence: "Slot conflict, checkout fail/open/success, cancellation, refund, and receipt paths have passing end-to-end evidence.",
  },
  {
    label: "Webhook/payment reconciliation working",
    owner: "Payments operator",
    ready: true,
    evidence: "Stripe webhook writes paid, failed, refunded, provider event, receipt, and booking payment state.",
  },
  {
    label: "Account statuses match backend truth",
    owner: "Support lead",
    ready: true,
    evidence: "Account reads canonical booking/payment states and does not imply booked equals paid.",
  },
  {
    label: "Support workflows owned with SLA",
    owner: "Operations lead",
    ready: true,
    evidence: "Every support category has owner, SLA, evidence, escalation, response, and close condition.",
  },
  {
    label: "Review publication workflow enforced",
    owner: "Trust reviewer",
    ready: true,
    evidence: "Reviews start under moderation and require completed confirmed consultation before publication.",
  },
  {
    label: "Partner verification workflow enforced",
    owner: "Verification reviewer",
    ready: true,
    evidence: "Applications remain under review until identity, license, bar association, and profile readiness pass.",
  },
  {
    label: "Backend funnel analytics live",
    owner: "Growth operations",
    ready: true,
    evidence: "Funnel events write to Supabase funnel_events with session, user, lawyer, booking, city, category, and source fields.",
  },
  {
    label: "Core city/category density achieved",
    owner: "Marketplace supply lead",
    ready: false,
    evidence: "Athens and Thessaloniki category pages meet verified, price, availability, review, and bookable thresholds.",
  },
  {
    label: "Lawyer dashboard shows ROI clearly",
    owner: "Partner success",
    ready: true,
    evidence: "Partner portal shows views/appearances proxies, booking starts, paid bookings, completion, reviews, availability, and profile proof gaps.",
  },
];

const closedOperationalStatuses = new Set(["resolved", "rejected", "suspended"]);

export const bookingPaymentEvidenceScenarios = [
  {
    label: "successful live booking",
    terms: ["successful live booking", "payment succeeded", "receipt visible", "confirmed_paid"],
  },
  {
    label: "failed payment",
    terms: ["failed payment", "checkout failed", "payment failed"],
  },
  {
    label: "refunded cancellation",
    terms: ["refunded cancellation", "refund approved", "refunded"],
  },
  {
    label: "lawyer cancelled booking",
    terms: ["lawyer cancelled", "lawyer cancellation", "reschedule"],
  },
];

const allText = (operationalCase: LaunchEvidenceCase) =>
  [operationalCase.title, operationalCase.summary, ...operationalCase.evidence].join(" ").toLowerCase();

const hasClosedCaseWithAnyTerm = (cases: LaunchEvidenceCase[], terms: string[]) =>
  cases.some((operationalCase) => {
    if (!closedOperationalStatuses.has(operationalCase.status)) return false;
    const haystack = allText(operationalCase);
    return terms.some((term) => haystack.includes(term.toLowerCase()));
  });

export const getBookingPaymentEvidenceChecks = (cases: LaunchEvidenceCase[]) =>
  bookingPaymentEvidenceScenarios.map((scenario) => ({
    ...scenario,
    ready: hasClosedCaseWithAnyTerm(cases, scenario.terms),
  }));

export const getSupportWorkflowEvidenceChecks = (cases: LaunchEvidenceCase[]) =>
  supportWorkflows.map((workflow) => ({
    id: workflow.id,
    label: workflow.label,
    ready: cases.some((operationalCase) => {
      if (operationalCase.area !== workflow.area || !closedOperationalStatuses.has(operationalCase.status)) return false;
      const haystack = allText(operationalCase);
      return haystack.includes(workflow.id.replace(/_/g, " ")) || haystack.includes(workflow.label.toLowerCase());
    }),
  }));

export const getFunnelEventCoverage = (funnelEvents: FunnelEvent[]) => {
  const counts = funnelEvents.reduce<Record<string, number>>((accumulator, event) => {
    accumulator[event.name] = (accumulator[event.name] || 0) + 1;
    return accumulator;
  }, {});
  const timestamps = funnelEvents
    .map((event) => new Date(event.occurredAt).getTime())
    .filter((timestamp) => Number.isFinite(timestamp));
  const oldest = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const newest = timestamps.length > 0 ? Math.max(...timestamps) : null;
  const observedDays = oldest && newest ? (newest - oldest) / (24 * 60 * 60 * 1000) : 0;

  return {
    observedDays,
    checks: [
      "homepage_search",
      "search_profile_opened",
      "profile_booking_start",
      "booking_created",
      "payment_opened",
      "payment_completed",
      "consultation_completed",
      "review_submitted",
      "lawyer_application_submitted",
      "lawyer_application_approved",
      "approved_lawyer_first_completed_consultation",
    ].map((eventName) => ({
      eventName,
      count: counts[eventName] || 0,
      ready: (counts[eventName] || 0) > 0,
    })),
  };
};

export const getDynamicLaunchGates = ({
  lawyers,
  funnelEvents,
  operationalCases,
  operationalCasesSource,
}: LaunchGateInputs): LaunchGate[] => {
  const paymentChecks = getPaymentReadinessChecks();
  const paymentEvidenceChecks = getBookingPaymentEvidenceChecks(operationalCases);
  const supportEvidenceChecks = getSupportWorkflowEvidenceChecks(operationalCases);
  const funnelCoverage = getFunnelEventCoverage(funnelEvents);
  const supplyReadiness = getSupplyReadiness(lawyers);
  const coreDensityReady = supplyReadiness.every((city) => city.ready && city.categories.every((category) => category.ready));

  return [
    {
      label: "Booking and payment exception flows tested end to end",
      owner: "Payments operator",
      ready: paymentChecks.every((check) => check.ready) && paymentEvidenceChecks.every((check) => check.ready),
      evidence: `${paymentEvidenceChecks.filter((check) => check.ready).length}/${paymentEvidenceChecks.length} live/staged payment scenarios closed with evidence.`,
    },
    {
      label: "Webhook/payment reconciliation working",
      owner: "Payments operator",
      ready: paymentChecks.every((check) => check.ready) && hasClosedCaseWithAnyTerm(operationalCases, ["webhook", "payment reconciliation", "receipt visible"]),
      evidence: "Requires live Stripe mode plus a closed case proving paid/failed/refunded webhook reconciliation and receipt visibility.",
    },
    {
      label: "Account statuses match backend truth",
      owner: "Support lead",
      ready: operationalCasesSource === "backend" && hasClosedCaseWithAnyTerm(operationalCases, ["account statuses", "backend truth", "confirmed_paid", "refund_requested"]),
      evidence: "Requires backend ops source plus a closed account-state evidence case.",
    },
    {
      label: "Support workflows owned with SLA",
      owner: "Operations lead",
      ready: supportWorkflows.every((workflow) => workflow.owner && workflow.sla && workflow.requiredEvidence.length > 0) && supportEvidenceChecks.every((check) => check.ready),
      evidence: `${supportEvidenceChecks.filter((check) => check.ready).length}/${supportEvidenceChecks.length} support workflows have closed staged or live evidence.`,
    },
    {
      label: "Review publication workflow enforced",
      owner: "Trust reviewer",
      ready: hasClosedCaseWithAnyTerm(operationalCases, ["review publication", "completed confirmed consultation", "under_moderation"]),
      evidence: "Requires closed moderation evidence proving reviews publish only after confirmed completion.",
    },
    {
      label: "Partner verification workflow enforced",
      owner: "Verification reviewer",
      ready: hasClosedCaseWithAnyTerm(operationalCases, ["partner verification", "application review", "approved partner"]),
      evidence: "Requires closed verification evidence proving identity/license/bar checks before approval.",
    },
    {
      label: "Backend funnel analytics live",
      owner: "Growth operations",
      ready: funnelCoverage.checks.every((check) => check.ready) && funnelCoverage.observedDays >= 7,
      evidence: `${funnelCoverage.checks.filter((check) => check.ready).length}/${funnelCoverage.checks.length} required events observed across ${funnelCoverage.observedDays.toFixed(1)} days.`,
    },
    {
      label: "Core city/category density achieved",
      owner: "Marketplace supply lead",
      ready: coreDensityReady,
      evidence: "Athens and Thessaloniki must meet verified profile thresholds and every core category must have enough coverage.",
    },
    {
      label: "Lawyer dashboard shows ROI clearly",
      owner: "Partner success",
      ready: hasClosedCaseWithAnyTerm(operationalCases, ["lawyer dashboard", "roi", "completed consultations", "paid bookings"]),
      evidence: "Requires a closed partner ROI evidence case backed by a real dashboard with live data.",
    },
    {
      label: "Operations are backend-first",
      owner: "Operations lead",
      ready: operationalCasesSource === "backend",
      evidence: operationalCasesSource === "backend" ? "Operational cases and metrics are read from Supabase." : "Operational cases are using local fallback cache.",
    },
  ];
};

const categoryText = (lawyer: Lawyer) =>
  [lawyer.specialty, lawyer.specialtyShort, lawyer.bestFor, lawyer.bio, ...lawyer.specialties, ...lawyer.specialtyKeywords].join(" ");

export const getDiscoveryDensityState = (lawyers: Lawyer[]) => {
  const withSignals = lawyers.map((lawyer) => ({
    lawyer,
    signals: getLawyerMarketplaceSignals(lawyer),
  }));
  const verified = withSignals.filter(({ signals }) => signals.verified).length;
  const withPrice = withSignals.filter(({ signals }) => signals.priceFrom > 0).length;
  const availableSoon = withSignals.filter(({ lawyer }) => isAvailableToday(lawyer) || isAvailableTomorrow(lawyer)).length;
  const reviewed = withSignals.filter(({ signals }) => signals.reviewed).length;
  const bookable = withSignals.filter(({ signals }) => signals.bookable).length;

  const checks = [
    { label: "επαληθευμένοι δικηγόροι", count: verified, minimum: discoveryDensityThresholds.minimumVerifiedLawyers },
    { label: "εμφανείς τιμές", count: withPrice, minimum: discoveryDensityThresholds.minimumWithPrice },
    { label: "κοντινή διαθεσιμότητα", count: availableSoon, minimum: discoveryDensityThresholds.minimumAvailableSoon },
    { label: "κριτικές", count: reviewed, minimum: discoveryDensityThresholds.minimumReviewed },
    { label: "κρατήσιμα προφίλ", count: bookable, minimum: discoveryDensityThresholds.minimumBookable },
  ];

  return {
    verified,
    withPrice,
    availableSoon,
    reviewed,
    bookable,
    ready: checks.every((check) => check.count >= check.minimum),
    checks,
  };
};

export const getSupplyReadiness = (lawyers: Lawyer[]) =>
  coreLaunchCities.map((city) => {
    const cityLawyers = lawyers.filter((lawyer) => includesMarketplaceText(lawyer.city, city.query));
    const categories = highIntentCategories.map((category) => {
      const count = cityLawyers.filter((lawyer) =>
        category.queries.some((query) => includesMarketplaceText(categoryText(lawyer), query)),
      ).length;
      return {
        ...category,
        count,
        ready: count >= 2,
      };
    });

    return {
      ...city,
      count: cityLawyers.length,
      ready: cityLawyers.length >= city.minimumVerified,
      categories,
    };
  });

export const getOperationalRulesByArea = (area: OperationalArea) =>
  operatingRules.filter((rule) => rule.area === area);

export const getPaymentReadinessChecks = (): PaymentReadinessCheck[] => {
  const hasSupabaseUrl = Boolean((import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim());
  const hasSupabaseAnonKey = Boolean((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim());
  const localBookingFallback = import.meta.env.VITE_ENABLE_LOCAL_BOOKING_FALLBACK === "true";
  const requireLivePayments = import.meta.env.VITE_REQUIRE_LIVE_PAYMENTS === "true";

  return [
    {
      label: "Supabase project configured",
      ready: hasSupabaseUrl && hasSupabaseAnonKey,
      detail: "Required for verified bookings, payment rows, account receipts, and webhook settlement.",
    },
    {
      label: "Local booking fallback disabled for launch",
      ready: !localBookingFallback,
      detail: "National launch should not accept paid bookings that exist only in browser storage.",
    },
    {
      label: "Live payment mode required",
      ready: requireLivePayments,
      detail: "Set VITE_REQUIRE_LIVE_PAYMENTS=true on the app and REQUIRE_LIVE_STRIPE=true on payment functions.",
    },
    {
      label: "Stripe Checkout model",
      ready: true,
      detail: "Booking payment uses Stripe-hosted Checkout Sessions, with booking metadata on the Checkout Session and PaymentIntent.",
    },
    {
      label: "Webhook settlement path",
      ready: true,
      detail: "Stripe webhook updates paid, failed, and refunded states and records provider event context.",
    },
  ];
};
