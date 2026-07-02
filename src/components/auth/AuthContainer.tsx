import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

type AuthContainerProps = {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  [key: string]: unknown;
};

const getLoginErrorMessage = (message?: string) => {
  if (!message) return "Δεν ήταν δυνατή η σύνδεση. Δοκιμάστε ξανά.";
  if (message === "Invalid login credentials") return "Το email ή ο κωδικός δεν είναι σωστά.";
  if (message === "Email not confirmed") return "Πρέπει πρώτα να επιβεβαιώσετε το email του λογαριασμού σας.";
  if (message.includes("Failed to fetch")) return "Δεν ήταν δυνατή η σύνδεση με την υπηρεσία. Ελέγξτε τη σύνδεσή σας.";
  return message;
};

const getSignupErrorMessage = (message?: string) => {
  if (!message) return "Δεν ήταν δυνατή η δημιουργία λογαριασμού. Δοκιμάστε ξανά.";
  if (message === "Username already taken") return "Αυτό το όνομα χρήστη χρησιμοποιείται ήδη.";
  if (message === "User already registered") return "Υπάρχει ήδη λογαριασμός με αυτό το email. Συνδεθείτε για να συνεχίσετε.";
  if (message.includes("Password")) return message;
  if (message.includes("Network connection failed")) return "Δεν ήταν δυνατή η σύνδεση με την υπηρεσία. Ελέγξτε τη σύνδεσή σας.";
  return message;
};

export default function AuthContainer({
  isOpen,
  open,
  onClose,
  onOpenChange,
}: AuthContainerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const { signIn, signUp } = useAuth();

  const controlledOpen = isOpen ?? open;
  const visible = controlledOpen ?? internalOpen;

  useEffect(() => {
    if (!visible) {
      setMode("login");
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setLoading(false);
      setMessage(null);
    }
  }, [visible]);

  const setVisible = (value: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(value);
    }

    onOpenChange?.(value);

    if (!value) {
      onClose?.();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setMessage({ type: "error", text: "Συμπληρώστε email και κωδικό για να συνεχίσετε." });
      return;
    }

    if (mode === "signup") {
      const normalizedUsername = username.trim();
      if (normalizedUsername.length < 4) {
        setMessage({ type: "error", text: "Το όνομα χρήστη πρέπει να έχει τουλάχιστον 4 χαρακτήρες." });
        return;
      }
      if (password.length < 8) {
        setMessage({ type: "error", text: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες." });
        return;
      }
      if (password !== confirmPassword) {
        setMessage({ type: "error", text: "Οι κωδικοί δεν ταιριάζουν." });
        return;
      }
    }

    setLoading(true);
    setMessage(null);

    try {
      if (mode === "signup") {
        const { error, needsConfirmation } = await signUp(normalizedEmail, password, username.trim());
        if (error) {
          setMessage({ type: "error", text: getSignupErrorMessage(error.message) });
          return;
        }

        setMessage({
          type: "success",
          text: needsConfirmation
            ? "Ο λογαριασμός δημιουργήθηκε. Ελέγξτε το email σας για επιβεβαίωση."
            : "Ο λογαριασμός δημιουργήθηκε. Μπορείτε να συνεχίσετε.",
        });

        if (!needsConfirmation) {
          window.setTimeout(() => setVisible(false), 700);
        }
        return;
      }

      const { error } = await signIn(normalizedEmail, password);
      if (error) {
        setMessage({ type: "error", text: getLoginErrorMessage(error.message) });
        return;
      }

      setMessage({ type: "success", text: "Η σύνδεση ολοκληρώθηκε." });
      window.setTimeout(() => setVisible(false), 500);
    } catch (error) {
      setMessage({
        type: "error",
        text: getLoginErrorMessage(error instanceof Error ? error.message : undefined),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {controlledOpen === undefined && (
        <Button variant="outline" onClick={() => setVisible(true)}>
          Σύνδεση
        </Button>
      )}

      {visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-950">Σύνδεση / Εγγραφή</h2>

              <button
                type="button"
                onClick={() => setVisible(false)}
                className="text-sm text-gray-500 hover:text-gray-900"
                disabled={loading}
              >
                Κλείσιμο
              </button>
            </div>

            <p className="mb-4 text-sm text-gray-600">
              {mode === "login"
                ? "Συνδεθείτε για να συνεχίσετε με τα στοιχεία του λογαριασμού σας."
                : "Δημιουργήστε λογαριασμό χρήστη για κρατήσεις, ιστορικό και αποθηκευμένους δικηγόρους."}
            </p>

            <form className="space-y-3" onSubmit={handleSubmit}>
              {message ? (
                <div
                  className={
                    message.type === "success"
                      ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                      : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  }
                >
                  {message.text}
                </div>
              ) : null}

              {mode === "signup" ? (
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Όνομα χρήστη"
                  className="w-full rounded-md border px-3 py-2 text-gray-950"
                  autoComplete="username"
                  disabled={loading}
                  maxLength={16}
                />
              ) : null}

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="w-full rounded-md border px-3 py-2 text-gray-950"
                autoComplete="email"
                disabled={loading}
              />

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Κωδικός"
                className="w-full rounded-md border px-3 py-2 text-gray-950"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                disabled={loading}
              />

              {mode === "signup" ? (
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Επιβεβαίωση κωδικού"
                  className="w-full rounded-md border px-3 py-2 text-gray-950"
                  autoComplete="new-password"
                  disabled={loading}
                />
              ) : null}

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? (mode === "login" ? "Γίνεται σύνδεση..." : "Δημιουργείται...") : mode === "login" ? "Συνέχεια" : "Δημιουργία λογαριασμού"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-600">
              {mode === "login" ? "Δεν έχετε λογαριασμό;" : "Έχετε ήδη λογαριασμό;"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setMessage(null);
                }}
                className="font-semibold text-primary hover:underline"
                disabled={loading}
              >
                {mode === "login" ? "Δημιουργία" : "Σύνδεση"}
              </button>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
