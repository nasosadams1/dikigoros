import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  BadgeCheck,
  BellRing,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  FileCheck2,
  FileText,
  Gauge,
  Landmark,
  ListChecks,
  MailCheck,
  MapPin,
  PhoneCall,
  ReceiptText,
  SearchCheck,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TimerReset,
  WalletCards,
  Workflow,
  UserRoundCog,
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

const navItems = [
  { id: "pipeline", label: "Ροή υποθέσεων", icon: Workflow },
  { id: "appointments", label: "Ραντεβού", icon: CalendarDays },
  { id: "performance", label: "Απόδοση συνεργασίας", icon: BarChart3 },
  { id: "availability", label: "Διαθεσιμότητα", icon: Clock3 },
  { id: "profile", label: "Προφίλ", icon: UserRoundCog },
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
type PartnerPriorityAction = {
  icon: LucideIcon;
  title: string;
  description: string;
  view: PartnerView;
  tone: DashboardTone;
};

const partnerViewIds = new Set<PartnerView>(navItems.map((item) => item.id));
const parsePartnerView = (value: string | null): PartnerView =>
  value && partnerViewIds.has(value as PartnerView) ? (value as PartnerView) : "appointments";

const viewMeta: Record<PartnerView, { title: string; description: string }> = {
  pipeline: {
    title: "Ροή υποθέσεων για κάθε στάδιο πελάτη.",
    description: "Παρακολουθήστε κρατήσεις, πληρωμές, επερχόμενα ραντεβού, ολοκληρώσεις, πιθανές επιστροφές και υπενθυμίσεις συνέχειας.",
  },
  appointments: {
    title: "Ραντεβού και αιτήματα με καθαρή εικόνα ημέρας.",
    description: "Δείτε κρατήσεις, στοιχεία πελάτη, θέμα, κατάσταση και τις επόμενες ενέργειες.",
  },
  performance: {
    title: "Απόδοση συνεργασίας από μία ενιαία καρτέλα.",
    description: "Παρακολουθήστε ζήτηση, πληρωμένες κρατήσεις, πρώτες συνεδρίες και λειτουργικές εκκρεμότητες.",
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
  settings: {
    title: "Ρυθμίσεις λογαριασμού και λειτουργίας.",
    description: "Ελέγξτε ειδοποιήσεις, αυτόματη επιβεβαίωση, παράθυρο κράτησης και χρόνο κενού.",
  },
};

const consultationModeOptions: ConsultationMode[] = ["video", "phone", "inPerson"];
const partnerConsultationModeLabels: Record<ConsultationMode, string> = {
  video: "Βιντεοκλήση",
  phone: "Τηλέφωνο",
  inPerson: "Στο γραφείο",
};
const partnerPracticeAreaOptions = [
  "Ενοχικό / οφειλές",
  "Οικογενειακό δίκαιο",
  "Τροχαία / αποζημιώσεις",
  "Εργατικό δίκαιο",
  "Μισθώσεις / ενοίκια / εξώσεις",
];
const partnerCityOptions = ["Αθήνα", "Θεσσαλονίκη", "Πειραιάς", "Ηράκλειο", "Πάτρα"];

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
        notes: partnerCaseNotes,
        followups: partnerFollowups,
      }),
    [partnerBookings, partnerCaseNotes, partnerDocuments, partnerFollowups, partnerPayments],
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
  const enabledAvailabilityDays = workspace.availability.filter((slot) => slot.enabled).length;
  const openFollowupsCount = partnerFollowups.filter((task) => task.status === "open").length;
  const activeNavItem = navItems.find((item) => item.id === activeView) ?? navItems[1];
  const ActiveViewIcon = activeNavItem.icon;
  const publicProfileStatus = searchVisibility.loading
    ? "Έλεγχος δημόσιου προφίλ"
    : searchVisibility.ready
      ? "Έτοιμο για αναζήτηση"
      : "Χρειάζεται συμπλήρωση";
  const workspaceStatus = hasUnsavedChanges ? "Υπάρχουν πρόχειρες αλλαγές" : "Όλα συγχρονισμένα";
  const heroHighlights = [
    {
      label: "Επόμενα ραντεβού",
      value: String(confirmedBookings.length || displayBookings.length),
      helper: confirmedBookings.length > 0 ? "επιβεβαιωμένες συνεδρίες" : "κρατήσεις προς διαχείριση",
    },
    {
      label: "Ολοκληρωμένα",
      value: String(completedBookings.length),
      helper: "ραντεβού που έκλεισαν σωστά",
    },
    {
      label: "Ανοιχτές συνέχειες",
      value: String(openFollowupsCount),
      helper: openFollowupsCount > 0 ? "υπενθυμίσεις που περιμένουν" : "καμία εκκρεμής συνέχεια",
    },
    {
      label: "Διαθεσιμότητα",
      value: String(enabledAvailabilityDays),
      helper: enabledAvailabilityDays > 0 ? "ημέρες στο δημοσιευμένο πρόγραμμα" : "δεν υπάρχει ακόμα ανοιχτό πρόγραμμα",
    },
  ];
  const readinessScore = searchVisibility.loading
    ? 68
    : searchVisibility.ready
      ? 100
      : Math.max(28, 100 - searchVisibility.issues.length * 18);
  const nextBooking = confirmedBookings[0] || displayBookings[0];
  const partnerPriorityActions: PartnerPriorityAction[] = [
    ...(openFollowupsCount > 0
      ? [
          {
            icon: BellRing,
            title: `${openFollowupsCount} συνέχειες χρειάζονται κλείσιμο`,
            description: "Δείτε τις υποθέσεις που έχουν υπενθύμιση και σημειώστε το επόμενο βήμα.",
            view: "pipeline" as PartnerView,
            tone: "amber" as DashboardTone,
          },
        ]
      : []),
    ...(nextBooking
      ? [
          {
            icon: CalendarClock,
            title: `Επόμενο ραντεβού: ${nextBooking.clientName}`,
            description: `${nextBooking.dateLabel} στις ${nextBooking.time}. ${nextBooking.issueSummary || nextBooking.consultationType}`,
            view: "appointments" as PartnerView,
            tone: "navy" as DashboardTone,
          },
        ]
      : []),
    ...(!searchVisibility.loading && !searchVisibility.ready
      ? [
          {
            icon: SearchCheck,
            title: "Το δημόσιο προφίλ δεν περνά ακόμα τον έλεγχο",
            description: `${searchVisibility.issues.length} σημεία κρατούν το προφίλ εκτός αναζήτησης.`,
            view: "profile" as PartnerView,
            tone: "danger" as DashboardTone,
          },
        ]
      : []),
    ...(enabledAvailabilityDays < 3
      ? [
          {
            icon: Clock3,
            title: "Χαμηλή κάλυψη διαθεσιμότητας",
            description: "Ανοίξτε τουλάχιστον τρεις ημέρες για καλύτερη πιθανότητα κράτησης.",
            view: "availability" as PartnerView,
            tone: "amber" as DashboardTone,
          },
        ]
      : []),
    ...(pendingRevenueCents > 0
      ? [
          {
            icon: WalletCards,
            title: `${formatEuroCents(pendingRevenueCents)} σε οικονομική αναμονή`,
            description: "Ελέγξτε ποιες κρατήσεις πρέπει να ολοκληρωθούν ή να εκκαθαριστούν.",
            view: "earnings" as PartnerView,
            tone: "sage" as DashboardTone,
          },
        ]
      : []),
  ].slice(0, 3);
  const navBadges: Partial<Record<PartnerView, string>> = {
    pipeline: pipelineItems.length > 0 ? String(pipelineItems.length) : undefined,
    appointments: displayBookings.length > 0 ? String(displayBookings.length) : undefined,
    performance: paidBookings > 0 ? String(paidBookings) : undefined,
    availability: enabledAvailabilityDays > 0 ? String(enabledAvailabilityDays) : undefined,
    profile: searchVisibility.ready ? "OK" : searchVisibility.loading ? "..." : String(searchVisibility.issues.length),
    earnings: pendingRevenueCents > 0 ? formatEuroCents(pendingRevenueCents) : undefined,
    settings: hasUnsavedChanges ? "Draft" : undefined,
  };
  const focusPanelByView: Record<PartnerView, { title: string; description: string; badge: string }> = {
    pipeline: {
      title: `${pipelineItems.length} ενεργές υποθέσεις στον κύκλο εργασίας`,
      description:
        openFollowupsCount > 0
          ? `Υπάρχουν ${openFollowupsCount} ανοικτές συνέχειες που χρειάζονται παρακολούθηση.`
          : "Οι νέες κρατήσεις και οι σημειώσεις σας συγκεντρώνονται σε ένα σημείο.",
      badge: openFollowupsCount > 0 ? "Χρειάζεται follow-up" : "Ροή σε τάξη",
    },
    appointments: {
      title: `${confirmedBookings.length || displayBookings.length} ραντεβού σε ενεργή διαχείριση`,
      description:
        confirmedBookings.length > 0
          ? "Υπάρχουν επιβεβαιωμένες συνεδρίες που πρέπει να παρακολουθήσετε μέχρι την ολοκλήρωση."
          : "Οι νέες κρατήσεις θα εμφανίζονται εδώ μόλις περάσουν τον έλεγχο επιβεβαίωσης.",
      badge: confirmedBookings.length > 0 ? "Ημέρα σε εξέλιξη" : "Αναμονή νέων ραντεβού",
    },
    performance: {
      title: `${paidBookings} πληρωμένες κρατήσεις στον συνεργατικό κύκλο`,
      description:
        failedPaymentCount + refundIssueCount > 0
          ? `Υπάρχουν ${failedPaymentCount + refundIssueCount} οικονομικές εκκρεμότητες που επηρεάζουν την εικόνα του μήνα.`
          : "Η απόδοση συγκεντρώνει ζήτηση, ολοκληρώσεις και λειτουργικές εκκρεμότητες.",
      badge: failedPaymentCount + refundIssueCount > 0 ? "Θέλει έλεγχο" : "Σταθερή εικόνα",
    },
    availability: {
      title: `${enabledAvailabilityDays} ημέρες ανοιχτές στο εβδομαδιαίο πρόγραμμα`,
      description:
        enabledAvailabilityDays >= 3
          ? "Το δημόσιο πρόγραμμα έχει αρκετές διαθέσιμες ημέρες για να μην κόβεται η ζήτηση."
          : "Ανεβάστε περισσότερες ενεργές ημέρες για να μη χάνεται ενδιαφέρον από το marketplace.",
      badge: enabledAvailabilityDays >= 3 ? "Καλυμμένο πρόγραμμα" : "Χαμηλή κάλυψη",
    },
    profile: {
      title: searchVisibility.ready ? "Το δημόσιο προφίλ μπορεί να εμφανιστεί στην αναζήτηση" : "Το δημόσιο προφίλ δεν είναι ακόμα έτοιμο",
      description: searchVisibility.ready
        ? "Ειδικότητες, τρόποι συνεδρίας και περιγραφή είναι αρκετά για δημόσια προβολή."
        : searchVisibility.loading
          ? "Γίνεται έλεγχος της τρέχουσας δημόσιας εικόνας."
          : "Συμπληρώστε τα σημεία που λείπουν και αποθηκεύστε για να περάσει ο έλεγχος readiness.",
      badge: publicProfileStatus,
    },
    earnings: {
      title: `${formatEuroCents(pendingRevenueCents)} σε αναμονή και ${formatEuroCents(completedRevenueCents)} καθαρά`,
      description:
        pendingRevenueCents > 0
          ? "Υπάρχουν πληρωμές που δεν έχουν κλείσει ακόμα στο οικονομικό flow."
          : "Οι ολοκληρωμένες συνεδρίες έχουν ήδη μεταφερθεί στη συνολική εικόνα εσόδων.",
      badge: pendingRevenueCents > 0 ? "Αναμονή εκκαθάρισης" : "Καθαρή εικόνα",
    },
    settings: {
      title: workspace.notifications.weeklyDigest ? "Οι βασικές ειδοποιήσεις είναι ενεργές" : "Χρειάζεται έλεγχος ρυθμίσεων ειδοποιήσεων",
      description: workspace.notifications.weeklyDigest
        ? "Το σύστημα παραμένει ενεργό για νέα ραντεβού, SMS και εβδομαδιαία σύνοψη."
        : "Ρυθμίστε digest και αυτόματη επιβεβαίωση ώστε να μην χάνεται λειτουργική συνέχεια.",
      badge: workspace.notifications.weeklyDigest ? "Live ρυθμίσεις" : "Θέλει ρύθμιση",
    },
  };
  const focusPanel = focusPanelByView[activeView];

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
    navigate({ search: `?${nextParams.toString()}` }, { replace: true });
  };

  return (
    <PartnerShell className="pb-8">
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
              <Button
                type="button"
                variant="outline"
                onClick={handleSignOut}
                className="h-9 rounded-xl border-[hsl(var(--partner-line))] bg-white/80 px-3 text-xs font-bold text-[hsl(var(--partner-ink))] hover:bg-white"
              >
                Αποσύνδεση
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-[96px] xl:self-start">
            <nav className="partner-panel p-2">
              <div className="grid gap-1">
                {navItems.map(({ id, label, icon: Icon }) => {
                  const active = activeView === id;
                  const badge = navBadges[id];

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectPartnerView(id)}
                      className={`group flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                        active
                          ? "bg-[hsl(var(--partner-navy))] text-white"
                          : "text-[hsl(var(--partner-ink))] hover:bg-white/80"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[hsl(var(--partner-gold))]" : "text-[hsl(var(--partner-navy-soft))]"}`} />
                        <span className="truncate">{label}</span>
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

          <div className="space-y-4">
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
              availabilityHealth={workspace.availability.filter((slot) => slot.enabled).length}
              missingProfileProof={searchVisibility.loading ? [] : searchVisibility.issues}
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

const pipelineStatusLabels: Record<Level4PipelineStatus, string> = {
  booked: "Κρατημένο",
  paid: "Πληρωμένο",
  upcoming: "Επερχόμενο",
  completed: "Ολοκληρωμένο",
  review_pending: "Μετά τη συνεδρία",
  refund_risk: "Πιθανή επιστροφή",
  follow_up_needed: "Χρειάζεται συνέχεια",
};

const partnerBookingStateLabels: Record<BookingState, string> = {
  pending_confirmation: "Σε έλεγχο",
  confirmed_unpaid: "Χρειάζεται πληρωμή",
  confirmed_paid: "Επιβεβαιωμένο",
  completed: "Ολοκληρωμένο",
  cancelled: "Ακυρωμένο",
};

const partnerPaymentStateLabels: Record<PaymentState, string> = {
  not_opened: "Δεν άνοιξε πληρωμή",
  checkout_opened: "Άνοιξε checkout",
  paid: "Πληρωμένο",
  failed: "Απέτυχε",
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

const CompactDarkMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
    <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/44">{label}</p>
    <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
  </div>
);

const PriorityActionCard = ({
  action,
  onSelect,
}: {
  action: PartnerPriorityAction;
  onSelect: () => void;
}) => {
  const Icon = action.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(18,30,44,0.07)] ${getToneClasses(action.tone)}`}
    >
      <span className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/72">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-5">{action.title}</span>
          <span className="mt-1 block text-xs leading-5 opacity-80">{action.description}</span>
        </span>
        <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 opacity-45 transition group-hover:opacity-80" />
      </span>
    </button>
  );
};

const ReadinessRing = ({ score, label }: { score: number; label: string }) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/72 p-4">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold text-[hsl(var(--partner-ink))]"
        style={{ background: `conic-gradient(hsl(var(--sage)) ${clampedScore * 3.6}deg, rgba(18,30,44,0.08) 0deg)` }}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white">{clampedScore}</span>
      </div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    </div>
  );
};

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
  <div className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${getToneClasses(tone)}`}>
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

const getPipelineStatusTone = (status: Level4PipelineStatus): DashboardTone => {
  if (status === "completed" || status === "paid") return "sage";
  if (status === "refund_risk") return "danger";
  if (status === "follow_up_needed") return "amber";
  if (status === "upcoming") return "navy";
  return "neutral";
};

const StageCard = ({ label, value, tone }: { label: string; value: string; tone: DashboardTone }) => (
  <div className={`rounded-xl border px-3 py-2.5 ${getToneClasses(tone)}`}>
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">{label}</p>
    <p className="mt-1 text-xl font-semibold tracking-[-0.03em]">{value}</p>
  </div>
);

const StatusPill = ({ tone, children }: { tone: DashboardTone; children: ReactNode }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${getToneClasses(tone)}`}>
    {children}
  </span>
);

const CaseFact = ({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) => (
  <div className="min-w-0 rounded-xl border border-[hsl(var(--partner-line))] bg-white/72 px-3 py-2">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground">
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
    <p className="mt-1 truncate text-sm font-semibold text-[hsl(var(--partner-ink))]">{value}</p>
  </div>
);

const PerformanceStep = ({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  tone: DashboardTone;
}) => (
  <div className={`rounded-xl border px-3 py-2.5 ${getToneClasses(tone)}`}>
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">{label}</p>
        <p className="mt-0.5 text-xs font-semibold opacity-80">{helper}</p>
      </div>
      <p className="text-2xl font-semibold tracking-[-0.04em]">{value}</p>
    </div>
  </div>
);

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
  const activeItems = items.filter((item) => item.status !== "completed");
  const urgentItems = items.filter((item) => item.status === "refund_risk" || item.status === "follow_up_needed");

  return (
    <section className="space-y-4">
      <div className="partner-panel p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="partner-kicker">Ροή υποθέσεων</p>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Υποθέσεις ανά στάδιο</h3>
            </div>
            <div className="grid grid-cols-3 gap-2 lg:w-[320px]">
              <Metric label="Ενεργές" value={String(activeItems.length)} helper="σε διαχείριση" />
              <Metric label="Επείγοντα" value={String(urgentItems.length)} helper="θέλουν έλεγχο" />
              <Metric label="Σύνολο" value={String(items.length)} helper="υποθέσεις" />
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {counts.map((item) => (
              <StageCard
                key={item.status}
                label={pipelineStatusLabels[item.status]}
                value={String(item.count)}
                tone={getPipelineStatusTone(item.status)}
              />
            ))}
          </div>
      </div>

      <div className="grid gap-4">
        {items.length > 0 ? items.map((item) => {
          const noteDraft = noteDrafts[item.booking.id] || "";
          const followupTitle = followupTitles[item.booking.id] || "";
          const followupDate = followupDates[item.booking.id] || "";
          const paymentState = item.payment ? getCanonicalPaymentState(item.payment) : null;
          const bookingState = getCanonicalBookingState(item.booking);
          const openFollowups = item.followups.filter((task) => task.status === "open");

          return (
            <article key={item.booking.id} className="partner-panel overflow-hidden">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={getPipelineStatusTone(item.status)}>{pipelineStatusLabels[item.status]}</StatusPill>
                        <StatusPill tone={isVerifiedBooking(item.booking) ? "sage" : "amber"}>
                          {isVerifiedBooking(item.booking) ? "Επαληθευμένο" : "Σε έλεγχο"}
                        </StatusPill>
                        <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{item.booking.referenceId}</span>
                      </div>
                      <h4 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{item.booking.clientName}</h4>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.booking.issueSummary || "Δεν έχει καταγραφεί περιγραφή υπόθεσης."}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <CaseFact icon={CalendarCheck2} label="Συνεδρία" value={`${item.booking.dateLabel} · ${item.booking.time}`} />
                        <CaseFact icon={PhoneCall} label="Τύπος" value={item.booking.consultationType} />
                        <CaseFact icon={ReceiptText} label="Πληρωμή" value={paymentState ? partnerPaymentStateLabels[paymentState] : "Καμία"} />
                      </div>
                    </div>
                    <select
                      className="partner-input h-11 xl:w-[220px]"
                      value={item.status}
                      onChange={(event) => onChangeStatus(item.booking, event.target.value as Level4PipelineStatus)}
                    >
                      {level4PipelineStatuses.map((status) => (
                        <option key={status} value={status}>{pipelineStatusLabels[status]}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <Metric label="Κράτηση" value={partnerBookingStateLabels[bookingState]} helper="τρέχουσα κατάσταση" />
                    <Metric label="Έγγραφα" value={String(item.documents.length)} helper="ορατά αρχεία" />
                    <Metric label="Συνέχειες" value={String(openFollowups.length)} helper="ανοιχτές υπενθυμίσεις" />
                  </div>
                </div>

                <div className="border-t border-[hsl(var(--partner-line))] bg-white/48 p-4 lg:border-l lg:border-t-0">
                  <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Εσωτερική συνέχεια</p>
                  <div className="mt-3 grid gap-2">
                    {item.privateNotes.slice(0, 2).map((note) => (
                      <div key={note.id} className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/80 px-3 py-3">
                        <p className="text-xs leading-5 text-muted-foreground">{note.note}</p>
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{formatShortDate(note.createdAt)}</p>
                      </div>
                    ))}
                    {openFollowups.slice(0, 2).map((task) => (
                      <div key={task.id} className="rounded-2xl border border-amber-300/45 bg-amber-50 px-3 py-3 text-amber-900">
                        <p className="text-xs font-bold leading-5">{task.title}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em]">{formatShortDate(task.dueAt)}</p>
                      </div>
                    ))}
                    {item.privateNotes.length === 0 && openFollowups.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-[hsl(var(--partner-line))] bg-white/60 px-3 py-3 text-xs leading-5 text-muted-foreground">
                        Καμία σημείωση ή υπενθύμιση ακόμα.
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-2">
                    <textarea
                      className="partner-textarea min-h-20"
                      value={noteDraft}
                      onChange={(event) => setNoteDrafts((current) => ({ ...current, [item.booking.id]: event.target.value }))}
                      placeholder="Ιδιωτική σημείωση για το γραφείο"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-2xl border-[hsl(var(--partner-line))] bg-white/80 font-bold"
                      onClick={() => {
                        onAddNote(item.booking, noteDraft);
                        setNoteDrafts((current) => ({ ...current, [item.booking.id]: "" }));
                      }}
                    >
                      Αποθήκευση σημείωσης
                    </Button>
                    <input
                      className="partner-input h-11"
                      value={followupTitle}
                      onChange={(event) => setFollowupTitles((current) => ({ ...current, [item.booking.id]: event.target.value }))}
                      placeholder="Τίτλος υπενθύμισης"
                    />
                    <input
                      className="partner-input h-11"
                      type="datetime-local"
                      value={followupDate}
                      onChange={(event) => setFollowupDates((current) => ({ ...current, [item.booking.id]: event.target.value }))}
                    />
                    <Button
                      type="button"
                      className="h-11 rounded-2xl font-bold"
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
}) => {
  const scheduledCount = bookings.filter((booking) => isBookingScheduled(booking)).length;
  const completedCount = bookings.filter((booking) => booking.status === "completed").length;
  const reviewCount = bookings.filter((booking) => !isVerifiedBooking(booking)).length;

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

        <div className="mt-4 grid gap-3">
          {bookings.length > 0 ? bookings.map((booking) => {
            const bookingDocuments = documents.filter((document) => document.bookingId === booking.id);
            const currentAction = actionState[booking.id];
            const verified = isVerifiedBooking(booking);
            const bookingState = getCanonicalBookingState(booking);
            const canMarkComplete = bookingState === "confirmed_paid";
            const scheduled = isBookingScheduled(booking);

            return (
              <article key={booking.referenceId} className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/68 p-4">
                <div className="grid gap-4 lg:grid-cols-[120px_minmax(0,1fr)_260px] lg:items-start">
                  <div className="rounded-xl border border-[hsl(var(--partner-line))] bg-[hsl(var(--partner-ivory))]/80 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{booking.dateLabel}</p>
                    <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">{booking.time}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{booking.consultationType}</p>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={verified ? "sage" : "danger"}>{verified ? "Επαληθευμένο" : "Σε έλεγχο"}</StatusPill>
                      <StatusPill tone={bookingState === "confirmed_paid" ? "sage" : "amber"}>{partnerBookingStateLabels[bookingState]}</StatusPill>
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{booking.referenceId}</span>
                    </div>
                    <h4 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{booking.clientName}</h4>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{booking.issueSummary || "Δεν υπάρχει διαθέσιμη περιγραφή υπόθεσης."}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <CaseFact icon={PhoneCall} label="Τηλέφωνο" value={booking.clientPhone || "Δεν δηλώθηκε"} />
                      <CaseFact icon={MailCheck} label="Email" value={booking.clientEmail || "Δεν δηλώθηκε"} />
                      <CaseFact icon={WalletCards} label="Αμοιβή" value={formatEuroCents(booking.price * 100)} />
                    </div>
                    {!verified ? (
                      <p className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-3 text-xs font-semibold leading-5 text-destructive">
                        Περιμένετε επιβεβαίωση συστήματος πριν σημάνετε ολοκλήρωση ή πριν ανοίξετε οικονομική συνέχεια.
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    {scheduled && verified ? (
                      <>
                        <Button type="button" onClick={() => onComplete(booking)} disabled={currentAction?.loading || !canMarkComplete} className="h-11 rounded-2xl font-bold">
                          {canMarkComplete ? "Σήμανση ολοκληρωμένου" : "Αναμονή πληρωμής"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onCancel(booking)}
                          disabled={currentAction?.loading}
                          className="h-11 rounded-2xl border-destructive/25 bg-white/75 font-bold text-destructive hover:text-destructive"
                        >
                          Ακύρωση ή αλλαγή ώρας
                        </Button>
                      </>
                    ) : scheduled && !verified ? (
                      <Button type="button" disabled className="h-11 rounded-2xl font-bold">
                        Χρειάζεται επιβεβαίωση
                      </Button>
                    ) : (
                      <StatusPill tone={booking.status === "completed" ? "sage" : "neutral"}>{partnerBookingStateLabels[bookingState]}</StatusPill>
                    )}

                    <div className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/72 p-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--partner-ink))]">
                        <FileText className="h-4 w-4" />
                        Έγγραφα ({bookingDocuments.length})
                      </p>
                      <div className="mt-2 grid gap-2">
                        {bookingDocuments.length > 0 ? bookingDocuments.slice(0, 3).map((document) => (
                          <a
                            key={document.id}
                            href={document.downloadUrl || undefined}
                            target="_blank"
                            rel="noreferrer"
                            className={`truncate rounded-xl border border-[hsl(var(--partner-line))] bg-white/80 px-3 py-2 text-xs font-semibold ${
                              document.downloadUrl ? "text-[hsl(var(--partner-ink))]" : "pointer-events-none text-muted-foreground"
                            }`}
                          >
                            {document.name}
                          </a>
                        )) : (
                          <p className="text-xs leading-5 text-muted-foreground">Δεν υπάρχουν ορατά αρχεία για αυτό το ραντεβού.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {currentAction?.message ? (
                  <div className="mt-4">
                    <SaveMessage saveState={currentAction} />
                  </div>
                ) : null}
              </article>
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
    </section>
  );
};

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
}) => {
  const enabledSlots = workspace.availability.filter((slot) => slot.enabled);
  const coverageTone: DashboardTone = enabledSlots.length >= 4 ? "sage" : enabledSlots.length >= 2 ? "amber" : "danger";

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="partner-panel p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="partner-kicker">Εβδομαδιαίο πρόγραμμα</p>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Ώρες κράτησης</h3>
            </div>
            <StatusPill tone={coverageTone}>{enabledSlots.length}/5 ημέρες ενεργές</StatusPill>
          </div>

          <div className="mt-4 grid gap-2">
            {workspace.availability.map((slot) => (
              <div key={slot.day} className={`rounded-2xl border px-3 py-3 transition ${slot.enabled ? "border-[hsl(var(--partner-line))] bg-white/72" : "border-dashed border-[hsl(var(--partner-line))] bg-white/38"}`}>
                <div className="grid gap-3 lg:grid-cols-[150px_1fr_1fr_minmax(180px,1.2fr)] lg:items-end">
                  <div>
                    <p className="text-sm font-bold text-[hsl(var(--partner-ink))]">{slot.day}</p>
                    <button
                      type="button"
                      onClick={() => updateAvailability(slot.day, { enabled: !slot.enabled })}
                      className={`mt-2 inline-flex min-w-[96px] items-center justify-center rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        slot.enabled
                          ? "border-[hsl(var(--sage))]/25 bg-[hsl(var(--sage))]/10 text-[hsl(var(--sage-foreground))]"
                          : "border-[hsl(var(--partner-line))] bg-white/70 text-muted-foreground"
                      }`}
                    >
                      {slot.enabled ? "Ανοιχτό" : "Κλειστό"}
                    </button>
                  </div>
                  <Field label="Από">
                    <input type="time" className="partner-input h-12" value={slot.start} onChange={(event) => updateAvailability(slot.day, { start: event.target.value })} />
                  </Field>
                  <Field label="Έως">
                    <input type="time" className="partner-input h-12" value={slot.end} onChange={(event) => updateAvailability(slot.day, { end: event.target.value })} />
                  </Field>
                  <Field label="Σημείωση για το πρόγραμμα">
                    <input className="partner-input h-12" value={slot.note} onChange={(event) => updateAvailability(slot.day, { note: event.target.value })} placeholder="π.χ. μόνο επείγοντα" />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="partner-panel p-4">
            <p className="partner-kicker">Υγεία marketplace</p>
            <div className="mt-3 grid gap-2">
              <SignalRow icon={Clock3} label="Κάλυψη" value={`${enabledSlots.length} ημέρες`} tone={coverageTone} />
              <SignalRow icon={TimerReset} label="Κενό" value={`${workspace.profile.bufferMinutes} λεπτά`} tone={workspace.profile.bufferMinutes <= 30 ? "sage" : "amber"} />
              <SignalRow icon={CalendarClock} label="Παράθυρο" value={`${workspace.profile.bookingWindowDays} ημέρες`} tone={workspace.profile.bookingWindowDays >= 14 ? "sage" : "amber"} />
            </div>
          </div>

          <div className="partner-panel p-4">
            <p className="partner-kicker">Κανόνες κράτησης</p>
            <div className="mt-3 grid gap-3">
              <NumberField label="Χρόνος κενού ανά ραντεβού" value={workspace.profile.bufferMinutes} suffix="λεπτά" onChange={(bufferMinutes) => updateProfile({ bufferMinutes })} />
              <NumberField label="Παράθυρο κράτησης" value={workspace.profile.bookingWindowDays} suffix="ημέρες" onChange={(bookingWindowDays) => updateProfile({ bookingWindowDays })} />
              <ToggleRow
                title="Αυτόματη επιβεβαίωση"
                description="Οι νέες κρατήσεις μπαίνουν στο πρόγραμμα χωρίς χειροκίνητη έγκριση."
                enabled={workspace.profile.autoConfirm}
                onToggle={() => updateProfile({ autoConfirm: !workspace.profile.autoConfirm })}
              />
            </div>
          </div>
        </aside>
      </div>

      <SectionSaveFooter onSave={onSave} saveState={saveState} hasUnsavedChanges={hasUnsavedChanges} />
    </section>
  );
};

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
}) => {
  const activeModes = workspace.profile.consultationModes;

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="partner-panel p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="partner-kicker">Δημόσια παρουσία</p>
              <h3 className="mt-1 truncate text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">
                {workspace.profile.displayName || "Προφίλ δικηγόρου"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{workspace.profile.primarySpecialty} · {workspace.profile.city}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 lg:w-[360px]">
              <Metric label="Ειδικότητες" value={String(workspace.profile.specialties.length)} helper="κατηγορίες" />
              <Metric label="Τρόποι" value={String(activeModes.length)} helper="συνεδρίες" />
              <Metric label="Γλώσσες" value={String(workspace.profile.languages.length)} helper="δημόσια" />
            </div>
          </div>
        </div>

        <SearchVisibilityCard searchVisibility={searchVisibility} hasUnsavedChanges={hasUnsavedChanges} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <section className="partner-panel p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="partner-kicker">Βασικά στοιχεία</p>
                <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Ταυτότητα και τοποθέτηση</h3>
              </div>
              <BadgeCheck className="h-5 w-5 text-[hsl(var(--sage))]" />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Αναγνωριστικό επαληθευμένου προφίλ δικηγόρου">
                <div className="rounded-xl border border-[hsl(var(--partner-line))] bg-white/65 px-3 py-2.5 text-sm font-semibold text-muted-foreground">
                  {workspace.profile.lawyerId}
                </div>
              </Field>
              <Field label="Εμφανιζόμενο όνομα">
                <input className="partner-input" value={workspace.profile.displayName} onChange={(event) => updateProfile({ displayName: event.target.value })} />
              </Field>
              <Field label="Γραφείο">
                <input className="partner-input" value={workspace.profile.officeName} onChange={(event) => updateProfile({ officeName: event.target.value })} />
              </Field>
              <Field label="Πόλη">
                <select className="partner-input" value={workspace.profile.city} onChange={(event) => updateProfile({ city: event.target.value })}>
                  {partnerCityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </Field>
              <Field label="Κύρια ειδικότητα">
                <select className="partner-input" value={workspace.profile.primarySpecialty} onChange={(event) => updateProfile({ primarySpecialty: event.target.value, specialties: Array.from(new Set([event.target.value, ...workspace.profile.specialties])).filter(Boolean) })}>
                  {partnerPracticeAreaOptions.map((area) => (
                    <option key={area} value={area}>{area}</option>
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
              <Field label="Γλώσσες">
                <input className="partner-input" value={formatListInput(workspace.profile.languages)} onChange={(event) => updateProfile({ languages: parseListInput(event.target.value) })} />
              </Field>
            </div>
          </section>

          <section className="partner-panel p-4">
            <p className="partner-kicker">Ειδικότητες</p>
            <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-[hsl(var(--partner-line))] bg-white/60 p-3">
              {partnerPracticeAreaOptions.map((area) => {
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
          </section>

          <section className="partner-panel p-4">
            <p className="partner-kicker">Κείμενα που βλέπει ο πελάτης</p>
            <Field label="Ιδανικός/ή για">
              <textarea
                value={workspace.profile.bestFor}
                onChange={(event) => updateProfile({ bestFor: event.target.value })}
                className="partner-textarea min-h-28"
              />
            </Field>
            <Field label="Σύντομη περιγραφή">
              <textarea
                value={workspace.profile.bio}
                onChange={(event) => updateProfile({ bio: event.target.value })}
                className="partner-textarea min-h-32"
              />
            </Field>
          </section>

          <section className="partner-panel p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="partner-kicker">Τρόποι συνεδρίας</p>
                <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Προσφορά και περιγραφές</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {consultationModeOptions.map((mode) => {
                  const active = activeModes.includes(mode);
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        updateProfile({
                          consultationModes: active
                            ? activeModes.filter((item) => item !== mode)
                            : [...activeModes, mode],
                        })
                      }
                      className={`partner-chip ${active ? "partner-chip-active" : ""}`}
                    >
                      {partnerConsultationModeLabels[mode]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 grid gap-3">
              {consultationModeOptions.map((mode) => (
                <Field key={mode} label={`Περιγραφή ${partnerConsultationModeLabels[mode]}`}>
                  <textarea
                    value={getConsultationDescription(workspace.profile, mode)}
                    onChange={(event) => updateProfile(buildConsultationDescriptionUpdate(mode, event.target.value))}
                    className="partner-textarea min-h-24"
                  />
                </Field>
              ))}
            </div>
            <Field label="Πολιτική ακύρωσης">
              <textarea
                value={workspace.profile.cancellationPolicy}
                onChange={(event) => updateProfile({ cancellationPolicy: event.target.value })}
                className="partner-textarea min-h-24"
              />
            </Field>
          </section>
        </div>

        <aside className="space-y-4">
          <ProfilePhotoModerationCard
            photoState={profilePhotoState}
            uploadState={profilePhotoUploadState}
            onSubmit={onProfilePhotoSubmit}
          />

          <section className="partner-panel p-4">
            <p className="partner-kicker">Τιμές</p>
            <div className="mt-3 grid gap-3">
              <NumberField label={partnerConsultationModeLabels.video} value={workspace.profile.videoPrice} suffix="€" onChange={(videoPrice) => updateProfile({ videoPrice })} />
              <NumberField label={partnerConsultationModeLabels.phone} value={workspace.profile.phonePrice} suffix="€" onChange={(phonePrice) => updateProfile({ phonePrice })} />
              <NumberField label={partnerConsultationModeLabels.inPerson} value={workspace.profile.inPersonPrice} suffix="€" onChange={(inPersonPrice) => updateProfile({ inPersonPrice })} />
            </div>
          </section>

          <section className="partner-dark-panel p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--partner-gold))]">Ποιότητα προφίλ</p>
            <div className="mt-3 grid gap-2">
              <CompactDarkMetric label="Όνομα" value={workspace.profile.displayName ? "OK" : "Λείπει"} />
              <CompactDarkMetric label="Bio" value={workspace.profile.bio.length >= 80 ? "Ισχυρό" : "Σύντομο"} />
              <CompactDarkMetric label="Τιμές" value={workspace.profile.videoPrice || workspace.profile.phonePrice || workspace.profile.inPersonPrice ? "OK" : "Λείπουν"} />
            </div>
          </section>
        </aside>
      </div>

      <SectionSaveFooter onSave={onSave} saveState={saveState} hasUnsavedChanges={hasUnsavedChanges} />
    </section>
  );
};

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
    <div className="partner-panel p-4">
      <p className="partner-kicker">Φωτογραφία προφίλ</p>
      <div className="mt-3 grid gap-3">
        <div className="flex items-start gap-3">
          {photoState?.approvedImageUrl ? (
            <img
              src={photoState.approvedImageUrl}
              alt="Εγκεκριμένη φωτογραφία προφίλ"
              className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-[hsl(var(--partner-line))]"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-[hsl(var(--partner-line))] bg-white/60 px-2 text-center text-[10px] font-bold leading-4 text-muted-foreground">
              Χωρίς φωτογραφία
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Δημόσια εγκεκριμένη φωτογραφία</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Οι νέες φωτογραφίες εμφανίζονται μετά από έλεγχο.</p>
          </div>
        </div>

        {pendingSubmission ? (
          <div className="rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-bold">Υπάρχει φωτογραφία σε αναμονή έγκρισης.</p>
            <p className="mt-1 leading-6">
              {pendingSubmission.fileName} · {formatFileSize(pendingSubmission.size)} · υποβλήθηκε{" "}
              {new Date(pendingSubmission.submittedAt).toLocaleDateString("el-GR")}
            </p>
          </div>
        ) : null}

        {!pendingSubmission && latestRejectedSubmission ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
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
            className="mt-2 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-[hsl(var(--partner-navy))] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
          />
        </label>

        {previewUrl && selectedFile ? (
          <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--partner-line))] bg-white/65 p-2.5">
            <img src={previewUrl} alt="Προεπισκόπηση νέας φωτογραφίας" className="h-14 w-14 rounded-lg object-cover" />
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
          className="h-10 rounded-xl px-4 text-sm font-bold"
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
    <div className="partner-panel p-4">
      <p className="partner-kicker">Ορατότητα στην αναζήτηση</p>
      <div className={`mt-3 rounded-xl border px-3 py-3 ${statusTone}`}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${searchVisibility.ready ? "text-[hsl(var(--sage-foreground))]" : "text-amber-700"}`} />
          <div>
            <p className="text-sm font-bold">{statusLabel}</p>
            <p className="mt-1 text-xs leading-5 opacity-80">{helperText}</p>
          </div>
        </div>
      </div>

      {!searchVisibility.loading && searchVisibility.issues.length > 0 ? (
        <div className="mt-3 rounded-xl border border-[hsl(var(--partner-line))] bg-white/65 p-3">
          <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Τι χρειάζεται να διορθώσετε</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
            {searchVisibility.issues.map((issue) => (
              <li key={issue} className="flex items-start gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[hsl(var(--partner-navy-soft))]" />
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
  const paidPayments = payments.filter((payment) => getCanonicalPaymentState(payment) === "paid");
  const attentionPayments = payments.filter((payment) => {
    const state = getCanonicalPaymentState(payment);
    return state === "failed" || state === "refund_requested" || state === "checkout_opened";
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
            <Metric label="Καθαρό ποσό" value={formatEuroCents(completedRevenueCents)} helper={`${completedBookings.length} ολοκληρωμένες συνεδρίες`} />
            <Metric label="Σε αναμονή" value={formatEuroCents(pendingRevenueCents)} helper={`${confirmedBookings.length} ενεργές κρατήσεις`} />
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
            <EmptyPartnerState icon={CreditCard} title="Δεν υπάρχουν οικονομικές κινήσεις" description="Οι πληρωμές θα εμφανίζονται όταν υπάρξουν κρατήσεις." />
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
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="partner-panel p-4">
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
          <div className="grid gap-3 md:grid-cols-2">
            <NumberField label="Χρόνος κενού" value={workspace.profile.bufferMinutes} suffix="λεπτά" onChange={(bufferMinutes) => updateProfile({ bufferMinutes })} />
            <NumberField label="Παράθυρο κράτησης" value={workspace.profile.bookingWindowDays} suffix="ημέρες" onChange={(bookingWindowDays) => updateProfile({ bookingWindowDays })} />
          </div>
        </div>
      </div>

      <aside className="partner-dark-panel p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--partner-gold))]">Λειτουργικοί κανόνες</p>
        <div className="mt-3 grid gap-2">
          <CompactDarkMetric label="Κράτηση" value={workspace.profile.autoConfirm ? "Γρήγορη" : "Με έλεγχο"} />
          <CompactDarkMetric label="Buffer" value={`${workspace.profile.bufferMinutes} λεπτά`} />
          <CompactDarkMetric label="Παράθυρο" value={`${workspace.profile.bookingWindowDays} ημέρες`} />
        </div>
      </aside>
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
          <SignalRow icon={SearchCheck} label="Προφίλ" value={workspace.profile.displayName ? "Ταυτοποιημένο" : "Λείπει όνομα"} tone={workspace.profile.displayName ? "sage" : "danger"} />
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

const PartnerPerformanceDashboard = ({
  profileViews,
  searchAppearances,
  profileBookingStarts,
  bookingStarts,
  paidBookings,
  completedFirstConsultations,
  responseSpeed,
  categoryPerformance,
  availabilityHealth,
  missingProfileProof,
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
  availabilityHealth: number;
  missingProfileProof: string[];
  pendingPaymentIssues: number;
}) => {
  const paidRate = bookingStarts > 0 ? Math.round((paidBookings / bookingStarts) * 100) : 0;
  const completionRate = paidBookings > 0 ? Math.round((completedFirstConsultations / paidBookings) * 100) : 0;

  return (
    <section className="space-y-4">
      <div className="partner-panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="partner-kicker">Απόδοση συνεργασίας</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Μετρήσεις συνεργασίας</h3>
          </div>
          <StatusPill tone={pendingPaymentIssues || missingProfileProof.length ? "amber" : "sage"}>
            {pendingPaymentIssues || missingProfileProof.length ? "Θέλει έλεγχο" : "Σε καλή κατάσταση"}
          </StatusPill>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
          <Metric label="Προβολές προφίλ" value={profileViews === null ? "—" : String(profileViews)} helper="μόνο από αναλυτικά στοιχεία συστήματος" />
          <Metric label="Εμφανίσεις" value={searchAppearances === null ? "—" : String(searchAppearances)} helper="μόνο από αναλυτικά στοιχεία συστήματος" />
          <Metric label="Προς κράτηση" value={profileBookingStarts === null ? "—" : String(profileBookingStarts)} helper="μόνο από αναλυτικά στοιχεία συστήματος" />
          <Metric label="Κρατήσεις" value={String(bookingStarts)} helper={`${paidBookings} πληρωμένες`} />
          <Metric label="Πρώτες συνεδρίες" value={String(completedFirstConsultations)} helper="ολοκληρωμένες" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="partner-panel p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="partner-kicker">Μετατροπή</p>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Από κράτηση σε ολοκλήρωση</h3>
            </div>
            <Gauge className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-3 grid gap-3">
            <PerformanceStep label="Κρατήσεις" value={bookingStarts} helper="όλες οι εισερχόμενες κρατήσεις" tone="navy" />
            <PerformanceStep label="Πληρωμένες" value={paidBookings} helper={`${paidRate}% των κρατήσεων`} tone={paidRate >= 60 ? "sage" : "amber"} />
            <PerformanceStep label="Ολοκληρωμένες" value={completedFirstConsultations} helper={`${completionRate}% των πληρωμένων`} tone={completionRate >= 70 ? "sage" : "amber"} />
          </div>
        </section>

        <aside className="space-y-4">
          <section className="partner-panel p-4">
            <p className="partner-kicker">Λειτουργική υγεία</p>
            <div className="mt-3 grid gap-2">
              <SignalRow icon={Clock3} label="Διαθεσιμότητα" value={`${availabilityHealth} ημέρες`} tone={availabilityHealth >= 3 ? "sage" : "amber"} />
              <SignalRow icon={WalletCards} label="Πληρωμές" value={String(pendingPaymentIssues)} tone={pendingPaymentIssues > 0 ? "danger" : "sage"} />
              <SignalRow icon={SearchCheck} label="Προφίλ" value={missingProfileProof.length ? `${missingProfileProof.length} κενά` : "Έτοιμο"} tone={missingProfileProof.length ? "amber" : "sage"} />
            </div>
          </section>

          <section className="partner-dark-panel p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--partner-gold))]">Πού να εστιάσετε</p>
            <div className="mt-3 grid gap-2">
              {missingProfileProof.length > 0 ? missingProfileProof.slice(0, 3).map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs leading-5 text-white/76">
                  {item}
                </div>
              )) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs leading-5 text-white/76">
                  Προφίλ και βασική λειτουργία σε καλή κατάσταση.
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs leading-5 text-white/76">
                Κατηγορίες: {categoryPerformance.length ? categoryPerformance.join(", ") : "συμπληρώστε ειδικότητες"}. Απόκριση: {responseSpeed}.
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
};

