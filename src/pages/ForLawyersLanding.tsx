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
  "Πλήρης έλεγχος σε διαθεσιμότητα και κρατήσεις",
  "Αξιολογήσεις μόνο μετά από ολοκληρωμένο ραντεβού",
];

const firmTools = [
  { icon: UsersRound, title: "Δημόσιο προφίλ", text: "Ειδικεύσεις, γλώσσες, τιμές και στοιχεία αξιοπιστίας σε καθαρή μορφή." },
  { icon: CalendarClock, title: "Διαθεσιμότητα", text: "Ώρες, ημέρες εργασίας, κενά ασφαλείας και τρόποι συμβουλευτικής." },
  { icon: FileSearch, title: "Κρατήσεις", text: "Πλαίσιο πελάτη, πληρωμή και κατάσταση ολοκλήρωσης σε ένα σημείο." },
  { icon: MessageSquareReply, title: "Αξιολογήσεις", text: "Δημοσιεύονται μετά από ολοκληρωμένο ραντεβού και μπορούν να απαντηθούν." },
  { icon: ShieldCheck, title: "Έλεγχος ένταξης", text: "Έλεγχος στοιχείων πριν από τη δημόσια εμφάνιση του προφίλ." },
  { icon: TrendingUp, title: "Πίνακας συνεργάτη", text: "Προφίλ, διαθεσιμότητα, κρατήσεις, πληρωμές και αναφορές." },
];

const proofModules = [
  {
    title: "Λιγότερες άσκοπες συνεννοήσεις",
    signal: "Ώρες, κενά ασφαλείας, τρόποι συμβουλευτικής",
    text: "Ο πελάτης βλέπει ώρες που μπορούν να κρατηθούν και το γραφείο ελέγχει ημέρες, κενά και αλλαγές.",
  },
  {
    title: "Καθαρή εικόνα κράτησης",
    signal: "Επιβεβαίωση, πληρωμή, ολοκλήρωση",
    text: "Κάθε ραντεβού έχει στοιχεία πελάτη, τρόπο επικοινωνίας, πληρωμή και στάδιο ολοκλήρωσης.",
  },
  {
    title: "Κριτικές με πραγματική βάση",
    signal: "Μόνο μετά από ολοκληρωμένο ραντεβού",
    text: "Οι αξιολογήσεις ανοίγουν μετά την ολοκλήρωση και μπορούν να απαντηθούν από το γραφείο.",
  },
];

const pricingRules = [
  "Στο Βασικό δεν υπάρχει πάγιο. Η χρέωση €7 εφαρμόζεται μόνο μετά από ολοκληρωμένη πρώτη συμβουλευτική.",
  "Ακύρωση, αποτυχία πληρωμής ή μη πραγματοποίηση ραντεβού δεν χρεώνονται ως ολοκληρωμένο πρώτο ραντεβού.",
  "Τα μεγαλύτερα πλάνα προσθέτουν προβολή, στατιστικά και εργαλεία διαχείρισης.",
];

const plans = [
  {
    name: "Βασικό",
    commercial: "€0 / μήνα + €7 ανά ολοκληρωμένη πρώτη συμβουλευτική",
    bestFor: "Για δικηγόρους που θέλουν να δοκιμάσουν την πλατφόρμα χωρίς σταθερό κόστος.",
    includes: ["Ελεγμένο δημόσιο προφίλ", "Κρατήσεις και πληρωμές πρώτης συμβουλευτικής", "Αξιολογήσεις μετά από ολοκληρωμένο ραντεβού"],
  },
  {
    name: "Επαγγελματικό",
    commercial: "€29 / μήνα ή €23 / μήνα ετησίως",
    bestFor: "Για γραφεία που θέλουν ενισχυμένη, καθαρά σημειωμένη προβολή και καλύτερη εικόνα απόδοσης.",
    includes: ["Όλα του Βασικού", "Σήμανση ενισχυμένης προβολής", "Στατιστικά προφίλ και κρατήσεων"],
  },
  {
    name: "Πλήρες",
    commercial: "€99.99 / μήνα ή €83.99 / μήνα ετησίως",
    bestFor: "Για γραφεία που χρειάζονται οργανωμένη ροή υποθέσεων, υπενθυμίσεις, έγγραφα και πιο αναλυτική παρακολούθηση.",
    includes: ["Όλα του Επαγγελματικού", "Ροή υποθέσεων και υπενθυμίσεις", "Αιτήματα εγγράφων και αναλυτικά"],
  },
  {
    name: "Γραφεία / Ομάδες",
    commercial: "Από €127.99 / μήνα",
    bestFor: "Για ομάδες έως 3 δικηγόρων, με επιπλέον θέσεις +€25 / μήνα ανά δικηγόρο.",
    includes: ["Έως 3 δικηγόροι", "Ροή υποθέσεων και αναλυτικά", "Προσαρμοσμένη εγκατάσταση"],
  },
];

const addOns = ["Ελεγμένη καταχώριση", "Ενισχυμένη προβολή", "Στατιστικά απόδοσης", "Ροή υποθέσεων"];

const onboardingSteps = [
  {
    title: "Αίτηση",
    text: "Στοιχεία επικοινωνίας, δραστηριότητα, σύλλογος, αριθμός μητρώου και έγγραφα ελέγχου.",
  },
  {
    title: "Έλεγχοι φακέλου",
    text: "Ελέγχουμε στοιχεία και βασική ετοιμότητα πριν από τη δημόσια προβολή.",
  },
  {
    title: "Ετοιμότητα προφίλ",
    text: "Ορίζετε ειδικεύσεις, τρόπους συμβουλευτικής, τιμές και διαθεσιμότητα.",
  },
  {
    title: "Ελεγχόμενη δημοσίευση προφίλ",
    text: "Μετά την έγκριση, διαχειρίζεστε κρατήσεις και δημόσια στοιχεία από τον πίνακα.",
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
              Όχι απλή καταχώριση προφίλ. Πιο καθαρή προετοιμασία, κράτηση και αξιολόγηση.
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {proofModules.map((module) => (
              <article key={module.title} className="partner-soft-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--partner-navy-soft))]">{module.signal}</p>
                <h3 className="mt-3 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(22rem,0.86fr)_minmax(0,1.14fr)] xl:items-start">
          <div className="partner-dark-panel p-6 lg:p-7">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/58">Εμπορικό μοντέλο</p>
            <h2 className="mt-3 max-w-2xl font-sans text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white lg:text-[30px]">
              Ξεκάθαρη χρέωση και πλάνα ανάλογα με το μέγεθος του γραφείου.
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Η βασική χρέωση εφαρμόζεται μόνο όταν έχει πραγματοποιηθεί και ολοκληρωθεί το πρώτο ραντεβού.
            </p>
            <div className="mt-5 grid gap-2">
              {pricingRules.map((rule) => (
                <p key={rule} className="rounded-[8px] border border-white/10 bg-white/8 px-3 py-2 text-sm font-semibold leading-6 text-white/78">
                  {rule}
                </p>
              ))}
            </div>
            <Button asChild className="mt-5 h-[46px] rounded-[8px] bg-white px-4 text-sm font-semibold text-[hsl(var(--partner-ink))] hover:bg-white/92">
              <Link to="/for-lawyers/plans">
                Δείτε πλάνα και χρεώσεις
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <div className="mt-5 rounded-[8px] border border-white/10 bg-white/8 p-4">
              <p className="text-sm font-semibold text-white">Πρόσθετες επιλογές</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {addOns.map((item) => (
                  <span key={item} className="rounded-[8px] bg-white/10 px-3 py-1 text-xs font-semibold text-white/78">{item}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {plans.map((plan) => (
              <article key={plan.name} className="partner-panel flex min-h-[20rem] flex-col p-5 lg:p-6">
                <p className="text-[12px] font-semibold uppercase leading-5 tracking-[0.18em] text-[hsl(var(--partner-navy-soft))]">{plan.name}</p>
                <h3 className="mt-3 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{plan.commercial}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{plan.bestFor}</p>
                <ul className="mt-5 space-y-2.5">
                  {plan.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[hsl(var(--partner-navy))]" />
                      <span>{item}</span>
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
