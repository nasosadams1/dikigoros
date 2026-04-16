export const userProfileTabs = [
  "overview",
  "profile",
  "bookings",
  "messages",
  "saved",
  "documents",
  "payments",
  "reviews",
  "privacy",
] as const;

export type UserProfileTab = (typeof userProfileTabs)[number];

export type ProfileActionNotice = {
  message: string;
  tone: "success" | "error" | "info";
};

const tabSet = new Set<string>(userProfileTabs);

export const parseUserProfileTab = (value: string | null | undefined): UserProfileTab =>
  value && tabSet.has(value) ? (value as UserProfileTab) : "overview";

export const getPaymentReturnNotice = (params: URLSearchParams): ProfileActionNotice | null => {
  const checkout = params.get("checkout");
  const setup = params.get("setup");

  if (checkout === "success") {
    return {
      tone: "success",
      message: "Η πληρωμή ολοκληρώθηκε. Ανανεώνουμε τις αποδείξεις και την κατάσταση της κράτησης.",
    };
  }

  if (checkout === "cancelled") {
    return {
      tone: "info",
      message: "Η πληρωμή ακυρώθηκε πριν ολοκληρωθεί. Δεν έγινε χρέωση.",
    };
  }

  if (setup === "success") {
    return {
      tone: "success",
      message: "Η μέθοδος πληρωμής συνδέθηκε με ασφάλεια μέσω Stripe.",
    };
  }

  if (setup === "cancelled") {
    return {
      tone: "info",
      message: "Η σύνδεση κάρτας ακυρώθηκε. Μπορείτε να ξεκινήσετε ξανά όποτε θέλετε.",
    };
  }

  return null;
};

export const clearPaymentReturnParams = (params: URLSearchParams) => {
  const nextParams = new URLSearchParams(params);
  nextParams.delete("checkout");
  nextParams.delete("setup");
  nextParams.delete("session_id");
  nextParams.set("tab", "payments");
  return nextParams;
};
