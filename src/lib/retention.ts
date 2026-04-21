import {
  canSubmitReview,
  getCanonicalBookingState,
  getCanonicalPaymentState,
  isBookingScheduled,
} from "@/lib/bookingState";
import type {
  StoredBooking,
  StoredPayment,
} from "@/lib/platformRepository";

export type RetentionPromptKind =
  | "review"
  | "rebook"
  | "document"
  | "payment"
  | "refund"
  | "follow_up";

export interface RetentionPrompt {
  id: string;
  kind: RetentionPromptKind;
  title: string;
  body: string;
  actionLabel: string;
  path: string;
}

export const getUserRetentionPrompts = ({
  bookings,
  payments,
  reviews,
  documents,
}: {
  bookings: StoredBooking[];
  payments: StoredPayment[];
  reviews: Array<{ bookingId?: string }>;
  documents: Array<{ bookingId?: string; linkedBookingId?: string }>;
}): RetentionPrompt[] => {
  const prompts: RetentionPrompt[] = [];
  const paymentForBooking = (bookingId: string) => payments.find((payment) => payment.bookingId === bookingId);

  bookings.forEach((booking) => {
    const payment = paymentForBooking(booking.id);
    const paymentState = payment ? getCanonicalPaymentState(payment) : "not_opened";
    const hasReview = reviews.some((review) => review.bookingId === booking.id);
    const hasDocuments = documents.some((document) => (document.bookingId || document.linkedBookingId) === booking.id);

    if (paymentState === "checkout_opened" || paymentState === "not_opened") {
      prompts.push({
        id: `payment-${booking.id}`,
        kind: "payment",
        title: "Ολοκλήρωση πληρωμής",
        body: `Ο/η ${booking.lawyerName} περιμένει την επιβεβαιωμένη πληρωμή της συμβουλευτικής.`,
        actionLabel: "Άνοιγμα πληρωμής",
        path: "/account?tab=payments",
      });
    }

    if (paymentState === "refund_requested") {
      prompts.push({
        id: `refund-${booking.id}`,
        kind: "refund",
        title: "Η επιστροφή ελέγχεται",
        body: "Η υποστήριξη ελέγχει την κράτηση και τα στοιχεία πληρωμής πριν ολοκληρωθεί η επιστροφή.",
        actionLabel: "Προβολή κατάστασης",
        path: "/account?tab=payments",
      });
    }

    if (isBookingScheduled(booking, payment) && !hasDocuments) {
      prompts.push({
        id: `documents-${booking.id}`,
        kind: "document",
        title: "Προσθήκη χρήσιμων εγγράφων",
        body: "Ανεβάστε συμβάσεις, ειδοποιήσεις, φωτογραφίες ή σημειώσεις πριν από τη συμβουλευτική.",
        actionLabel: "Προσθήκη εγγράφου",
        path: "/account?tab=documents",
      });
    }

    if (getCanonicalBookingState(booking) === "completed" && canSubmitReview(booking, payment) && !hasReview) {
      prompts.push({
        id: `review-${booking.id}`,
        kind: "review",
        title: "Αξιολόγηση συμβουλευτικής",
        body: "Οι αξιολογήσεις ανοίγουν μόνο μετά από ολοκληρωμένες συμβουλευτικές.",
        actionLabel: "Γράψτε αξιολόγηση",
        path: "/account?tab=reviews",
      });
    }

    if (getCanonicalBookingState(booking) === "completed") {
      prompts.push({
        id: `rebook-${booking.id}`,
        kind: "rebook",
        title: "Χρειάζεστε συνέχεια;",
        body: `Κλείστε νέο ραντεβού με ${booking.lawyerName} ή συγκρίνετε άλλες επιλογές.`,
        actionLabel: "Νέα κράτηση",
        path: `/lawyer/${booking.lawyerId}`,
      });
    }
  });

  return prompts.slice(0, 8);
};
