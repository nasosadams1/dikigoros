import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  Clock,
  CreditCard,
  Heart,
  LockKeyhole,
  MapPin,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthContainer from "@/components/auth/AuthContainer";
import Footer from "@/components/Footer";
import LawyerPhoto from "@/components/LawyerPhoto";
import Navbar from "@/components/Navbar";
import { ComparisonLine, EmptyState, Field, Panel, SettingToggle } from "@/components/profile/AccountPrimitives";
import { type Lawyer } from "@/data/lawyers";
import { useAuth } from "@/context/AuthContext";
import {
  clearPartnerSession,
  cancelBooking,
  fetchBookingsForUser,
  fetchPaymentsForUser,
  getPartnerSession,
  isVerifiedBooking,
  requestBookingCheckoutSession,
  requestBookingRefund,
  submitBookingReview,
  type StoredBooking,
  type StoredPayment,
} from "@/lib/platformRepository";
import { getLawyers } from "@/lib/lawyerRepository";
import { trackFunnelEvent } from "@/lib/funnelAnalytics";
import {
  type BookingState,
  type PaymentState,
  bookingStateLabels,
  canCancelBooking,
  canOpenCheckout,
  canSubmitReview,
  getCanonicalBookingState,
  getCanonicalPaymentState,
} from "@/lib/bookingState";
import {
  fetchUserWorkspace,
  getUserWorkspace,
  syncUserWorkspace,
  type UserWorkspace,
} from "@/lib/userWorkspace";
import { clearPaymentReturnParams, getPaymentReturnNotice, parseUserProfileTab } from "@/lib/userProfileNavigation";
import { createOperationalCase } from "@/lib/operationsRepository";
import { getPriceFrom } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "settings", label: "Ρυθμίσεις", icon: Settings2 },
  { id: "bookings", label: "Ραντεβού", icon: CalendarDays },
  { id: "saved", label: "Αποθηκευμένοι δικηγόροι", icon: Heart },
  { id: "payments", label: "Πληρωμές", icon: CreditCard },
] as const;

type ActiveView = (typeof navItems)[number]["id"];
type BookingFilter = "all" | "active" | "action" | "completed" | "cancelled";
type StatusTone = "attention" | "primary" | "success" | "muted" | "danger" | "info";
type PaymentActionState = {
  loading: boolean;
  message: string;
  tone: "success" | "error" | "info";
};
type ReviewDraft = {
  rating: number;
  clarityRating: number;
  responsivenessRating: number;
  text: string;
  submitted: boolean;
};

type AccountProfileDraft = {
  name: string;
  phone: string;
};

const defaultReviewDraft: ReviewDraft = {
  rating: 5,
  clarityRating: 5,
  responsivenessRating: 5,
  text: "",
  submitted: false,
};

const bookingFilters: Array<{ id: BookingFilter; label: string }> = [
  { id: "all", label: "Όλα" },
  { id: "active", label: "Ενεργά" },
  { id: "action", label: "Χρειάζονται ενέργεια" },
  { id: "completed", label: "Ολοκληρωμένα" },
  { id: "cancelled", label: "Ακυρωμένα" },
];

const bookingStatusLabels: Record<BookingState, string> = {
  ...bookingStateLabels,
  confirmed_paid: "Επιβεβαιωμένο",
};

const paymentStatusLabels: Record<PaymentState, string> = {
  not_opened: "Απλήρωτο",
  checkout_opened: "Σε επιβεβαίωση",
  paid: "Πληρωμένο",
  failed: "Απέτυχε",
  refund_requested: "Επιστροφή σε εξέλιξη",
  refunded: "Επιστράφηκε",
};

const statusToneClasses: Record<StatusTone, string> = {
  attention: "border-gold/30 bg-gold/15 text-gold-foreground",
  primary: "border-primary/25 bg-primary/10 text-primary",
  success: "border-sage/30 bg-sage/15 text-sage-foreground",
  muted: "border-border bg-secondary text-muted-foreground",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  info: "border-primary/25 bg-primary/10 text-primary",
};

const getBookingTone = (state: BookingState): StatusTone =>
  state === "confirmed_unpaid"
    ? "attention"
    : state === "pending_confirmation"
      ? "primary"
      : state === "confirmed_paid" || state === "completed"
        ? "success"
        : "muted";

const getPaymentTone = (state: PaymentState): StatusTone =>
  state === "paid"
    ? "success"
    : state === "checkout_opened"
      ? "primary"
      : state === "refund_requested"
        ? "attention"
        : state === "failed"
          ? "danger"
          : state === "refunded"
            ? "muted"
            : "attention";

const getPaymentStatusLabel = (payment?: StoredPayment) => {
  const state = getCanonicalPaymentState(payment);
  return paymentStatusLabels[state];
};

const needsPaymentAction = (booking: StoredBooking, payment?: StoredPayment) =>
  canOpenCheckout(booking, payment) && getCanonicalPaymentState(payment) !== "paid";

const accountProfileStoragePrefix = "dikigoros.accountProfile.v1";

const getStoredAccountProfile = (identityKey?: string | null): AccountProfileDraft => {
  if (typeof window === "undefined") {
    return { name: "", phone: "" };
  }

  try {
    const rawValue = window.localStorage.getItem(`${accountProfileStoragePrefix}.${identityKey || "guest"}`);
    if (!rawValue) return { name: "", phone: "" };

    const parsed = JSON.parse(rawValue) as Partial<AccountProfileDraft>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
    };
  } catch {
    return { name: "", phone: "" };
  }
};

const saveStoredAccountProfile = (identityKey: string | null | undefined, draft: AccountProfileDraft) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${accountProfileStoragePrefix}.${identityKey || "guest"}`, JSON.stringify(draft));
};

const UserProfile = ({ embedded = false }: { embedded?: boolean }) => {
  const {
    user,
    profile,
    signOut,
    updateEmail: updateAccountEmail,
    updatePassword: updateAccountPassword,
    updateProfile: updateAccountProfile,
  } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [authOpen, setAuthOpen] = useState(false);
  const [partnerSession, setPartnerSession] = useState(() => getPartnerSession());
  const [activeView, setActiveView] = useState<ActiveView>(() => parseUserProfileTab(searchParams.get("tab")));
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
  const [bookingVersion, setBookingVersion] = useState(0);
  const [bookings, setBookings] = useState<StoredBooking[]>([]);
  const [payments, setPayments] = useState<StoredPayment[]>([]);
  const [lawyerCatalog, setLawyerCatalog] = useState<Lawyer[]>([]);
  const [paymentSetupState, setPaymentSetupState] = useState<PaymentActionState>({
    loading: false,
    message: "",
    tone: "info",
  });
  const [accountSyncState, setAccountSyncState] = useState<PaymentActionState>({
    loading: false,
    message: "",
    tone: "info",
  });
  const [bookingActionState, setBookingActionState] = useState<PaymentActionState>({
    loading: false,
    message: "",
    tone: "info",
  });
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [reviewActionState, setReviewActionState] = useState<Record<string, PaymentActionState>>({});
  const [profileSaveState, setProfileSaveState] = useState<PaymentActionState>({
    loading: false,
    message: "",
    tone: "info",
  });
  const [securityState, setSecurityState] = useState<PaymentActionState>({
    loading: false,
    message: "",
    tone: "info",
  });
  const [profileDraft, setProfileDraft] = useState<AccountProfileDraft>({
    name: "",
    phone: "",
  });
  const [emailDraft, setEmailDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState({
    password: "",
    confirmPassword: "",
  });
  const [profileDraftDirty, setProfileDraftDirty] = useState(false);
  const [workspace, setWorkspace] = useState<UserWorkspace>(() => getUserWorkspace(user?.id));
  const workspaceRef = useRef(workspace);
  const [localAccountProfile, setLocalAccountProfile] = useState<AccountProfileDraft>(() =>
    getStoredAccountProfile(user?.id),
  );

  const userId = user?.id;
  const workspaceKey = userId || undefined;
  const hasAccountAccess = Boolean(user);
  const userEmail = profile?.email || user?.email || "";
  const displayName =
    profile?.name ||
    localAccountProfile.name ||
    user?.user_metadata?.display_name ||
    userEmail.split("@")[0] ||
    "Χρήστης";
  const userPhone = profile?.phone || localAccountProfile.phone || "";
  const accountDisplayName = localAccountProfile.name || displayName;
  const accountPhone = localAccountProfile.phone || userPhone;
  const paymentForBooking = (bookingId: string) => payments.find((payment) => payment.bookingId === bookingId);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    setWorkspace(getUserWorkspace(workspaceKey));
    void fetchUserWorkspace(workspaceKey, userId).then(setWorkspace).catch(() => {
      setAccountSyncState({
        loading: false,
        message: "Τα στοιχεία λογαριασμού είναι προσωρινά μη διαθέσιμα. Ανανεώστε σε λίγο για να δείτε κρατήσεις και πληρωμές από το σύστημα.",
        tone: "error",
      });
    });
  }, [userId, workspaceKey]);

  useEffect(() => {
    setLocalAccountProfile(getStoredAccountProfile(workspaceKey));
    setProfileDraftDirty(false);
  }, [workspaceKey]);

  useEffect(() => {
    if (profileDraftDirty) return;

    setProfileDraft({
      name: accountDisplayName,
      phone: accountPhone,
    });
  }, [accountDisplayName, accountPhone, profileDraftDirty]);

  useEffect(() => {
    setEmailDraft(userEmail);
  }, [userEmail]);

  useEffect(() => {
    setActiveView(parseUserProfileTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    const notice = getPaymentReturnNotice(searchParams);
    if (!notice) return;

    setActiveView("payments");
    setPaymentSetupState({
      loading: false,
      message: notice.message,
      tone: notice.tone,
    });
    setBookingVersion((version) => version + 1);
    setSearchParams(clearPaymentReturnParams(searchParams), { replace: true });
  }, [searchParams, setSearchParams, userId]);

  useEffect(() => {
    let active = true;

    void Promise.all([
      fetchBookingsForUser(userId, userEmail),
      fetchPaymentsForUser(userId, userEmail),
    ]).then(([nextBookings, nextPayments]) => {
      if (!active) return;
      setBookings(nextBookings);
      setPayments(nextPayments);
    }).catch(() => {
      if (!active) return;
      setBookings([]);
      setPayments([]);
      setBookingActionState({
        loading: false,
        message: "Οι κρατήσεις και οι πληρωμές είναι προσωρινά μη διαθέσιμες. Δεν εμφανίζουμε τοπική κατάσταση όταν το σύστημα δεν απαντά.",
        tone: "error",
      });
    });

    return () => {
      active = false;
    };
  }, [bookingVersion, userEmail, userId]);

  useEffect(() => {
    let active = true;
    void getLawyers().then((nextLawyers) => {
      if (active) setLawyerCatalog(nextLawyers);
    });

    return () => {
      active = false;
    };
  }, [workspace.savedLawyerIds, workspace.comparedLawyerIds]);

  const activeBookings = bookings.filter((booking) => canCancelBooking(booking, paymentForBooking(booking.id)));
  const pendingPaymentBookings = bookings.filter((booking) => needsPaymentAction(booking, paymentForBooking(booking.id)));
  const nextBooking = activeBookings[0];
  const paidPayments = payments.filter((payment) => getCanonicalPaymentState(payment) === "paid");
  const filteredBookings = bookings.filter((booking) => {
    const payment = paymentForBooking(booking.id);
    const state = getCanonicalBookingState(booking, payment);
    if (bookingFilter === "active") return canCancelBooking(booking, payment);
    if (bookingFilter === "action") return needsPaymentAction(booking, payment);
    if (bookingFilter === "completed") return state === "completed";
    if (bookingFilter === "cancelled") return state === "cancelled";
    return true;
  });
  const filterCounts: Record<BookingFilter, number> = {
    all: bookings.length,
    active: activeBookings.length,
    action: pendingPaymentBookings.length,
    completed: bookings.filter((booking) => getCanonicalBookingState(booking, paymentForBooking(booking.id)) === "completed").length,
    cancelled: bookings.filter((booking) => getCanonicalBookingState(booking, paymentForBooking(booking.id)) === "cancelled").length,
  };
  const savedLawyers = useMemo(
    () => workspace.savedLawyerIds.map((id) => lawyerCatalog.find((lawyer) => lawyer.id === id)).filter(Boolean),
    [lawyerCatalog, workspace.savedLawyerIds],
  );
  const comparedLawyers = useMemo(
    () => workspace.comparedLawyerIds.map((id) => lawyerCatalog.find((lawyer) => lawyer.id === id)).filter(Boolean),
    [lawyerCatalog, workspace.comparedLawyerIds],
  );

  const persistWorkspace = (updater: (currentWorkspace: UserWorkspace) => UserWorkspace) => {
    const nextWorkspace = updater(workspaceRef.current);
    workspaceRef.current = nextWorkspace;
    setWorkspace(nextWorkspace);
    void syncUserWorkspace(workspaceKey, nextWorkspace, userId).then((syncedWorkspace) => {
      workspaceRef.current = syncedWorkspace;
      setWorkspace(syncedWorkspace);
      setAccountSyncState({ loading: false, message: "", tone: "info" });
    }).catch(() => {
      setAccountSyncState({
        loading: false,
        message: "Δεν έγινε αποθήκευση στο σύστημα. Οι αλλαγές λογαριασμού δεν θεωρούνται οριστικές.",
        tone: "error",
      });
    });
  };

  const updateProfileDraft = (updates: Partial<AccountProfileDraft>) => {
    setProfileDraftDirty(true);
    setProfileDraft((current) => ({
      ...current,
      ...updates,
    }));
    setProfileSaveState({
      loading: false,
      message: "Υπάρχουν αλλαγές που πρέπει να αποθηκευτούν.",
      tone: "info",
    });
  };

  const handleSaveAccountProfile = async () => {
    if (!workspaceKey) return;

    const nextDraft = {
      name: profileDraft.name.trim(),
      phone: profileDraft.phone.trim(),
    };

    if (!nextDraft.name) {
      setProfileSaveState({
        loading: false,
        message: "Το ονοματεπώνυμο είναι υποχρεωτικό για κρατήσεις και επικοινωνία.",
        tone: "error",
      });
      return;
    }

    setProfileSaveState({ loading: true, message: "Αποθήκευση στοιχείων...", tone: "info" });

    try {
      if (userId) {
        await updateAccountProfile({
          name: nextDraft.name,
          phone: nextDraft.phone,
        });
      } else {
        saveStoredAccountProfile(workspaceKey, nextDraft);
        setLocalAccountProfile(nextDraft);
      }
      const nextWorkspace = await syncUserWorkspace(workspaceKey, workspace, userId);

      setWorkspace(nextWorkspace);
      setProfileDraft(nextDraft);
      setProfileDraftDirty(false);
      setProfileSaveState({
        loading: false,
        message: "Τα στοιχεία σας ενημερώθηκαν.",
        tone: "success",
      });
    } catch {
      setProfileSaveState({
        loading: false,
        message: "Δεν έγινε αποθήκευση. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.",
        tone: "error",
      });
    }
  };

  const handleUpdateAccountEmail = async () => {
    const nextEmail = emailDraft.trim().toLowerCase();
    if (!userId) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setSecurityState({
        loading: false,
        message: "Πληκτρολογήστε έγκυρη διεύθυνση email.",
        tone: "error",
      });
      return;
    }

    if (nextEmail === userEmail.toLowerCase()) {
      setSecurityState({
        loading: false,
        message: "Το email σύνδεσης είναι ήδη αυτό.",
        tone: "info",
      });
      return;
    }

    setSecurityState({ loading: true, message: "Αποστολή επιβεβαίωσης email...", tone: "info" });

    const { error } = await updateAccountEmail(nextEmail);
    if (error) {
      setSecurityState({
        loading: false,
        message: error.message || "Δεν έγινε αλλαγή email. Δοκιμάστε ξανά.",
        tone: "error",
      });
      return;
    }

    setSecurityState({
      loading: false,
      message: "Στείλαμε email επιβεβαίωσης στη νέα διεύθυνση. Η αλλαγή ολοκληρώνεται μετά την επιβεβαίωση.",
      tone: "success",
    });
  };

  const handleUpdateAccountPassword = async () => {
    if (!userId) return;
    const nextPassword = passwordDraft.password;

    if (nextPassword.length < 8) {
      setSecurityState({
        loading: false,
        message: "Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.",
        tone: "error",
      });
      return;
    }

    if (nextPassword !== passwordDraft.confirmPassword) {
      setSecurityState({
        loading: false,
        message: "Οι κωδικοί δεν ταιριάζουν.",
        tone: "error",
      });
      return;
    }

    setSecurityState({ loading: true, message: "Ενημέρωση κωδικού...", tone: "info" });

    const { error } = await updateAccountPassword(nextPassword);
    if (error) {
      setSecurityState({
        loading: false,
        message: error.message || "Δεν έγινε αλλαγή κωδικού. Δοκιμάστε ξανά.",
        tone: "error",
      });
      return;
    }

    setPasswordDraft({ password: "", confirmPassword: "" });
    setSecurityState({
      loading: false,
      message: "Ο κωδικός πρόσβασης ενημερώθηκε.",
      tone: "success",
    });
  };

  const selectView = (view: ActiveView) => {
    setActiveView(view);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", view);
    nextParams.delete("checkout");
    nextParams.delete("setup");
    nextParams.delete("session_id");
    setSearchParams(nextParams, { replace: true });
  };

  const removeSavedLawyer = (lawyerId: string) => {
    persistWorkspace((currentWorkspace) => ({
      ...currentWorkspace,
      savedLawyerIds: currentWorkspace.savedLawyerIds.filter((id) => id !== lawyerId),
      comparedLawyerIds: currentWorkspace.comparedLawyerIds.filter((id) => id !== lawyerId),
    }));
  };

  const toggleComparedLawyer = (lawyerId: string) => {
    persistWorkspace((currentWorkspace) => {
      const comparedLawyerIds = currentWorkspace.comparedLawyerIds.includes(lawyerId)
        ? currentWorkspace.comparedLawyerIds.filter((id) => id !== lawyerId)
        : [lawyerId, ...currentWorkspace.comparedLawyerIds].slice(0, 3);

      return { ...currentWorkspace, comparedLawyerIds };
    });
  };

  const handleCancelBookingWithRefund = (bookingId: string) => {
    if (!userId) {
      setBookingActionState({
        loading: false,
        message: "Συνδεθείτε με λογαριασμό πελάτη για να ακυρώσετε επαληθευμένη κράτηση. Δεν έγινε καμία αλλαγή.",
        tone: "error",
      });
      setAuthOpen(true);
      return;
    }

    const booking = bookings.find((item) => item.id === bookingId);
    const payment = payments.find((item) => item.bookingId === bookingId);

    void (async () => {
      await cancelBooking(bookingId);

      if (booking && getCanonicalPaymentState(payment) === "paid" && isVerifiedBooking(booking)) {
        const refund = await requestBookingRefund(booking);
        if (refund.status === "review_required") {
          void createOperationalCase({
            area: "payments",
            title: "Έλεγχος επιστροφής μετά από ακύρωση",
            summary: `Η πληρωμένη κράτηση ${booking.referenceId} ακυρώθηκε και χρειάζεται έλεγχο υποστήριξης πριν ολοκληρωθεί η επιστροφή.`,
            priority: "high",
            requesterEmail: booking.clientEmail,
            relatedReference: payment.invoiceNumber || booking.referenceId,
            evidence: [
              `Κράτηση: ${booking.referenceId}`,
              `Κατάσταση πληρωμής πριν την ακύρωση: ${payment.status}`,
              `Δικηγόρος: ${booking.lawyerName}`,
            ],
          });
          setBookingActionState({
            loading: false,
            message: "Η ακύρωση καταχωρίστηκε. Η επιστροφή εξετάζεται από την υποστήριξη.",
            tone: "info",
          });
        } else {
          setBookingActionState({
            loading: false,
            message:
              refund.status === "refunded"
                ? "Η ακύρωση καταχωρίστηκε και η επιστροφή ξεκίνησε στην αρχική μέθοδο πληρωμής."
                : "Η ακύρωση καταχωρίστηκε. Η επιστροφή ζητήθηκε στην αρχική μέθοδο πληρωμής.",
            tone: "success",
          });
        }
      } else {
        setBookingActionState({
          loading: false,
          message: "Η ακύρωση καταχωρίστηκε. Δεν έγινε χρέωση για αυτή την κράτηση.",
          tone: "success",
        });
      }

      setBookingVersion((version) => version + 1);
    })().catch(() => {
      setBookingActionState({
        loading: false,
        message: "Δεν μπορέσαμε να ολοκληρώσουμε την ακύρωση τώρα. Δοκιμάστε ξανά ή ανοίξτε υποστήριξη.",
        tone: "error",
      });
    });
  };

  const handleBookingCheckout = async (booking: StoredBooking) => {
    if (!userId) {
      setPaymentSetupState({
        loading: false,
        message: "Συνδεθείτε με λογαριασμό πελάτη για να ανοίξει η ασφαλής πληρωμή της κράτησης.",
        tone: "error",
      });
      setAuthOpen(true);
      return;
    }

    if (!isVerifiedBooking(booking)) {
      setPaymentSetupState({
        loading: false,
        message: "Το ραντεβού σας ελέγχεται από την ομάδα. Δεν χρειάζεται ενέργεια από εσάς τώρα. Η πληρωμή θα ανοίξει μόλις ολοκληρωθεί αυτός ο έλεγχος.",
        tone: "error",
      });
      return;
    }

    setPaymentSetupState({ loading: true, message: "", tone: "info" });
    try {
      const session = await requestBookingCheckoutSession(booking);
      setPayments(await fetchPaymentsForUser(userId, userEmail));
      setPaymentSetupState({
        loading: false,
        message: session.url
          ? "Μεταφορά σε ασφαλή πληρωμή μέσω Stripe."
          : "Δεν μπορέσαμε να ανοίξουμε την ασφαλή πληρωμή. Η κράτηση μένει χωρίς χρέωση μέχρι να ολοκληρωθεί σωστά.",
        tone: session.url ? "info" : "error",
      });

      if (session.url && typeof window !== "undefined") {
        trackFunnelEvent("payment_opened", {
          bookingId: booking.id,
          lawyerId: booking.lawyerId,
          userId,
          amount: booking.price,
          surface: "account",
        });
        window.location.assign(session.url);
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "";
      setPaymentSetupState({
        loading: false,
        message: message
          ? `Η σελίδα πληρωμής δεν άνοιξε: ${message}`
          : "Η σελίδα πληρωμής δεν άνοιξε. Δεν έγινε χρέωση.",
        tone: "error",
      });
    }
  };

  const updateReviewDraft = (bookingId: string, updates: Partial<ReviewDraft>) => {
    setReviewDrafts((current) => ({
      ...current,
      [bookingId]: {
        ...(current[bookingId] || defaultReviewDraft),
        ...updates,
      },
    }));
    setReviewActionState((current) => ({
      ...current,
      [bookingId]: { loading: false, message: "", tone: "info" },
    }));
  };

  const handleSubmitReview = async (booking: StoredBooking) => {
    const draft = reviewDrafts[booking.id] || defaultReviewDraft;
    const payment = paymentForBooking(booking.id);
    if (!canSubmitReview(booking) || getCanonicalPaymentState(payment) !== "paid") {
      setReviewActionState((current) => ({
        ...current,
        [booking.id]: {
          loading: false,
          message: "Η αξιολόγηση ανοίγει μόνο μετά από ολοκληρωμένη και πληρωμένη συμβουλευτική.",
          tone: "error",
        },
      }));
      return;
    }

    if (draft.text.trim().length < 12) {
      setReviewActionState((current) => ({
        ...current,
        [booking.id]: {
          loading: false,
          message: "Γράψτε τουλάχιστον μία σύντομη πρόταση για την εμπειρία σας.",
          tone: "error",
        },
      }));
      return;
    }

    setReviewActionState((current) => ({
      ...current,
      [booking.id]: {
        loading: true,
        message: "Αποθήκευση αξιολόγησης...",
        tone: "info",
      },
    }));

    try {
      await submitBookingReview({
        bookingId: booking.id,
        lawyerId: booking.lawyerId,
        rating: draft.rating,
        clarityRating: draft.clarityRating,
        responsivenessRating: draft.responsivenessRating,
        text: draft.text,
        clientName: booking.clientName,
        consultationType: booking.consultationType,
      });
      trackFunnelEvent("review_submitted", {
        bookingId: booking.id,
        lawyerId: booking.lawyerId,
        userId,
        rating: draft.rating,
      });
      setReviewDrafts((current) => ({
        ...current,
        [booking.id]: {
          ...draft,
          submitted: true,
        },
      }));
      setReviewActionState((current) => ({
        ...current,
        [booking.id]: {
          loading: false,
          message: "Η αξιολόγηση στάλθηκε για έλεγχο πριν δημοσιευτεί.",
          tone: "success",
        },
      }));
    } catch (error) {
      setReviewActionState((current) => ({
        ...current,
        [booking.id]: {
          loading: false,
          message: error instanceof Error && error.message ? error.message : "Η αξιολόγηση δεν αποθηκεύτηκε. Δοκιμάστε ξανά.",
          tone: "error",
        },
      }));
    }
  };

  const updateBooleanSetting = (
    group: "privacy" | "notifications",
    key: keyof UserWorkspace["privacy"] | keyof UserWorkspace["notifications"],
  ) => {
    persistWorkspace((currentWorkspace) => ({
      ...currentWorkspace,
      [group]: {
        ...currentWorkspace[group],
        [key]: !currentWorkspace[group][key],
      },
    }));
  };

  const handleAccountSignOut = async () => {
    if (partnerSession) {
      clearPartnerSession();
      setPartnerSession(null);
    }

    if (user) {
      await signOut();
    }
  };

  if (!hasAccountAccess) {
    return (
      <div className={embedded ? "" : "min-h-screen bg-background"}>
        {embedded ? null : <Navbar />}
        <main className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-foreground/[0.05]">
            <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
              <section className="p-6 text-left md:p-10">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <p className="mt-6 text-xs font-bold uppercase tracking-widest text-primary">Ιδιωτικός χώρος πελάτη</p>
                <h1 className="mt-2 max-w-2xl font-serif text-3xl tracking-tight text-foreground md:text-4xl">
                  Ο ιδιωτικός χώρος πελάτη είναι διαθέσιμος μόνο μετά τη σύνδεση
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Εδώ διαχειρίζεστε κρατήσεις, πληρωμές, αποθηκευμένους δικηγόρους και ρυθμίσεις ιδιωτικότητας. Τα στοιχεία αυτά δεν προβάλλονται δημόσια.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Button onClick={() => setAuthOpen(true)} className="rounded-lg px-6 font-bold">
                    Σύνδεση
                  </Button>
                  <Button asChild variant="outline" className="rounded-lg px-6 font-bold">
                    <Link to="/search">Αναζήτηση δικηγόρου</Link>
                  </Button>
                </div>
              </section>
              <aside className="border-t border-border bg-secondary/35 p-6 lg:border-l lg:border-t-0">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Τι προστατεύεται</p>
                <div className="mt-4 space-y-3">
                  {[
                    "Το προφίλ δεν είναι δημόσιο.",
                    "Οι κρατήσεις και οι πληρωμές ανοίγουν μόνο μετά τη σύνδεση.",
                    "Το τηλέφωνο κοινοποιείται μόνο όπου το επιτρέπετε.",
                  ].map((item) => (
                    <div key={item} className="flex gap-2 text-sm font-semibold leading-6 text-foreground">
                      <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-sage-foreground" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </main>
        {embedded ? null : <Footer />}
        {embedded ? null : <AuthContainer open={authOpen} onClose={() => setAuthOpen(false)} />}
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "min-h-screen bg-background"}>
      {embedded ? null : <Navbar />}

      <main className={embedded ? "" : "mx-auto max-w-7xl px-4 py-4 lg:px-6 lg:py-6"}>
        <section className="rounded-xl border border-border bg-card p-5 shadow-lg shadow-foreground/[0.03] lg:p-6">
          <div className="grid gap-5 xl:grid-cols-[1fr_520px] xl:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Ιδιωτικός χώρος πελάτη</p>
              <h1 className="mt-2 font-serif text-3xl tracking-tight text-foreground md:text-4xl">Καλησπέρα, {displayName}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Διαχειριστείτε ραντεβού, πληρωμές, αποθηκευμένους δικηγόρους και ρυθμίσεις ιδιωτικότητας χωρίς δημόσια προβολή.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <SummaryStat label="Ενεργά ραντεβού" value={String(activeBookings.length)} />
              <SummaryStat label="Επόμενο" value={nextBooking?.dateLabel || "Δεν υπάρχει"} />
              <SummaryStat label="Εκκρεμότητες" value={pendingPaymentBookings.length ? `${pendingPaymentBookings.length} πληρωμή` : "Καμία"} tone={pendingPaymentBookings.length ? "attention" : "success"} />
            </div>
          </div>
        </section>

        {accountSyncState.message || bookingActionState.message ? (
          <div className="mt-4 grid gap-3">
            {accountSyncState.message ? (
              <p
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm font-semibold",
                  accountSyncState.tone === "success" && "border-sage/25 bg-sage/10 text-sage-foreground",
                  accountSyncState.tone === "error" && "border-destructive/20 bg-destructive/10 text-destructive",
                  accountSyncState.tone === "info" && "border-primary/20 bg-primary/10 text-primary",
                )}
              >
                {accountSyncState.message}
              </p>
            ) : null}
            {bookingActionState.message ? (
              <p
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm font-semibold",
                  bookingActionState.tone === "success" && "border-sage/25 bg-sage/10 text-sage-foreground",
                  bookingActionState.tone === "error" && "border-destructive/20 bg-destructive/10 text-destructive",
                  bookingActionState.tone === "info" && "border-primary/20 bg-primary/10 text-primary",
                )}
              >
                {bookingActionState.message}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
          <ClientSidebar
            activeView={activeView}
            accountName={accountDisplayName}
            accountEmail={userEmail}
            onSelect={selectView}
            onSignOut={() => void handleAccountSignOut()}
          />

          <section className="min-w-0">
            {activeView === "settings" ? (
              <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <div className="space-y-5">
                  <Panel title="Στοιχεία λογαριασμού" eyebrow="Ρυθμίσεις">
                    <AccountProfileForm
                      draft={profileDraft}
                      saveState={profileSaveState}
                      onChange={updateProfileDraft}
                      onSave={() => void handleSaveAccountProfile()}
                    />
                  </Panel>

                  <Panel title="Email και κωδικός" eyebrow="Ασφάλεια πρόσβασης">
                    <AccountSecurityForm
                      currentEmail={userEmail}
                      emailDraft={emailDraft}
                      passwordDraft={passwordDraft}
                      saveState={securityState}
                      onEmailChange={setEmailDraft}
                      onPasswordChange={setPasswordDraft}
                      onSaveEmail={() => void handleUpdateAccountEmail()}
                      onSavePassword={() => void handleUpdateAccountPassword()}
                    />
                  </Panel>

                  <Panel title="Ιδιωτικότητα και ειδοποιήσεις" eyebrow="Έλεγχος δεδομένων">
                    <div className="grid gap-3">
                      <SettingToggle
                        icon={ShieldCheck}
                        title="Κοινοποίηση τηλεφώνου μετά την κράτηση"
                        description="Το τηλέφωνό σας δεν εμφανίζεται σε δικηγόρους που απλώς βλέπετε ή αποθηκεύετε."
                        enabled={workspace.privacy.sharePhoneWithBookedLawyers}
                        onToggle={() => updateBooleanSetting("privacy", "sharePhoneWithBookedLawyers")}
                      />
                      <SettingToggle
                        icon={Bell}
                        title="Υπενθυμίσεις ραντεβού"
                        description="Λαμβάνετε χρήσιμες υπενθυμίσεις πριν από προγραμματισμένο ραντεβού."
                        enabled={workspace.notifications.reminders}
                        onToggle={() => updateBooleanSetting("notifications", "reminders")}
                      />
                      <SettingToggle
                        icon={Settings2}
                        title="Ενημερώσεις προϊόντος"
                        description="Προαιρετικές ενημερώσεις που δεν επηρεάζουν κρατήσεις ή πληρωμές."
                        enabled={workspace.privacy.productUpdates}
                        onToggle={() => updateBooleanSetting("privacy", "productUpdates")}
                        secondary
                      />
                    </div>
                  </Panel>
                </div>
                <PrivacyTrustBlock />
              </div>
            ) : null}

            {activeView === "bookings" ? (
              <Panel title="Τα ραντεβού σας" eyebrow="Ραντεβού">
                <BookingFilterBar activeFilter={bookingFilter} counts={filterCounts} onChange={setBookingFilter} />
                <div className="mt-4 grid gap-3">
                  {filteredBookings.length > 0 ? (
                    filteredBookings.map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        payment={payments.find((payment) => payment.bookingId === booking.id)}
                        onCancel={handleCancelBookingWithRefund}
                        onCheckout={handleBookingCheckout}
                        reviewDraft={reviewDrafts[booking.id] || defaultReviewDraft}
                        reviewState={reviewActionState[booking.id]}
                        onReviewChange={(updates) => updateReviewDraft(booking.id, updates)}
                        onReviewSubmit={() => void handleSubmitReview(booking)}
                      />
                    ))
                  ) : (
                    <EmptyState
                      icon={CalendarDays}
                      title="Δεν υπάρχουν ραντεβού σε αυτό το φίλτρο"
                      description="Αλλάξτε φίλτρο ή κλείστε νέο ραντεβού όταν είστε έτοιμοι."
                      action={<Button asChild className="rounded-lg font-bold"><Link to="/search">Κλείστε ραντεβού</Link></Button>}
                    />
                  )}
                </div>
              </Panel>
            ) : null}

            {activeView === "saved" ? (
              <div className="space-y-5">
                <Panel title="Αποθηκευμένοι δικηγόροι" eyebrow="Ιδιωτική λίστα αποφάσεων">
                  {savedLawyers.length > 0 ? (
                    <div className="space-y-3">
                      {savedLawyers.map((lawyer) => lawyer && (
                        <SavedLawyerRow
                          key={lawyer.id}
                          lawyer={lawyer}
                          compared={workspace.comparedLawyerIds.includes(lawyer.id)}
                          note={workspace.lawyerNotes[lawyer.id] || ""}
                          onCompare={() => toggleComparedLawyer(lawyer.id)}
                          onRemove={() => removeSavedLawyer(lawyer.id)}
                          onNote={(note) =>
                            persistWorkspace((currentWorkspace) => ({
                              ...currentWorkspace,
                              lawyerNotes: {
                                ...currentWorkspace.lawyerNotes,
                                [lawyer.id]: note,
                              },
                            }))
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Search} title="Η λίστα είναι άδεια" description="Αποθηκεύστε προφίλ από την αναζήτηση ή τη σελίδα δικηγόρου." />
                  )}
                </Panel>

                <Panel title="Ενεργή σύγκριση έως 3 δικηγόρων" eyebrow="Απόφαση">
                  {comparedLawyers.length > 0 ? (
                    <>
                    <div className="grid gap-3 md:grid-cols-3">
                      {comparedLawyers.map((lawyer) => lawyer && (
                        <div key={lawyer.id} className="rounded-lg border border-border bg-secondary/45 p-4">
                          <p className="font-bold text-foreground">{lawyer.name}</p>
                          <p className="mt-1 text-xs font-semibold text-primary/80">{lawyer.specialty}</p>
                          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <ComparisonLine label="Τιμή από" value={`€${getPriceFrom(lawyer)}`} />
                            <ComparisonLine label="Εμπειρία" value={`${lawyer.experience} έτη`} />
                            <ComparisonLine label="Απάντηση" value={lawyer.response} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button asChild className="mt-4 rounded-lg font-bold">
                      <Link to={`/compare?lawyers=${comparedLawyers.map((lawyer) => lawyer?.id).filter(Boolean).join(",")}`}>
                        Δείτε την πλήρη σύγκριση
                      </Link>
                    </Button>
                    </>
                  ) : (
                    <EmptyState
                      icon={Heart}
                      title="Δεν υπάρχει ενεργή σύγκριση"
                      description="Αποθηκεύστε έως 3 δικηγόρους για άμεση σύγκριση βασικών διαφορών."
                    />
                  )}
                </Panel>
              </div>
            ) : null}

            {activeView === "payments" ? (
              <div className="space-y-5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <SummaryStat label="Εκκρεμείς πληρωμές" value={String(pendingPaymentBookings.length)} tone={pendingPaymentBookings.length ? "attention" : "success"} />
                  <SummaryStat label="Ολοκληρωμένες πληρωμές" value={String(paidPayments.length)} />
                </div>
                <Panel title="Πληρωμές" eyebrow="Κατάσταση πληρωμής">
                  {paymentSetupState.message ? <ActionNotice state={paymentSetupState} /> : null}
                  {bookings.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {bookings.map((booking) => (
                        <PaymentCard
                          key={booking.id}
                          booking={booking}
                          payment={payments.find((payment) => payment.bookingId === booking.id)}
                          onCheckout={() => handleBookingCheckout(booking)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={CreditCard} title="Καμία ενεργή πληρωμή" description="Οι πληρωμές εμφανίζονται μόνο μετά από κράτηση." />
                  )}
                </Panel>
              </div>
            ) : null}

          </section>
        </div>
      </main>

      {embedded ? null : <Footer />}
    </div>
  );
};

const StatusChip = ({ label, tone }: { label: string; tone: StatusTone }) => (
  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold", statusToneClasses[tone])}>
    {label}
  </span>
);

const SummaryStat = ({ label, value, tone = "info" }: { label: string; value: string; tone?: StatusTone }) => (
  <div className={cn("rounded-lg border px-3 py-2", tone === "attention" ? "border-gold/25 bg-gold/10" : tone === "success" ? "border-sage/25 bg-sage/10" : "border-border bg-secondary/35")}>
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="mt-1 truncate text-sm font-bold text-foreground">{value}</p>
  </div>
);

const ActionNotice = ({ state }: { state: PaymentActionState }) => (
  <p
    aria-live="polite"
    className={cn(
      "rounded-lg border px-3 py-2 text-sm font-semibold",
      state.tone === "success" && "border-sage/25 bg-sage/10 text-sage-foreground",
      state.tone === "error" && "border-destructive/20 bg-destructive/10 text-destructive",
      state.tone === "info" && "border-primary/20 bg-primary/10 text-primary",
    )}
  >
    {state.message}
  </p>
);

const ClientSidebar = ({
  activeView,
  accountName,
  accountEmail,
  onSelect,
  onSignOut,
}: {
  activeView: ActiveView;
  accountName: string;
  accountEmail: string;
  onSelect: (view: ActiveView) => void;
  onSignOut: () => void;
}) => (
  <aside className="lg:sticky lg:top-24 lg:self-start">
    <div className="rounded-xl border border-border bg-card p-4 shadow-lg shadow-foreground/[0.03]">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Χώρος πελάτη</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Κρατήσεις, πληρωμές, αποθηκευμένοι δικηγόροι και ιδιωτικότητα σε έναν ιδιωτικό χώρο.
      </p>
      <nav className="mt-4 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-current={activeView === id ? "page" : undefined}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition",
              activeView === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
    </div>

    <div className="mt-3 rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Λογαριασμός</p>
      <p className="mt-2 truncate text-sm font-bold text-foreground">{accountName}</p>
      <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{accountEmail}</p>
      <Button variant="outline" onClick={onSignOut} className="mt-4 w-full rounded-lg font-bold">
        Αποσύνδεση
      </Button>
    </div>
  </aside>
);

const BookingFilterBar = ({
  activeFilter,
  counts,
  onChange,
}: {
  activeFilter: BookingFilter;
  counts: Record<BookingFilter, number>;
  onChange: (filter: BookingFilter) => void;
}) => (
  <div className="flex gap-2 overflow-x-auto pb-1">
    {bookingFilters.map((filter) => (
      <button
        key={filter.id}
        type="button"
        onClick={() => onChange(filter.id)}
        className={cn(
          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition",
          activeFilter === filter.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground",
        )}
      >
        {filter.label} · {counts[filter.id]}
      </button>
    ))}
  </div>
);

const PrivacyTrustBlock = () => (
  <aside className="rounded-xl border border-sage/20 bg-sage/10 p-4 xl:sticky xl:top-24 xl:self-start">
    <p className="text-xs font-bold uppercase tracking-widest text-sage-foreground">Τι παραμένει ιδιωτικό</p>
    <div className="mt-4 space-y-3">
      {[
        "Το προφίλ σας δεν είναι δημόσιο.",
        "Τα στοιχεία σας δεν εμφανίζονται σε άλλους χρήστες.",
        "Το τηλέφωνό σας κοινοποιείται μόνο όπου το επιτρέπετε.",
        "Τα έγγραφα εμφανίζονται μόνο όταν πληρούνται οι κανόνες πρόσβασης.",
      ].map((item) => (
        <div key={item} className="flex gap-2 text-sm font-semibold leading-6 text-foreground">
          <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-sage-foreground" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  </aside>
);

const AccountProfileForm = ({
  draft,
  saveState,
  onChange,
  onSave,
}: {
  draft: AccountProfileDraft;
  saveState: PaymentActionState;
  onChange: (updates: Partial<AccountProfileDraft>) => void;
  onSave: () => void;
}) => (
  <div>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Ονοματεπώνυμο *">
        <input
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          aria-invalid={!draft.name.trim()}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
        <p className="mt-1 text-xs font-semibold text-muted-foreground">Χρησιμοποιείται σε κρατήσεις και υποστήριξη.</p>
      </Field>
      <Field label="Τηλέφωνο">
        <input
          type="tel"
          inputMode="tel"
          value={draft.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          placeholder="π.χ. 69..."
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
        <p className="mt-1 text-xs font-semibold text-muted-foreground">Κοινοποιείται σε δικηγόρο μόνο όπου το επιτρέπετε.</p>
      </Field>
    </div>

    <div className="mt-4 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm leading-6 text-muted-foreground">
      Τα στοιχεία αυτά χρησιμοποιούνται για κρατήσεις και επικοινωνία με την υποστήριξη.
    </div>

    {saveState.message ? (
      <p
        aria-live="polite"
        className={cn(
          "mt-4 rounded-lg border px-3 py-2 text-sm font-semibold",
          saveState.tone === "success" && "border-sage/25 bg-sage/10 text-sage-foreground",
          saveState.tone === "error" && "border-destructive/20 bg-destructive/10 text-destructive",
          saveState.tone === "info" && "border-primary/20 bg-primary/10 text-primary",
        )}
      >
        {saveState.message}
      </p>
    ) : null}

    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs leading-5 text-muted-foreground">
        Το ονοματεπώνυμο είναι υποχρεωτικό για ασφαλή συνέχεια της υπόθεσης.
      </p>
      <Button
        type="button"
        onClick={onSave}
        disabled={saveState.loading || !draft.name.trim()}
        className="rounded-lg font-bold"
      >
        {saveState.loading ? "Αποθήκευση..." : "Αποθήκευση στοιχείων"}
      </Button>
    </div>
  </div>
);

const AccountSecurityForm = ({
  currentEmail,
  emailDraft,
  passwordDraft,
  saveState,
  onEmailChange,
  onPasswordChange,
  onSaveEmail,
  onSavePassword,
}: {
  currentEmail: string;
  emailDraft: string;
  passwordDraft: { password: string; confirmPassword: string };
  saveState: PaymentActionState;
  onEmailChange: (email: string) => void;
  onPasswordChange: (draft: { password: string; confirmPassword: string }) => void;
  onSaveEmail: () => void;
  onSavePassword: () => void;
}) => {
  const emailChanged = emailDraft.trim().toLowerCase() !== currentEmail.toLowerCase();
  const passwordReady = passwordDraft.password.length >= 8 && passwordDraft.password === passwordDraft.confirmPassword;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <Field label="Email σύνδεσης">
          <input
            type="email"
            value={emailDraft}
            onChange={(event) => onEmailChange(event.target.value)}
            autoComplete="email"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Η αλλαγή email ολοκληρώνεται μετά από επιβεβαίωση στη νέα διεύθυνση.
          </p>
        </Field>
        <Button
          type="button"
          variant="outline"
          onClick={onSaveEmail}
          disabled={saveState.loading || !emailChanged}
          className="rounded-lg font-bold"
        >
          Αλλαγή email
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Νέος κωδικός">
          <input
            type="password"
            value={passwordDraft.password}
            onChange={(event) => onPasswordChange({ ...passwordDraft, password: event.target.value })}
            autoComplete="new-password"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Τουλάχιστον 8 χαρακτήρες.</p>
        </Field>
        <Field label="Επιβεβαίωση κωδικού">
          <input
            type="password"
            value={passwordDraft.confirmPassword}
            onChange={(event) => onPasswordChange({ ...passwordDraft, confirmPassword: event.target.value })}
            autoComplete="new-password"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Πρέπει να ταιριάζει με τον νέο κωδικό.</p>
        </Field>
      </div>

      {saveState.message ? (
        <p
          aria-live="polite"
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-semibold",
            saveState.tone === "success" && "border-sage/25 bg-sage/10 text-sage-foreground",
            saveState.tone === "error" && "border-destructive/20 bg-destructive/10 text-destructive",
            saveState.tone === "info" && "border-primary/20 bg-primary/10 text-primary",
          )}
        >
          {saveState.message}
        </p>
      ) : null}

      <div className="flex justify-end border-t border-border pt-4">
        <Button
          type="button"
          onClick={onSavePassword}
          disabled={saveState.loading || !passwordReady}
          className="rounded-lg font-bold"
        >
          {saveState.loading ? "Ενημέρωση..." : "Αλλαγή κωδικού"}
        </Button>
      </div>
    </div>
  );
};

const BookingCard = ({
  booking,
  payment,
  onCancel,
  onCheckout,
  reviewDraft,
  reviewState,
  onReviewChange,
  onReviewSubmit,
  featured = false,
}: {
  booking: StoredBooking;
  payment?: StoredPayment;
  onCancel: (bookingId: string) => void;
  onCheckout: (booking: StoredBooking) => void;
  reviewDraft: ReviewDraft;
  reviewState?: PaymentActionState;
  onReviewChange: (updates: Partial<ReviewDraft>) => void;
  onReviewSubmit: () => void;
  featured?: boolean;
}) => {
  const verified = isVerifiedBooking(booking);
  const bookingState = getCanonicalBookingState(booking, payment);
  const paymentState = getCanonicalPaymentState(payment);
  const paymentNeeded = needsPaymentAction(booking, payment);
  const cancelled = bookingState === "cancelled";
  const completed = bookingState === "completed";
  const pendingConfirmation = bookingState === "pending_confirmation";
  const reviewOpen = canSubmitReview(booking) && paymentState === "paid";

  return (
  <article
    className={cn(
      "rounded-lg border bg-card p-4",
      featured && "border-sage/25 bg-sage/10",
      paymentNeeded && "border-gold/30 bg-gold/10",
      cancelled && "bg-secondary/35 opacity-85",
    )}
  >
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr_auto] xl:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip label={bookingStatusLabels[bookingState]} tone={getBookingTone(bookingState)} />
          {paymentState === "refund_requested" ? <StatusChip label={paymentStatusLabels[paymentState]} tone="attention" /> : null}
          <span className="text-xs font-semibold text-muted-foreground">{booking.referenceId}</span>
        </div>
        <h3 className="mt-2 font-bold text-foreground">{booking.lawyerName}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{booking.issueSummary || booking.consultationType}</p>
        {pendingConfirmation ? (
          <p className="mt-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold leading-5 text-primary">
            Σε έλεγχο από την ομάδα. Θα ενημερωθείτε μόλις ολοκληρωθεί ο έλεγχος.
          </p>
        ) : null}
        {cancelled && paymentState === "refund_requested" ? (
          <p className="mt-3 rounded-lg border border-gold/20 bg-gold/10 px-3 py-2 text-xs font-semibold leading-5 text-gold-foreground">
            Η κράτηση ακυρώθηκε και η επιστροφή ελέγχεται.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 rounded-lg border border-border bg-background/70 p-3 text-sm font-semibold text-muted-foreground sm:grid-cols-2 xl:grid-cols-1">
        <span>{booking.consultationType}</span>
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{booking.dateLabel}</span>
        <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{booking.time}</span>
        <span className="font-bold text-foreground">€{booking.price}</span>
      </div>

      <div className="flex flex-wrap gap-2 xl:w-44 xl:flex-col xl:items-stretch">
        {paymentNeeded ? (
          <Button type="button" size="sm" onClick={() => onCheckout(booking)} className="rounded-lg font-bold">
            Πληρωμή
          </Button>
        ) : !pendingConfirmation && !cancelled && !completed ? (
          <Button asChild size="sm" className="rounded-lg font-bold">
            <Link to={`/booking/${booking.lawyerId}`}>Αλλαγή ώρας</Link>
          </Button>
        ) : null}

        {!pendingConfirmation && canCancelBooking(booking, payment) && verified ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onCancel(booking.id)} className="rounded-lg font-bold">
            Ακύρωση
          </Button>
        ) : null}

        <Button asChild variant="outline" size="sm" className="rounded-lg font-bold">
          <Link to={`/lawyer/${booking.lawyerId}`}>Προφίλ</Link>
        </Button>

        {pendingConfirmation ? (
          <Button asChild variant="outline" size="sm" className="rounded-lg font-bold">
            <Link to="/help">Υποστήριξη</Link>
          </Button>
        ) : null}
      </div>
    </div>
    {reviewOpen ? (
      <div className="mt-4 rounded-lg border border-border bg-background/70 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Αξιολόγηση συνεργασίας</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Βοηθήστε άλλους πελάτες μετά από ολοκληρωμένη συμβουλευτική.
            </p>
          </div>
          <RatingPicker
            value={reviewDraft.rating}
            onChange={(rating) => onReviewChange({ rating })}
            disabled={reviewDraft.submitted || reviewState?.loading}
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Σαφήνεια</span>
            <select
              value={reviewDraft.clarityRating}
              onChange={(event) => onReviewChange({ clarityRating: Number(event.target.value) })}
              disabled={reviewDraft.submitted || reviewState?.loading}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}/5</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Ανταπόκριση</span>
            <select
              value={reviewDraft.responsivenessRating}
              onChange={(event) => onReviewChange({ responsivenessRating: Number(event.target.value) })}
              disabled={reviewDraft.submitted || reviewState?.loading}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}/5</option>)}
            </select>
          </label>
        </div>
        <textarea
          value={reviewDraft.text}
          onChange={(event) => onReviewChange({ text: event.target.value })}
          disabled={reviewDraft.submitted || reviewState?.loading}
          placeholder="Περιγράψτε σύντομα την εμπειρία σας χωρίς εμπιστευτικές λεπτομέρειες υπόθεσης."
          className="mt-3 min-h-24 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
        />
        {reviewState?.message ? <ActionNotice state={reviewState} /> : null}
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={onReviewSubmit}
            disabled={reviewDraft.submitted || reviewState?.loading || reviewDraft.text.trim().length < 12}
            className="rounded-lg font-bold"
          >
            {reviewState?.loading ? "Αποθήκευση..." : reviewDraft.submitted ? "Στάλθηκε" : "Υποβολή αξιολόγησης"}
          </Button>
        </div>
      </div>
    ) : null}
  </article>
  );
};

const RatingPicker = ({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) => (
  <div className="flex items-center gap-1" aria-label="Βαθμολογία συνεργασίας">
    {[1, 2, 3, 4, 5].map((rating) => (
      <button
        key={rating}
        type="button"
        onClick={() => onChange(rating)}
        disabled={disabled}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition",
          rating <= value
            ? "border-primary/25 bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
          disabled && "cursor-not-allowed opacity-60",
        )}
        aria-label={`${rating} από 5`}
        aria-pressed={rating <= value}
      >
        <Star className={cn("h-4 w-4", rating <= value && "fill-current")} />
      </button>
    ))}
  </div>
);

const PaymentCard = ({
  booking,
  payment,
  onCheckout,
}: {
  booking: StoredBooking;
  payment?: StoredPayment;
  onCheckout: () => void;
}) => {
  const bookingState = getCanonicalBookingState(booking, payment);
  const paymentStatus = getCanonicalPaymentState(payment);
  const canCheckout = needsPaymentAction(booking, payment);
  const statusText =
    bookingState === "pending_confirmation"
      ? "Το ραντεβού ελέγχεται · η πληρωμή δεν ανοίγει ακόμη"
      : paymentStatus === "paid"
        ? "Η πληρωμή έχει ολοκληρωθεί"
        : paymentStatus === "refund_requested"
          ? "Η επιστροφή ελέγχεται από την υποστήριξη"
          : paymentStatus === "refunded"
            ? "Επιστράφηκε στην αρχική μέθοδο πληρωμής"
            : paymentStatus === "failed"
              ? "Η πληρωμή δεν ολοκληρώθηκε · δεν έγινε χρέωση"
              : bookingState === "cancelled"
                ? "Ακυρώθηκε χωρίς ολοκληρωμένη χρέωση"
                : "Η πληρωμή χρειάζεται ολοκλήρωση";

  return (
    <article className={cn("rounded-lg border bg-card p-4", canCheckout && "border-gold/30 bg-gold/10", bookingState === "cancelled" && "bg-secondary/35")}>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{payment?.invoiceNumber || booking.referenceId}</p>
          <p className="mt-1 font-bold text-foreground">{booking.lawyerName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{booking.consultationType} · {booking.dateLabel}</p>
        </div>
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusChip label={getPaymentStatusLabel(payment)} tone={getPaymentTone(paymentStatus)} />
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">{statusText}</p>
        </div>
        <div className="flex flex-col gap-2 text-left lg:w-44 lg:items-end lg:text-right">
          <p className="text-lg font-bold text-foreground">€{booking.price}</p>
          {canCheckout ? (
            <Button type="button" size="sm" onClick={onCheckout} className="rounded-lg font-bold">
              Πληρωμή
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
};

const SavedLawyerRow = ({
  lawyer,
  compared,
  note,
  onCompare,
  onRemove,
  onNote,
}: {
  lawyer: Lawyer;
  compared: boolean;
  note?: string;
  onCompare: () => void;
  onRemove: () => void;
  onNote?: (note: string) => void;
}) => (
  <article className="rounded-lg border border-border bg-card p-3">
    <div className="flex flex-col gap-3 md:flex-row md:items-start">
      <LawyerPhoto src={lawyer.image} alt={lawyer.name} className="h-14 w-14 rounded-lg object-cover ring-2 ring-background" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-bold text-foreground">{lawyer.name}</p>
            <p className="mt-1 text-sm font-semibold text-primary/80">{lawyer.specialty}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{lawyer.city}</span>
              <span>από €{getPriceFrom(lawyer)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={compared ? "default" : "outline"} size="sm" onClick={onCompare} className="rounded-lg font-bold">
              {compared ? "Στη σύγκριση" : "Σύγκριση"}
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-lg font-bold">
              <Link to={`/lawyer/${lawyer.id}`}>Προφίλ</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onRemove} aria-label={`Αφαίρεση ${lawyer.name}`} className="rounded-lg font-bold text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {onNote ? (
          <label className="mt-3 block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Ιδιωτική σημείωση μόνο για εσάς</span>
            <textarea
              value={note || ""}
              onChange={(event) => onNote(event.target.value)}
              placeholder="π.χ. καλός για μισθωτική διαφορά"
              className="mt-2 min-h-16 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </label>
        ) : null}
      </div>
    </div>
  </article>
);

export default UserProfile;
