import {
  ArrowRight,
  CheckCircle2,
  LifeBuoy,
  Mail,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";
import { getPartnerSession, requestPartnerAccessCode, verifyApprovedPartner } from "@/lib/platformRepository";
import { trackFunnelEvent } from "@/lib/funnelAnalytics";
import { cn } from "@/lib/utils";

const accessSteps = [
  "Επαγγελματικό ηλεκτρονικό ταχυδρομείο και 6ψήφιος κωδικός",
  "Έλεγχος ότι ο λογαριασμός έχει εγκριθεί",
  "Πρόσβαση στο περιβάλλον συνεργάτη",
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PartnerLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<{ email: boolean }>({
    email: false,
  });

  useEffect(() => {
    if (getPartnerSession()) {
      navigate("/for-lawyers/portal", { replace: true });
    }
  }, [navigate]);

  const emailError = useMemo(() => {
    if (!email.trim()) return "Συμπληρώστε το επαγγελματικό ηλεκτρονικό ταχυδρομείο του εγκεκριμένου λογαριασμού.";
    if (!emailPattern.test(email.trim())) return "Εισαγάγετε έγκυρη διεύθυνση ηλεκτρονικού ταχυδρομείου.";
    return "";
  }, [email]);

  const canSubmit = !emailError;

  const disabledReason = !email.trim()
    ? "Συμπληρώστε το ηλεκτρονικό ταχυδρομείο για να συνεχίσετε."
    : emailError;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError("");

    if (!canSubmit) {
      setTouched({ email: true });
      return;
    }

    setIsSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const approved = await verifyApprovedPartner(normalizedEmail);
      if (!approved) {
        setLoginError("Ο λογαριασμός δεν έχει ενεργό έλεγχο ένταξης συνεργάτη.");
        return;
      }
      trackFunnelEvent("lawyer_application_approved", {
        email: normalizedEmail,
      });

      const codeRequested = await requestPartnerAccessCode(normalizedEmail);
      if (!codeRequested) {
        setLoginError("Δεν ήταν δυνατή η αποστολή κωδικού επαλήθευσης για αυτόν τον λογαριασμό.");
        return;
      }

    navigate("/for-lawyers/verify", {
      state: {
          email: normalizedEmail,
        destination: "/for-lawyers/portal",
      },
    });
    } catch {
      setLoginError("Παρουσιάστηκε πρόβλημα κατά τον έλεγχο πρόσβασης. Προσπαθήστε ξανά.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const emailStateClass = touched.email
    ? emailError
      ? "border-destructive/55 bg-destructive/5"
      : "border-sage/45 bg-sage/5"
    : "border-[hsl(var(--partner-line))] bg-white";

  return (
    <PartnerShell>
      <section className="grid gap-5 lg:grid-cols-[minmax(320px,0.38fr)_minmax(0,0.62fr)]">
        <aside className="partner-dark-panel p-7 sm:p-[28px]">
          <div className="space-y-5">
            <div>
              <p className="partner-kicker text-[hsl(var(--partner-gold))]">Είσοδος συνεργάτη</p>
              <h1 className="mt-3 font-sans text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white">
                Είσοδος μόνο για ήδη εγκεκριμένους συνεργάτες.
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/72">
                Η πρόσβαση στον πίνακα συνεργάτη ενεργοποιείται μόνο για δικηγόρους των οποίων ο φάκελος έχει ήδη
                εγκριθεί από την ομάδα Dikigoros.
              </p>
            </div>

            <div className="partner-dark-card-featured p-4">
              <p className="text-[13px] font-semibold text-white">Βήματα πρόσβασης</p>
              <div className="mt-4 space-y-3.5">
                {accessSteps.map((step, index) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/14 text-[11px] font-semibold text-[hsl(var(--partner-gold))]">
                      0{index + 1}
                    </div>
                    <p className="text-sm leading-6 text-white/78">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid items-start gap-3 sm:grid-cols-2">
              <div className="partner-dark-card p-3.5">
                <div className="flex min-w-0 items-start gap-3">
                  <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--partner-gold))]" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white">Υποστήριξη πρόσβασης</p>
                    <p className="mt-1.5 break-words text-[13px] leading-5 text-white/70">partners@dikigoros.eu</p>
                  </div>
                </div>
              </div>

              <div className="partner-dark-card p-3.5">
                <p className="text-[13px] font-semibold text-white">Συνήθης χρόνος απάντησης</p>
                <p className="mt-1.5 text-[13px] leading-5 text-white/70">Συνήθως εντός 24 ωρών για ζητήματα πρόσβασης συνεργάτη.</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="partner-panel p-7 sm:p-[28px] lg:p-8">
          <div className="max-w-[720px]">
            <p className="partner-kicker">Πίνακας συνεργάτη</p>
            <h2 className="mt-3 font-serif text-[2.85rem] leading-[0.98] tracking-[-0.03em] text-[hsl(var(--partner-ink))]">
              Είσοδος στο περιβάλλον συνεργάτη
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Χρησιμοποιήστε το επαγγελματικό ηλεκτρονικό ταχυδρομείο που έχει δηλωθεί για τον λογαριασμό σας. Αν υπάρχει πρόβλημα
              πρόσβασης, η ομάδα συνεργατών εξετάζει το αίτημα κατά προτεραιότητα.
            </p>
          </div>

          <form className="mt-8 max-w-xl space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="partner-email" className="partner-label">
                  Επαγγελματικό ηλεκτρονικό ταχυδρομείο
                </label>
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Υποχρεωτικό</span>
              </div>
              <div className={cn("relative rounded-[14px] border px-1.5 py-1.5 transition", emailStateClass)}>
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--partner-navy-soft))]" />
                <input
                  id="partner-email"
                  type="email"
                  className="partner-input border-0 bg-transparent pl-10 shadow-none"
                  placeholder="name@lawfirm.gr"
                  value={email}
                  onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              {touched.email && emailError ? (
                <p className="text-xs font-medium text-destructive">{emailError}</p>
              ) : touched.email && !emailError ? (
                <p className="flex items-center gap-2 text-xs font-medium text-sage-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Η διεύθυνση ηλεκτρονικού ταχυδρομείου είναι έγκυρη.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Button
                type="submit"
                className={cn(
                  "h-[52px] w-full rounded-[14px] px-5 text-sm font-semibold transition",
                  canSubmit
                    ? "bg-[hsl(var(--partner-navy))] text-white shadow-[0_12px_26px_rgba(18,30,44,0.12)] hover:bg-[hsl(var(--partner-navy))]/94"
                    : "bg-[#A6ADB8] text-white hover:bg-[#A6ADB8]",
                )}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Γίνεται έλεγχος πρόσβασης..." : "Είσοδος στον πίνακα"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              {!canSubmit ? <p className="text-sm text-muted-foreground">{disabledReason}</p> : null}
              {loginError ? <p className="text-sm font-semibold text-destructive">{loginError}</p> : null}
            </div>

            <div className="partner-soft-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[hsl(var(--partner-navy))] text-white">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[hsl(var(--partner-ink))]">Χρήση επαγγελματικού ηλεκτρονικού ταχυδρομείου</p>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    Το ηλεκτρονικό ταχυδρομείο ελέγχεται απέναντι στον εγκεκριμένο λογαριασμό συνεργάτη πριν ζητηθεί ο 6ψήφιος κωδικός.
                  </p>
                </div>
              </div>
            </div>

            <div className="partner-soft-card p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[hsl(var(--partner-navy))] text-white">
                    <UserRoundCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-[hsl(var(--partner-ink))]">Δεν έχετε εγκριθεί ακόμη;</p>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      Υποβάλετε αίτηση ώστε να εξεταστούν τα στοιχεία, οι ειδικότητες και τα δικαιολογητικά σας πριν
                      από οποιαδήποτε ενεργοποίηση πρόσβασης.
                    </p>
                  </div>
                </div>

                <Button
                  asChild
                  variant="outline"
                  className="h-[48px] rounded-[14px] border-[hsl(var(--partner-line))] bg-white px-5 text-sm font-semibold text-[hsl(var(--partner-ink))] hover:bg-white"
                >
                  <Link to="/for-lawyers/apply">Αίτηση Συνεργασίας</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 border-t border-[hsl(var(--partner-line))] pt-5 text-[13px] text-muted-foreground md:grid-cols-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-[13px] w-[13px] shrink-0 text-[hsl(var(--partner-navy-soft))]" />
                <span>Μόνο για εγκεκριμένους συνεργάτες</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-[13px] w-[13px] shrink-0 text-[hsl(var(--partner-navy-soft))]" />
                <span>Το ηλεκτρονικό ταχυδρομείο χρησιμοποιείται μόνο για έλεγχο πρόσβασης</span>
              </div>
              <div className="flex items-start gap-2.5">
                <LifeBuoy className="mt-0.5 h-[13px] w-[13px] shrink-0 text-[hsl(var(--partner-navy-soft))]" />
                <span>Υποστήριξη για ζητήματα σύνδεσης</span>
              </div>
            </div>
          </form>
        </div>
      </section>
    </PartnerShell>
  );
};

export default PartnerLogin;
