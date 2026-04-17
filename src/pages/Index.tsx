import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Languages,
  MapPin,
  MessageSquareText,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import { type ConsultationMode } from "@/data/lawyers";
import { getLawyers } from "@/lib/lawyerRepository";
import {
  consultationModeNames,
  featuredGroupLabels,
  formatCurrency,
  getFeaturedLawyerGroups,
  getMarketplaceStats,
  getPriceFrom,
  getRecommendedLawyers,
  popularLegalJourneys,
  publicTrustMechanics,
  type FeaturedGroupKey,
  type LanguageIntent,
} from "@/lib/marketplace";
import { cn } from "@/lib/utils";

const modeOptions: Array<{ value: "any" | ConsultationMode; label: string }> = [
  { value: "any", label: "Όλοι οι τρόποι" },
  { value: "video", label: "Βιντεοκλήση" },
  { value: "phone", label: "Τηλεφωνική συμβουλευτική" },
  { value: "inPerson", label: "Συνάντηση στο γραφείο" },
];

const languageOptions: Array<{ value: "any" | LanguageIntent; label: string }> = [
  { value: "any", label: "Όλες οι γλώσσες" },
  { value: "Greek", label: "Ελληνικά" },
  { value: "English", label: "Αγγλικά" },
];

const groupOrder: FeaturedGroupKey[] = ["topRated", "fastestResponse", "bestValue", "availableSoon"];

const trustCards = [
  {
    icon: ShieldCheck,
    title: "Ελεγμένα δημόσια προφίλ",
    text: "Ταυτότητα, άδεια άσκησης, δικηγορικός σύλλογος και βασικά επαγγελματικά στοιχεία ελέγχονται πριν από τη δημόσια εμφάνιση.",
  },
  {
    icon: MessageSquareText,
    title: "Αξιολογήσεις μετά από ραντεβού",
    text: "Οι δημοσιευμένες αξιολογήσεις συνδέονται με ολοκληρωμένες συμβουλευτικές, έλεγχο δημοσίευσης και δυνατότητα απάντησης δικηγόρου.",
  },
  {
    icon: CalendarCheck,
    title: "Πραγματικοί κανόνες διαθεσιμότητας",
    text: "Οι ώρες κράτησης ακολουθούν το δημοσιευμένο πρόγραμμα, το παράθυρο κρατήσεων και τα buffers κάθε δικηγόρου.",
  },
  {
    icon: CreditCard,
    title: "Ασφαλής κράτηση και πληρωμή",
    text: "Η δέσμευση και πληρωμή του πρώτου ραντεβού γίνεται μέσα από Stripe Checkout πριν θεωρηθεί πληρωμένη η κράτηση.",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [legalIssue, setLegalIssue] = useState("");
  const [city, setCity] = useState("");
  const [mode, setMode] = useState<"any" | ConsultationMode>("any");
  const [language, setLanguage] = useState<"any" | LanguageIntent>("any");
  const [problemDescription, setProblemDescription] = useState("");
  const [activeGroup, setActiveGroup] = useState<FeaturedGroupKey>("topRated");

  const { data: marketplaceLawyers = [], isFetching } = useQuery({
    queryKey: ["lawyers"],
    queryFn: getLawyers,
  });

  const stats = useMemo(() => getMarketplaceStats(marketplaceLawyers), [marketplaceLawyers]);
  const featuredGroups = useMemo(() => getFeaturedLawyerGroups(marketplaceLawyers), [marketplaceLawyers]);
  const recommendedLawyers = useMemo(() => getRecommendedLawyers(marketplaceLawyers, 3), [marketplaceLawyers]);
  const activeFeaturedLawyers = featuredGroups[activeGroup].length > 0 ? featuredGroups[activeGroup] : recommendedLawyers;
  const heroLawyer = recommendedLawyers[0] || marketplaceLawyers[0];
  const reviewBackedLawyers = recommendedLawyers.filter((lawyer) => lawyer.reviews > 0);

  const handleHeroSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    const query = legalIssue.trim() || problemDescription.trim();

    if (query) params.set("q", query);
    if (city.trim()) params.set("city", city.trim());
    if (mode !== "any") params.set("type", mode);
    if (language !== "any") params.set("language", language);

    navigate({ pathname: "/search", search: params.toString() });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Βρείτε και κλείστε ραντεβού με δικηγόρο | Dikigoros"
        description="Περιγράψτε το νομικό θέμα, συγκρίνετε ελεγμένα προφίλ με αξιολογήσεις, διαθεσιμότητα, απάντηση και τιμή, και κλείστε με ασφαλή πληρωμή."
        path="/"
      />
      <Navbar />

      <section id="top" className="border-b border-border bg-secondary/35">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-sage" />
              Ελεγμένα προφίλ, πραγματική διαθεσιμότητα, αξιολογήσεις μετά από κράτηση
            </p>
            <h1 className="mt-5 max-w-3xl font-serif text-[2.65rem] leading-[1.06] tracking-tight text-foreground md:text-[3.4rem]">
              Περιγράψτε το θέμα. Συγκρίνετε δικηγόρους. Κλείστε ραντεβού με πληρωμή.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Ξεκινήστε από όσα αλλάζουν την επιλογή: θέμα, πόλη, τρόπο συμβουλευτικής και γλώσσα. Προσθέστε λεπτομέρειες μόνο όταν βοηθούν την προετοιμασία.
            </p>

            <form onSubmit={handleHeroSubmit} className="mt-7 rounded-lg border border-border bg-card p-4 shadow-xl shadow-foreground/[0.05] md:p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <FieldShell icon={Search} label="Νομικό θέμα">
                  <input
                    value={legalIssue}
                    onChange={(event) => setLegalIssue(event.target.value)}
                    placeholder="Διαζύγιο, απόλυση, κληρονομιά..."
                    className="h-11 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/60"
                  />
                </FieldShell>
                <FieldShell icon={MapPin} label="Πόλη">
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Αθήνα, Θεσσαλονίκη..."
                    className="h-11 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/60"
                  />
                </FieldShell>
                <FieldShell icon={CalendarCheck} label="Τρόπος συμβουλευτικής">
                  <select
                    value={mode}
                    onChange={(event) => setMode(event.target.value as "any" | ConsultationMode)}
                    className="h-11 w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                  >
                    {modeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FieldShell>
                <FieldShell icon={Languages} label="Γλώσσα">
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as "any" | LanguageIntent)}
                    className="h-11 w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                  >
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FieldShell>
              </div>
              <label className="mt-3 block rounded-lg border border-border bg-background px-3 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Σύντομη περιγραφή, προαιρετικά</span>
                <textarea
                  value={problemDescription}
                  onChange={(event) => setProblemDescription(event.target.value)}
                  rows={3}
                  placeholder="Λίγες γραμμές για το τι συνέβη και τι χρειάζεστε τώρα."
                  className="mt-1 w-full resize-none bg-transparent text-sm font-medium leading-6 text-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </label>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button type="submit" className="h-12 rounded-lg px-6 text-sm font-bold">
                  Σύγκριση δικηγόρων
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-xs font-semibold text-muted-foreground">
                  {isFetching ? "Ανανέωση δεδομένων αγοράς..." : `${stats.verifiedProfiles} δημόσια ελεγμένα προφίλ`}
                </p>
              </div>
            </form>
          </div>

          {heroLawyer ? (
            <aside className="self-center rounded-lg border border-border bg-card p-5 shadow-2xl shadow-foreground/[0.07]">
              <div className="flex items-start gap-4">
                <img src={heroLawyer.image} alt={heroLawyer.name} className="h-20 w-20 rounded-lg object-cover shadow-md ring-2 ring-background" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-sage">Διαθέσιμο προφίλ αγοράς</p>
                  <h2 className="mt-1 truncate text-lg font-bold text-foreground">{heroLawyer.name}</h2>
                  <p className="text-sm font-semibold text-primary">{heroLawyer.specialty}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{heroLawyer.city} · {heroLawyer.experience} χρόνια</p>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <HeroMetric label="Αξιολόγηση" value={`${heroLawyer.rating}/5`} detail={`${heroLawyer.reviews} αξιολογήσεις`} />
                <HeroMetric label="Απάντηση" value={heroLawyer.response} detail="Σήμα δημόσιου προφίλ" />
                <HeroMetric label="Επόμενη ώρα" value={heroLawyer.available} detail="Κανόνες διαθεσιμότητας" />
                <HeroMetric label="Τιμή από" value={formatCurrency(getPriceFrom(heroLawyer))} detail="Πρώτη συμβουλευτική" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {heroLawyer.consultationModes.map((item) => (
                  <span key={item} className="rounded-md bg-secondary px-2.5 py-1 text-xs font-bold text-foreground">
                    {consultationModeNames[item]}
                  </span>
                ))}
              </div>
              <Button asChild className="mt-5 h-11 w-full rounded-lg font-bold">
                <Link to={`/lawyer/${heroLawyer.id}`}>Προβολή προφίλ απόφασης</Link>
              </Button>
            </aside>
          ) : null}
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-5 md:grid-cols-4 lg:px-8">
          <TrustStat value={String(stats.verifiedProfiles)} label="ελεγμένα δημόσια προφίλ" />
          <TrustStat value={`${stats.totalReviews}+`} label="αξιολογήσεις μετά από κράτηση" />
          <TrustStat value={`${stats.averageRating}/5`} label="μέση αξιολόγηση αγοράς" />
          <TrustStat value={`${stats.availableToday}`} label="διαθέσιμοι σήμερα" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sage">Ομάδες αγοράς</p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground">Προτάσεις από ζωντανά δημόσια προφίλ</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Οι ομάδες υπολογίζονται από αξιολογήσεις, αριθμό κριτικών, χρόνο απάντησης, τιμή και διαθεσιμότητα, με τα ίδια δεδομένα που χρησιμοποιούνται στην αναζήτηση και στα προφίλ.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-lg font-bold">
            <Link to="/search">Άνοιγμα αναζήτησης</Link>
          </Button>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {groupOrder.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setActiveGroup(group)}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-2 text-xs font-bold transition",
                activeGroup === group
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/30",
              )}
            >
              {featuredGroupLabels[group]}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {activeFeaturedLawyers.map((lawyer) => (
            <Link
              key={lawyer.id}
              to={`/lawyer/${lawyer.id}`}
              className="rounded-lg border border-border bg-card p-5 transition hover:border-primary/25 hover:shadow-xl hover:shadow-foreground/[0.05]"
            >
              <div className="flex items-start gap-4">
                <img src={lawyer.image} alt={lawyer.name} className="h-16 w-16 rounded-lg object-cover ring-2 ring-background" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">{lawyer.specialty}</p>
                  <h3 className="mt-1 truncate text-base font-bold text-foreground">{lawyer.name}</h3>
                  <p className="text-xs font-semibold text-muted-foreground">{lawyer.bestFor}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <ProofPill icon={MapPin}>{lawyer.city}</ProofPill>
                <ProofPill icon={Star}>{lawyer.rating} · {lawyer.reviews}</ProofPill>
                <ProofPill icon={Clock}>{lawyer.response}</ProofPill>
                <ProofPill icon={CalendarCheck}>{lawyer.available}</ProofPill>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-lg font-bold text-foreground">{formatCurrency(getPriceFrom(lawyer))}</span>
                <span className="text-xs font-bold text-primary">Σύγκριση και κράτηση</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="categories" className="border-y border-border bg-secondary/35">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-sage">Συχνές νομικές διαδρομές</p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground">Ξεκινήστε από το πρόβλημα, όχι από κατάλογο κατηγοριών</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {popularLegalJourneys.map((journey) => (
              <Link key={journey.title} to={journey.to} className="rounded-lg border border-border bg-card p-4 transition hover:border-primary/25 hover:shadow-md">
                <h3 className="text-base font-bold text-foreground">{journey.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{journey.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary">
                  Δείτε δικηγόρους
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-14">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-sage">Διαδρομή κράτησης</p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground">Περιγραφή, σύγκριση, κράτηση και πληρωμή</h2>
        </div>
        <div className="mx-auto mt-7 grid max-w-5xl gap-3 md:grid-cols-3">
          {[
            ["01", "Περιγράψτε το θέμα", "Χρησιμοποιήστε θέμα, πόλη, γλώσσα και τρόπο συμβουλευτικής για γρήγορο περιορισμό της αγοράς."],
            ["02", "Συγκρίνετε δικηγόρους", "Δείτε εξειδίκευση, καταλληλότητα, αξιολόγηση, απάντηση, επόμενη ώρα, τρόπους και τιμή."],
            ["03", "Κλείστε και πληρώστε", "Δεσμεύστε πραγματική ώρα, επιβεβαιώστε τη σύνοψη και ολοκληρώστε την ασφαλή πληρωμή."],
          ].map(([step, title, text]) => (
            <div key={step} className="rounded-lg border border-border bg-card p-5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary font-serif text-primary-foreground">{step}</span>
              <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-14">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sage">Κανόνες εμπιστοσύνης</p>
              <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground">Απόδειξη που ακολουθεί το σύστημα κρατήσεων</h2>
              <div className="mt-5 space-y-2">
                {publicTrustMechanics.map((item) => (
                  <p key={item} className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-sage" />
                    {item}
                  </p>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {trustCards.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-lg border border-border bg-background p-5">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-3 text-base font-bold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {reviewBackedLawyers.length > 0 ? (
        <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-sage">Απόδειξη από αξιολογήσεις</p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground">Δημοσιευμένα σήματα αξιολόγησης, όχι μαρτυρίες βιτρίνας</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {reviewBackedLawyers.map((lawyer) => (
              <Link key={lawyer.id} to={`/lawyer/${lawyer.id}`} className="rounded-lg border border-border bg-card p-5 transition hover:border-primary/25">
                <div className="flex items-center gap-1.5 text-gold">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="font-bold text-foreground">{lawyer.rating}</span>
                  <span className="text-sm font-semibold text-muted-foreground">από {lawyer.reviews} αξιολογήσεις</span>
                </div>
                <h3 className="mt-3 text-base font-bold text-foreground">{lawyer.name}</h3>
                <p className="mt-1 text-sm font-semibold text-primary">{lawyer.specialty}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Οι αξιολογήσεις δημοσιεύονται μόνο μετά από ολοκληρωμένες συμβουλευτικές και εμφανίζονται στο προφίλ απόφασης.
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="rounded-lg bg-primary px-6 py-9 text-center text-primary-foreground">
          <h2 className="font-serif text-3xl tracking-tight">Έτοιμοι να συγκρίνετε πραγματικές επιλογές;</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-primary-foreground/70">
            Συνεχίστε στην αναζήτηση με τα ίδια δημόσια δεδομένα αγοράς, φτιάξτε σύντομη λίστα, συγκρίνετε και κλείστε ραντεβού.
          </p>
          <Button asChild variant="secondary" className="mt-5 rounded-lg font-bold">
            <Link to="/search">
              Βρείτε δικηγόρο
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

const FieldShell = ({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Search;
  label: string;
  children: React.ReactNode;
}) => (
  <label className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </span>
  </label>
);

const HeroMetric = ({ label, value, detail }: { label: string; value: string; detail: string }) => (
  <div className="rounded-lg border border-border bg-secondary/45 p-3">
    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{detail}</p>
  </div>
);

const TrustStat = ({ value, label }: { value: string; label: string }) => (
  <div className="text-center md:text-left">
    <p className="font-serif text-3xl">{value}</p>
    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-primary-foreground/60">{label}</p>
  </div>
);

const ProofPill = ({ icon: Icon, children }: { icon: typeof Search; children: React.ReactNode }) => (
  <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 font-semibold text-foreground">
    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    {children}
  </span>
);

export default Index;
