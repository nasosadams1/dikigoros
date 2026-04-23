import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  MessageSquareQuote,
  Settings2,
  ShieldCheck,
  Star,
  Workflow,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";
import { consultationModeLabels, type ConsultationMode, type Lawyer } from "@/data/lawyers";
import { getLawyerBaseProfileById, getPublicLawyerProfileReadiness } from "@/lib/lawyerRepository";
import {
  clearPartnerSession,
  cancelPartnerBooking,
  completePartnerBooking,
  fetchBookingsForLawyer,
  fetchDocumentsForLawyer,
  fetchPaymentsForLawyer,
  fetchReviewsForLawyer,
  getPartnerSession,
  isPartnerSessionInvalidError,
  isVerifiedBooking,
  updateLawyerReview,
  type StoredBooking,
  type StoredBookingDocument,
  type StoredLawyerReview,
  type StoredPayment,
} from "@/lib/platformRepository";
import {
  bookingStateLabels,
  canSubmitReview,
  getCanonicalBookingState,
  getCanonicalPaymentState,
  isBookingScheduled,
  paymentStateLabels,
  reviewPublicationStateLabels,
} from "@/lib/bookingState";
import {
  applyPartnerWorkspaceToLawyer,
  fetchPartnerWorkspace,
  fetchPartnerProfilePhotoState,
  formatListInput,
  getPartnerWorkspace,
  isSupportedProfilePhotoFile,
  parseListInput,
  syncPartnerWorkspace,
  submitPartnerProfilePhoto,
  type PartnerAvailabilitySlot,
  type PartnerProfilePhotoState,
  type PartnerWorkspace,
  partnerProfilePhotoPolicy,
} from "@/lib/partnerWorkspace";
import { trackFunnelEvent } from "@/lib/funnelAnalytics";
import { createOperationalCase } from "@/lib/operationsRepository";
import {
  buildPartnerPipelineItems,
  fetchPartnerCrmState,
  savePartnerCaseNote,
  updatePartnerPipelineStatus,
  upsertPartnerFollowupTask,
  type PartnerCaseNote,
  type PartnerFollowupTask,
  type PartnerPipelineItem,
} from "@/lib/partnerCrmRepository";
import { level4PipelineStatuses, type Level4PipelineStatus } from "@/lib/level4Marketplace";
import { allowedMarketplaceCityNames, legalPracticeAreaLabels } from "@/lib/marketplaceTaxonomy";

const navItems = [
  { id: "pipeline", label: "Ροή υποθέσεων", icon: Workflow },
  { id: "appointments", label: "Ραντεβού", icon: CalendarDays },
  { id: "performance", label: "Απόδοση συνεργασίας", icon: BarChart3 },
  { id: "availability", label: "Διαθεσιμότητα", icon: Clock3 },
  { id: "profile", label: "Προφίλ", icon: UserRoundCog },
  { id: "earnings", label: "Πληρωμές", icon: CreditCard },
  { id: "reviews", label: "Κριτικές", icon: MessageSquareQuote },
  { id: "settings", label: "Ρυθμίσεις", icon: Settings2 },
] as const;

type PartnerView = (typeof navItems)[number]["id"];
type BookingActionState = {
  loading: boolean;
  message: string;
  tone: "success" | "error" | "info";
};
type SaveState = {
  loading: boolean;
  message: string;
  tone: "success" | "error" | "info";
};

const partnerViewIds = new Set<PartnerView>(navItems.map((item) => item.id));
const parsePartnerView = (value: string | null): PartnerView =>
  value && partnerViewIds.has(value as PartnerView) ? (value as PartnerView) : "appointments";

const viewMeta: Record<PartnerView, { title: string; description: string }> = {
  pipeline: {
    title: "Ροή υποθέσεων για κάθε στάδιο πελάτη.",
    description: "Παρακολουθήστε κρατήσεις, πληρωμές, επερχόμενα ραντεβού, ολοκληρώσεις, εκκρεμείς αξιολογήσεις, πιθανές επιστροφές και υπενθυμίσεις συνέχειας.",
  },
  appointments: {
    title: "Ραντεβού και αιτήματα με καθαρή εικόνα ημέρας.",
    description: "Δείτε κρατήσεις, στοιχεία πελάτη, θέμα, κατάσταση και τις επόμενες ενέργειες.",
  },
  performance: {
    title: "Απόδοση συνεργασίας από μία ενιαία καρτέλα.",
    description: "Παρακολουθήστε ζήτηση, πληρωμένες κρατήσεις, πρώτες συνεδρίες, κριτικές και λειτουργικές εκκρεμότητες.",
  },
  availability: {
    title: "Διαθεσιμότητα που αποθηκεύεται άμεσα.",
    description: "Ορίστε ημέρες, ώρες, σημειώσεις, κενά ασφαλείας και κανόνες κράτησης.",
  },
  profile: {
    title: "Επεξεργάσιμο δημόσιο προφίλ συνεργάτη.",
    description: "Διαχειριστείτε ειδικότητες, γλώσσες, τρόπους συνεδρίας, τιμές και πολιτική ακύρωσης.",
  },
  earnings: {
    title: "Πληρωμές, εκταμιεύσεις και τιμολόγια.",
    description: "Παρακολουθήστε ολοκληρωμένες συνεδρίες, έσοδα σε αναμονή και αποδείξεις συνεργασίας.",
  },
  reviews: {
    title: "Κριτικές από πραγματικά ραντεβού.",
    description: "Απαντήστε δημόσια, σημάνετε προβληματικές κριτικές και παρακολουθήστε την εικόνα σας.",
  },
  settings: {
    title: "Ρυθμίσεις λογαριασμού και λειτουργίας.",
    description: "Ελέγξτε ειδοποιήσεις, αυτόματη επιβεβαίωση, παράθυρο κράτησης και χρόνο κενού.",
  },
};

const consultationModeOptions: ConsultationMode[] = ["video", "phone", "inPerson"];

const getConsultationDescription = (profile: PartnerWorkspace["profile"], mode: ConsultationMode) => {
  if (mode === "phone") return profile.phoneDescription;
  if (mode === "inPerson") return profile.inPersonDescription;
  return profile.videoDescription;
};

const buildConsultationDescriptionUpdate = (
  mode: ConsultationMode,
  value: string,
): Partial<PartnerWorkspace["profile"]> => {
  if (mode === "phone") return { phoneDescription: value };
  if (mode === "inPerson") return { inPersonDescription: value };
  return { videoDescription: value };
};

const getPartnerWorkspaceSaveErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");

  if (message.includes("save_partner_workspace_as_partner") || message.includes("PGRST202")) {
    return "Η αποθήκευση προφίλ δεν είναι διαθέσιμη τώρα. Ζητήστε έλεγχο υποστήριξης συνεργάτη και δοκιμάστε ξανά.";
  }

  if (message.includes("PARTNER_SESSION_INVALID")) {
    return "Η πρόσβαση συνεργάτη έληξε. Συνδεθείτε ξανά και δοκιμάστε πάλι.";
  }

  if (message.includes("401") || message.includes("Unauthorized") || message.includes("JWT")) {
    return "Η πρόσβαση δεν επιβεβαιώθηκε. Κάντε αποσύνδεση και ξανά είσοδο στον πίνακα συνεργάτη.";
  }

  if (message.includes("LAWYER_PROFILE_NOT_FOUND")) {
    return "Ο συνεργάτης δεν είναι συνδεδεμένος με υπαρκτό lawyer profile στη βάση.";
  }

  return "Δεν έγινε αποθήκευση. Ελέγξτε τη σύνδεση και δοκιμάστε πάλι.";
};

const buildWorkspaceSaveSnapshot = (workspace: PartnerWorkspace) => ({
  profile: {
    displayName: workspace.profile.displayName,
    officeName: workspace.profile.officeName,
    city: workspace.profile.city,
    primarySpecialty: workspace.profile.primarySpecialty,
    serviceArea: workspace.profile.serviceArea,
    bestFor: workspace.profile.bestFor,
    bio: workspace.profile.bio,
    experienceYears: workspace.profile.experienceYears,
    specialties: [...workspace.profile.specialties],
    languages: [...workspace.profile.languages],
    consultationModes: [...workspace.profile.consultationModes],
    videoPrice: workspace.profile.videoPrice,
    phonePrice: workspace.profile.phonePrice,
    inPersonPrice: workspace.profile.inPersonPrice,
    videoDescription: workspace.profile.videoDescription,
    phoneDescription: workspace.profile.phoneDescription,
    inPersonDescription: workspace.profile.inPersonDescription,
    cancellationPolicy: workspace.profile.cancellationPolicy,
    autoConfirm: workspace.profile.autoConfirm,
    bookingWindowDays: workspace.profile.bookingWindowDays,
    bufferMinutes: workspace.profile.bufferMinutes,
  },
  availability: workspace.availability.map((slot) => ({
    day: slot.day,
    enabled: slot.enabled,
    start: slot.start,
    end: slot.end,
    note: slot.note,
  })),
  notifications: {
    bookingEmail: workspace.notifications.bookingEmail,
    bookingSms: workspace.notifications.bookingSms,
    weeklyDigest: workspace.notifications.weeklyDigest,
  },
});

const hasWorkspaceSaveChanges = (currentWorkspace: PartnerWorkspace, savedWorkspace: PartnerWorkspace) =>
  JSON.stringify(buildWorkspaceSaveSnapshot(currentWorkspace)) !==
  JSON.stringify(buildWorkspaceSaveSnapshot(savedWorkspace));

const PartnerPortal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(() => getPartnerSession());
  const email = session?.email || "";
  const [activeView, setActiveView] = useState<PartnerView>(() => parsePartnerView(searchParams.get("view")));
  const [workspace, setWorkspace] = useState<PartnerWorkspace>(() => getPartnerWorkspace(email));
  const [savedWorkspace, setSavedWorkspace] = useState<PartnerWorkspace>(() => getPartnerWorkspace(email));
  const [bookingsVersion, setBookingsVersion] = useState(0);
  const [partnerBookings, setPartnerBookings] = useState<StoredBooking[]>([]);
  const [partnerPayments, setPartnerPayments] = useState<StoredPayment[]>([]);
  const [partnerReviews, setPartnerReviews] = useState<StoredLawyerReview[]>([]);
  const [partnerDocuments, setPartnerDocuments] = useState<StoredBookingDocument[]>([]);
  const [partnerCaseNotes, setPartnerCaseNotes] = useState<PartnerCaseNote[]>([]);
  const [partnerFollowups, setPartnerFollowups] = useState<PartnerFollowupTask[]>([]);
  const [profilePhotoState, setProfilePhotoState] = useState<PartnerProfilePhotoState | null>(null);
  const [bookingActionState, setBookingActionState] = useState<Record<string, BookingActionState>>({});
  const [searchVisibilityBaseLawyer, setSearchVisibilityBaseLawyer] = useState<Lawyer | null | undefined>(undefined);
  const [profileSaveState, setProfileSaveState] = useState<SaveState>({
    loading: false,
    message: "",
    tone: "info",
  });
  const [profilePhotoUploadState, setProfilePhotoUploadState] = useState<SaveState>({
    loading: false,
    message: "",
    tone: "info",
  });

  const handleExpiredPartnerSession = useCallback(() => {
    clearPartnerSession();
    setSession(null);
    navigate("/for-lawyers/login", { replace: true, state: { partnerError: "sessionExpired" } });
  }, [navigate]);

  useEffect(() => {
    if (!session) {
      navigate("/for-lawyers/login", { replace: true });
    }
  }, [navigate, session]);

  useEffect(() => {
    const localWorkspace = getPartnerWorkspace(email);
    setWorkspace(localWorkspace);
    setSavedWorkspace(localWorkspace);
    setProfileSaveState({ loading: false, message: "", tone: "info" });

    let active = true;
    void fetchPartnerWorkspace(email).then((nextWorkspace) => {
      if (!active) return;
      setWorkspace(nextWorkspace);
      setSavedWorkspace(nextWorkspace);
    }).catch(() => {
      if (!active) return;
      setProfileSaveState({
        loading: false,
        message: "Ο χώρος συνεργάτη είναι προσωρινά μη διαθέσιμος. Δεν χρησιμοποιείται τοπικό προφίλ όταν το σύστημα δεν απαντά.",
        tone: "error",
      });
    });

    return () => {
      active = false;
    };
  }, [email]);

  useEffect(() => {
    setActiveView(parsePartnerView(searchParams.get("view")));
  }, [searchParams]);

  useEffect(() => {
    if (!workspace.profile.lawyerId) {
      setSearchVisibilityBaseLawyer(null);
      return;
    }

    let active = true;
    setSearchVisibilityBaseLawyer(undefined);

    void getLawyerBaseProfileById(workspace.profile.lawyerId).then((lawyer) => {
      if (active) setSearchVisibilityBaseLawyer(lawyer);
    });

    return () => {
      active = false;
    };
  }, [workspace.profile.lawyerId]);

  useEffect(() => {
    let active = true;

    void Promise.all([
      fetchBookingsForLawyer(workspace.profile.lawyerId, session),
      fetchPaymentsForLawyer(workspace.profile.lawyerId, session),
      fetchReviewsForLawyer(workspace.profile.lawyerId, true, session),
      fetchDocumentsForLawyer(workspace.profile.lawyerId, session),
      fetchPartnerCrmState(workspace.profile.lawyerId, session),
    ])
      .then(([nextBookings, nextPayments, nextReviews, nextDocuments, nextCrm]) => {
        if (!active) return;
        setPartnerBookings(nextBookings);
        setPartnerPayments(nextPayments);
        setPartnerReviews(nextReviews);
        setPartnerDocuments(nextDocuments);
        setPartnerCaseNotes(nextCrm.notes);
        setPartnerFollowups(nextCrm.followups);
      })
      .catch((error) => {
        if (!active) return;
        if (isPartnerSessionInvalidError(error)) handleExpiredPartnerSession();
        else {
          setPartnerBookings([]);
          setPartnerPayments([]);
          setPartnerReviews([]);
          setPartnerDocuments([]);
          setPartnerCaseNotes([]);
          setPartnerFollowups([]);
          setProfileSaveState({
            loading: false,
            message: "Τα ραντεβού, οι πληρωμές και τα έγγραφα συνεργάτη είναι προσωρινά μη διαθέσιμα από το σύστημα.",
            tone: "error",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [bookingsVersion, handleExpiredPartnerSession, session, workspace.profile.lawyerId]);

  useEffect(() => {
    if (!session?.sessionToken || !email) {
      setProfilePhotoState(null);
      return;
    }

    let active = true;
    void fetchPartnerProfilePhotoState(email, session)
      .then((nextState) => {
        if (!active) return;
        setProfilePhotoState(nextState);
      })
      .catch((error) => {
        if (!active) return;
        if (isPartnerSessionInvalidError(error)) {
          handleExpiredPartnerSession();
          return;
        }
        setProfilePhotoUploadState({
          loading: false,
          message: "Η κατάσταση φωτογραφίας προφίλ είναι προσωρινά μη διαθέσιμη από το σύστημα.",
          tone: "error",
        });
      });

    return () => {
      active = false;
    };
  }, [email, handleExpiredPartnerSession, session]);

  const displayBookings = partnerBookings;
  const pipelineItems = useMemo(
    () =>
      buildPartnerPipelineItems({
        bookings: partnerBookings,
        payments: partnerPayments,
        documents: partnerDocuments,
        reviews: partnerReviews,
        notes: partnerCaseNotes,
        followups: partnerFollowups,
      }),
    [partnerBookings, partnerCaseNotes, partnerDocuments, partnerFollowups, partnerPayments, partnerReviews],
  );
  const paymentForBooking = (bookingId: string) => partnerPayments.find((payment) => payment.bookingId === bookingId);
  const confirmedBookings = partnerBookings.filter((booking) => isBookingScheduled(booking, paymentForBooking(booking.id)));
  const completedBookings = partnerBookings.filter((booking) => booking.status === "completed");
  const completedRevenueCents = partnerPayments
    .filter((payment) => getCanonicalPaymentState(payment) === "paid")
    .reduce((sum, payment) => sum + getPartnerNetCents(payment), 0);
  const pendingRevenueCents = partnerPayments
    .filter((payment) => getCanonicalPaymentState(payment) === "checkout_opened" || getCanonicalPaymentState(payment) === "not_opened")
    .reduce((sum, payment) => sum + getPartnerNetCents(payment), 0);
  const completedPlatformFeeCents = partnerPayments
    .filter((payment) => getCanonicalPaymentState(payment) === "paid")
    .reduce((sum, payment) => sum + getPartnerFeeCents(payment), 0);
  const paidBookings = partnerPayments.filter((payment) => getCanonicalPaymentState(payment) === "paid").length;
  const failedPaymentCount = partnerPayments.filter((payment) => getCanonicalPaymentState(payment) === "failed").length;
  const refundIssueCount = partnerPayments.filter((payment) => getCanonicalPaymentState(payment) === "refund_requested").length;
  const reviewRate = completedBookings.length ? Math.round((partnerReviews.length / completedBookings.length) * 100) : 0;
  const pendingModerationCount = partnerReviews.filter((review) => review.status === "under_moderation" || review.status === "submitted").length;
  const averageReview = partnerReviews.length
    ? (partnerReviews.reduce((sum, review) => sum + review.rating, 0) / partnerReviews.length).toFixed(1)
    : "0.0";
  const currentView = viewMeta[activeView];
  const hasUnsavedChanges = hasWorkspaceSaveChanges(workspace, savedWorkspace);
  const searchVisibility = useMemo(() => {
    if (searchVisibilityBaseLawyer === undefined) {
      return {
        loading: true,
        ready: false,
        issues: [] as string[],
      };
    }

    if (!searchVisibilityBaseLawyer) {
      return {
        loading: false,
        ready: false,
        issues: [
          "Δεν βρέθηκε ενεργό lawyer profile συνδεδεμένο με αυτόν τον λογαριασμό. Ελέγξτε ότι το profile έχει δημιουργηθεί σωστά και είναι active.",
        ],
      };
    }

    return {
      loading: false,
      ...getPublicLawyerProfileReadiness(applyPartnerWorkspaceToLawyer(searchVisibilityBaseLawyer, workspace)),
    };
  }, [searchVisibilityBaseLawyer, workspace]);

  useEffect(() => {
    if (hasUnsavedChanges) return;

    setProfileSaveState((current) =>
      current.loading || current.tone !== "info" || !current.message
        ? current
        : { loading: false, message: "", tone: "info" },
    );
  }, [hasUnsavedChanges]);

  const updateWorkspaceDraft = useCallback((nextWorkspace: PartnerWorkspace) => {
    setWorkspace(nextWorkspace);
    setProfileSaveState({
      loading: false,
      message: "Υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί.",
      tone: "info",
    });
  }, []);

  const saveWorkspaceChanges = async () => {
    if (!hasUnsavedChanges) return;

    setProfileSaveState({ loading: true, message: "Αποθήκευση αλλαγών...", tone: "info" });

    try {
      const savedWorkspace = await syncPartnerWorkspace(email, workspace, session, {
        throwOnRemoteError: true,
      });
      setWorkspace(savedWorkspace);
      setSavedWorkspace(savedWorkspace);
      setProfileSaveState({
        loading: false,
        message: "Οι αλλαγές αποθηκεύτηκαν στο δημόσιο προφίλ.",
        tone: "success",
      });
    } catch (error) {
      if (isPartnerSessionInvalidError(error)) {
        handleExpiredPartnerSession();
        return;
      }
      setProfileSaveState({
        loading: false,
        message: getPartnerWorkspaceSaveErrorMessage(error),
        tone: "error",
      });
    }
  };

  const updateProfile = (updates: Partial<PartnerWorkspace["profile"]>) => {
    updateWorkspaceDraft({
      ...workspace,
      profile: {
        ...workspace.profile,
        ...updates,
      },
    });
  };

  const updateAvailability = (day: string, updates: Partial<PartnerAvailabilitySlot>) => {
    updateWorkspaceDraft({
      ...workspace,
      availability: workspace.availability.map((slot) =>
        slot.day === day ? { ...slot, ...updates } : slot,
      ),
    });
  };

  const updateNotifications = (updates: Partial<PartnerWorkspace["notifications"]>) => {
    updateWorkspaceDraft({
      ...workspace,
      notifications: {
        ...workspace.notifications,
        ...updates,
      },
    });
  };

  const updateReview = (reviewId: string, updates: Partial<StoredLawyerReview>) => {
    setPartnerReviews((current) =>
      current.map((review) => (review.id === reviewId ? { ...review, ...updates } : review)),
    );
    void updateLawyerReview(
      reviewId,
      {
        reply: updates.reply,
        status: updates.status,
      },
      session,
    )
      .then(() => {
        setBookingsVersion((version) => version + 1);
      })
      .catch((error) => {
        if (isPartnerSessionInvalidError(error)) {
          handleExpiredPartnerSession();
          return;
        }
        setProfileSaveState({
          loading: false,
          message: getPartnerWorkspaceSaveErrorMessage(error),
          tone: "error",
        });
      });
  };

  const addPipelineNote = async (booking: StoredBooking, note: string) => {
    if (!note.trim()) return;
    try {
      const savedNote = await savePartnerCaseNote(booking, note.trim(), session);
      setPartnerCaseNotes((current) => [savedNote, ...current]);
      setProfileSaveState({ loading: false, message: "Η σημείωση αποθηκεύτηκε.", tone: "success" });
    } catch (error) {
      if (isPartnerSessionInvalidError(error)) {
        handleExpiredPartnerSession();
        return;
      }
      setProfileSaveState({ loading: false, message: getPartnerWorkspaceSaveErrorMessage(error), tone: "error" });
    }
  };

  const addPipelineFollowup = async (booking: StoredBooking, title: string, dueAt: string) => {
    if (!title.trim() || !dueAt.trim()) return;
    try {
      const savedTask = await upsertPartnerFollowupTask(booking, title.trim(), dueAt, session);
      setPartnerFollowups((current) => [savedTask, ...current]);
      setProfileSaveState({ loading: false, message: "Η υπενθύμιση αποθηκεύτηκε.", tone: "success" });
    } catch (error) {
      if (isPartnerSessionInvalidError(error)) {
        handleExpiredPartnerSession();
        return;
      }
      setProfileSaveState({ loading: false, message: getPartnerWorkspaceSaveErrorMessage(error), tone: "error" });
    }
  };

  const changePipelineStatus = async (booking: StoredBooking, status: Level4PipelineStatus) => {
    try {
      await updatePartnerPipelineStatus(booking, status, session);
      setBookingsVersion((version) => version + 1);
      setProfileSaveState({ loading: false, message: "Η κατάσταση ενημερώθηκε.", tone: "success" });
    } catch (error) {
      if (isPartnerSessionInvalidError(error)) {
        handleExpiredPartnerSession();
        return;
      }
      setProfileSaveState({ loading: false, message: getPartnerWorkspaceSaveErrorMessage(error), tone: "error" });
    }
  };

  const completeBooking = (booking?: StoredBooking) => {
    if (!booking) return;
    void completeBookingPersisted(booking);
  };

  const cancelBooking = (booking?: StoredBooking) => {
    if (!booking) return;
    void cancelBookingPersisted(booking);
  };

  const getProfilePhotoErrorMessage = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || "");

    if (message.includes("PROFILE_PHOTO_UNSUPPORTED_TYPE")) {
      return "Η φωτογραφία πρέπει να είναι JPG, PNG ή WebP.";
    }

    if (message.includes("PROFILE_PHOTO_TOO_LARGE")) {
      return "Η φωτογραφία πρέπει να είναι έως 5 MB.";
    }

    if (message.includes("PARTNER_SESSION_INVALID")) {
      return "Η πρόσβαση συνεργάτη έληξε. Συνδεθείτε ξανά και υποβάλετε τη φωτογραφία.";
    }

    return "Η φωτογραφία δεν υποβλήθηκε. Δοκιμάστε ξανά ή ζητήστε έλεγχο από την υποστήριξη συνεργατών.";
  };

  const submitProfilePhotoForReview = async (file: File) => {
    setProfilePhotoUploadState({
      loading: true,
      message: "Υποβολή φωτογραφίας για έγκριση...",
      tone: "info",
    });

    try {
      const nextState = await submitPartnerProfilePhoto(email, session, file);
      setProfilePhotoState(nextState);
      setProfilePhotoUploadState({
        loading: false,
        message: "Η φωτογραφία υποβλήθηκε για έγκριση. Η δημόσια φωτογραφία δεν αλλάζει μέχρι να εγκριθεί.",
        tone: "success",
      });
    } catch (error) {
      if (isPartnerSessionInvalidError(error)) {
        handleExpiredPartnerSession();
        return;
      }
      setProfilePhotoUploadState({
        loading: false,
        message: getProfilePhotoErrorMessage(error),
        tone: "error",
      });
    }
  };

  const completeBookingPersisted = async (booking: StoredBooking) => {
    if (!isVerifiedBooking(booking)) {
      setBookingActionState((current) => ({
        ...current,
        [booking.id]: {
          loading: false,
          message: "Αυτό το ραντεβού δεν έχει επιβεβαιωθεί πλήρως. Περιμένετε την επιβεβαίωση πριν το σημειώσετε ως ολοκληρωμένο.",
          tone: "error",
        },
      }));
      return;
    }

    if (getCanonicalBookingState(booking) !== "confirmed_paid") {
      setBookingActionState((current) => ({
        ...current,
        [booking.id]: {
          loading: false,
          message: "Η ολοκλήρωση ανοίγει μόνο αφού η πληρωμή έχει επιβεβαιωθεί. Ο πελάτης δεν μπορεί να αφήσει κριτική πριν πληρωθεί και ολοκληρωθεί η συμβουλευτική.",
          tone: "error",
        },
      }));
      return;
    }

    setBookingActionState((current) => ({
      ...current,
      [booking.id]: {
        loading: true,
        message: "Καταχώριση ολοκλήρωσης συμβουλευτικής...",
        tone: "info",
      },
    }));

    const result = await completePartnerBooking(booking, session);
    if (result.error === "PARTNER_SESSION_INVALID") {
      handleExpiredPartnerSession();
      return;
    }
    setBookingActionState((current) => ({
      ...current,
      [booking.id]: result.synced
        ? {
            loading: false,
            message: "Η συμβουλευτική σημειώθηκε ως ολοκληρωμένη. Ο πελάτης μπορεί να αφήσει κριτική μετά τον έλεγχο.",
            tone: "success",
          }
        : {
            loading: false,
            message:
              result.error?.includes("BOOKING_NOT_FOUND")
                ? "Δεν βρέθηκε επιβεβαιωμένη εγγραφή για αυτό το ραντεβού. Η υποστήριξη πρέπει να ελέγξει την κράτηση πριν κλείσει η ολοκλήρωση."
                : "Δεν καταχωρίστηκε η ολοκλήρωση. Δοκιμάστε ξανά ή ανοίξτε υποστήριξη συνεργάτη.",
            tone: "error",
          },
    }));

    if (result.synced) {
      trackFunnelEvent("consultation_completed", {
        bookingId: booking.id,
        lawyerId: booking.lawyerId,
        amount: booking.price,
      });
      if (!completedBookings.some((completedBooking) => completedBooking.lawyerId === booking.lawyerId)) {
        trackFunnelEvent("approved_lawyer_first_completed_consultation", {
          lawyerId: booking.lawyerId,
          bookingId: booking.id,
        });
      }
      setBookingsVersion((version) => version + 1);
    }
  };

  const cancelBookingPersisted = async (booking: StoredBooking) => {
    if (!isVerifiedBooking(booking)) {
      setBookingActionState((current) => ({
        ...current,
        [booking.id]: {
          loading: false,
          message: "Αυτό το ραντεβού δεν έχει επιβεβαιωθεί πλήρως. Η υποστήριξη πρέπει να το ελέγξει πριν γίνει ακύρωση από συνεργάτη.",
          tone: "error",
        },
      }));
      return;
    }

    setBookingActionState((current) => ({
      ...current,
      [booking.id]: {
        loading: true,
        message: "Καταχώριση ακύρωσης και διαδρομής αλλαγής ώρας...",
        tone: "info",
      },
    }));

    const result = await cancelPartnerBooking(booking, session, "lawyer_requested_reschedule");
    if (result.error === "PARTNER_SESSION_INVALID") {
      handleExpiredPartnerSession();
      return;
    }

    setBookingActionState((current) => ({
      ...current,
      [booking.id]: result.synced
        ? {
            loading: false,
            message: "Η ακύρωση καταχωρίστηκε. Ο πελάτης πρέπει να λάβει αλλαγή ώρας, εναλλακτική ή έλεγχο επιστροφής.",
            tone: "success",
          }
        : {
            loading: false,
            message:
              result.error?.includes("BOOKING_NOT_FOUND")
                ? "Δεν βρέθηκε ενεργή πληρωμένη ή επιβεβαιωμένη κράτηση για ακύρωση. Ανοίξτε υποστήριξη συνεργάτη."
                : "Δεν καταχωρίστηκε η ακύρωση. Δοκιμάστε ξανά ή ανοίξτε υποστήριξη συνεργάτη.",
            tone: "error",
          },
    }));

    if (result.synced) {
      void createOperationalCase({
        area: "bookingDisputes",
        title: "Ακύρωση από δικηγόρο - χρειάζεται αλλαγή ώρας",
        summary: `Ο δικηγόρος ακύρωσε την κράτηση ${booking.referenceId}. Ο πελάτης χρειάζεται αλλαγή ώρας, συγκρίσιμη εναλλακτική ή έλεγχο επιστροφής αν κινήθηκε πληρωμή.`,
        priority: "high",
        requesterEmail: booking.clientEmail,
        relatedReference: booking.referenceId,
        evidence: [
          "ακύρωση από δικηγόρο",
          "χρειάζεται αλλαγή ώρας",
          `Κράτηση: ${booking.referenceId}`,
          `Δικηγόρος: ${booking.lawyerName}`,
        ],
      });
      setBookingsVersion((version) => version + 1);
    }
  };

  const handleSignOut = () => {
    clearPartnerSession();
    navigate("/for-lawyers/login", { replace: true });
  };

  const selectPartnerView = (view: PartnerView) => {
    setActiveView(view);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", view);
    navigate({ search: `?${nextParams.toString()}` }, { replace: true });
  };

  return (
    <PartnerShell>
      <section className="grid gap-6 xl:grid-cols-[0.28fr_0.72fr]">
        <aside className="partner-dark-panel p-6 sm:p-7">
          <div className="partner-dark-card-featured p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--partner-gold))]">Χώρος συνεργάτη</p>
            <h1 className="mt-4 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ivory))]">{workspace.profile.displayName}</h1>
            <p className="mt-3 text-sm leading-7 text-white/72">{workspace.profile.officeName}</p>
          </div>

          <nav className="mt-6 space-y-2">
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = activeView === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectPartnerView(id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                    active ? "bg-white/12 text-white" : "text-white/68 hover:bg-white/6 hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-[hsl(var(--partner-gold))]" : "text-white/55"}`} />
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 grid gap-3">
            <div className="partner-dark-card p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--partner-gold))]" />
                <div>
                  <p className="text-sm font-semibold text-white">Ασφαλής πρόσβαση</p>
                  <p className="mt-1 text-sm leading-6 text-white/68">{email}</p>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              className="h-11 rounded-[14px] border-white/14 bg-white/8 text-sm font-semibold text-white hover:bg-white/12 hover:text-white"
            >
              Αποσύνδεση
            </Button>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="partner-panel overflow-hidden p-7 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="partner-kicker">Πίνακας συνεργάτη</p>
                <h2 className="mt-4 font-serif text-[2.6rem] leading-[1.02] tracking-[-0.03em] text-[hsl(var(--partner-ink))]">
                  {currentView.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{currentView.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
                <Metric label="Επόμενα" value={String(confirmedBookings.length || displayBookings.length)} helper="κρατήσεις" />
                <Metric label="Σε αναμονή" value={formatEuroCents(pendingRevenueCents)} helper="προς εκκαθάριση" />
                <Metric label="Αξιολόγηση" value={averageReview} helper={`${partnerReviews.length} κριτικές`} />
              </div>
            </div>
          </section>

          {activeView === "performance" ? (
            <PartnerPerformanceDashboard
              profileViews={null}
              searchAppearances={null}
              profileBookingStarts={null}
              bookingStarts={partnerBookings.length}
              paidBookings={paidBookings}
              completedFirstConsultations={completedBookings.length}
              responseSpeed={workspace.profile.bufferMinutes <= 30 ? "Γρήγορη διαχείριση" : `${workspace.profile.bufferMinutes} λεπτά κενό`}
              categoryPerformance={workspace.profile.specialties.slice(0, 3)}
              reviewRate={reviewRate}
              averageRating={averageReview}
              availabilityHealth={workspace.availability.filter((slot) => slot.enabled).length}
              missingProfileProof={searchVisibility.loading ? [] : searchVisibility.issues}
              pendingModerationItems={pendingModerationCount}
              pendingPaymentIssues={failedPaymentCount + refundIssueCount}
            />
          ) : null}

          {activeView === "appointments" ? (
            <AppointmentsView
              bookings={displayBookings}
              documents={partnerDocuments}
              actionState={bookingActionState}
              onComplete={completeBooking}
              onCancel={cancelBooking}
            />
          ) : null}

          {activeView === "pipeline" ? (
            <PipelineView
              items={pipelineItems}
              onAddNote={(booking, note) => void addPipelineNote(booking, note)}
              onAddFollowup={(booking, title, dueAt) => void addPipelineFollowup(booking, title, dueAt)}
              onChangeStatus={(booking, status) => void changePipelineStatus(booking, status)}
            />
          ) : null}

          {activeView === "availability" ? (
            <AvailabilityView
              workspace={workspace}
              updateAvailability={updateAvailability}
              updateProfile={updateProfile}
              onSave={() => void saveWorkspaceChanges()}
              hasUnsavedChanges={hasUnsavedChanges}
              saveState={profileSaveState}
            />
          ) : null}

          {activeView === "profile" ? (
            <ProfileView
              workspace={workspace}
              updateProfile={updateProfile}
              onSave={() => void saveWorkspaceChanges()}
              searchVisibility={searchVisibility}
              profilePhotoState={profilePhotoState}
              profilePhotoUploadState={profilePhotoUploadState}
              onProfilePhotoSubmit={submitProfilePhotoForReview}
              hasUnsavedChanges={hasUnsavedChanges}
              saveState={profileSaveState}
            />
          ) : null}

          {activeView === "earnings" ? (
            <EarningsView
              completedRevenueCents={completedRevenueCents}
              pendingRevenueCents={pendingRevenueCents}
              completedPlatformFeeCents={completedPlatformFeeCents}
              completedBookings={completedBookings}
              confirmedBookings={confirmedBookings}
              payments={partnerPayments}
            />
          ) : null}

          {activeView === "reviews" ? (
            <ReviewsView reviews={partnerReviews} updateReview={updateReview} />
          ) : null}

          {activeView === "settings" ? (
            <SettingsView
              workspace={workspace}
              updateProfile={updateProfile}
              updateNotifications={updateNotifications}
              onSave={() => void saveWorkspaceChanges()}
              hasUnsavedChanges={hasUnsavedChanges}
              saveState={profileSaveState}
            />
          ) : null}
        </div>
      </section>
    </PartnerShell>
  );
};

const pipelineStatusLabels: Record<Level4PipelineStatus, string> = {
  booked: "Κρατημένο",
  paid: "Πληρωμένο",
  upcoming: "Επερχόμενο",
  completed: "Ολοκληρωμένο",
  review_pending: "Αναμονή αξιολόγησης",
  refund_risk: "Πιθανή επιστροφή",
  follow_up_needed: "Χρειάζεται συνέχεια",
};

const formatEuroCents = (amountCents: number) => {
  const amount = amountCents / 100;
  return `€${amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

const getPartnerFeeCents = (payment?: StoredPayment) =>
  Math.max(0, Number(payment?.partnerPlatformFeeCents || 0));

const getPartnerNetCents = (payment?: StoredPayment, fallbackBooking?: StoredBooking) => {
  if (payment?.partnerNetAmountCents !== undefined) return Math.max(0, Number(payment.partnerNetAmountCents));
  const grossCents = Math.max(0, Number(payment?.amount ?? fallbackBooking?.price ?? 0) * 100);
  return Math.max(0, grossCents - getPartnerFeeCents(payment));
};

const PipelineView = ({
  items,
  onAddNote,
  onAddFollowup,
  onChangeStatus,
}: {
  items: PartnerPipelineItem[];
  onAddNote: (booking: StoredBooking, note: string) => void;
  onAddFollowup: (booking: StoredBooking, title: string, dueAt: string) => void;
  onChangeStatus: (booking: StoredBooking, status: Level4PipelineStatus) => void;
}) => {
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [followupTitles, setFollowupTitles] = useState<Record<string, string>>({});
  const [followupDates, setFollowupDates] = useState<Record<string, string>>({});
  const counts = level4PipelineStatuses.map((status) => ({
    status,
    count: items.filter((item) => item.status === status).length,
  }));

  return (
    <section className="partner-panel p-7 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="partner-kicker">Ροή υποθέσεων</p>
          <h3 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Πελάτες ανά στάδιο</h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Δείτε ποιες υποθέσεις είναι κρατημένες, πληρωμένες, επερχόμενες, ολοκληρωμένες ή χρειάζονται αξιολόγηση, επιστροφή ή συνέχεια.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:w-[520px]">
          {counts.map((item) => (
            <Metric key={item.status} label={pipelineStatusLabels[item.status]} value={String(item.count)} helper="πελάτες" />
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {items.length > 0 ? items.map((item) => {
          const noteDraft = noteDrafts[item.booking.id] || "";
          const followupTitle = followupTitles[item.booking.id] || "";
          const followupDate = followupDates[item.booking.id] || "";
          return (
            <article key={item.booking.id} className="rounded-[1.2rem] border border-[hsl(var(--partner-line))] bg-white/70 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--partner-muted))]">{pipelineStatusLabels[item.status]}</p>
                  <h4 className="mt-1 text-lg font-semibold text-[hsl(var(--partner-ink))]">{item.booking.clientName}</h4>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {item.booking.consultationType} · {item.booking.dateLabel} {item.booking.time}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.booking.issueSummary || "Δεν έχει καταγραφεί περιγραφή υπόθεσης."}</p>
                </div>
                <select
                  className="h-10 rounded-xl border border-[hsl(var(--partner-line))] bg-white px-3 text-sm font-semibold text-[hsl(var(--partner-ink))]"
                  value={item.status}
                  onChange={(event) => onChangeStatus(item.booking, event.target.value as Level4PipelineStatus)}
                >
                  {level4PipelineStatuses.map((status) => (
                    <option key={status} value={status}>{pipelineStatusLabels[status]}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Metric label="Πληρωμή" value={item.payment ? paymentStateLabels[getCanonicalPaymentState(item.payment)] : "καμία"} helper="κατάσταση" />
                <Metric label="Έγγραφα" value={String(item.documents.length)} helper="ορατά αρχεία" />
                <Metric label="Κριτικές" value={String(item.reviews.length)} helper="μετά την ολοκλήρωση" />
                <Metric label="Συνέχειες" value={String(item.followups.filter((task) => task.status === "open").length)} helper="ανοιχτές υπενθυμίσεις" />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[hsl(var(--partner-line))] bg-white/75 p-4">
                  <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Ιδιωτικές σημειώσεις</p>
                  <div className="mt-3 space-y-2">
                    {item.privateNotes.slice(0, 3).map((note) => (
                      <p key={note.id} className="rounded-lg bg-[hsl(var(--partner-cream))] px-3 py-2 text-xs leading-5 text-muted-foreground">{note.note}</p>
                    ))}
                  </div>
                  <textarea
                    className="mt-3 min-h-20 w-full rounded-xl border border-[hsl(var(--partner-line))] bg-white px-3 py-2 text-sm"
                    value={noteDraft}
                    onChange={(event) => setNoteDrafts((current) => ({ ...current, [item.booking.id]: event.target.value }))}
                    placeholder="Προσθήκη ιδιωτικής σημείωσης"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 rounded-xl"
                    onClick={() => {
                      onAddNote(item.booking, noteDraft);
                      setNoteDrafts((current) => ({ ...current, [item.booking.id]: "" }));
                    }}
                  >
                    Αποθήκευση σημείωσης
                  </Button>
                </div>

                <div className="rounded-xl border border-[hsl(var(--partner-line))] bg-white/75 p-4">
                  <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Υπενθύμιση συνέχειας</p>
                  <div className="mt-3 space-y-2">
                    {item.followups.slice(0, 3).map((task) => (
                      <p key={task.id} className="rounded-lg bg-[hsl(var(--partner-cream))] px-3 py-2 text-xs leading-5 text-muted-foreground">{task.title} · {task.dueAt}</p>
                    ))}
                  </div>
                  <input
                    className="mt-3 h-10 w-full rounded-xl border border-[hsl(var(--partner-line))] bg-white px-3 text-sm"
                    value={followupTitle}
                    onChange={(event) => setFollowupTitles((current) => ({ ...current, [item.booking.id]: event.target.value }))}
                    placeholder="Τίτλος υπενθύμισης"
                  />
                  <input
                    className="mt-2 h-10 w-full rounded-xl border border-[hsl(var(--partner-line))] bg-white px-3 text-sm"
                    type="datetime-local"
                    value={followupDate}
                    onChange={(event) => setFollowupDates((current) => ({ ...current, [item.booking.id]: event.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 rounded-xl"
                    onClick={() => {
                      onAddFollowup(item.booking, followupTitle, followupDate);
                      setFollowupTitles((current) => ({ ...current, [item.booking.id]: "" }));
                      setFollowupDates((current) => ({ ...current, [item.booking.id]: "" }));
                    }}
                  >
                    Προσθήκη υπενθύμισης
                  </Button>
                </div>
              </div>
            </article>
          );
        }) : (
          <EmptyPartnerState
            icon={Workflow}
            title="Δεν υπάρχουν ακόμη πελάτες στη ροή"
            description="Οι κρατημένες και πληρωμένες συμβουλευτικές θα εμφανιστούν εδώ μόλις υπάρχουν διαθέσιμες κρατήσεις συνεργάτη."
          />
        )}
      </div>
    </section>
  );
};

const AppointmentsView = ({
  bookings,
  documents,
  actionState,
  onComplete,
  onCancel,
}: {
  bookings: StoredBooking[];
  documents: StoredBookingDocument[];
  actionState: Record<string, BookingActionState>;
  onComplete: (booking?: StoredBooking) => void;
  onCancel: (booking?: StoredBooking) => void;
}) => (
  <section className="partner-panel p-7 sm:p-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="partner-kicker">Ραντεβού</p>
        <h3 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Σήμερα και μετά</h3>
      </div>
      <Button variant="outline" className="rounded-xl border-[hsl(var(--partner-line))] bg-white/70 text-[hsl(var(--partner-ink))] hover:bg-white">
        Προβολή ημερολογίου
      </Button>
    </div>

    <div className="mt-6 space-y-4">
      {bookings.length > 0 ? bookings.map((booking) => {
        const bookingDocuments = documents.filter((document) => document.bookingId === booking.id);
        const currentAction = actionState[booking.id];
        const verified = isVerifiedBooking(booking);
        const bookingState = getCanonicalBookingState(booking);
        const canMarkComplete = bookingState === "confirmed_paid";

        return (
        <div key={booking.referenceId} className="rounded-[1.4rem] border border-[hsl(var(--partner-line))] bg-white/65 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-[hsl(var(--partner-ink))]">{booking.clientName}</p>
                <span className="rounded-full bg-[hsl(var(--partner-navy-soft))]/10 px-2.5 py-1 text-[11px] font-bold text-[hsl(var(--partner-navy-soft))]">
                  {bookingStateLabels[bookingState]}
                </span>
                {!verified ? (
                  <span className="rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-[11px] font-bold text-destructive">
                    Σε έλεγχο
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{booking.issueSummary || booking.consultationType}</p>
              {!verified ? (
                <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-semibold leading-5 text-destructive">
                  Το ραντεβού δεν έχει ολοκληρώσει τον έλεγχο συστήματος. Μην το σημάνετε ως ολοκληρωμένο και μην προχωρήσετε σε χρέωση πριν επιβεβαιωθεί.
                </p>
              ) : null}
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{booking.referenceId}</p>
            </div>
            <div className="flex flex-col gap-3 text-left lg:items-end lg:text-right">
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--partner-navy-soft))]">{booking.dateLabel} | {booking.time}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{booking.consultationType} · €{booking.price}</p>
              </div>
              {isBookingScheduled(booking) && verified ? (
                <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                  <Button type="button" onClick={() => onComplete(booking)} disabled={currentAction?.loading || !canMarkComplete} className="rounded-xl font-semibold">
                    {canMarkComplete ? "Σήμανση ολοκληρωμένου" : "Αναμονή πληρωμής"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onCancel(booking)}
                    disabled={currentAction?.loading}
                    className="rounded-xl border-destructive/25 font-semibold text-destructive hover:text-destructive"
                  >
                    Ακύρωση 
                  </Button>
                </div>
              ) : isBookingScheduled(booking) && !verified ? (
                <Button type="button" disabled className="rounded-xl font-semibold">
                  Χρειάζεται επιβεβαίωση κράτησης
                  <span className="hidden">
                  Επιβεβαίωση ολοκλήρωσης κράτησης
                  </span>
                </Button>
              ) : null}
            </div>
          </div>
          {currentAction?.message ? (
            <p
              className={`mt-4 rounded-xl border px-3 py-2 text-sm font-semibold ${
                currentAction.tone === "success"
                  ? "border-[hsl(var(--sage))]/25 bg-[hsl(var(--sage))]/10 text-[hsl(var(--sage-foreground))]"
                  : currentAction.tone === "error"
                    ? "border-destructive/20 bg-destructive/10 text-destructive"
                    : "border-[hsl(var(--partner-navy-soft))]/20 bg-[hsl(var(--partner-navy-soft))]/10 text-[hsl(var(--partner-navy-soft))]"
              }`}
            >
              {currentAction.message}
            </p>
          ) : null}
          {bookingDocuments.length > 0 ? (
            <div className="mt-4 rounded-[1rem] border border-[hsl(var(--partner-line))] bg-white/55 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--partner-ink))]">
                <FileText className="h-4 w-4" />
                Έγγραφα πελάτη
              </p>
              <div className="mt-3 grid gap-2">
                {bookingDocuments.map((document) => (
                  <a
                    key={document.id}
                    href={document.downloadUrl || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-xl border border-[hsl(var(--partner-line))] bg-white/70 px-3 py-2 text-sm font-semibold ${
                      document.downloadUrl ? "text-[hsl(var(--partner-ink))]" : "pointer-events-none text-muted-foreground"
                    }`}
                  >
                    {document.name}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        );
      }) : (
        <EmptyPartnerState
          icon={CalendarDays}
          title="Δεν υπάρχουν πραγματικές κρατήσεις"
          description="Οι νέες κρατήσεις θα εμφανίζονται εδώ μόλις περάσουν τον έλεγχο κράτησης."
        />
      )}
    </div>
  </section>
);

const AvailabilityView = ({
  workspace,
  updateAvailability,
  updateProfile,
  onSave,
  hasUnsavedChanges,
  saveState,
}: {
  workspace: PartnerWorkspace;
  updateAvailability: (day: string, updates: Partial<PartnerAvailabilitySlot>) => void;
  updateProfile: (updates: Partial<PartnerWorkspace["profile"]>) => void;
  onSave: () => void;
  hasUnsavedChanges: boolean;
  saveState: SaveState;
}) => (
  <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
    <div className="partner-panel p-7 sm:p-8">
      <div>
        <p className="partner-kicker">Εβδομαδιαίο πρόγραμμα</p>
        <h3 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Διαθέσιμες ώρες</h3>
      </div>
      <div className="mt-6 space-y-3">
        {workspace.availability.map((slot) => (
          <div key={slot.day} className="rounded-[1.2rem] border border-[hsl(var(--partner-line))] bg-white/65 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_0.75fr_0.75fr_1.2fr_auto] md:items-end">
              <Field label={slot.day}>
                <button
                  type="button"
                  onClick={() => updateAvailability(slot.day, { enabled: !slot.enabled })}
                  className={`partner-chip ${slot.enabled ? "partner-chip-active" : ""}`}
                >
                  {slot.enabled ? "Ανοιχτό" : "Κλειστό"}
                </button>
              </Field>
              <Field label="Από">
                <input className="partner-input" value={slot.start} onChange={(event) => updateAvailability(slot.day, { start: event.target.value })} />
              </Field>
              <Field label="Έως">
                <input className="partner-input" value={slot.end} onChange={(event) => updateAvailability(slot.day, { end: event.target.value })} />
              </Field>
              <Field label="Σημείωση">
                <input className="partner-input" value={slot.note} onChange={(event) => updateAvailability(slot.day, { note: event.target.value })} />
              </Field>
              <CheckCircle2 className={`mb-3 h-5 w-5 ${slot.enabled ? "text-[hsl(var(--sage))]" : "text-muted-foreground/40"}`} />
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="partner-panel p-7">
      <p className="partner-kicker">Κανόνες κράτησης</p>
      <div className="mt-5 grid gap-4">
        <NumberField label="Χρόνος κενού ανά ραντεβού" value={workspace.profile.bufferMinutes} suffix="λεπτά" onChange={(bufferMinutes) => updateProfile({ bufferMinutes })} />
        <NumberField label="Παράθυρο κράτησης" value={workspace.profile.bookingWindowDays} suffix="ημέρες" onChange={(bookingWindowDays) => updateProfile({ bookingWindowDays })} />
        <ToggleRow
          title="Αυτόματη επιβεβαίωση"
          description="Οι νέες κρατήσεις επιβεβαιώνονται χωρίς χειροκίνητο έλεγχο."
          enabled={workspace.profile.autoConfirm}
          onToggle={() => updateProfile({ autoConfirm: !workspace.profile.autoConfirm })}
        />
      </div>
    </div>

    <div className="lg:col-span-2">
      <SectionSaveFooter onSave={onSave} saveState={saveState} hasUnsavedChanges={hasUnsavedChanges} />
    </div>
  </section>
);

const ProfileView = ({
  workspace,
  updateProfile,
  onSave,
  searchVisibility,
  profilePhotoState,
  profilePhotoUploadState,
  onProfilePhotoSubmit,
  hasUnsavedChanges,
  saveState,
}: {
  workspace: PartnerWorkspace;
  updateProfile: (updates: Partial<PartnerWorkspace["profile"]>) => void;
  onSave: () => void;
  searchVisibility: {
    loading: boolean;
    ready: boolean;
    issues: string[];
  };
  profilePhotoState: PartnerProfilePhotoState | null;
  profilePhotoUploadState: SaveState;
  onProfilePhotoSubmit: (file: File) => Promise<void>;
  hasUnsavedChanges: boolean;
  saveState: SaveState;
}) => (
  <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
    <div className="partner-panel p-7 sm:p-8">
      <div>
        <p className="partner-kicker">Δημόσια παρουσία</p>
        <h3 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Στοιχεία προφίλ</h3>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Αναγνωριστικό επαληθευμένου προφίλ δικηγόρου">
          <div className="rounded-xl border border-[hsl(var(--partner-line))] bg-white/55 px-3 py-3 text-sm font-semibold text-muted-foreground">
            {workspace.profile.lawyerId}
          </div>
        </Field>
        <Field label="Εμφανιζόμενο όνομα">
          <input className="partner-input" value={workspace.profile.displayName} onChange={(event) => updateProfile({ displayName: event.target.value })} />
        </Field>
        <Field label="Κύρια ειδικότητα">
          <select className="partner-input" value={workspace.profile.primarySpecialty} onChange={(event) => updateProfile({ primarySpecialty: event.target.value, specialties: Array.from(new Set([event.target.value, ...workspace.profile.specialties])).filter(Boolean) })}>
            {legalPracticeAreaLabels.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </Field>
        <Field label="Γραφείο">
          <input className="partner-input" value={workspace.profile.officeName} onChange={(event) => updateProfile({ officeName: event.target.value })} />
        </Field>
        <Field label="Πόλη">
          <select className="partner-input" value={workspace.profile.city} onChange={(event) => updateProfile({ city: event.target.value })}>
            {allowedMarketplaceCityNames.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </Field>
        <NumberField
          label="Έτη εμπειρίας"
          value={workspace.profile.experienceYears}
          suffix="έτη"
          onChange={(experienceYears) => updateProfile({ experienceYears })}
        />
        <Field label="Περιοχή εξυπηρέτησης">
          <input className="partner-input" value={workspace.profile.serviceArea} onChange={(event) => updateProfile({ serviceArea: event.target.value })} />
        </Field>
        <Field label="Ειδικότητες">
          <div className="flex flex-wrap gap-2 rounded-xl border border-[hsl(var(--partner-line))] bg-white/70 p-3">
            {legalPracticeAreaLabels.map((area) => {
              const active = workspace.profile.specialties.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => {
                    const specialties = active
                      ? workspace.profile.specialties.filter((item) => item !== area)
                      : [...workspace.profile.specialties, area];
                    updateProfile({
                      specialties,
                      primarySpecialty: specialties.includes(workspace.profile.primarySpecialty)
                        ? workspace.profile.primarySpecialty
                        : specialties[0] || workspace.profile.primarySpecialty,
                    });
                  }}
                  className={`partner-chip ${active ? "partner-chip-active" : ""}`}
                >
                  {area}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Γλώσσες">
          <input className="partner-input" value={formatListInput(workspace.profile.languages)} onChange={(event) => updateProfile({ languages: parseListInput(event.target.value) })} />
        </Field>
      </div>
      <Field label="Ιδανικός/ή για">
        <textarea
          value={workspace.profile.bestFor}
          onChange={(event) => updateProfile({ bestFor: event.target.value })}
          className="partner-input min-h-24 py-3"
        />
      </Field>
      <Field label="Σύντομη περιγραφή">
        <textarea
          value={workspace.profile.bio}
          onChange={(event) => updateProfile({ bio: event.target.value })}
          className="partner-input min-h-28 py-3"
        />
      </Field>
    </div>

    <div className="space-y-6">
      <ProfilePhotoModerationCard
        photoState={profilePhotoState}
        uploadState={profilePhotoUploadState}
        onSubmit={onProfilePhotoSubmit}
      />

      <SearchVisibilityCard searchVisibility={searchVisibility} hasUnsavedChanges={hasUnsavedChanges} />

      <div className="partner-panel p-7">
        <p className="partner-kicker">Τιμές</p>
        <div className="mt-5 grid gap-4">
          <NumberField label={consultationModeLabels.video} value={workspace.profile.videoPrice} suffix="€" onChange={(videoPrice) => updateProfile({ videoPrice })} />
          <NumberField label={consultationModeLabels.phone} value={workspace.profile.phonePrice} suffix="€" onChange={(phonePrice) => updateProfile({ phonePrice })} />
          <NumberField label={consultationModeLabels.inPerson} value={workspace.profile.inPersonPrice} suffix="€" onChange={(inPersonPrice) => updateProfile({ inPersonPrice })} />
        </div>
      </div>

      <div className="partner-panel p-7">
        <p className="partner-kicker">Τρόποι συνεδρίας</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {consultationModeOptions.map((mode) => {
            const active = workspace.profile.consultationModes.includes(mode);
            return (
              <button
                key={mode}
                type="button"
                onClick={() =>
                  updateProfile({
                    consultationModes: active
                      ? workspace.profile.consultationModes.filter((item) => item !== mode)
                      : [...workspace.profile.consultationModes, mode],
                  })
                }
                className={`partner-chip ${active ? "partner-chip-active" : ""}`}
              >
                {consultationModeLabels[mode]}
              </button>
            );
          })}
        </div>
        <div className="mt-5 grid gap-4">
          {consultationModeOptions.map((mode) => (
            <Field key={mode} label={`Περιγραφή ${consultationModeLabels[mode]}`}>
              <textarea
                value={getConsultationDescription(workspace.profile, mode)}
                onChange={(event) => updateProfile(buildConsultationDescriptionUpdate(mode, event.target.value))}
                className="partner-input min-h-24 py-3"
              />
            </Field>
          ))}
        </div>
        <Field label="Πολιτική ακύρωσης">
          <textarea
            value={workspace.profile.cancellationPolicy}
            onChange={(event) => updateProfile({ cancellationPolicy: event.target.value })}
            className="partner-input min-h-24 py-3"
          />
        </Field>
      </div>
    </div>

    <div className="lg:col-span-2">
      <SectionSaveFooter onSave={onSave} saveState={saveState} hasUnsavedChanges={hasUnsavedChanges} />
    </div>
  </section>
);

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const ProfilePhotoModerationCard = ({
  photoState,
  uploadState,
  onSubmit,
}: {
  photoState: PartnerProfilePhotoState | null;
  uploadState: SaveState;
  onSubmit: (file: File) => Promise<void>;
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [localError, setLocalError] = useState("");
  const pendingSubmission = photoState?.pendingSubmission;
  const latestRejectedSubmission = photoState?.latestRejectedSubmission;

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedFile]);

  const handleFileChange = (file?: File) => {
    setLocalError("");
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isSupportedProfilePhotoFile(file)) {
      setSelectedFile(null);
      setLocalError("Επιλέξτε φωτογραφία JPG, PNG ή WebP.");
      return;
    }

    if (file.size > partnerProfilePhotoPolicy.maxSizeBytes) {
      setSelectedFile(null);
      setLocalError("Η φωτογραφία πρέπει να είναι έως 5 MB.");
      return;
    }

    setSelectedFile(file);
  };

  const submitSelectedFile = async () => {
    if (!selectedFile) return;
    await onSubmit(selectedFile);
    setSelectedFile(null);
  };

  return (
    <div className="partner-panel p-7">
      <p className="partner-kicker">Φωτογραφία προφίλ</p>
      <div className="mt-5 grid gap-4">
        <div className="flex items-start gap-4">
          {photoState?.approvedImageUrl ? (
            <img
              src={photoState.approvedImageUrl}
              alt="Εγκεκριμένη φωτογραφία προφίλ"
              className="h-24 w-24 shrink-0 rounded-lg object-cover ring-1 ring-[hsl(var(--partner-line))]"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-[hsl(var(--partner-line))] bg-white/60 text-xs font-bold text-muted-foreground">
              Χωρίς φωτογραφία
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Δημόσια εγκεκριμένη φωτογραφία</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Η νέα φωτογραφία εμφανίζεται στην πλατφόρμα μόνο μετά από έλεγχο της ομάδας λειτουργίας.
            </p>
          </div>
        </div>

        {pendingSubmission ? (
          <div className="rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            <p className="font-bold">Υπάρχει φωτογραφία σε αναμονή έγκρισης.</p>
            <p className="mt-1 leading-6">
              {pendingSubmission.fileName} · {formatFileSize(pendingSubmission.size)} · υποβλήθηκε{" "}
              {new Date(pendingSubmission.submittedAt).toLocaleDateString("el-GR")}
            </p>
          </div>
        ) : null}

        {!pendingSubmission && latestRejectedSubmission ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            <p className="font-bold">Η προηγούμενη φωτογραφία απορρίφθηκε.</p>
            <p className="mt-1 leading-6">{latestRejectedSubmission.reviewReason || "Υποβάλετε νέα φωτογραφία με καθαρό πρόσωπο και επαγγελματικό πλαίσιο."}</p>
          </div>
        ) : null}

        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Νέα φωτογραφία προς έγκριση
          </span>
          <input
            type="file"
            accept={partnerProfilePhotoPolicy.accept}
            onChange={(event) => handleFileChange(event.target.files?.[0])}
            className="mt-2 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-[hsl(var(--partner-navy))] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
          />
        </label>

        {previewUrl && selectedFile ? (
          <div className="flex items-center gap-4 rounded-xl border border-[hsl(var(--partner-line))] bg-white/65 p-3">
            <img src={previewUrl} alt="Προεπισκόπηση νέας φωτογραφίας" className="h-20 w-20 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[hsl(var(--partner-ink))]">{selectedFile.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
        ) : null}

        {localError ? <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{localError}</p> : null}
        {uploadState.message ? <SaveMessage saveState={uploadState} /> : null}

        <Button
          type="button"
          onClick={() => void submitSelectedFile()}
          disabled={!selectedFile || uploadState.loading}
          className="h-11 rounded-xl px-5 font-bold"
        >
          {uploadState.loading ? "Υποβολή..." : "Υποβολή για έγκριση"}
        </Button>
      </div>
    </div>
  );
};

const SearchVisibilityCard = ({
  searchVisibility,
  hasUnsavedChanges,
}: {
  searchVisibility: {
    loading: boolean;
    ready: boolean;
    issues: string[];
  };
  hasUnsavedChanges: boolean;
}) => {
  const statusTone = searchVisibility.ready
    ? "border-[hsl(var(--sage))]/25 bg-[hsl(var(--sage))]/10 text-[hsl(var(--sage-foreground))]"
    : "border-amber-300/40 bg-amber-50 text-amber-900";

  const statusLabel = searchVisibility.loading
    ? "Έλεγχος ορατότητας..."
    : searchVisibility.ready
      ? hasUnsavedChanges
        ? "Με τις τωρινές αλλαγές θα εμφανίζεστε στην αναζήτηση μετά την αποθήκευση."
        : "Εμφανίζεστε στην αναζήτηση δικηγόρων."
      : hasUnsavedChanges
        ? "Με τις τωρινές αλλαγές δεν θα εμφανίζεστε ακόμη στην αναζήτηση."
        : "Δεν εμφανίζεστε ακόμη στην αναζήτηση δικηγόρων.";

  const helperText = searchVisibility.loading
    ? "Ελέγχουμε τη δημόσια προεπισκόπηση του προφίλ σας."
    : searchVisibility.ready
      ? "Το δημόσιο προφίλ σας έχει τα στοιχεία που χρειάζονται για την καταχώριση στην πλατφόρμα."
      : "Για να εμφανίζεστε στην αναζήτηση, συμπληρώστε τα παρακάτω και αποθηκεύστε τις αλλαγές.";

  return (
    <div className="partner-panel p-7">
      <p className="partner-kicker">Ορατότητα στην αναζήτηση</p>
      <div className={`mt-4 rounded-2xl border px-4 py-4 ${statusTone}`}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${searchVisibility.ready ? "text-[hsl(var(--sage-foreground))]" : "text-amber-700"}`} />
          <div>
            <p className="text-sm font-bold">{statusLabel}</p>
            <p className="mt-1 text-sm leading-6 opacity-80">{helperText}</p>
          </div>
        </div>
      </div>

      {!searchVisibility.loading && searchVisibility.issues.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-[hsl(var(--partner-line))] bg-white/65 p-4">
          <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Τι χρειάζεται να διορθώσετε</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            {searchVisibility.issues.map((issue) => (
              <li key={issue} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--partner-navy-soft))]" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

const EarningsView = ({
  completedRevenueCents,
  pendingRevenueCents,
  completedPlatformFeeCents,
  completedBookings,
  confirmedBookings,
  payments,
}: {
  completedRevenueCents: number;
  pendingRevenueCents: number;
  completedPlatformFeeCents: number;
  completedBookings: StoredBooking[];
  confirmedBookings: StoredBooking[];
  payments: StoredPayment[];
}) => {
  const visibleBookings = [...completedBookings, ...confirmedBookings];

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Καθαρό ποσό" value={formatEuroCents(completedRevenueCents)} helper={`${completedBookings.length} συνεδρίες`} />
        <Metric label="Σε αναμονή" value={formatEuroCents(pendingRevenueCents)} helper={`${confirmedBookings.length} κρατήσεις`} />
        <Metric label="Χρεώσεις πλάνου" value={formatEuroCents(completedPlatformFeeCents)} helper="€7 μόνο στο Βασικό" />
      </div>

      <div className="partner-panel p-7 sm:p-8">
        <p className="partner-kicker">Τιμολόγια και εκταμιεύσεις</p>
        <h3 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Οικονομικές κινήσεις</h3>
        <div className="mt-6 space-y-3">
          {visibleBookings.length > 0 ? (
            visibleBookings.map((booking) => {
              const payment = payments.find((item) => item.bookingId === booking.id);
              const feeCents = getPartnerFeeCents(payment);
              const netCents = getPartnerNetCents(payment, booking);
              return (
            <div key={booking.id} className="rounded-[1.2rem] border border-[hsl(var(--partner-line))] bg-white/65 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-[hsl(var(--partner-ink))]">{booking.referenceId}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{booking.clientName} · {booking.consultationType}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {feeCents > 0
                      ? `Χρέωση Βασικού: -${formatEuroCents(feeCents)}`
                      : payment?.partnerFeeStatus === "waived_by_subscription"
                        ? "Χρέωση πρώτης συμβουλευτικής: καλύπτεται από το πλάνο"
                        : "Χρέωση πρώτης συμβουλευτικής: θα υπολογιστεί στην ολοκλήρωση"}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-lg font-semibold text-[hsl(var(--partner-ink))]">{formatEuroCents(netCents)}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {canSubmitReview(booking) ? "έτοιμο για εκταμίευση" : "σε αναμονή ολοκλήρωσης"}
                  </p>
                </div>
              </div>
            </div>
              );
            })
          ) : (
            <EmptyPartnerState icon={CreditCard} title="Δεν υπάρχουν οικονομικές κινήσεις" description="Οι πληρωμές θα εμφανίζονται όταν υπάρξουν κρατήσεις." />
          )}
        </div>
      </div>
    </section>
  );
};

const ReviewsView = ({
  reviews,
  updateReview,
}: {
  reviews: StoredLawyerReview[];
  updateReview: (reviewId: string, updates: Partial<StoredLawyerReview>) => void;
}) => (
  <section className="partner-panel p-7 sm:p-8">
    <p className="partner-kicker">Κριτικές</p>
    <h3 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Απαντήσεις και διαχείριση</h3>
    <div className="mt-6 space-y-4">
      {reviews.length > 0 ? reviews.map((review) => (
        <article key={review.id} className="rounded-[1.2rem] border border-[hsl(var(--partner-line))] bg-white/65 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[hsl(var(--partner-ink))]">{review.clientName}</p>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${review.status === "under_moderation" || review.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-[hsl(var(--sage))]/15 text-[hsl(var(--sage-foreground))]"}`}>
                  {reviewPublicationStateLabels[review.status]}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1">
                {Array.from({ length: review.rating }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-[hsl(var(--gold))] text-[hsl(var(--gold))]" />
                ))}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{review.text}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {review.consultationType} · {new Date(review.date).toLocaleDateString("el-GR")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => updateReview(review.id, { status: review.status === "under_moderation" ? "published" : "under_moderation" })}
              className="rounded-xl border-[hsl(var(--partner-line))] bg-white/70 text-[hsl(var(--partner-ink))] hover:bg-white"
            >
              {review.status === "under_moderation" ? "Δημοσίευση" : "Κράτηση για έλεγχο"}
            </Button>
          </div>
          <Field label="Δημόσια απάντηση">
            <textarea
              value={review.reply}
              onChange={(event) => updateReview(review.id, { reply: event.target.value })}
              placeholder="Γράψτε σύντομη επαγγελματική απάντηση."
              className="partner-input min-h-24 py-3"
            />
          </Field>
        </article>
      )) : (
        <EmptyPartnerState
          icon={MessageSquareQuote}
          title="Δεν υπάρχουν ακόμη επαληθευμένες κριτικές"
          description="Οι κριτικές θα εμφανίζονται μόνο μετά από ολοκληρωμένα ραντεβού πελατών."
        />
      )}
    </div>
  </section>
);

const SettingsView = ({
  workspace,
  updateProfile,
  updateNotifications,
  onSave,
  hasUnsavedChanges,
  saveState,
}: {
  workspace: PartnerWorkspace;
  updateProfile: (updates: Partial<PartnerWorkspace["profile"]>) => void;
  updateNotifications: (updates: Partial<PartnerWorkspace["notifications"]>) => void;
  onSave: () => void;
  hasUnsavedChanges: boolean;
  saveState: SaveState;
}) => (
  <section className="grid gap-6 lg:grid-cols-2">
    <div className="partner-panel p-7 sm:p-8">
      <p className="partner-kicker">Λειτουργία κράτησης</p>
      <div className="mt-5 grid gap-4">
        <ToggleRow
          title="Αυτόματη επιβεβαίωση"
          description="Οι νέες κρατήσεις μπαίνουν απευθείας στο ημερολόγιο."
          enabled={workspace.profile.autoConfirm}
          onToggle={() => updateProfile({ autoConfirm: !workspace.profile.autoConfirm })}
        />
        <NumberField label="Χρόνος κενού" value={workspace.profile.bufferMinutes} suffix="λεπτά" onChange={(bufferMinutes) => updateProfile({ bufferMinutes })} />
        <NumberField label="Παράθυρο κράτησης" value={workspace.profile.bookingWindowDays} suffix="ημέρες" onChange={(bookingWindowDays) => updateProfile({ bookingWindowDays })} />
      </div>
    </div>

    <div className="partner-panel p-7 sm:p-8">
      <p className="partner-kicker">Ειδοποιήσεις</p>
      <div className="mt-5 grid gap-4">
        <ToggleRow
          title="Ηλεκτρονικό ταχυδρομείο νέων κρατήσεων"
          description="Στείλτε μήνυμα ηλεκτρονικού ταχυδρομείου για κάθε επιβεβαιωμένη κράτηση."
          enabled={workspace.notifications.bookingEmail}
          onToggle={() => updateNotifications({ bookingEmail: !workspace.notifications.bookingEmail })}
        />
        <ToggleRow
          title="SMS νέων κρατήσεων"
          description="Στείλτε σύντομη ειδοποίηση για ραντεβού ίδιας ημέρας."
          enabled={workspace.notifications.bookingSms}
          onToggle={() => updateNotifications({ bookingSms: !workspace.notifications.bookingSms })}
        />
        <ToggleRow
          title="Εβδομαδιαία σύνοψη"
          description="Λάβετε συγκεντρωτικό μήνυμα ηλεκτρονικού ταχυδρομείου με προβολές, κρατήσεις και κριτικές."
          enabled={workspace.notifications.weeklyDigest}
          onToggle={() => updateNotifications({ weeklyDigest: !workspace.notifications.weeklyDigest })}
        />
      </div>
    </div>

    <div className="lg:col-span-2">
      <SectionSaveFooter onSave={onSave} saveState={saveState} hasUnsavedChanges={hasUnsavedChanges} />
    </div>
  </section>
);

const SectionSaveFooter = ({
  onSave,
  saveState,
  hasUnsavedChanges,
}: {
  onSave: () => void;
  saveState: SaveState;
  hasUnsavedChanges: boolean;
}) => (
  <div className="flex flex-col gap-3">
    {saveState.message ? <SaveMessage saveState={saveState} /> : null}
    <div className="flex justify-end">
      <SaveButton onSave={onSave} saveState={saveState} disabled={!hasUnsavedChanges} />
    </div>
  </div>
);

const SaveButton = ({
  onSave,
  saveState,
  disabled = false,
}: {
  onSave: () => void;
  saveState: SaveState;
  disabled?: boolean;
}) => (
  <Button
    type="button"
    onClick={onSave}
    disabled={saveState.loading || disabled}
    className="h-11 rounded-xl px-5 font-bold"
  >
    {saveState.loading ? "Αποθήκευση..." : "Αποθήκευση αλλαγών"}
  </Button>
);

const SaveMessage = ({ saveState }: { saveState: SaveState }) => {
  if (!saveState.message) return null;

  const toneClass =
    saveState.tone === "success"
      ? "border-[hsl(var(--sage))]/25 bg-[hsl(var(--sage))]/10 text-[hsl(var(--sage-foreground))]"
      : saveState.tone === "error"
        ? "border-destructive/20 bg-destructive/10 text-destructive"
        : "border-primary/20 bg-primary/10 text-primary";

  return (
    <p className={`rounded-xl border px-3 py-2 text-sm font-semibold ${toneClass}`}>
      {saveState.message}
    </p>
  );
};

const Metric = ({ label, value, helper }: { label: string; value: string; helper: string }) => (
  <div className="partner-soft-card p-4">
    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
    <p className="mt-3 text-lg font-semibold text-[hsl(var(--partner-ink))]">{value}</p>
    <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
  </div>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="mt-4 block">
    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
    <span className="mt-2 block">{children}</span>
  </label>
);

const NumberField = ({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
}) => (
  <Field label={label}>
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="partner-input"
      />
      <span className="text-sm font-semibold text-muted-foreground">{suffix}</span>
    </div>
  </Field>
);

const ToggleRow = ({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="flex w-full items-start justify-between gap-4 rounded-[1.2rem] border border-[hsl(var(--partner-line))] bg-white/65 p-4 text-left"
  >
    <span>
      <span className="block text-sm font-semibold text-[hsl(var(--partner-ink))]">{title}</span>
      <span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span>
    </span>
    <span className={`mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition ${enabled ? "bg-[hsl(var(--sage))]" : "bg-muted"}`}>
      <span className={`h-4 w-4 rounded-full bg-white transition ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </span>
  </button>
);

const EmptyPartnerState = ({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) => (
  <div className="rounded-[1.2rem] border border-dashed border-[hsl(var(--partner-line))] bg-white/45 p-8 text-center">
    <Icon className="mx-auto h-8 w-8 text-muted-foreground/60" />
    <p className="mt-3 font-semibold text-[hsl(var(--partner-ink))]">{title}</p>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
);

export default PartnerPortal;

const PartnerPerformanceDashboard = ({
  profileViews,
  searchAppearances,
  profileBookingStarts,
  bookingStarts,
  paidBookings,
  completedFirstConsultations,
  responseSpeed,
  categoryPerformance,
  reviewRate,
  averageRating,
  availabilityHealth,
  missingProfileProof,
  pendingModerationItems,
  pendingPaymentIssues,
}: {
  profileViews: number | null;
  searchAppearances: number | null;
  profileBookingStarts: number | null;
  bookingStarts: number;
  paidBookings: number;
  completedFirstConsultations: number;
  responseSpeed: string;
  categoryPerformance: string[];
  reviewRate: number;
  averageRating: string;
  availabilityHealth: number;
  missingProfileProof: string[];
  pendingModerationItems: number;
  pendingPaymentIssues: number;
}) => (
  <section className="partner-panel p-7 sm:p-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="partner-kicker">Απόδοση συνεργασίας</p>
        <h3 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Αν η αγορά δουλεύει για εσάς</h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          Μετρήσεις ζήτησης, πληρωμένων κρατήσεων, ολοκληρωμένων πρώτων συμβουλευτικών, κριτικών και λειτουργικών εκκρεμοτήτων.
        </p>
      </div>
      <div className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/65 px-4 py-3 text-sm font-semibold text-[hsl(var(--partner-ink))]">
        Μέσος όρος: {averageRating}/5 · Ποσοστό κριτικής {reviewRate}%
      </div>
    </div>

    <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Metric label="Προβολές προφίλ" value={profileViews === null ? "—" : String(profileViews)} helper="μόνο από αναλυτικά στοιχεία συστήματος" />
      <Metric label="Εμφανίσεις" value={searchAppearances === null ? "—" : String(searchAppearances)} helper="μόνο από αναλυτικά στοιχεία συστήματος" />
      <Metric label="Προς κράτηση" value={profileBookingStarts === null ? "—" : String(profileBookingStarts)} helper="μόνο από αναλυτικά στοιχεία συστήματος" />
      <Metric label="Κρατήσεις" value={String(bookingStarts)} helper={`${paidBookings} πληρωμένες`} />
      <Metric label="Πρώτες συνεδρίες" value={String(completedFirstConsultations)} helper="ολοκληρωμένες" />
    </div>

    <div className="mt-5 grid gap-4 lg:grid-cols-3">
      <div className="rounded-[1.2rem] border border-[hsl(var(--partner-line))] bg-white/65 p-4">
        <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Υγεία διαθεσιμότητας</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {availabilityHealth >= 3
            ? `${availabilityHealth} ενεργές ημέρες. Η προσφορά φαίνεται κρατήσιμη.`
            : "Προσθέστε περισσότερες ενεργές ημέρες για να μειωθεί η απώλεια ζήτησης."}
        </p>
      </div>
      <div className="rounded-[1.2rem] border border-[hsl(var(--partner-line))] bg-white/65 p-4">
        <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Ποιότητα εισερχόμενων</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Κατηγορίες: {categoryPerformance.length ? categoryPerformance.join(", ") : "συμπληρώστε ειδικότητες"}. Απόκριση: {responseSpeed}.
        </p>
      </div>
      <div className="rounded-[1.2rem] border border-[hsl(var(--partner-line))] bg-white/65 p-4">
        <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Εκκρεμότητες</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {pendingModerationItems} κριτικές σε έλεγχο · {pendingPaymentIssues} πληρωμές/επιστροφές χρειάζονται προσοχή.
        </p>
        {missingProfileProof.length > 0 ? (
          <ul className="mt-3 space-y-1.5 text-xs font-semibold leading-5 text-muted-foreground">
            {missingProfileProof.slice(0, 3).map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  </section>
);
