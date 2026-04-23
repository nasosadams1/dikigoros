import {
  getCanonicalBookingState,
  getCanonicalPaymentState,
} from "@/lib/bookingState";
import type {
  StoredBooking,
  StoredPayment,
} from "@/lib/platformRepository";

export type RetentionPromptKind =
  | "rebook"
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
}: {
  bookings: StoredBooking[];
  payments: StoredPayment[];
}): RetentionPrompt[] => {
  const prompts: RetentionPrompt[] = [];
  const paymentForBooking = (bookingId: string) => payments.find((payment) => payment.bookingId === bookingId);

  bookings.forEach((booking) => {
    const payment = paymentForBooking(booking.id);
    const paymentState = payment ? getCanonicalPaymentState(payment) : "not_opened";
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
