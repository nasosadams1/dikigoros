import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, MailCheck, RotateCcw, Scale } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ConfirmStatus = "loading" | "success" | "error";

const REDIRECT_DELAY_MS = 2200;
const PKCE_MISSING_VERIFIER_MESSAGE = "PKCE code verifier not found in storage.";

const AuthConfirm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<ConfirmStatus>("loading");
  const [title, setTitle] = useState("Επιβεβαίωση ηλεκτρονικού ταχυδρομείου");
  const [message, setMessage] = useState("Ολοκληρώνουμε με ασφάλεια την επιβεβαίωση του λογαριασμού σας.");

  const confirmationParams = useMemo(
    () => ({
      tokenHash: searchParams.get("token_hash"),
      type: searchParams.get("type"),
      code: searchParams.get("code"),
    }),
    [searchParams],
  );

  useEffect(() => {
    let redirectTimer: number | null = null;

    const verifyEmail = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const hasAuthParams = Boolean(
          confirmationParams.code || confirmationParams.tokenHash || confirmationParams.type || accessToken || refreshToken,
        );

        let operationError: Error | null = null;

        if (confirmationParams.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(confirmationParams.code);
          if (error) operationError = error;
        } else if (confirmationParams.tokenHash && confirmationParams.type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: confirmationParams.tokenHash,
            type: confirmationParams.type as "signup" | "email_change" | "recovery" | "invite" | "email",
          });

          if (error) operationError = error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) operationError = error;
        }

        if (hasAuthParams) {
          window.history.replaceState({}, document.title, "/auth/confirm");
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session?.user) {
          setStatus("success");
          setTitle("Το ηλεκτρονικό ταχυδρομείο επιβεβαιώθηκε");
          setMessage("Ο λογαριασμός σας είναι έτοιμος. Θα επιστρέψετε αυτόματα στην αρχική σελίδα.");
          redirectTimer = window.setTimeout(() => navigate("/"), REDIRECT_DELAY_MS);
          return;
        }

        if (operationError) throw operationError;

        throw new Error(
          hasAuthParams
            ? "Ο σύνδεσμος επιβεβαίωσης είναι ελλιπής ή έχει ήδη χρησιμοποιηθεί."
            : "Δεν βρέθηκε έγκυρη συνεδρία επιβεβαίωσης. Ανοίξτε τον πιο πρόσφατο σύνδεσμο από το ηλεκτρονικό ταχυδρομείο σας.",
        );
      } catch (error: unknown) {
        const rawMessage = error instanceof Error ? error.message : "";
        const friendlyMessage = rawMessage.includes(PKCE_MISSING_VERIFIER_MESSAGE)
          ? "Αυτός ο σύνδεσμος επιβεβαίωσης δεν μπορεί πλέον να ολοκληρωθεί σε αυτόν τον περιηγητή. Ζητήστε νέο μήνυμα επιβεβαίωσης."
          : rawMessage;

        setStatus("error");
        setTitle("Η επιβεβαίωση δεν ολοκληρώθηκε");
        setMessage(friendlyMessage || "Κάτι διέκοψε την επιβεβαίωση. Δοκιμάστε ξανά ή ζητήστε νέο μήνυμα.");
      }
    };

    void verifyEmail();

    return () => {
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [confirmationParams, navigate]);

  const statusIcon =
    status === "loading" ? (
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    ) : status === "success" ? (
      <CheckCircle2 className="h-8 w-8 text-sage" />
    ) : (
      <AlertTriangle className="h-8 w-8 text-gold" />
    );

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-foreground/[0.08] md:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-primary px-8 py-10 text-primary-foreground sm:px-10 sm:py-12">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-foreground text-primary">
                <Scale className="h-6 w-6" />
              </div>
              <div>
                <p className="font-serif text-2xl tracking-tight">Dikigoros</p>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground/50">Ασφάλεια λογαριασμού</p>
              </div>
            </div>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-3 py-1 text-xs font-bold text-primary-foreground/80">
              <MailCheck className="h-4 w-4 text-gold" />
              Επιβεβαίωση ηλεκτρονικού ταχυδρομείου
            </div>
            <h1 className="mt-6 font-serif text-4xl leading-tight tracking-tight">Ολοκλήρωση ασφαλούς σύνδεσης.</h1>
            <p className="mt-4 text-sm leading-6 text-primary-foreground/65">
              Μετά την επιβεβαίωση, η συνεδρία σας ενεργοποιείται και μπορείτε να συνεχίσετε στην πλατφόρμα.
            </p>
          </div>

          <div className="px-8 py-10 sm:px-10 sm:py-12">
            <div className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {status === "loading" ? "Επεξεργασία" : status === "success" ? "Επιβεβαιώθηκε" : "Απαιτείται ενέργεια"}
            </div>
            <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">{statusIcon}</div>
            <h2 className="mt-6 font-serif text-3xl tracking-tight text-foreground">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>

            {status === "success" && (
              <div className="mt-8 rounded-2xl border border-sage/25 bg-sage/10 p-4 text-sm leading-6 text-sage-foreground">
                Θα επιστρέψετε στην αρχική σελίδα σε λίγο.
              </div>
            )}

            {status === "error" && (
              <div className="mt-8 rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6 text-gold-foreground">
                Αν ζητήσατε πολλά μηνύματα, χρησιμοποιήστε μόνο τον πιο πρόσφατο σύνδεσμο.
              </div>
            )}

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                Επιστροφή
                <ArrowRight className="h-4 w-4" />
              </button>

              {status === "error" && (
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold text-foreground transition hover:bg-secondary"
                >
                  <RotateCcw className="h-4 w-4" />
                  Ζητήστε νέο μήνυμα
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthConfirm;
