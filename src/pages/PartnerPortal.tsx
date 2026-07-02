import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  BellRing,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CircleAlert,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  Landmark,
  MailCheck,
  MapPin,
  MessageSquareText,
  PhoneCall,
  SearchCheck,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TimerReset,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";
import { consultationModeLabels, type ConsultationMode, type Lawyer } from "@/data/lawyers";
import { getLawyerBaseProfileById, getPublicLawyerProfileReadiness } from "@/lib/lawyerRepository";
import {
  clearPartnerSession,
  acceptPartnerBooking,
  cancelPartnerBooking,
  completePartnerBooking,
  fetchBookingsForLawyer,
  fetchDocumentsForLawyer,
  fetchPaymentsForLawyer,
  fetchReviewsForLawyer,
  getPartnerSession,
  isPartnerSessionInvalidError,
  isVerifiedBooking,
  markPartnerBookingNoShow,
  updateLawyerReview,
  type StoredBooking,
  type StoredBookingDocument,
  type StoredLawyerReview,
  type StoredPayment,
} from "@/lib/platformRepository";
import {
  canSubmitReview,
  getCanonicalBookingState,
  getCanonicalPaymentState,
  isBookingScheduled,
  reviewPublicationStateLabels,
  type BookingState,
  type PaymentState,
} from "@/lib/bookingState";
import {
  applyPartnerWorkspaceToLawyer,
  fetchPartnerWorkspace,
  getPartnerWorkspace,
  minimumPartnerConsultationPrices as minimumConsultationPrices,
  syncPartnerWorkspace,
  type PartnerAvailabilitySlot,
  type PartnerWorkspace,
} from "@/lib/partnerWorkspace";
import {
  availabilityBusinessHours,
  getAvailabilityValidationMessage,
  normalizeSessionDurationMinutes,
  validateAvailabilitySchedule,
  validateAvailabilitySlot,
} from "@/lib/availabilityRules";
import { trackFunnelEvent } from "@/lib/funnelAnalytics";
import { cn } from "@/lib/utils";
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
import { type Level4PipelineStatus } from "@/lib/level4Marketplace";
import { allowedMarketplaceCityNames, legalPracticeAreaLabels } from "@/lib/marketplaceTaxonomy";
import {
  createPartnerCaseFromBooking,
  fetchPartnerCasesState,
  savePartnerCasePrivateNote,
  updatePartnerCase,
  type PartnerCase,
  type PartnerCaseHistoryEvent,
  type PartnerCasePrivateNote,
  type PartnerCaseStatus,
} from "@/lib/partnerCasesRepository";
import {
  createPartnerCalendarOAuthLink,
  disconnectPartnerCalendarConnection,
  fetchPartnerCalendarConnections,
  type PartnerCalendarConnection,
  type PartnerCalendarProvider,
} from "@/lib/partnerCalendarRepository";
import {
  formatNextBookingSlot,
  getBookingDateTime,
  isFutureBooking,
  sortBookingsNewestFirst,
  sortBookingsUpcomingFirst,
} from "@/lib/partnerAppointmentOrdering";

const navItems = [
  { id: "bookings", label: "Ραντεβού", icon: CalendarDays },
  { id: "casePayments", label: "Υποθέσεις & Πληρωμές", icon: FileText },
  { id: "availability", label: "Διαθεσιμότητα", icon: Clock3 },
  { id: "profile", label: "Καταχώριση", icon: BadgeCheck },
  { id: "account", label: "Λογαριασμός", icon: Settings2 },
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
type DashboardTone = "navy" | "sage" | "amber" | "danger" | "neutral";

const partnerViewIds = new Set<PartnerView>(navItems.map((item) => item.id));
const parsePartnerView = (value: string | null, fallback: PartnerView = "bookings"): PartnerView => {
  if (value === "appointments") return "bookings";
  if (value === "pipeline" || value === "cases" || value === "payments" || value === "performance" || value === "earnings") return "casePayments";
  if (value === "reviews") return "profile";
  if (value === "settings" || value === "notifications") return "account";
  return value && partnerViewIds.has(value as PartnerView)
      ? (value as PartnerView)
      : fallback;
};

const viewMeta: Record<PartnerView, { title: string; description: string }> = {
  bookings: {
    title: "Ραντεβού και αιτήματα.",
    description: "Μία λίστα για νέα αιτήματα, επιβεβαιωμένα ραντεβού, πληρωμές και επόμενη ενέργεια.",
  },
  casePayments: {
    title: "Υποθέσεις με οικονομικό context.",
    description: "Υποθέσεις μόνο για πραγματικές συνεργασίες, με σχετικά ραντεβού, έγγραφα, σημειώσεις και πληρωμές.",
  },
  availability: {
    title: "Διαθεσιμότητα που αποθηκεύεται άμεσα.",
    description: "Ορίστε εβδομαδιαίο πρόγραμμα, Σαββατοκύριακο, άδειες, calendar sync και κανόνες κράτησης.",
  },
  profile: {
    title: "Δημόσια καταχώριση και εικόνα αναζήτησης.",
    description: "Επεξεργαστείτε δημόσιο προφίλ, τιμές, ειδικότητες και επαληθευμένες αξιολογήσεις.",
  },
  account: {
    title: "Ειδοποιήσεις και κανόνες λειτουργίας.",
    description: "Ελέγξτε ειδοποιήσεις, αυτόματη αποδοχή, session και κατάσταση λογαριασμού.",
  },
};

const weakProfileTerms = [
  "test",
  "demo",
  "lorem",
  "ipsum",
  "dfs",
  "asd",
  "potential",
  "πρόχειρο",
  "νεος δικηγορος",
  "νέος δικηγόρος",
];

const normalizeQualityText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const hasWeakProfileText = (value: string) => {
  const normalized = normalizeQualityText(value);
  if (!normalized) return true;
  if (normalized.length < 80) return true;
  if (weakProfileTerms.some((term) => normalized.includes(term))) return true;
  const letters = normalized.replace(/[^a-zα-ω]/gi, "");
  if (letters.length >= 20) {
    const vowels = letters.match(/[aeiouαεηιουω]/gi)?.length || 0;
    if (vowels / letters.length < 0.18) return true;
  }
  return false;
};

const buildPartnerListingQualityIssues = (workspace: PartnerWorkspace) => {
  const issues: string[] = [];
  const profile = workspace.profile;

  if (!profile.displayName.trim()) issues.push("Συμπληρώστε εμφανιζόμενο όνομα.");
  if (!profile.primarySpecialty.trim() || profile.specialties.length === 0) issues.push("Ορίστε κύρια ειδικότητα και τουλάχιστον μία δημόσια κατηγορία.");
  if (hasWeakProfileText(profile.bio)) issues.push("Γράψτε πιο συγκεκριμένη επαγγελματική περιγραφή, χωρίς πρόχειρο ή δοκιμαστικό κείμενο.");
  if ((profile.bestFor || "").trim().length < 45 || hasWeakProfileText(`${profile.bestFor} ${profile.bio}`)) {
    issues.push("Συμπληρώστε καθαρά σε ποιες υποθέσεις βοηθάτε καλύτερα.");
  }
  if (profile.videoPrice < minimumConsultationPrices.video) issues.push(`Η βιντεοκλήση πρέπει να είναι τουλάχιστον €${minimumConsultationPrices.video}.`);
  if (profile.phonePrice < minimumConsultationPrices.phone) issues.push(`Το τηλέφωνο πρέπει να είναι τουλάχιστον €${minimumConsultationPrices.phone}.`);
  if (profile.inPersonPrice < minimumConsultationPrices.inPerson) issues.push(`Η συνεδρία στο γραφείο πρέπει να είναι τουλάχιστον €${minimumConsultationPrices.inPerson}.`);
  const sessionDuration = normalizeSessionDurationMinutes(profile.sessionDurationMinutes);
  const validAvailabilityDays = workspace.availability.filter((slot) => slot.enabled && validateAvailabilitySlot(slot, sessionDuration).valid).length;
  if (validAvailabilityDays < 3) issues.push(`Ορίστε τουλάχιστον 3 διαθέσιμες ημέρες με ώρες ${availabilityBusinessHours.start}-${availabilityBusinessHours.end}.`);

  return Array.from(new Set(issues));
};

const getPartnerWorkspaceSaveErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");

  if (message.includes("save_partner_workspace_as_partner") || message.includes("PGRST202")) {
    return "Η αποθήκευση καταχώρισης δεν είναι διαθέσιμη τώρα. Ζητήστε έλεγχο υποστήριξης συνεργάτη και δοκιμάστε ξανά.";
  }

  if (message.includes("PARTNER_SESSION_INVALID")) {
    return "Η πρόσβαση συνεργάτη έληξε. Συνδεθείτε ξανά και δοκιμάστε πάλι.";
  }

  if (message.includes("401") || message.includes("Unauthorized") || message.includes("JWT")) {
    return "Η πρόσβαση δεν επιβεβαιώθηκε. Κάντε αποσύνδεση και ξανά είσοδο στον πίνακα συνεργάτη.";
  }

  if (message.includes("LAWYER_PROFILE_NOT_FOUND")) {
    return "Ο συνεργάτης δεν είναι συνδεδεμένος με ενεργή δημόσια καταχώριση στη βάση.";
  }

  if (
    message.includes("GOOGLE_CALENDAR_") ||
    message.includes("CALENDAR_TOKEN_SECRET")
  ) {
    return "Η σύνδεση Google Calendar δεν είναι πλήρως ρυθμισμένη στο Supabase. Προσθέστε τα Google OAuth credentials και δοκιμάστε ξανά.";
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
  timeOff: workspace.timeOff,
  notifications: {
    bookingEmail: workspace.notifications.bookingEmail,
    bookingSms: workspace.notifications.bookingSms,
    weeklyDigest: workspace.notifications.weeklyDigest,
  },
});

const hasWorkspaceSaveChanges = (currentWorkspace: PartnerWorkspace, savedWorkspace: PartnerWorkspace) =>
  JSON.stringify(buildWorkspaceSaveSnapshot(currentWorkspace)) !==
  JSON.stringify(buildWorkspaceSaveSnapshot(savedWorkspace));

interface PartnerPortalProps {
  chrome?: "partner" | "profile";
}

const PartnerPortal = ({ chrome = "partner" }: PartnerPortalProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(() => getPartnerSession());
  const email = session?.email || "";
  const [activeView, setActiveView] = useState<PartnerView>(() =>
    parsePartnerView(searchParams.get("view"), chrome === "profile" ? "profile" : "bookings"),
  );
  const [queueFilter, setQueueFilter] = useState<PipelineQueueFilter>("all");
  const [workspace, setWorkspace] = useState<PartnerWorkspace>(() => getPartnerWorkspace(email));
  const [savedWorkspace, setSavedWorkspace] = useState<PartnerWorkspace>(() => getPartnerWorkspace(email));
  const [bookingsVersion, setBookingsVersion] = useState(0);
  const [partnerBookings, setPartnerBookings] = useState<StoredBooking[]>([]);
  const [partnerPayments, setPartnerPayments] = useState<StoredPayment[]>([]);
  const [partnerDocuments, setPartnerDocuments] = useState<StoredBookingDocument[]>([]);
  const [partnerReviews, setPartnerReviews] = useState<StoredLawyerReview[]>([]);
  const [partnerCaseNotes, setPartnerCaseNotes] = useState<PartnerCaseNote[]>([]);
  const [partnerFollowups, setPartnerFollowups] = useState<PartnerFollowupTask[]>([]);
  const [partnerCases, setPartnerCases] = useState<PartnerCase[]>([]);
  const [partnerCasePrivateNotes, setPartnerCasePrivateNotes] = useState<PartnerCasePrivateNote[]>([]);
  const [partnerCaseHistory, setPartnerCaseHistory] = useState<PartnerCaseHistoryEvent[]>([]);
  const [calendarConnections, setCalendarConnections] = useState<PartnerCalendarConnection[]>([]);
  const [bookingActionState, setBookingActionState] = useState<Record<string, BookingActionState>>({});
  const [caseActionState, setCaseActionState] = useState<Record<string, SaveState>>({});
  const [calendarActionState, setCalendarActionState] = useState<SaveState>({ loading: false, message: "", tone: "info" });
  const [reviewActionState, setReviewActionState] = useState<Record<string, SaveState>>({});
  const [searchVisibilityBaseLawyer, setSearchVisibilityBaseLawyer] = useState<Lawyer | null | undefined>(undefined);
  const [profileSaveState, setProfileSaveState] = useState<SaveState>({
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
    void fetchPartnerWorkspace(email, session).then((nextWorkspace) => {
      if (!active) return;
      setWorkspace(nextWorkspace);
      setSavedWorkspace(nextWorkspace);
    }).catch(() => {
      if (!active) return;
      setProfileSaveState({
        loading: false,
        message: "Ο χώρος συνεργάτη είναι προσωρινά μη διαθέσιμος. Δεν χρησιμοποιούνται τοπικά στοιχεία όταν το σύστημα δεν απαντά.",
        tone: "error",
      });
    });

    return () => {
      active = false;
    };
  }, [email, session]);

  useEffect(() => {
    const requestedView = searchParams.get("view");
    const normalizedView = parsePartnerView(requestedView, chrome === "profile" ? "profile" : "bookings");
    if (requestedView && requestedView !== normalizedView) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("view", normalizedView);
      nextParams.delete("section");
      navigate({ search: `?${nextParams.toString()}` }, { replace: true });
      return;
    }
    setActiveView(normalizedView);
  }, [chrome, navigate, searchParams]);

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
      fetchDocumentsForLawyer(workspace.profile.lawyerId, session),
      fetchReviewsForLawyer(workspace.profile.lawyerId, true, session),
      fetchPartnerCrmState(workspace.profile.lawyerId, session),
      fetchPartnerCasesState(workspace.profile.lawyerId, session),
      fetchPartnerCalendarConnections(workspace.profile.lawyerId, session),
    ])
      .then(([nextBookings, nextPayments, nextDocuments, nextReviews, nextCrm, nextCasesState, nextCalendarConnections]) => {
        if (!active) return;
        setPartnerBookings(nextBookings);
        setPartnerPayments(nextPayments);
        setPartnerDocuments(nextDocuments);
        setPartnerReviews(nextReviews);
        setPartnerCaseNotes(nextCrm.notes);
        setPartnerFollowups(nextCrm.followups);
        setPartnerCases(nextCasesState.cases);
        setPartnerCasePrivateNotes(nextCasesState.notes);
        setPartnerCaseHistory(nextCasesState.history);
        setCalendarConnections(nextCalendarConnections);
      })
      .catch((error) => {
        if (!active) return;
        if (isPartnerSessionInvalidError(error)) handleExpiredPartnerSession();
        else {
          setPartnerBookings([]);
          setPartnerPayments([]);
          setPartnerDocuments([]);
          setPartnerReviews([]);
          setPartnerCaseNotes([]);
          setPartnerFollowups([]);
          setPartnerCases([]);
          setPartnerCasePrivateNotes([]);
          setPartnerCaseHistory([]);
          setCalendarConnections([]);
          setProfileSaveState({
            loading: false,
            message: "Τα ραντεβού, οι πληρωμές, τα έγγραφα και οι αξιολογήσεις συνεργάτη είναι προσωρινά μη διαθέσιμα από το σύστημα.",
            tone: "error",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [bookingsVersion, handleExpiredPartnerSession, session, workspace.profile.lawyerId]);

  const displayBookings = useMemo(
    () => [...partnerBookings].sort(sortBookingsNewestFirst),
    [partnerBookings],
  );
  const pipelineItems = useMemo(
    () =>
      buildPartnerPipelineItems({
        bookings: partnerBookings,
        payments: partnerPayments,
        documents: partnerDocuments,
        notes: partnerCaseNotes,
        followups: partnerFollowups,
      }),
    [partnerBookings, partnerCaseNotes, partnerDocuments, partnerFollowups, partnerPayments],
  );
  const paymentForBooking = (bookingId: string) => partnerPayments.find((payment) => payment.bookingId === bookingId);
  const newRequestCount = filterPartnerPipelineItems(pipelineItems, "new").length;
  const confirmedBookings = partnerBookings.filter((booking) => isBookingScheduled(booking, paymentForBooking(booking.id)));
  const upcomingBookings = useMemo(
    () =>
      confirmedBookings
        .filter((booking) => isFutureBooking(booking))
        .sort(sortBookingsUpcomingFirst),
    [confirmedBookings],
  );
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
  const activeCaseCount = partnerCases.filter((partnerCase) => !["completed", "archived"].includes(partnerCase.status)).length;
  const currentView = viewMeta[activeView];
  const hasUnsavedChanges = hasWorkspaceSaveChanges(workspace, savedWorkspace);
  const profileQualityIssues = useMemo(
    () => buildPartnerListingQualityIssues(workspace),
    [workspace],
  );
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
          "Δεν βρέθηκε ενεργή δημόσια καταχώριση συνδεδεμένη με αυτόν τον λογαριασμό. Ελέγξτε την έγκριση ένταξης από την υποστήριξη συνεργατών.",
          ...profileQualityIssues,
        ],
      };
    }

    const baseReadiness = getPublicLawyerProfileReadiness(applyPartnerWorkspaceToLawyer(searchVisibilityBaseLawyer, workspace));
    return {
      loading: false,
      ready: baseReadiness.ready && profileQualityIssues.length === 0,
      issues: Array.from(new Set([...baseReadiness.issues, ...profileQualityIssues])),
    };
  }, [profileQualityIssues, searchVisibilityBaseLawyer, workspace]);
  const workspaceSessionDuration = normalizeSessionDurationMinutes(workspace.profile.sessionDurationMinutes);
  const enabledAvailabilityDays = workspace.availability.filter(
    (slot) => slot.enabled && validateAvailabilitySlot(slot, workspaceSessionDuration).valid,
  ).length;
  const activeNavItem = navItems.find((item) => item.id === activeView) ?? navItems[0];
  const ActiveViewIcon = activeNavItem.icon;
  const publicProfileStatus = searchVisibility.loading
    ? "Έλεγχος καταχώρισης"
    : searchVisibility.ready
      ? "Έτοιμο για αναζήτηση"
      : "Χρειάζεται συμπλήρωση";
  const nextBooking = upcomingBookings[0];

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

    const availabilityValidation = validateAvailabilitySchedule(
      workspace.availability,
      workspace.profile.sessionDurationMinutes,
    );
    if (!availabilityValidation.valid) {
      setProfileSaveState({
        loading: false,
        message: availabilityValidation.message,
        tone: "error",
      });
      return;
    }

    setProfileSaveState({ loading: true, message: "Αποθήκευση αλλαγών...", tone: "info" });

    try {
      const savedWorkspace = await syncPartnerWorkspace(email, workspace, session, {
        throwOnRemoteError: true,
      });
      setWorkspace(savedWorkspace);
      setSavedWorkspace(savedWorkspace);
      setProfileSaveState({
        loading: false,
        message: "Οι αλλαγές αποθηκεύτηκαν στη δημόσια καταχώριση.",
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

  const upsertTimeOff = (updates: { id?: string; startDate: string; endDate: string; label: string }) => {
    const id = updates.id || `time-off-${Date.now().toString(36)}`;
    const nextItem = {
      id,
      startDate: updates.startDate,
      endDate: updates.endDate || updates.startDate,
      label: updates.label || "Μη διαθέσιμη ημέρα",
    };
    updateWorkspaceDraft({
      ...workspace,
      timeOff: [
        nextItem,
        ...workspace.timeOff.filter((item) => item.id !== id),
      ],
    });
  };

  const removeTimeOff = (id: string) => {
    updateWorkspaceDraft({
      ...workspace,
      timeOff: workspace.timeOff.filter((item) => item.id !== id),
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

  const acceptBooking = (booking?: StoredBooking) => {
    if (!booking) return;
    void acceptBookingPersisted(booking);
  };

  const cancelBooking = (booking?: StoredBooking) => {
    if (!booking) return;
    void cancelBookingPersisted(booking);
  };

  const markNoShowBooking = (booking?: StoredBooking) => {
    if (!booking) return;
    void markNoShowBookingPersisted(booking);
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
          message: "Η ολοκλήρωση ανοίγει μόνο αφού η πληρωμή έχει επιβεβαιωθεί.",
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
            message: "Η συμβουλευτική σημειώθηκε ως ολοκληρωμένη.",
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

  const acceptBookingPersisted = async (booking: StoredBooking) => {
    setBookingActionState((current) => ({
      ...current,
      [booking.id]: {
        loading: true,
        message: "Αποδοχή αιτήματος ραντεβού...",
        tone: "info",
      },
    }));

    const result = await acceptPartnerBooking(booking, session);
    if (result.error === "PARTNER_SESSION_INVALID") {
      handleExpiredPartnerSession();
      return;
    }

    setBookingActionState((current) => ({
      ...current,
      [booking.id]: result.synced
        ? {
            loading: false,
            message: "Το αίτημα αποδέχθηκε και η κράτηση ενημερώθηκε.",
            tone: "success",
          }
        : {
            loading: false,
            message: "Δεν καταχωρίστηκε η αποδοχή. Δοκιμάστε ξανά ή ανοίξτε υποστήριξη συνεργάτη.",
            tone: "error",
          },
    }));

    if (result.synced) setBookingsVersion((version) => version + 1);
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
    nextParams.delete("section");
    navigate({ search: `?${nextParams.toString()}` }, { replace: true });
  };

  const markNoShowBookingPersisted = async (booking: StoredBooking) => {
    if (!isVerifiedBooking(booking)) {
      setBookingActionState((current) => ({
        ...current,
        [booking.id]: {
          loading: false,
          message: "Αυτό το ραντεβού δεν έχει επιβεβαιωθεί πλήρως. Δεν μπορεί να σημειωθεί ως μη εμφάνιση.",
          tone: "error",
        },
      }));
      return;
    }

    setBookingActionState((current) => ({
      ...current,
      [booking.id]: {
        loading: true,
        message: "Καταχώριση μη εμφάνισης πελάτη...",
        tone: "info",
      },
    }));

    const result = await markPartnerBookingNoShow(booking, session);
    if (result.error === "PARTNER_SESSION_INVALID") {
      handleExpiredPartnerSession();
      return;
    }

    setBookingActionState((current) => ({
      ...current,
      [booking.id]: result.synced
        ? {
            loading: false,
            message: "Το ραντεβού σημειώθηκε ως μη εμφάνιση.",
            tone: "success",
          }
        : {
            loading: false,
            message: "Δεν καταχωρίστηκε η μη εμφάνιση. Δοκιμάστε ξανά ή ανοίξτε υποστήριξη συνεργάτη.",
            tone: "error",
          },
    }));

    if (result.synced) setBookingsVersion((version) => version + 1);
  };

  const connectCalendar = async (provider: PartnerCalendarProvider) => {
    setCalendarActionState({ loading: true, message: "Άνοιγμα ασφαλούς σύνδεσης ημερολογίου...", tone: "info" });
    try {
      const url = await createPartnerCalendarOAuthLink(provider, workspace.profile.lawyerId, session);
      setCalendarActionState({ loading: false, message: "Μεταφορά στον πάροχο ημερολογίου.", tone: "success" });
      if (typeof window !== "undefined") {
        window.location.assign(url);
      }
    } catch (error) {
      if (isPartnerSessionInvalidError(error)) {
        handleExpiredPartnerSession();
        return;
      }
      setCalendarActionState({
        loading: false,
        message: getPartnerWorkspaceSaveErrorMessage(error).replace("Δεν έγινε αποθήκευση.", "Η σύνδεση ημερολογίου δεν ξεκίνησε."),
        tone: "error",
      });
    }
  };

  const disconnectCalendar = async (provider: PartnerCalendarProvider) => {
    setCalendarActionState({ loading: true, message: "Αποσύνδεση ημερολογίου...", tone: "info" });
    try {
      await disconnectPartnerCalendarConnection(provider, workspace.profile.lawyerId, session);
      setCalendarConnections((current) =>
        current.map((connection) => connection.provider === provider ? { ...connection, status: "disabled" } : connection),
      );
      setCalendarActionState({ loading: false, message: "Το ημερολόγιο αποσυνδέθηκε.", tone: "success" });
    } catch (error) {
      if (isPartnerSessionInvalidError(error)) {
        handleExpiredPartnerSession();
        return;
      }
      setCalendarActionState({ loading: false, message: getPartnerWorkspaceSaveErrorMessage(error), tone: "error" });
    }
  };

  const convertBookingToCase = async (booking: StoredBooking) => {
    setCaseActionState((current) => ({
      ...current,
      [booking.id]: { loading: true, message: "Δημιουργία υπόθεσης από το ραντεβού...", tone: "info" },
    }));

    try {
      const nextCase = await createPartnerCaseFromBooking(booking, session);
      setPartnerCases((current) => [nextCase, ...current.filter((item) => item.id !== nextCase.id)]);
      setCaseActionState((current) => ({
        ...current,
        [booking.id]: { loading: false, message: "Η υπόθεση δημιουργήθηκε και συνδέθηκε με το ραντεβού.", tone: "success" },
      }));
      selectPartnerView("casePayments");
    } catch (error) {
      if (isPartnerSessionInvalidError(error)) {
        handleExpiredPartnerSession();
        return;
      }
      setCaseActionState((current) => ({
        ...current,
        [booking.id]: {
          loading: false,
          message: getPartnerWorkspaceSaveErrorMessage(error).replace(
            "Δεν έγινε αποθήκευση.",
            "Η υπόθεση δεν δημιουργήθηκε. Βεβαιωθείτε ότι το ραντεβού είναι πληρωμένο ή ολοκληρωμένο.",
          ),
          tone: "error",
        },
      }));
    }
  };

  const saveCaseUpdates = async (
    partnerCase: PartnerCase,
    updates: Partial<Pick<PartnerCase, "title" | "practiceArea" | "status" | "nextStep">>,
  ) => {
    setCaseActionState((current) => ({
      ...current,
      [partnerCase.id]: { loading: true, message: "Αποθήκευση υπόθεσης...", tone: "info" },
    }));

    try {
      const updatedCase = await updatePartnerCase(partnerCase, updates, session);
      setPartnerCases((current) => current.map((item) => item.id === updatedCase.id ? updatedCase : item));
      setCaseActionState((current) => ({
        ...current,
        [partnerCase.id]: { loading: false, message: "Η υπόθεση ενημερώθηκε.", tone: "success" },
      }));
    } catch (error) {
      if (isPartnerSessionInvalidError(error)) {
        handleExpiredPartnerSession();
        return;
      }
      setCaseActionState((current) => ({
        ...current,
        [partnerCase.id]: { loading: false, message: getPartnerWorkspaceSaveErrorMessage(error), tone: "error" },
      }));
    }
  };

  const addCasePrivateNote = async (partnerCase: PartnerCase, note: string) => {
    if (!note.trim()) return;
    setCaseActionState((current) => ({
      ...current,
      [partnerCase.id]: { loading: true, message: "Αποθήκευση σημείωσης υπόθεσης...", tone: "info" },
    }));

    try {
      const savedNote = await savePartnerCasePrivateNote(partnerCase, note.trim(), session);
      setPartnerCasePrivateNotes((current) => [savedNote, ...current]);
      setCaseActionState((current) => ({
        ...current,
        [partnerCase.id]: { loading: false, message: "Η σημείωση αποθηκεύτηκε.", tone: "success" },
      }));
    } catch (error) {
      if (isPartnerSessionInvalidError(error)) {
        handleExpiredPartnerSession();
        return;
      }
      setCaseActionState((current) => ({
        ...current,
        [partnerCase.id]: { loading: false, message: getPartnerWorkspaceSaveErrorMessage(error), tone: "error" },
      }));
    }
  };

  const selectQueueFilter = (filter: PipelineQueueFilter) => {
    setQueueFilter(filter);
    selectPartnerView("casePayments");
  };

  const updateReviewReplyDraft = (reviewId: string, reply: string) => {
    setPartnerReviews((currentReviews) =>
      currentReviews.map((review) => review.id === reviewId ? { ...review, reply } : review),
    );
  };

  const saveReviewReply = async (review: StoredLawyerReview) => {
    setReviewActionState((current) => ({
      ...current,
      [review.id]: {
        loading: true,
        message: "Αποθήκευση απάντησης στην αξιολόγηση...",
        tone: "info",
      },
    }));

    try {
      await updateLawyerReview(review.id, { reply: review.reply }, session);
      setReviewActionState((current) => ({
        ...current,
        [review.id]: {
          loading: false,
          message: "Η απάντηση αποθηκεύτηκε στο review record.",
          tone: "success",
        },
      }));
    } catch (error) {
      if (isPartnerSessionInvalidError(error)) {
        handleExpiredPartnerSession();
        return;
      }

      setReviewActionState((current) => ({
        ...current,
        [review.id]: {
          loading: false,
          message: "Η απάντηση δεν αποθηκεύτηκε. Δοκιμάστε ξανά ή ανοίξτε υποστήριξη συνεργάτη.",
          tone: "error",
        },
      }));
    }
  };

  const sidebarItems: Array<{
    key: string;
    label: string;
    icon: LucideIcon;
    badge?: {
      value: string;
      tone: DashboardTone;
      title: string;
    };
    active: boolean;
    onClick: () => void;
  }> = [
    {
      key: "bookings",
      label: "Ραντεβού",
      icon: CalendarDays,
      badge: displayBookings.length > 0
        ? {
            value: String(displayBookings.length),
            tone: newRequestCount > 0 ? "amber" : "navy",
            title: newRequestCount > 0 ? "Υπάρχουν νέα αιτήματα ραντεβού" : "Σύνολο ενεργών ραντεβού",
          }
        : undefined,
      active: activeView === "bookings",
      onClick: () => selectPartnerView("bookings"),
    },
    {
      key: "casePayments",
      label: "Υποθέσεις & Πληρωμές",
      icon: FileText,
      badge: activeCaseCount > 0
        ? { value: String(activeCaseCount), tone: "navy", title: "Ενεργές υποθέσεις" }
        : undefined,
      active: activeView === "casePayments",
      onClick: () => selectPartnerView("casePayments"),
    },
    {
      key: "availability",
      label: "Διαθεσιμότητα",
      icon: Clock3,
      badge: enabledAvailabilityDays > 0
        ? { value: String(enabledAvailabilityDays), tone: "sage", title: "Ενεργές ημέρες κράτησης" }
        : undefined,
      active: activeView === "availability",
      onClick: () => selectPartnerView("availability"),
    },
    {
      key: "profile",
      label: "Καταχώριση",
      icon: BadgeCheck,
      badge: searchVisibility.ready ? { value: "Live", tone: "sage", title: "Η δημόσια καταχώριση είναι ορατή" } : undefined,
      active: activeView === "profile",
      onClick: () => selectPartnerView("profile"),
    },
    {
      key: "account",
      label: "Λογαριασμός",
      icon: Settings2,
      badge: hasUnsavedChanges ? { value: "Draft", tone: "amber", title: "Υπάρχουν μη αποθηκευμένες αλλαγές" } : undefined,
      active: activeView === "account",
      onClick: () => selectPartnerView("account"),
    },
  ];

  return (
    <PartnerShell chrome={chrome} className="pb-8">
      <section className="space-y-5">
        <header className="rounded-xl border border-border bg-card p-5 shadow-lg shadow-foreground/[0.03] lg:p-6">
          <div className="grid gap-5 xl:grid-cols-[1fr_520px] xl:items-end">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Χώρος συνεργάτη</p>
                <h1 className="mt-1 truncate font-serif text-3xl tracking-tight text-foreground md:text-4xl">
                  {workspace.profile.displayName || workspace.profile.officeName || email}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Διαχειριστείτε δημόσια καταχώριση, ραντεβού, υποθέσεις, πληρωμές και ειδοποιήσεις με την ίδια λογική του χώρου πελάτη.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {workspace.profile.city ? (
                <span className="rounded-lg border border-border bg-secondary/35 px-3 py-2 text-xs font-bold text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {workspace.profile.city}
                </span>
              ) : null}
              <span className="rounded-lg border border-border bg-secondary/35 px-3 py-2 text-xs font-bold text-muted-foreground">
                <BadgeCheck className="h-3.5 w-3.5" />
                {publicProfileStatus}
              </span>
            </div>
          </div>
        </header>

        <PartnerCommandBar
          nextBooking={nextBooking}
          newRequestCount={newRequestCount}
          pendingRevenueCents={pendingRevenueCents}
          enabledAvailabilityDays={enabledAvailabilityDays}
          onSelectFilter={selectQueueFilter}
          onSelectView={selectPartnerView}
        />

        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="min-w-0 xl:sticky xl:top-[82px] xl:self-start">
            <nav className="rounded-xl border border-border bg-card p-4 shadow-lg shadow-foreground/[0.03]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Εργαλεία συνεργάτη</p>
              <div className="mt-3 grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
                {sidebarItems.map(({ key, label, icon: Icon, active, badge, onClick }) => {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={onClick}
                      className={`group flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold transition ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="whitespace-nowrap">{label}</span>
                      </span>
                      {badge ? (
                        <span
                          className={cn(
                            "max-w-[72px] truncate rounded-full border px-2 py-0.5 text-[10px] font-bold",
                            active ? "border-primary-foreground/20 bg-primary-foreground/15 text-primary-foreground" : getToneClasses(badge.tone),
                          )}
                          title={badge.title}
                          aria-label={badge.title}
                        >
                          {badge.value}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </nav>
          </aside>

          <div className="min-w-0 space-y-4">
            {activeView !== "bookings" ? (
            <section className="rounded-lg border border-border bg-card p-4 shadow-lg shadow-foreground/[0.03]">
              <div className="flex flex-col gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ActiveViewIcon className="h-4 w-4 text-primary" />
                    <h2 className="truncate font-serif text-xl tracking-tight text-foreground">
                      {activeNavItem.label}
                    </h2>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{currentView.description}</p>
                </div>
              </div>
              {profileSaveState.message ? (
                <div className="mt-3">
                  <SaveMessage saveState={profileSaveState} />
                </div>
              ) : null}
            </section>
            ) : null}

          {activeView === "profile" ? (
            <ProfileView
              workspace={workspace}
              searchVisibility={searchVisibility}
              reviews={partnerReviews}
              reviewActionState={reviewActionState}
              updateProfile={updateProfile}
              onReplyChange={updateReviewReplyDraft}
              onSaveReply={(review) => void saveReviewReply(review)}
              onSave={() => void saveWorkspaceChanges()}
              hasUnsavedChanges={hasUnsavedChanges}
              saveState={profileSaveState}
            />
          ) : null}

          {activeView === "bookings" ? (
            <AppointmentsView
              bookings={partnerBookings}
              documents={partnerDocuments}
              payments={partnerPayments}
              actionState={bookingActionState}
              caseActionState={caseActionState}
              onAccept={acceptBooking}
              onComplete={completeBooking}
              onCancel={cancelBooking}
              onNoShow={markNoShowBooking}
              onConvertToCase={(booking) => void convertBookingToCase(booking)}
            />
          ) : null}

          {activeView === "casePayments" ? (
            <CasesPaymentsView
              cases={partnerCases}
              bookings={partnerBookings}
              payments={partnerPayments}
              documents={partnerDocuments}
              notes={partnerCasePrivateNotes}
              history={partnerCaseHistory}
              actionState={caseActionState}
              completedRevenueCents={completedRevenueCents}
              pendingRevenueCents={pendingRevenueCents}
              completedPlatformFeeCents={completedPlatformFeeCents}
              onSaveCase={(partnerCase, updates) => void saveCaseUpdates(partnerCase, updates)}
              onAddNote={(partnerCase, note) => void addCasePrivateNote(partnerCase, note)}
              onSelectAppointments={() => selectPartnerView("bookings")}
            />
          ) : null}

          {activeView === "availability" ? (
            <SignupAvailabilityView
              workspace={workspace}
              updateAvailability={updateAvailability}
              upsertTimeOff={upsertTimeOff}
              removeTimeOff={removeTimeOff}
              calendarConnections={calendarConnections}
              calendarActionState={calendarActionState}
              onConnectCalendar={(provider) => void connectCalendar(provider)}
              onDisconnectCalendar={(provider) => void disconnectCalendar(provider)}
              updateProfile={updateProfile}
              onSave={() => void saveWorkspaceChanges()}
              hasUnsavedChanges={hasUnsavedChanges}
              saveState={profileSaveState}
            />
          ) : null}

          {activeView === "account" ? (
            <NotificationsView
              workspace={workspace}
              updateProfile={updateProfile}
              updateNotifications={updateNotifications}
              onSave={() => void saveWorkspaceChanges()}
              hasUnsavedChanges={hasUnsavedChanges}
              saveState={profileSaveState}
            />
          ) : null}
        </div>
        </div>
      </section>
    </PartnerShell>
  );
};

const partnerBookingStateLabels: Record<BookingState, string> = {
  pending_confirmation: "Σε έλεγχο",
  confirmed_unpaid: "Χρειάζεται πληρωμή",
  confirmed_paid: "Επιβεβαιωμένο",
  completed: "Ολοκληρωμένο",
  no_show: "Δεν εμφανίστηκε",
  cancelled: "Ακυρώθηκε",
};

const partnerPaymentStateLabels: Record<PaymentState, string> = {
  not_opened: "Εκκρεμεί πληρωμή",
  checkout_opened: "Σε πληρωμή",
  paid: "Πληρωμένο",
  failed: "Αποτυχία πληρωμής",
  refund_requested: "Αίτημα επιστροφής",
  refunded: "Επιστράφηκε",
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

const getToneClasses = (tone: DashboardTone) => {
  if (tone === "sage") {
    return "border-emerald-600/35 bg-emerald-50 text-emerald-900";
  }
  if (tone === "amber") {
    return "border-amber-500/55 bg-amber-50 text-amber-950";
  }
  if (tone === "danger") {
    return "border-red-500/55 bg-red-50 text-red-800";
  }
  if (tone === "navy") {
    return "border-primary/25 bg-primary/10 text-primary";
  }
  return "border-slate-300 bg-slate-50 text-slate-700";
};

const InlineRuleValue = ({ label, value }: { label: string; value: string }) => (
  <span className="inline-flex min-w-0 items-baseline gap-2 text-sm text-[hsl(var(--partner-ink))]">
    <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
    <span className="truncate font-semibold">{value}</span>
  </span>
);

const demoClientNames = [
  "Μαρία Παπαδοπούλου",
  "Νίκος Αντωνίου",
  "Ελένη Καραγιάννη",
  "Γιώργος Σταυρόπουλος",
  "Αθηνά Ιωάννου",
  "Κώστας Δημητρίου",
  "Σοφία Βασιλείου",
  "Παναγιώτης Λάμπρου",
];

const getStableNameIndex = (value: string) =>
  Math.abs(Array.from(value).reduce((sum, character) => sum + character.charCodeAt(0), 0)) % demoClientNames.length;

const lowCredibilityClientNames = new Set(["codhak", "test", "demo", "user", "client", "πελατης", "pelatis"]);

const getDisplayPersonName = (name?: string | null, seed = "") => {
  const normalized = normalizeQualityText(name || "");
  if (!normalized || lowCredibilityClientNames.has(normalized) || normalized.length < 3) {
    return demoClientNames[getStableNameIndex(seed || normalized || "client")];
  }
  return name || "";
};

const getDisplayClientName = (booking?: Pick<StoredBooking, "clientName" | "referenceId" | "id"> | null) => {
  if (!booking) return "";
  return getDisplayPersonName(booking.clientName, booking.referenceId || booking.id);
};

const PartnerCommandBar = ({
  nextBooking,
  newRequestCount,
  pendingRevenueCents,
  enabledAvailabilityDays,
  onSelectFilter,
  onSelectView,
}: {
  nextBooking?: StoredBooking;
  newRequestCount: number;
  pendingRevenueCents: number;
  enabledAvailabilityDays: number;
  onSelectFilter: (filter: PipelineQueueFilter) => void;
  onSelectView: (view: PartnerView) => void;
}) => (
  <section className="grid min-w-0 gap-2 md:grid-cols-4">
    <button
      type="button"
      onClick={() => onSelectFilter("today")}
      className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-left shadow-lg shadow-foreground/[0.03] transition hover:border-primary/35 hover:bg-primary/5"
    >
      <span className="flex items-start justify-between gap-2">
        <span>
          <p className="partner-kicker">Επόμενο ραντεβού</p>
          <p className="mt-1 text-lg font-bold text-foreground">{nextBooking ? formatNextBookingSlot(nextBooking) : "Κανένα επόμενο"}</p>
        </span>
        <CalendarDays className="h-4 w-4 text-primary" />
      </span>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {nextBooking ? getDisplayClientName(nextBooking) : "Δεν υπάρχει μελλοντικό ραντεβού"}
      </p>
    </button>

    <button
      type="button"
      onClick={() => onSelectFilter("new")}
      className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-left shadow-lg shadow-foreground/[0.03] transition hover:border-primary/35 hover:bg-primary/5"
    >
      <span className="flex items-start justify-between gap-2">
        <span>
          <p className="partner-kicker">Νέα αιτήματα</p>
          <p className="mt-1 text-lg font-bold text-foreground">{newRequestCount} αιτήματα</p>
        </span>
        <CircleAlert className={cn("h-4 w-4", newRequestCount > 0 ? "text-amber-700" : "text-muted-foreground")} />
      </span>
      <p className="mt-1 text-xs text-muted-foreground">{newRequestCount > 0 ? "Περιμένουν αποδοχή" : "Δεν υπάρχουν νέα αιτήματα"}</p>
    </button>

    <button
      type="button"
      onClick={() => onSelectView("casePayments")}
      className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-left shadow-lg shadow-foreground/[0.03] transition hover:border-primary/35 hover:bg-primary/5"
    >
      <span className="flex items-start justify-between gap-2">
        <span>
          <p className="partner-kicker">Εκκρεμείς πληρωμές</p>
          <p className="mt-1 text-lg font-bold text-foreground">{formatEuroCents(pendingRevenueCents)}</p>
        </span>
        <WalletCards className="h-4 w-4 text-primary" />
      </span>
      <p className="mt-1 text-xs text-muted-foreground">Ποσό που δεν έχει κλείσει ακόμα</p>
    </button>

    <button
      type="button"
      onClick={() => onSelectView("availability")}
      className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-left shadow-lg shadow-foreground/[0.03] transition hover:border-primary/35 hover:bg-primary/5"
    >
      <span className="flex items-start justify-between gap-2">
        <span>
          <p className="partner-kicker">Διαθεσιμότητα</p>
          <p className="mt-1 text-lg font-bold text-foreground">{enabledAvailabilityDays}/7 ημέρες</p>
        </span>
        <Clock3 className="h-4 w-4 text-primary" />
      </span>
      <p className="mt-1 text-xs text-muted-foreground">Δημόσιο πρόγραμμα κρατήσεων</p>
    </button>
  </section>
);

const SignalRow = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: DashboardTone;
}) => (
  <div className={`flex min-w-0 max-w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 ${getToneClasses(tone)}`}>
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate text-[10px] font-bold uppercase tracking-[0.11em] opacity-75">{label}</span>
    </span>
    <span className="max-w-[140px] truncate text-sm font-bold">{value}</span>
  </div>
);

const formatShortDate = (value?: string) => {
  if (!value) return "Δεν έχει οριστεί";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("el-GR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const StatusPill = ({ tone, children }: { tone: DashboardTone; children: ReactNode }) => (
  <span className={`relative inline-flex min-w-[6.75rem] items-center justify-center rounded-full border px-3 py-1 text-center text-[10px] font-bold uppercase leading-[1.15] tracking-[0.1em] ${getToneClasses(tone)}`}>
    <span className="absolute left-2 h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
    <span className="block max-w-full text-center">{children}</span>
  </span>
);

const AppointmentBadge = ({ tone, children }: { tone: DashboardTone; children: ReactNode }) => (
  <span className={`relative inline-flex min-w-[6.75rem] items-center justify-center rounded-full border px-3 py-1 text-center text-xs font-semibold leading-tight ${getToneClasses(tone)}`}>
    <span className="absolute left-2 h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
    <span className="block max-w-full text-center">{children}</span>
  </span>
);

type PipelineQueueFilter = "all" | "today" | "new" | "confirmed" | "completed" | "cancelled";

const pipelineQueueFilters: Array<{ id: PipelineQueueFilter; label: string }> = [
  { id: "all", label: "Όλα" },
  { id: "today", label: "Σήμερα" },
  { id: "new", label: "Νέα αιτήματα" },
  { id: "confirmed", label: "Επιβεβαιωμένα" },
  { id: "completed", label: "Ολοκληρωμένα" },
  { id: "cancelled", label: "Ακυρωμένα" },
];

const getPaymentTone = (state?: PaymentState | null): DashboardTone => {
  if (state === "paid") return "sage";
  if (state === "failed" || state === "refund_requested") return "danger";
  if (state === "checkout_opened" || state === "not_opened") return "amber";
  if (state === "refunded") return "neutral";
  return "neutral";
};

const getBookingTone = (state: BookingState): DashboardTone => {
  if (state === "confirmed_paid" || state === "completed") return "sage";
  if (state === "cancelled") return "neutral";
  if (state === "confirmed_unpaid" || state === "pending_confirmation") return "amber";
  return "neutral";
};

const getOpenFollowups = (item: PartnerPipelineItem) => item.followups.filter((task) => task.status === "open");

const getFollowupTone = (item: PartnerPipelineItem): DashboardTone => {
  const openFollowups = getOpenFollowups(item);
  if (openFollowups.some((task) => new Date(task.dueAt).getTime() < Date.now())) return "danger";
  return openFollowups.length > 0 ? "amber" : "neutral";
};

const getFollowupLabel = (item: PartnerPipelineItem) => {
  const openFollowups = getOpenFollowups(item);
  if (openFollowups.some((task) => new Date(task.dueAt).getTime() < Date.now())) return "Εκκρεμεί συνέχεια";
  if (openFollowups.length > 0) return "Χρειάζεται συνέχεια";
  return "Δεν χρειάζεται συνέχεια";
};

function partnerPipelineItemNeedsAction(item: PartnerPipelineItem) {
  const paymentState = item.payment ? getCanonicalPaymentState(item.payment) : null;
  const bookingState = getCanonicalBookingState(item.booking);

  return (
    item.status === "follow_up_needed" ||
    item.status === "refund_risk" ||
    paymentState === "failed" ||
    paymentState === "refund_requested" ||
    getOpenFollowups(item).length > 0 ||
    (item.documents.length === 0 && bookingState !== "completed" && bookingState !== "cancelled") ||
    !isVerifiedBooking(item.booking)
  );
}

function filterPartnerPipelineItems(items: PartnerPipelineItem[], filter: PipelineQueueFilter) {
  return items.filter((item) => {
    const bookingState = getCanonicalBookingState(item.booking, item.payment);

    if (filter === "today") return isAppointmentToday(item.booking);
    if (filter === "new") return bookingState === "pending_confirmation" || !isVerifiedBooking(item.booking);
    if (filter === "confirmed") return bookingState === "confirmed_paid" || bookingState === "confirmed_unpaid";
    if (filter === "completed") return item.status === "completed" || bookingState === "completed";
    if (filter === "cancelled") return bookingState === "cancelled";
    return true;
  });
}

const normalizeAppointmentDateText = (value: string) =>
  normalizeQualityText(value)
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isAppointmentToday = (booking: StoredBooking) => {
  const now = new Date();
  const label = normalizeAppointmentDateText(booking.dateLabel);
  const candidates = [
    now.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" }),
    now.toLocaleDateString("el-GR", { day: "numeric", month: "long" }),
    now.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" }),
  ].map(normalizeAppointmentDateText);

  return candidates.some((candidate) => candidate && label.includes(candidate));
};

const getAppointmentStatusLabel = (item: PartnerPipelineItem) => {
  const bookingState = getCanonicalBookingState(item.booking, item.payment);
  if (bookingState === "pending_confirmation" || !isVerifiedBooking(item.booking)) return "Νέο αίτημα";
  if (bookingState === "confirmed_paid" || bookingState === "confirmed_unpaid") return "Επιβεβαιωμένο";
  if (bookingState === "completed") return "Ολοκληρωμένο";
  if (bookingState === "no_show") return "Δεν εμφανίστηκε";
  if (bookingState === "cancelled") return "Ακυρωμένο";
  return "Νέο αίτημα";
};

const getAppointmentStatusTone = (item: PartnerPipelineItem): DashboardTone => {
  const bookingState = getCanonicalBookingState(item.booking, item.payment);
  if (bookingState === "pending_confirmation" || !isVerifiedBooking(item.booking)) return "amber";
  if (bookingState === "confirmed_paid" || bookingState === "confirmed_unpaid" || bookingState === "completed") return "sage";
  return "neutral";
};

const getAppointmentPaymentLabel = (payment?: StoredPayment | null) => {
  const paymentState = getCanonicalPaymentState(payment);
  if (paymentState === "paid") return "Πληρωμένο";
  if (paymentState === "failed") return "Αποτυχία πληρωμής";
  if (paymentState === "checkout_opened") return "Σε αναμονή";
  if (paymentState === "refund_requested") return "Αίτημα επιστροφής";
  if (paymentState === "refunded") return "Επιστράφηκε";
  return "Δεν έχει ανοίξει";
};

const getAppointmentPaymentTone = (payment?: StoredPayment | null): DashboardTone => {
  const paymentState = getCanonicalPaymentState(payment);
  if (paymentState === "paid") return "sage";
  if (paymentState === "failed" || paymentState === "refund_requested") return "danger";
  if (paymentState === "checkout_opened" || paymentState === "not_opened") return "amber";
  return "neutral";
};

const getAppointmentIssue = (booking: StoredBooking) =>
  booking.issueSummary?.trim() || "Δεν έχει προστεθεί θέμα από τον πελάτη.";

const getAppointmentDescription = (booking: StoredBooking) =>
  booking.issueSummary?.trim() || "Δεν έχει προστεθεί περιγραφή από τον πελάτη.";

const buildAppointmentMailto = (booking: StoredBooking, subject: string, body: string) =>
  `mailto:${encodeURIComponent(booking.clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

const getPipelineNextAction = (item: PartnerPipelineItem) => {
  const paymentState = item.payment ? getCanonicalPaymentState(item.payment) : null;
  const bookingState = getCanonicalBookingState(item.booking);
  const openFollowups = getOpenFollowups(item);

  if (paymentState === "failed") return "Στείλτε νέο σύνδεσμο πληρωμής";
  if (paymentState === "refund_requested" || item.status === "refund_risk") return "Ελέγξτε αίτημα επιστροφής";
  if (!isVerifiedBooking(item.booking)) return "Αναμονή επιβεβαίωσης συστήματος";
  if (openFollowups.length > 0) return "Κλείστε εκκρεμή υπενθύμιση";
  if (item.documents.length === 0 && bookingState !== "completed") return "Ζητήστε έγγραφα υπόθεσης";
  if (bookingState === "confirmed_paid") return "Προετοιμάστε τη συνεδρία";
  if (bookingState === "completed") return "Κλείστε οικονομική συνέχεια";
  return "Ελέγξτε το επόμενο βήμα";
};

const getCasePrimaryState = (item: PartnerPipelineItem): { label: string; tone: DashboardTone } => {
  const paymentState = item.payment ? getCanonicalPaymentState(item.payment) : null;
  const bookingState = getCanonicalBookingState(item.booking);
  const openFollowups = getOpenFollowups(item);
  const hasOverdueFollowup = openFollowups.some((task) => new Date(task.dueAt).getTime() < Date.now());

  if (paymentState === "failed") return { label: "Αποτυχία πληρωμής", tone: "danger" };
  if (paymentState === "refund_requested") return { label: "Αίτημα επιστροφής", tone: "danger" };
  if (hasOverdueFollowup) return { label: "Εκκρεμεί συνέχεια", tone: "danger" };
  if (item.status === "refund_risk") return { label: "Πιθανή επανεπικοινωνία", tone: "amber" };
  if (item.status === "follow_up_needed" || openFollowups.length > 0) return { label: "Χρειάζεται συνέχεια", tone: "amber" };
  if (!isVerifiedBooking(item.booking)) return { label: "Αναμονή επιβεβαίωσης", tone: "amber" };
  if (bookingState === "confirmed_paid") return { label: "Επόμενο ραντεβού", tone: "sage" };
  if (bookingState === "completed") return { label: "Ολοκληρωμένο", tone: "sage" };
  if (bookingState === "cancelled") return { label: "Ακυρωμένη κράτηση", tone: "neutral" };
  return { label: "Έλεγχος υπόθεσης", tone: "neutral" };
};

const getCaseSecondaryLine = (item: PartnerPipelineItem) => {
  const bookingState = getCanonicalBookingState(item.booking);
  const paymentState = item.payment ? getCanonicalPaymentState(item.payment) : null;
  const bookingDetails: Record<BookingState, string> = {
    pending_confirmation: "Κράτηση σε έλεγχο",
    confirmed_unpaid: "Αναμονή πληρωμής",
    confirmed_paid: "Επιβεβαιωμένη κράτηση",
    completed: "Ολοκληρωμένη κράτηση",
    no_show: "Δεν εμφανίστηκε",
    cancelled: "Ακυρωμένη κράτηση",
  };
  const followupDetail =
    item.status === "refund_risk"
      ? "Πιθανή επανεπικοινωνία"
      : getFollowupLabel(item) === "Δεν χρειάζεται συνέχεια"
        ? ""
        : getFollowupLabel(item);
  const parts = [
    bookingDetails[bookingState],
    paymentState && paymentState !== "failed" ? partnerPaymentStateLabels[paymentState] : "",
    followupDetail,
  ].filter(Boolean);

  return Array.from(new Set(parts)).join(" · ");
};

type RecommendedCaseAction = {
  title: string;
  description: string;
  primaryLabel: string;
  primaryView?: PartnerView;
  completeBooking?: boolean;
  reminderTitle: string;
  tone: DashboardTone;
};

const getRecommendedCaseAction = (item: PartnerPipelineItem): RecommendedCaseAction => {
  const paymentState = item.payment ? getCanonicalPaymentState(item.payment) : null;
  const bookingState = getCanonicalBookingState(item.booking);
  const openFollowups = getOpenFollowups(item);
  const hasOverdueFollowup = openFollowups.some((task) => new Date(task.dueAt).getTime() < Date.now());

  if (paymentState === "failed") {
    return {
      title: "Ελέγξτε την αποτυχία πληρωμής",
      description: "Η πληρωμή δεν ολοκληρώθηκε. Επικοινωνήστε με τον πελάτη και ελέγξτε την κράτηση στις πληρωμές.",
      primaryLabel: "Έλεγχος πληρωμής",
      primaryView: "casePayments",
      reminderTitle: "Επικοινωνία για αποτυχία πληρωμής",
      tone: "danger" as DashboardTone,
    };
  }

  if (paymentState === "refund_requested" || item.status === "refund_risk") {
    return {
      title: "Χρειάζεται έλεγχος επανεπικοινωνίας",
      description: "Υπάρχει ένδειξη ότι η υπόθεση μπορεί να χρειάζεται νέα επικοινωνία ή οικονομικό έλεγχο.",
      primaryLabel: "Άνοιγμα πληρωμών",
      primaryView: "casePayments",
      reminderTitle: "Έλεγχος επανεπικοινωνίας πελάτη",
      tone: "amber" as DashboardTone,
    };
  }

  if (hasOverdueFollowup || openFollowups.length > 0) {
    return {
      title: "Κλείστε την εκκρεμή συνέχεια",
      description: "Υπάρχει υπενθύμιση που περιμένει ενέργεια. Σημειώστε τι έγινε και ορίστε νέο βήμα μόνο αν χρειάζεται.",
      primaryLabel: "Προσθήκη σημείωσης",
      reminderTitle: "Νέα συνέχεια υπόθεσης",
      tone: hasOverdueFollowup ? "danger" as DashboardTone : "amber" as DashboardTone,
    };
  }

  if (item.documents.length === 0 && bookingState !== "completed" && bookingState !== "cancelled") {
    return {
      title: "Λείπουν έγγραφα υπόθεσης",
      description: "Δεν έχουν ανέβει έγγραφα για την υπόθεση. Αν χρειάζονται για την προετοιμασία, ζητήστε τα πριν τη συνεδρία.",
      primaryLabel: "Προσθήκη σημείωσης",
      reminderTitle: "Ζητήστε έγγραφα υπόθεσης",
      tone: "amber" as DashboardTone,
    };
  }

  if (bookingState === "confirmed_paid") {
    return {
      title: "Προετοιμασία συνεδρίας",
      description: "Η κράτηση είναι πληρωμένη. Ελέγξτε στοιχεία πελάτη, σημειώσεις και έγγραφα πριν τη συνεδρία.",
      primaryLabel: "Σήμανση ολοκλήρωσης",
      completeBooking: true,
      reminderTitle: "Προετοιμασία συνεδρίας",
      tone: "sage" as DashboardTone,
    };
  }

  return {
    title: "Καταγράψτε το επόμενο βήμα",
    description: "Κρατήστε σύντομη εσωτερική σημείωση ώστε η υπόθεση να έχει καθαρή συνέχεια.",
    primaryLabel: "Προσθήκη σημείωσης",
    reminderTitle: "Επόμενη ενέργεια υπόθεσης",
    tone: "neutral" as DashboardTone,
  };
};

const getCaseStatusExplanation = (item: PartnerPipelineItem) => {
  const paymentState = item.payment ? getCanonicalPaymentState(item.payment) : null;
  const bookingState = getCanonicalBookingState(item.booking);

  if (paymentState === "failed") return "Η πληρωμή δεν ολοκληρώθηκε και η κράτηση ακυρώθηκε αυτόματα.";
  if (paymentState === "refund_requested") return "Υπάρχει αίτημα επιστροφής που χρειάζεται έλεγχο πριν κλείσει η οικονομική συνέχεια.";
  if (getFollowupTone(item) === "danger") return "Υπάρχει υπενθύμιση που έχει περάσει την προγραμματισμένη ώρα.";
  if (item.documents.length === 0 && bookingState !== "completed" && bookingState !== "cancelled") return "Δεν έχουν ανέβει έγγραφα για την υπόθεση.";
  if (!isVerifiedBooking(item.booking)) return "Η κράτηση περιμένει επιβεβαίωση από το σύστημα.";
  return "Η υπόθεση εμφανίζεται στην ουρά για να υπάρχει καθαρή συνέχεια εργασίας.";
};

const formatActivityDate = (value?: string) => {
  if (!value) return "Σήμερα";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("el-GR", { day: "numeric", month: "short" });
};

const getCaseActivity = (item: PartnerPipelineItem) => {
  const paymentState = item.payment ? getCanonicalPaymentState(item.payment) : null;
  const bookingState = getCanonicalBookingState(item.booking);
  const paymentDate = item.payment?.updatedAt || item.payment?.createdAt || item.booking.createdAt;
  const entries: Array<{ date: string; label: string }> = [];

  if (paymentState === "failed") {
    entries.push({ date: formatActivityDate(paymentDate), label: "Η πληρωμή απέτυχε" });
  }
  if (paymentState === "refund_requested") {
    entries.push({ date: formatActivityDate(paymentDate), label: "Ζητήθηκε έλεγχος επιστροφής" });
  }
  if (bookingState === "cancelled") {
    entries.push({ date: formatActivityDate(item.booking.createdAt), label: "Η κράτηση ακυρώθηκε" });
  }
  if (item.followups.length > 0) {
    entries.push({ date: formatActivityDate(item.followups[0]?.createdAt || item.followups[0]?.dueAt), label: "Δημιουργήθηκε υπενθύμιση" });
  }

  entries.push({ date: formatActivityDate(item.booking.createdAt), label: "Η κράτηση δημιουργήθηκε" });
  entries.push({ date: item.booking.dateLabel, label: `Ο πελάτης επέλεξε ${item.booking.consultationType} στις ${item.booking.time}` });

  return entries;
};

const CaseSection = ({ title, children, quiet = false }: { title: string; children: ReactNode; quiet?: boolean }) => (
  <div className={quiet ? "border-t border-[hsl(var(--partner-line))]/70 pt-3" : "rounded-2xl border border-[hsl(var(--partner-line))] bg-white/64 p-3"}>
    <p className="partner-kicker">{title}</p>
    <div className="mt-2">{children}</div>
  </div>
);

const CaseStateIndicator = ({ state }: { state: { label: string; tone: DashboardTone } }) =>
  state.label === "Ακυρωμένη κράτηση" ? (
    <span className="inline-flex shrink-0 items-center rounded-full bg-white/65 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
      {state.label}
    </span>
  ) : (
    <StatusPill tone={state.tone}>{state.label}</StatusPill>
  );

const PipelineView = ({
  items,
  activeFilter,
  onFilterChange,
  actionState,
  onChangeStatus,
  onCancel,
}: {
  items: PartnerPipelineItem[];
  activeFilter: PipelineQueueFilter;
  onFilterChange: (filter: PipelineQueueFilter) => void;
  actionState: Record<string, BookingActionState>;
  onAddNote: (booking: StoredBooking, note: string) => void;
  onAddFollowup: (booking: StoredBooking, title: string, dueAt: string) => void;
  onChangeStatus: (booking: StoredBooking, status: Level4PipelineStatus) => void;
  onComplete: (booking?: StoredBooking) => void;
  onCancel: (booking?: StoredBooking) => void;
  onSelectView: (view: PartnerView) => void;
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const filteredItems = filterPartnerPipelineItems(items, activeFilter);
  const selectedItem = filteredItems.find((item) => item.booking.id === selectedItemId) || filteredItems[0] || null;
  const selectedAction = selectedItem ? actionState[selectedItem.booking.id] : undefined;
  const selectedCanConfirm = selectedItem ? getAppointmentStatusLabel(selectedItem) === "Νέο αίτημα" : false;

  return (
    <section className="min-w-0 space-y-4">
      <div className="partner-panel min-w-0 p-4">
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Ραντεβού</h3>
        <div className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Φίλτρα ραντεβού">
          {pipelineQueueFilters.map((filter) => {
            const active = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => onFilterChange(filter.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-[hsl(var(--sage))]/30 bg-[hsl(var(--sage))]/12 text-[hsl(var(--sage-foreground))]"
                    : "border-[hsl(var(--partner-line))] bg-white/70 text-[hsl(var(--partner-ink))] hover:bg-white"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="partner-panel min-w-0 overflow-hidden p-2">
          {filteredItems.length > 0 ? (
            <div className="grid gap-2">
              {filteredItems.map((item) => {
                const selected = selectedItem?.booking.id === item.booking.id;
                const appointmentStatus = getAppointmentStatusLabel(item);
                const canConfirm = appointmentStatus === "Νέο αίτημα";
                return (
                  <article
                    key={item.booking.id}
                    className={`grid min-w-0 gap-4 rounded-2xl border border-l-4 px-5 py-4 transition hover:bg-white/75 md:grid-cols-[minmax(0,1fr)_auto] ${
                      selected
                        ? "border-[hsl(var(--partner-line))] border-l-[hsl(var(--sage))] bg-[hsl(var(--sage))]/8 shadow-[0_10px_26px_rgba(18,30,44,0.06)]"
                        : "border-[hsl(var(--partner-line))]/70 border-l-[hsl(var(--partner-line))]/70 bg-white/52"
                    }`}
                  >
                    <button type="button" onClick={() => setSelectedItemId(item.booking.id)} className="min-w-0 text-left">
                      <span className="block break-words font-semibold text-[hsl(var(--partner-ink))]">{getDisplayClientName(item.booking)}</span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">{getAppointmentIssue(item.booking)}</span>
                      <span className="mt-3 block text-sm font-semibold leading-6 text-[hsl(var(--partner-ink))]">
                        {item.booking.dateLabel}, {item.booking.time}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                        {item.booking.consultationType} · {item.booking.duration} · {formatEuroCents(item.booking.price * 100)}
                      </span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        <AppointmentBadge tone={getAppointmentStatusTone(item)}>Κατάσταση: {appointmentStatus}</AppointmentBadge>
                        <AppointmentBadge tone={getAppointmentPaymentTone(item.payment)}>Πληρωμή: {getAppointmentPaymentLabel(item.payment)}</AppointmentBadge>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-2 self-end md:self-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl border-[hsl(var(--partner-line))] bg-white/80 px-3 text-xs font-bold"
                        onClick={() => setSelectedItemId(item.booking.id)}
                      >
                        Άνοιγμα
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 rounded-xl px-3 text-xs font-bold"
                        disabled={!canConfirm || actionState[item.booking.id]?.loading}
                        onClick={() => {
                          setSelectedItemId(item.booking.id);
                          onChangeStatus(item.booking, "upcoming");
                        }}
                      >
                        Επιβεβαίωση
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyPartnerState
              icon={CalendarDays}
              title="Δεν υπάρχουν ραντεβού σε αυτή την κατηγορία."
              description="Αλλάξτε καρτέλα ή περιμένετε νέα κράτηση για να εμφανιστεί εδώ."
            />
          )}
        </section>

        <aside className="partner-panel min-w-0 p-4 xl:sticky xl:top-[86px] xl:self-start">
          {selectedItem ? (
            <div className="space-y-3">
              <div>
                <p className="partner-kicker">Άνοιγμα ραντεβού</p>
                <div className="mt-2 flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-semibold text-[hsl(var(--partner-ink))]">{getDisplayClientName(selectedItem.booking)}</h3>
                    <p className="mt-0.5 break-all text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{selectedItem.booking.referenceId}</p>
                  </div>
                  <AppointmentBadge tone={getAppointmentStatusTone(selectedItem)}>{getAppointmentStatusLabel(selectedItem)}</AppointmentBadge>
                </div>
              </div>

              <CaseSection title="Πελάτης" quiet>
                <div className="grid gap-1 text-sm leading-6 text-[hsl(var(--partner-ink))]">
                  <p className="font-semibold">{getDisplayClientName(selectedItem.booking)}</p>
                  <a className="break-all text-muted-foreground" href={`mailto:${selectedItem.booking.clientEmail}`}>
                    {selectedItem.booking.clientEmail || "Δεν δηλώθηκε email"}
                  </a>
                  <a className="break-all text-muted-foreground" href={`tel:${selectedItem.booking.clientPhone}`}>
                    {selectedItem.booking.clientPhone || "Δεν δηλώθηκε τηλέφωνο"}
                  </a>
                </div>
              </CaseSection>

              <CaseSection title="Θέμα" quiet>
                <p className="text-sm leading-6 text-[hsl(var(--partner-ink))]">{getAppointmentIssue(selectedItem.booking)}</p>
              </CaseSection>

              <CaseSection title="Περιγραφή" quiet>
                <p className="text-sm leading-6 text-muted-foreground">{getAppointmentDescription(selectedItem.booking)}</p>
              </CaseSection>

              <CaseSection title="Ραντεβού" quiet>
                <div className="grid gap-1 text-sm leading-6 text-[hsl(var(--partner-ink))]">
                  <p>{selectedItem.booking.dateLabel}, {selectedItem.booking.time}</p>
                  <p>{selectedItem.booking.consultationType}</p>
                  <p>{selectedItem.booking.duration}</p>
                  <p className="font-semibold">{formatEuroCents(selectedItem.booking.price * 100)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <AppointmentBadge tone={getAppointmentStatusTone(selectedItem)}>Κατάσταση: {getAppointmentStatusLabel(selectedItem)}</AppointmentBadge>
                    <AppointmentBadge tone={getAppointmentPaymentTone(selectedItem.payment)}>Πληρωμή: {getAppointmentPaymentLabel(selectedItem.payment)}</AppointmentBadge>
                  </div>
                </div>
              </CaseSection>

              <CaseSection title="Ενέργειες">
                <div className="grid gap-2">
                  <Button
                    type="button"
                    className="h-10 rounded-xl text-sm font-bold"
                    disabled={!selectedCanConfirm || selectedAction?.loading}
                    onClick={() => onChangeStatus(selectedItem.booking, "upcoming")}
                  >
                    Επιβεβαίωση
                  </Button>
                  {selectedItem.booking.clientEmail ? (
                    <Button asChild variant="outline" className="h-10 rounded-xl border-[hsl(var(--partner-line))] bg-white/80 text-sm font-bold">
                      <a href={buildAppointmentMailto(selectedItem.booking, `Πρόταση νέας ώρας για ${selectedItem.booking.referenceId}`, "Προτείνετε νέα ώρα για το ραντεβού σας.")}>Πρόταση νέας ώρας</a>
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" disabled className="h-10 rounded-xl border-[hsl(var(--partner-line))] bg-white/80 text-sm font-bold">
                      Πρόταση νέας ώρας
                    </Button>
                  )}
                  {selectedItem.booking.clientEmail ? (
                    <Button asChild variant="outline" className="h-10 rounded-xl border-[hsl(var(--partner-line))] bg-white/80 text-sm font-bold">
                      <a href={buildAppointmentMailto(selectedItem.booking, `Ραντεβού ${selectedItem.booking.referenceId}`, "")}>Μήνυμα στον πελάτη</a>
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" disabled className="h-10 rounded-xl border-[hsl(var(--partner-line))] bg-white/80 text-sm font-bold">
                      Μήνυμα στον πελάτη
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl border-[hsl(var(--partner-line))] bg-white/80 text-sm font-bold text-[hsl(var(--partner-ink))]"
                    disabled={selectedAction?.loading}
                    onClick={() => onCancel(selectedItem.booking)}
                  >
                    Ακύρωση
                  </Button>
                </div>
              </CaseSection>

              {selectedAction?.message ? <SaveMessage saveState={selectedAction} /> : null}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CalendarDays className="mx-auto h-7 w-7 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-semibold text-[hsl(var(--partner-ink))]">Επιλέξτε ραντεβού</p>
              <p className="mx-auto mt-1 max-w-[260px] text-xs leading-5 text-muted-foreground">Τα στοιχεία πελάτη, θέματος και ενεργειών εμφανίζονται εδώ.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

const AppointmentsView = ({
  bookings,
  documents,
  payments,
  actionState,
  caseActionState,
  onAccept,
  onComplete,
  onCancel,
  onNoShow,
  onConvertToCase,
}: {
  bookings: StoredBooking[];
  documents: StoredBookingDocument[];
  payments: StoredPayment[];
  actionState: Record<string, BookingActionState>;
  caseActionState: Record<string, SaveState>;
  onAccept: (booking?: StoredBooking) => void;
  onComplete: (booking?: StoredBooking) => void;
  onCancel: (booking?: StoredBooking) => void;
  onNoShow: (booking?: StoredBooking) => void;
  onConvertToCase: (booking: StoredBooking) => void;
}) => {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | BookingState>("all");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const getPaymentForBooking = (bookingId: string) => payments.find((payment) => payment.bookingId === bookingId);
  const normalizedQuery = normalizeQualityText(query);
  const fromTime = getDateInputTime(fromDate);
  const toTime = getDateInputTime(toDate);
  const visibleBookings = bookings
    .filter((booking) => {
      const payment = getPaymentForBooking(booking.id);
      const bookingState = getCanonicalBookingState(booking, payment);
      const paymentState = payment ? getCanonicalPaymentState(payment) : null;
      if (statusFilter !== "all" && bookingState !== statusFilter) return false;
      if (!bookingMatchesDateRange(booking, fromTime, toTime)) return false;
      return bookingMatchesQuery(booking, normalizedQuery, paymentState, bookingState);
    })
    .sort(sortBookingsNewestFirst);
  const totalPages = Math.max(1, Math.ceil(visibleBookings.length / appointmentPageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedBookings = visibleBookings.slice((currentPage - 1) * appointmentPageSize, currentPage * appointmentPageSize);
  const scheduledCount = bookings.filter((booking) => isBookingScheduled(booking, getPaymentForBooking(booking.id))).length;
  const completedCount = bookings.filter((booking) => booking.status === "completed").length;
  const reviewCount = bookings.filter((booking) => !isVerifiedBooking(booking)).length;
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) || null;
  const groupedBookings = pagedBookings.reduce<Array<{ dateLabel: string; bookings: StoredBooking[] }>>((groups, booking) => {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup?.dateLabel === booking.dateLabel) {
      currentGroup.bookings.push(booking);
      return groups;
    }

    groups.push({ dateLabel: booking.dateLabel, bookings: [booking] });
    return groups;
  }, []);
  const statusFilters: Array<{ id: "all" | BookingState; label: string }> = [
    { id: "all", label: "Όλα" },
    { id: "pending_confirmation", label: "Νέο αίτημα" },
    { id: "confirmed_unpaid", label: "Πληρωμή σε αναμονή" },
    { id: "confirmed_paid", label: "Επιβεβαιωμένο" },
    { id: "completed", label: "Ολοκληρωμένο" },
    { id: "cancelled", label: "Ακυρωμένο" },
    { id: "no_show", label: "Δεν εμφανίστηκε" },
  ];

  useEffect(() => {
    setPage(1);
  }, [statusFilter, normalizedQuery, fromDate, toDate]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (selectedBookingId && !visibleBookings.some((booking) => booking.id === selectedBookingId)) {
      setSelectedBookingId(null);
    }
  }, [selectedBookingId, visibleBookings]);

  return (
    <section className="space-y-4">
      <section className="partner-panel p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="partner-kicker">Ατζέντα</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Ραντεβού</h3>
          </div>
          <div className="grid grid-cols-4 gap-2 lg:min-w-[460px]">
            <Metric label="Ενεργά" value={String(scheduledCount)} helper="προγραμματισμένα" />
            <Metric label="Κλειστά" value={String(completedCount)} helper="ολοκληρωμένα" />
            <Metric label="Προς έλεγχο" value={String(reviewCount)} helper="μη επιβεβαιωμένα" />
            <Metric label="Έγγραφα" value={String(documents.length)} helper="συνδεδεμένα" />
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {statusFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition",
                statusFilter === filter.id
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-[hsl(var(--partner-line))] bg-white/65 text-muted-foreground hover:bg-white",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(180px,1fr)_155px_155px_auto] lg:items-center">
          <label className="flex h-11 min-w-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-foreground">
            <SearchCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Αναζήτηση πελάτη, τύπου, κωδικού"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Από
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold normal-case tracking-normal text-foreground outline-none"
            />
          </label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Έως
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold normal-case tracking-normal text-foreground outline-none"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={!query && !fromDate && !toDate && statusFilter === "all"}
            onClick={() => {
              setQuery("");
              setFromDate("");
              setToDate("");
              setStatusFilter("all");
            }}
            className="h-11 rounded-lg border-slate-300 bg-white px-3 text-xs font-bold text-foreground hover:bg-primary/5"
          >
            Καθαρισμός
          </Button>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-xs font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Εμφάνιση {visibleBookings.length === 0 ? 0 : (currentPage - 1) * appointmentPageSize + 1}-{Math.min(currentPage * appointmentPageSize, visibleBookings.length)} από {visibleBookings.length} ραντεβού
          </span>
          <span>Σελίδα {currentPage} από {totalPages}</span>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white">
            {pagedBookings.length > 0 ? groupedBookings.map(({ dateLabel, bookings: dateBookings }) => (
              <div key={dateLabel} className="border-b border-[hsl(var(--partner-line))] last:border-b-0">
                <div className="bg-[hsl(var(--partner-ivory))]/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {dateLabel}
                </div>
                <div className="divide-y divide-[hsl(var(--partner-line))]">
                  {dateBookings.map((booking) => {
                    const bookingDocuments = documents.filter((document) => document.bookingId === booking.id);
                    const payment = getPaymentForBooking(booking.id);
                    const bookingState = getCanonicalBookingState(booking, payment);
                    const paymentState = payment ? getCanonicalPaymentState(payment) : null;
                    const selected = selectedBookingId === booking.id;
                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => setSelectedBookingId(booking.id)}
                        className={cn(
                          "grid w-full gap-3 border-l-4 px-3 py-3 text-left transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 lg:grid-cols-[72px_minmax(160px,1fr)_130px_130px_86px_110px] lg:items-center",
                          selected ? "border-l-primary bg-primary/5 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.18)]" : "border-l-transparent bg-white",
                        )}
                      >
                        <span className="font-semibold text-[hsl(var(--partner-ink))]">{booking.time}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[hsl(var(--partner-ink))]">{getDisplayClientName(booking)}</span>
                          <span className="block truncate text-xs text-muted-foreground">{booking.referenceId}</span>
                        </span>
                        <span className="text-sm text-muted-foreground">{booking.consultationType}</span>
                        <StatusPill tone={getPaymentTone(paymentState)}>{paymentState ? partnerPaymentStateLabels[paymentState] : "Καμία πληρωμή"}</StatusPill>
                        <StatusPill tone={getBookingTone(bookingState)}>{partnerBookingStateLabels[bookingState]}</StatusPill>
                        <span className="text-xs font-semibold text-muted-foreground">Έγγραφα: {bookingDocuments.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )) : (
              <EmptyPartnerState
                icon={CalendarDays}
                title={bookings.length > 0 ? "Δεν βρέθηκαν ραντεβού" : "Δεν υπάρχουν πραγματικές κρατήσεις"}
                description={bookings.length > 0 ? "Αλλάξτε status, αναζήτηση ή εύρος ημερομηνίας." : "Οι νέες κρατήσεις θα εμφανίζονται εδώ μόλις περάσουν τον έλεγχο κράτησης."}
              />
            )}
          </div>

          <aside className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/55 p-4 xl:sticky xl:top-[96px] xl:self-start">
            {selectedBooking ? (() => {
              const bookingDocuments = documents.filter((document) => document.bookingId === selectedBooking.id);
              const currentAction = actionState[selectedBooking.id];
              const payment = getPaymentForBooking(selectedBooking.id);
              const bookingState = getCanonicalBookingState(selectedBooking, payment);
              const paymentState = payment ? getCanonicalPaymentState(payment) : null;
              const verified = isVerifiedBooking(selectedBooking);
              const canMarkComplete = bookingState === "confirmed_paid";
              const scheduled = isBookingScheduled(selectedBooking, payment);
              const currentCaseAction = caseActionState[selectedBooking.id];
              const canAccept = bookingState === "pending_confirmation" && verified;
              const canConvertToCase = bookingState === "confirmed_paid" || bookingState === "completed" || paymentState === "paid";
              const hasClientEmail = Boolean(selectedBooking.clientEmail);

              return (
                <div className="space-y-4">
                  <div>
                    <p className="partner-kicker">Λεπτομέρειες ραντεβού</p>
                    <h4 className="mt-1 text-lg font-semibold text-[hsl(var(--partner-ink))]">{getDisplayClientName(selectedBooking)}</h4>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{selectedBooking.issueSummary || "Δεν έχει προστεθεί περιγραφή υπόθεσης από τον πελάτη."}</p>
                  </div>

                  <div className="grid gap-2">
                    <SignalRow icon={PhoneCall} label="Τηλέφωνο" value={selectedBooking.clientPhone || "Δεν δηλώθηκε"} tone="neutral" />
                    <SignalRow icon={MailCheck} label="Email" value={selectedBooking.clientEmail || "Δεν δηλώθηκε"} tone="neutral" />
                    <SignalRow icon={WalletCards} label="Αμοιβή συμβουλευτικής" value={formatEuroCents(selectedBooking.price * 100)} tone={getPaymentTone(paymentState)} />
                  </div>

                  <div className="rounded-xl border border-[hsl(var(--partner-line))] bg-white/70 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--partner-ink))]">
                      <FileText className="h-4 w-4" />
                      Έγγραφα υπόθεσης ({bookingDocuments.length})
                    </p>
                    <div className="mt-2 grid gap-2">
                      {bookingDocuments.length > 0 ? bookingDocuments.map((document) => (
                        <a
                          key={document.id}
                          href={document.downloadUrl || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className={`truncate rounded-lg border border-[hsl(var(--partner-line))] bg-white/80 px-3 py-2 text-xs font-semibold ${
                            document.downloadUrl ? "text-[hsl(var(--partner-ink))]" : "pointer-events-none text-muted-foreground"
                          }`}
                        >
                          {document.name}
                        </a>
                      )) : (
                        <p className="text-xs leading-5 text-muted-foreground">Δεν έχουν ανέβει έγγραφα για την υπόθεση.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[hsl(var(--partner-line))] bg-white/70 p-3">
                    <p className="partner-kicker">Ενέργειες</p>
                    <div className="mt-3 grid gap-2">
                      <Button
                        type="button"
                        onClick={() => onAccept(selectedBooking)}
                        disabled={!canAccept || currentAction?.loading}
                        title={!canAccept ? "Η αποδοχή είναι διαθέσιμη μόνο σε νέο επιβεβαιωμένο αίτημα." : undefined}
                        className="h-10 rounded-xl text-sm font-bold"
                      >
                        Αποδοχή
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onCancel(selectedBooking)}
                        disabled={!scheduled || currentAction?.loading}
                        title={!scheduled ? "Η απόρριψη είναι διαθέσιμη μόνο σε ενεργό ραντεβού." : undefined}
                        className={scheduled ? dangerAppointmentActionClassName : disabledAppointmentActionClassName}
                      >
                        Απόρριψη
                      </Button>
                      {hasClientEmail ? (
                        <Button asChild variant="outline" className={secondaryAppointmentActionClassName}>
                          <a href={buildAppointmentMailto(selectedBooking, `Πρόταση νέας ώρας για ${selectedBooking.referenceId}`, "Προτείνετε νέα ώρα για το ραντεβού σας.")}>Πρόταση νέας ώρας</a>
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" disabled className={disabledAppointmentActionClassName}>
                          Πρόταση νέας ώρας
                        </Button>
                      )}
                      {hasClientEmail ? (
                        <Button asChild variant="outline" className={secondaryAppointmentActionClassName}>
                          <a href={buildAppointmentMailto(selectedBooking, `Ραντεβού ${selectedBooking.referenceId}`, "")}>Μήνυμα στον πελάτη</a>
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" disabled className={disabledAppointmentActionClassName}>
                          Μήνυμα στον πελάτη
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onConvertToCase(selectedBooking)}
                        disabled={!canConvertToCase || currentCaseAction?.loading}
                        title={!canConvertToCase ? "Η μετατροπή σε υπόθεση ανοίγει μετά από επιβεβαιωμένη ή πληρωμένη κράτηση." : undefined}
                        className={canConvertToCase ? secondaryAppointmentActionClassName : disabledAppointmentActionClassName}
                      >
                        Μετατροπή σε υπόθεση
                      </Button>
                    </div>
                    {!hasClientEmail ? (
                      <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">
                        Δεν υπάρχει email πελάτη, οπότε οι ενέργειες μηνύματος μένουν ανενεργές.
                      </p>
                    ) : null}
                    {currentCaseAction?.message ? (
                      <div className="mt-3">
                        <SaveMessage saveState={currentCaseAction} />
                      </div>
                    ) : null}
                  </div>

                  {scheduled && verified ? (
                    <div className="grid gap-2">
                      <Button type="button" onClick={() => onComplete(selectedBooking)} disabled={currentAction?.loading || !canMarkComplete} className="h-10 rounded-xl text-sm font-bold">
                        {canMarkComplete ? "Σήμανση ολοκλήρωσης" : "Αναμονή πληρωμής"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onNoShow(selectedBooking)}
                        disabled={currentAction?.loading}
                        className={secondaryAppointmentActionClassName}
                      >
                        Δεν εμφανίστηκε
                      </Button>
                    </div>
                  ) : scheduled && !verified ? (
                    <p className="rounded-xl border border-border bg-secondary/45 px-3 py-2 text-xs font-semibold leading-5 text-foreground">
                      Περιμένετε επιβεβαίωση συστήματος πριν σημάνετε ολοκλήρωση.
                    </p>
                  ) : null}

                  {currentAction?.message ? <SaveMessage saveState={currentAction} /> : null}
                </div>
              );
            })() : (
              <div className="py-8 text-center">
                <CalendarCheck2 className="mx-auto h-7 w-7 text-muted-foreground/60" />
                <p className="mt-3 text-sm font-semibold text-[hsl(var(--partner-ink))]">Επιλέξτε ραντεβού</p>
                <p className="mx-auto mt-1 max-w-[250px] text-xs leading-5 text-muted-foreground">Τα στοιχεία πελάτη, έγγραφα και ενέργειες εμφανίζονται εδώ.</p>
              </div>
            )}
          </aside>
        </div>

        {visibleBookings.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-3 text-xs font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {visibleBookings.length > appointmentPageSize
                ? `${visibleBookings.length} αποτελέσματα με σελιδοποίηση`
                : `${visibleBookings.length} αποτελέσματα`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="h-9 rounded-lg border-slate-300 bg-white px-3 text-xs font-bold text-foreground hover:bg-primary/5"
              >
                Προηγούμενη
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                className="h-9 rounded-lg border-slate-300 bg-white px-3 text-xs font-bold text-foreground hover:bg-primary/5"
              >
                Επόμενη
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
};

const consultationModeOptions: ConsultationMode[] = ["video", "phone", "inPerson"];

const appointmentPageSize = 8;

const getDateInputTime = (value: string) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
};

const bookingMatchesDateRange = (booking: StoredBooking, fromTime: number | null, toTime: number | null) => {
  if (fromTime === null && toTime === null) return true;
  const bookingTime = getBookingDateTime(booking);
  if (bookingTime === null) return false;
  if (fromTime !== null && bookingTime < fromTime) return false;
  if (toTime !== null && bookingTime > toTime + 86_399_999) return false;
  return true;
};

const bookingMatchesQuery = (
  booking: StoredBooking,
  query: string,
  paymentState: PaymentState | null,
  bookingState: BookingState,
) => {
  if (!query) return true;
  const searchText = normalizeQualityText([
    getDisplayClientName(booking),
    booking.clientName,
    booking.referenceId,
    booking.consultationType,
    booking.consultationMode,
    booking.dateLabel,
    booking.dateIso,
    booking.time,
    booking.clientEmail,
    booking.clientPhone,
    booking.issueSummary,
    paymentState ? partnerPaymentStateLabels[paymentState] : "",
    partnerBookingStateLabels[bookingState],
  ].filter(Boolean).join(" "));
  return searchText.includes(query);
};

const secondaryAppointmentActionClassName =
  "h-10 rounded-xl border-slate-300 bg-white text-sm font-bold text-foreground shadow-sm hover:border-primary/40 hover:bg-primary/5";

const dangerAppointmentActionClassName =
  "h-10 rounded-xl border-red-300 bg-white text-sm font-bold text-red-800 shadow-sm hover:bg-red-50";

const disabledAppointmentActionClassName =
  "h-10 rounded-xl border-slate-200 bg-slate-50 text-sm font-bold text-slate-500";

const ProfileView = ({
  workspace,
  searchVisibility,
  reviews,
  reviewActionState,
  updateProfile,
  onReplyChange,
  onSaveReply,
  onSave,
  hasUnsavedChanges,
  saveState,
}: {
  workspace: PartnerWorkspace;
  searchVisibility: { loading: boolean; ready: boolean; issues: string[] };
  reviews: StoredLawyerReview[];
  reviewActionState: Record<string, SaveState>;
  updateProfile: (updates: Partial<PartnerWorkspace["profile"]>) => void;
  onReplyChange: (reviewId: string, reply: string) => void;
  onSaveReply: (review: StoredLawyerReview) => void;
  onSave: () => void;
  hasUnsavedChanges: boolean;
  saveState: SaveState;
}) => {
  const updateList = (key: "specialties" | "languages", value: string) => {
    const values = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    updateProfile({ [key]: Array.from(new Set(values)) } as Partial<PartnerWorkspace["profile"]>);
  };

  const toggleSpecialty = (specialty: string) => {
    const selected = workspace.profile.specialties.includes(specialty);
    const specialties = selected
      ? workspace.profile.specialties.filter((item) => item !== specialty)
      : [...workspace.profile.specialties, specialty];
    updateProfile({
      specialties,
      primarySpecialty: specialties.includes(workspace.profile.primarySpecialty)
        ? workspace.profile.primarySpecialty
        : specialties[0] || workspace.profile.primarySpecialty,
    });
  };

  const toggleConsultationMode = (mode: ConsultationMode) => {
    const selected = workspace.profile.consultationModes.includes(mode);
    const consultationModes = selected
      ? workspace.profile.consultationModes.filter((item) => item !== mode)
      : [...workspace.profile.consultationModes, mode];
    updateProfile({ consultationModes });
  };

  return (
    <section className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-lg border border-border bg-card p-4 shadow-lg shadow-foreground/[0.03]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Δημόσια καταχώριση</p>
              <h3 className="mt-1 font-serif text-xl tracking-tight text-foreground">Στοιχεία που βλέπει ο πελάτης</h3>
            </div>
            <Button asChild variant="outline" className="h-10 rounded-lg font-bold">
              <Link to={`/lawyer/${workspace.profile.lawyerId}`}>
                <Eye className="mr-2 h-4 w-4" />
                Προεπισκόπηση
              </Link>
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Εμφανιζόμενο όνομα">
              <input className="partner-input h-10" value={workspace.profile.displayName} onChange={(event) => updateProfile({ displayName: event.target.value })} />
            </Field>
            <Field label="Γραφείο">
              <input className="partner-input h-10" value={workspace.profile.officeName} onChange={(event) => updateProfile({ officeName: event.target.value })} />
            </Field>
            <Field label="Πόλη">
              <select className="partner-input h-10" value={workspace.profile.city} onChange={(event) => updateProfile({ city: event.target.value })}>
                {allowedMarketplaceCityNames.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </Field>
            <Field label="Περιοχή εξυπηρέτησης">
              <input className="partner-input h-10" value={workspace.profile.serviceArea} onChange={(event) => updateProfile({ serviceArea: event.target.value })} />
            </Field>
            <Field label="Κύρια ειδικότητα">
              <select className="partner-input h-10" value={workspace.profile.primarySpecialty} onChange={(event) => updateProfile({ primarySpecialty: event.target.value })}>
                {legalPracticeAreaLabels.map((specialty) => <option key={specialty} value={specialty}>{specialty}</option>)}
              </select>
            </Field>
            <Field label="Γλώσσες">
              <input className="partner-input h-10" value={workspace.profile.languages.join(", ")} onChange={(event) => updateList("languages", event.target.value)} />
            </Field>
          </div>

          <Field label="Σε ποιες υποθέσεις βοηθάτε καλύτερα">
            <textarea
              className="partner-textarea min-h-[5.25rem]"
              rows={3}
              value={workspace.profile.bestFor}
              onChange={(event) => updateProfile({ bestFor: event.target.value })}
            />
          </Field>
          <Field label="Επαγγελματική περιγραφή">
            <textarea className="partner-textarea min-h-28" value={workspace.profile.bio} onChange={(event) => updateProfile({ bio: event.target.value })} />
          </Field>

          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Δημόσιες κατηγορίες</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {legalPracticeAreaLabels.map((specialty) => {
                const selected = workspace.profile.specialties.includes(specialty);
                return (
                  <button
                    key={specialty}
                    type="button"
                    onClick={() => toggleSpecialty(specialty)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                      selected ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-secondary/35 text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {specialty}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-border bg-card p-4 shadow-lg shadow-foreground/[0.03]">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Ποιότητα καταχώρισης</p>
            <h3 className="mt-1 font-serif text-xl tracking-tight text-foreground">
              {searchVisibility.loading ? "Έλεγχος..." : searchVisibility.ready ? "Έτοιμη για αναζήτηση" : "Θέλει συμπλήρωση"}
            </h3>
            <div className="mt-3 space-y-2">
              {searchVisibility.issues.length > 0 ? searchVisibility.issues.map((issue) => (
                <p key={issue} className="rounded-lg border border-border bg-secondary/45 px-3 py-2 text-xs font-semibold leading-5 text-foreground">{issue}</p>
              )) : (
                <p className="rounded-lg border border-sage/25 bg-sage/10 px-3 py-2 text-xs font-semibold leading-5 text-sage-foreground">
                  Το προφίλ έχει τα βασικά στοιχεία, τιμές και διαθέσιμη καταχώριση.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-lg shadow-foreground/[0.03]">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Τρόποι συμβουλευτικής</p>
            <div className="mt-3 space-y-3">
              {consultationModeOptions.map((mode) => {
                const priceKey = `${mode}Price` as "videoPrice" | "phonePrice" | "inPersonPrice";
                const descriptionKey = `${mode}Description` as "videoDescription" | "phoneDescription" | "inPersonDescription";
                const selected = workspace.profile.consultationModes.includes(mode);
                return (
                  <div key={mode} className="rounded-lg border border-border bg-secondary/35 p-3">
                    <label className="flex items-center justify-between gap-3 text-sm font-bold text-foreground">
                      <span>{consultationModeLabels[mode]}</span>
                      <input type="checkbox" checked={selected} onChange={() => toggleConsultationMode(mode)} />
                    </label>
                    <div className="mt-3 grid gap-2">
                      <input
                        type="number"
                        min={minimumConsultationPrices[mode]}
                        className="partner-input h-10"
                        value={workspace.profile[priceKey]}
                        onChange={(event) => updateProfile({ [priceKey]: Number(event.target.value) } as Partial<PartnerWorkspace["profile"]>)}
                      />
                      <input
                        className="partner-input h-10"
                        value={workspace.profile[descriptionKey]}
                        onChange={(event) => updateProfile({ [descriptionKey]: event.target.value } as Partial<PartnerWorkspace["profile"]>)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      <SectionSaveFooter onSave={onSave} saveState={saveState} hasUnsavedChanges={hasUnsavedChanges} />

      <ReviewsView
        reviews={reviews}
        actionState={reviewActionState}
        onReplyChange={onReplyChange}
        onSaveReply={onSaveReply}
      />
    </section>
  );
};

const SignupAvailabilityView = ({
  workspace,
  updateAvailability,
  upsertTimeOff,
  removeTimeOff,
  calendarConnections,
  calendarActionState,
  onConnectCalendar,
  onDisconnectCalendar,
  updateProfile,
  onSave,
  hasUnsavedChanges,
  saveState,
}: {
  workspace: PartnerWorkspace;
  updateAvailability: (day: string, updates: Partial<PartnerAvailabilitySlot>) => void;
  upsertTimeOff: (updates: { id?: string; startDate: string; endDate: string; label: string }) => void;
  removeTimeOff: (id: string) => void;
  calendarConnections: PartnerCalendarConnection[];
  calendarActionState: SaveState;
  onConnectCalendar: (provider: PartnerCalendarProvider) => void;
  onDisconnectCalendar: (provider: PartnerCalendarProvider) => void;
  updateProfile: (updates: Partial<PartnerWorkspace["profile"]>) => void;
  onSave: () => void;
  hasUnsavedChanges: boolean;
  saveState: SaveState;
}) => {
  const sessionDuration = normalizeSessionDurationMinutes(workspace.profile.sessionDurationMinutes);
  const enabledSlots = workspace.availability.filter((slot) => slot.enabled && validateAvailabilitySlot(slot, sessionDuration).valid);
  const coverageTone: DashboardTone = enabledSlots.length >= 4 ? "sage" : enabledSlots.length >= 2 ? "amber" : "neutral";
  const invalidSlots = workspace.availability.filter((slot) => slot.enabled && !validateAvailabilitySlot(slot, sessionDuration).valid);
  const [timeOffDraft, setTimeOffDraft] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    label: "Άδεια / διακοπές",
  });

  return (
    <section className="space-y-4">
      <div className="partner-panel p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="partner-kicker">Διαθεσιμότητα αναζήτησης</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Πρόγραμμα κρατήσεων</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Το ίδιο μοντέλο που συμπληρώνεται στην αίτηση συνεργάτη. Χρειάζονται τουλάχιστον τρεις ενεργές ημέρες και ώρες μόνο {availabilityBusinessHours.start}-{availabilityBusinessHours.end}.
            </p>
          </div>
          <StatusPill tone={coverageTone}>{enabledSlots.length}/7 ημέρες ενεργές</StatusPill>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <NumberField
            label="Διάρκεια ραντεβού"
            value={sessionDuration}
            suffix="λεπτά"
            min={20}
            step={1}
            onChange={(sessionDurationMinutes) => updateProfile({ sessionDurationMinutes: normalizeSessionDurationMinutes(sessionDurationMinutes) })}
          />
          <NumberField
            label="Χρόνος κενού"
            value={workspace.profile.bufferMinutes}
            suffix="λεπτά"
            min={0}
            step={1}
            onChange={(bufferMinutes) => updateProfile({ bufferMinutes: Math.max(0, bufferMinutes || 0) })}
          />
          <NumberField
            label="Παράθυρο κρατήσεων"
            value={workspace.profile.bookingWindowDays}
            suffix="ημέρες"
            min={1}
            step={1}
            onChange={(bookingWindowDays) => updateProfile({ bookingWindowDays: Math.max(1, bookingWindowDays || 1) })}
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[hsl(var(--partner-line))] bg-white/58">
          <div className="hidden grid-cols-[132px_120px_120px_minmax(0,1fr)] gap-3 border-b border-[hsl(var(--partner-line))] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground md:grid">
            <span>Ημέρα</span>
            <span>Από</span>
            <span>Έως</span>
            <span>Σημείωση</span>
          </div>

          <div className="divide-y divide-[hsl(var(--partner-line))]">
            {workspace.availability.map((slot) => {
              const validation = validateAvailabilitySlot(slot, sessionDuration);
              const invalidTime = slot.enabled && !validation.valid;

              return (
                <div key={slot.day} className={`px-3 py-3 transition ${slot.enabled ? "bg-white/70" : "bg-white/35"}`}>
                  <div className="grid gap-3 md:grid-cols-[132px_120px_120px_minmax(0,1fr)] md:items-center">
                    <button
                      type="button"
                      onClick={() => updateAvailability(slot.day, { enabled: !slot.enabled })}
                      className={`inline-flex h-10 w-full items-center justify-center rounded-full border px-3 text-sm font-bold transition ${
                        slot.enabled
                          ? "border-[hsl(var(--sage))]/25 bg-[hsl(var(--sage))]/10 text-[hsl(var(--sage-foreground))]"
                          : "border-[hsl(var(--partner-line))] bg-white/70 text-muted-foreground"
                      }`}
                    >
                      {slot.day}
                    </button>
                    <input
                      type="time"
                      min={availabilityBusinessHours.start}
                      max={availabilityBusinessHours.end}
                      step={60}
                      disabled={!slot.enabled}
                      className={`partner-input h-11 ${!slot.enabled ? "opacity-45" : ""}`}
                      value={slot.enabled ? slot.start : ""}
                      onChange={(event) => updateAvailability(slot.day, { start: event.target.value })}
                      placeholder={slot.enabled ? availabilityBusinessHours.start : "Κλειστή"}
                      aria-label={`${slot.day} ώρα έναρξης`}
                    />
                    <input
                      type="time"
                      min={availabilityBusinessHours.start}
                      max={availabilityBusinessHours.end}
                      step={60}
                      disabled={!slot.enabled}
                      className={`partner-input h-11 ${!slot.enabled ? "opacity-45" : ""} ${invalidTime ? "border-destructive/35 bg-destructive/5" : ""}`}
                      value={slot.enabled ? slot.end : ""}
                      onChange={(event) => updateAvailability(slot.day, { end: event.target.value })}
                      placeholder={slot.enabled ? availabilityBusinessHours.end : "Κλειστή"}
                      aria-label={`${slot.day} ώρα λήξης`}
                    />
                    <input
                      disabled={!slot.enabled}
                      className={`partner-input h-11 ${!slot.enabled ? "opacity-45" : ""}`}
                      value={slot.enabled ? slot.note : ""}
                      onChange={(event) => updateAvailability(slot.day, { note: event.target.value })}
                      placeholder={slot.enabled ? "Σημείωση" : "Κλειστή ημέρα"}
                      aria-label={`${slot.day} σημείωση προγράμματος`}
                    />
                  </div>
                  {invalidTime ? (
                    <p className="mt-2 text-xs font-semibold text-foreground">
                      {getAvailabilityValidationMessage(validation, sessionDuration)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {enabledSlots.length < 3 || invalidSlots.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-border bg-secondary/45 px-3 py-3 text-sm font-semibold leading-6 text-foreground">
            {invalidSlots.length > 0
              ? getAvailabilityValidationMessage(validateAvailabilitySlot(invalidSlots[0], sessionDuration), sessionDuration)
              : "Χρειάζονται τουλάχιστον τρεις ενεργές ημέρες για να εμφανίζεται σωστά η καταχώριση στην αναζήτηση."}
          </div>
        ) : (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <SignalRow icon={Clock3} label="Κάλυψη" value={`${enabledSlots.length} ημέρες`} tone={coverageTone} />
            <SignalRow icon={TimerReset} label="Χρόνος κενού" value={`${workspace.profile.bufferMinutes} λεπτά`} tone={workspace.profile.bufferMinutes <= 30 ? "sage" : "amber"} />
            <SignalRow icon={CalendarClock} label="Παράθυρο κρατήσεων" value={`${workspace.profile.bookingWindowDays} ημέρες`} tone={workspace.profile.bookingWindowDays >= 14 ? "sage" : "amber"} />
          </div>
        )}
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="partner-panel p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="partner-kicker">Ημέρες εκτός διαθεσιμότητας</p>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Άδειες και διακοπές</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Οι ημερομηνίες αυτές αφαιρούνται από τις διαθέσιμες ώρες της δημόσιας κράτησης.
              </p>
            </div>
            <StatusPill tone="neutral">{workspace.timeOff.length} περίοδοι</StatusPill>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[150px_150px_minmax(0,1fr)_auto] md:items-end">
            <Field label="Από">
              <input
                type="date"
                className="partner-input h-10"
                value={timeOffDraft.startDate}
                onChange={(event) => setTimeOffDraft((current) => ({ ...current, startDate: event.target.value }))}
              />
            </Field>
            <Field label="Έως">
              <input
                type="date"
                className="partner-input h-10"
                value={timeOffDraft.endDate}
                onChange={(event) => setTimeOffDraft((current) => ({ ...current, endDate: event.target.value }))}
              />
            </Field>
            <Field label="Σημείωση">
              <input
                className="partner-input h-10"
                value={timeOffDraft.label}
                onChange={(event) => setTimeOffDraft((current) => ({ ...current, label: event.target.value }))}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-border bg-card font-bold"
              onClick={() => upsertTimeOff(timeOffDraft)}
            >
              Προσθήκη
            </Button>
          </div>

          <div className="mt-4 divide-y divide-[hsl(var(--partner-line))] overflow-hidden rounded-2xl border border-[hsl(var(--partner-line))] bg-white/55">
            {workspace.timeOff.length > 0 ? workspace.timeOff.map((item) => (
              <div key={item.id} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="font-semibold text-[hsl(var(--partner-ink))]">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.startDate} έως {item.endDate}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl border-border bg-card text-xs font-bold"
                  onClick={() => removeTimeOff(item.id)}
                >
                  Αφαίρεση
                </Button>
              </div>
            )) : (
              <p className="px-3 py-4 text-sm font-semibold text-muted-foreground">Δεν έχουν δηλωθεί άδειες ή κλειστές ημερομηνίες.</p>
            )}
          </div>
        </div>

        <aside className="partner-panel p-4">
          <p className="partner-kicker">Συγχρονισμός ημερολογίου</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Google Calendar</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Η σύνδεση είναι read-only για busy/free έλεγχο και δεν δημιουργεί events στο εξωτερικό ημερολόγιο.
          </p>

          <div className="mt-4 grid gap-2">
            {(["google"] as PartnerCalendarProvider[]).map((provider) => {
              const connection = calendarConnections.find((item) => item.provider === provider);
              const connected = connection?.status === "connected";
              return (
                <div key={provider} className="rounded-xl border border-[hsl(var(--partner-line))] bg-white/65 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[hsl(var(--partner-ink))]">Google Calendar</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {connected
                          ? connection.providerAccountEmail || "Συνδεδεμένο ημερολόγιο"
                          : connection?.status === "error"
                            ? connection.lastError || "Χρειάζεται επανασύνδεση"
                            : "Δεν έχει συνδεθεί"}
                      </p>
                    </div>
                    <StatusPill tone={connected ? "sage" : "neutral"}>{connected ? "Συνδεδεμένο" : "Ανενεργό"}</StatusPill>
                  </div>
                  <div className="mt-3">
                    {connected ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl border-border bg-card text-xs font-bold"
                        onClick={() => onDisconnectCalendar(provider)}
                        disabled={calendarActionState.loading}
                      >
                        Αποσύνδεση
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl border-border bg-card text-xs font-bold"
                        onClick={() => onConnectCalendar(provider)}
                        disabled={calendarActionState.loading}
                      >
                        Σύνδεση
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {calendarActionState.message ? (
            <div className="mt-3">
              <SaveMessage saveState={calendarActionState} />
            </div>
          ) : null}
        </aside>
      </section>

      <SectionSaveFooter onSave={onSave} saveState={saveState} hasUnsavedChanges={hasUnsavedChanges} />
    </section>
  );
};

const partnerCaseStatusLabels: Record<PartnerCaseStatus, string> = {
  new: "Νέα",
  in_progress: "Σε εξέλιξη",
  waiting_documents: "Αναμονή εγγράφων",
  waiting_client: "Αναμονή πελάτη",
  completed: "Ολοκληρωμένη",
  archived: "Αρχειοθετημένη",
};

const partnerCaseStatusOptions = Object.entries(partnerCaseStatusLabels) as Array<[PartnerCaseStatus, string]>;

const CasesPaymentsView = ({
  cases,
  bookings,
  payments,
  documents,
  notes,
  history,
  actionState,
  completedRevenueCents,
  pendingRevenueCents,
  completedPlatformFeeCents,
  onSaveCase,
  onAddNote,
  onSelectAppointments,
}: {
  cases: PartnerCase[];
  bookings: StoredBooking[];
  payments: StoredPayment[];
  documents: StoredBookingDocument[];
  notes: PartnerCasePrivateNote[];
  history: PartnerCaseHistoryEvent[];
  actionState: Record<string, SaveState>;
  completedRevenueCents: number;
  pendingRevenueCents: number;
  completedPlatformFeeCents: number;
  onSaveCase: (
    partnerCase: PartnerCase,
    updates: Partial<Pick<PartnerCase, "title" | "practiceArea" | "status" | "nextStep">>,
  ) => void;
  onAddNote: (partnerCase: PartnerCase, note: string) => void;
  onSelectAppointments: () => void;
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(cases[0]?.id || null);
  const selectedCase = cases.find((item) => item.id === selectedCaseId) || cases[0] || null;
  const [draft, setDraft] = useState({
    title: selectedCase?.title || "",
    practiceArea: selectedCase?.practiceArea || "",
    status: selectedCase?.status || "new" as PartnerCaseStatus,
    nextStep: selectedCase?.nextStep || "",
  });
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    if (!selectedCase) return;
    setDraft({
      title: selectedCase.title,
      practiceArea: selectedCase.practiceArea,
      status: selectedCase.status,
      nextStep: selectedCase.nextStep,
    });
    setNoteDraft("");
  }, [selectedCase]);

  const getCaseBookings = (partnerCase: PartnerCase) =>
    bookings.filter((booking) => partnerCase.bookingIds.includes(booking.id) || partnerCase.sourceBookingId === booking.id);
  const getBookingPayment = (bookingId: string) => payments.find((payment) => payment.bookingId === bookingId);
  const selectedBookings = selectedCase ? getCaseBookings(selectedCase) : [];
  const selectedBookingIds = new Set(selectedBookings.map((booking) => booking.id));
  const selectedPayments = payments.filter((payment) => selectedBookingIds.has(payment.bookingId));
  const selectedDocuments = documents.filter((document) => document.bookingId && selectedBookingIds.has(document.bookingId));
  const selectedNotes = selectedCase ? notes.filter((note) => note.caseId === selectedCase.id) : [];
  const selectedHistory = selectedCase ? history.filter((event) => event.caseId === selectedCase.id) : [];
  const selectedTotalCents = selectedPayments.reduce((sum, payment) => sum + getPartnerNetCents(payment), 0);
  const selectedAction = selectedCase ? actionState[selectedCase.id] : undefined;

  return (
    <section className="space-y-4">
      <div className="grid gap-2 md:grid-cols-4">
        <Metric label="Συνολικά έσοδα" value={formatEuroCents(completedRevenueCents)} helper="καθαρό πληρωμένο ποσό" />
        <Metric label="Σε αναμονή" value={formatEuroCents(pendingRevenueCents)} helper="κρατήσεις / εκκαθάριση" />
        <Metric label="Προμήθεια πλατφόρμας" value={formatEuroCents(completedPlatformFeeCents)} helper="μέχρι σήμερα" />
        <Metric label="Ενεργές υποθέσεις" value={String(cases.filter((item) => !["completed", "archived"].includes(item.status)).length)} helper={`${cases.length} συνολικά`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
        <section className="partner-panel min-w-0 overflow-hidden p-0">
          <div className="border-b border-[hsl(var(--partner-line))] p-4">
            <p className="partner-kicker">Υποθέσεις πραγματικής συνεργασίας</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Υποθέσεις</h3>
          </div>
          <div className="divide-y divide-[hsl(var(--partner-line))]">
            {cases.length > 0 ? cases.map((partnerCase) => {
              const caseBookings = getCaseBookings(partnerCase);
              const selected = selectedCase?.id === partnerCase.id;
              return (
                <button
                  key={partnerCase.id}
                  type="button"
                  onClick={() => setSelectedCaseId(partnerCase.id)}
                  className={cn(
                    "grid w-full gap-2 px-4 py-3 text-left transition hover:bg-white/65",
                    selected ? "bg-white/80" : "bg-white/35",
                  )}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[hsl(var(--partner-ink))]">{partnerCase.title}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{getDisplayPersonName(partnerCase.clientName, partnerCase.id)} · {partnerCase.practiceArea}</p>
                    </div>
                    <StatusPill tone={partnerCase.status === "completed" ? "sage" : "neutral"}>
                      {partnerCaseStatusLabels[partnerCase.status]}
                    </StatusPill>
                  </div>
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {caseBookings.length} σχετικά ραντεβού · {partnerCase.nextStep || "Δεν έχει οριστεί επόμενο βήμα"}
                  </p>
                </button>
              );
            }) : (
              <div className="p-4">
                <EmptyPartnerState
                  icon={FileText}
                  title="Δεν υπάρχουν υποθέσεις ακόμη"
                  description="Μετατρέψτε ένα πληρωμένο ή ολοκληρωμένο ραντεβού σε υπόθεση όταν ξεκινήσει πραγματική συνεργασία."
                />
                <Button type="button" className="mt-4 h-10 rounded-xl font-bold" onClick={onSelectAppointments}>
                  Άνοιγμα ραντεβού
                </Button>
              </div>
            )}
          </div>
        </section>

        <aside className="partner-panel min-w-0 p-4">
          {selectedCase ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="partner-kicker">Φάκελος υπόθεσης</p>
                  <h3 className="mt-1 break-words text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">{selectedCase.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{getDisplayPersonName(selectedCase.clientName, selectedCase.id)}{selectedCase.clientEmail ? ` · ${selectedCase.clientEmail}` : ""}</p>
                </div>
                <StatusPill tone={selectedCase.status === "completed" ? "sage" : "neutral"}>{partnerCaseStatusLabels[selectedCase.status]}</StatusPill>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Τίτλος υπόθεσης">
                  <input className="partner-input h-10" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
                </Field>
                <Field label="Τομέας δικαίου">
                  <input className="partner-input h-10" value={draft.practiceArea} onChange={(event) => setDraft((current) => ({ ...current, practiceArea: event.target.value }))} />
                </Field>
                <Field label="Status υπόθεσης">
                  <select className="partner-input h-10" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as PartnerCaseStatus }))}>
                    {partnerCaseStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Επόμενο βήμα">
                  <input className="partner-input h-10" value={draft.nextStep} onChange={(event) => setDraft((current) => ({ ...current, nextStep: event.target.value }))} />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="h-10 rounded-xl font-bold"
                  disabled={selectedAction?.loading}
                  onClick={() => onSaveCase(selectedCase, draft)}
                >
                  Αποθήκευση υπόθεσης
                </Button>
              </div>
              {selectedAction?.message ? <SaveMessage saveState={selectedAction} /> : null}

              <CaseSection title="Σχετικά ραντεβού και πληρωμές" quiet>
                <div className="grid gap-2">
                  {selectedBookings.length > 0 ? selectedBookings.map((booking) => {
                    const payment = getBookingPayment(booking.id);
                    const paymentState = getCanonicalPaymentState(payment);
                    return (
                      <div key={booking.id} className="rounded-xl border border-[hsl(var(--partner-line))] bg-white/70 p-3">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_130px_120px] lg:items-center">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[hsl(var(--partner-ink))]">{booking.consultationType}</p>
                            <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{booking.dateLabel} · {booking.time} · {booking.referenceId}</p>
                          </div>
                          <StatusPill tone={paymentState === "paid" ? "sage" : "neutral"}>{partnerPaymentStateLabels[paymentState]}</StatusPill>
                          <p className="text-right text-sm font-bold text-[hsl(var(--partner-ink))]">{formatEuroCents(getPartnerNetCents(payment, booking))}</p>
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="text-sm font-semibold text-muted-foreground">Δεν υπάρχουν συνδεδεμένα ραντεβού.</p>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-[hsl(var(--partner-ink))]">
                  <span>Σύνολο υπόθεσης: {formatEuroCents(selectedTotalCents)}</span>
                  <span>Έγγραφα: {selectedDocuments.length}</span>
                </div>
              </CaseSection>

              <CaseSection title="Αρχεία / έγγραφα" quiet>
                <div className="grid gap-2">
                  {selectedDocuments.length > 0 ? selectedDocuments.map((document) => (
                    <a
                      key={document.id}
                      href={document.downloadUrl || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "truncate rounded-lg border border-[hsl(var(--partner-line))] bg-white/80 px-3 py-2 text-xs font-semibold",
                        document.downloadUrl ? "text-[hsl(var(--partner-ink))]" : "pointer-events-none text-muted-foreground",
                      )}
                    >
                      {document.name}
                    </a>
                  )) : (
                    <p className="text-sm font-semibold text-muted-foreground">Δεν υπάρχουν έγγραφα για αυτή την υπόθεση.</p>
                  )}
                </div>
              </CaseSection>

              <CaseSection title="Σημειώσεις δικηγόρου" quiet>
                <textarea
                  className="partner-textarea min-h-20"
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Ιδιωτική σημείωση υπόθεσης."
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl border-border bg-card text-xs font-bold"
                    onClick={() => {
                      onAddNote(selectedCase, noteDraft);
                      setNoteDraft("");
                    }}
                    disabled={!noteDraft.trim() || selectedAction?.loading}
                  >
                    Προσθήκη σημείωσης
                  </Button>
                </div>
                <div className="mt-3 grid gap-2">
                  {selectedNotes.length > 0 ? selectedNotes.map((note) => (
                    <p key={note.id} className="rounded-lg border border-[hsl(var(--partner-line))] bg-white/70 px-3 py-2 text-sm leading-6 text-muted-foreground">
                      {note.note}
                    </p>
                  )) : (
                    <p className="text-sm font-semibold text-muted-foreground">Δεν υπάρχουν ιδιωτικές σημειώσεις.</p>
                  )}
                </div>
              </CaseSection>

              <CaseSection title="Ιστορικό ενεργειών" quiet>
                <div className="grid gap-2">
                  {selectedHistory.length > 0 ? selectedHistory.slice(0, 6).map((event) => (
                    <div key={event.id} className="rounded-lg border border-[hsl(var(--partner-line))] bg-white/70 px-3 py-2">
                      <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">{event.message}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatShortDate(event.createdAt)} · {event.eventType}</p>
                    </div>
                  )) : (
                    <p className="text-sm font-semibold text-muted-foreground">Το ιστορικό θα γεμίσει με πραγματικές αλλαγές υπόθεσης.</p>
                  )}
                </div>
              </CaseSection>
            </div>
          ) : (
            <EmptyPartnerState
              icon={FileText}
              title="Επιλέξτε υπόθεση"
              description="Οι λεπτομέρειες υπόθεσης, πληρωμών, εγγράφων και σημειώσεων εμφανίζονται εδώ."
            />
          )}
        </aside>
      </div>
    </section>
  );
};

const EarningsView = ({
  completedRevenueCents,
  pendingRevenueCents,
  completedPlatformFeeCents,
  bookings,
  payments,
}: {
  completedRevenueCents: number;
  pendingRevenueCents: number;
  completedPlatformFeeCents: number;
  bookings: StoredBooking[];
  payments: StoredPayment[];
}) => {
  const visibleBookings = bookings.filter((booking) => {
    const payment = payments.find((item) => item.bookingId === booking.id);
    const bookingState = getCanonicalBookingState(booking);
    return Boolean(payment) || bookingState === "confirmed_paid" || bookingState === "confirmed_unpaid" || bookingState === "completed";
  });
  const paidPayments = payments.filter((payment) => getCanonicalPaymentState(payment) === "paid");
  const attentionPayments = payments.filter((payment) => {
    const state = getCanonicalPaymentState(payment);
    return state === "failed" || state === "refund_requested" || state === "checkout_opened";
  });
  const pendingBookings = visibleBookings.filter((booking) => {
    const payment = payments.find((item) => item.bookingId === booking.id);
    const paymentState = payment ? getCanonicalPaymentState(payment) : "not_opened";
    return paymentState === "checkout_opened" || paymentState === "not_opened";
  });
  const completedPaymentBookings = visibleBookings.filter((booking) => {
    const payment = payments.find((item) => item.bookingId === booking.id);
    return payment ? getCanonicalPaymentState(payment) === "paid" : false;
  });

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="partner-panel p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="partner-kicker">Οικονομική εικόνα</p>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Έσοδα και εκκαθάριση</h3>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <Metric label="Καθαρό ποσό" value={formatEuroCents(completedRevenueCents)} helper={`${completedPaymentBookings.length} πληρωμένες συνεδρίες`} />
            <Metric label="Σε αναμονή" value={formatEuroCents(pendingRevenueCents)} helper={`${pendingBookings.length} κρατήσεις`} />
            <Metric label="Χρεώσεις πλάνου" value={formatEuroCents(completedPlatformFeeCents)} helper="χρεώσεις πρώτης συνεδρίας" />
          </div>
        </div>

        <aside className="partner-panel p-4">
          <p className="partner-kicker">Εκκαθάριση</p>
          <div className="mt-3 grid gap-2">
            <SignalRow icon={WalletCards} label="Πληρωμένες" value={String(paidPayments.length)} tone="sage" />
            <SignalRow icon={CircleAlert} label="Θέλουν έλεγχο" value={String(attentionPayments.length)} tone={attentionPayments.length ? "amber" : "neutral"} />
            <SignalRow icon={Landmark} label="Προς εκκαθάριση" value={formatEuroCents(pendingRevenueCents)} tone={pendingRevenueCents ? "amber" : "sage"} />
          </div>
        </aside>
      </div>

      <div className="partner-panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="partner-kicker">Κινήσεις</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Ανά κράτηση</h3>
          </div>
          <StatusPill tone={attentionPayments.length ? "amber" : "sage"}>
            {attentionPayments.length ? `${attentionPayments.length} εκκρεμότητες` : "Ταμειακή εικόνα καθαρή"}
          </StatusPill>
        </div>

        <div className="mt-3 grid gap-2">
          {visibleBookings.length > 0 ? (
            visibleBookings.map((booking) => {
              const payment = payments.find((item) => item.bookingId === booking.id);
              const feeCents = getPartnerFeeCents(payment);
              const netCents = getPartnerNetCents(payment, booking);
              const paymentState = payment ? getCanonicalPaymentState(payment) : "not_opened";
              return (
                <div key={booking.id} className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/70 p-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_130px_120px_150px] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={paymentState === "paid" ? "sage" : paymentState === "failed" || paymentState === "refund_requested" ? "danger" : "amber"}>
                          {partnerPaymentStateLabels[paymentState]}
                        </StatusPill>
                        <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{booking.referenceId}</span>
                      </div>
                      <p className="mt-2 font-semibold text-[hsl(var(--partner-ink))]">{getDisplayClientName(booking)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{booking.consultationType} · {booking.dateLabel} · {booking.time}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Καθαρό</p>
                      <p className="mt-1 text-lg font-semibold text-[hsl(var(--partner-ink))]">{formatEuroCents(netCents)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Χρέωση</p>
                      <p className="mt-1 text-sm font-semibold text-[hsl(var(--partner-ink))]">{feeCents > 0 ? `-${formatEuroCents(feeCents)}` : "€0"}</p>
                    </div>
                    <div className="text-left lg:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Επόμενο</p>
                      <p className="mt-1 text-sm font-semibold text-[hsl(var(--partner-ink))]">
                        {canSubmitReview(booking)
                          ? "Έτοιμο για εκταμίευση"
                          : paymentState === "paid"
                            ? "Ολοκληρώστε συνεδρία"
                            : "Αναμονή πληρωμής"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyPartnerState
              icon={CreditCard}
              title={pendingRevenueCents > 0 ? "Υπάρχει ποσό σε αναμονή χωρίς συνδεδεμένη κράτηση" : "Δεν υπάρχουν οικονομικές κινήσεις"}
              description={pendingRevenueCents > 0 ? "Η οικονομική σύνοψη δείχνει ποσό σε αναμονή. Χρειάζεται έλεγχος συγχρονισμού πληρωμών." : "Οι πληρωμές θα εμφανίζονται όταν υπάρξουν κρατήσεις."}
            />
          )}
        </div>
      </div>
    </section>
  );
};

const ReviewsView = ({
  reviews,
  actionState,
  onReplyChange,
  onSaveReply,
}: {
  reviews: StoredLawyerReview[];
  actionState: Record<string, SaveState>;
  onReplyChange: (reviewId: string, reply: string) => void;
  onSaveReply: (review: StoredLawyerReview) => void;
}) => {
  const publishedReviews = reviews.filter((review) => review.status === "published");
  const moderatedReviews = reviews.filter((review) => review.status !== "published");
  const averageRating = reviews.length
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const getReviewTone = (status: StoredLawyerReview["status"]): DashboardTone => {
    if (status === "published") return "sage";
    if (status === "rejected") return "danger";
    return "amber";
  };

  const formatReviewDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("el-GR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <section className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3">
        <Metric label="Μέσος όρος" value={averageRating} helper={`${reviews.length} αξιολογήσεις`} />
        <Metric label="Δημοσιευμένες" value={String(publishedReviews.length)} helper="εμφανίζονται δημόσια" />
        <Metric label="Έλεγχος" value={String(moderatedReviews.length)} helper="θέλουν moderation" />
      </div>

      <section className="rounded-lg border border-border bg-card p-4 shadow-lg shadow-foreground/[0.03]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Φήμη προφίλ</p>
            <h3 className="mt-1 font-serif text-xl tracking-tight text-foreground">Αξιολογήσεις πελατών</h3>
          </div>
          <StatusPill tone={moderatedReviews.length ? "amber" : "sage"}>
            {moderatedReviews.length ? `${moderatedReviews.length} σε έλεγχο` : "Καθαρή εικόνα"}
          </StatusPill>
        </div>

        <div className="mt-4 space-y-3">
          {reviews.length > 0 ? reviews.map((review) => {
            const currentAction = actionState[review.id];

            return (
            <article key={review.id} className="rounded-lg border border-border bg-secondary/30 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-bold text-foreground">{getDisplayPersonName(review.clientName, review.id)}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{review.consultationType} · {formatReviewDate(review.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={getReviewTone(review.status)}>
                    {reviewPublicationStateLabels[review.status]}
                  </StatusPill>
                  <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-bold text-foreground">{review.rating}/5</span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{review.text}</p>
              <Field label="Δημόσια απάντηση">
                <textarea
                  className="partner-textarea min-h-20"
                  value={review.reply || ""}
                  onChange={(event) => onReplyChange(review.id, event.target.value)}
                  placeholder="Σύντομη επαγγελματική απάντηση που θα εμφανίζεται δημόσια."
                />
              </Field>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold leading-5 text-muted-foreground">
                  Η απάντηση αποθηκεύεται στο ίδιο review record και εμφανίζεται δημόσια όταν η αξιολόγηση είναι δημοσιευμένη.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onSaveReply(review)}
                  disabled={currentAction?.loading}
                  className="h-10 rounded-xl border-border bg-card px-4 text-sm font-bold"
                >
                  {currentAction?.loading ? "Αποθήκευση..." : "Αποθήκευση απάντησης"}
                </Button>
              </div>
              {currentAction?.message ? (
                <div className="mt-3">
                  <SaveMessage saveState={currentAction} />
                </div>
              ) : null}
            </article>
          );
          }) : (
            <EmptyPartnerState
              icon={MessageSquareText}
              title="Δεν υπάρχουν αξιολογήσεις ακόμη"
              description="Οι πελάτες μπορούν να αξιολογήσουν μόνο μετά από ολοκληρωμένο και πληρωμένο ραντεβού."
            />
          )}
        </div>
      </section>
    </section>
  );
};

const NotificationsView = ({
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
  <section className="space-y-4">
    <section className="partner-panel p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="partner-kicker">Λειτουργία κράτησης</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Κανόνες εισερχόμενων κρατήσεων</h3>
          </div>
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="mt-3 grid gap-3">
          <ToggleRow
            title="Αυτόματη επιβεβαίωση"
            description="Οι νέες κρατήσεις μπαίνουν απευθείας στο ημερολόγιο μετά τον έλεγχο συστήματος."
            enabled={workspace.profile.autoConfirm}
            onToggle={() => updateProfile({ autoConfirm: !workspace.profile.autoConfirm })}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[hsl(var(--partner-line))] pt-3">
          <InlineRuleValue label="Κράτηση" value={workspace.profile.autoConfirm ? "Γρήγορη" : "Με έλεγχο"} />
          <InlineRuleValue label="Χρόνος ασφαλείας" value={`${workspace.profile.bufferMinutes} λεπτά`} />
          <InlineRuleValue label="Παράθυρο κρατήσεων" value={`${workspace.profile.bookingWindowDays} ημέρες`} />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Ο χρόνος ασφαλείας και το παράθυρο κρατήσεων ρυθμίζονται στη Διαθεσιμότητα.
        </p>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="partner-panel p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="partner-kicker">Ειδοποιήσεις</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Κανάλια ενημέρωσης</h3>
          </div>
          <BellRing className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="mt-3 grid gap-3">
          <ToggleRow
            title="Email νέων κρατήσεων"
            description="Email για κάθε επιβεβαιωμένη κράτηση."
            enabled={workspace.notifications.bookingEmail}
            onToggle={() => updateNotifications({ bookingEmail: !workspace.notifications.bookingEmail })}
          />
          <ToggleRow
            title="SMS νέων κρατήσεων"
            description="Σύντομη ειδοποίηση για άμεση μεταβολή."
            enabled={workspace.notifications.bookingSms}
            onToggle={() => updateNotifications({ bookingSms: !workspace.notifications.bookingSms })}
          />
          <ToggleRow
            title="Εβδομαδιαία σύνοψη"
            description="Συγκεντρωτικό email με κρατήσεις, πληρωμές και εκκρεμότητες."
            enabled={workspace.notifications.weeklyDigest}
            onToggle={() => updateNotifications({ weeklyDigest: !workspace.notifications.weeklyDigest })}
          />
        </div>
      </div>

      <div className="partner-panel p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="partner-kicker">Ασφάλεια και δημοσίευση</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Κατάσταση αλλαγών</h3>
          </div>
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="mt-3 grid gap-2">
          <SignalRow icon={BadgeCheck} label="Αλλαγές" value={hasUnsavedChanges ? "Πρόχειρες" : "Συγχρονισμένες"} tone={hasUnsavedChanges ? "amber" : "sage"} />
          <SignalRow icon={SearchCheck} label="Καταχώριση" value={workspace.profile.displayName ? "Ταυτοποιημένη" : "Λείπει όνομα"} tone={workspace.profile.displayName ? "sage" : "danger"} />
          <SignalRow icon={MailCheck} label="Digest" value={workspace.notifications.weeklyDigest ? "Ενεργό" : "Ανενεργό"} tone={workspace.notifications.weeklyDigest ? "sage" : "neutral"} />
        </div>
      </div>
    </section>

    <SectionSaveFooter onSave={onSave} saveState={saveState} hasUnsavedChanges={hasUnsavedChanges} />
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
        ? "border-border bg-secondary/45 text-foreground"
        : "border-primary/20 bg-primary/10 text-primary";

  return (
    <p className={`rounded-xl border px-3 py-2 text-sm font-semibold ${toneClass}`}>
      {saveState.message}
    </p>
  );
};

const Metric = ({ label, value, helper }: { label: string; value: string; helper: string }) => (
  <div className="rounded-lg border border-border bg-secondary/50 p-3">
    <p className="truncate text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{helper}</p>
  </div>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="mt-3 block">
    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
    <span className="mt-1.5 block">{children}</span>
  </label>
);

const NumberField = ({
  label,
  value,
  suffix,
  min = 0,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
}) => (
  <Field label={label}>
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        step={step}
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
    role="switch"
    aria-checked={enabled}
    className="flex w-full items-start justify-between gap-4 rounded-lg border border-border bg-card px-3 py-3 text-left transition hover:border-primary/25"
  >
    <span>
      <span className="block text-sm font-bold text-foreground">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
    </span>
    <span className={`mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition ${enabled ? "bg-sage" : "bg-border"}`}>
      <span className={`h-4 w-4 rounded-full bg-white transition ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </span>
  </button>
);

const EmptyPartnerState = ({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) => (
  <div className="rounded-lg border border-dashed border-border bg-secondary/35 px-4 py-6 text-center">
    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-card text-muted-foreground">
      <Icon className="h-5 w-5" />
    </div>
    <p className="mt-3 font-bold text-foreground">{title}</p>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
);

export default PartnerPortal;


