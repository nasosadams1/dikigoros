import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  LineChart,
  Mail,
  ShieldCheck,
  UsersRound,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PartnerShell from "@/components/partner/PartnerShell";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { partnerPlans, type PartnerPlan, type PartnerPlanId } from "@/lib/level4Marketplace";
import { clearPartnerSession, getPartnerSession, isPartnerSessionInvalidError } from "@/lib/platformRepository";
import {
  createPartnerSubscriptionCheckoutSession,
  type PartnerBillingInterval,
} from "@/lib/partnerSubscriptions";

const billingOptions: { id: PartnerBillingInterval; label: string }[] = [
  { id: "monthly", label: "Μηνιαία" },
  { id: "annual", label: "Ετήσια" },
];

const formatEuro = (amount: number) =>
  `€${amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

const ForLawyersPlans = () => {
  const [searchParams] = useSearchParams();
  const [partnerSession, setPartnerSession] = useState(() => getPartnerSession());
  const [billingInterval, setBillingInterval] = useState<PartnerBillingInterval>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<PartnerPlanId | null>(null);
  const [message, setMessage] = useState(() =>
    searchParams.get("subscription") === "cancelled"
      ? "Η πληρωμή ακυρώθηκε. Μπορείτε να επιλέξετε ξανά πλάνο όταν είστε έτοιμοι."
      : "",
  );

  const startCheckout = async (plan: PartnerPlan) => {
    setMessage("");

    if (plan.salesOnly) {
      setMessage("Για το πλάνο Γραφεία / Ομάδες, στείλτε αίτημα συνεργασίας και η ομάδα θα σας προτείνει την κατάλληλη εγκατάσταση.");
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const returnUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/for-lawyers/portal?view=pipeline`
          : "/for-lawyers/portal?view=pipeline";
      const cancelUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/for-lawyers/plans`
          : "/for-lawyers/plans";
      const result = await createPartnerSubscriptionCheckoutSession(
        plan.id,
        partnerSession,
        returnUrl,
        billingInterval,
        cancelUrl,
      );
      if (result.url && typeof window !== "undefined") {
        window.location.assign(result.url);
        return;
      }
      setMessage("Το Βασικό πλάνο δεν έχει συνδρομή. Η χρέωση €7 εφαρμόζεται μόνο μετά από ολοκληρωμένη πρώτη συμβουλευτική.");
    } catch (error) {
      if (isPartnerSessionInvalidError(error)) {
        clearPartnerSession();
        setPartnerSession(null);
        setMessage("Η πρόσβαση συνεργάτη έληξε. Συνδεθείτε ξανά για να συνεχίσετε στην πληρωμή.");
        return;
      }
      setMessage("Δεν ήταν δυνατό να ανοίξει η πληρωμή συνδρομής.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <PartnerShell className="py-10 lg:py-14">
      <SEO
        title="Πλάνα συνεργασίας για δικηγόρους | Dikigoros"
        description="Βασικό, Επαγγελματικό, Πλήρες και Γραφεία / Ομάδες για ελεγμένους δικηγόρους, με καθαρές χρεώσεις, στατιστικά, προβολή και εργαλεία ροής υποθέσεων."
        path="/for-lawyers/plans"
      />
      <div>
        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Πλάνα συνεργασίας</p>
            <h1 className="mt-3 font-serif text-4xl tracking-tight text-foreground">
              Επιλέξτε τον τρόπο συνεργασίας που ταιριάζει στο γραφείο σας.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
              Το Βασικό μένει χωρίς πάγιο. Το Επαγγελματικό γίνεται η απλή αναβάθμιση προβολής και το Πλήρες δίνει οργανωμένη ροή υποθέσεων, σημειώσεις, υπενθυμίσεις και αιτήματα εγγράφων.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PlanSignal icon={ShieldCheck} label="Βασικό" value="€0 / μήνα" />
            <PlanSignal icon={LineChart} label="Επαγγελματικό" value="Από €23 / μήνα ετησίως" />
            <PlanSignal icon={Workflow} label="Πλήρες" value="Ροή υποθέσεων" />
            <PlanSignal icon={UsersRound} label="Γραφεία" value="Έως 3 δικηγόροι" />
          </div>
        </section>

        <section className="mt-8 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground">Τρόπος χρέωσης</h2>
            <p className="mt-1 text-sm text-muted-foreground">Η ετήσια επιλογή χρεώνεται για όλο το έτος και δείχνει το μηνιαίο ισοδύναμο.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-secondary/70 p-1">
            {billingOptions.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant={billingInterval === option.id ? "default" : "ghost"}
                className="rounded-md px-5 font-bold"
                onClick={() => setBillingInterval(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {partnerPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billingInterval={billingInterval}
              signedIn={Boolean(partnerSession)}
              loading={loadingPlan === plan.id}
              onCheckout={() => void startCheckout(plan)}
            />
          ))}
        </section>

        {message ? (
          <section className="mt-6 rounded-lg border border-border bg-card p-4 text-sm font-semibold text-muted-foreground">
            {message}
          </section>
        ) : null}

        <section className="mt-10 rounded-lg border border-border bg-secondary/40 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <BarChart3 className="h-5 w-5 text-primary" />
            Καθαρή εικόνα απόδοσης
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Στον πίνακα συνεργάτη βλέπετε προβολές προφίλ, εμφανίσεις στην αναζήτηση, εκκινήσεις κράτησης, πληρωμένες συμβουλευτικές, ολοκληρώσεις, αξιολογήσεις και απόδοση ανά πόλη και κατηγορία.
          </p>
        </section>
      </div>
    </PartnerShell>
  );
};

const PlanCard = ({
  plan,
  billingInterval,
  signedIn,
  loading,
  onCheckout,
}: {
  plan: PartnerPlan;
  billingInterval: PartnerBillingInterval;
  signedIn: boolean;
  loading: boolean;
  onCheckout: () => void;
}) => (
  <article
    className={
      plan.recommended
        ? "flex min-h-[520px] flex-col rounded-lg border-2 border-primary bg-card p-5 shadow-sm"
        : "flex min-h-[520px] flex-col rounded-lg border border-border bg-card p-5"
    }
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">{plan.name}</p>
        <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground">
          {getPriceLead(plan, billingInterval)}
        </h2>
        <PlanPriceDetail plan={plan} billingInterval={billingInterval} />
      </div>
      <PlanBadge plan={plan} />
    </div>

    <ul className="mt-6 space-y-3 text-sm leading-6 text-muted-foreground">
      {plan.completedConsultationFee > 0 ? (
        <PlanEntitlement enabled label={`${formatEuro(plan.completedConsultationFee)} ανά ολοκληρωμένη πρώτη συμβουλευτική`} />
      ) : null}
      {plan.includedSeats ? (
        <PlanEntitlement enabled label={`Έως ${plan.includedSeats} δικηγόροι`} />
      ) : null}
      {plan.extraSeatMonthlyPrice ? (
        <PlanEntitlement enabled label={`+${formatEuro(plan.extraSeatMonthlyPrice)} / μήνα ανά επιπλέον δικηγόρο`} />
      ) : null}
      {plan.salesOnly ? (
        <PlanEntitlement enabled label="Επικοινωνήστε για πολλές πόλεις ή προσαρμοσμένη εγκατάσταση." />
      ) : null}
      <PlanEntitlement enabled={plan.entitlements.verifiedListing} label="Ελεγμένο δημόσιο προφίλ" />
      <PlanEntitlement enabled={plan.entitlements.bookings} label="Κρατήσεις, πληρωμές και αξιολογήσεις μετά την ολοκλήρωση" />
      <PlanEntitlement enabled={plan.entitlements.labeledVisibilityBoost} label="Ενισχυμένη προβολή με καθαρή σήμανση" />
      <PlanEntitlement enabled={plan.entitlements.enhancedAnalytics} label="Στατιστικά προφίλ, εμφανίσεις αναζήτησης και εκκινήσεις κράτησης" />
      <PlanEntitlement enabled={plan.entitlements.profileTools} label="Πιο πλήρη εργαλεία δημόσιου προφίλ" />
      <PlanEntitlement enabled={plan.entitlements.crmPipeline} label="Ροή υποθέσεων για κρατημένους, πληρωμένους και ολοκληρωμένους πελάτες" />
      <PlanEntitlement enabled={plan.entitlements.followUpTasks} label="Ιδιωτικές σημειώσεις και υπενθυμίσεις συνέχειας" />
      <PlanEntitlement enabled={plan.entitlements.documentRequests} label="Αιτήματα εγγράφων και διαχείριση υλικού" />
      <PlanEntitlement enabled={plan.entitlements.conversionAnalytics} label="Απόδοση ανά πόλη και κατηγορία" />
    </ul>

    <div className="mt-auto pt-6">
      {signedIn ? (
        plan.salesOnly ? (
          <Button asChild className="w-full rounded-lg font-bold">
            <Link to="/for-lawyers/apply">
              <Mail className="mr-2 h-4 w-4" />
              Επικοινωνία για ομάδα
            </Link>
          </Button>
        ) : (
          <Button type="button" className="w-full rounded-lg font-bold" onClick={onCheckout} disabled={loading}>
            <CreditCard className="mr-2 h-4 w-4" />
            {getCtaLabel(plan, loading)}
          </Button>
        )
      ) : (
        <Button asChild className="w-full rounded-lg font-bold">
          <Link to={plan.salesOnly ? "/for-lawyers/apply" : "/for-lawyers/login"}>
            {plan.salesOnly ? "Εκδήλωση ενδιαφέροντος" : "Σύνδεση για επιλογή πλάνου"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  </article>
);

const getPriceLead = (plan: PartnerPlan, billingInterval: PartnerBillingInterval) => {
  if (plan.salesOnly) return `από ${formatEuro(plan.monthlyPrice)} / μήνα`;
  if (billingInterval === "annual" && plan.annualMonthlyPrice) {
    return `${formatEuro(plan.annualMonthlyPrice)} / μήνα ετησίως`;
  }
  return `${formatEuro(plan.monthlyPrice)} / μήνα`;
};

const PlanPriceDetail = ({
  plan,
  billingInterval,
}: {
  plan: PartnerPlan;
  billingInterval: PartnerBillingInterval;
}) => {
  if (plan.salesOnly) {
    return <p className="mt-2 text-sm font-semibold text-muted-foreground">Δεν ανοίγει άμεση πληρωμή στην πρώτη έκδοση.</p>;
  }

  if (plan.completedConsultationFee > 0) {
    return <p className="mt-2 text-sm font-semibold text-muted-foreground">Χωρίς σταθερό κόστος δοκιμής.</p>;
  }

  if (!plan.annualMonthlyPrice) return null;

  return (
    <div className="mt-2 space-y-1 text-sm font-semibold text-muted-foreground">
      <p>
        {billingInterval === "annual"
          ? `Μηνιαία επιλογή: ${formatEuro(plan.monthlyPrice)} / μήνα`
          : `Ετήσια επιλογή: ${formatEuro(plan.annualMonthlyPrice)} / μήνα ετησίως`}
      </p>
    </div>
  );
};

const PlanBadge = ({ plan }: { plan: PartnerPlan }) => {
  if (plan.recommended) {
    return (
      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
        Πιο δημοφιλές
      </span>
    );
  }

  if (plan.salesOnly) {
    return (
      <span className="rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Για ομάδες
      </span>
    );
  }

  return null;
};

const getCtaLabel = (plan: PartnerPlan, loading: boolean) => {
  if (loading) return "Άνοιγμα πληρωμής...";
  if (plan.salesOnly) return "Επικοινωνία για ομάδα";
  if (plan.checkoutRequired) return "Συνέχεια στην πληρωμή";
  return "Χρήση Βασικού";
};

const PlanEntitlement = ({ enabled, label }: { enabled: boolean; label: string }) => (
  <li className={enabled ? "flex gap-2 text-foreground" : "flex gap-2 text-muted-foreground/70"}>
    <CheckCircle2 className={enabled ? "mt-1 h-4 w-4 shrink-0 text-sage" : "mt-1 h-4 w-4 shrink-0 text-muted-foreground/40"} />
    <span>{label}</span>
  </li>
);

const PlanSignal = ({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </p>
    <p className="mt-1 text-sm font-bold leading-5 text-foreground">{value}</p>
  </div>
);

export default ForLawyersPlans;
