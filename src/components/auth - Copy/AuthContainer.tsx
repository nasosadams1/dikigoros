import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle, Mail, RefreshCw, Scale, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import ForgotPasswordForm from "./ForgotPassword";
import LoginForm from "./LoginForm";
import SignUpForm from "./SignUpForm";

export type AuthView = "login" | "signup" | "forgot-password" | "email-verification";

interface AuthContainerProps {
  open: boolean;
  onClose: () => void;
  initialView?: AuthView;
}

const authBenefits = [
  { icon: ShieldCheck, label: "Ασφαλής πρόσβαση", description: "Σύνδεση και επιβεβαίωση με μία ενιαία διαδικασία." },
  { icon: UserCheck, label: "Στοιχεία λογαριασμού", description: "Τα βασικά στοιχεία και το ιστορικό σας παραμένουν διαθέσιμα στον λογαριασμό." },
  { icon: Sparkles, label: "Γρήγορη συνέχεια", description: "Είσοδος με ηλεκτρονικό ταχυδρομείο ή Google και εύκολη επαναφορά κωδικού, χωρίς διακοπή της διαδικασίας." },
];

const messageToneClasses = {
  success: "border-sage/25 bg-sage/10 text-sage-foreground",
  error: "border-destructive/25 bg-destructive/10 text-destructive",
  info: "border-gold/30 bg-gold/10 text-gold-foreground",
} as const;

const AuthContainer: React.FC<AuthContainerProps> = ({ open, onClose, initialView = "login" }) => {
  const [currentView, setCurrentView] = useState<AuthView>(initialView);
  const [email, setEmail] = useState("");
  const [globalMessage, setGlobalMessage] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { user, confirmUser } = useAuth();

  useEffect(() => {
    if (open) setCurrentView(initialView);
  }, [initialView, open]);

  useEffect(() => {
    if (!open) {
      setCurrentView(initialView);
      setEmail("");
      setGlobalMessage(null);
      setIsResending(false);
      setResendCooldown(0);
    }
  }, [initialView, open]);

  useEffect(() => {
    if (!user || !open) return undefined;

    setGlobalMessage({
      type: "success",
      message: "Η σύνδεση ολοκληρώθηκε. Μπορείτε να συνεχίσετε στο Dikigoros.",
    });

    const timer = window.setTimeout(() => {
      onClose();
      setGlobalMessage(null);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [onClose, open, user]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;

    const timer = window.setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const messageIcon = useMemo(() => {
    if (!globalMessage) return null;
    return globalMessage.type === "success" ? CheckCircle : AlertCircle;
  }, [globalMessage]);

  const handleToggleForm = () => {
    setCurrentView(currentView === "login" ? "signup" : "login");
    setGlobalMessage(null);
  };

  const handleEmailVerification = (userEmail: string) => {
    setEmail(userEmail);
    setCurrentView("email-verification");
    setGlobalMessage({
      type: "info",
      message: "Στείλαμε μήνυμα επιβεβαίωσης στο ηλεκτρονικό ταχυδρομείο σας. Ανοίξτε τον σύνδεσμο για να ενεργοποιηθεί ο λογαριασμός σας.",
    });
  };

  const handleGlobalMessage = (type: "success" | "error" | "info", message: string) => {
    setGlobalMessage({ type, message });
  };

  const handleResendConfirmation = async () => {
    if (!email || isResending || resendCooldown > 0) return;

    setIsResending(true);
    setGlobalMessage(null);

    try {
      const { error } = await confirmUser(email);
      if (error) {
        handleGlobalMessage("error", error.message || "Δεν ήταν δυνατή η αποστολή νέου μηνύματος επιβεβαίωσης.");
      } else {
        setResendCooldown(30);
        handleGlobalMessage("success", `Στείλαμε νέο μήνυμα επιβεβαίωσης στο ${email}.`);
      }
    } catch (error: unknown) {
      handleGlobalMessage("error", error instanceof Error ? error.message : "Δεν ήταν δυνατή η αποστολή νέου μηνύματος επιβεβαίωσης.");
    } finally {
      setIsResending(false);
    }
  };

  const MessageIcon = messageIcon;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden rounded-[24px] border-border bg-card p-0 shadow-2xl shadow-foreground/20">
        <DialogTitle className="sr-only">Σύνδεση στο Dikigoros</DialogTitle>
        <DialogDescription className="sr-only">
          Συνδεθείτε ή δημιουργήστε λογαριασμό για να διαχειριστείτε ραντεβού, έγγραφα και προτιμήσεις.
        </DialogDescription>

        <div className="grid max-h-[90vh] overflow-y-auto md:grid-cols-[0.82fr_1.18fr]">
          <aside className="relative overflow-hidden bg-primary px-6 py-8 text-primary-foreground sm:px-8">
            <div className="absolute -left-16 top-10 h-40 w-40 rounded-full bg-gold/15 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-sage/15 blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary-foreground text-primary shadow-lg">
                  <Scale className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xl font-semibold tracking-[-0.02em]">Dikigoros</p>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground/52">ΣΥΝΔΕΣΗ ΛΟΓΑΡΙΑΣΜΟΥ</p>
                </div>
              </div>

              <div className="mt-9">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-3 py-1 text-xs font-medium text-primary-foreground/78">
                  <Scale className="h-3.5 w-3.5 text-gold" />
                  Πρόσβαση για πελάτες και δικηγόρους
                </div>
                <h3 className="mt-5 font-serif text-[2.65rem] leading-[1.02] tracking-tight">
                  Διαχείριση αιτημάτων και ραντεβού σε έναν ασφαλή λογαριασμό.
                </h3>
                <p className="mt-4 text-sm leading-6 text-primary-foreground/68">
                  Συνδεθείτε για πρόσβαση στα αιτήματα, τα ραντεβού και τα βασικά στοιχεία του λογαριασμού σας.
                </p>
              </div>

              <div className="mt-8 space-y-3">
                {authBenefits.map(({ icon: Icon, label, description }) => (
                  <div key={label} className="rounded-[18px] border border-primary-foreground/10 bg-primary-foreground/[0.08] p-3.5 backdrop-blur">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gold/20 text-gold">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary-foreground">{label}</p>
                        <p className="mt-1 text-xs leading-5 text-primary-foreground/58">{description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="px-5 py-7 sm:px-8 sm:py-8">
            {globalMessage && MessageIcon && (
              <div className={`mb-5 flex items-start gap-3 rounded-[14px] border px-4 py-3 text-sm ${messageToneClasses[globalMessage.type]}`}>
                <MessageIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-6">{globalMessage.message}</p>
              </div>
            )}

            {currentView === "login" && (
              <LoginForm
                onToggleForm={handleToggleForm}
                onForgotPassword={() => {
                  setCurrentView("forgot-password");
                  setGlobalMessage(null);
                }}
                onMessage={handleGlobalMessage}
              />
            )}

            {currentView === "signup" && (
              <SignUpForm onToggleForm={handleToggleForm} onEmailVerification={handleEmailVerification} onMessage={handleGlobalMessage} />
            )}

            {currentView === "forgot-password" && (
              <ForgotPasswordForm
                onBack={() => {
                  setCurrentView("login");
                  setGlobalMessage(null);
                }}
                onMessage={handleGlobalMessage}
              />
            )}

            {currentView === "email-verification" && (
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[18px] border border-gold/30 bg-gold/10 text-gold-foreground">
                  <Mail className="h-8 w-8" />
                </div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sage">Επιβεβαίωση ηλεκτρονικού ταχυδρομείου</p>
                <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground">Ελέγξτε το ηλεκτρονικό ταχυδρομείο σας</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Στείλαμε σύνδεσμο επιβεβαίωσης στο <span className="font-semibold text-foreground">{email}</span>.
                </p>

                <div className="mt-6 rounded-[14px] border border-border bg-secondary/50 p-4 text-left text-sm leading-6 text-muted-foreground">
                  Ανοίξτε το πιο πρόσφατο μήνυμα από την ίδια συσκευή. Αν ζητήσετε νέο μήνυμα, χρησιμοποιήστε μόνο τον τελευταίο σύνδεσμο που θα λάβετε.
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResending || resendCooldown > 0}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
                    {isResending ? "Αποστολή..." : resendCooldown > 0 ? `${resendCooldown}s` : "Νέο μήνυμα"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView("signup")}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Άλλο ηλεκτρονικό ταχυδρομείο
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthContainer;
