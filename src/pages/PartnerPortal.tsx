import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  BellRing,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CircleAlert,
  Clock3,
  CreditCard,
  FileText,
  Landmark,
  MailCheck,
  MapPin,
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
import { type ConsultationMode, type Lawyer } from "@/data/lawyers";
import { getLawyerBaseProfileById, getPublicLawyerProfileReadiness } from "@/lib/lawyerRepository";
import {
  clearPartnerSession,
  cancelPartnerBooking,
  completePartnerBooking,
  fetchBookingsForLawyer,
  fetchDocumentsForLawyer,
  fetchPaymentsForLawyer,
  getPartnerSession,
  isPartnerSessionInvalidError,
  isVerifiedBooking,
  type StoredBooking,
  type StoredBookingDocument,
  type StoredPayment,
} from "@/lib/platformRepository";
import {
  canSubmitReview,
  getCanonicalBookingState,
  getCanonicalPaymentState,
  isBookingScheduled,
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

const navItems = [
  { id: "appointments", label: "Ραντεβού", icon: CalendarDays },
  { id: "availability", label: "Διαθεσιμότητα", icon: Clock3 },
  { id: "earnings", label: "Πληρωμές", icon: CreditCard },
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
type DashboardTone = "navy" | "sage" | "amber" | "danger" | "neutral";

const partnerViewIds = new Set<PartnerView>(navItems.map((item) => item.id));
const parsePartnerView = (value: string | null): PartnerView =>
  value === "pipeline" || value === "performance"
    ? "appointments"
    : value && partnerViewIds.has(value as PartnerView)
      ? (value as PartnerView)
      : "appointments";

const viewMeta: Record<PartnerView, { title: string; description: string }> = {
  appointments: {
    title: "Ραντεβού και εκκρεμότητες σε μία ουρά εργασίας.",
    description: "Δείτε κρατήσεις, πληρωμές, σημειώσεις, υπενθυμίσεις, έγγραφα και τις επόμενες ενέργειες.",
  },
  availability: {
    title: "Διαθεσιμότητα που αποθηκεύεται άμεσα.",
    description: "Ορίστε ημέρες, ώρες, σημειώσεις, κενά ασφαλείας και κανόνες κράτησης.",
  },
  earnings: {
    title: "Πληρωμές, εκταμιεύσεις και τιμολόγια.",
    description: "Παρακολουθήστε ολοκληρωμένες συνεδρίες, έσοδα σε αναμονή και αποδείξεις συνεργασίας.",
  },
  settings: {
    title: "Ρυθμίσεις λογαριασμού και λειτουργίας.",
    description: "Ελέγξτε ειδοποιήσεις, αυτόματη επιβεβαίωση και κατάσταση λογαριασμού.",
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

interface PartnerPortalProps {
  chrome?: "partner" | "profile";
}

const PartnerPortal = ({ chrome = "partner" }: PartnerPortalProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(() => getPartnerSession());
  const email = session?.email || "";
  const [activeView, setActiveView] = useState<PartnerView>(() => parsePartnerView(searchParams.get("view")));
  const [queueFilter, setQueueFilter] = useState<PipelineQueueFilter>("all");
  const [workspace, setWorkspace] = useState<PartnerWorkspace>(() => getPartnerWorkspace(email));
  const [savedWorkspace, setSavedWorkspace] = useState<PartnerWorkspace>(() => getPartnerWorkspace(email));
  const [bookingsVersion, setBookingsVersion] = useState(0);
  const [partnerBookings, setPartnerBookings] = useState<StoredBooking[]>([]);
  const [partnerPayments, setPartnerPayments] = useState<StoredPayment[]>([]);
  const [partnerDocuments, setPartnerDocuments] = useState<StoredBookingDocument[]>([]);
  const [partnerCaseNotes, setPartnerCaseNotes] = useState<PartnerCaseNote[]>([]);
  const [partnerFollowups, setPartnerFollowups] = useState<PartnerFollowupTask[]>([]);
  const [bookingActionState, setBookingActionState] = useState<Record<string, BookingActionState>>({});
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
    void fetchPartnerWorkspace(email).then((nextWorkspace) => {
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
  }, [email]);

  useEffect(() => {
    const requestedView = searchParams.get("view");
    const normalizedView = parsePartnerView(requestedView);
    if (requestedView && requestedView !== normalizedView) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("view", normalizedView);
      nextParams.delete("section");
      navigate({ search: `?${nextParams.toString()}` }, { replace: true });
      return;
    }
    setActiveView(normalizedView);
  }, [navigate, searchParams]);

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
      fetchPartnerCrmState(workspace.profile.lawyerId, session),
    ])
      .then(([nextBookings, nextPayments, nextDocuments, nextCrm]) => {
        if (!active) return;
        setPartnerBookings(nextBookings);
        setPartnerPayments(nextPayments);
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

  const displayBookings = partnerBookings;
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
  const workspaceStatus = hasUnsavedChanges ? "Υπάρχουν πρόχειρες αλλαγές" : "Όλα συγχρονισμένα";
  const nextBooking = confirmedBookings[0] || displayBookings[0];

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

  const cancelBooking = (booking?: StoredBooking) => {
    if (!booking) return;
    void cancelBookingPersisted(booking);
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

  const selectQueueFilter = (filter: PipelineQueueFilter) => {
    setQueueFilter(filter);
    selectPartnerView("appointments");
  };

  const sidebarItems: Array<{
    key: string;
    label: string;
    icon: LucideIcon;
    badge?: string;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      key: "appointments",
      label: "Ραντεβού",
      icon: CalendarDays,
      badge: pipelineItems.length > 0 ? String(pipelineItems.length) : undefined,
      active: activeView === "appointments",
      onClick: () => selectQueueFilter("all"),
    },
    {
      key: "availability",
      label: "Διαθεσιμότητα",
      icon: Clock3,
      badge: enabledAvailabilityDays > 0 ? String(enabledAvailabilityDays) : undefined,
      active: activeView === "availability",
      onClick: () => selectPartnerView("availability"),
    },
    {
      key: "earnings",
      label: "Πληρωμές",
      icon: CreditCard,
      badge: pendingRevenueCents > 0 ? formatEuroCents(pendingRevenueCents) : undefined,
      active: activeView === "earnings",
      onClick: () => selectPartnerView("earnings"),
    },
    {
      key: "settings",
      label: "Ρυθμίσεις",
      icon: Settings2,
      badge: hasUnsavedChanges ? "Draft" : undefined,
      active: activeView === "settings",
      onClick: () => selectPartnerView("settings"),
    },
  ];

  return (
    <PartnerShell chrome={chrome} className="pb-8">
      <section className="space-y-4">
        <header className="partner-panel px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--partner-navy))] text-white">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Πίνακας συνεργάτη</p>
                <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
                  {workspace.profile.displayName || workspace.profile.officeName || email}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
              {workspace.profile.city ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1 ring-1 ring-[hsl(var(--partner-line))]/70">
                  <MapPin className="h-3.5 w-3.5" />
                  {workspace.profile.city}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1 ring-1 ring-[hsl(var(--partner-line))]/70">
                <BadgeCheck className="h-3.5 w-3.5" />
                {publicProfileStatus}
              </span>
              <span className="rounded-full bg-white/75 px-2.5 py-1 ring-1 ring-[hsl(var(--partner-line))]/70">{workspaceStatus}</span>
            </div>
          </div>
        </header>

        <DailyCommandPanel
          nextBooking={nextBooking}
          newRequestCount={newRequestCount}
          pendingRevenueCents={pendingRevenueCents}
          enabledAvailabilityDays={enabledAvailabilityDays}
          onSelectFilter={selectQueueFilter}
          onSelectView={selectPartnerView}
        />

        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="min-w-0 xl:sticky xl:top-[82px] xl:self-start">
            <nav className="partner-panel min-w-0 p-2">
              <div className="grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-1">
                {sidebarItems.map(({ key, label, icon: Icon, active, badge, onClick }) => {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={onClick}
                      className={`group flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                        active
                          ? "bg-[hsl(var(--partner-navy))] text-white"
                          : "text-[hsl(var(--partner-ink))] hover:bg-white/80"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[hsl(var(--partner-gold))]" : "text-[hsl(var(--partner-navy-soft))]"}`} />
                        <span className="whitespace-nowrap">{label}</span>
                      </span>
                      {badge ? (
                        <span className={`max-w-[60px] truncate rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-white/14 text-white" : "bg-white/90 text-muted-foreground ring-1 ring-[hsl(var(--partner-line))]/60"}`}>
                          {badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </nav>
          </aside>

          <div className="min-w-0 space-y-4">
            {activeView !== "appointments" ? (
            <section className="partner-panel px-4 py-3">
              <div className="flex flex-col gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ActiveViewIcon className="h-4 w-4 text-[hsl(var(--partner-navy-soft))]" />
                    <h2 className="truncate text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">
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

          {activeView === "appointments" ? (
            <PipelineView
              items={pipelineItems}
              activeFilter={queueFilter}
              onFilterChange={setQueueFilter}
              actionState={bookingActionState}
              onAddNote={(booking, note) => void addPipelineNote(booking, note)}
              onAddFollowup={(booking, title, dueAt) => void addPipelineFollowup(booking, title, dueAt)}
              onChangeStatus={(booking, status) => void changePipelineStatus(booking, status)}
              onComplete={completeBooking}
              onCancel={cancelBooking}
              onSelectView={selectPartnerView}
            />
          ) : null}

          {activeView === "availability" ? (
            <SignupAvailabilityView
              workspace={workspace}
              updateAvailability={updateAvailability}
              updateProfile={updateProfile}
              onSave={() => void saveWorkspaceChanges()}
              hasUnsavedChanges={hasUnsavedChanges}
              saveState={profileSaveState}
            />
          ) : null}

          {activeView === "earnings" ? (
            <EarningsView
              completedRevenueCents={completedRevenueCents}
              pendingRevenueCents={pendingRevenueCents}
              completedPlatformFeeCents={completedPlatformFeeCents}
              bookings={partnerBookings}
              payments={partnerPayments}
            />
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
    return "border-[hsl(var(--sage))]/25 bg-[hsl(var(--sage))]/10 text-[hsl(var(--sage-foreground))]";
  }
  if (tone === "amber") {
    return "border-amber-300/45 bg-amber-50 text-amber-900";
  }
  if (tone === "danger") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }
  if (tone === "navy") {
    return "border-[hsl(var(--partner-navy))]/15 bg-[hsl(var(--partner-navy))]/8 text-[hsl(var(--partner-navy-soft))]";
  }
  return "border-[hsl(var(--partner-line))] bg-white/72 text-[hsl(var(--partner-ink))]";
};

const InlineRuleValue = ({ label, value }: { label: string; value: string }) => (
  <span className="inline-flex min-w-0 items-baseline gap-2 text-sm text-[hsl(var(--partner-ink))]">
    <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
    <span className="truncate font-semibold">{value}</span>
  </span>
);

const DailyCommandPanel = ({
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
      className="partner-panel min-w-0 px-3 py-3 text-left transition hover:bg-white/70"
    >
      <p className="partner-kicker">Σήμερα</p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">
        {nextBooking ? `1 ραντεβού · ${nextBooking.time}` : "0 ραντεβού"}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {nextBooking ? nextBooking.clientName : "Δεν υπάρχει άμεσο ραντεβού"}
      </p>
    </button>

    <button
      type="button"
      onClick={() => onSelectFilter("new")}
      className="partner-panel min-w-0 px-3 py-3 text-left transition hover:bg-white/70"
    >
      <p className="partner-kicker">Νέα αιτήματα</p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">{newRequestCount} ραντεβού</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{newRequestCount > 0 ? "Προς άνοιγμα ή επιβεβαίωση" : "Δεν υπάρχουν νέα αιτήματα"}</p>
    </button>

    <button
      type="button"
      onClick={() => onSelectView("earnings")}
      className="partner-panel min-w-0 px-3 py-3 text-left transition hover:bg-white/70"
    >
      <p className="partner-kicker">Πληρωμές</p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">{formatEuroCents(pendingRevenueCents)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Σε αναμονή ελέγχου ή εκκαθάρισης</p>
    </button>

    <button
      type="button"
      onClick={() => onSelectView("availability")}
      className="partner-panel min-w-0 px-3 py-3 text-left transition hover:bg-white/70"
    >
      <p className="partner-kicker">Διαθεσιμότητα</p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">{enabledAvailabilityDays} ενεργές ημέρες</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Δημόσιο πρόγραμμα κρατήσεων</p>
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
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${getToneClasses(tone)}`}>
    {children}
  </span>
);

const AppointmentBadge = ({ tone, children }: { tone: DashboardTone; children: ReactNode }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getToneClasses(tone)}`}>
    {children}
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
      primaryView: "earnings" as PartnerView,
      reminderTitle: "Επικοινωνία για αποτυχία πληρωμής",
      tone: "danger" as DashboardTone,
    };
  }

  if (paymentState === "refund_requested" || item.status === "refund_risk") {
    return {
      title: "Χρειάζεται έλεγχος επανεπικοινωνίας",
      description: "Υπάρχει ένδειξη ότι η υπόθεση μπορεί να χρειάζεται νέα επικοινωνία ή οικονομικό έλεγχο.",
      primaryLabel: "Άνοιγμα πληρωμών",
      primaryView: "earnings" as PartnerView,
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
                      <span className="block break-words font-semibold text-[hsl(var(--partner-ink))]">{item.booking.clientName}</span>
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
                    <h3 className="break-words text-lg font-semibold text-[hsl(var(--partner-ink))]">{selectedItem.booking.clientName}</h3>
                    <p className="mt-0.5 break-all text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{selectedItem.booking.referenceId}</p>
                  </div>
                  <AppointmentBadge tone={getAppointmentStatusTone(selectedItem)}>{getAppointmentStatusLabel(selectedItem)}</AppointmentBadge>
                </div>
              </div>

              <CaseSection title="Πελάτης" quiet>
                <div className="grid gap-1 text-sm leading-6 text-[hsl(var(--partner-ink))]">
                  <p className="font-semibold">{selectedItem.booking.clientName}</p>
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
  onComplete,
  onCancel,
}: {
  bookings: StoredBooking[];
  documents: StoredBookingDocument[];
  payments: StoredPayment[];
  actionState: Record<string, BookingActionState>;
  onComplete: (booking?: StoredBooking) => void;
  onCancel: (booking?: StoredBooking) => void;
}) => {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const scheduledCount = bookings.filter((booking) => isBookingScheduled(booking)).length;
  const completedCount = bookings.filter((booking) => booking.status === "completed").length;
  const reviewCount = bookings.filter((booking) => !isVerifiedBooking(booking)).length;
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) || null;
  const groupedBookings = bookings.reduce<Record<string, StoredBooking[]>>((groups, booking) => {
    groups[booking.dateLabel] = [...(groups[booking.dateLabel] || []), booking];
    return groups;
  }, {});

  const getPaymentForBooking = (bookingId: string) => payments.find((payment) => payment.bookingId === bookingId);

  return (
    <section className="space-y-4">
      <section className="partner-panel p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="partner-kicker">Ατζέντα</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Ραντεβού</h3>
          </div>
          <div className="grid grid-cols-4 gap-2 lg:min-w-[460px]">
            <Metric label="Πρόγραμμα" value={String(scheduledCount)} helper="ενεργά" />
            <Metric label="Ολοκλ." value={String(completedCount)} helper="κλειστά" />
            <Metric label="Έλεγχος" value={String(reviewCount)} helper="κρατήσεις" />
            <Metric label="Έγγραφα" value={String(documents.length)} helper="αρχεία" />
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="overflow-hidden rounded-2xl border border-[hsl(var(--partner-line))] bg-white/45">
            {bookings.length > 0 ? Object.entries(groupedBookings).map(([dateLabel, dateBookings]) => (
              <div key={dateLabel} className="border-b border-[hsl(var(--partner-line))] last:border-b-0">
                <div className="bg-[hsl(var(--partner-ivory))]/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {dateLabel}
                </div>
                <div className="divide-y divide-[hsl(var(--partner-line))]">
                  {dateBookings.map((booking) => {
                    const bookingDocuments = documents.filter((document) => document.bookingId === booking.id);
                    const bookingState = getCanonicalBookingState(booking);
                    const paymentState = getPaymentForBooking(booking.id) ? getCanonicalPaymentState(getPaymentForBooking(booking.id)) : null;
                    const selected = selectedBookingId === booking.id;
                    return (
                      <button
                        key={booking.referenceId}
                        type="button"
                        onClick={() => setSelectedBookingId(booking.id)}
                        className={`grid w-full gap-3 px-3 py-3 text-left transition hover:bg-white/70 lg:grid-cols-[72px_minmax(160px,1fr)_130px_130px_86px_110px] lg:items-center ${
                          selected ? "bg-white/80" : ""
                        }`}
                      >
                        <span className="font-semibold text-[hsl(var(--partner-ink))]">{booking.time}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[hsl(var(--partner-ink))]">{booking.clientName}</span>
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
                title="Δεν υπάρχουν πραγματικές κρατήσεις"
                description="Οι νέες κρατήσεις θα εμφανίζονται εδώ μόλις περάσουν τον έλεγχο κράτησης."
              />
            )}
          </div>

          <aside className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/55 p-4 xl:sticky xl:top-[96px] xl:self-start">
            {selectedBooking ? (() => {
              const bookingDocuments = documents.filter((document) => document.bookingId === selectedBooking.id);
              const currentAction = actionState[selectedBooking.id];
              const bookingState = getCanonicalBookingState(selectedBooking);
              const paymentState = getPaymentForBooking(selectedBooking.id) ? getCanonicalPaymentState(getPaymentForBooking(selectedBooking.id)) : null;
              const verified = isVerifiedBooking(selectedBooking);
              const canMarkComplete = bookingState === "confirmed_paid";
              const scheduled = isBookingScheduled(selectedBooking, getPaymentForBooking(selectedBooking.id));

              return (
                <div className="space-y-4">
                  <div>
                    <p className="partner-kicker">Λεπτομέρειες ραντεβού</p>
                    <h4 className="mt-1 text-lg font-semibold text-[hsl(var(--partner-ink))]">{selectedBooking.clientName}</h4>
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

                  {scheduled && verified ? (
                    <div className="grid gap-2">
                      <Button type="button" onClick={() => onComplete(selectedBooking)} disabled={currentAction?.loading || !canMarkComplete} className="h-10 rounded-xl text-sm font-bold">
                        {canMarkComplete ? "Σήμανση ολοκλήρωσης" : "Αναμονή πληρωμής"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onCancel(selectedBooking)}
                        disabled={currentAction?.loading}
                        className="h-10 rounded-xl border-destructive/25 bg-white/75 text-sm font-bold text-destructive hover:text-destructive"
                      >
                        Ακύρωση ή αλλαγή ώρας
                      </Button>
                    </div>
                  ) : scheduled && !verified ? (
                    <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-semibold leading-5 text-destructive">
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
      </section>
    </section>
  );
};

const SignupAvailabilityView = ({
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
}) => {
  const sessionDuration = normalizeSessionDurationMinutes(workspace.profile.sessionDurationMinutes);
  const enabledSlots = workspace.availability.filter((slot) => slot.enabled && validateAvailabilitySlot(slot, sessionDuration).valid);
  const coverageTone: DashboardTone = enabledSlots.length >= 4 ? "sage" : enabledSlots.length >= 2 ? "amber" : "danger";
  const invalidSlots = workspace.availability.filter((slot) => slot.enabled && !validateAvailabilitySlot(slot, sessionDuration).valid);

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
          <StatusPill tone={coverageTone}>{enabledSlots.length}/5 ημέρες ενεργές</StatusPill>
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
                    <p className="mt-2 text-xs font-semibold text-destructive">
                      {getAvailabilityValidationMessage(validation, sessionDuration)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {enabledSlots.length < 3 || invalidSlots.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm font-semibold leading-6 text-destructive">
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

      <SectionSaveFooter onSave={onSave} saveState={saveState} hasUnsavedChanges={hasUnsavedChanges} />
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
                      <p className="mt-2 font-semibold text-[hsl(var(--partner-ink))]">{booking.clientName}</p>
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
        ? "border-destructive/20 bg-destructive/10 text-destructive"
        : "border-primary/20 bg-primary/10 text-primary";

  return (
    <p className={`rounded-xl border px-3 py-2 text-sm font-semibold ${toneClass}`}>
      {saveState.message}
    </p>
  );
};

const Metric = ({ label, value, helper }: { label: string; value: string; helper: string }) => (
  <div className="partner-soft-card px-3 py-2.5">
    <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    <p className="mt-1 text-base font-semibold text-[hsl(var(--partner-ink))]">{value}</p>
    <p className="truncate text-xs text-muted-foreground">{helper}</p>
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
    className="flex w-full items-start justify-between gap-4 rounded-xl border border-[hsl(var(--partner-line))] bg-white/65 px-3 py-3 text-left"
  >
    <span>
      <span className="block text-sm font-semibold text-[hsl(var(--partner-ink))]">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
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


