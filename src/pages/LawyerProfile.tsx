import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Award,
  Briefcase,
  CheckCircle2,
  Clock,
  Heart,
  Languages,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import LawyerPhoto from "@/components/LawyerPhoto";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import { consultationModeIcons, type Lawyer } from "@/data/lawyers";
import { useAuth } from "@/context/AuthContext";
import { canSubmitReview, reviewPublicationStateLabels } from "@/lib/bookingState";
import { areLawyerIdsEqual, fetchPartnerLawyerId, getStoredPartnerLawyerId } from "@/lib/partnerIdentity";
import { getLawyerById, getLawyerReviews, type PublicLawyerReview } from "@/lib/lawyerRepository";
import { fetchPartnerAvailabilityRulesForLawyer } from "@/lib/partnerWorkspace";
import { fetchBookingsForUser, fetchReservedBookingSlots, getPartnerSession, type StoredBooking } from "@/lib/platformRepository";
import {
  formatCurrency,
  getLowestConsultation,
  getNextAvailabilityOptions,
  type AvailabilityRules,
} from "@/lib/marketplace";
import { fetchUserWorkspace, getUserWorkspace, syncUserWorkspace, toggleSavedLawyer, upsertUserReviewPersisted, type UserReview } from "@/lib/userWorkspace";
import { trackFunnelEvent } from "@/lib/funnelAnalytics";
import { cn } from "@/lib/utils";

type ReviewDraft = {
  rating: number;
  clarityRating: number;
  responsivenessRating: number;
  text: string;
};

type ReviewActionState = {
  loading: boolean;
  message: string;
  tone: "success" | "error" | "info";
};

const createDefaultReviewDraft = (): ReviewDraft => ({
  rating: 0,
  clarityRating: 0,
  responsivenessRating: 0,
  text: "",
});

const createReviewDraftFromRecord = (review?: UserReview | null): ReviewDraft => ({
  rating: review?.rating ?? 0,
  clarityRating: review?.clarityRating ?? 0,
  responsivenessRating: review?.responsivenessRating ?? 0,
  text: review?.text ?? "",
});

const getReviewTone = (status: UserReview["status"]) =>
  status === "published"
    ? "success"
    : status === "rejected"
      ? "danger"
      : status === "draft"
        ? "muted"
        : "attention";

const LawyerProfile = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const partnerSession = getPartnerSession();
  const workspaceKey = user?.id || partnerSession?.email;
  const [workspace, setWorkspace] = useState(() => getUserWorkspace(workspaceKey));
  const [lawyer, setLawyer] = useState<Lawyer | null | undefined>(undefined);
  const [reviews, setReviews] = useState<PublicLawyerReview[]>([]);
  const [userBookings, setUserBookings] = useState<StoredBooking[]>([]);
  const [activeReviewBookingId, setActiveReviewBookingId] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>(() => createDefaultReviewDraft());
  const [reviewSaveState, setReviewSaveState] = useState<ReviewActionState>({
    loading: false,
    message: "",
    tone: "info",
  });
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRules | null>(null);
  const [reservedSlots, setReservedSlots] = useState<Set<string>>(() => new Set());
  const [currentPartnerLawyerId, setCurrentPartnerLawyerId] = useState<string | null>(() => getStoredPartnerLawyerId(partnerSession?.email));

  useEffect(() => {
    setWorkspace(getUserWorkspace(workspaceKey));
    setActiveReviewBookingId(null);
    setReviewDraft(createDefaultReviewDraft());
    setReviewSaveState({ loading: false, message: "", tone: "info" });
    void fetchUserWorkspace(workspaceKey, user?.id).then(setWorkspace).catch(() => undefined);
  }, [workspaceKey, user?.id]);

  useEffect(() => {
    let active = true;

    if (!user?.id) {
      setUserBookings([]);
      return () => {
        active = false;
      };
    }

    void fetchBookingsForUser(user.id, user.email).then((nextBookings) => {
      if (active) setUserBookings(nextBookings);
    }).catch(() => {
      if (active) setUserBookings([]);
    });

    return () => {
      active = false;
    };
  }, [user?.email, user?.id]);

  useEffect(() => {
    if (!partnerSession?.email) {
      setCurrentPartnerLawyerId(null);
      return;
    }

    let active = true;
    setCurrentPartnerLawyerId(getStoredPartnerLawyerId(partnerSession.email));

    void fetchPartnerLawyerId(partnerSession.email).then((lawyerId) => {
      if (active) setCurrentPartnerLawyerId(lawyerId);
    });

    return () => {
      active = false;
    };
  }, [partnerSession?.email]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [nextLawyer, nextReviews, nextAvailabilityRules, nextReservedSlots] = await Promise.all([
        getLawyerById(id),
        id ? getLawyerReviews(id) : Promise.resolve([]),
        id ? fetchPartnerAvailabilityRulesForLawyer(id) : Promise.resolve(null),
        id ? fetchReservedBookingSlots(id) : Promise.resolve(new Set<string>()),
      ]);

      if (!active) return;
      setLawyer(nextLawyer || null);
      setReviews(nextReviews);
      setAvailabilityRules(nextAvailabilityRules);
      setReservedSlots(nextReservedSlots);
    })();

    return () => {
      active = false;
    };
  }, [id]);

  const lowestConsultation = useMemo(() => (lawyer ? getLowestConsultation(lawyer) : null), [lawyer]);
  const nextSlots = useMemo(
    () =>
      lawyer && availabilityRules
        ? getNextAvailabilityOptions(availabilityRules, lowestConsultation, {
            lawyerId: lawyer.id,
            maxOptions: 4,
            reservedSlots,
          })
        : [],
    [availabilityRules, lawyer, lowestConsultation, reservedSlots],
  );
  const reviewsByBookingId = useMemo(
    () =>
      workspace.reviews.reduce<Record<string, UserReview>>((accumulator, review) => {
        accumulator[review.bookingId] = review;
        return accumulator;
      }, {}),
    [workspace.reviews],
  );

  if (lawyer === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-3xl px-5 py-16 text-center lg:px-8">
          <div className="rounded-2xl border border-border bg-card px-6 py-12">
            <p className="text-sm font-bold text-muted-foreground">Φόρτωση επαληθευμένου προφίλ...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!lawyer) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-3xl px-5 py-16 text-center lg:px-8">
          <div className="rounded-2xl border border-border bg-card px-6 py-12">
            <h1 className="font-serif text-3xl tracking-tight text-foreground">Δεν βρέθηκε ο δικηγόρος</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Το προφίλ που ζητήσατε δεν είναι διαθέσιμο ή έχει αφαιρεθεί από τα αποτελέσματα.
            </p>
            <Button asChild className="mt-6 rounded-xl font-bold">
              <Link to="/search">Επιστροφή στην αναζήτηση</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const consultationPrices = lawyer.consultations.map((consultation) => consultation.price).filter((price) => price > 0);
  const lowestPrice = lowestConsultation?.price ?? (consultationPrices.length > 0 ? Math.min(...consultationPrices) : lawyer.price);
  const saved = workspace.savedLawyerIds.includes(lawyer.id);
  const writtenReviewCount = reviews.length;
  const displayRating =
    reviews.length > 0
      ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
      : lawyer.rating;
  const reviewSummaryLabel =
    writtenReviewCount > 0
      ? writtenReviewCount === 1
        ? "1 γραπτή αξιολόγηση"
        : `${writtenReviewCount} γραπτές αξιολογήσεις`
      : lawyer.reviews > 0
        ? `${lawyer.reviews} επαληθευμένες βαθμολογίες`
        : "χωρίς αξιολογήσεις";
  const compactReviewSummaryLabel =
    writtenReviewCount > 0
      ? writtenReviewCount === 1
        ? "1 γραπτή"
        : `${writtenReviewCount} γραπτές`
      : lawyer.reviews > 0
        ? `${lawyer.reviews} βαθμολογίες`
        : "";
  const ratingFactValue = compactReviewSummaryLabel ? `${displayRating} · ${compactReviewSummaryLabel}` : "Νέα καταχώριση";
  const firstAvailableSlot = nextSlots[0];
  const nextAvailabilityLabel = firstAvailableSlot
    ? `${firstAvailableSlot.shortDateLabel}, ${firstAvailableSlot.time}`
    : lawyer.available || "Με ραντεβού";
  const isOwnLawyerProfile = areLawyerIdsEqual(currentPartnerLawyerId, lawyer.id);
  const eligibleReviewBookings = userBookings
    .filter((booking) => booking.lawyerId === lawyer.id && canSubmitReview(booking))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const hasBookingsWithLawyer = userBookings.some((booking) => booking.lawyerId === lawyer.id);
  const activeReviewBooking =
    activeReviewBookingId ? eligibleReviewBookings.find((booking) => booking.id === activeReviewBookingId) || null : null;

  const openReviewEditor = (booking: StoredBooking) => {
    setActiveReviewBookingId(booking.id);
    setReviewDraft(createReviewDraftFromRecord(reviewsByBookingId[booking.id]));
    setReviewSaveState({ loading: false, message: "", tone: "info" });
  };

  const closeReviewEditor = () => {
    setActiveReviewBookingId(null);
    setReviewDraft(createDefaultReviewDraft());
    setReviewSaveState({ loading: false, message: "", tone: "info" });
  };

  const updateReviewDraft = (updates: Partial<ReviewDraft>) => {
    setReviewDraft((current) => ({
      ...current,
      ...updates,
    }));
    setReviewSaveState((current) => (current.message ? { loading: false, message: "", tone: "info" } : current));
  };

  const handleReviewSubmit = async (booking: StoredBooking) => {
    if (!canSubmitReview(booking)) {
      setReviewSaveState({
        loading: false,
        message: "Η αξιολόγηση ανοίγει μόνο μετά από ολοκληρωμένο ραντεβού.",
        tone: "error",
      });
      return;
    }

    const text = reviewDraft.text.trim();
    const rating = reviewDraft.rating;
    const clarityRating = reviewDraft.clarityRating || rating;
    const responsivenessRating = reviewDraft.responsivenessRating || rating;

    if (rating < 1) {
      setReviewSaveState({
        loading: false,
        message: "Επιλέξτε συνολική βαθμολογία για να συνεχίσετε.",
        tone: "error",
      });
      return;
    }

    if (text.length < 10) {
      setReviewSaveState({
        loading: false,
        message: "Γράψτε λίγες λέξεις για την εμπειρία σας πριν την υποβολή.",
        tone: "error",
      });
      return;
    }

    setReviewSaveState({
      loading: true,
      message: "Αποθήκευση αξιολόγησης...",
      tone: "info",
    });

    const result = await upsertUserReviewPersisted(
      workspaceKey,
      {
        bookingId: booking.id,
        lawyerId: booking.lawyerId,
        lawyerName: booking.lawyerName,
        rating,
        clarityRating,
        responsivenessRating,
        text,
      },
      user?.id,
    );

    setWorkspace(result.workspace);
    setReviewDraft({
      rating,
      clarityRating,
      responsivenessRating,
      text,
    });

    if (result.persisted) {
      setReviewSaveState({
        loading: false,
        message: "Η αξιολόγηση αποθηκεύτηκε.",
        tone: "success",
      });
      return;
    }

    if (result.reason === "booking_not_completed") {
      setReviewSaveState({
        loading: false,
        message: "Η αξιολόγηση ανοίγει μόνο μετά από ολοκληρωμένο ραντεβού.",
        tone: "error",
      });
      return;
    }

    if (result.reason === "not_authenticated") {
      setReviewSaveState({
        loading: false,
        message: "Συνδεθείτε για να αποθηκεύσετε την αξιολόγησή σας.",
        tone: "error",
      });
      return;
    }

    setReviewSaveState({
      loading: false,
      message: "Δεν μπορέσαμε να αποθηκεύσουμε την αξιολόγηση τώρα. Δοκιμάστε ξανά.",
      tone: "error",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${lawyer.name} - ${lawyer.specialty} | Dikigoros`}
        description={`Συγκρίνετε τον/την ${lawyer.name} με βάση ειδίκευση, επαλήθευση, αξιολογήσεις, διαθεσιμότητα, τρόπους συμβουλευτικής και τιμή από.`}
        path={`/lawyer/${lawyer.id}`}
      />
      <Navbar />

      <main className="mx-auto max-w-6xl px-5 py-6 lg:px-8 lg:py-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-start">
                <div className="relative shrink-0 self-start">
                  <LawyerPhoto
                    src={lawyer.image}
                    alt={lawyer.name}
                    className="h-28 w-28 rounded-2xl object-cover shadow-xl ring-2 ring-background md:h-32 md:w-32"
                  />
                  <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-sage ring-4 ring-card">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <h1 className="font-serif text-3xl leading-tight tracking-tight text-foreground">{lawyer.name}</h1>
                      <p className="mt-1 text-[15px] font-bold text-primary/80">{lawyer.specialty}</p>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/65">{lawyer.bestFor}</p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:w-[22rem]">
                      <CompactFact icon={MapPin} label="Πόλη">{lawyer.city}</CompactFact>
                      <CompactFact icon={Briefcase} label="Εμπειρία">{lawyer.experience} χρόνια</CompactFact>
                      <CompactFact icon={Clock} label="Απόκριση">{lawyer.response}</CompactFact>
                      <CompactFact icon={Star} label="Αξιολόγηση">{ratingFactValue}</CompactFact>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {lawyer.credentials.map((credential) => (
                      <span key={credential} className="inline-flex items-center gap-1 rounded-lg bg-primary/[0.06] px-2.5 py-1 text-[11px] font-bold text-primary">
                        <Award className="h-3 w-3" />
                        {credential}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <p className="text-sm leading-7 text-foreground/70 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {lawyer.bio}
                    </p>

                    <div className="rounded-xl border border-sage/20 bg-sage/10 px-4 py-3">
                      <p className="inline-flex items-center gap-2 text-[13px] font-bold text-sage-foreground">
                        <ShieldCheck className="h-4 w-4" />
                        Επαληθευμένο προφίλ συνεργάτη
                      </p>
                      <p className="mt-2 text-sm font-semibold text-foreground/80">{lawyer.verification.barAssociation}</p>
                      <p className="mt-1 text-xs leading-5 text-foreground/60">{lawyer.verification.registryLabel}</p>
                      <p className="mt-3 text-[11px] font-semibold text-foreground/50">Τελευταίος έλεγχος: {lawyer.verification.checkedAt}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-sage">Διαθεσιμότητα</p>
                    <h2 className="mt-1 font-serif text-xl tracking-tight text-foreground">Πραγματικές επόμενες ώρες</h2>
                  </div>
                  <span className="rounded-lg bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
                    Δημοσιευμένο πρόγραμμα
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {nextSlots.length > 0 ? (
                    nextSlots.map((slot) => (
                      <Link
                        key={`${slot.dateLabel}-${slot.time}`}
                        to={`/booking/${lawyer.id}?source=profile_slot`}
                        onClick={() => trackFunnelEvent("profile_booking_start", { lawyerId: lawyer.id, source: "profile_slot" })}
                        className="rounded-xl border border-border bg-background p-3 transition hover:border-primary/25"
                      >
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{slot.shortDateLabel}</p>
                        <p className="mt-1 text-sm font-bold text-foreground">{slot.dateLabel}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-primary">
                          <Clock className="h-3.5 w-3.5" />
                          {slot.time}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-sm font-semibold text-muted-foreground sm:col-span-2">
                      Δεν υπάρχουν κοντινές δημόσιες ώρες από το τρέχον δημοσιευμένο πρόγραμμα.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Τρόποι ραντεβού</p>
                <h2 className="mt-1 font-serif text-xl tracking-tight text-foreground">Τιμές και διάρκεια</h2>
                <div className="mt-4 space-y-2.5">
                  {lawyer.consultations.map((consultation) => {
                    const Icon = consultationModeIcons[consultation.mode];
                    return (
                      <div key={consultation.mode} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{consultation.type}</p>
                            <p className="text-xs font-semibold text-foreground/50">{consultation.duration}</p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-foreground">{formatCurrency(consultation.price)}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <h2 className="font-serif text-xl tracking-tight text-foreground">Εξειδίκευση</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lawyer.specialties.map((specialty) => (
                      <span key={specialty} className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-[13px] font-bold text-foreground">
                        {specialty}
                      </span>
                    ))}
                  </div>

                  <h3 className="mt-5 text-sm font-bold text-foreground">Σπουδές</h3>
                  <p className="mt-2 text-sm leading-6 text-foreground/65">{lawyer.education}</p>
                </div>

                <div>
                  <h2 className="font-serif text-xl tracking-tight text-foreground">Γλώσσες και έλεγχος</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lawyer.languages.map((language) => (
                      <span key={language} className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-[13px] font-bold text-foreground">
                        <Languages className="h-3.5 w-3.5 text-primary" />
                        {language}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Στοιχεία που έχουν ελεγχθεί</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {lawyer.verification.evidence.map((item) => (
                        <span key={item} className="rounded-md bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-serif text-xl tracking-tight text-foreground">Αξιολογήσεις</h2>
                  <p className="mt-1 text-sm leading-6 text-foreground/55">
                    Οι αξιολογήσεις συνδέονται με ολοκληρωμένα ραντεβού και εμφανίζονται χωρίς δημόσια στοιχεία υπόθεσης.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Star className="h-4 w-4 fill-gold text-gold" />
                  <span className="font-bold text-foreground">{displayRating}</span>
                  <span className="font-semibold text-foreground/50">· {reviewSummaryLabel}</span>
                </div>
              </div>

              {user && eligibleReviewBookings.length > 0 ? (
                <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-primary">Το δικό σας ραντεβού</p>
                      <p className="mt-1 text-sm leading-6 text-foreground/70">
                        Μετά από ολοκληρωμένο ραντεβού, μπορείτε να αφήσετε ή να επεξεργαστείτε αξιολόγηση από αυτό το σημείο.
                      </p>
                    </div>
                    <span className="rounded-lg bg-card px-3 py-1 text-xs font-bold text-muted-foreground">
                      {eligibleReviewBookings.length} ολοκληρωμένα ραντεβού
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {eligibleReviewBookings.map((booking) => {
                      const existingReview = reviewsByBookingId[booking.id];
                      const reviewTone = existingReview ? getReviewTone(existingReview.status) : null;

                      return (
                        <div key={booking.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-bold text-foreground">{booking.consultationType}</p>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                              {booking.dateLabel} · {booking.time}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {existingReview ? (
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                                  reviewTone === "success" && "border-sage/30 bg-sage/10 text-sage-foreground",
                                  reviewTone === "danger" && "border-destructive/25 bg-destructive/10 text-destructive",
                                  reviewTone === "muted" && "border-border bg-secondary text-muted-foreground",
                                  reviewTone === "attention" && "border-gold/30 bg-gold/10 text-gold-foreground",
                                )}
                              >
                                {reviewPublicationStateLabels[existingReview.status]}
                              </span>
                            ) : null}
                            <Button type="button" variant="outline" className="rounded-lg font-bold" onClick={() => openReviewEditor(booking)}>
                              {existingReview ? "Επεξεργασία αξιολόγησης" : "Αξιολόγηση"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {activeReviewBooking ? (
                    <div className="mt-4">
                      <ReviewComposer
                        booking={activeReviewBooking}
                        existingReview={reviewsByBookingId[activeReviewBooking.id]}
                        draft={reviewDraft}
                        saveState={reviewSaveState}
                        onChange={updateReviewDraft}
                        onClose={closeReviewEditor}
                        onSubmit={() => void handleReviewSubmit(activeReviewBooking)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!user && !isOwnLawyerProfile ? (
                <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground">
                  Μετά από ολοκληρωμένο ραντεβού, η αξιολόγηση γίνεται από αυτό το section όταν συνδεθείτε στον λογαριασμό σας.
                </div>
              ) : null}

              {user && hasBookingsWithLawyer && eligibleReviewBookings.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground">
                  Η αξιολόγηση ανοίγει μόλις ολοκληρωθεί το ραντεβού σας με αυτόν τον δικηγόρο.
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {reviews.length > 0 ? (
                  reviews.map((review) => (
                    <div key={review.id} className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-serif text-sm font-bold text-primary-foreground">
                            {review.clientName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{review.clientName}</p>
                            <p className="text-[11px] font-semibold text-foreground/40">{review.type} · {review.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: review.rating }).map((_, index) => (
                            <Star key={index} className="h-3.5 w-3.5 fill-gold text-gold" />
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <ReviewMetric label="Συνολικά" value={`${review.rating}/5`} />
                        <ReviewMetric label="Σαφήνεια" value={`${review.clarityRating}/5`} />
                        <ReviewMetric label="Ανταπόκριση" value={`${review.responsivenessRating}/5`} />
                      </div>

                      <p className="mt-3 text-sm leading-6 text-foreground/70">{review.text}</p>
                      {review.lawyerReply ? (
                        <div className="mt-3 rounded-xl bg-secondary px-4 py-3 text-[13px] leading-6 text-foreground/65">
                          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Απάντηση δικηγόρου</p>
                          <p>{review.lawyerReply}</p>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-6 text-center">
                    <p className="text-sm font-bold text-foreground">Δεν υπάρχουν ακόμη δημοσιευμένες γραπτές κριτικές.</p>
                    <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                      {lawyer.reviews > 0
                        ? "Η συνολική βαθμολογία βασίζεται σε επαληθευμένες κρατήσεις. Τα γραπτά σχόλια εμφανίζονται μόνο αφού περάσουν τον έλεγχο δημοσίευσης."
                        : "Οι γραπτές κριτικές εμφανίζονται μόνο όταν συνδεθούν με ολοκληρωμένο ραντεβού και περάσουν τον έλεγχο δημοσίευσης."}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="shrink-0 xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xl shadow-foreground/[0.06]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">Κλείστε ραντεβού</p>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-[1.75rem] font-bold text-foreground">από {formatCurrency(lowestPrice)}</span>
                <span className="text-[13px] font-semibold text-foreground/40">/ συμβουλευτική</span>
              </div>

              <div className="mt-4 space-y-2.5">
                <Signal icon={ShieldCheck}>Ελεγμένο προφίλ συνεργάτη</Signal>
                <Signal icon={Clock}>Απάντηση {lawyer.response}</Signal>
                <Signal icon={Star}>{displayRating} ({reviewSummaryLabel})</Signal>
              </div>

              <div className="mt-4 rounded-xl bg-sage/10 p-3">
                <p className="text-[11px] font-bold text-sage-foreground">Επόμενη διαθεσιμότητα</p>
                <p className="mt-0.5 text-[15px] font-bold text-foreground">{nextAvailabilityLabel}</p>
              </div>

              {nextSlots.length > 0 ? (
                <div className="mt-3 rounded-xl border border-border bg-background p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Κοντινές ώρες</p>
                  <div className="mt-2 space-y-1.5">
                    {nextSlots.slice(0, 3).map((slot) => (
                      <p key={`${slot.dateLabel}-${slot.time}`} className="flex items-center justify-between gap-3 text-xs font-bold text-foreground">
                        <span>{slot.shortDateLabel}</span>
                        <span>{slot.time}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {isOwnLawyerProfile ? (
                <Button type="button" disabled className="mt-4 h-12 w-full rounded-xl text-[15px] font-bold">
                  Δεν μπορείτε να κλείσετε ραντεβού στον εαυτό σας
                </Button>
              ) : (
                <Button asChild className="mt-4 h-12 w-full rounded-xl text-[15px] font-bold">
                  <Link
                    to={`/booking/${lawyer.id}?source=profile`}
                    data-testid="profile-booking-link"
                    onClick={() => trackFunnelEvent("profile_booking_start", { lawyerId: lawyer.id, specialty: lawyer.specialty })}
                  >
                    Κλείσε ραντεβού
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}

              <Button
                type="button"
                variant={saved ? "default" : "outline"}
                onClick={() => {
                  const nextWorkspace = toggleSavedLawyer(workspaceKey, lawyer.id);
                  setWorkspace(nextWorkspace);
                  void syncUserWorkspace(workspaceKey, nextWorkspace, user?.id);
                }}
                className="mt-3 h-11 w-full rounded-xl text-sm font-bold"
              >
                <Heart className={saved ? "fill-current" : ""} />
                {saved ? "Αποθηκευμένο" : "Αποθήκευση"}
              </Button>

              <Link to="/trust/verification-standards" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                Πώς ελέγχεται το προφίλ
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </aside>
        </div>
      </main>

      {!isOwnLawyerProfile ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{nextAvailabilityLabel}</p>
              <p className="text-sm font-bold text-foreground">από {formatCurrency(lowestPrice)}</p>
            </div>
            <Button asChild className="h-11 shrink-0 rounded-xl px-4 text-sm font-bold">
              <Link
                to={`/booking/${lawyer.id}?source=profile_mobile`}
                onClick={() => trackFunnelEvent("profile_booking_start", { lawyerId: lawyer.id, specialty: lawyer.specialty, source: "profile_mobile" })}
              >
                Κλείσε
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="pb-28 lg:pb-0">
        <Footer />
      </div>
    </div>
  );
};

const CompactFact = ({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) => (
  <div className="rounded-xl border border-border bg-background px-3 py-2.5">
    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </p>
    <p className="mt-1 text-sm font-bold text-foreground">{children}</p>
  </div>
);

const Signal = ({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) => (
  <div className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground">
    <Icon className="h-4 w-4 text-sage" />
    {children}
  </div>
);

const ReviewComposer = ({
  booking,
  existingReview,
  draft,
  saveState,
  onChange,
  onClose,
  onSubmit,
}: {
  booking: StoredBooking;
  existingReview?: UserReview;
  draft: ReviewDraft;
  saveState: ReviewActionState;
  onChange: (updates: Partial<ReviewDraft>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) => (
  <div className="rounded-xl border border-primary/15 bg-card p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Η αξιολόγησή σας</p>
        <h3 className="mt-1 text-lg font-bold text-foreground">
          {existingReview ? "Επεξεργασία αξιολόγησης" : "Νέα αξιολόγηση"}
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {booking.consultationType} · {booking.dateLabel} · {booking.time}
        </p>
      </div>
      {existingReview ? (
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-bold",
            getReviewTone(existingReview.status) === "success" && "border-sage/30 bg-sage/10 text-sage-foreground",
            getReviewTone(existingReview.status) === "danger" && "border-destructive/25 bg-destructive/10 text-destructive",
            getReviewTone(existingReview.status) === "muted" && "border-border bg-secondary text-muted-foreground",
            getReviewTone(existingReview.status) === "attention" && "border-gold/30 bg-gold/10 text-gold-foreground",
          )}
        >
          {reviewPublicationStateLabels[existingReview.status]}
        </span>
      ) : null}
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <RatingSelector label="Συνολικά" value={draft.rating} onChange={(value) => onChange({ rating: value })} />
      <RatingSelector label="Σαφήνεια" value={draft.clarityRating} onChange={(value) => onChange({ clarityRating: value })} />
      <RatingSelector label="Ανταπόκριση" value={draft.responsivenessRating} onChange={(value) => onChange({ responsivenessRating: value })} />
    </div>

    <label className="mt-4 block">
      <span className="text-sm font-bold text-foreground">Σχόλιο</span>
      <textarea
        value={draft.text}
        onChange={(event) => onChange({ text: event.target.value })}
        rows={5}
        placeholder="Πώς ήταν η εμπειρία σας με τον δικηγόρο;"
        className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>

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
        Η αξιολόγηση συνδέεται με το ολοκληρωμένο ραντεβού σας και μπορείτε να την επεξεργαστείτε αργότερα από αυτό το προφίλ.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={saveState.loading} className="rounded-lg font-bold">
          Κλείσιμο
        </Button>
        <Button type="button" onClick={onSubmit} disabled={saveState.loading} className="rounded-lg font-bold">
          {saveState.loading ? "Αποθήκευση..." : existingReview ? "Αποθήκευση αλλαγών" : "Υποβολή αξιολόγησης"}
        </Button>
      </div>
    </div>
  </div>
);

const RatingSelector = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="rounded-lg border border-border bg-background/80 p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-bold text-foreground">{label}</span>
      <span className="text-xs font-semibold text-muted-foreground">{value ? `${value}/5` : "Δεν έχει οριστεί"}</span>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          aria-label={`${label}: ${rating}`}
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full border transition",
            value >= rating
              ? "border-gold/40 bg-gold/10 text-gold-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary",
          )}
        >
          <Star className={cn("h-4 w-4", value >= rating && "fill-current")} />
        </button>
      ))}
    </div>
  </div>
);

const ReviewMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-card px-3 py-2">
    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
  </div>
);

export default LawyerProfile;
