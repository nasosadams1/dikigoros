import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Mail,
  ReceiptText,
  ShieldCheck,
  Star,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthContainer from "@/components/auth/AuthContainer";
import Navbar from "@/components/Navbar";
import { consultationModeIcons, type Lawyer } from "@/data/lawyers";
import { useAuth } from "@/context/AuthContext";
import { areLawyerIdsEqual, fetchPartnerLawyerId, getStoredPartnerLawyerId } from "@/lib/partnerIdentity";
import { getLawyerById } from "@/lib/lawyerRepository";
import {
  buildAvailabilityTimeSlots,
  fetchPartnerAvailabilityRulesForLawyer,
  getAvailabilitySlotForDate,
  getPartnerAvailabilityRulesForLawyer,
} from "@/lib/partnerWorkspace";
import {
  createBooking,
  fetchReservedBookingSlots,
  getStoredBookingById,
  getBookingSlotKey,
  getPartnerSession,
  recordLocalCheckoutReturn,
  requestBookingCheckoutSession,
  type StoredBooking,
} from "@/lib/platformRepository";
import { cn } from "@/lib/utils";

const steps = ["Τύπος", "Ημερομηνία", "Στοιχεία", "Πληρωμή", "Επιβεβαίωση"];
const shortDays = ["Κυρ", "Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ"];
const longDays = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
const shortMonths = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαΐ", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"];
const longMonths = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildBookingDates = (bookingWindowDays: number) =>
  Array.from({ length: Math.max(1, bookingWindowDays) }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);

    return {
      day: index === 0 ? "Σήμερα" : index === 1 ? "Αύριο" : shortDays[date.getDay()],
      date: String(date.getDate()),
      month: shortMonths[date.getMonth()],
      full: `${longDays[date.getDay()]}, ${date.getDate()} ${longMonths[date.getMonth()]}`,
      dateObject: date,
    };
  });

const getDurationMinutes = (duration?: string) => {
  const match = duration?.match(/\d+/);
  return match ? Number(match[0]) : 30;
};

const buildCalendarUrl = (booking: StoredBooking | null, lawyerName: string) => {
  if (!booking) return "https://calendar.google.com/calendar/render?action=TEMPLATE";

  const title = encodeURIComponent(`Νομική συμβουλευτική με ${lawyerName}`);
  const details = encodeURIComponent(`${booking.consultationType} · ${booking.referenceId}`);
  const location = encodeURIComponent(booking.consultationMode === "inPerson" ? lawyerName : "Διαδικτυακά / τηλέφωνο");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
};

const Booking = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [lawyer, setLawyer] = useState<Lawyer | null | undefined>(undefined);
  const { user, profile } = useAuth();
  const partnerSession = getPartnerSession();
  const [availabilityRules, setAvailabilityRules] = useState(() =>
    id ? getPartnerAvailabilityRulesForLawyer(id) : getPartnerAvailabilityRulesForLawyer("maria-papadopoulou"),
  );
  const dates = useMemo(
    () => buildBookingDates(availabilityRules.bookingWindowDays),
    [availabilityRules.bookingWindowDays],
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [details, setDetails] = useState({ fullName: "", email: "", phone: "", issue: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attemptedDetails, setAttemptedDetails] = useState(false);
  const [reservedSlots, setReservedSlots] = useState<Set<string>>(() => new Set());
  const [confirmedBooking, setConfirmedBooking] = useState<StoredBooking | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentState, setPaymentState] = useState<{
    loading: boolean;
    error: string;
    action?: "retry-payment" | "support" | "";
  }>({ loading: false, error: "", action: "" });
  const [authOpen, setAuthOpen] = useState(false);
  const [currentPartnerLawyerId, setCurrentPartnerLawyerId] = useState<string | null>(() => getStoredPartnerLawyerId(partnerSession?.email));

  useEffect(() => {
    let active = true;

    void Promise.all([
      getLawyerById(id),
      id
        ? fetchPartnerAvailabilityRulesForLawyer(id)
        : Promise.resolve(getPartnerAvailabilityRulesForLawyer("maria-papadopoulou")),
    ]).then(([nextLawyer, nextAvailabilityRules]) => {
      if (!active) return;
      setLawyer(nextLawyer || null);
      setAvailabilityRules(nextAvailabilityRules);
    });

    return () => {
      active = false;
    };
  }, [id]);

  const selectedConsultation = selectedType !== null && lawyer ? lawyer.consultations[selectedType] : null;
  const selectedDateLabel = selectedDate !== null ? dates[selectedDate].full : "";
  const selectedAvailabilitySlot =
    selectedDate !== null ? getAvailabilitySlotForDate(availabilityRules.availability, dates[selectedDate].dateObject) : null;
  const availableTimeSlots =
    selectedDate !== null
      ? buildAvailabilityTimeSlots(
          selectedAvailabilitySlot,
          getDurationMinutes(selectedConsultation?.duration),
          availabilityRules.bufferMinutes,
        )
      : [];
  const selectedSlotKey =
    lawyer && selectedDateLabel && selectedTime
      ? getBookingSlotKey({ lawyerId: lawyer.id, dateLabel: selectedDateLabel, time: selectedTime })
      : "";
  const selectedSlotReserved = Boolean(selectedSlotKey && reservedSlots.has(selectedSlotKey));
  const profileName = profile?.name;
  const profileEmail = profile?.email;
  const profilePhone = profile?.phone;
  const userEmail = user?.email;
  const userDisplayName = user?.user_metadata?.display_name;

  useEffect(() => {
    if (!id) return;

    let active = true;
    void fetchReservedBookingSlots(id).then((slots) => {
      if (active) setReservedSlots(slots);
    });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!user?.id && !profileName && !profileEmail && !profilePhone) return;

    setDetails((current) => ({
      fullName: current.fullName || profileName || userDisplayName || "",
      email: current.email || profileEmail || userEmail || "",
      phone: current.phone || profilePhone || "",
      issue: current.issue,
    }));
  }, [profileEmail, profileName, profilePhone, user?.id, userDisplayName, userEmail]);

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
    const checkout = searchParams.get("checkout");
    const bookingId = searchParams.get("bookingId");
    if (!checkout || !bookingId) return;

    const storedBooking = getStoredBookingById(bookingId);
    if (storedBooking) {
      setConfirmedBooking(storedBooking);
      setSelectedTime(storedBooking.time);
      recordLocalCheckoutReturn(
        bookingId,
        checkout === "success" ? "paid" : "failed",
        searchParams.get("session_id"),
      );
    }

    if (checkout === "success") {
      setPaymentState({ loading: false, error: "", action: "" });
      setCurrentStep(4);
      return;
    }

    setPaymentState({
      loading: false,
      error: "Η πληρωμή δεν ολοκληρώθηκε. Η κάρτα δεν χρεώθηκε. Μπορείτε να δοκιμάσετε ξανά την ασφαλή πληρωμή.",
      action: "retry-payment",
    });
    setCurrentStep(3);
  }, [searchParams]);

  const detailErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!details.fullName.trim()) errors.fullName = "Συμπληρώστε ονοματεπώνυμο.";
    if (!emailPattern.test(details.email.trim())) errors.email = "Συμπληρώστε έγκυρο ηλεκτρονικό ταχυδρομείο.";
    if (details.phone.replace(/\D/g, "").length < 10) errors.phone = "Συμπληρώστε έγκυρο αριθμό τηλεφώνου.";
    return errors;
  }, [details]);

  const isSelfBookingBlocked = Boolean(lawyer && areLawyerIdsEqual(currentPartnerLawyerId, lawyer.id));

  if (lawyer === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-5 py-16 text-center">
          <div className="rounded-2xl border border-border bg-card px-6 py-12">
            <p className="text-sm font-bold text-muted-foreground">Φόρτωση επαληθευμένου προφίλ κράτησης...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!lawyer) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-5 py-16 text-center">
          <div className="rounded-2xl border border-border bg-card px-6 py-12">
            <h1 className="font-serif text-3xl tracking-tight text-foreground">Δεν βρέθηκε ο δικηγόρος</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Δεν είναι δυνατή η κράτηση γιατί το προφίλ δεν βρέθηκε στα διαθέσιμα αποτελέσματα.
            </p>
            <Button asChild className="mt-6 rounded-xl font-bold">
              <Link to="/search">Επιστροφή στην αναζήτηση</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (isSelfBookingBlocked) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-5 py-16 text-center">
          <div className="rounded-2xl border border-border bg-card px-6 py-12">
            <h1 className="font-serif text-3xl tracking-tight text-foreground">Δεν μπορείτε να κλείσετε ραντεβού στον εαυτό σας</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Αυτό το προφίλ ανήκει στον δικό σας λογαριασμό δικηγόρου, οπότε δεν επιτρέπεται να κλείσετε ραντεβού στον εαυτό σας.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="rounded-xl font-bold">
                <Link to="/for-lawyers/portal?view=appointments">Μετάβαση στον πίνακα συνεργάτη</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl font-bold">
                <Link to={`/lawyer/${lawyer.id}`}>Επιστροφή στο προφίλ</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const canContinue =
    (currentStep === 0 && selectedType !== null) ||
    (currentStep === 1 && selectedDate !== null && selectedTime !== null && !selectedSlotReserved) ||
    (currentStep === 2 && Object.keys(detailErrors).length === 0) ||
    (currentStep === 3 && Boolean(confirmedBooking));

  const handleNext = async () => {
    if (currentStep === 2 && Object.keys(detailErrors).length > 0) {
      setAttemptedDetails(true);
      setTouched({ fullName: true, email: true, phone: true });
      return;
    }

    if (!canContinue) return;

    if (currentStep === 2 && lawyer && selectedConsultation && selectedDateLabel && selectedTime) {
      setIsSubmitting(true);
      setSubmitError("");

      try {
        const result = await createBooking({
          userId: user?.id,
          lawyerId: lawyer.id,
          lawyerName: lawyer.name,
          consultationType: selectedConsultation.type,
          consultationMode: selectedConsultation.mode,
          price: selectedConsultation.price,
          duration: selectedConsultation.duration,
          dateLabel: selectedDateLabel,
          time: selectedTime,
          clientName: details.fullName.trim(),
          clientEmail: details.email.trim().toLowerCase(),
          clientPhone: details.phone.trim(),
          issueSummary: details.issue.trim() || undefined,
        });

        setConfirmedBooking(result.record);
        setReservedSlots(await fetchReservedBookingSlots(lawyer.id));
        setCurrentStep(3);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("Δεν μπορείτε να κλείσετε ραντεβού στον εαυτό σας") || message.includes("SELF_BOOKING")) {
          setSubmitError("Δεν μπορείτε να κλείσετε ραντεβού στον εαυτό σας.");
          return;
        }
        if (message.includes("BOOKING_SLOT_UNAVAILABLE") || message.includes("δεν είναι πλέον διαθέσιμη")) {
          setSubmitError("Η ώρα δεν είναι πλέον διαθέσιμη. Επιλέξτε άλλη διαθέσιμη ώρα.");
          setSelectedTime(null);
          setCurrentStep(1);
          setReservedSlots(await fetchReservedBookingSlots(lawyer.id));
          return;
        }
        setSubmitError(
          "Δεν μπορέσαμε να κρατήσουμε αυτή την ώρα. Δοκιμάστε ξανά ή επιλέξτε άλλη διαθέσιμη ώρα.",
        );
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (currentStep === 3 && confirmedBooking) {
      if (!user?.id) {
        setPaymentState({
          loading: false,
          error: "Συνδεθείτε ή δημιουργήστε λογαριασμό για να ολοκληρώσετε την ασφαλή πληρωμή και να κρατηθεί η απόδειξη μαζί με την κράτηση.",
          action: "",
        });
        setAuthOpen(true);
        return;
      }

      setPaymentState({ loading: true, error: "", action: "" });

      try {
        const returnUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/booking/${lawyer.id}?bookingId=${confirmedBooking.id}`
            : undefined;
        const session = await requestBookingCheckoutSession(confirmedBooking, returnUrl);
        if (session.url && typeof window !== "undefined") {
          window.location.assign(session.url);
          return;
        }

        setPaymentState({
          loading: false,
          error: "Δεν μπορέσαμε να ανοίξουμε την ασφαλή πληρωμή για αυτή την κράτηση. Δοκιμάστε ξανά ή επικοινωνήστε με την υποστήριξη.",
          action: "support",
        });
      } catch {
        setPaymentState({
          loading: false,
          error: "Η πληρωμή δεν ξεκίνησε. Η κάρτα δεν χρεώθηκε. Δοκιμάστε ξανά.",
          action: "retry-payment",
        });
      }

      return;
    }

    setCurrentStep((step) => Math.min(4, step + 1));
  };

  const showError = (field: string) => (touched[field] || attemptedDetails) && detailErrors[field];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-2xl px-5 py-6 lg:py-10">
        <Link to={`/lawyer/${lawyer.id}`} className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Πίσω στο προφίλ
        </Link>

        <section className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="relative">
            <img
              src={lawyer.image}
              alt={lawyer.name}
              className="h-14 w-14 rounded-xl object-cover shadow-md ring-2 ring-background"
            />
            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sage ring-2 ring-card">
              <CheckCircle2 className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-sans text-[15px] font-bold text-foreground">{lawyer.name}</p>
            <p className="truncate text-xs font-medium text-muted-foreground">
              {lawyer.specialty} · {lawyer.city}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-gold text-gold" />
            <span className="font-bold text-foreground">{lawyer.rating}</span>
            <span className="hidden text-xs text-muted-foreground md:inline">({lawyer.reviews})</span>
          </div>
        </section>

        <div className="mb-8">
          <div className="flex items-center">
            {steps.map((step, index) => (
              <div key={step} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all",
                      index < currentStep && "bg-sage text-white shadow-md shadow-sage/30",
                      index === currentStep && "bg-primary text-primary-foreground shadow-lg shadow-primary/25",
                      index > currentStep && "bg-secondary text-muted-foreground",
                    )}
                  >
                    {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className={cn("mt-2 hidden text-xs font-semibold md:block", index === currentStep ? "text-foreground" : "text-muted-foreground")}>
                    {step}
                  </span>
                </div>
                {index < steps.length - 1 ? (
                  <div className={cn("mx-2 h-0.5 flex-1 rounded-full transition-colors", index < currentStep ? "bg-sage" : "bg-border")} />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <section className="min-h-[380px]">
          {currentStep === 0 ? (
            <div>
              <h1 className="font-serif text-2xl tracking-tight text-foreground">Επιλέξτε τύπο ραντεβού</h1>
              <p className="mt-1.5 text-sm font-medium text-muted-foreground">Πώς θα θέλατε να μιλήσετε με τον δικηγόρο;</p>
              <div className="mt-5 space-y-3">
                {lawyer.consultations.map((consultation, index) => {
                  const Icon = consultationModeIcons[consultation.mode];
                  return (
                    <button
                      key={consultation.mode}
                      type="button"
                      onClick={() => setSelectedType(index)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-xl border-2 p-5 text-left transition-all",
                        selectedType === index
                          ? "border-primary bg-primary/[0.04] shadow-md shadow-primary/10"
                          : "border-border bg-card hover:border-foreground/20 hover:shadow-sm",
                      )}
                    >
                      <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl transition-all", selectedType === index ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-secondary text-foreground")}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[15px] font-bold text-foreground">{consultation.type}</p>
                        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{consultation.desc}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-foreground">€{consultation.price}</p>
                        <p className="text-xs font-medium text-muted-foreground">{consultation.duration}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div>
              <h1 className="font-serif text-2xl tracking-tight text-foreground">Επιλέξτε ημερομηνία και ώρα</h1>
              <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                {selectedConsultation ? (
                  <span className="mr-2 inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-bold text-foreground">
                    {selectedConsultation.type} · €{selectedConsultation.price}
                  </span>
                ) : null}
                Διαθέσιμες ημερομηνίες και ώρες
              </p>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
                {dates.map((date, index) => (
                  <button
                    key={date.full}
                    type="button"
                    onClick={() => {
                      setSelectedDate(index);
                      setSelectedTime(null);
                    }}
                    className={cn(
                      "flex shrink-0 flex-col items-center rounded-xl border-2 px-4 py-3 transition-all",
                      selectedDate === index
                        ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "border-border bg-card text-foreground hover:border-foreground/20",
                    )}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wide opacity-70">{date.day}</span>
                    <span className="mt-0.5 text-xl font-bold">{date.date}</span>
                    <span className="text-[11px] font-medium opacity-70">{date.month}</span>
                  </button>
                ))}
              </div>

              {selectedDate !== null ? (
                <div className="mt-5">
                  <p className="text-sm font-bold text-foreground">{dates[selectedDate].full}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-4">
                    {availableTimeSlots.map((time) => {
                      const slotKey = getBookingSlotKey({ lawyerId: lawyer.id, dateLabel: dates[selectedDate].full, time });
                      const isReserved = reservedSlots.has(slotKey);

                      return (
                        <button
                          key={time}
                          type="button"
                          onClick={() => {
                            if (!isReserved) setSelectedTime(time);
                          }}
                          disabled={isReserved}
                          className={cn(
                            "rounded-xl border-2 px-3 py-3 text-sm font-bold transition-all",
                            selectedTime === time
                              ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "border-border bg-card text-foreground hover:border-foreground/20",
                            isReserved && "cursor-not-allowed border-border/70 bg-secondary/60 text-muted-foreground/55 line-through hover:border-border/70 hover:shadow-none",
                          )}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                  {availableTimeSlots.length === 0 ? (
                    <p className="mt-3 rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-3 text-sm font-semibold text-muted-foreground">
                      Δεν υπάρχουν δημοσιευμένες διαθέσιμες ώρες για αυτή την ημέρα.
                    </p>
                  ) : null}
                  {selectedSlotReserved ? (
                    <p className="mt-3 text-xs font-semibold text-destructive">
                      Η συγκεκριμένη ώρα έχει ήδη δεσμευτεί. Επιλέξτε άλλη διαθέσιμη ώρα.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-8 rounded-xl border border-dashed border-border bg-secondary/40 p-8 text-center">
                  <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium text-muted-foreground">Επιλέξτε ημερομηνία για να δείτε διαθέσιμες ώρες.</p>
                </div>
              )}
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div>
              <h1 className="font-serif text-2xl tracking-tight text-foreground">Στοιχεία κράτησης</h1>
              <p className="mt-1.5 text-sm font-medium text-muted-foreground">Τα στοιχεία βοηθούν τον δικηγόρο να προετοιμαστεί πριν το ραντεβού.</p>

              <div className="mt-5 rounded-xl bg-secondary/60 px-4 py-3 text-xs font-semibold text-foreground">
                {selectedConsultation?.type} · {selectedDate !== null ? dates[selectedDate].full : ""} · {selectedTime}
              </div>

              <div className="mt-5 space-y-4">
                <TextField
                  label="Ονοματεπώνυμο"
                  value={details.fullName}
                  onChange={(value) => setDetails((current) => ({ ...current, fullName: value }))}
                  onBlur={() => setTouched((current) => ({ ...current, fullName: true }))}
                  placeholder="π.χ. Γιώργος Νικολάου"
                  error={showError("fullName")}
                />
                <TextField
                  label="Ηλεκτρονικό ταχυδρομείο"
                  type="email"
                  value={details.email}
                  onChange={(value) => setDetails((current) => ({ ...current, email: value }))}
                  onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                  placeholder="name@example.com"
                  error={showError("email")}
                />
                <TextField
                  label="Τηλέφωνο"
                  type="tel"
                  value={details.phone}
                  onChange={(value) => setDetails((current) => ({ ...current, phone: value }))}
                  onBlur={() => setTouched((current) => ({ ...current, phone: true }))}
                  placeholder="+30 69..."
                  error={showError("phone")}
                />
                <div>
                  <label className="text-sm font-bold text-foreground">
                    Σύντομη περιγραφή θέματος <span className="font-medium text-muted-foreground">(προαιρετικό)</span>
                  </label>
                  <textarea
                    value={details.issue}
                    onChange={(event) => setDetails((current) => ({ ...current, issue: event.target.value }))}
                    placeholder="Περιγράψτε σε λίγες γραμμές το θέμα σας."
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div>
              <h1 className="font-serif text-2xl tracking-tight text-foreground">Ασφαλής πληρωμή</h1>
              <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                Η ώρα είναι έτοιμη για δέσμευση. Επιβεβαιώστε τα στοιχεία πριν ανοίξει η ασφαλής πληρωμή.
              </p>

              <div className="mt-5 rounded-2xl border border-border bg-card p-5">
                <SummaryRow label="Δικηγόρος" value={lawyer.name} />
                <SummaryRow label="Συμβουλευτική" value={selectedConsultation?.type || "—"} />
                <SummaryRow label="Διάρκεια" value={selectedConsultation?.duration || "—"} />
                <SummaryRow label="Ώρα" value={`${confirmedBooking?.dateLabel || selectedDateLabel} · ${selectedTime || "—"}`} />
                <SummaryRow label="Κανόνας ακύρωσης" value="Δωρεάν ακύρωση ή αλλαγή έως 24 ώρες πριν." />
                <SummaryRow label="Μετά την πληρωμή" value="Απόδειξη, ημερολόγιο, λογαριασμός και επιλογές εγγράφων." />
                <div className="mt-3 border-t border-border pt-3">
                  <SummaryRow label="Πληρωμή τώρα" value={selectedConsultation ? `€${selectedConsultation.price}` : "—"} strong />
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-sage/20 bg-sage/10 p-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-5 w-5 text-sage-foreground" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Μοντέλο πληρωμής: πλήρης πληρωμή πρώτης συμβουλευτικής</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Τα στοιχεία κάρτας χειρίζονται από ασφαλή πληρωμή μέσω Stripe. Η κράτηση δεν θεωρείται πληρωμένη μέχρι να ολοκληρωθεί η πληρωμή και να καταγραφεί η κατάστασή της.
                    </p>
                  </div>
                </div>
              </div>

              {!user ? (
                <Button type="button" variant="outline" onClick={() => setAuthOpen(true)} className="mt-4 w-full rounded-xl font-bold">
                  Σύνδεση ή δημιουργία λογαριασμού για πληρωμή
                </Button>
              ) : null}

              {paymentState.error ? (
                <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
                  <p className="text-sm font-semibold text-destructive">{paymentState.error}</p>
                  {paymentState.action === "retry-payment" ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => void handleNext()} className="mt-3 rounded-lg font-bold">
                      Δοκιμάστε ξανά την ασφαλή πληρωμή
                    </Button>
                  ) : null}
                  {paymentState.action === "support" ? (
                    <Button asChild variant="outline" size="sm" className="mt-3 rounded-lg font-bold">
                      <Link to="/help">Άνοιγμα υποστήριξης</Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sage/20 shadow-lg shadow-sage/10">
                <Check className="h-9 w-9 text-sage-foreground" />
              </div>
              <h1 className="mt-6 font-serif text-2xl tracking-tight text-foreground">Η κράτηση και η πληρωμή καταχωρίστηκαν.</h1>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                Θα λάβετε επιβεβαίωση κράτησης, απόδειξη πληρωμής και οδηγίες προετοιμασίας στα στοιχεία επικοινωνίας που δηλώσατε.
              </p>

              <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-border bg-card p-5 text-left shadow-md shadow-foreground/[0.03]">
                <SummaryRow label="Κωδικός" value={confirmedBooking?.referenceId || "—"} strong />
                <SummaryRow label="Δικηγόρος" value={confirmedBooking?.lawyerName || lawyer.name} />
                <SummaryRow label="Τύπος" value={confirmedBooking?.consultationType || selectedConsultation?.type || "—"} />
                <SummaryRow label="Ημερομηνία" value={confirmedBooking?.dateLabel || (selectedDate !== null ? dates[selectedDate].full : "—")} />
                <SummaryRow label="Ώρα" value={confirmedBooking?.time || selectedTime || "—"} />
                <SummaryRow label="Διάρκεια" value={confirmedBooking?.duration || selectedConsultation?.duration || "—"} />
                <div className="mt-3 border-t border-border pt-3">
                  <SummaryRow label="Κόστος" value={confirmedBooking ? `€${confirmedBooking.price}` : selectedConsultation ? `€${selectedConsultation.price}` : "—"} strong />
                </div>
              </div>

              <div className="mx-auto mt-6 max-w-sm space-y-2.5 text-left">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Τι ακολουθεί</p>
                <NextStep icon={ReceiptText}>Η απόδειξη και η κατάσταση πληρωμής εμφανίζονται στις πληρωμές του λογαριασμού σας.</NextStep>
                <NextStep icon={CalendarDays}>Προσθέστε τη συμβουλευτική στο ημερολόγιό σας από την επιβεβαίωση.</NextStep>
                <NextStep icon={Mail}>Ο δικηγόρος βλέπει τα στοιχεία του ραντεβού και ακολουθεί η επόμενη επικοινωνία από την πλατφόρμα ή το γραφείο.</NextStep>
                <NextStep icon={Upload}>Ανεβάστε ή στείλτε έγγραφα προετοιμασίας πριν από το ραντεβού.</NextStep>
                <NextStep icon={ShieldCheck}>Δωρεάν ακύρωση ή αλλαγή έως 24 ώρες πριν από την ώρα.</NextStep>
                {confirmedBooking?.persistenceSource === "local" ? (
                  <NextStep icon={ShieldCheck}>Η κράτηση χρειάζεται ακόμη τελική επιβεβαίωση πλατφόρμας. Αν δεν λάβετε email, ανοίξτε υποστήριξη.</NextStep>
                ) : null}
              </div>

              <Button asChild className="mt-8 w-full max-w-sm rounded-xl font-bold">
                <a href={buildCalendarUrl(confirmedBooking, lawyer.name)} target="_blank" rel="noreferrer">Προσθήκη στο ημερολόγιο</a>
              </Button>
              <Button asChild variant="outline" className="mt-3 w-full max-w-sm rounded-xl font-bold">
                <Link to="/account?tab=documents">Ανέβασμα ή αποστολή εγγράφων</Link>
              </Button>
              {user ? (
                <Button asChild variant="outline" className="mt-3 w-full max-w-sm rounded-xl font-bold">
                  <Link to="/account">Άνοιγμα προφίλ πελάτη</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        {currentStep < 4 ? (
          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            <Button
              variant="ghost"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="text-sm font-bold"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Πίσω
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canContinue || isSubmitting || paymentState.loading}
              className="rounded-xl px-8 text-sm font-bold shadow-lg shadow-primary/20 disabled:shadow-none"
            >
              {isSubmitting
                ? "Δέσμευση ώρας..."
                : paymentState.loading
                  ? "Άνοιγμα ασφαλούς πληρωμής..."
                  : currentStep === 2
                    ? "Δέσμευση ώρας και συνέχεια"
                    : currentStep === 3
                      ? "Συνέχεια σε ασφαλή πληρωμή"
                      : "Συνέχεια"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {submitError ? <p className="mt-3 text-center text-sm font-semibold text-destructive">{submitError}</p> : null}

        {currentStep < 4 ? (
          <div className="mt-5 flex items-center justify-center gap-5 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-sage" />
              Ασφαλής κράτηση
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-sage" />
              Δωρεάν ακύρωση 24 ώρες πριν
            </span>
            <span className="hidden items-center gap-1.5 md:flex">
              <Mail className="h-3.5 w-3.5 text-sage" />
              Επιβεβαίωση ηλεκτρονικού ταχυδρομείου και SMS
            </span>
          </div>
        ) : null}
      </main>
      <AuthContainer open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
};

const TextField = ({
  label,
  type = "text",
  value,
  placeholder,
  error,
  onChange,
  onBlur,
}: {
  label: string;
  type?: string;
  value: string;
  placeholder: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) => (
  <div>
    <label className="text-sm font-bold text-foreground">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={cn(
        "mt-1.5 h-12 w-full rounded-xl border bg-card px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2",
        error ? "border-destructive/55 focus:ring-destructive/20" : "border-border focus:border-primary/40 focus:ring-primary/30",
      )}
    />
    {error ? <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p> : null}
  </div>
);

const SummaryRow = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <span className="font-medium text-muted-foreground">{label}</span>
    <span className={cn("text-right font-bold text-foreground", strong && "text-lg")}>{value}</span>
  </div>
);

const NextStep = ({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) => (
  <div className="flex items-start gap-2.5 text-sm">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
    <span className="text-muted-foreground">{children}</span>
  </div>
);

export default Booking;
