import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileSearch,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";

const routeCards = [
  {
    title: "Είσοδος Συνεργάτη",
    subtitle: "Για δικηγόρους που έχουν ήδη εγκριθεί στο δίκτυο.",
    bullets: [
      "Προφίλ και παρουσία",
      "Διαθεσιμότητα και ραντεβού",
      "Βασικές ρυθμίσεις λογαριασμού",
    ],
    detail: "Χρήση μόνο από ήδη ενεργούς συνεργάτες του Dikigoros.",
    trust: "Η πρόσβαση δίνεται μόνο σε λογαριασμούς με ολοκληρωμένο έλεγχο ένταξης.",
    cta: "Είσοδος στον πίνακα συνεργάτη",
    to: "/for-lawyers/login",
    tone: "dark",
  },
  {
    title: "Αίτηση Συνεργασίας",
    subtitle: "Για δικηγόρους που θέλουν να ενταχθούν στο δίκτυο.",
    bullets: [
      "Στοιχεία επικοινωνίας",
      "Σύλλογος και αριθμός μητρώου",
      "Ενεργές ειδικότητες",
      "Έγγραφα επαλήθευσης",
    ],
    detail: "Η πρόσβαση δεν ενεργοποιείται πριν ολοκληρωθεί ο έλεγχος.",
    trust: "Θα λάβετε ενημέρωση με ηλεκτρονικό ταχυδρομείο για το αποτέλεσμα ή για τυχόν ανάγκη συμπληρωματικών στοιχείων.",
    cta: "Έναρξη αίτησης",
    to: "/for-lawyers/apply",
    tone: "light",
  },
] as const;

const processPoints = [
  {
    title: "Έλεγχος πριν από την ενεργοποίηση",
    text: "Η πρόσβαση δίνεται μόνο αφού επιβεβαιωθούν στοιχεία ταυτότητας, άδειας και βασικά δικαιολογητικά.",
  },
  {
    title: "Ελεγχόμενο επαγγελματικό προφίλ",
    text: "Ειδικότητες, βασικά στοιχεία και παρουσία δεν ενεργοποιούνται πριν ολοκληρωθεί ο έλεγχος.",
  },
  {
    title: "Λειτουργία μετά την έγκριση",
    text: "Ο πίνακας συνεργάτη χρησιμοποιείται για διαθεσιμότητα, ραντεβού, βασικές ρυθμίσεις και διαχείριση παρουσίας.",
  },
];

const benefits = [
  {
    icon: UsersRound,
    title: "Καλύτερη αντιστοίχιση",
    description: "Τα αιτήματα φτάνουν με καθαρότερο πλαίσιο και λιγότερη ασάφεια.",
  },
  {
    icon: FileSearch,
    title: "Ελεγχόμενο επαγγελματικό προφίλ",
    description: "Τα στοιχεία που εμφανίζονται στο δίκτυο έχουν προηγουμένως ελεγχθεί.",
  },
  {
    icon: CalendarClock,
    title: "Πιο σταθερή λειτουργία",
    description: "Ο πίνακας συνεργάτη υποστηρίζει την καθημερινή διαχείριση παρουσίας, ραντεβού και διαθεσιμότητας.",
  },
];

const faqs = [
  {
    title: "Τι ελέγχεται;",
    text: "Ταυτότητα, άδεια, σύλλογος, αριθμός μητρώου, ειδικότητες και δικαιολογητικά.",
  },
  {
    title: "Πότε λαμβάνω απάντηση;",
    text: "Συνήθως σε 2–3 εργάσιμες ημέρες, εφόσον ο φάκελος είναι πλήρης.",
  },
  {
    title: "Πώς χρησιμοποιούνται τα έγγραφα;",
    text: "Μόνο για τον έλεγχο ένταξης στο δίκτυο Dikigoros.",
  },
];

const ForLawyersLanding = () => {
  return (
    <PartnerShell>
      <div className="space-y-5">
        <section className="partner-panel p-7 lg:p-8">
          <div className="grid gap-5 lg:grid-cols-[1.24fr_0.76fr] lg:items-start">
            <div className="max-w-[760px]">
              <p className="partner-kicker">Για δικηγόρους</p>
              <h1 className="mt-4 max-w-[760px] font-serif text-[2.85rem] leading-[1.01] tracking-[-0.035em] text-[hsl(var(--partner-ink))] sm:text-[3.2rem] lg:text-[3.45rem]">
                <span className="block">Ελεγχόμενη ένταξη.</span>
                <span className="block">Σαφές πλαίσιο συνεργασίας.</span>
              </h1>
              <p className="mt-4 max-w-[64ch] text-[15px] leading-6 text-muted-foreground">
                Χώρος πρόσβασης για δικηγόρους που αξιολογούνται πριν ενεργοποιηθούν, εμφανίζονται με ελεγχόμενα στοιχεία και διαχειρίζονται τη συνεργασία τους μέσα από τον πίνακα συνεργάτη του Dikigoros.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  className="h-[50px] rounded-[14px] bg-[hsl(var(--partner-navy))] px-5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(18,30,44,0.12)] hover:bg-[hsl(var(--partner-navy))]/94"
                >
                  <Link to="/for-lawyers/login">
                    Είσοδος Συνεργάτη
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-[50px] rounded-[14px] border-[hsl(var(--partner-line))] bg-white px-5 text-sm font-semibold text-[hsl(var(--partner-ink))] hover:bg-white"
                >
                  <Link to="/for-lawyers/apply">Αίτηση Συνεργασίας</Link>
                </Button>
              </div>
            </div>

            <aside className="partner-soft-card-strong p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[hsl(var(--partner-navy))] text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold leading-6 text-[hsl(var(--partner-ink))]">
                    Τρία σαφή σημεία που ορίζουν την πρόσβαση, την παρουσία και τη λειτουργία του πίνακα συνεργάτη.
                  </p>
                </div>
              </div>

              <div className="mt-5 divide-y divide-black/6">
                {processPoints.map((item) => (
                  <div key={item.title} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-[15px] font-semibold text-[hsl(var(--partner-ink))]">{item.title}</p>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section id="workflow" className="grid gap-5 lg:grid-cols-2">
          {routeCards.map((card) => (
            <article
              key={card.title}
              className={card.tone === "dark" ? "partner-dark-panel p-5" : "partner-panel p-5"}
            >
              <div className="space-y-4">
                <div>
                  <p className={card.tone === "dark" ? "text-[13px] font-medium text-white/72" : "text-[13px] font-medium text-muted-foreground"}>
                    {card.subtitle}
                  </p>
                  <h2
                    className={
                      card.tone === "dark"
                        ? "mt-2 font-sans text-[31px] font-semibold leading-tight tracking-[-0.02em] text-white"
                        : "mt-2 font-sans text-[31px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]"
                    }
                  >
                    {card.title}
                  </h2>
                </div>

                <ul className="space-y-2.5">
                  {card.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <CheckCircle2
                        className={card.tone === "dark" ? "mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--partner-gold))]" : "mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--partner-navy))]"}
                      />
                      <span className={card.tone === "dark" ? "text-sm leading-6 text-white/78" : "text-sm leading-6 text-muted-foreground"}>
                        {bullet}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className={card.tone === "dark" ? "text-[13px] leading-6 text-white/58" : "text-[13px] leading-6 text-[hsl(var(--partner-navy-soft))]"}>
                  {card.detail}
                </p>

                <Button
                  asChild
                  className={
                    card.tone === "dark"
                      ? "h-[48px] w-fit rounded-[14px] bg-white px-5 text-sm font-semibold text-[hsl(var(--partner-navy))] hover:bg-white/92"
                      : "h-[48px] w-fit rounded-[14px] bg-[hsl(var(--partner-navy))] px-5 text-sm font-semibold text-white hover:bg-[hsl(var(--partner-navy))]/94"
                  }
                >
                  <Link to={card.to}>
                    {card.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <p
                  className={
                    card.tone === "dark"
                      ? "border-t border-white/10 pt-4 text-sm leading-6 text-white/64"
                      : "border-t border-[hsl(var(--partner-line))] pt-4 text-sm leading-6 text-muted-foreground"
                  }
                >
                  {card.trust}
                </p>
              </div>
            </article>
          ))}
        </section>

        <section className="partner-panel p-7 lg:p-8">
          <div className="max-w-[700px]">
            <p className="partner-kicker">Γιατί υπάρχει έλεγχος</p>
            <h2 className="mt-3 font-sans text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
              Λιγότερη ασάφεια. Καθαρότερη παρουσία. Σταθερότερη λειτουργία.
            </h2>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, description }) => (
              <div key={title} className="partner-soft-card p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[hsl(var(--partner-navy))] text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-sans text-[21px] font-semibold leading-snug tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="partner-panel p-7 lg:p-8">
          <div className="grid gap-5 lg:grid-cols-3">
            {faqs.map((item) => (
              <div key={item.title} className="partner-soft-card p-5">
                <p className="text-[18px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{item.title}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PartnerShell>
  );
};

export default ForLawyersLanding;
