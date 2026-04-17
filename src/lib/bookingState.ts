import type { StoredBooking, StoredPayment } from "@/lib/platformRepository";

export type BookingState =
  | "pending_confirmation"
  | "confirmed_unpaid"
  | "confirmed_paid"
  | "completed"
  | "cancelled";

export type PaymentState =
  | "not_opened"
  | "checkout_opened"
  | "paid"
  | "failed"
  | "refund_requested"
  | "refunded";

export type ConsultationState =
  | "scheduled"
  | "completed_pending_partner_confirmation"
  | "completed_confirmed";

export type ReviewPublicationState =
  | "draft"
  | "submitted"
  | "under_moderation"
  | "published"
  | "rejected";

export const bookingStateLabels: Record<BookingState, string> = {
  pending_confirmation: "Σε έλεγχο",
  confirmed_unpaid: "Χρειάζεται πληρωμή",
  confirmed_paid: "Πληρωμένο",
  completed: "Ολοκληρωμένο",
  cancelled: "Ακυρωμένο",
};

export const paymentStateLabels: Record<PaymentState, string> = {
  not_opened: "Δεν έχει ανοίξει",
  checkout_opened: "Άνοιξε πληρωμή",
  paid: "Πληρωμένο",
  failed: "Απέτυχε",
  refund_requested: "Έλεγχος επιστροφής",
  refunded: "Επιστράφηκε",
};

export const consultationStateLabels: Record<ConsultationState, string> = {
  scheduled: "Προγραμματισμένη",
  completed_pending_partner_confirmation: "Αναμονή επιβεβαίωσης δικηγόρου",
  completed_confirmed: "Ολοκληρωμένη",
};

export const reviewPublicationStateLabels: Record<ReviewPublicationState, string> = {
  draft: "Πρόχειρη",
  submitted: "Υποβλήθηκε",
  under_moderation: "Σε έλεγχο",
  published: "Δημοσιευμένη",
  rejected: "Δεν δημοσιεύτηκε",
};

export const normalizeBookingState = (
  status?: string | null,
  paymentStatus?: string | null,
): BookingState => {
  if (status === "pending_confirmation") return "pending_confirmation";
  if (status === "confirmed_unpaid") return paymentStatus === "paid" ? "confirmed_paid" : "confirmed_unpaid";
  if (status === "confirmed_paid") return "confirmed_paid";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "confirmed") return paymentStatus === "paid" ? "confirmed_paid" : "confirmed_unpaid";
  return "pending_confirmation";
};

export const normalizePaymentState = (
  status?: string | null,
  details?: { checkoutSessionUrl?: string | null; checkoutSessionId?: string | null },
): PaymentState => {
  if (status === "not_opened") return "not_opened";
  if (status === "checkout_opened") return "checkout_opened";
  if (status === "paid") return "paid";
  if (status === "failed") return "failed";
  if (status === "refund_requested") return "refund_requested";
  if (status === "refunded") return "refunded";
  if (status === "pending") {
    return details?.checkoutSessionUrl || details?.checkoutSessionId ? "checkout_opened" : "not_opened";
  }
  return "not_opened";
};

export const normalizeReviewPublicationState = (status?: string | null): ReviewPublicationState => {
  if (status === "draft") return "draft";
  if (status === "submitted") return "submitted";
  if (status === "under_moderation") return "under_moderation";
  if (status === "published") return "published";
  if (status === "rejected") return "rejected";
  if (status === "pending_review" || status === "flagged") return "under_moderation";
  if (status === "hidden") return "rejected";
  return "under_moderation";
};

export const getCanonicalPaymentState = (payment?: Pick<StoredPayment, "status" | "checkoutSessionUrl" | "stripeCheckoutSessionId"> | null) =>
  normalizePaymentState(payment?.status, {
    checkoutSessionUrl: payment?.checkoutSessionUrl,
    checkoutSessionId: payment?.stripeCheckoutSessionId,
  });

export const getCanonicalBookingState = (
  booking: Pick<StoredBooking, "status" | "persistenceSource">,
  payment?: Pick<StoredPayment, "status" | "checkoutSessionUrl" | "stripeCheckoutSessionId"> | null,
) => {
  if (booking.persistenceSource !== "supabase" && booking.status !== "cancelled" && booking.status !== "completed") {
    return "pending_confirmation";
  }
  return normalizeBookingState(booking.status, getCanonicalPaymentState(payment));
};

export const getConsultationState = (
  booking: Pick<StoredBooking, "status" | "persistenceSource">,
): ConsultationState => {
  if (booking.status === "completed" && booking.persistenceSource === "supabase") return "completed_confirmed";
  if (booking.status === "completed") return "completed_pending_partner_confirmation";
  return "scheduled";
};

export const isBookingScheduled = (
  booking: Pick<StoredBooking, "status" | "persistenceSource">,
  payment?: Pick<StoredPayment, "status" | "checkoutSessionUrl" | "stripeCheckoutSessionId"> | null,
) => {
  const state = getCanonicalBookingState(booking, payment);
  return state === "pending_confirmation" || state === "confirmed_unpaid" || state === "confirmed_paid";
};

export const canOpenCheckout = (
  booking: Pick<StoredBooking, "status" | "persistenceSource">,
  payment?: Pick<StoredPayment, "status" | "checkoutSessionUrl" | "stripeCheckoutSessionId"> | null,
) => {
  const bookingState = getCanonicalBookingState(booking, payment);
  const paymentState = getCanonicalPaymentState(payment);
  return booking.persistenceSource === "supabase" &&
    (bookingState === "confirmed_unpaid" || paymentState === "failed" || paymentState === "checkout_opened");
};

export const canCancelBooking = (
  booking: Pick<StoredBooking, "status" | "persistenceSource">,
  payment?: Pick<StoredPayment, "status" | "checkoutSessionUrl" | "stripeCheckoutSessionId"> | null,
) => isBookingScheduled(booking, payment);

export const canSubmitReview = (
  booking: Pick<StoredBooking, "status" | "persistenceSource">,
) => getConsultationState(booking) === "completed_confirmed";

export const getPaymentSituationCopy = (
  booking: Pick<StoredBooking, "status" | "persistenceSource">,
  payment?: Pick<StoredPayment, "status" | "checkoutSessionUrl" | "stripeCheckoutSessionId" | "receiptUrl"> | null,
) => {
  const bookingState = getCanonicalBookingState(booking, payment);
  const paymentState = getCanonicalPaymentState(payment);

  if (bookingState === "pending_confirmation") {
    return "Το ραντεβού σας ελέγχεται από την ομάδα. Δεν χρειάζεται ενέργεια από εσάς τώρα.";
  }
  if (bookingState === "cancelled" && paymentState === "refunded") {
    return "Το ραντεβού ακυρώθηκε και η επιστροφή έχει ξεκινήσει στην αρχική μέθοδο πληρωμής.";
  }
  if (bookingState === "cancelled" && paymentState === "refund_requested") {
    return "Το ραντεβού ακυρώθηκε. Η υποστήριξη ελέγχει την επιστροφή.";
  }
  if (bookingState === "cancelled") {
    return "Το ραντεβού ακυρώθηκε. Δεν υπάρχει ολοκληρωμένη χρέωση.";
  }
  if (paymentState === "paid") {
    return payment?.receiptUrl
      ? "Η πληρωμή ολοκληρώθηκε και η απόδειξη είναι διαθέσιμη."
      : "Η πληρωμή ολοκληρώθηκε. Η απόδειξη θα εμφανιστεί μόλις τη στείλει ο πάροχος πληρωμών.";
  }
  if (paymentState === "failed") {
    return "Η πληρωμή δεν ολοκληρώθηκε. Δεν έγινε χρέωση και μπορείτε να δοκιμάσετε ξανά.";
  }
  if (paymentState === "checkout_opened") {
    return "Η ασφαλής πληρωμή άνοιξε, αλλά δεν έχει ολοκληρωθεί ακόμη.";
  }
  if (bookingState === "completed") {
    return "Η συμβουλευτική ολοκληρώθηκε, αλλά δεν υπάρχει ολοκληρωμένη πληρωμή σε αυτή την εγγραφή.";
  }
  return "Η πληρωμή δεν έχει ανοίξει ακόμη. Θα χρειαστεί να πληρώσετε πριν θεωρηθεί πληρωμένο το ραντεβού.";
};

export const getBookingNextStepCopy = (
  booking: Pick<StoredBooking, "status" | "persistenceSource">,
  payment?: Pick<StoredPayment, "status" | "checkoutSessionUrl" | "stripeCheckoutSessionId" | "receiptUrl"> | null,
) => {
  const bookingState = getCanonicalBookingState(booking, payment);
  const paymentState = getCanonicalPaymentState(payment);

  if (bookingState === "pending_confirmation") {
    return "Περιμένετε τον έλεγχο. Η πληρωμή θα ανοίξει μόλις το ραντεβού επιβεβαιωθεί.";
  }
  if (bookingState === "cancelled" && paymentState === "refund_requested") {
    return "Παρακολουθήστε την υπόθεση επιστροφής ή ανοίξτε υποστήριξη.";
  }
  if (bookingState === "cancelled") return "Δεν χρειάζεται άλλη ενέργεια.";
  if (paymentState === "failed") return "Δοκιμάστε ξανά την πληρωμή ή ανοίξτε υποστήριξη.";
  if (paymentState !== "paid") return "Ολοκληρώστε την πληρωμή για να εμφανιστεί απόδειξη.";
  if (bookingState === "completed") return "Η κριτική ανοίγει όταν επιβεβαιωθεί η ολοκλήρωση της συμβουλευτικής.";
  return "Ανεβάστε χρήσιμα έγγραφα και ελέγξτε τις οδηγίες του ραντεβού.";
};
