import { ArrowLeft, ArrowRight, MailCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { getPartnerSession, requestPartnerAccessCode, verifyPartnerAccessCode } from "@/lib/platformRepository";

interface VerificationState {
  email?: string;
  destination?: string;
}

const PartnerVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state || {}) as VerificationState;
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const email = routeState.email || "partner@lawfirm.gr";
  const destination = routeState.destination || "/for-lawyers/portal";
  const isReady = useMemo(() => code.length === 6, [code]);

  useEffect(() => {
    if (getPartnerSession()) {
      navigate(destination, { replace: true });
    }
  }, [destination, navigate]);

  return (
    <PartnerShell className="flex min-h-[calc(100vh-120px)] items-center">
      <section className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="partner-dark-panel p-7 sm:p-9">
          <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[hsl(var(--partner-gold))]">Επαλήθευση 2 Βημάτων</p>
          <h1 className="mt-5 font-serif text-[2.55rem] leading-[1.04] tracking-[-0.03em] text-[hsl(var(--partner-ivory))]">
            Επιβεβαιώστε την ασφαλή πρόσβαση.
          </h1>
          <p className="mt-5 text-sm leading-7 text-white/72">Στείλαμε έναν μοναδικό κωδικό στο εγκεκριμένο ηλεκτρονικό ταχυδρομείο σας.</p>

          <div className="mt-8 space-y-3">
            <div className="partner-stat-card">
              <p className="text-sm font-semibold text-white">Επιβεβαιωμένος προορισμός</p>
              <p className="mt-2 text-sm leading-6 text-white/68">{email}</p>
            </div>
            <div className="partner-stat-card">
              <p className="text-sm font-semibold text-white">Πρότυπο ασφαλείας</p>
              <p className="mt-2 text-sm leading-6 text-white/68">Κωδικός και έλεγχος στοιχείων.</p>
            </div>
          </div>
        </aside>

        <div className="partner-panel px-6 py-8 sm:px-9 sm:py-10">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.45rem] bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))] shadow-lg shadow-[rgba(14,25,39,0.14)]">
              <MailCheck className="h-7 w-7" />
            </div>
            <p className="partner-kicker mt-6">Εισαγωγή Κωδικού</p>
            <h2 className="mt-3 font-serif text-4xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Εισαγάγετε τον 6ψήφιο κωδικό</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Ο κωδικός στάλθηκε στο <span className="font-semibold text-[hsl(var(--partner-ink))]">{email}</span>.
            </p>

            <div className="mt-8 rounded-[1.75rem] border border-[hsl(var(--partner-line))] bg-white/65 px-5 py-6">
              <InputOTP maxLength={6} value={code} onChange={setCode} containerClassName="justify-center gap-3">
                <InputOTPGroup className="gap-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="h-14 w-12 rounded-2xl border border-[hsl(var(--partner-line))] bg-[rgba(255,251,245,0.9)] text-lg font-semibold text-[hsl(var(--partner-ink))] first:rounded-2xl first:border last:rounded-2xl"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {isReady ? "Ο κωδικός συμπληρώθηκε" : "Αναμονή κωδικού"}
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-[hsl(var(--partner-line))] bg-white/60 p-4 text-left">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--partner-navy))]" />
                <p className="text-sm leading-6 text-muted-foreground">Χρησιμοποιήστε μόνο τον πιο πρόσφατο κωδικό.</p>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild variant="outline" className="h-12 rounded-xl border-[hsl(var(--partner-line))] bg-white/60 px-5 text-[hsl(var(--partner-ink))] hover:bg-white">
                <Link to="/for-lawyers/login">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Επιστροφή
                </Link>
              </Button>
              <Button
                size="lg"
                className="h-12 rounded-xl bg-[hsl(var(--partner-navy))] px-6 text-[hsl(var(--partner-ivory))] hover:bg-[hsl(var(--partner-navy))]/92"
                disabled={!isReady || isVerifying}
                onClick={async () => {
                  setVerificationError("");
                  setIsVerifying(true);

                  try {
                    const session = await verifyPartnerAccessCode(email, code);
                    if (!session) {
                      setVerificationError("Ο κωδικός δεν επιβεβαιώθηκε. Ελέγξτε τον πιο πρόσφατο κωδικό και προσπαθήστε ξανά.");
                      return;
                    }

                    navigate(destination, {
                      state: {
                        email: session.email,
                      },
                    });
                  } catch {
                    setVerificationError("Δεν ήταν δυνατή η επαλήθευση πρόσβασης. Προσπαθήστε ξανά.");
                  } finally {
                    setIsVerifying(false);
                  }
                }}
              >
                {isVerifying ? "Γίνεται επαλήθευση..." : "Επαλήθευση & Συνέχεια"}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            {verificationError ? <p className="mt-4 text-sm font-semibold text-destructive">{verificationError}</p> : null}

            <button
              type="button"
              onClick={async () => {
                await requestPartnerAccessCode(email);
                setResent(true);
              }}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--partner-navy-soft))] transition hover:text-[hsl(var(--partner-ink))]"
            >
              <RefreshCw className="h-4 w-4" />
              Αποστολή ξανά
            </button>
            {resent && <p className="mt-3 text-sm text-muted-foreground">Στάλθηκε νέος κωδικός.</p>}
          </div>
        </div>
      </section>
    </PartnerShell>
  );
};

export default PartnerVerification;
