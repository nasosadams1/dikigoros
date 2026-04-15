import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface SignUpFormProps {
  onToggleForm: () => void;
  onEmailVerification: (email: string) => void;
  onMessage: (type: "success" | "error" | "info", message: string) => void;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  legal?: string;
  general?: string;
}

const GoogleMark = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.7 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 4 1.5l2.8-2.7C17.1 3.2 14.8 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.7-4.1 9.7-9.8 0-.7-.1-1.2-.2-1.7H12Z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-0.9 6.7-2.5l-3.2-2.6c-.9.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.3l-3.3 2.5C4.6 19.5 8 22 12 22Z" />
    <path fill="#4A90E2" d="M3 7.9l3.3 2.4C7.1 7.8 9.4 6 12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.8C17 3.1 14.7 2 12 2 8 2 4.6 4.5 3 7.9Z" />
    <path fill="#FBBC05" d="M6.2 13.6c-.2-.5-.3-1-.3-1.6s.1-1.1.3-1.6L3 7.9C2.3 9.2 2 10.6 2 12s.3 2.8 1 4.1l3.2-2.5Z" />
  </svg>
);

const strengthTone = (score: number) => {
  if (score <= 1) return { colorClassName: "bg-destructive", label: "Αδύναμος" };
  if (score <= 3) return { colorClassName: "bg-gold", label: "Μέτριος" };
  return { colorClassName: "bg-sage", label: "Ισχυρός" };
};

const getErrorMessage = (error: string) => {
  const errorMap: Record<string, string> = {
    "User already registered": "Υπάρχει ήδη λογαριασμός με αυτό το ηλεκτρονικό ταχυδρομείο. Συνδεθείτε για να συνεχίσετε.",
    "Username already taken": "Το όνομα χρήστη χρησιμοποιείται ήδη. Επιλέξτε άλλο.",
    "Email rate limit exceeded": "Έγιναν πολλές προσπάθειες εγγραφής. Περιμένετε λίγο και δοκιμάστε ξανά.",
    "Signup disabled": "Οι νέες εγγραφές δεν είναι διαθέσιμες αυτή τη στιγμή.",
    "Invalid email": "Πληκτρολογήστε έγκυρη διεύθυνση ηλεκτρονικού ταχυδρομείου.",
    "Weak password": "Ο κωδικός είναι πολύ αδύναμος.",
  };

  return errorMap[error] || "Δεν ήταν δυνατή η δημιουργία λογαριασμού. Δοκιμάστε ξανά.";
};

const SignUpForm: React.FC<SignUpFormProps> = ({ onToggleForm, onEmailVerification, onMessage }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const { signUp, signInWithGoogle } = useAuth();

  const checkPasswordStrength = (value: string) => {
    let score = 0;
    const feedback: string[] = [];

    if (value.length >= 8) score += 1;
    else feedback.push("8 χαρακτήρες");
    if (/[a-z]/.test(value)) score += 1;
    else feedback.push("ένα μικρό γράμμα");
    if (/[A-Z]/.test(value)) score += 1;
    else feedback.push("ένα κεφαλαίο γράμμα");
    if (/\d/.test(value)) score += 1;
    else feedback.push("έναν αριθμό");
    if (/[^a-zA-Z0-9]/.test(value)) score += 1;
    else feedback.push("ένα σύμβολο");

    return { score, feedback, ...strengthTone(score) };
  };

  const validateName = (value: string) => {
    if (!value.trim()) return "Συμπληρώστε όνομα χρήστη.";
    if (value.trim().length < 4) return "Το όνομα χρήστη πρέπει να έχει τουλάχιστον 4 χαρακτήρες.";
    if (value.trim().length > 16) return "Το όνομα χρήστη πρέπει να έχει έως 16 χαρακτήρες.";
    if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) return "Χρησιμοποιήστε μόνο λατινικά γράμματα, αριθμούς και κάτω παύλα.";
    return undefined;
  };

  const validateEmail = (value: string) => {
  if (!value.trim()) return "Συμπληρώστε το ηλεκτρονικό ταχυδρομείο του λογαριασμού σας.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Πληκτρολογήστε έγκυρη διεύθυνση ηλεκτρονικού ταχυδρομείου.";
    return undefined;
  };

  const validatePassword = (value: string) => {
    if (!value) return "Συμπληρώστε κωδικό πρόσβασης.";
    if (value.length < 8) return "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.";
    if (checkPasswordStrength(value).score < 3) return "Ο κωδικός είναι πολύ αδύναμος.";
    return undefined;
  };

  const validateConfirmPassword = (value: string) => {
    if (!value) return "Επαναλάβετε τον κωδικό πρόσβασης.";
    if (value !== password) return "Οι κωδικοί δεν ταιριάζουν.";
    return undefined;
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};
    const nameError = validateName(name);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(confirmPassword);

    if (nameError) nextErrors.name = nameError;
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;
    if (confirmPasswordError) nextErrors.confirmPassword = confirmPasswordError;
    if (!acceptedLegal) nextErrors.legal = "Πρέπει να αποδεχθείτε τους όρους χρήσης και την πολιτική απορρήτου.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      onMessage("error", "Συμπληρώστε σωστά τα πεδία για να συνεχίσετε.");
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const result = await signUp(email.trim(), password, name.trim());

      if (result?.error) {
        const friendlyMessage = getErrorMessage(result.error.message);
        setErrors({ general: friendlyMessage });
        onMessage("error", friendlyMessage);
      } else if (result?.needsConfirmation) {
        onEmailVerification(email.trim());
        onMessage("success", "Ο λογαριασμός δημιουργήθηκε. Ελέγξτε το ηλεκτρονικό ταχυδρομείο σας για επιβεβαίωση.");
      } else {
        onMessage("success", "Ο λογαριασμός δημιουργήθηκε επιτυχώς.");
      }
    } catch (error: unknown) {
      const friendlyMessage = getErrorMessage(error instanceof Error ? error.message : "");
      setErrors({ general: friendlyMessage });
      onMessage("error", friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrors({});

    try {
      const result = await signInWithGoogle();
      if (result?.error) {
        const friendlyMessage = getErrorMessage(result.error.message);
        setErrors({ general: friendlyMessage });
        onMessage("error", friendlyMessage);
      }
    } catch {
      const friendlyMessage = "Η εγγραφή με Google δεν ολοκληρώθηκε. Δοκιμάστε ξανά ή συνεχίστε με ηλεκτρονικό ταχυδρομείο.";
      setErrors({ general: friendlyMessage });
      onMessage("error", friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = useMemo(() => (password ? checkPasswordStrength(password) : null), [password]);
  const inputClassName =
    "h-[52px] w-full rounded-[14px] border border-border bg-background pl-11 pr-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-2 focus:ring-primary/25";

  return (
    <div>
      <div className="mb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sage">Νέος λογαριασμός</p>
        <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground">Δημιουργία λογαριασμού</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Δημιουργήστε λογαριασμό για να παρακολουθείτε αιτήματα, ραντεβού και βασικά στοιχεία πρόσβασης στο Dikigoros.
        </p>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[14px] border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:border-primary/25 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleMark />
        Συνέχεια με Google
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        ή συνεχίστε με ηλεκτρονικό ταχυδρομείο
        <div className="h-px flex-1 bg-border" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {errors.general && (
          <div className="flex items-start gap-3 rounded-[14px] border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{errors.general}</p>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="signup-name" className="text-sm font-semibold text-foreground">
            Όνομα χρήστη
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="π.χ. nikos_legal"
              className={`${inputClassName} pr-12`}
              disabled={loading}
              autoComplete="username"
              maxLength={16}
            />
            {!errors.name && name && <CheckCircle className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sage" />}
          </div>
          {errors.name ? (
            <p className="text-xs font-medium text-destructive">{errors.name}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Χρησιμοποιήστε λατινικά γράμματα, αριθμούς και κάτω παύλα.</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="signup-email" className="text-sm font-semibold text-foreground">
            Ηλεκτρονικό ταχυδρομείο
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className={inputClassName}
              disabled={loading}
              autoComplete="email"
            />
          </div>
          {errors.email && <p className="text-xs font-medium text-destructive">{errors.email}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="signup-password" className="text-sm font-semibold text-foreground">
              Κωδικός πρόσβασης
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ορίστε κωδικό πρόσβασης"
                className={`${inputClassName} pr-12`}
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs font-medium text-destructive">{errors.password}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-confirm-password" className="text-sm font-semibold text-foreground">
              Επιβεβαίωση κωδικού
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="signup-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Επαναλάβετε τον κωδικό"
                className={`${inputClassName} pr-12`}
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs font-medium text-destructive">{errors.confirmPassword}</p>}
          </div>
        </div>

        {passwordStrength && (
          <div className="rounded-[14px] border border-border bg-secondary/50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-background">
                <div className={`h-2 rounded-full transition-all ${passwordStrength.colorClassName}`} style={{ width: `${(passwordStrength.score / 5) * 100}%` }} />
              </div>
              <span className="text-xs font-semibold text-foreground">{passwordStrength.label}</span>
            </div>
            {passwordStrength.feedback.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Χρειάζεται ακόμη: {passwordStrength.feedback.join(", ")}.</p>}
          </div>
        )}

        <div className="rounded-[14px] border border-border bg-card p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(event) => {
                setAcceptedLegal(event.target.checked);
                setErrors((prev) => ({ ...prev, legal: event.target.checked ? undefined : prev.legal }));
              }}
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              disabled={loading}
            />
            <span className="text-sm leading-6 text-muted-foreground">
              Συμφωνώ με τους όρους χρήσης και την πολιτική απορρήτου του Dikigoros.
            </span>
          </label>
          {errors.legal && <p className="mt-2 text-xs font-medium text-destructive">{errors.legal}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Δημιουργείται..." : "Δημιουργία λογαριασμού"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Έχετε ήδη λογαριασμό;{" "}
        <button onClick={onToggleForm} className="font-semibold text-primary hover:underline" disabled={loading}>
          Σύνδεση
        </button>
      </p>
    </div>
  );
};

export default SignUpForm;
