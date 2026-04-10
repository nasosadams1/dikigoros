import { ArrowRight, CalendarClock, FileSearch, ShieldCheck, Star, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";

const whyPartnersJoin = [
  {
    icon: UsersRound,
    title: "Πιο ποιοτικά αιτήματα",
    description: "Λαμβάνετε πιο ξεκάθαρα νομικά αιτήματα με καλύτερο πλαίσιο και πρόθεση.",
  },
  {
    icon: FileSearch,
    title: "Έλεγχος προφίλ",
    description: "Παρουσιάζετε ειδικότητες και διαπιστεύσεις με περισσότερο έλεγχο.",
  },
  {
    icon: CalendarClock,
    title: "Διαχείριση ραντεβού",
    description: "Ορίζετε διαθεσιμότητα και διαμορφώνετε την εμπειρία κράτησης.",
  },
];

const entryCards = [
  {
    title: "Είσοδος Συνεργάτη",
    eyebrow: "Για εγκεκριμένους δικηγόρους",
    description: "Πρόσβαση σε ραντεβού, διαθεσιμότητα, προφίλ και ρυθμίσεις.",
    detail: "Είσοδος με επαγγελματικό email και δεύτερο βήμα επιβεβαίωσης.",
    cta: "Είσοδος στο Portal",
    to: "/for-lawyers/login",
    tone: "dark",
  },
  {
    title: "Αίτηση Συνεργασίας",
    eyebrow: "Για νέους συνεργάτες",
    description: "Υποβάλετε στοιχεία άδειας, ειδικότητες και έγγραφα επαλήθευσης.",
    detail: "Δομημένη αίτηση ειδικά για δικηγόρους.",
    cta: "Έναρξη Αίτησης",
    to: "/for-lawyers/apply",
    tone: "light",
  },
] as const;

const ForLawyersLanding = () => {
  return (
    <PartnerShell>
      <section className="partner-panel overflow-hidden p-7 sm:p-10 lg:p-12">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="partner-kicker">Για Δικηγόρους</p>
            <h1 className="mt-5 font-serif text-[2.9rem] leading-[1.01] tracking-[-0.035em] text-[hsl(var(--partner-ink))] sm:text-[4.2rem]">
              Ένας πιο ήρεμος, πιο σοβαρός τρόπος να συναντάτε νομικούς πελάτες.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              Αφιερωμένη είσοδος συνεργατών για εγκεκριμένους δικηγόρους.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-[hsl(var(--partner-navy))] px-6 text-[hsl(var(--partner-ivory))] shadow-[0_14px_30px_rgba(18,30,44,0.16)] transition hover:-translate-y-[1px] hover:bg-[hsl(var(--partner-navy))]/92"
              >
                <Link to="/for-lawyers/login">
                  Είσοδος Συνεργάτη
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-xl border-[hsl(var(--partner-line))] bg-white/70 px-6 text-[hsl(var(--partner-ink))] transition hover:-translate-y-[1px] hover:bg-white"
              >
                <Link to="/for-lawyers/apply">Αίτηση Συνεργασίας</Link>
              </Button>
            </div>
          </div>

          <aside className="partner-soft-card-strong p-6 sm:p-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[hsl(var(--partner-navy-soft))]">Πρότυπο επαγγελματικής ένταξης</p>
            <div className="mt-5 space-y-4">
              <div className="border-b border-black/6 pb-4">
                <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Έλεγχος εισόδου</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Στοιχεία και έγγραφα ελέγχονται πριν δοθεί πρόσβαση.</p>
              </div>
              <div className="border-b border-black/6 pb-4">
                <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Ποιότητα προφίλ</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Επιμελημένη παρουσίαση σε ένα πιο προσεκτικά επιλεγμένο περιβάλλον.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Έλεγχος χώρου εργασίας</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Διαχείριση διαθεσιμότητας, ραντεβού, κριτικών και ρυθμίσεων.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        {entryCards.map((card) => (
          <div key={card.title} className={card.tone === "dark" ? "partner-dark-panel p-7 sm:p-9" : "partner-soft-card-strong p-7 sm:p-9"}>
            <div className="flex items-start justify-between gap-6">
              <div>
                <p
                  className={
                    card.tone === "dark"
                      ? "text-[11px] font-bold uppercase tracking-[0.24em] text-[hsl(var(--partner-gold))]"
                      : "partner-kicker"
                  }
                >
                  {card.eyebrow}
                </p>
                <h2
                  className={
                    card.tone === "dark"
                      ? "mt-4 font-serif text-[2.45rem] leading-[1.02] tracking-[-0.03em] text-[hsl(var(--partner-ivory))]"
                      : "mt-4 font-serif text-[2.45rem] leading-[1.02] tracking-[-0.03em] text-[hsl(var(--partner-ink))]"
                  }
                >
                  {card.title}
                </h2>
              </div>
              <div
                className={
                  card.tone === "dark"
                    ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[hsl(var(--partner-gold))]"
                    : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))]"
                }
              >
                {card.tone === "dark" ? <ShieldCheck className="h-5 w-5" /> : <Star className="h-5 w-5" />}
              </div>
            </div>

            <div className={card.tone === "dark" ? "mt-8 border-t border-white/10 pt-6" : "mt-8 border-t border-black/6 pt-6"}>
              <p className={card.tone === "dark" ? "text-base leading-8 text-white/76" : "text-base leading-8 text-muted-foreground"}>{card.description}</p>
              <p className={card.tone === "dark" ? "mt-5 text-sm leading-7 text-white/58" : "mt-5 text-sm leading-7 text-muted-foreground"}>{card.detail}</p>
            </div>

            <div
              className={
                card.tone === "dark"
                  ? "mt-8 rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-4"
                  : "mt-8 rounded-[1.35rem] border border-black/6 bg-white/70 px-4 py-4"
              }
            >
              <p className={card.tone === "dark" ? "text-xs font-semibold uppercase tracking-[0.18em] text-white/52" : "text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"}>
                Σημείωση πρόσβασης
              </p>
              <p className={card.tone === "dark" ? "mt-2 text-sm leading-6 text-white/74" : "mt-2 text-sm leading-6 text-muted-foreground"}>
                {card.tone === "dark"
                  ? "Αφορά μόνο δικηγόρους που έχουν ήδη εγκριθεί στο δίκτυο συνεργατών του Dikigoros."
                  : "Οι αιτήσεις εξετάζονται πριν δοθεί πρόσβαση στο portal συνεργατών."}
              </p>
            </div>

            <Button
              asChild
              size="lg"
              className={
                card.tone === "dark"
                  ? "mt-8 h-12 rounded-xl bg-[hsl(var(--partner-ivory))] px-6 text-[hsl(var(--partner-navy))] shadow-[0_14px_28px_rgba(0,0,0,0.18)] transition hover:-translate-y-[1px] hover:bg-[hsl(var(--partner-ivory))]/92"
                  : "mt-8 h-12 rounded-xl bg-[hsl(var(--partner-navy))] px-6 text-[hsl(var(--partner-ivory))] shadow-[0_14px_28px_rgba(18,30,44,0.14)] transition hover:-translate-y-[1px] hover:bg-[hsl(var(--partner-navy))]/92"
              }
            >
              <Link to={card.to}>
                {card.cta}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ))}
      </section>

      <section className="mt-8 partner-panel p-7 sm:p-9">
        <div className="max-w-2xl">
          <p className="partner-kicker">Γιατί Συμμετέχουν</p>
          <h2 className="mt-4 font-serif text-[2.55rem] leading-[1.05] tracking-[-0.03em] text-[hsl(var(--partner-ink))]">
            Καλύτερα αιτήματα, ισχυρότερη παρουσία, περισσότερος έλεγχος.
          </h2>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {whyPartnersJoin.map(({ icon: Icon, title, description }) => (
            <div key={title} className="partner-soft-card p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))]">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Αξία Συνεργάτη</span>
              </div>
              <h3 className="mt-5 font-serif text-[1.8rem] leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </PartnerShell>
  );
};

export default ForLawyersLanding;
