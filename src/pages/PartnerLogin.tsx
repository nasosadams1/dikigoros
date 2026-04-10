import { ArrowRight, LifeBuoy, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";

const accessSteps = [
  { label: "Έλεγχος στοιχείων", text: "Επαγγελματικό email και κωδικός" },
  { label: "Δεύτερη επιβεβαίωση", text: "6ψήφιος κωδικός επαλήθευσης" },
  { label: "Χώρος συνεργάτη", text: "Ραντεβού, προφίλ και ρυθμίσεις" },
];

const PartnerLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryHintVisible, setRecoveryHintVisible] = useState(false);

  const isValid = useMemo(() => email.trim().includes("@") && password.trim().length >= 8, [email, password]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isValid) return;

    navigate("/for-lawyers/verify", {
      state: {
        email: email.trim(),
        destination: "/for-lawyers/portal",
      },
    });
  };

  return (
    <PartnerShell>
      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="partner-dark-panel overflow-hidden p-7 sm:p-9">
          <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[hsl(var(--partner-gold))]">Είσοδος Συνεργάτη</p>
          <h1 className="mt-5 font-serif text-[2.8rem] leading-[1.02] tracking-[-0.03em] text-[hsl(var(--partner-ivory))]">
            Ασφαλής είσοδος για εγκεκριμένους συνεργάτες.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/72">
            Αποκλειστικά για δικηγόρους που έχουν ήδη εγκριθεί από το Dikigoros.
          </p>

          <div className="mt-8 partner-dark-card-featured p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Ροή πρόσβασης</p>
                <p className="mt-1 text-sm leading-6 text-white/58">Σύντομη, ασφαλής και ελεγχόμενη.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-[hsl(var(--partner-gold))]" />
            </div>

            <div className="mt-6 space-y-4">
              {accessSteps.map((step, index) => (
                <div key={step.label} className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/8 text-xs font-semibold text-[hsl(var(--partner-gold))]">
                    0{index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{step.label}</p>
                    <p className="mt-1 text-sm leading-6 text-white/58">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
            <div className="partner-dark-card p-5">
              <div className="flex items-start gap-3">
                <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--partner-gold))]" />
                <div>
                  <p className="text-sm font-semibold text-white">Υποστήριξη συνεργατών</p>
                  <p className="mt-1 text-sm leading-6 text-white/62">Ανάκτηση κωδικού, ερωτήσεις έγκρισης και βοήθεια πρόσβασης.</p>
                  <p className="mt-4 text-sm font-semibold text-[hsl(var(--partner-ivory))]">partners@dikigoros.eu</p>
                </div>
              </div>
            </div>
            <div className="partner-dark-card p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Χρόνος απόκρισης</p>
              <p className="mt-3 font-serif text-3xl tracking-[-0.03em] text-white">24h</p>
              <p className="mt-1 text-sm leading-6 text-white/58">Προτεραιότητα στην υποστήριξη συνεργατών.</p>
            </div>
          </div>
        </aside>

        <div className="partner-panel p-7 sm:p-10">
          <div className="max-w-xl">
            <p className="partner-kicker">Μόνο για Εγκεκριμένους Δικηγόρους</p>
            <h2 className="mt-4 font-serif text-[2.75rem] leading-[1.04] tracking-[-0.03em] text-[hsl(var(--partner-ink))]">
              Πρόσβαση στο portal συνεργατών
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Συνδεθείτε με το εγκεκριμένο επαγγελματικό email και επιβεβαιώστε την πρόσβαση.
            </p>
          </div>

          <form className="mt-9 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="partner-email" className="partner-label">
                  Επαγγελματικό email
                </label>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Εγκεκριμένο email</span>
              </div>
              <div className="relative rounded-[1.15rem] border border-[hsl(var(--partner-line))] bg-white/55 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                <Mail className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--partner-navy-soft))]" />
                <input
                  id="partner-email"
                  className="partner-input pl-11"
                  type="email"
                  placeholder="name@lawfirm.gr"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="partner-password" className="partner-label">
                  Κωδικός πρόσβασης
                </label>
                <button
                  type="button"
                  onClick={() => setRecoveryHintVisible((current) => !current)}
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--partner-navy-soft))] transition hover:text-[hsl(var(--partner-ink))]"
                >
                  Ξέχασα τον κωδικό
                </button>
              </div>
              <div className="relative rounded-[1.15rem] border border-[hsl(var(--partner-line))] bg-white/55 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                <LockKeyhole className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--partner-navy-soft))]" />
                <input
                  id="partner-password"
                  className="partner-input pl-11"
                  type="password"
                  placeholder="Ο κωδικός συνεργάτη σας"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">Χρησιμοποιήστε τον κωδικό του εγκεκριμένου λογαριασμού σας.</p>
            </div>

            {recoveryHintVisible && (
              <div className="partner-soft-card p-4 text-sm leading-6 text-muted-foreground">
                Η ανάκτηση κωδικού γίνεται μέσω υποστήριξης συνεργατών. Επικοινωνήστε με{" "}
                <a href="mailto:partners@dikigoros.eu" className="font-semibold text-[hsl(var(--partner-ink))] underline underline-offset-4">
                  partners@dikigoros.eu
                </a>{" "}
                για βοήθεια.
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={!isValid}
              className="h-12 w-full rounded-xl bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))] shadow-[0_16px_32px_rgba(18,30,44,0.16)] transition hover:-translate-y-[1px] hover:bg-[hsl(var(--partner-navy))]/92 disabled:shadow-none"
            >
              Ασφαλής Είσοδος
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </form>

          <div className="mt-7 rounded-[1.45rem] border border-[hsl(var(--partner-line))] bg-[linear-gradient(180deg,rgba(255,252,247,0.88),rgba(249,244,236,0.82))] px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Σημείωση ασφαλείας</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Είσοδος, επιβεβαίωση, πρόσβαση.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 rounded-[1.55rem] border border-[hsl(var(--partner-line))] bg-white/55 px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))]">
                <UserRoundCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Δεν έχετε εγκριθεί ακόμη;</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Υποβάλετε αίτηση για ένταξη στο δίκτυο συνεργατών.</p>
              </div>
            </div>
            <Button asChild variant="outline" className="rounded-xl border-[hsl(var(--partner-line))] bg-white/80 text-[hsl(var(--partner-ink))] transition hover:bg-white">
              <Link to="/for-lawyers/apply">
                Αίτηση Συνεργασίας
                <Sparkles className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </PartnerShell>
  );
};

export default PartnerLogin;
