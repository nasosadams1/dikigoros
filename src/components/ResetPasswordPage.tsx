import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Lock, Scale, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ResetStatus = "loading" | "ready" | "success" | "error";

const PASSWORD_MIN_LENGTH = 8;
const PKCE_MISSING_VERIFIER_MESSAGE = "PKCE code verifier not found in storage.";

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<ResetStatus>("loading");
  const [title, setTitle] = useState("Προετοιμασία επαναφοράς");
  const [message, setMessage] = useState("Ελέγχουμε τον σύνδεσμο ανάκτησης και δημιουργούμε ασφαλή συνεδρία.");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordError = useMemo(() => {
    if (!password) return "";
    if (password.length < PASSWORD_MIN_LENGTH) return `Ο κωδικός πρέπει να έχει τουλάχιστον ${PASSWORD_MIN_LENGTH} χαρακτήρες.`;
    return "";
  }, [password]);

  const confirmError = useMemo(() => {
    if (!confirmPassword) return "";
    if (confirmPassword !== password) return "Οι κωδικοί δεν ταιριάζουν.";
    return "";
  }, [confirmPassword, password]);

  useEffect(() => {
    let cancelled = false;

    const prepareRecoverySession = async () => {
      try {
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type");
        const code = searchParams.get("code");
        const hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const hasRecoveryParams = Boolean(tokenHash || type || code || accessToken || refreshToken);

        let operationError: Error | null = null;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) operationError = error;
        } else if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });

          if (error) operationError = error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) operationError = error;
        }

        if (hasRecoveryParams) {
          window.history.replaceState({}, document.title, "/auth/reset-password");
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          if (operationError) throw operationError;
          throw new Error(
            hasRecoveryParams
              ? "Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος ή έχει λήξει."
              : "Ανοίξτε τον πιο πρόσφατο σύνδεσμο επαναφοράς από το ηλεκτρονικό ταχυδρομείο σας.",
          );
        }

        if (cancelled) return;
        setStatus("ready");
        setTitle("Δημιουργία νέου κωδικού");
        setMessage("Επιλέξτε έναν ισχυρό κωδικό. Μετά την αποθήκευση μπορείτε να συνδεθείτε άμεσα.");
      } catch (error: unknown) {
        const rawMessage = error instanceof Error ? error.message : "";
        const friendlyMessage = rawMessage.includes(PKCE_MISSING_VERIFIER_MESSAGE)
          ? "Αυτός ο σύνδεσμος επαναφοράς δεν μπορεί πλέον να ολοκληρωθεί σε αυτόν τον περιηγητή. Ζητήστε νέο μήνυμα."
          : rawMessage;

        if (cancelled) return;
        setStatus("error");
        setTitle("Ο σύνδεσμος δεν είναι έγκυρος");
        setMessage(friendlyMessage || "Δεν ήταν δυνατή η έναρξη ασφαλούς επαναφοράς κωδικού.");
      }
    };

    void prepareRecoverySession();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (passwordError || confirmError) {
      setFormError(passwordError || confirmError);
      return;
    }

    if (!password || !confirmPassword) {
      setFormError("Συμπληρώστε και επιβεβαιώστε τον νέο κωδικό.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setStatus("success");
      setTitle("Ο κωδικός ενημερώθηκε");
      setMessage("Ο κωδικός σας άλλαξε επιτυχώς. Μπορείτε να επιστρέψετε και να συνδεθείτε με τον νέο κωδικό.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Δεν ήταν δυνατή η ενημέρωση του κωδικού.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground/50">Ανάκτηση λογαριασμού</p>
              </div>
            </div>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-3 py-1 text-xs font-bold text-primary-foreground/80">
              <ShieldCheck className="h-4 w-4 text-gold" />
              Ασφαλής ανάκτηση
            </div>
            <h1 className="mt-6 font-serif text-4xl leading-tight tracking-tight">Αλλάξτε τον κωδικό σας με ασφάλεια.</h1>
            <p className="mt-4 text-sm leading-6 text-primary-foreground/65">
              Η σελίδα ολοκληρώνει τη ροή ανάκτησης από το ηλεκτρονικό ταχυδρομείο σας και διατηρεί την ίδια ασφαλή λειτουργία.
            </p>
          </div>

          <div className="px-8 py-10 sm:px-10 sm:py-12">
            <div className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {status === "loading" ? "Προετοιμασία" : status === "ready" ? "Έτοιμο" : status === "success" ? "Ενημερώθηκε" : "Απαιτείται ενέργεια"}
            </div>

            <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              {status === "loading" && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
              {status === "ready" && <Lock className="h-8 w-8 text-primary" />}
              {status === "success" && <CheckCircle2 className="h-8 w-8 text-sage" />}
              {status === "error" && <AlertTriangle className="h-8 w-8 text-gold" />}
            </div>

            <h2 className="mt-6 font-serif text-3xl tracking-tight text-foreground">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>

            {status === "ready" && (
              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label htmlFor="reset-password" className="text-sm font-bold text-foreground">
                    Νέος κωδικός
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
                    placeholder="Νέος κωδικός"
                    autoComplete="new-password"
                  />
                  <p className={`text-xs ${passwordError ? "text-destructive" : "text-muted-foreground"}`}>
                    {passwordError || `Χρησιμοποιήστε τουλάχιστον ${PASSWORD_MIN_LENGTH} χαρακτήρες.`}
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="reset-password-confirm" className="text-sm font-bold text-foreground">
                    Επιβεβαίωση κωδικού
                  </label>
                  <input
                    id="reset-password-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
                    placeholder="Επιβεβαιώστε τον κωδικό"
                    autoComplete="new-password"
                  />
                  <p className={`text-xs ${confirmError ? "text-destructive" : "text-muted-foreground"}`}>
                    {confirmError || "Πληκτρολογήστε ξανά τον ίδιο κωδικό."}
                  </p>
                </div>

                {formError && <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{formError}</div>}

                <button
                  type="submit"
                  disabled={isSubmitting || !!passwordError || !!confirmError}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {isSubmitting ? "Αποθήκευση..." : "Αποθήκευση νέου κωδικού"}
                </button>
              </form>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
