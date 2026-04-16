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
  actions: string[];
  clientCopy: string;
}

export interface PaymentReadinessCheck {
  label: string;
  ready: boolean;
  detail: string;
}

export const coreLaunchCities = [
  { label: "Athens", query: "Athens", minimumVerified: 8 },
  { label: "Thessaloniki", query: "Thessaloniki", minimumVerified: 5 },
  { label: "Patra", query: "Patras", minimumVerified: 2 },
  { label: "Heraklion", query: "Heraklion", minimumVerified: 2 },
];

export const highIntentCategories = [
  { label: "Family", queries: ["family", "divorce", "custody", "οικογεν", "διαζ"] },
  { label: "Employment", queries: ["employment", "dismissal", "εργα", "απολυ"] },
  { label: "Property", queries: ["property", "real estate", "ακιν", "κτηματο"] },
  { label: "Inheritance", queries: ["inheritance", "will", "κληρο"] },
  { label: "Criminal", queries: ["criminal", "ποιν"] },
];

export const operatingRules: OperatingRule[] = [
  {
    area: "payments",
    title: "Stripe checkout and webhook readiness",
    owner: "Payments operator",
    sla: "Same business day for payment failures; immediate review for duplicate-charge concerns.",
    trigger: "Checkout success, cancellation, async failure, refund request, or missing receipt.",
    actions: [
      "Confirm booking payment row exists and matches booking amount.",
      "Confirm Stripe checkout session, payment intent, webhook event, and receipt URL.",
      "Route eligible refunds through the original payment method.",
      "Never expose processor error payloads directly to clients.",
      "In production, require live Stripe keys and a live webhook secret before checkout can operate.",
    ],
    clientCopy: "Payment did not complete. Your card was not charged. Try again or contact support.",
  },
  {
    area: "verification",
    title: "Partner profile verification",
    owner: "Verification reviewer",
    sla: "2-3 business days after a complete application.",
    trigger: "New lawyer application, profile update, missing evidence, suspension signal.",
    actions: [
      "Check identity, license, bar association, professional details, and profile readiness.",
      "Approve only when consultation options, prices, languages, and availability are usable.",
      "Reject or request retry with a specific missing-evidence reason.",
      "Suspend or remove profiles when verification becomes stale or disputed.",
    ],
    clientCopy: "This profile is visible only after identity, license, professional details, and readiness checks.",
  },
  {
    area: "reviews",
    title: "Review moderation",
    owner: "Trust reviewer",
    sla: "48 hours for normal moderation; same business day for fraud or abuse flags.",
    trigger: "Completed booking review, lawyer dispute, abuse flag, fraud signal.",
    actions: [
      "Accept only reviews tied to completed bookings.",
      "Send review requests only after the booking is completed and the payment is settled or verified.",
      "Block private case details, abuse, conflicts of interest, spam, or unrelated content.",
      "Allow lawyer replies without exposing confidential details.",
      "Hold disputed reviews until moderation finishes.",
    ],
    clientCopy: "Reviews are published only after completed bookings and moderation checks.",
  },
  {
    area: "bookingDisputes",
    title: "Booking disputes",
    owner: "Booking support",
    sla: "Same business day for slot conflicts and no-shows; 2 business days for refund review.",
    trigger: "Client cancellation, lawyer cancellation, no-show, reschedule request, slot conflict.",
    actions: [
      "Confirm booking status, slot, payment state, and communication history.",
      "Apply free cancellation or reschedule when outside the 24-hour window.",
      "Route late cancellation and no-show cases to support review.",
      "Keep messages human-readable and avoid internal status codes.",
    ],
    clientCopy: "We are checking the booking details and will confirm the next step by email.",
  },
  {
    area: "support",
    title: "Support routing",
    owner: "Support lead",
    sla: "Urgent booking/payment: same business day. General account/privacy: 2 business days.",
    trigger: "Help center contact, failed checkout, booking failure, account access issue, complaint.",
    actions: [
      "Tag the case by booking, payment, account, document, complaint, or privacy path.",
      "Prioritize urgent bookings and payment failures.",
      "Escalate privacy/security concerns immediately.",
      "Close with a user-facing explanation and next step.",
    ],
    clientCopy: "Support has received your request and will route it to the right team.",
  },
  {
    area: "privacyDocuments",
    title: "Document access and retention",
    owner: "Privacy operator",
    sla: "2 business days for access/deletion intake; urgent exposure concerns same business day.",
    trigger: "Document upload, visibility change, deletion request, access request, privacy complaint.",
    actions: [
      "Show documents to the selected lawyer only when linked to a booking and marked visible.",
      "Record access and deletion requests with the related booking/account context.",
      "Retain only what is needed for account, booking, payment, support, and legal obligations.",
      "Confirm deletion or retention reason in plain language.",
    ],
    clientCopy: "Your documents are visible to the booked lawyer only when you allow access.",
  },
  {
    area: "security",
    title: "Sensitive data incident handling",
    owner: "Security/privacy lead",
    sla: "Immediate triage; containment before normal support handling.",
    trigger: "Unauthorized access concern, payment/security mismatch, data exposure, suspicious account activity.",
    actions: [
      "Contain access and preserve relevant audit context.",
      "Assess affected accounts, bookings, payments, and documents.",
      "Notify users according to severity and legal requirements.",
      "Record corrective controls before closing.",
    ],
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
