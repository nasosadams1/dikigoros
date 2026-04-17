import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Heart,
  MapPin,
  MessageSquareQuote,
  Scale,
  ShieldCheck,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import { consultationModeIcons, type Lawyer } from "@/data/lawyers";
import { useAuth } from "@/context/AuthContext";
import { areLawyerIdsEqual, fetchPartnerLawyerId, getStoredPartnerLawyerId } from "@/lib/partnerIdentity";
import { getLawyerById, getLawyerReviews, getLawyers, type PublicLawyerReview } from "@/lib/lawyerRepository";
import { fetchPartnerAvailabilityRulesForLawyer } from "@/lib/partnerWorkspace";
import { fetchReservedBookingSlots, getPartnerSession } from "@/lib/platformRepository";
import {
  formatCurrency,
  getLowestConsultation,
  getNextAvailabilityOptions,
  getPriceFrom,
  getSimilarLawyerGroups,
  type AvailabilityRules,
} from "@/lib/marketplace";
import {
  getUserWorkspace,
  syncUserWorkspace,
  toggleComparedLawyer,
  toggleSavedLawyer,
} from "@/lib/userWorkspace";

const LawyerProfile = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const partnerSession = getPartnerSession();
  const workspaceKey = user?.id || partnerSession?.email;
  const [workspace, setWorkspace] = useState(() => getUserWorkspace(workspaceKey));
  const [lawyer, setLawyer] = useState<Lawyer | null | undefined>(undefined);
  const [reviews, setReviews] = useState<PublicLawyerReview[]>([]);
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRules | null>(null);
  const [reservedSlots, setReservedSlots] = useState<Set<string>>(() => new Set());
  const [lawyerCatalog, setLawyerCatalog] = useState<Lawyer[]>([]);
  const [currentPartnerLawyerId, setCurrentPartnerLawyerId] = useState<string | null>(() => getStoredPartnerLawyerId(partnerSession?.email));

  useEffect(() => {
    setWorkspace(getUserWorkspace(workspaceKey));
  }, [workspaceKey]);

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
      const [nextLawyer, nextReviews, nextAvailabilityRules, nextReservedSlots, nextLawyerCatalog] = await Promise.all([
        getLawyerById(id),
        id ? getLawyerReviews(id) : Promise.resolve([]),
        id ? fetchPartnerAvailabilityRulesForLawyer(id) : Promise.resolve(null),
        id ? fetchReservedBookingSlots(id) : Promise.resolve(new Set<string>()),
        getLawyers(),
      ]);

      if (!active) return;
      setLawyer(nextLawyer || null);
      setReviews(nextReviews);
      setAvailabilityRules(nextAvailabilityRules);
      setReservedSlots(nextReservedSlots);
      setLawyerCatalog(nextLawyerCatalog);
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
  const similarLawyers = useMemo(
    () => (lawyer ? getSimilarLawyerGroups(lawyerCatalog, lawyer) : { bestMatch: [], cheaper: [], faster: [], moreReviewed: [] }),
    [lawyer, lawyerCatalog],
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

  const lowestPrice = lowestConsultation?.price || Math.min(...lawyer.consultations.map((consultation) => consultation.price));
  const saved = workspace.savedLawyerIds.includes(lawyer.id);
  const compared = workspace.comparedLawyerIds.includes(lawyer.id);
  const reviewCount = reviews.length || lawyer.reviews;
  const displayRating =
    reviews.length > 0
      ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
      : lawyer.rating;
  const isOwnLawyerProfile = areLawyerIdsEqual(currentPartnerLawyerId, lawyer.id);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${lawyer.name} - ${lawyer.specialty} | Dikigoros`}
        description={`Συγκρίνετε τον/την ${lawyer.name} με βάση ειδίκευση, επαλήθευση, αξιολογήσεις, διαθεσιμότητα, τρόπους συμβουλευτικής και τιμή από.`}
        path={`/lawyer/${lawyer.id}`}
      />
      <Navbar />

      <main className="mx-auto max-w-7xl px-5 py-6 lg:px-8 lg:py-8">
        <div className="lg:flex lg:gap-8">
          <div className="min-w-0 flex-1">
            <section className="rounded-2xl border border-border bg-card p-6 md:p-7">
              <div className="flex flex-col gap-5 md:flex-row md:items-start">
                <div className="relative shrink-0">
                  <img
                    src={lawyer.image}
                    alt={lawyer.name}
                    className="h-32 w-32 rounded-2xl object-cover shadow-xl ring-2 ring-background md:h-36 md:w-36"
                  />
                  <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-sage ring-4 ring-card">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h1 className="font-serif text-3xl leading-tight tracking-tight text-foreground">{lawyer.name}</h1>
                  <p className="mt-1 text-[15px] font-bold text-primary/80">{lawyer.specialty}</p>
                  <p className="mt-2 max-w-2xl text-[13px] font-semibold leading-relaxed text-foreground/60">
                    {lawyer.bestFor}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] font-semibold text-foreground/60">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {lawyer.city}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4" />
                      {lawyer.experience} χρόνια
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      Απάντηση {lawyer.response}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Star className="h-5 w-5 fill-gold text-gold" />
                    <span className="text-xl font-bold text-foreground">{displayRating}</span>
                    <span className="text-sm font-semibold text-foreground/50">({reviewCount} αξιολογήσεις)</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {lawyer.credentials.map((credential) => (
                      <span key={credential} className="inline-flex items-center gap-1 rounded-lg bg-primary/[0.06] px-2.5 py-1 text-[11px] font-bold text-primary">
                        <Award className="h-3 w-3" />
                        {credential}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl border border-sage/20 bg-sage/10 px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="inline-flex items-center gap-2 text-[13px] font-bold text-sage-foreground">
                        <ShieldCheck className="h-4 w-4" />
                        Επαληθευμένος φάκελος συνεργάτη
                      </span>
                      <span className="text-[12px] font-semibold text-foreground/55">Τελευταίος έλεγχος: {lawyer.verification.checkedAt}</span>
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-foreground/65">
                      {lawyer.verification.barAssociation} · {lawyer.verification.registryLabel}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {lawyer.verification.evidence.map((item) => (
                        <span key={item} className="rounded-md bg-card px-2.5 py-1 text-[11px] font-bold text-foreground">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-5 border-t border-border pt-5 text-[14px] leading-relaxed text-foreground/60 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {lawyer.bio}
              </p>
            </section>

            <section className="mt-7 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-sage">Πραγματικές επόμενες ώρες</p>
                  <h2 className="mt-1 font-serif text-xl tracking-tight text-foreground">Διαθεσιμότητα πριν μπείτε στην κράτηση</h2>
                </div>
                <span className="rounded-lg bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
                  Ίδιοι κανόνες με τη ροή κράτησης
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {nextSlots.length > 0 ? nextSlots.map((slot) => (
                  <Link key={`${slot.dateLabel}-${slot.time}`} to={`/booking/${lawyer.id}`} className="rounded-xl border border-border bg-background p-3 transition hover:border-primary/25">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{slot.shortDateLabel}</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{slot.dateLabel}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-primary">
                      <Clock className="h-3.5 w-3.5" />
                      {slot.time}
                    </p>
                  </Link>
                )) : (
                  <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-sm font-semibold text-muted-foreground sm:col-span-2 lg:col-span-4">
                    Δεν υπάρχουν κοντινές δημόσιες ώρες από το τρέχον δημοσιευμένο πρόγραμμα.
                  </div>
                )}
              </div>
            </section>

            <section className="mt-7">
              <h2 className="font-serif text-xl tracking-tight text-foreground">Εξειδίκευση</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {lawyer.specialties.map((specialty) => (
                  <span key={specialty} className="rounded-lg border border-border bg-secondary px-3.5 py-1.5 text-[13px] font-bold text-foreground">
                    {specialty}
                  </span>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-serif text-xl tracking-tight text-foreground">Τύποι ραντεβού και τιμές</h2>
              <div className="mt-3 space-y-2.5">
                {lawyer.consultations.map((consultation) => {
                  const Icon = consultationModeIcons[consultation.mode];
                  return (
                    <div key={consultation.mode} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md hover:shadow-foreground/[0.03]">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-foreground">{consultation.type}</p>
                          <p className="text-xs font-semibold text-foreground/50">Διάρκεια: {consultation.duration}</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-foreground">€{consultation.price}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-8 grid gap-4 md:grid-cols-3">
              <DecisionInfoCard icon={FileText} title="Τι να ετοιμάσετε">
                Σύντομο ιστορικό, ονόματα εμπλεκομένων, βασικές προθεσμίες και έγγραφα, ειδοποιήσεις, δικαστικά χαρτιά ή μηνύματα που εξηγούν το θέμα.
              </DecisionInfoCard>
              <DecisionInfoCard icon={MessageSquareQuote} title="Τι θα γίνει">
                Η πρώτη συμβουλευτική ξεκαθαρίζει γεγονότα, άμεσους κινδύνους, πιθανά επόμενα βήματα και αν ο δικηγόρος μπορεί να συνεχίσει την υπόθεση.
              </DecisionInfoCard>
              <DecisionInfoCard icon={CreditCard} title="Αλλαγή ή ακύρωση">
                Δωρεάν ακύρωση ή αλλαγή έως 24 ώρες πριν. Μεταγενέστερες αλλαγές μπορεί να χρειαστούν έλεγχο υποστήριξης πριν από επιστροφή.
              </DecisionInfoCard>
            </section>

            <section className="mt-8 grid gap-6 md:grid-cols-2">
              <div>
                <h2 className="font-serif text-xl tracking-tight text-foreground">Σπουδές</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-foreground/55">{lawyer.education}</p>
              </div>
              <div>
                <h2 className="font-serif text-xl tracking-tight text-foreground">Γλώσσες</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {lawyer.languages.map((language) => (
                    <span key={language} className="rounded-lg bg-secondary px-3 py-1.5 text-[13px] font-bold text-foreground">
                      {language}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-xl tracking-tight text-foreground">Αξιολογήσεις</h2>
                <div className="flex items-center gap-1.5 text-sm">
                  <Star className="h-4 w-4 fill-gold text-gold" />
                  <span className="font-bold text-foreground">{displayRating}</span>
                  <span className="font-semibold text-foreground/50">· {reviewCount} αξιολογήσεις</span>
                </div>
              </div>
              <p className="mt-2 text-[13px] leading-6 text-foreground/55">
                Οι αξιολογήσεις συνδέονται με ολοκληρωμένα ραντεβού και εμφανίζονται χωρίς δημόσια στοιχεία υπόθεσης.
              </p>
              <div className="mt-3 space-y-2.5">
                {reviews.length > 0 ? reviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-serif text-sm font-bold text-primary-foreground">
                          {review.clientName[0]}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-foreground">{review.clientName}</p>
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
                    <p className="mt-3 text-[14px] leading-relaxed text-foreground/70">{review.text}</p>
                    {review.lawyerReply ? (
                      <div className="mt-3 rounded-xl bg-secondary px-4 py-3 text-[13px] leading-relaxed text-foreground/65">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Απάντηση δικηγόρου</p>
                        <p>{review.lawyerReply}</p>
                      </div>
                    ) : null}
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-6 text-center">
                    <p className="text-sm font-bold text-foreground">Δεν υπάρχουν ακόμη δημοσιευμένες γραπτές κριτικές.</p>
                    <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                      Οι γραπτές κριτικές εμφανίζονται μόνο όταν συνδεθούν με ολοκληρωμένο ραντεβού και περάσουν τον έλεγχο δημοσίευσης.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-serif text-xl tracking-tight text-foreground">Εναλλακτικές με συγκεκριμένο λόγο</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <AlternativeGroup title="Καλύτερη συνολική αντιστοίχιση" lawyers={similarLawyers.bestMatch} />
                <AlternativeGroup title="Χαμηλότερη τιμή" lawyers={similarLawyers.cheaper} />
                <AlternativeGroup title="Ταχύτερη απάντηση" lawyers={similarLawyers.faster} />
                <AlternativeGroup title="Περισσότερες αξιολογήσεις" lawyers={similarLawyers.moreReviewed} />
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-serif text-xl tracking-tight text-foreground">Συχνές ερωτήσεις</h2>
              <Accordion type="single" collapsible className="mt-3 space-y-2">
                {[
                  { q: "Πώς γίνεται η βιντεοκλήση;", a: "Μετά την κράτηση θα λάβετε ασφαλή σύνδεσμο στο ηλεκτρονικό ταχυδρομείο σας. Δεν χρειάζεται εγκατάσταση εφαρμογής." },
                  { q: "Μπορώ να ακυρώσω το ραντεβού;", a: "Ναι, μπορείτε να ακυρώσετε δωρεάν μέχρι 24 ώρες πριν το ραντεβού." },
                  { q: "Τι πρέπει να ετοιμάσω;", a: "Ετοιμάστε σύντομη περιγραφή του θέματος και τυχόν σχετικά έγγραφα. Ο δικηγόρος θα σας καθοδηγήσει." },
                ].map((faq) => (
                  <AccordionItem key={faq.q} value={faq.q} className="rounded-xl border border-border bg-card px-5">
                    <AccordionTrigger className="py-4 text-left font-sans text-[15px] font-bold text-foreground hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-[13px] leading-relaxed text-foreground/55">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          </div>

          <aside className="mt-6 shrink-0 lg:sticky lg:top-24 lg:mt-0 lg:w-80 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xl shadow-foreground/[0.06]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">Κλείστε ραντεβού</p>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-[1.75rem] font-bold text-foreground">από {formatCurrency(lowestPrice)}</span>
                <span className="text-[13px] font-semibold text-foreground/40">/ συμβουλευτική</span>
              </div>

              <div className="mt-4 space-y-2.5">
                <Signal icon={CheckCircle2}>Πιστοποιημένος δικηγόρος</Signal>
                <Signal icon={ShieldCheck}>{lawyer.verification.barAssociation}</Signal>
                <Signal icon={Clock}>Απάντηση {lawyer.response}</Signal>
                <Signal icon={Star}>{displayRating} ({reviewCount} αξιολογήσεις)</Signal>
                <Signal icon={CreditCard}>Πληρωμή πριν θεωρηθεί δεσμευμένο</Signal>
                <Signal icon={CalendarDays}>Πραγματική ώρα κρατιέται στο checkout</Signal>
                <Signal icon={ShieldCheck}>Δωρεάν ακύρωση 24 ώρες πριν</Signal>
              </div>

              <div className="mt-4 rounded-xl bg-sage/10 p-3">
                <p className="text-[11px] font-bold text-sage-foreground">Επόμενη διαθεσιμότητα</p>
                <p className="mt-0.5 text-[15px] font-bold text-foreground">{lawyer.available}</p>
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
                <Link to={`/booking/${lawyer.id}`}>
                  Κλείσε ραντεβού
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={saved ? "default" : "outline"}
                  onClick={() => {
                    const nextWorkspace = toggleSavedLawyer(workspaceKey, lawyer.id);
                    setWorkspace(nextWorkspace);
                    void syncUserWorkspace(workspaceKey, nextWorkspace, user?.id);
                  }}
                  className="rounded-xl text-xs font-bold"
                >
                  <Heart className={saved ? "fill-current" : ""} />
                  {saved ? "Σώθηκε" : "Αποθήκευση"}
                </Button>
                <Button
                  type="button"
                  variant={compared ? "default" : "outline"}
                  onClick={() => {
                    const nextWorkspace = toggleComparedLawyer(workspaceKey, lawyer.id);
                    setWorkspace(nextWorkspace);
                    void syncUserWorkspace(workspaceKey, nextWorkspace, user?.id);
                  }}
                  className="rounded-xl text-xs font-bold"
                >
                  <Scale />
                  {compared ? "Σύγκριση" : "Σύγκρινε"}
                </Button>
              </div>
              <div className="mt-3 flex flex-col items-center gap-1 text-[11px] font-semibold text-foreground/40">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Ασφαλής κράτηση
                </span>
                <span>Οι αξιολογήσεις εμφανίζονται μόνο μετά από ολοκληρωμένο ραντεβού.</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <div className="pb-20 lg:pb-0">
        <Footer />
      </div>
    </div>
  );
};

const Signal = ({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) => (
  <div className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground">
    <Icon className="h-4 w-4 text-sage" />
    {children}
  </div>
);

const ReviewMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-background px-3 py-2">
    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
  </div>
);

const DecisionInfoCard = ({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <Icon className="h-5 w-5 text-primary" />
    <h3 className="mt-3 text-sm font-bold text-foreground">{title}</h3>
    <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{children}</p>
  </div>
);

const AlternativeGroup = ({ title, lawyers }: { title: string; lawyers: Lawyer[] }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
    <div className="mt-3 space-y-2">
      {lawyers.length > 0 ? lawyers.map((lawyer) => (
        <Link key={lawyer.id} to={`/lawyer/${lawyer.id}`} className="block rounded-lg bg-secondary/60 p-3 transition hover:bg-secondary">
          <p className="truncate text-sm font-bold text-foreground">{lawyer.name}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {formatCurrency(getPriceFrom(lawyer))} · {lawyer.response} · {lawyer.reviews} αξιολογήσεις
          </p>
        </Link>
      )) : (
        <p className="text-sm leading-6 text-muted-foreground">Δεν υπάρχει ισχυρότερη εναλλακτική σε αυτή την ομάδα ακόμη.</p>
      )}
    </div>
  </div>
);

export default LawyerProfile;
