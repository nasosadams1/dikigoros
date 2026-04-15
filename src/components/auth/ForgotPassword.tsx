import React, { useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle, Loader2, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface ForgotPasswordFormProps {
  onBack: () => void;
  onMessage: (type: "success" | "error" | "info", message: string) => void;
}

const validateEmail = (value: string) => {
  if (!value.trim()) return "Συμπληρώστε το ηλεκτρονικό ταχυδρομείο του λογαριασμού σας.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Πληκτρολογήστε έγκυρη διεύθυνση ηλεκτρονικού ταχυδρομείου.";
  return undefined;
};

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBack, onMessage }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { resetPassword } = useAuth();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      onMessage("error", emailError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: resetError } = await resetPassword(email.trim());
      if (resetError) {
        const errorMessage = resetError.message || "Δεν ήταν δυνατή η αποστολή μηνύματος επαναφοράς.";
        setError(errorMessage);
        onMessage("error", errorMessage);
      } else {
        setSent(true);
        onMessage("success", "Στάλθηκε σύνδεσμος επαναφοράς κωδικού.");
      }
    } catch (requestError: unknown) {
      const errorMessage = requestError instanceof Error ? requestError.message : "Δεν ήταν δυνατή η αποστολή συνδέσμου επαναφοράς. Δοκιμάστε ξανά.";
      setError(errorMessage);
      onMessage("error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-sage/25 bg-sage/10 text-sage">
          <CheckCircle className="h-8 w-8" />
        </div>
        <h2 className="font-serif text-3xl tracking-tight text-foreground">Ελέγξτε το ηλεκτρονικό ταχυδρομείο σας</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Στείλαμε ασφαλή σύνδεσμο επαναφοράς στο <span className="font-bold text-foreground">{email}</span>.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-secondary/50 p-4 text-left text-sm leading-6 text-muted-foreground">
          Ανοίξτε τον πιο πρόσφατο σύνδεσμο επαναφοράς και ορίστε νέο κωδικό. Αν δεν εμφανίζεται, ελέγξτε spam ή promotions.
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:bg-secondary"
          >
            Άλλο ηλεκτρονικό ταχυδρομείο
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Πίσω στη σύνδεση
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Πίσω στη σύνδεση
      </button>

      <div className="mb-6">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Mail className="h-7 w-7" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sage">Ασφαλής ανάκτηση</p>
        <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground">Επαναφορά κωδικού</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Πληκτρολογήστε το ηλεκτρονικό ταχυδρομείο του λογαριασμού σας και θα στείλουμε ασφαλή σύνδεσμο επαναφοράς.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="reset-email" className="text-sm font-bold text-foreground">
            Ηλεκτρονικό ταχυδρομείο
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError("");
              }}
              placeholder="name@example.com"
              className="h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
              disabled={loading}
              autoComplete="email"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Αποστολή..." : "Αποστολή συνδέσμου"}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sage" />
          <p className="text-sm leading-6 text-muted-foreground">
            Για ασφάλεια, χρησιμοποιήστε μόνο τον πιο πρόσφατο σύνδεσμο επαναφοράς που θα λάβετε.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;
