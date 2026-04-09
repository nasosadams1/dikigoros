import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle, Mail, RefreshCw, Scale, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  { icon: ShieldCheck, label: "Ασφαλής πρόσβαση", description: "Ίδιο Supabase backend με το υπάρχον auth flow." },
  { icon: UserCheck, label: "Προφίλ χρήστη", description: "Διατηρείται η δημιουργία/ανάκτηση profile όπως στο source project." },
  { icon: Sparkles, label: "Γρήγορη συνέχεια", description: "Email, Google και reset password μένουν στο ίδιο flow." },
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
      message: "Η σύνδεση ολοκληρώθηκε. Ο λογαριασμός σας είναι έτοιμος.",
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
    return globalMessage.type === "success" ? CheckCircle : globalMessage.type === "error" ? AlertCircle : AlertCircle;
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
      message: "Στείλαμε email επιβεβαίωσης. Ανοίξτε τον σύνδεσμο για να ενεργοποιηθεί ο λογαριασμός.",
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
        handleGlobalMessage("error", error.message || "Δεν ήταν δυνατή η αποστολή νέου email επιβεβαίωσης.");
      } else {
        setResendCooldown(30);
        handleGlobalMessage("success", `Στείλαμε νέο email επιβεβαίωσης στο ${email}.`);
      }
    } catch (error: any) {
      handleGlobalMessage("error", error?.message || "Δεν ήταν δυνατή η αποστολή νέου email επιβεβαίωσης.");
    } finally {
      setIsResending(false);
    }
  };

  const MessageIcon = messageIcon;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden rounded-[1.75rem] border-border bg-card p-0 shadow-2xl shadow-foreground/20">
        <DialogTitle className="sr-only">Dikigoros authentication</DialogTitle>

        <div className="grid max-h-[92vh] overflow-y-auto md:grid-cols-[0.9fr_1.1fr]">
          <aside className="relative overflow-hidden bg-primary px-6 py-8 text-primary-foreground sm:px-8">
            <div className="absolute -left-16 top-10 h-44 w-44 rounded-full bg-gold/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-sage/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-foreground text-primary shadow-lg">
                  <span className="font-serif text-2xl">Δ</span>
                </div>
                <div>
                  <p className="font-serif text-2xl tracking-tight">Dikigoros</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground/50">Legal access</p>
                </div>
              </div>

              <div className="mt-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-3 py-1 text-xs font-bold text-primary-foreground/80">
                  <Scale className="h-3.5 w-3.5 text-gold" />
                  Σύνδεση για πελάτες και δικηγόρους
                </div>
                <h3 className="mt-5 font-serif text-4xl leading-tight tracking-tight">
                  Όλα τα νομικά σας αιτήματα σε έναν ασφαλή χώρο.
                </h3>
                <p className="mt-4 text-sm leading-6 text-primary-foreground/65">
                  Το auth flow αντιγράφει το υπάρχον sign in/sign up backend και εδώ αλλάζει μόνο η εμπειρία και το ύφος για να ταιριάζει με το Dikigoros.
                </p>
              </div>

              <div className="mt-8 space-y-3">
                {authBenefits.map(({ icon: Icon, label, description }) => (
                  <div key={label} className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/[0.08] p-4 backdrop-blur">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-gold">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary-foreground">{label}</p>
                        <p className="mt-1 text-xs leading-5 text-primary-foreground/55">{description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="px-5 py-7 sm:px-8 sm:py-8">
            {globalMessage && MessageIcon && (
              <div className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${messageToneClasses[globalMessage.type]}`}>
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
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold-foreground">
                  <Mail className="h-8 w-8" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sage">Επιβεβαίωση email</p>
                <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground">Ελέγξτε το email σας</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Στείλαμε σύνδεσμο επιβεβαίωσης στο <span className="font-bold text-foreground">{email}</span>.
                </p>

                <div className="mt-6 rounded-xl border border-border bg-secondary/50 p-4 text-left text-sm leading-6 text-muted-foreground">
                  Ανοίξτε τον σύνδεσμο από την ίδια συσκευή. Αν ζητήσετε νέο email, χρησιμοποιήστε μόνο τον πιο πρόσφατο σύνδεσμο.
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResending || resendCooldown > 0}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
                    {isResending ? "Αποστολή..." : resendCooldown > 0 ? `${resendCooldown}s` : "Νέο email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView("signup")}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:bg-secondary"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Άλλο email
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
