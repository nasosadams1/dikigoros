import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
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
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";
import { consultationModeLabels, type ConsultationMode, type Lawyer } from "@/data/lawyers";
import { getLawyerBaseProfileById, getPublicLawyerProfileReadiness } from "@/lib/lawyerRepository";
import {
  clearPartnerSession,
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
  applyPartnerWorkspaceToLawyer,
  fetchPartnerWorkspace,
  formatListInput,
  getPartnerWorkspace,
  parseListInput,
  syncPartnerWorkspace,
  type PartnerAvailabilitySlot,
  type PartnerWorkspace,
} from "@/lib/partnerWorkspace";

const navItems = [
  { id: "appointments", label: "Ραντεβού", icon: CalendarDays },
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
  appointments: {
    title: "Ραντεβού και αιτήματα με καθαρή εικόνα ημέρας.",
    description: "Δείτε κρατήσεις, στοιχεία πελάτη, θέμα, κατάσταση και τις επόμενες ενέργειες.",
  },
  availability: {
    title: "Διαθεσιμότητα που αποθηκεύεται άμεσα.",
    description: "Ορίστε ημέρες, ώρες, σημειώσεις, buffers και κανόνες κράτησης.",
  },
  profile: {
    title: "Επεξεργάσιμο δημόσιο προφίλ συνεργάτη.",
    description: "Διαχειριστείτε ειδικότητες, γλώσσες, τρόπους συνεδρίας, τιμές και πολιτική ακύρωσης.",
  },
  earnings: {
    title: "Πληρωμές, εκταμιεύσεις και τιμολόγια.",
    description: "Παρακολουθήστε ολοκληρωμένες συνεδρίες, έσοδα σε αναμονή και αποδείξεις πλατφόρμας.",
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
    return "Λείπει το Supabase RPC save_partner_workspace_as_partner. Τρέξτε πρώτα το SQL migration και μετά κάντε ξανά αποθήκευση.";
  }

  if (message.includes("PARTNER_SESSION_INVALID")) {
    return "Η πρόσβαση συνεργάτη έληξε. Συνδεθείτε ξανά και δοκιμάστε πάλι.";
  }

  if (message.includes("401") || message.includes("Unauthorized") || message.includes("JWT")) {
    return "Το αίτημα απορρίφθηκε ως μη εξουσιοδοτημένο από το Supabase. Κάντε αποσύνδεση και ξανά είσοδο στον πίνακα συνεργάτη.";
  }

  if (message.includes("LAWYER_PROFILE_NOT_FOUND")) {
    return "Ο συνεργάτης δεν είναι συνδεδεμένος με υπαρκτό lawyer profile στη βάση.";
  }

  return "Δεν έγινε αποθήκευση στο Supabase. Ελέγξτε τη σύνδεση και δοκιμάστε πάλι.";
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
    ])
      .then(([nextBookings, nextPayments, nextReviews, nextDocuments]) => {
        if (!active) return;
        setPartnerBookings(nextBookings);
        setPartnerPayments(nextPayments);
        setPartnerReviews(nextReviews);
        setPartnerDocuments(nextDocuments);
      })
      .catch((error) => {
        if (!active) return;
        if (isPartnerSessionInvalidError(error)) handleExpiredPartnerSession();
      });

    return () => {
      active = false;
    };
  }, [bookingsVersion, handleExpiredPartnerSession, session, workspace.profile.lawyerId]);

  const displayBookings = partnerBookings;
  const confirmedBookings = partnerBookings.filter((booking) => booking.status === "confirmed");
  const completedBookings = partnerBookings.filter((booking) => booking.status === "completed");
  const completedRevenue = partnerPayments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const pendingRevenue = partnerPayments
    .filter((payment) => payment.status === "pending")
    .reduce((sum, payment) => sum + payment.amount, 0);
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

  const completeBooking = (booking?: StoredBooking) => {
    if (!booking) return;
    void completeBookingPersisted(booking);
  };

  const completeBookingPersisted = async (booking: StoredBooking) => {
    if (!isVerifiedBooking(booking)) {
      setBookingActionState((current) => ({
        ...current,
        [booking.id]: {
          loading: false,
          message: "Αυτό το ραντεβού υπάρχει μόνο τοπικά. Δημιουργήστε πραγματική Supabase κράτηση πριν σημειωθεί ως ολοκληρωμένο.",
          tone: "error",
        },
      }));
      return;
    }

    setBookingActionState((current) => ({
      ...current,
      [booking.id]: {
        loading: true,
        message: "Συγχρονισμός ολοκλήρωσης στο Supabase...",
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
            message: "Το ραντεβού ολοκληρώθηκε στο Supabase. Ο πελάτης μπορεί να αφήσει κριτική.",
            tone: "success",
          }
        : {
            loading: false,
            message:
              result.error?.includes("BOOKING_NOT_FOUND")
                ? "Δεν βρέθηκε αυτό το ραντεβού στο Supabase. Δημιουργήθηκε μόνο τοπικά, άρα χρειάζεται νέα πραγματική κράτηση ή χειροκίνητη καταχώρηση στη βάση."
                : "Δεν έγινε συγχρονισμός. Ξανατρέξτε το SQL, αποσυνδεθείτε και συνδεθείτε ξανά στον πίνακα συνεργάτη και δοκιμάστε ξανά.",
            tone: "error",
          },
    }));

    if (result.synced) setBookingsVersion((version) => version + 1);
  };

  const handleSignOut = () => {
    clearPartnerSession();
    navigate("/for-lawyers/login", { replace: true });
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
                  onClick={() => setActiveView(id)}
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
                <Metric label="Σε αναμονή" value={`€${pendingRevenue}`} helper="προς εκκαθάριση" />
                <Metric label="Αξιολόγηση" value={averageReview} helper={`${partnerReviews.length} κριτικές`} />
              </div>
            </div>
          </section>

          {activeView === "appointments" ? (
            <AppointmentsView
              bookings={displayBookings}
              documents={partnerDocuments}
              actionState={bookingActionState}
              onComplete={completeBooking}
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
              hasUnsavedChanges={hasUnsavedChanges}
              saveState={profileSaveState}
            />
          ) : null}

          {activeView === "earnings" ? (
            <EarningsView
              completedRevenue={completedRevenue}
              pendingRevenue={pendingRevenue}
              completedBookings={completedBookings}
              confirmedBookings={confirmedBookings}
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

const AppointmentsView = ({
  bookings,
  documents,
  actionState,
  onComplete,
}: {
  bookings: StoredBooking[];
  documents: StoredBookingDocument[];
  actionState: Record<string, BookingActionState>;
  onComplete: (booking?: StoredBooking) => void;
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

        return (
        <div key={booking.referenceId} className="rounded-[1.4rem] border border-[hsl(var(--partner-line))] bg-white/65 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-[hsl(var(--partner-ink))]">{booking.clientName}</p>
                <span className="rounded-full bg-[hsl(var(--partner-navy-soft))]/10 px-2.5 py-1 text-[11px] font-bold text-[hsl(var(--partner-navy-soft))]">
                  {booking.status === "completed" ? "Ολοκληρωμένο" : booking.status === "cancelled" ? "Ακυρωμένο" : "Επιβεβαιωμένο"}
                </span>
                {!verified ? (
                  <span className="rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-[11px] font-bold text-destructive">
                    Μόνο τοπικά
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{booking.issueSummary || booking.consultationType}</p>
              {!verified ? (
                <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-semibold leading-5 text-destructive">
                  Δεν υπάρχει επαληθευμένη εγγραφή Supabase. Μην το σημάνετε ως ολοκληρωμένο, μην το χρεώσετε και δημιουργήστε πραγματική κράτηση.
                </p>
              ) : null}
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{booking.referenceId}</p>
            </div>
            <div className="flex flex-col gap-3 text-left lg:items-end lg:text-right">
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--partner-navy-soft))]">{booking.dateLabel} | {booking.time}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{booking.consultationType} · €{booking.price}</p>
              </div>
              {booking.status === "confirmed" && verified ? (
                <Button type="button" onClick={() => onComplete(booking)} disabled={currentAction?.loading} className="rounded-xl font-semibold">
                  Σήμανση ολοκληρωμένου
                </Button>
              ) : booking.status === "confirmed" && !verified ? (
                <Button type="button" disabled className="rounded-xl font-semibold">
                  Χρειάζεται Supabase κράτηση
                  <span className="hidden">
                  Sync ολοκλήρωσης στο Supabase
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
          description="Οι νέες κρατήσεις θα εμφανίζονται εδώ από την υποδομή και από την τοπική ουρά εκτός σύνδεσης."
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
          <input className="partner-input" value={workspace.profile.primarySpecialty} onChange={(event) => updateProfile({ primarySpecialty: event.target.value })} />
        </Field>
        <Field label="Γραφείο">
          <input className="partner-input" value={workspace.profile.officeName} onChange={(event) => updateProfile({ officeName: event.target.value })} />
        </Field>
        <Field label="Πόλη">
          <input className="partner-input" value={workspace.profile.city} onChange={(event) => updateProfile({ city: event.target.value })} />
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
          <input className="partner-input" value={formatListInput(workspace.profile.specialties)} onChange={(event) => updateProfile({ specialties: parseListInput(event.target.value) })} />
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
  completedRevenue,
  pendingRevenue,
  completedBookings,
  confirmedBookings,
}: {
  completedRevenue: number;
  pendingRevenue: number;
  completedBookings: StoredBooking[];
  confirmedBookings: StoredBooking[];
}) => (
  <section className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3">
      <Metric label="Ολοκληρωμένα" value={`€${completedRevenue}`} helper={`${completedBookings.length} συνεδρίες`} />
      <Metric label="Σε αναμονή" value={`€${pendingRevenue}`} helper={`${confirmedBookings.length} κρατήσεις`} />
      <Metric label="Προμήθεια" value="12%" helper="τρέχουσα δοκιμαστική σύμβαση" />
    </div>

    <div className="partner-panel p-7 sm:p-8">
      <p className="partner-kicker">Τιμολόγια και εκταμιεύσεις</p>
      <h3 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Οικονομικές κινήσεις</h3>
      <div className="mt-6 space-y-3">
        {[...completedBookings, ...confirmedBookings].length > 0 ? (
          [...completedBookings, ...confirmedBookings].map((booking) => (
            <div key={booking.id} className="rounded-[1.2rem] border border-[hsl(var(--partner-line))] bg-white/65 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-[hsl(var(--partner-ink))]">{booking.referenceId}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{booking.clientName} · {booking.consultationType}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-lg font-semibold text-[hsl(var(--partner-ink))]">€{booking.price}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {booking.status === "completed" ? "έτοιμο για εκταμίευση" : "σε αναμονή ολοκλήρωσης"}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyPartnerState icon={CreditCard} title="Δεν υπάρχουν οικονομικές κινήσεις" description="Οι πληρωμές θα εμφανίζονται όταν υπάρξουν κρατήσεις." />
        )}
      </div>
    </div>
  </section>
);

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
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${review.status === "flagged" ? "bg-destructive/10 text-destructive" : "bg-[hsl(var(--sage))]/15 text-[hsl(var(--sage-foreground))]"}`}>
                  {review.status === "flagged" ? "Σε έλεγχο" : "Δημοσιευμένη"}
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
              onClick={() => updateReview(review.id, { status: review.status === "flagged" ? "published" : "flagged" })}
              className="rounded-xl border-[hsl(var(--partner-line))] bg-white/70 text-[hsl(var(--partner-ink))] hover:bg-white"
            >
              {review.status === "flagged" ? "Άρση σήμανσης" : "Σήμανση"}
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
