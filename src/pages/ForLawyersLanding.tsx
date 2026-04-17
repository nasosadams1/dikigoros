import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileSearch,
  MessageSquareReply,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";

const roiPoints = [
  "Λιγότερα άσχετα αιτήματα",
  "Πιο κατάλληλες πρώτες συμβουλευτικές",
  "Έλεγχος διαθεσιμότητας και κρατήσεων",
  "Ισχυρότερα δημόσια σήματα εμπιστοσύνης",
  "Αξιολογήσεις συνδεδεμένες με ολοκληρωμένες κρατήσεις",
];

const firmTools = [
  { icon: UsersRound, title: "Δημόσιο προφίλ", text: "Ειδικεύσεις, γλώσσες, τιμές, έλεγχοι εμπιστοσύνης και στοιχεία συμβουλευτικής που βοηθούν την απόφαση." },
  { icon: CalendarClock, title: "Έλεγχος διαθεσιμότητας", text: "Δημοσιευμένα παράθυρα κρατήσεων, ημέρες εργασίας, κενά ασφαλείας και τρόποι συμβουλευτικής." },
  { icon: FileSearch, title: "Διαχείριση κρατήσεων", text: "Επιβεβαιωμένα ραντεβού, πλαίσιο πελάτη, κατάσταση ολοκλήρωσης και ορατότητα πληρωμής." },
  { icon: MessageSquareReply, title: "Χειρισμός αξιολογήσεων", text: "Ελεγμένες δημοσιευμένες αξιολογήσεις, απαντήσεις και απόδειξη συνδεδεμένη με ολοκληρωμένες κρατήσεις." },
  { icon: ShieldCheck, title: "Έλεγχος αιτήσεων", text: "Έλεγχοι ετοιμότητας και ελεγχόμενη δημόσια κατάσταση πριν από την εμφάνιση στην αγορά." },
  { icon: TrendingUp, title: "Πίνακας συνεργάτη", text: "Ένας χώρος για προφίλ, διαθεσιμότητα, κρατήσεις, έγγραφα, πληρωμές και αξιολογήσεις." },
];

const proofModules = [
  {
    title: "Διαθεσιμότητα που μειώνει χαμένο χρόνο",
    signal: "Ώρες, κενά ασφαλείας, τρόποι συμβουλευτικής",
    text: "Ο πελάτης βλέπει μόνο ώρες που μπορούν να κρατηθούν και το γραφείο κρατά έλεγχο στις ημέρες εργασίας, στα κενά και στις αλλαγές.",
  },
  {
    title: "Κρατήσεις με καθαρή κατάσταση",
    signal: "Επιβεβαίωση, πληρωμή, ολοκλήρωση",
    text: "Κάθε πρώτη συμβουλευτική έχει κωδικό, στοιχεία πελάτη, τρόπο επικοινωνίας, κατάσταση πληρωμής και βήμα ολοκλήρωσης.",
  },
  {
    title: "Κριτικές που χτίζουν εμπιστοσύνη",
    signal: "Μόνο μετά από ολοκληρωμένη κράτηση",
    text: "Οι δημόσιες κριτικές ανοίγουν μετά την ολοκλήρωση, μπορούν να ελεγχθούν και μπορούν να απαντηθούν χωρίς να εκτίθενται ιδιωτικά στοιχεία υπόθεσης.",
  },
  {
    title: "Αναφορά απόδοσης",
    signal: "Ζήτηση, κρατήσεις, πρώτες συμβουλευτικές",
    text: "Το γραφείο βλέπει τι φέρνει πραγματική πρόθεση, ποιες ειδικεύσεις αποδίδουν και πού χρειάζεται καλύτερη δημόσια απόδειξη.",
  },
];

const pricingRules = [
  "Η βασική χρέωση εφαρμόζεται όταν η πρώτη συμβουλευτική ολοκληρωθεί και η κράτηση έχει επιβεβαιωμένη κατάσταση.",
  "Ακύρωση, αποτυχία πληρωμής ή μη πραγματοποίηση ραντεβού δεν αντιμετωπίζονται ως ολοκληρωμένη πρώτη συμβουλευτική.",
  "Τα πακέτα Ανάπτυξη και Ομάδα μειώνουν την τριβή για γραφεία με μεγαλύτερο όγκο, περισσότερες θέσεις ή ανάγκη εμπορικής αναφοράς.",
];

const commercialProof = [
  {
    title: "Τι μετρά ως ολοκληρωμένη πρώτη συμβουλευτική",
    text: "Κράτηση με επιβεβαιωμένη ώρα, ολοκληρωμένη πληρωμή ή εγκεκριμένη πληρωτική κατάσταση, και σήμανση ολοκλήρωσης από τον δικηγόρο μετά τη συμβουλευτική.",
  },
  {
    title: "Τι δεν μετρά",
    text: "Ακύρωση πριν γίνει συμβουλευτική, αποτυχία ή εγκατάλειψη πληρωμής, μη εμφάνιση που βρίσκεται σε έλεγχο, δοκιμαστική κράτηση ή υπόθεση που ακυρώθηκε από τον δικηγόρο.",
  },
  {
    title: "Τι ελέγχει ο δικηγόρος",
    text: "Δημόσιες ειδικεύσεις, τρόπους συμβουλευτικής, τιμές, διαθέσιμες ώρες, κενά ασφαλείας, απαντήσεις σε κριτικές και βασική προετοιμασία πελάτη.",
  },
  {
    title: "Τι δείχνει η αναφορά",
    text: "Αιτήματα ανά ειδίκευση, κρατήσεις, πληρωμένες πρώτες συμβουλευτικές, ολοκληρωμένες συνεδρίες, κριτικές, ακυρώσεις και σημεία που χάνουν ζήτηση.",
  },
];

const plans = [
  {
    name: "Ατομικό",
    commercial: "Ανά ολοκληρωμένη πρώτη συμβουλευτική",
    bestFor: "Ανεξάρτητοι δικηγόροι που θέλουν προβλέψιμη ροή ραντεβού.",
    includes: ["Δημόσιο προφίλ", "Διαχείριση διαθεσιμότητας", "Διαχείριση κρατήσεων", "Σύστημα αξιολογήσεων"],
  },
  {
    name: "Ανάπτυξη",
    commercial: "Χαμηλότερη προμήθεια με μηνιαίο ελάχιστο",
    bestFor: "Γραφεία με ζήτηση που θέλουν μεγαλύτερη ανακάλυψη και ισχυρότερη απόδειξη εμπιστοσύνης.",
    includes: ["Όλα του Ατομικού", "Προτεραιότητα σε έλεγχο κατηγορίας", "Υποστήριξη βελτίωσης προφίλ", "Επιπλέον πεδία αρχικής λήψης στοιχείων"],
  },
  {
    name: "Ομάδα",
    commercial: "Συμφωνία γραφείου",
    bestFor: "Μικρά γραφεία με πολλούς δικηγόρους, θέσεις ή ανάγκη διαχειριζόμενης αρχικής λήψης στοιχείων.",
    includes: ["Όλα της Ανάπτυξης", "Επιπλέον θέσεις", "Ομαδική ένταξη", "Εμπορική αναφορά"],
  },
];

const addOns = ["Προνομιακή προβολή", "Επιπλέον θέση", "Εργαλεία επώνυμης αρχικής λήψης στοιχείων και προφίλ", "Εργαλεία πληρωμών", "Υποστήριξη ένταξης"];

const onboardingSteps = [
  {
    title: "Αίτηση",
    text: "Εκτιμώμενος χρόνος: 8-12 λεπτά. Ζητάμε στοιχεία επικοινωνίας, πρακτικής, δικηγορικού συλλόγου, αριθμό μητρώου, ειδικεύσεις και έγγραφα ελέγχου.",
  },
  {
    title: "Έλεγχοι φακέλου",
    text: "Ταυτότητα, άδεια, επαγγελματικά στοιχεία, δικηγορικός σύλλογος και βασική ετοιμότητα ελέγχονται πριν από δημόσια προβολή.",
  },
  {
    title: "Ετοιμότητα προφίλ",
    text: "Το δημόσιο προφίλ χρειάζεται σαφείς ειδικεύσεις, τρόπους συμβουλευτικής, τιμές, διαθεσιμότητα και οδηγίες προετοιμασίας.",
  },
  {
    title: "Ελεγχόμενη δημοσίευση",
    text: "Οι εγκεκριμένοι συνεργάτες διαχειρίζονται διαθεσιμότητα, λαμβάνουν κρατήσεις, χειρίζονται αξιολογήσεις και ενημερώνουν δημόσια στοιχεία από τον πίνακα.",
  },
];

const ForLawyersLanding = () => {
  return (
    <PartnerShell>
      <SEO
        title="Για δικηγόρους και γραφεία | Dikigoros"
        description="Συμμετοχή σε ελεγμένη νομική αγορά με κατάλληλες συμβουλευτικές, έλεγχο διαθεσιμότητας, διαχείριση κρατήσεων, αξιόπιστες αξιολογήσεις και σαφές εμπορικό μοντέλο."
        path="/for-lawyers"
      />
      <div className="space-y-5">
        <section className="partner-panel p-7 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="max-w-[780px]">
              <p className="partner-kicker">Για δικηγόρους και γραφεία</p>
              <h1 className="mt-4 max-w-[780px] font-serif text-[2.8rem] leading-[1.02] tracking-[-0.035em] text-[hsl(var(--partner-ink))] sm:text-[3.2rem] lg:text-[3.5rem]">
                Πιο κατάλληλες συμβουλευτικές. Λιγότερος θόρυβος πριν το ραντεβού.
              </h1>
              <p className="mt-4 max-w-[64ch] text-[15px] leading-6 text-muted-foreground">
                Το Dikigoros χτίζεται γύρω από δημόσια εμπιστοσύνη, πραγματική διαθεσιμότητα και αξιολογήσεις μετά από κρατήσεις, ώστε ο πελάτης να συγκρίνει με αυτοπεποίθηση πριν δεσμεύσει πρώτη συμβουλευτική.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-[50px] rounded-[8px] bg-[hsl(var(--partner-navy))] px-5 text-sm font-semibold text-white hover:bg-[hsl(var(--partner-navy))]/94">
                  <Link to="/for-lawyers/apply">
                    Αίτηση συνεργασίας
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-[50px] rounded-[8px] border-[hsl(var(--partner-line))] bg-white px-5 text-sm font-semibold text-[hsl(var(--partner-ink))] hover:bg-white">
                  <Link to="/for-lawyers/login">Σύνδεση συνεργάτη</Link>
                </Button>
              </div>
            </div>

            <aside className="partner-soft-card-strong p-5">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--partner-navy-soft))]">Τι βελτιώνει την απόδοση</p>
              <div className="mt-4 space-y-3">
                {roiPoints.map((point) => (
                  <p key={point} className="flex items-start gap-3 text-sm font-semibold leading-6 text-[hsl(var(--partner-ink))]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--partner-navy))]" />
                    {point}
                  </p>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="partner-panel p-7 lg:p-8">
          <div className="max-w-[720px]">
            <p className="partner-kicker">Τι παίρνει το γραφείο</p>
            <h2 className="mt-3 font-sans text-[30px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
              Εργαλεία αγοράς που μετατρέπουν την εμπιστοσύνη σε κρατήσεις
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {firmTools.map(({ icon: Icon, title, text }) => (
              <div key={title} className="partner-soft-card p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[hsl(var(--partner-navy))] text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="partner-panel p-7 lg:p-8">
          <div className="max-w-[760px]">
            <p className="partner-kicker">Απόδειξη προϊόντος</p>
            <h2 className="mt-3 font-sans text-[30px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
              Όχι απλή προβολή. Καλύτερη αρχική λήψη στοιχείων, λιγότερος θόρυβος, καθαρότερη πρώτη συμβουλευτική.
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {proofModules.map((module) => (
              <article key={module.title} className="partner-soft-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--partner-navy-soft))]">{module.signal}</p>
                <h3 className="mt-3 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="partner-panel p-7 lg:p-8">
          <div className="max-w-[760px]">
            <p className="partner-kicker">Οικονομική απόδειξη</p>
            <h2 className="mt-3 font-sans text-[30px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
              Ο δικηγόρος πρέπει να ξέρει πότε πληρώνει, τι ελέγχει και τι κερδίζει.
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {commercialProof.map((item) => (
              <article key={item.title} className="partner-soft-card p-5">
                <h3 className="text-[20px] font-semibold leading-snug tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="partner-dark-panel p-7">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/58">Εμπορικό μοντέλο</p>
            <h2 className="mt-3 font-sans text-[30px] font-semibold leading-tight tracking-[-0.02em] text-white">
              Πληρωμή ανά ολοκληρωμένη πρώτη συμβουλευτική και εργαλεία ανάπτυξης όταν χρειάζονται.
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Το βασικό μοντέλο ευθυγραμμίζει την προμήθεια της πλατφόρμας με πραγματικά παραδομένες πρώτες συμβουλευτικές. Μεγαλύτερα γραφεία μπορούν να περάσουν σε μηνιαίο ελάχιστο ή συμφωνία γραφείου όταν ο όγκος το δικαιολογεί.
            </p>
            <div className="mt-5 grid gap-2">
              {pricingRules.map((rule) => (
                <p key={rule} className="rounded-[8px] border border-white/10 bg-white/8 px-3 py-2 text-sm font-semibold leading-6 text-white/78">
                  {rule}
                </p>
              ))}
            </div>
            <div className="mt-5 rounded-[8px] border border-white/10 bg-white/8 p-4">
              <p className="text-sm font-semibold text-white">Πρόσθετες επιλογές</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {addOns.map((item) => (
                  <span key={item} className="rounded-[8px] bg-white/10 px-3 py-1 text-xs font-semibold text-white/78">{item}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.name} className="partner-panel p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[hsl(var(--partner-navy-soft))]">{plan.name}</p>
                <h3 className="mt-3 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{plan.commercial}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.bestFor}</p>
                <ul className="mt-4 space-y-2">
                  {plan.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                      <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-[hsl(var(--partner-navy))]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="partner-panel p-7 lg:p-8">
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="partner-kicker">Ελεγχόμενο onboarding</p>
              <h2 className="mt-3 font-sans text-[30px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
                Καθαροί έλεγχοι, λιγότερη ασάφεια, ταχύτερη ετοιμότητα
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Η πύλη ελέγχου προστατεύει πελάτες, συνεργάτες και το σύστημα αξιολογήσεων. Κρατά επίσης τη δημόσια αγορά μακριά από τη λογική απλού καταλόγου.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {onboardingSteps.map((step, index) => (
                <div key={step.title} className="partner-soft-card p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-[hsl(var(--partner-navy))] text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PartnerShell>
  );
};

export default ForLawyersLanding;
