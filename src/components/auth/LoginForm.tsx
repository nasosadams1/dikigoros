import React, { useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface LoginFormProps {
  onToggleForm: () => void;
  onForgotPassword: () => void;
  onMessage: (type: "success" | "error" | "info", message: string) => void;
}

interface FormErrors {
  email?: string;
  password?: string;
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

const getErrorMessage = (error: string) => {
  const errorMap: Record<string, string> = {
    "Invalid login credentials": "Λάθος email ή κωδικός. Ελέγξτε τα στοιχεία σας και δοκιμάστε ξανά.",
    "Email not confirmed": "Παρακαλούμε επιβεβαιώστε πρώτα το email σας.",
    "Too many requests": "Έγιναν πολλές προσπάθειες. Περιμένετε λίγα λεπτά και δοκιμάστε ξανά.",
    "User not found": "Δεν βρέθηκε λογαριασμός με αυτό το email.",
    "Failed to fetch": "Δεν ήταν δυνατή η σύνδεση. Ελέγξτε τη σύνδεσή σας.",
  };

  return errorMap[error] || error || "Κάτι πήγε στραβά. Δοκιμάστε ξανά.";
};

const validateEmail = (value: string) => {
  if (!value.trim()) return "Το email είναι υποχρεωτικό.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Πληκτρολογήστε ένα έγκυρο email.";
  return undefined;
};

const validatePassword = (value: string) => {
  if (!value) return "Ο κωδικός είναι υποχρεωτικός.";
  if (value.length < 6) return "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.";
  return undefined;
};

const LoginForm: React.FC<LoginFormProps> = ({ onToggleForm, onForgotPassword, onMessage }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const { signIn, signInWithGoogle } = useAuth();

  const validateForm = () => {
    const nextErrors: FormErrors = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      onMessage("error", "Συμπληρώστε σωστά τα πεδία και δοκιμάστε ξανά.");
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const result = await signIn(email.trim(), password);
      if (result?.error) {
        const friendlyMessage = getErrorMessage(result.error.message);
        setErrors({ general: friendlyMessage });
        onMessage("error", friendlyMessage);
      }
    } catch (error: any) {
      const friendlyMessage = getErrorMessage(error?.message);
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
      const friendlyMessage = "Η σύνδεση με Google απέτυχε. Δοκιμάστε ξανά ή χρησιμοποιήστε email.";
      setErrors({ general: friendlyMessage });
      onMessage("error", friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const inputClassName =
    "h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-2 focus:ring-primary/25";

  return (
    <div>
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sage">Είσοδος λογαριασμού</p>
        <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground">Σύνδεση στο Dikigoros</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Μπείτε για να διαχειριστείτε αιτήματα, ραντεβού και τα στοιχεία του λογαριασμού σας.
        </p>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground shadow-sm transition hover:border-primary/25 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleMark />
        Συνέχεια με Google
      </button>

      <div className="my-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        Email
        <div className="h-px flex-1 bg-border" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {errors.general && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{errors.general}</p>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="login-email" className="text-sm font-bold text-foreground">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="login-email"
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

        <div className="space-y-2">
          <label htmlFor="login-password" className="text-sm font-bold text-foreground">
            Κωδικός
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Πληκτρολογήστε τον κωδικό"
              className={`${inputClassName} pr-12`}
              disabled={loading}
              autoComplete="current-password"
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

        <div className="text-right">
          <button type="button" onClick={onForgotPassword} className="text-sm font-bold text-primary hover:underline" disabled={loading}>
            Ξεχάσατε τον κωδικό;
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Γίνεται σύνδεση..." : "Σύνδεση"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Δεν έχετε λογαριασμό;{" "}
        <button onClick={onToggleForm} className="font-bold text-primary hover:underline" disabled={loading}>
          Δημιουργία λογαριασμού
        </button>
      </p>
    </div>
  );
};

export default LoginForm;
