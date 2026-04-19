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
  "Πιο κατάλληλα πρώτα ραντεβού",
  "Πλήρης έλεγχος στη διαθεσιμότητα και στα ραντεβού",
  "Πιο σαφή δημόσια στοιχεία αξιοπιστίας",
  "Αξιολογήσεις μόνο μετά από ολοκληρωμένο ραντεβού",
];

const firmTools = [
  { icon: UsersRound, title: "Δημόσιο προφίλ", text: "Ειδικεύσεις, γλώσσες, τιμές, έλεγχοι εμπιστοσύνης και χρήσιμες πληροφορίες για το πρώτο ραντεβού." },
  { icon: CalendarClock, title: "Έλεγχος διαθεσιμότητας", text: "Διαθέσιμες ώρες για ραντεβού, ημέρες εργασίας, κενά ασφαλείας και τρόποι συμβουλευτικής." },
  { icon: FileSearch, title: "Διαχείριση κρατήσεων", text: "Επιβεβαιωμένα ραντεβού, πλαίσιο πελάτη, κατάσταση ολοκλήρωσης και κατάσταση πληρωμής." },
  { icon: MessageSquareReply, title: "Αξιολογήσεις που δημοσιεύονται μόνο μετά από ολοκληρωμένο ραντεβού, δυνατότητα απάντησης και σαφής σύνδεση με πραγματικές κρατήσεις." },
  { icon: ShieldCheck, title: "Έλεγχος ένταξης", text: "Έλεγχος στοιχείων και ετοιμότητας πριν από τη δημόσια εμφάνιση του προφίλ σας στην πλατφόρμα." },
  { icon: TrendingUp, title: "Περιβάλλον συνεργάτη", text: "Ένας χώρος για προφίλ, διαθεσιμότητα, κρατήσεις, έγγραφα, πληρωμές και αξιολογήσεις." },
];

const proofModules = [
  {
    title: "Διαθεσιμότητα που μειώνει τις άσκοπες συνεννοήσεις",
    signal: "Ώρες, κενά ασφαλείας, τρόποι συμβουλευτικής",
    text: "Ο πελάτης βλέπει μόνο ώρες που μπορούν να κρατηθούν και το γραφείο κρατά έλεγχο στις ημέρες εργασίας, στα κενά και στις αλλαγές.",
  },
  {
    title: "Κρατήσεις με ξεκάθαρη εικόνα",
    signal: "Επιβεβαίωση, πληρωμή, ολοκλήρωση",
    text: "Κάθε ραντεβού έχει κωδικό, στοιχεία πελάτη, τρόπο επικοινωνίας, κατάσταση πληρωμής και στάδιο ολοκλήρωσης.",
  },
  {
    title: "Κριτικές που χτίζουν εμπιστοσύνη",
    signal: "Μόνο μετά από ολοκληρωμένο ραντεβού",
    text: "Οι δημόσιες αξιολογήσεις ανοίγουν μετά την ολοκλήρωση του ραντεβού, μπορούν να απαντηθούν και, όταν χρειάζεται, ελέγχονται χωρίς να εκτίθενται ιδιωτικά στοιχεία της υπόθεσης.",
  },
  {
    title: "Στατιστικά συνεργασίας",
    signal: "Ζήτηση, κρατήσεις, πρώτες συμβουλευτικές",
    text: "Το γραφείο βλέπει από πού έρχονται τα πιο ποιοτικά αιτήματα.",
  },
];

const pricingRules = [
  "Η βασική χρέωση εφαρμόζεται όταν η πρώτη συμβουλευτική ολοκληρωθεί και το ραντεβού έχει επιβεβαιωθεί.",
  "Ακύρωση, αποτυχία πληρωμής ή μη πραγματοποίηση ραντεβού δεν θεωρούνται ολοκληρωμένο πρώτο ραντεβού.",
  "Τα πακέτα Ανάπτυξη και Ομάδα εξυπηρετούν γραφεία με μεγαλύτερο όγκο, περισσότερες θέσεις ή ανάγκη για πιο οργανωμένη αναφορά.",
];

const commercialProof = [
  {
    title: "Πότε θεωρείται ολοκληρωμένο ένα πρώτο ραντεβού",
    text: "Ραντεβού με επιβεβαιωμένη ώρα, ολοκληρωμένη πληρωμή ή επιβεβαιωμένη κατάσταση πληρωμής, και σήμανση ολοκλήρωσης από τον δικηγόρο μετά τη συμβουλευτική.",
  },
  {
    title: "Τι δεν μετρά",
    text: "Ακύρωση, αποτυχία πληρωμής ή ραντεβού που δεν πραγματοποιήθηκε δεν θεωρούνται ολοκληρωμένη πρώτη συμβουλευτική.",
  },
  {
    title: "Τι ελέγχει ο δικηγόρος",
    text: "Δημόσιες ειδικεύσεις, τρόπους συμβουλευτικής, τιμές, διαθέσιμες ώρες, κενά ασφαλείας, απαντήσεις σε κριτικές και βασικά στοιχεία προετοιμασίας του πελάτη",
  },
  {
    title: "Τι δείχνει η αναφορά",
    text: "Αιτήματα ανά ειδίκευση, κρατήσεις, πληρωμένες πρώτες συμβουλευτικές, ολοκληρωμένες συνεδρίες, κριτικές, ακυρώσεις και σημεία όπου χάνεται ενδιαφέρον.",
  },
];

const plans = [
  {
    name: "Ατομικό",
    commercial: "Χρέωση ανά ολοκληρωμένο πρώτο ραντεβού",
    bestFor: "Ανεξάρτητοι δικηγόροι που θέλουν προβλέψιμη ροή ραντεβού.",
    includes: ["Δημόσιο προφίλ", "Διαχείριση διαθεσιμότητας", "Διαχείριση κρατήσεων", "Σύστημα αξιολογήσεων"],
  },
  {
    name: "Ανάπτυξη",
    commercial: "Χαμηλότερη προμήθεια με μηνιαίο ελάχιστο",
    bestFor: "Γραφεία με ζήτηση που θέλουν μεγαλύτερη ανακάλυψη και ισχυρότερη απόδειξη εμπιστοσύνης.",
    includes: ["Όλα του Ατομικού", "Προτεραιότητα στον έλεγχο και στην ένταξη σε κατηγορίες", "Υποστήριξη βελτίωσης προφίλ", "Επιπλέον πεδία συλλογής στοιχείων πελάτη πριν το ραντεβού"],
  },
  {
    name: "Ομάδα",
    commercial: "Συμφωνία γραφείου",
    bestFor: "Για γραφεία με περισσότερους δικηγόρους, πολλαπλές θέσεις συνεργατών ή ανάγκη για οργανωμένη συλλογή στοιχείων πριν το ραντεβού.",
    includes: ["Όλα της Ανάπτυξης", "Επιπλέον θέσεις", "Ομαδική ένταξη", "Εμπορικά στατιστικά"],
  },
];

const addOns = ["Προνομιακή προβολή", "Εργαλεία επώνυμης συλλογής βασικών στοιχείων πελάτη και προφίλ", "Εργαλεία πληρωμών", "Υποστήριξη ένταξης"];

const onboardingSteps = [
  {
    title: "Αίτηση",
    text: "Εκτιμώμενος χρόνος: 8–12 λεπτά. Ζητάμε στοιχεία επικοινωνίας, επαγγελματικής δραστηριότητας, δικηγορικού συλλόγου, αριθμό μητρώου, ειδικεύσεις και έγγραφα ελέγχου.",
  },
  {
    title: "Έλεγχοι φακέλου",
    text: "Η ταυτότητα, η άδεια, τα επαγγελματικά στοιχεία, ο δικηγορικός σύλλογος και η βασική ετοιμότητα του προφίλ ελέγχονται πριν από τη δημόσια προβολή.",
  },
  {
    title: "Ετοιμότητα προφίλ",
    text: "Το δημόσιο προφίλ χρειάζεται σαφείς ειδικεύσεις, τρόπους συμβουλευτικής, τιμές, διαθεσιμότητα και οδηγίες προετοιμασίας.",
  },
  {
    title: "Ελεγχόμενη δημοσίευση προφίλ",
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
                Πιο ποιοτικά πρώτα ραντεβού, με λιγότερη άσκοπη επικοινωνία.
              </h1>
              <p className="mt-4 max-w-[64ch] text-[15px] leading-6 text-muted-foreground">
                Το Dikigoros βοηθά τους πελάτες να επιλέγουν με μεγαλύτερη σιγουριά, μέσα από σαφή προφίλ, πραγματική διαθεσιμότητα και αξιολογήσεις μετά από ολοκληρωμένα ραντεβού.
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
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--partner-navy-soft))]">Τι κερδίζεται</p>
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
            <p className="partner-kicker">Τι περιλαμβάνει η συνεργασία</p>
            <h2 className="mt-3 font-sans text-[30px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
              Εργαλεία προβολής, διαθεσιμότητας και κρατήσεων που βοηθούν τον πελάτη να σας επιλέξει πιο εύκολα.
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
            <p className="partner-kicker">Πώς λειτουργεί στην πράξη</p>
            <h2 className="mt-3 font-sans text-[30px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
             Όχι απλή καταχώριση προφίλ. Καλύτερη προετοιμασία πριν το ραντεβού, λιγότερα άσχετα αιτήματα και πιο οργανωμένη πρώτη συμβουλευτική.
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
            <p className="partner-kicker">Πώς λειτουργεί η χρέωση</p>
            <h2 className="mt-3 font-sans text-[30px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
              Ξέρετε ακριβώς πότε χρεώνεστε, τι ελέγχετε και τι περιλαμβάνει η συνεργασία.
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
              Χρέωση ανά ολοκληρωμένο πρώτο ραντεβού, με επιπλέον επιλογές για γραφεία που χρειάζονται μεγαλύτερη υποστήριξη.
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Η βασική χρέωση εφαρμόζεται μόνο όταν έχει πραγματοποιηθεί το πρώτο ραντεβού με επιβεβαιωμένη κατάσταση.
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
              <p className="partner-kicker">Ελεγχόμενη ένταξη</p>
              <h2 className="mt-3 font-sans text-[30px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
                Η διαδικασία ελέγχου προστατεύει πελάτες, συνεργάτες και το σύστημα αξιολογήσεων.
              </h2>
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
