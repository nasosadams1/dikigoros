import type { Lawyer } from "@/data/lawyers";
import { includesMarketplaceText } from "@/lib/marketplace";

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
  clientCopy: string;
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
    clientCopy: "We are reviewing a security concern and will contact affected users with confirmed information.",
  },
];

const categoryText = (lawyer: Lawyer) =>
  [lawyer.specialty, lawyer.specialtyShort, lawyer.bestFor, lawyer.bio, ...lawyer.specialties, ...lawyer.specialtyKeywords].join(" ");

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
