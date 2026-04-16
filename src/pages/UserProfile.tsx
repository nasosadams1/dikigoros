import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  Clock,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Heart,
  LockKeyhole,
  MapPin,
  MessageSquareQuote,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthContainer from "@/components/auth/AuthContainer";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { ComparisonLine, EmptyState, Field, Metric, Panel, SettingToggle } from "@/components/profile/AccountPrimitives";
import { consultationModeLabels, specialtyOptions, type ConsultationMode, type Lawyer } from "@/data/lawyers";
import { useAuth } from "@/context/AuthContext";
import { legalDocumentPolicy, summarizeDocumentValidation, validateLegalDocumentUpload } from "@/lib/documentPolicy";
import {
  clearPartnerSession,
  cancelBooking,
  fetchBookingsForUser,
  fetchPaymentsForUser,
  getPartnerSession,
  isVerifiedBooking,
  requestBookingCheckoutSession,
  requestBookingRefund,
  requestPaymentSetupSession,
  type StoredBooking,
  type StoredPayment,
} from "@/lib/platformRepository";
import { getPartnerWorkspace } from "@/lib/partnerWorkspace";
import { getLawyers } from "@/lib/lawyerRepository";
import {
  addUserDocuments,
  createUserDocumentDownloadUrl,
  fetchUserWorkspace,
  formatFileSize,
  getUserWorkspace,
  saveUserWorkspace,
  removeUserDocumentPersisted,
  setUserDocumentVisibilityPersisted,
  syncUserWorkspace,
  uploadUserDocuments,
  upsertUserReviewPersisted,
  type PreferredConsultationMode,
  type UserWorkspace,
} from "@/lib/userWorkspace";
import { clearPaymentReturnParams, getPaymentReturnNotice, parseUserProfileTab } from "@/lib/userProfileNavigation";
import { createOperationalCase } from "@/lib/operationsRepository";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "overview", label: "Workspace", icon: UserRound },
  { id: "profile", label: "Client details", icon: UserRound },
  { id: "bookings", label: "Consultations", icon: CalendarDays },
  { id: "messages", label: "Messages", icon: MessageSquareQuote },
  { id: "saved", label: "Saved & compare", icon: Heart },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "payments", label: "Billing & receipts", icon: CreditCard },
  { id: "reviews", label: "Reviews", icon: MessageSquareQuote },
  { id: "privacy", label: "Privacy", icon: LockKeyhole },
] as const;

type ActiveView = (typeof navItems)[number]["id"];
type ReviewSubmitState = {
  loading: boolean;
  message: string;
  tone: "success" | "error" | "info";
};

type PaymentActionState = {
  loading: boolean;
  message: string;
  tone: "success" | "error" | "info";
};

type AccountProfileDraft = {
  name: string;
  phone: string;
  city: string;
};

const consultationOptions: Array<{ value: PreferredConsultationMode; label: string }> = [
  { value: "any", label: "Οποιοσδήποτε τρόπος" },
  { value: "video", label: consultationModeLabels.video },
  { value: "phone", label: consultationModeLabels.phone },
  { value: "inPerson", label: consultationModeLabels.inPerson },
];

const budgetOptions = ["έως €50", "€50 - €80", "€80 - €120", "€120+"];
const urgencyOptions = ["Σήμερα", "Μέσα σε 3 ημέρες", "Αυτή την εβδομάδα", "Δεν είναι επείγον"];

const statusLabels: Record<StoredBooking["status"], string> = {
  confirmed: "Επιβεβαιωμένο",
  cancelled: "Ακυρωμένο",
  completed: "Ολοκληρωμένο",
};

const paymentMethodStatusLabels: Record<UserWorkspace["paymentMethod"]["status"], string> = {
  not_configured: "Δεν έχει συνδεθεί",
  setup_required: "Χρειάζεται σύνδεση",
  ready: "Έτοιμη",
};

const getCompletionItems = (workspace: UserWorkspace, profileEmail?: string, phone?: string, city?: string) => [
  Boolean(profileEmail),
  Boolean(phone),
  Boolean(city || workspace.preferences.city),
  workspace.preferences.legalCategories.length > 0,
  workspace.savedLawyerIds.length > 0,
  workspace.documents.length > 0,
  workspace.notifications.email || workspace.notifications.sms,
  workspace.privacy.sharePhoneWithBookedLawyers !== undefined,
];

const accountProfileStoragePrefix = "dikigoros.accountProfile.v1";

const getStoredAccountProfile = (identityKey?: string | null): AccountProfileDraft => {
  if (typeof window === "undefined") {
    return { name: "", phone: "", city: "" };
  }

  try {
    const rawValue = window.localStorage.getItem(`${accountProfileStoragePrefix}.${identityKey || "guest"}`);
    if (!rawValue) return { name: "", phone: "", city: "" };

    const parsed = JSON.parse(rawValue) as Partial<AccountProfileDraft>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      city: typeof parsed.city === "string" ? parsed.city : "",
    };
  } catch {
    return { name: "", phone: "", city: "" };
  }
};

const saveStoredAccountProfile = (identityKey: string | null | undefined, draft: AccountProfileDraft) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${accountProfileStoragePrefix}.${identityKey || "guest"}`, JSON.stringify(draft));
};

const UserProfile = ({ embedded = false }: { embedded?: boolean }) => {
  const { user, profile, signOut, updateProfile: updateAccountProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [authOpen, setAuthOpen] = useState(false);
  const [partnerSession, setPartnerSession] = useState(() => getPartnerSession());
  const [activeView, setActiveView] = useState<ActiveView>(() => parseUserProfileTab(searchParams.get("tab")));
  const [bookingVersion, setBookingVersion] = useState(0);
  const [bookings, setBookings] = useState<StoredBooking[]>([]);
  const [payments, setPayments] = useState<StoredPayment[]>([]);
  const [lawyerCatalog, setLawyerCatalog] = useState<Lawyer[]>([]);
  const [paymentSetupState, setPaymentSetupState] = useState<PaymentActionState>({
    loading: false,
    message: "",
    tone: "info",
  });
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { rating: number; clarityRating: number; responsivenessRating: number; text: string }>>({});
  const [reviewSubmitState, setReviewSubmitState] = useState<Record<string, ReviewSubmitState>>({});
  const [documentUploadState, setDocumentUploadState] = useState<PaymentActionState>({
    loading: false,
    message: "",
    tone: "info",
  });
  const [profileSaveState, setProfileSaveState] = useState<PaymentActionState>({
    loading: false,
    message: "",
    tone: "info",
  });
  const [profileDraft, setProfileDraft] = useState<AccountProfileDraft>({
    name: "",
    phone: "",
    city: "",
  });
  const [workspace, setWorkspace] = useState<UserWorkspace>(() => getUserWorkspace(user?.id || getPartnerSession()?.email));
  const [localAccountProfile, setLocalAccountProfile] = useState<AccountProfileDraft>(() =>
    getStoredAccountProfile(user?.id || getPartnerSession()?.email),
  );

  const userId = user?.id;
  const workspaceKey = userId || partnerSession?.email || undefined;
  const partnerWorkspace = partnerSession ? getPartnerWorkspace(partnerSession.email) : null;
  const hasAccountAccess = Boolean(user || partnerSession);
  const userEmail = profile?.email || user?.email || partnerSession?.email || "";
  const displayName =
    profile?.name ||
    localAccountProfile.name ||
    partnerWorkspace?.profile.displayName ||
    user?.user_metadata?.display_name ||
    userEmail.split("@")[0] ||
    "Χρήστης";
  const userPhone = profile?.phone || localAccountProfile.phone || "";
  const userCity = profile?.city || localAccountProfile.city || workspace.preferences.city || partnerWorkspace?.profile.city || "";
  const accountDisplayName = localAccountProfile.name || partnerWorkspace?.profile.displayName || displayName;
  const accountPhone = localAccountProfile.phone || userPhone;
  const accountCity = localAccountProfile.city || userCity || partnerWorkspace?.profile.city || workspace.preferences.city;

  useEffect(() => {
    setWorkspace(getUserWorkspace(workspaceKey));
    void fetchUserWorkspace(workspaceKey, userId).then(setWorkspace);
  }, [userId, workspaceKey]);

  useEffect(() => {
    setLocalAccountProfile(getStoredAccountProfile(workspaceKey));
  }, [workspaceKey]);

  useEffect(() => {
    setProfileDraft({
      name: accountDisplayName,
      phone: accountPhone,
      city: accountCity,
    });
  }, [accountCity, accountDisplayName, accountPhone]);

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
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;

    void Promise.all([
      fetchBookingsForUser(userId, userEmail),
      fetchPaymentsForUser(userId, userEmail),
    ]).then(([nextBookings, nextPayments]) => {
      if (!active) return;
      setBookings(nextBookings);
      setPayments(nextPayments);
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

  const activeBookings = bookings.filter((booking) => booking.status === "confirmed");
  const completedBookings = bookings.filter((booking) => booking.status === "completed");
  const reviewableBookings = completedBookings.filter((booking) => booking.persistenceSource === "supabase");
  const unsyncedCompletedBookings = completedBookings.filter((booking) => booking.persistenceSource !== "supabase");
  const nextBooking = activeBookings[0];

  const savedLawyers = useMemo(
    () => workspace.savedLawyerIds.map((id) => lawyerCatalog.find((lawyer) => lawyer.id === id)).filter(Boolean),
    [lawyerCatalog, workspace.savedLawyerIds],
  );
  const comparedLawyers = useMemo(
    () => workspace.comparedLawyerIds.map((id) => lawyerCatalog.find((lawyer) => lawyer.id === id)).filter(Boolean),
    [lawyerCatalog, workspace.comparedLawyerIds],
  );
  const completionItems = getCompletionItems(workspace, userEmail, accountPhone, accountCity);
  const completion = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);

  const persistWorkspace = (nextWorkspace: UserWorkspace) => {
    const normalized = saveUserWorkspace(workspaceKey, nextWorkspace);
    setWorkspace(normalized);
    void syncUserWorkspace(workspaceKey, normalized, userId);
  };

  const updateProfileDraft = (updates: Partial<AccountProfileDraft>) => {
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
      city: profileDraft.city.trim(),
    };

    if (!nextDraft.name) {
      setProfileSaveState({
        loading: false,
        message: "Το όνομα προφίλ είναι υποχρεωτικό.",
        tone: "error",
      });
      return;
    }

    setProfileSaveState({ loading: true, message: "Αποθήκευση αλλαγών...", tone: "info" });

    try {
      if (userId) {
        await updateAccountProfile({
          name: nextDraft.name,
          phone: nextDraft.phone,
          city: nextDraft.city,
        });
      } else {
        saveStoredAccountProfile(workspaceKey, nextDraft);
        setLocalAccountProfile(nextDraft);
      }
      const nextWorkspace = await syncUserWorkspace(workspaceKey, {
        ...workspace,
        preferences: {
          ...workspace.preferences,
          city: nextDraft.city,
        },
      }, userId);

      setWorkspace(nextWorkspace);
      setProfileDraft(nextDraft);
      setProfileSaveState({
        loading: false,
        message: "Οι αλλαγές προφίλ αποθηκεύτηκαν.",
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

  const updatePreferences = (updates: Partial<UserWorkspace["preferences"]>) => {
    persistWorkspace({
      ...workspace,
      preferences: {
        ...workspace.preferences,
        ...updates,
      },
    });
  };

  const toggleLegalCategory = (category: string) => {
    const legalCategories = workspace.preferences.legalCategories.includes(category)
      ? workspace.preferences.legalCategories.filter((item) => item !== category)
      : [...workspace.preferences.legalCategories, category];

    updatePreferences({ legalCategories });
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

  const handleDocumentUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    if (files.length === 0) return;

    const validation = validateLegalDocumentUpload(files);
    const skippedMessage = summarizeDocumentValidation(validation);

    if (validation.acceptedFiles.length === 0) {
      setDocumentUploadState({
        loading: false,
        message: skippedMessage || "Δεν βρέθηκε αποδεκτό αρχείο. Επιτρέπονται PDF, Word, JPG και PNG έως 15 MB.",
        tone: "error",
      });
      event.currentTarget.value = "";
      return;
    }

    setDocumentUploadState({
      loading: true,
      message: skippedMessage
        ? `${skippedMessage} Ανεβάζουμε τα αποδεκτά αρχεία.`
        : "Ανεβάζουμε τα έγγραφα με ασφαλή σύνδεση.",
      tone: "info",
    });
    setWorkspace(addUserDocuments(workspaceKey, validation.acceptedFiles, "Έγγραφο υπόθεσης", nextBooking?.id));
    void uploadUserDocuments(workspaceKey, validation.acceptedFiles, "Έγγραφο υπόθεσης", nextBooking?.id, userId)
      .then((nextWorkspace) => {
        setWorkspace(nextWorkspace);
        setDocumentUploadState({
          loading: false,
          message: skippedMessage
            ? `${skippedMessage} Τα αποδεκτά αρχεία αποθηκεύτηκαν.`
            : "Τα έγγραφα αποθηκεύτηκαν και συνδέθηκαν με τον λογαριασμό σας.",
          tone: skippedMessage ? "info" : "success",
        });
      })
      .catch(() => {
        setDocumentUploadState({
          loading: false,
          message: "Η αποθήκευση εγγράφων απέτυχε. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.",
          tone: "error",
        });
      });
    event.currentTarget.value = "";
  };

  const removeSavedLawyer = (lawyerId: string) => {
    persistWorkspace({
      ...workspace,
      savedLawyerIds: workspace.savedLawyerIds.filter((id) => id !== lawyerId),
      comparedLawyerIds: workspace.comparedLawyerIds.filter((id) => id !== lawyerId),
    });
  };

  const toggleComparedLawyer = (lawyerId: string) => {
    const comparedLawyerIds = workspace.comparedLawyerIds.includes(lawyerId)
      ? workspace.comparedLawyerIds.filter((id) => id !== lawyerId)
      : [lawyerId, ...workspace.comparedLawyerIds].slice(0, 3);

    persistWorkspace({ ...workspace, comparedLawyerIds });
  };

  const handleCancelBookingWithRefund = (bookingId: string) => {
    const booking = bookings.find((item) => item.id === bookingId);
    const payment = payments.find((item) => item.bookingId === bookingId);

    void (async () => {
      await cancelBooking(bookingId);

      if (booking && payment?.status === "paid" && isVerifiedBooking(booking)) {
        const refund = await requestBookingRefund(booking);
        if (refund.status === "review_required") {
          createOperationalCase({
            area: "payments",
            title: "Refund review after cancellation",
            summary: `A paid booking was cancelled and needs support review before the refund can be completed for ${booking.referenceId}.`,
            priority: "high",
            requesterEmail: booking.clientEmail,
            relatedReference: payment.invoiceNumber || booking.referenceId,
            evidence: [
              `Booking: ${booking.referenceId}`,
              `Payment status before cancellation: ${payment.status}`,
              `Lawyer: ${booking.lawyerName}`,
            ],
          });
          setPaymentSetupState({
            loading: false,
            message: "The booking was cancelled. Support will review the paid refund path and follow up with the next step.",
            tone: "info",
          });
        } else {
          setPaymentSetupState({
            loading: false,
            message:
              refund.status === "refunded"
                ? "The booking was cancelled and the refund was started through the original payment method."
                : "The booking was cancelled. The refund has been requested through the original payment method.",
            tone: "success",
          });
        }
      }

      setBookingVersion((version) => version + 1);
    })().catch(() => {
      setPaymentSetupState({
        loading: false,
        message: "The booking could not be cancelled right now. Refresh and try again, or contact support.",
        tone: "error",
      });
    });
  };

  const handleCancelBooking = (bookingId: string) => {
    void cancelBooking(bookingId).then(() => {
      setBookingVersion((version) => version + 1);
    }).catch(() => {
      setPaymentSetupState({
        loading: false,
        message: "Η ακύρωση δεν αποθηκεύτηκε στο Supabase. Κάντε ανανέωση και δοκιμάστε ξανά.",
        tone: "error",
      });
    });
  };

  const handlePaymentSetup = async () => {
    setPaymentSetupState({ loading: true, message: "", tone: "info" });
    try {
      const session = await requestPaymentSetupSession(userId, userEmail);
      const nextWorkspace = await syncUserWorkspace(workspaceKey, {
        ...workspace,
        paymentMethod: {
          ...workspace.paymentMethod,
          status: session.status,
          setupRequestedAt: session.requestedAt,
        },
      }, userId);

      setWorkspace(nextWorkspace);
      setPaymentSetupState({
        loading: false,
        message: session.url
          ? "Μεταφορά σε ασφαλή σύνδεση κάρτας μέσω Stripe."
          : "Η ασφαλής σύνδεση κάρτας δεν επέστρεψε URL. Οι πληρωμές μένουν κλειδωμένες μέχρι να συνδεθεί σωστά.",
        tone: session.url ? "info" : "error",
      });

      if (session.url && typeof window !== "undefined") {
        window.location.assign(session.url);
      }
    } catch {
      setPaymentSetupState({
        loading: false,
        message: "Η σύνδεση με Stripe απέτυχε. Δοκιμάστε ξανά μετά από ανανέωση.",
        tone: "error",
      });
    }
  };

  const handleBookingCheckout = async (booking: StoredBooking) => {
    if (!isVerifiedBooking(booking)) {
      setPaymentSetupState({
        loading: false,
        message: "Η πληρωμή ανοίγει μόνο για επαληθευμένα ραντεβού Supabase. Αυτό το ραντεβού είναι τοπικό και δεν πρέπει να χρεωθεί.",
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
          : "Η ασφαλής πληρωμή δεν επέστρεψε URL. Οι πληρωμές μένουν κλειδωμένες μέχρι να συνδεθεί σωστά.",
        tone: session.url ? "info" : "error",
      });

      if (session.url && typeof window !== "undefined") {
        window.location.assign(session.url);
      }
    } catch {
      setPaymentSetupState({
        loading: false,
        message: "Η σελίδα πληρωμής δεν άνοιξε. Δεν έγινε χρέωση.",
        tone: "error",
      });
    }
  };

  const handleReviewDraftChange = (
    bookingId: string,
    updates: Partial<{ rating: number; clarityRating: number; responsivenessRating: number; text: string }>,
  ) => {
    setReviewDrafts((current) => ({
      ...current,
      [bookingId]: {
        rating: 5,
        clarityRating: 5,
        responsivenessRating: 5,
        text: "",
        ...(current[bookingId] || {}),
        ...updates,
      },
    }));
  };

  const handleSubmitReview = (booking: StoredBooking) => {
    const draft = reviewDrafts[booking.id] || {
      rating: 5,
      clarityRating: 5,
      responsivenessRating: 5,
      text: "",
    };

    if (draft.text.trim().length < 12) {
      setReviewSubmitState((current) => ({
        ...current,
        [booking.id]: {
          loading: false,
          message: "Γράψτε τουλάχιστον 12 χαρακτήρες για να παραμείνει η κριτική χρήσιμη.",
          tone: "error",
        },
      }));
      return;
    }

    setReviewSubmitState((current) => ({
      ...current,
      [booking.id]: {
        loading: true,
        message: "Υποβολή κριτικής...",
        tone: "info",
      },
    }));

    void upsertUserReviewPersisted(workspaceKey, {
      bookingId: booking.id,
      lawyerId: booking.lawyerId,
      lawyerName: booking.lawyerName,
      rating: draft.rating,
      clarityRating: draft.clarityRating,
      responsivenessRating: draft.responsivenessRating,
      text: draft.text.trim(),
    }, userId).then((result) => {
      setWorkspace(result.workspace);
      if (result.persisted) {
        createOperationalCase({
          area: "reviews",
          title: "Review moderation check",
          summary: `A completed-booking review was submitted for ${booking.lawyerName}. Confirm booking linkage, private-case detail safety, and publication status.`,
          priority: "normal",
          requesterEmail: booking.clientEmail,
          relatedReference: booking.referenceId,
          evidence: [
            `Overall: ${draft.rating}/5`,
            `Clarity: ${draft.clarityRating}/5`,
            `Responsiveness: ${draft.responsivenessRating}/5`,
          ],
        });
      }
      setReviewSubmitState((current) => ({
        ...current,
        [booking.id]: result.persisted
          ? {
              loading: false,
              message: "Η κριτική δημοσιεύτηκε στο προφίλ του δικηγόρου.",
              tone: "success",
            }
          : {
              loading: false,
              message:
                result.reason === "booking_not_completed"
                  ? "Το Supabase δεν βλέπει ακόμη αυτό το ραντεβού ως ολοκληρωμένο. Συνδεθείτε ξανά στον πίνακα συνεργάτη και πατήστε ολοκλήρωση στο ίδιο ραντεβού."
                  : "Δεν έγινε αποθήκευση στο Supabase. Δοκιμάστε ξανά μετά από ανανέωση.",
              tone: "error",
            },
      }));
    });
  };

  const updateBooleanSetting = (
    group: "privacy" | "notifications",
    key: keyof UserWorkspace["privacy"] | keyof UserWorkspace["notifications"],
  ) => {
    persistWorkspace({
      ...workspace,
      [group]: {
        ...workspace[group],
        [key]: !workspace[group][key],
      },
    });
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
        <main className="mx-auto max-w-4xl px-5 py-16 text-center lg:px-8">
          <div className="rounded-2xl border border-border bg-card px-6 py-12 shadow-xl shadow-foreground/[0.05]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h1 className="mt-5 font-serif text-3xl tracking-tight text-foreground">Το προφίλ σας παραμένει ιδιωτικό.</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Συνδεθείτε για να δείτε ραντεβού, αποθηκευμένους δικηγόρους, έγγραφα, πληρωμές και ρυθμίσεις απορρήτου σε έναν ασφαλή χώρο.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={() => setAuthOpen(true)} className="rounded-xl px-6 font-bold">
                Σύνδεση
              </Button>
              <Button asChild variant="outline" className="rounded-xl px-6 font-bold">
                <Link to="/search">Αναζήτηση δικηγόρου</Link>
              </Button>
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

      <main className={embedded ? "" : "mx-auto max-w-7xl px-5 py-6 lg:px-8 lg:py-8"}>
        <section className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-foreground/[0.04] lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sage/25 bg-sage/10 px-3 py-1 text-xs font-bold text-sage-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Ιδιωτικός χώρος πελάτη
              </div>
              <h1 className="mt-4 font-serif text-4xl tracking-tight text-foreground">Καλησπέρα, {displayName}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Τα ραντεβού, τα έγγραφα, οι πληρωμές και οι επιλογές σας μένουν οργανωμένα χωρίς να εμφανίζονται δημόσια.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[430px]">
              <Metric label="Πληρότητα προφίλ" value={`${completion}%`} helper="Για πιο γρήγορη συνέχεια" />
              <Metric label="Ενεργά ραντεβού" value={String(activeBookings.length)} helper={nextBooking ? nextBooking.dateLabel : "Δεν υπάρχει επόμενο"} />
            </div>
          </div>
        </section>

        <div className="mt-7 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="rounded-2xl border border-border bg-card p-2">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectView(id)}
                  aria-current={activeView === id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition",
                    activeView === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>

            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Λογαριασμός</p>
              <p className="mt-2 truncate text-sm font-bold text-foreground">{userEmail}</p>
              <Button variant="outline" onClick={() => void handleAccountSignOut()} className="mt-4 w-full rounded-xl font-bold">
                Αποσύνδεση
              </Button>
            </div>
          </aside>

          <section className="min-w-0">
            {activeView === "overview" ? (
              <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <Panel title="Συνέχεια υπόθεσης" eyebrow="Επόμενη κίνηση">
                  {nextBooking ? (
                    <BookingCard booking={nextBooking} onCancel={handleCancelBookingWithRefund} featured />
                  ) : (
                    <EmptyState
                      icon={CalendarDays}
                      title="Δεν υπάρχει επόμενο ραντεβού"
                      description="Αποθηκεύστε δικηγόρους ή κλείστε νέο ραντεβού όταν είστε έτοιμοι."
                      action={<Button asChild className="rounded-xl font-bold"><Link to="/search">Βρείτε δικηγόρο</Link></Button>}
                    />
                  )}
                </Panel>

                <Panel title="Γρήγορες ρυθμίσεις" eyebrow="Προσωπικές επιλογές">
                  <PreferencesForm workspace={workspace} updatePreferences={updatePreferences} toggleLegalCategory={toggleLegalCategory} compact />
                </Panel>

                <Panel title="Αποθηκευμένοι δικηγόροι" eyebrow="Σύντομη λίστα">
                  {savedLawyers.length > 0 ? (
                    <div className="space-y-3">
                      {savedLawyers.slice(0, 3).map((lawyer) => lawyer && (
                        <SavedLawyerRow
                          key={lawyer.id}
                          lawyer={lawyer}
                          compared={workspace.comparedLawyerIds.includes(lawyer.id)}
                          onCompare={() => toggleComparedLawyer(lawyer.id)}
                          onRemove={() => removeSavedLawyer(lawyer.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Heart}
                      title="Δεν έχετε αποθηκεύσει ακόμα δικηγόρο"
                      description="Χρησιμοποιήστε την καρδιά σε ένα προφίλ για να φτιάξετε τη λίστα σας."
                    />
                  )}
                </Panel>

                <Panel title="Απόρρητο" eyebrow="Ορατότητα">
                  <div className="space-y-3">
                    <SettingToggle
                      icon={ShieldCheck}
                      title="Κοινοποίηση τηλεφώνου μετά την κράτηση"
                      description="Ο δικηγόρος βλέπει το τηλέφωνό σας μόνο για επιβεβαιωμένο ραντεβού."
                      enabled={workspace.privacy.sharePhoneWithBookedLawyers}
                      onToggle={() => updateBooleanSetting("privacy", "sharePhoneWithBookedLawyers")}
                    />
                    <SettingToggle
                      icon={FileText}
                      title="Έγγραφα διαθέσιμα ανά ραντεβού"
                      description="Τα αρχεία εμφανίζονται μόνο όταν τα συνδέετε με υπόθεση ή ραντεβού."
                      enabled={workspace.privacy.allowDocumentAccessByBooking}
                      onToggle={() => updateBooleanSetting("privacy", "allowDocumentAccessByBooking")}
                    />
                  </div>
                </Panel>
              </div>
            ) : null}

            {activeView === "profile" ? (
              <Panel title="Στοιχεία προφίλ" eyebrow="Λογαριασμός">
                <AccountProfileForm
                  draft={profileDraft}
                  email={userEmail}
                  saveState={profileSaveState}
                  onChange={updateProfileDraft}
                  onSave={() => void handleSaveAccountProfile()}
                />
              </Panel>
            ) : null}

            {activeView === "bookings" ? (
              <Panel title="Ραντεβού" eyebrow="Κέντρο κρατήσεων">
                <div className="grid gap-4">
                  {bookings.length > 0 ? (
                    bookings.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} onCancel={handleCancelBookingWithRefund} />
                    ))
                  ) : (
                    <EmptyState
                      icon={CalendarDays}
                      title="Δεν υπάρχουν ακόμα ραντεβού"
                      description="Μόλις κλείσετε ραντεβού, θα εμφανιστεί εδώ με κατάσταση, κόστος και επόμενες ενέργειες."
                      action={<Button asChild className="rounded-xl font-bold"><Link to="/search">Κλείστε ραντεβού</Link></Button>}
                    />
                  )}
                </div>
              </Panel>
            ) : null}

            {activeView === "messages" ? (
              <Panel title="Messages and next steps" eyebrow="Post-booking workspace">
                <div className="grid gap-4">
                  {bookings.length > 0 ? (
                    bookings.map((booking) => {
                      const payment = payments.find((item) => item.bookingId === booking.id);
                      const linkedDocuments = workspace.documents.filter((document) => document.linkedBookingId === booking.id);

                      return (
                        <article key={booking.id} className="rounded-xl border border-border bg-card p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-primary">{booking.referenceId}</p>
                              <h3 className="mt-1 text-lg font-bold text-foreground">{booking.lawyerName}</h3>
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                {booking.dateLabel} at {booking.time} - {booking.consultationType}
                              </p>
                            </div>
                            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
                              {statusLabels[booking.status]}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-lg bg-secondary/45 p-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment</p>
                              <p className="mt-1 text-sm font-bold text-foreground">{payment?.status || "pending"}</p>
                            </div>
                            <div className="rounded-lg bg-secondary/45 p-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Documents</p>
                              <p className="mt-1 text-sm font-bold text-foreground">{linkedDocuments.length} linked</p>
                            </div>
                            <div className="rounded-lg bg-secondary/45 p-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Next step</p>
                              <p className="mt-1 text-sm font-bold text-foreground">
                                {booking.status === "completed" ? "Leave a review" : "Prepare documents"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button type="button" variant="outline" onClick={() => selectView("documents")} className="rounded-xl text-xs font-bold">
                              <FileText className="h-4 w-4" />
                              Upload documents
                            </Button>
                            <Button type="button" variant="outline" onClick={() => selectView("payments")} className="rounded-xl text-xs font-bold">
                              <CreditCard className="h-4 w-4" />
                              Receipts
                            </Button>
                            <Button asChild variant="outline" className="rounded-xl text-xs font-bold">
                              <Link to="/help">Support</Link>
                            </Button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <EmptyState
                      icon={MessageSquareQuote}
                      title="No consultation workspace yet"
                      description="After booking, this becomes the place for next steps, document prompts, receipts, and support paths."
                      action={<Button asChild className="rounded-xl font-bold"><Link to="/search">Find a lawyer</Link></Button>}
                    />
                  )}
                </div>
              </Panel>
            ) : null}

            {activeView === "saved" ? (
              <div className="space-y-6">
                <Panel title="Αποθηκευμένοι δικηγόροι" eyebrow="Σύγκριση και σημειώσεις">
                  {savedLawyers.length > 0 ? (
                    <div className="space-y-4">
                      {savedLawyers.map((lawyer) => lawyer && (
                        <SavedLawyerRow
                          key={lawyer.id}
                          lawyer={lawyer}
                          compared={workspace.comparedLawyerIds.includes(lawyer.id)}
                          note={workspace.lawyerNotes[lawyer.id] || ""}
                          onCompare={() => toggleComparedLawyer(lawyer.id)}
                          onRemove={() => removeSavedLawyer(lawyer.id)}
                          onNote={(note) =>
                            persistWorkspace({
                              ...workspace,
                              lawyerNotes: {
                                ...workspace.lawyerNotes,
                                [lawyer.id]: note,
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Search} title="Η λίστα είναι άδεια" description="Αποθηκεύστε προφίλ από την αναζήτηση ή τη σελίδα δικηγόρου." />
                  )}
                </Panel>

                {comparedLawyers.length > 0 ? (
                  <Panel title="Σύγκριση" eyebrow="Έως 3 δικηγόροι">
                    <div className="grid gap-3 md:grid-cols-3">
                      {comparedLawyers.map((lawyer) => lawyer && (
                        <div key={lawyer.id} className="rounded-xl border border-border bg-secondary/45 p-4">
                          <p className="font-bold text-foreground">{lawyer.name}</p>
                          <p className="mt-1 text-xs font-semibold text-primary/80">{lawyer.specialty}</p>
                          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <ComparisonLine label="Τιμή" value={`€${lawyer.price}`} />
                            <ComparisonLine label="Εμπειρία" value={`${lawyer.experience} έτη`} />
                            <ComparisonLine label="Αξιολόγηση" value={`${lawyer.rating}/5`} />
                            <ComparisonLine label="Απάντηση" value={lawyer.response} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                ) : null}
              </div>
            ) : null}

            {activeView === "documents" ? (
              <Panel title="Έγγραφα" eyebrow="Αρχεία υπόθεσης">
                <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-bold text-foreground">Ανέβασμα εγγράφων</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Δεχόμαστε PDF, Word, JPG και PNG έως 15 MB ανά αρχείο. Τα έγγραφα ανοίγουν σε δικηγόρο μόνο όταν τα αφήσετε ορατά για συνδεδεμένο ραντεβού.
                      </p>
                    </div>
                    <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
                      {documentUploadState.loading ? "Ανέβασμα..." : "Επιλογή αρχείων"}
                      <input
                        type="file"
                        multiple
                        accept={legalDocumentPolicy.acceptAttribute}
                        className="sr-only"
                        onChange={handleDocumentUpload}
                      />
                    </label>
                  </div>
                  {documentUploadState.message ? (
                    <p
                      className={cn(
                        "mt-4 rounded-lg border px-3 py-2 text-sm font-semibold",
                        documentUploadState.tone === "success" && "border-sage/25 bg-sage/10 text-sage-foreground",
                        documentUploadState.tone === "error" && "border-destructive/20 bg-destructive/10 text-destructive",
                        documentUploadState.tone === "info" && "border-primary/20 bg-primary/10 text-primary",
                      )}
                    >
                      {documentUploadState.message}
                    </p>
                  ) : null}
                </div>

                <div className="mt-5 space-y-3">
                  {workspace.documents.length > 0 ? (
                    workspace.documents.map((document) => (
                      <div key={document.id} className="rounded-xl border border-border bg-card p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-foreground">{document.name}</p>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                              {document.category} · {formatFileSize(document.size)} · {new Date(document.uploadedAt).toLocaleDateString("el-GR")}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!document.storagePath && !document.downloadUrl}
                              onClick={() =>
                                void createUserDocumentDownloadUrl(document).then((url) => {
                                  if (url && typeof window !== "undefined") {
                                    window.open(url, "_blank", "noopener,noreferrer");
                                  }
                                })
                              }
                              className="rounded-xl font-bold"
                            >
                              <Download className="h-4 w-4" />
                              Λήψη
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void setUserDocumentVisibilityPersisted(workspaceKey, document.id, !document.visibleToLawyer, userId).then(setWorkspace)}
                              aria-pressed={document.visibleToLawyer}
                              className="rounded-xl font-bold"
                            >
                              {document.visibleToLawyer ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                              {document.visibleToLawyer ? "Ορατό" : "Ιδιωτικό"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void removeUserDocumentPersisted(workspaceKey, document.id, userId).then((nextWorkspace) => {
                                  setWorkspace(nextWorkspace);
                                  createOperationalCase({
                                    area: "privacyDocuments",
                                    title: "Document deletion record",
                                    summary: `Client removed ${document.name}. Confirm retention/deletion obligations and support visibility state.`,
                                    priority: "normal",
                                    requesterEmail: userEmail,
                                    relatedReference: document.id,
                                    evidence: [
                                      `Document category: ${document.category}`,
                                      `Visible to lawyer before deletion: ${document.visibleToLawyer ? "yes" : "no"}`,
                                    ],
                                  });
                                })
                              }
                              aria-label={`Διαγραφή ${document.name}`}
                              className="rounded-xl font-bold text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              Διαγραφή
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={FileText} title="Δεν υπάρχουν έγγραφα" description="Ανεβάστε αρχεία που θέλετε να βρίσκονται δίπλα στα ραντεβού σας." />
                  )}
                </div>
              </Panel>
            ) : null}

            {activeView === "payments" ? (
              <div className="space-y-6">
                <Panel title="Μέθοδος πληρωμής" eyebrow="Κάρτα">
                  <SecurePaymentMethodForm
                    paymentMethod={workspace.paymentMethod}
                    onSetup={handlePaymentSetup}
                    loading={paymentSetupState.loading}
                    message={paymentSetupState.message}
                    tone={paymentSetupState.tone}
                  />
                </Panel>

                <Panel title="Πληρωμές και αποδείξεις" eyebrow="Τιμολόγια">
                  {bookings.length > 0 ? (
                    <div className="space-y-3">
                      {bookings.map((booking) => (
                        <InvoiceCard
                          key={booking.id}
                          booking={booking}
                          payment={payments.find((payment) => payment.bookingId === booking.id)}
                          onCheckout={() => handleBookingCheckout(booking)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={CreditCard} title="Δεν υπάρχουν πληρωμές" description="Οι αποδείξεις και οι χρεώσεις θα εμφανίζονται μετά από κράτηση." />
                  )}
                </Panel>
              </div>
            ) : null}

            {activeView === "reviews" ? (
              <Panel title="Κριτικές μετά από ραντεβού" eyebrow="Επαληθευμένες κριτικές">
                <div className="space-y-4">
                  {reviewableBookings.length > 0 ? (
                    reviewableBookings.map((booking) => {
                      const existingReview = workspace.reviews.find((review) => review.bookingId === booking.id);
                      const draft = reviewDrafts[booking.id] || {
                        rating: existingReview?.rating || 5,
                        clarityRating: existingReview?.clarityRating || 5,
                        responsivenessRating: existingReview?.responsivenessRating || 5,
                        text: existingReview?.text || "",
                      };

                      return (
                        <ReviewComposer
                          key={booking.id}
                          booking={booking}
                          draft={draft}
                          submitted={Boolean(existingReview)}
                          submitState={reviewSubmitState[booking.id]}
                          onChange={(updates) => handleReviewDraftChange(booking.id, updates)}
                          onSubmit={() => handleSubmitReview(booking)}
                        />
                      );
                    })
                  ) : (
                    <EmptyState
                      icon={MessageSquareQuote}
                      title={unsyncedCompletedBookings.length > 0 ? "Το ολοκληρωμένο ραντεβού δεν έχει συγχρονιστεί" : "Οι κριτικές ανοίγουν μετά από ολοκληρωμένο ραντεβού"}
                      description={
                        unsyncedCompletedBookings.length > 0
                          ? "Το ραντεβού φαίνεται ολοκληρωμένο μόνο τοπικά. Ο συνεργάτης πρέπει να συγχρονίσει την ολοκλήρωση στο Supabase από τον πίνακα συνεργάτη πριν ανοίξει επαληθευμένη κριτική."
                          : "Μόνο πραγματικές κρατήσεις μπορούν να αφήσουν κριτική, ώστε το δημόσιο προφίλ του δικηγόρου να παραμένει αξιόπιστο."
                      }
                    />
                  )}
                </div>
              </Panel>
            ) : null}

            {activeView === "privacy" ? (
              <div className="space-y-6">
                <Panel title="Νομικές προτιμήσεις" eyebrow="Προσωποποίηση">
                  <PreferencesForm workspace={workspace} updatePreferences={updatePreferences} toggleLegalCategory={toggleLegalCategory} />
                </Panel>

                <Panel title="Απόρρητο και ειδοποιήσεις" eyebrow="Έλεγχος δεδομένων">
                  <div className="grid gap-3">
                    <SettingToggle
                      icon={ShieldCheck}
                      title="Κοινοποίηση τηλεφώνου μετά την κράτηση"
                      description="Το τηλέφωνό σας δεν εμφανίζεται σε δικηγόρους που απλώς βλέπετε ή αποθηκεύετε."
                      enabled={workspace.privacy.sharePhoneWithBookedLawyers}
                      onToggle={() => updateBooleanSetting("privacy", "sharePhoneWithBookedLawyers")}
                    />
                    <SettingToggle
                      icon={FileText}
                      title="Έγγραφα ορατά μόνο σε συνδεδεμένα ραντεβού"
                      description="Κάθε αρχείο κρατά δική του ένδειξη ορατότητας."
                      enabled={workspace.privacy.allowDocumentAccessByBooking}
                      onToggle={() => updateBooleanSetting("privacy", "allowDocumentAccessByBooking")}
                    />
                    <SettingToggle
                      icon={Bell}
                      title="Υπενθυμίσεις ραντεβού"
                      description="Στείλτε μου χρήσιμες υπενθυμίσεις πριν από το ραντεβού."
                      enabled={workspace.notifications.reminders}
                      onToggle={() => updateBooleanSetting("notifications", "reminders")}
                    />
                    <SettingToggle
                      icon={Settings2}
                      title="Ενημερώσεις προϊόντος"
                      description="Λάβετε σπάνιες ενημερώσεις για νέες λειτουργίες."
                      enabled={workspace.privacy.productUpdates}
                      onToggle={() => updateBooleanSetting("privacy", "productUpdates")}
                    />
                  </div>
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

const AccountProfileForm = ({
  draft,
  email,
  saveState,
  onChange,
  onSave,
}: {
  draft: AccountProfileDraft;
  email: string;
  saveState: PaymentActionState;
  onChange: (updates: Partial<AccountProfileDraft>) => void;
  onSave: () => void;
}) => (
  <div className="rounded-lg border border-border bg-secondary/35 p-5">
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Ηλεκτρονικό ταχυδρομείο σύνδεσης">
        <input
          value={email}
          readOnly
          className="h-11 w-full rounded-lg border border-border bg-muted px-3 text-sm font-medium text-muted-foreground"
        />
      </Field>
      <Field label="Όνομα">
        <input
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
      </Field>
      <Field label="Τηλέφωνο">
        <input
          type="tel"
          value={draft.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          placeholder="π.χ. 69..."
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
      </Field>
      <Field label="Πόλη / περιοχή">
        <input
          value={draft.city}
          onChange={(event) => onChange({ city: event.target.value })}
          placeholder="π.χ. Αθήνα"
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
      </Field>
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

    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm leading-6 text-muted-foreground">
        Το όνομα, το τηλέφωνο και η πόλη αποθηκεύονται στον ασφαλή λογαριασμό σας.
      </p>
      <Button
        type="button"
        onClick={onSave}
        disabled={saveState.loading || !draft.name.trim()}
        className="rounded-lg font-bold"
      >
        {saveState.loading ? "Αποθήκευση..." : "Αποθήκευση αλλαγών"}
      </Button>
    </div>
  </div>
);

const BookingCard = ({
  booking,
  onCancel,
  featured = false,
}: {
  booking: StoredBooking;
  onCancel: (bookingId: string) => void;
  featured?: boolean;
}) => {
  const verified = isVerifiedBooking(booking);

  return (
  <article className={cn("rounded-xl border border-border bg-card p-4", featured && "border-sage/25 bg-sage/10")}>
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
            {statusLabels[booking.status]}
          </span>
          {!verified ? (
            <span className="rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-[11px] font-bold text-destructive">
              Τοπική εγγραφή
            </span>
          ) : null}
          <span className="text-xs font-semibold text-muted-foreground">{booking.referenceId}</span>
        </div>
        <h3 className="mt-3 font-bold text-foreground">{booking.lawyerName}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{booking.issueSummary || booking.consultationType}</p>
        {!verified ? (
          <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-semibold leading-5 text-destructive">
            Δεν υπάρχει επαληθευμένη εγγραφή στο Supabase. Δεν ανοίγουν πληρωμές, αποδείξεις ή κριτικές μέχρι να δημιουργηθεί πραγματική κράτηση.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{booking.dateLabel}</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{booking.time}</span>
          <span>€{booking.price}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        <Button asChild variant="outline" size="sm" className="rounded-xl font-bold">
          <Link to={`/lawyer/${booking.lawyerId}`}>Προφίλ</Link>
        </Button>
        {booking.status === "confirmed" ? (
          <>
            <Button asChild size="sm" className="rounded-xl font-bold">
              <Link to={`/booking/${booking.lawyerId}`}>Αλλαγή ώρας</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onCancel(booking.id)} disabled={!verified} className="rounded-xl font-bold">
              Ακύρωση
            </Button>
          </>
        ) : null}
      </div>
    </div>
  </article>
  );
};

const SecurePaymentMethodForm = ({
  paymentMethod,
  onSetup,
  loading,
  message,
  tone,
}: {
  paymentMethod: UserWorkspace["paymentMethod"];
  onSetup: () => void;
  loading: boolean;
  message: string;
  tone: PaymentActionState["tone"];
}) => (
  <div className="rounded-xl border border-border bg-secondary/35 p-5">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="font-bold text-foreground">Ασφαλές προφίλ πληρωμής μέσω Stripe</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Τα στοιχεία κάρτας συλλέγονται μόνο σε Stripe-hosted ροή και δεν πληκτρολογούνται μέσα στο προφίλ.
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Κατάσταση: {paymentMethodStatusLabels[paymentMethod.status]}
        </p>
        {paymentMethod.defaultMethodLabel ? (
          <p className="mt-1 text-sm font-semibold text-foreground">{paymentMethod.defaultMethodLabel}</p>
        ) : null}
        {message ? (
          <p
            className={cn(
              "mt-3 rounded-xl border px-3 py-2 text-sm font-semibold",
              tone === "error" && "border-destructive/20 bg-destructive/10 text-destructive",
              tone === "success" && "border-sage/25 bg-sage/10 text-sage-foreground",
              tone === "info" && "border-primary/20 bg-primary/10 text-primary",
            )}
          >
            {message}
          </p>
        ) : null}
      </div>
      <Button type="button" onClick={onSetup} disabled={loading} className="rounded-xl font-bold">
        {loading ? "Προετοιμασία..." : "Ασφαλής σύνδεση"}
      </Button>
    </div>
  </div>
);

const InvoiceCard = ({
  booking,
  payment,
  onCheckout,
}: {
  booking: StoredBooking;
  payment?: StoredPayment;
  onCheckout: () => void;
}) => {
  const canOpenReceipt = Boolean(payment?.receiptUrl);
  const verified = isVerifiedBooking(booking);
  const canCheckout = verified && booking.status === "confirmed" && payment?.status !== "paid";
  const statusText =
    !verified
      ? "Χρειάζεται επαληθευμένη κράτηση Supabase πριν ανοίξει πληρωμή ή απόδειξη"
      : booking.status === "cancelled"
      ? "Ακυρωμένο χωρίς χρέωση"
      : booking.status === "completed"
        ? "Πληρωμένο · Απόδειξη διαθέσιμη"
        : "Προεγκεκριμένο · τελική απόδειξη μετά την ολοκλήρωση";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold text-foreground">{payment?.invoiceNumber || booking.referenceId}</p>
          <p className="mt-1 text-sm text-muted-foreground">{booking.lawyerName} · {booking.consultationType}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">{statusText}</p>
        </div>
        <div className="flex flex-col gap-2 text-left md:items-end md:text-right">
          <p className="text-xl font-bold text-foreground">€{booking.price}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canCheckout && !canOpenReceipt}
            onClick={() => {
              if (canOpenReceipt && payment?.receiptUrl && typeof window !== "undefined") {
                window.open(payment.receiptUrl, "_blank", "noopener,noreferrer");
                return;
              }
              onCheckout();
            }}
            className="rounded-xl font-bold"
          >
            {canOpenReceipt ? "Άνοιγμα απόδειξης" : canCheckout ? "Πληρωμή" : "Απόδειξη σε αναμονή"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const ReviewComposer = ({
  booking,
  draft,
  submitted,
  submitState,
  onChange,
  onSubmit,
}: {
  booking: StoredBooking;
  draft: { rating: number; clarityRating: number; responsivenessRating: number; text: string };
  submitted: boolean;
  submitState?: ReviewSubmitState;
  onChange: (updates: Partial<typeof draft>) => void;
  onSubmit: () => void;
}) => (
  <article className="rounded-xl border border-border bg-card p-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <p className="font-bold text-foreground">{booking.lawyerName}</p>
        <p className="mt-1 text-sm text-muted-foreground">{booking.referenceId} · {booking.consultationType}</p>
      </div>
      {submitted ? (
        <span className="rounded-full bg-sage/15 px-3 py-1 text-xs font-bold text-sage-foreground">Δημοσιευμένη</span>
      ) : null}
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <RatingField label="Συνολικά" value={draft.rating} onChange={(rating) => onChange({ rating })} />
      <RatingField label="Σαφήνεια" value={draft.clarityRating} onChange={(clarityRating) => onChange({ clarityRating })} />
      <RatingField label="Ανταπόκριση" value={draft.responsivenessRating} onChange={(responsivenessRating) => onChange({ responsivenessRating })} />
    </div>
    <textarea
      value={draft.text}
      onChange={(event) => onChange({ text: event.target.value })}
      placeholder="Γράψτε τι βοήθησε περισσότερο στο ραντεβού."
      className="mt-4 min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25"
    />
    {submitState?.message ? (
      <p
        className={cn(
          "mt-3 rounded-xl border px-3 py-2 text-sm font-semibold",
          submitState.tone === "success" && "border-sage/25 bg-sage/10 text-sage-foreground",
          submitState.tone === "error" && "border-destructive/20 bg-destructive/10 text-destructive",
          submitState.tone === "info" && "border-primary/20 bg-primary/10 text-primary",
        )}
      >
        {submitState.message}
      </p>
    ) : null}
    <Button type="button" onClick={onSubmit} disabled={draft.text.trim().length < 12 || submitState?.loading} className="mt-3 rounded-xl font-bold">
      {submitState?.loading ? "Υποβολή..." : submitted ? "Ενημέρωση κριτικής" : "Υποβολή κριτικής"}
    </Button>
  </article>
);

const RatingField = ({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) => (
  <Field label={label}>
    <select
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
    >
      {[5, 4, 3, 2, 1].map((rating) => (
        <option key={rating} value={rating}>{rating}/5</option>
      ))}
    </select>
  </Field>
);

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
  <article className="rounded-xl border border-border bg-card p-4">
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <img src={lawyer.image} alt={lawyer.name} className="h-16 w-16 rounded-xl object-cover ring-2 ring-background" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-bold text-foreground">{lawyer.name}</p>
            <p className="mt-1 text-sm font-semibold text-primary/80">{lawyer.specialty}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{lawyer.city}</span>
              <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-gold text-gold" />{lawyer.rating}</span>
              <span>από €{lawyer.price}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={compared ? "default" : "outline"} size="sm" onClick={onCompare} className="rounded-xl font-bold">
              {compared ? "Στη σύγκριση" : "Σύγκριση"}
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl font-bold">
              <Link to={`/lawyer/${lawyer.id}`}>Προφίλ</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onRemove} aria-label={`Αφαίρεση ${lawyer.name}`} className="rounded-xl font-bold text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {onNote ? (
          <textarea
            value={note || ""}
            onChange={(event) => onNote(event.target.value)}
            placeholder="Ιδιωτική σημείωση, π.χ. καλός για μισθωτική διαφορά"
            className="mt-4 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        ) : null}
      </div>
    </div>
  </article>
);

const PreferencesForm = ({
  workspace,
  updatePreferences,
  toggleLegalCategory,
  compact = false,
}: {
  workspace: UserWorkspace;
  updatePreferences: (updates: Partial<UserWorkspace["preferences"]>) => void;
  toggleLegalCategory: (category: string) => void;
  compact?: boolean;
}) => (
  <div className="space-y-5">
    <div className={cn("grid gap-3", compact ? "md:grid-cols-2" : "md:grid-cols-3")}>
      <Field label="Πόλη / περιοχή">
        <input
          value={workspace.preferences.city}
          onChange={(event) => updatePreferences({ city: event.target.value })}
          placeholder="π.χ. Αθήνα"
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
      </Field>
      <Field label="Τρόπος συμβουλευτικής">
        <select
          value={workspace.preferences.consultationMode}
          onChange={(event) => updatePreferences({ consultationMode: event.target.value as ConsultationMode | "any" })}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
        >
          {consultationOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Προϋπολογισμός">
        <select
          value={workspace.preferences.budgetRange}
          onChange={(event) => updatePreferences({ budgetRange: event.target.value })}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
        >
          <option value="">Δεν έχει οριστεί</option>
          {budgetOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </Field>
      <Field label="Επείγον">
        <select
          value={workspace.preferences.urgency}
          onChange={(event) => updatePreferences({ urgency: event.target.value })}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
        >
          <option value="">Δεν έχει οριστεί</option>
          {urgencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </Field>
      <Field label="Γλώσσα">
        <input
          value={workspace.preferences.language}
          onChange={(event) => updatePreferences({ language: event.target.value })}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
      </Field>
    </div>

    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Συχνές κατηγορίες</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {specialtyOptions.map((category) => {
          const active = workspace.preferences.legalCategories.includes(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => toggleLegalCategory(category)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/30",
              )}
            >
              {category}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

export default UserProfile;
