import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileText,
  LockKeyhole,
  MessageSquareWarning,
  SearchCheck,
  ShieldCheck,
  Star,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import { getLawyers } from "@/lib/lawyerRepository";
import {
  getOperationalRulesByArea,
  getPaymentReadinessChecks,
  getSupplyReadiness,
  getDynamicLaunchGates,
  getBookingPaymentEvidenceChecks,
  getSupportWorkflowEvidenceChecks,
  getFunnelEventCoverage,
  supportWorkflows,
  type OperationalArea,
} from "@/lib/operations";
import {
  assignOperationalCase,
  createOperationalCase,
  fetchOperationalCasesSnapshot,
  getOperationalCaseMetrics,
  getOperationalSlaState,
  operationalAreaLabels,
  operationalPriorityLabels,
  operationalStatusLabels,
  setOperationalCaseStatus,
  type OperationalCase,
  type OperationalCaseStatus,
} from "@/lib/operationsRepository";
import {
  fetchPendingPartnerProfilePhotoSubmissions,
  reviewPartnerProfilePhotoSubmission,
  type PartnerProfilePhotoReviewItem,
} from "@/lib/partnerProfilePhotos";
import { fetchFunnelEvents, getFunnelMetrics } from "@/lib/funnelAnalytics";
import { cn } from "@/lib/utils";

const areaTabs: Array<{ area: OperationalArea; label: string; icon: LucideIcon }> = [
  { area: "payments", label: "Πληρωμές", icon: CreditCard },
  { area: "supply", label: "Πυκνότητα αγοράς", icon: UsersRound },
  { area: "verification", label: "Επαλήθευση", icon: ShieldCheck },
  { area: "reviews", label: "Έλεγχος κριτικών", icon: Star },
  { area: "bookingDisputes", label: "Θέματα κρατήσεων", icon: MessageSquareWarning },
  { area: "support", label: "Υποστήριξη", icon: SearchCheck },
  { area: "privacyDocuments", label: "Απόρρητο/έγγραφα", icon: FileText },
  { area: "security", label: "Ασφάλεια", icon: LockKeyhole },
];

const paymentChecklist = [
  "Το Stripe Checkout δημιουργεί μία διαδρομή πληρωμής για κάθε επιβεβαιωμένη κράτηση.",
  "Το συμβάν επιβεβαίωσης ενημερώνει την πληρωμή ως πληρωμένη, αποτυχημένη ή επιστραφείσα.",
  "Η επιστροφή από Stripe κρατά το πλαίσιο της κράτησης και δείχνει ανθρώπινη κατάσταση.",
  "Ο λογαριασμός δείχνει απόδειξη, επανάληψη πληρωμής και καθαρή κατάσταση.",
  "Οι επιστροφές ακολουθούν τον κανόνα υποστήριξης πριν γίνει ενέργεια στον πάροχο.",
];

const operationsQueues: Array<{ label: string; area: OperationalArea; priority: "urgent" | "high" | "normal" | "low"; summary: string }> = [
  { label: "Επείγουσες κρατήσεις", area: "bookingDisputes", priority: "urgent", summary: "Σύγκρουση ώρας, αποτυχία κράτησης, ακύρωση δικηγόρου ή μη εμφάνιση μέσα στις επόμενες 24 ώρες." },
  { label: "Αποτυχημένες πληρωμές", area: "payments", priority: "urgent", summary: "Αποτυχία Checkout, εγκαταλειμμένη πληρωμή με ασάφεια, πιθανή διπλή χρέωση ή απόδειξη που λείπει." },
  { label: "Έλεγχοι επιστροφών", area: "payments", priority: "high", summary: "Πληρωμένη ακύρωση, ακύρωση δικηγόρου, διαφωνία μη εμφάνισης ή θέμα επιστροφής στον πάροχο." },
  { label: "Έλεγχος κριτικών", area: "reviews", priority: "normal", summary: "Κριτική που χρειάζεται απόδειξη ολοκλήρωσης, έλεγχο ιδιωτικών στοιχείων, δημοσίευση, απόρριψη ή απάντηση δικηγόρου." },
  { label: "Εκκρεμής επαλήθευση", area: "verification", priority: "normal", summary: "Αίτηση συνεργάτη ή αλλαγή προφίλ που χρειάζεται έλεγχο ταυτότητας, άδειας, συλλόγου και ετοιμότητας." },
  { label: "Εκκρεμή παράπονα", area: "bookingDisputes", priority: "high", summary: "Παράπονο για δικηγόρο, ακρίβεια προφίλ, διαφωνία κράτησης ή αναφορά συμπεριφοράς." },
  { label: "Απόρρητο και ασφάλεια", area: "security", priority: "urgent", summary: "Πιθανή έκθεση εγγράφου, θέμα πρόσβασης λογαριασμού, αίτημα απορρήτου ή περιστατικό ασφάλειας." },
];

const OperationsCenter = () => {
  const [activeArea, setActiveArea] = useState<OperationalArea>("payments");
  const [funnelVersion, setFunnelVersion] = useState(0);
  const [operationsError, setOperationsError] = useState("");
  const [profilePhotoReviewActionId, setProfilePhotoReviewActionId] = useState("");
  const { data: lawyers = [] } = useQuery({ queryKey: ["lawyers"], queryFn: getLawyers });
  const { data: funnelEvents = [] } = useQuery({
    queryKey: ["funnel-events", funnelVersion],
    queryFn: fetchFunnelEvents,
  });
  const {
    data: pendingProfilePhotoSubmissions = [],
    refetch: refetchPendingProfilePhotoSubmissions,
  } = useQuery({
    queryKey: ["partner-profile-photo-submissions", activeArea],
    queryFn: fetchPendingPartnerProfilePhotoSubmissions,
    enabled: activeArea === "verification",
  });
  const {
    data: operationalCasesSnapshot = { cases: [], source: "unavailable" as const },
    refetch: refetchOperationalCases,
    isFetching: operationalCasesFetching,
  } = useQuery({
    queryKey: ["operational-cases"],
    queryFn: () => fetchOperationalCasesSnapshot(),
  });
  const operationalCases = operationalCasesSnapshot.cases;
  const operationalCasesSource = operationalCasesSnapshot.source;
  const supplyReadiness = useMemo(() => getSupplyReadiness(lawyers), [lawyers]);
  const rules = activeArea === "supply" ? [] : getOperationalRulesByArea(activeArea);
  const paymentReadinessChecks = useMemo(() => getPaymentReadinessChecks(), []);
  const activeCases = useMemo(
    () => operationalCases.filter((operationalCase) => operationalCase.area === activeArea),
    [activeArea, operationalCases],
  );
  const activeMetrics = useMemo(() => getOperationalCaseMetrics(activeCases), [activeCases]);
  const funnelMetrics = useMemo(() => getFunnelMetrics(funnelEvents), [funnelEvents]);
  const dynamicLaunchGates = useMemo(
    () =>
      getDynamicLaunchGates({
        lawyers,
        funnelEvents,
        operationalCases,
        operationalCasesSource,
      }),
    [funnelEvents, lawyers, operationalCases, operationalCasesSource],
  );
  const paymentEvidenceChecks = useMemo(() => getBookingPaymentEvidenceChecks(operationalCases), [operationalCases]);
  const supportEvidenceChecks = useMemo(() => getSupportWorkflowEvidenceChecks(operationalCases), [operationalCases]);
  const funnelCoverage = useMemo(() => getFunnelEventCoverage(funnelEvents), [funnelEvents]);
  const funnelBottleneck = useMemo(
    () =>
      funnelMetrics
        .filter((metric) => metric.conversionFromPrevious !== null)
        .sort((first, second) => (first.conversionFromPrevious || 0) - (second.conversionFromPrevious || 0))[0],
    [funnelMetrics],
  );

  useEffect(() => {
    const refreshFunnel = () => setFunnelVersion((version) => version + 1);
    window.addEventListener("dikigoros:funnel-event", refreshFunnel);
    return () => window.removeEventListener("dikigoros:funnel-event", refreshFunnel);
  }, []);

  useEffect(() => {
    const refreshCases = () => {
      void refetchOperationalCases();
    };
    window.addEventListener("dikigoros:operational-case", refreshCases);
    return () => window.removeEventListener("dikigoros:operational-case", refreshCases);
  }, [refetchOperationalCases]);

  const openOperationalCase = async (
    area: OperationalArea,
    title?: string,
    summary?: string,
    priority: "urgent" | "high" | "normal" | "low" = area === "security" || area === "payments" ? "urgent" : "normal",
  ) => {
    const rule = getOperationalRulesByArea(area)[0];
    try {
      setOperationsError("");
      await createOperationalCase({
        area,
        title: title || `Έλεγχος λειτουργίας: ${operationalAreaLabels[area]}`,
        summary: summary || rule?.trigger || "Άνοιξε λειτουργικός έλεγχος από το κέντρο παραγωγής.",
        priority,
        evidence: rule?.actions.slice(0, 2) || [],
      });
      await refetchOperationalCases();
    } catch {
      setOperationsError("Οι λειτουργίες είναι προσωρινά μη διαθέσιμες. Δεν δημιουργήθηκε τοπική υπόθεση.");
    }
  };

  const updateCaseStatus = async (caseId: string, status: OperationalCaseStatus, note?: string) => {
    try {
      setOperationsError("");
      await setOperationalCaseStatus(caseId, status, note);
      await refetchOperationalCases();
    } catch {
      setOperationsError("Η ενημέρωση υπόθεσης είναι προσωρινά μη διαθέσιμη από το σύστημα.");
    }
  };

  const assignCase = async (caseId: string, owner: string) => {
    try {
      setOperationsError("");
      await assignOperationalCase(caseId, owner);
      await refetchOperationalCases();
    } catch {
      setOperationsError("Η ανάθεση υπόθεσης είναι προσωρινά μη διαθέσιμη από το σύστημα.");
    }
  };

  const reviewProfilePhoto = async (submissionId: string, status: "approved" | "rejected") => {
    try {
      setOperationsError("");
      setProfilePhotoReviewActionId(submissionId);
      await reviewPartnerProfilePhotoSubmission(
        submissionId,
        status,
        status === "approved"
          ? "Η φωτογραφία εγκρίθηκε για δημόσια εμφάνιση."
          : "Η φωτογραφία δεν πληροί τα κριτήρια δημόσιας εμφάνισης.",
      );
      await refetchPendingProfilePhotoSubmissions();
      await refetchOperationalCases();
    } catch {
      setOperationsError("Η έγκριση φωτογραφίας είναι προσωρινά μη διαθέσιμη από το σύστημα.");
    } finally {
      setProfilePhotoReviewActionId("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Κέντρο λειτουργίας | Dikigoros"
        description="Λειτουργικές ροές για πληρωμές, πυκνότητα προσφοράς, επαλήθευση, κριτικές, κρατήσεις, υποστήριξη, απόρρητο, έγγραφα και ασφάλεια."
        path="/operations"
      />
      <Navbar />
      <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Κέντρο λειτουργίας</p>
            <h1 className="mt-3 font-serif text-4xl tracking-tight text-foreground">Έλεγχος launch και καθημερινών υποθέσεων</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
              Συγκεκριμένοι κανόνες για πληρωμές, δημόσια εικόνα πλατφόρμας, πυκνότητα προσφοράς, επαλήθευση, κριτικές, διαφωνίες, υποστήριξη, απόρρητο και ασφάλεια.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-lg font-bold">
                <Link to="/trust/verification-standards">
                  Κέντρο εμπιστοσύνης
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-lg font-bold">
                <Link to="/help">Κέντρο υποστήριξης</Link>
              </Button>
            </div>
          </section>

          <aside className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-bold text-foreground">Στιγμιότυπο ετοιμότητας launch</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ReadinessMetric label="Δημόσια προφίλ" value={String(lawyers.length)} ready={lawyers.length >= 10} notReadyLabel="Χρειάζεται προσφορά" />
              <ReadinessMetric label="Έτοιμες πόλεις" value={`${supplyReadiness.filter((city) => city.ready).length}/${supplyReadiness.length}`} ready={supplyReadiness.some((city) => city.ready)} notReadyLabel="Χρειάζεται προσφορά" />
              <ReadinessMetric label="Ανοιχτές υποθέσεις" value={String(getOperationalCaseMetrics(operationalCases).open)} ready={getOperationalCaseMetrics(operationalCases).overdue === 0} />
              <ReadinessMetric label="Μοντέλο πληρωμής" value="Πλήρης πληρωμή" ready={paymentReadinessChecks.every((check) => check.ready)} />
              <ReadinessMetric label="Συμβάντα διαδρομής" value={String(funnelMetrics.reduce((sum, metric) => sum + metric.count, 0))} ready={funnelMetrics.some((metric) => metric.count > 0)} notReadyLabel="Χωρίς δεδομένα" />
              <ReadinessMetric
                label="Πηγή λειτουργίας"
                value={operationalCasesFetching ? "Συγχρονισμός" : operationalCasesSource === "backend" ? "Σύστημα" : "Μη διαθέσιμο"}
                ready={!operationalCasesFetching && operationalCasesSource === "backend"}
                notReadyLabel={operationalCasesFetching ? "Συγχρονισμός" : "Σύστημα μη διαθέσιμο"}
              />
            </div>
          </aside>
        </div>

        {operationsError ? (
          <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
            {operationsError}
          </div>
        ) : null}

        <section className="mt-10 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Διαδρομή πλατφόρμας</p>
              <h2 className="mt-2 text-xl font-bold text-foreground">Πού κερδίζεται ή χάνεται η ζήτηση</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Γεγονότα πρώτου μέρους από τη δημόσια διαδρομή, την κράτηση, τις κριτικές και την ένταξη δικηγόρων.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm font-bold text-foreground">
              Σημείο απώλειας: {funnelBottleneck ? `${funnelBottleneck.label} (${funnelBottleneck.conversionFromPrevious}%)` : "αναμονή δεδομένων"}
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {funnelMetrics.map((metric) => (
              <div key={metric.name} className="rounded-lg border border-border bg-background p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{metric.count}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  {metric.conversionFromPrevious === null ? "Αφετηρία ή χωρίς προηγούμενο βήμα" : `${metric.conversionFromPrevious}% από το προηγούμενο βήμα`}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 flex gap-2 overflow-x-auto pb-1">
          {areaTabs.map(({ area, label, icon: Icon }) => (
            <button
              key={area}
              type="button"
              onClick={() => setActiveArea(area)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition",
                activeArea === area
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/25",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {activeArea === "supply" ? (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {supplyReadiness.map((city) => (
              <article key={city.label} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{city.label}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {city.count}/{city.minimumVerified} επαληθευμένα κρατήσιμα προφίλ
                    </p>
                  </div>
                  <StatusBadge ready={city.ready} />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {city.categories.map((category) => (
                    <div key={category.label} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-foreground">{category.label}</p>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">{category.count}/2 κάλυψη δικαίου</p>
                        </div>
                        <StatusBadge ready={category.ready} />
                      </div>
                      {!category.ready ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void openOperationalCase(
                              "supply",
                              `Κενό προσφοράς: ${city.label} - ${category.label}`,
                              `Χρειάζονται αρκετοί επαληθευμένοι και κρατήσιμοι δικηγόροι για ${category.label.toLowerCase()} στην πόλη ${city.label}. Τρέχουσα κάλυψη: ${category.count}/2.`,
                              "high",
                            )
                          }
                          className="mt-3 h-8 rounded-lg text-xs font-bold"
                        >
                          Άνοιγμα υπόθεσης προσφοράς
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
            <div className="space-y-4">
              {activeArea === "verification" ? (
                <ProfilePhotoReviewQueue
                  submissions={pendingProfilePhotoSubmissions}
                  actionId={profilePhotoReviewActionId}
                  onApprove={(submissionId) => void reviewProfilePhoto(submissionId, "approved")}
                  onReject={(submissionId) => void reviewProfilePhoto(submissionId, "rejected")}
                />
              ) : null}

              {rules.map((rule) => (
                <article key={rule.title} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{rule.title}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">Υπεύθυνος: {rule.owner} · Χρόνος: {rule.sla}</p>
                    </div>
                    <StatusBadge ready />
                  </div>
                  <p className="mt-4 rounded-lg bg-secondary/50 px-3 py-2 text-sm font-semibold text-foreground">
                    Πότε ανοίγει: {rule.trigger}
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <RuleDetail title="Στοιχεία" items={rule.evidenceNeeded} />
                    <RuleDetail title="Τι βλέπει ο χρήστης" items={[rule.userOutcome]} />
                    <RuleDetail title="Κλιμάκωση" items={[rule.escalation]} />
                  </div>
                  <p className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground">
                    Κλείνει όταν: {rule.closeCondition}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {rule.actions.map((action) => (
                      <li key={action} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                        <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-sage" />
                        {action}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground">
                    Κείμενο προς χρήστη: {rule.clientCopy}
                  </p>
                </article>
              ))}
            </div>

            <aside className="rounded-lg border border-border bg-card p-5 lg:sticky lg:top-24 lg:self-start">
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Λειτουργικοί κανόνες
              </h2>
              <div className="mt-4 space-y-3">
                {(activeArea === "payments" ? paymentChecklist : [
                  "Κάθε υπόθεση έχει υπεύθυνο και χρόνο απόκρισης.",
                  "Το κείμενο προς τον χρήστη μένει ανθρώπινο και κατανοητό.",
                  "Τα στοιχεία και οι αλλαγές κατάστασης καταγράφονται.",
                  "Θέματα απορρήτου ή ασφάλειας κλιμακώνονται άμεσα.",
                  "Οι δημόσιοι ισχυρισμοί πρέπει να συμφωνούν με την πραγματική συμπεριφορά της πλατφόρμας.",
                ]).map((item) => (
                  <p key={item} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                    <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-sage" />
                    {item}
                  </p>
                ))}
              </div>
              {activeArea === "payments" ? (
                <div className="mt-5 border-t border-border pt-5">
                  <h3 className="text-sm font-bold text-foreground">Κανόνες πληρωμών παραγωγής</h3>
                  <div className="mt-3 space-y-2">
                    {paymentReadinessChecks.map((check) => (
                      <ReadinessCheck key={check.label} check={check} />
                    ))}
                  </div>
                </div>
              ) : null}
              <Button
                type="button"
                onClick={() => void openOperationalCase(activeArea)}
                className="mt-5 w-full rounded-lg font-bold"
              >
                Άνοιγμα υπόθεσης: {operationalAreaLabels[activeArea]}
              </Button>
            </aside>
          </section>
        )}

        <section className="mt-8 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
          <aside className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Ουρά εργασίας</p>
            <h2 className="mt-2 text-xl font-bold text-foreground">{operationalAreaLabels[activeArea]}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ReadinessMetric label="Ανοιχτές" value={String(activeMetrics.open)} ready={activeMetrics.overdue === 0} />
              <ReadinessMetric label="Επείγουσες" value={String(activeMetrics.urgent)} ready={activeMetrics.urgent === 0} />
              <ReadinessMetric label="Εκπρόθεσμες" value={String(activeMetrics.overdue)} ready={activeMetrics.overdue === 0} />
              <ReadinessMetric label="Κλειστές" value={String(activeMetrics.closed)} ready />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void openOperationalCase(activeArea)}
              className="mt-4 w-full rounded-lg font-bold"
            >
              Νέα υπόθεση
            </Button>
          </aside>

          <div className="space-y-3">
            {activeCases.length > 0 ? (
              activeCases.map((operationalCase) => (
                <OperationalCaseCard
                  key={operationalCase.id}
                  operationalCase={operationalCase}
                  onAssign={() => void assignCase(operationalCase.id, operationalCase.owner || defaultQueueOwner(activeArea))}
                  onStatus={(status) =>
                    void updateCaseStatus(
                      operationalCase.id,
                      status,
                      status === "resolved" ? "Έκλεισε από το κέντρο λειτουργίας." : undefined,
                    )
                  }
                />
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm leading-6 text-muted-foreground">
                Δεν υπάρχουν ενεργές υποθέσεις σε αυτή την περιοχή. Ανοίξτε υπόθεση όταν κανόνας launch, αίτημα υποστήριξης, διαφωνία, θέμα επαλήθευσης, κριτική, αίτημα απορρήτου ή θέμα ασφάλειας χρειάζεται υπεύθυνο.
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Ουρές παραγωγής</p>
              <h2 className="mt-2 text-xl font-bold text-foreground">Εργασία που δεν πρέπει να αυτοσχεδιάζεται</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Επιστροφές, έλεγχος περιεχομένου, επαλήθευση, παράπονα, απόρρητο και εξαιρέσεις κράτησης έχουν ξεχωριστές ουρές με υπεύθυνους και χρόνους απόκρισης.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {operationsQueues.map((queue) => (
              <article key={queue.label} className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-bold text-foreground">{queue.label}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{operationalAreaLabels[queue.area]} · {operationalPriorityLabels[queue.priority]}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{queue.summary}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void openOperationalCase(queue.area, queue.label, queue.summary, queue.priority)}
                  className="mt-3 rounded-lg text-xs font-bold"
                >
                  Άνοιγμα υπόθεσης ουράς
                </Button>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Ροές υποστήριξης</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">Υπεύθυνος, χρόνος απόκρισης, στοιχεία, κλιμάκωση και κλείσιμο</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {supportWorkflows.map((workflow) => (
              <article key={workflow.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <h3 className="text-sm font-bold text-foreground">{workflow.label}</h3>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{workflow.owner}</span>
                </div>
                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-primary">{workflow.sla}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{workflow.userFacingResponse}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">Στοιχεία: {workflow.requiredEvidence.join(", ")}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">Κλιμάκωση: {workflow.escalationRule}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">Κλείνει όταν: {workflow.closeCondition}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Κανόνες launch</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">Η ετοιμότητα είναι checklist, όχι αίσθηση</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {dynamicLaunchGates.map((gate) => (
              <article key={gate.label} className="rounded-lg border border-border bg-background p-4">
                <StatusBadge ready={gate.ready} notReadyLabel="Ανοιχτός κανόνας" />
                <h3 className="mt-3 text-sm font-bold text-foreground">{gate.label}</h3>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Υπεύθυνος: {gate.owner}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{gate.evidence}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Αποδείξεις που απαιτούνται</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">Τι πρέπει να αποδειχθεί από το σύστημα</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <EvidenceGroup
              title="Κράτηση και πληρωμή"
              items={paymentEvidenceChecks.map((check) => ({
                label: check.label,
                ready: check.ready,
                detail: check.ready ? "Βρέθηκε κλειστή υπόθεση απόδειξης" : "Χρειάζεται κλειστή υπόθεση απόδειξης παραγωγής ή δοκιμής",
              }))}
            />
            <EvidenceGroup
              title="Ροές υποστήριξης"
              items={supportEvidenceChecks.map((check) => ({
                label: check.label,
                ready: check.ready,
                detail: check.ready ? "Η ροή έχει κλειστή υπόθεση" : "Χρειάζεται κλείσιμο υπόθεσης παραγωγής ή δοκιμής",
              }))}
            />
            <EvidenceGroup
              title="Συμβάντα διαδρομής"
              items={[
                ...funnelCoverage.checks.map((check) => ({
                  label: check.eventName,
                  ready: check.ready,
                  detail: `${check.count} συμβάντα`,
                })),
                {
                  label: "Παράθυρο δεδομένων 7 ημερών",
                  ready: funnelCoverage.observedDays >= 7,
                  detail: `${funnelCoverage.observedDays.toFixed(1)} ημέρες παρατήρησης`,
                },
              ]}
            />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const formatPhotoSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const ProfilePhotoReviewQueue = ({
  submissions,
  actionId,
  onApprove,
  onReject,
}: {
  submissions: PartnerProfilePhotoReviewItem[];
  actionId: string;
  onApprove: (submissionId: string) => void;
  onReject: (submissionId: string) => void;
}) => (
  <article className="rounded-lg border border-border bg-card p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Φωτογραφίες προφίλ</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">Έγκριση πριν από δημόσια εμφάνιση</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Η τρέχουσα δημόσια φωτογραφία δεν αλλάζει μέχρι να εγκριθεί η υποβολή.
        </p>
      </div>
      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
        {submissions.length} σε αναμονή
      </span>
    </div>

    <div className="mt-5 space-y-3">
      {submissions.length > 0 ? (
        submissions.map((submission) => {
          const loading = actionId === submission.id;

          return (
            <div key={submission.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 gap-4">
                  <img
                    src={submission.candidatePublicUrl}
                    alt="Φωτογραφία προς έγκριση"
                    className="h-24 w-24 shrink-0 rounded-lg object-cover ring-1 ring-border"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{submission.fileName}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {submission.lawyerId} · {submission.partnerEmail}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {formatPhotoSize(submission.size)} · {new Date(submission.submittedAt).toLocaleDateString("el-GR")}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onApprove(submission.id)}
                    disabled={loading}
                    className="rounded-lg text-xs font-bold"
                  >
                    Έγκριση
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onReject(submission.id)}
                    disabled={loading}
                    className="rounded-lg text-xs font-bold"
                  >
                    Απόρριψη
                  </Button>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
          Δεν υπάρχουν φωτογραφίες προφίλ σε αναμονή έγκρισης.
        </div>
      )}
    </div>
  </article>
);

const ReadinessMetric = ({ label, value, ready, notReadyLabel = "Χρειάζεται δουλειά" }: { label: string; value: string; ready: boolean; notReadyLabel?: string }) => (
  <div className="rounded-lg border border-border bg-background p-4">
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    <div className="mt-2">
      <StatusBadge ready={ready} notReadyLabel={notReadyLabel} />
    </div>
  </div>
);

const RuleDetail = ({ title, items }: { title: string; items: string[] }) => (
  <div className="rounded-lg border border-border bg-background p-3">
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li key={item} className="text-xs font-semibold leading-5 text-muted-foreground">{item}</li>
      ))}
    </ul>
  </div>
);

const StatusBadge = ({ ready, notReadyLabel = "Χρειάζεται προσφορά" }: { ready: boolean; notReadyLabel?: string }) => (
  <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold", ready ? "bg-sage/15 text-sage-foreground" : "bg-secondary text-muted-foreground")}>
    {ready ? "Λειτουργεί" : notReadyLabel}
  </span>
);

const defaultQueueOwner = (area: OperationalArea) =>
  getOperationalRulesByArea(area)[0]?.owner || (area === "supply" ? "Υπεύθυνος προσφοράς αγοράς" : "Υπεύθυνος λειτουργίας");

const ReadinessCheck = ({ check }: { check: ReturnType<typeof getPaymentReadinessChecks>[number] }) => (
  <div className="rounded-lg border border-border bg-background p-3">
    <div className="flex items-start gap-2">
      {check.ready ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      )}
      <div>
        <p className="text-sm font-bold text-foreground">{check.label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{check.detail}</p>
      </div>
    </div>
  </div>
);

const EvidenceGroup = ({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; ready: boolean; detail: string }>;
}) => (
  <article className="rounded-lg border border-border bg-background p-4">
    <h3 className="text-sm font-bold text-foreground">{title}</h3>
    <div className="mt-3 space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-3 rounded-lg bg-secondary/35 px-3 py-2">
          <div>
            <p className="text-xs font-bold text-foreground">{item.label}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{item.detail}</p>
          </div>
          <StatusBadge ready={item.ready} notReadyLabel="Λείπει" />
        </div>
      ))}
    </div>
  </article>
);

const slaBadgeClasses: Record<ReturnType<typeof getOperationalSlaState>, string> = {
  closed: "bg-sage/15 text-sage-foreground",
  overdue: "bg-destructive/10 text-destructive",
  due_soon: "bg-primary/10 text-primary",
  on_track: "bg-secondary text-muted-foreground",
};

const slaBadgeLabels: Record<ReturnType<typeof getOperationalSlaState>, string> = {
  closed: "Κλειστή",
  overdue: "Εκπρόθεσμη",
  due_soon: "Λήγει σύντομα",
  on_track: "Εντός χρόνου",
};

const OperationalCaseCard = ({
  operationalCase,
  onAssign,
  onStatus,
}: {
  operationalCase: OperationalCase;
  onAssign: () => void;
  onStatus: (status: OperationalCaseStatus) => void;
}) => {
  const slaState = getOperationalSlaState(operationalCase);
  const dueLabel = new Intl.DateTimeFormat("el-GR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(operationalCase.slaDueAt));

  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
              {operationalCase.referenceId}
            </span>
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", slaBadgeClasses[slaState])}>
              {slaBadgeLabels[slaState]}
            </span>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
              {operationalPriorityLabels[operationalCase.priority]}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-foreground">{operationalCase.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{operationalCase.summary}</p>
        </div>
        <div className="min-w-[190px] rounded-lg border border-border bg-background p-3 text-sm">
          <p className="font-bold text-foreground">{operationalStatusLabels[operationalCase.status]}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Υπεύθυνος: {operationalCase.owner}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Προθεσμία: {dueLabel}</p>
        </div>
      </div>

      {operationalCase.evidence.length > 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {operationalCase.evidence.slice(0, 4).map((item) => (
            <p key={item} className="rounded-lg bg-secondary/45 px-3 py-2 text-xs font-semibold leading-5 text-muted-foreground">
              {item}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onAssign} className="rounded-lg text-xs font-bold">
          Ανάθεση υπεύθυνου
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onStatus("in_review")} className="rounded-lg text-xs font-bold">
          Έναρξη ελέγχου
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onStatus("waiting_evidence")} className="rounded-lg text-xs font-bold">
          Αναμονή στοιχείων
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onStatus("escalated")} className="rounded-lg text-xs font-bold">
          Κλιμάκωση
        </Button>
        <Button type="button" size="sm" onClick={() => onStatus("resolved")} className="rounded-lg text-xs font-bold">
          Κλείσιμο
        </Button>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Τελευταία ενέργεια</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {operationalCase.timeline[0]?.action}
          {operationalCase.timeline[0]?.note ? ` · ${operationalCase.timeline[0].note}` : ""}
        </p>
      </div>
    </article>
  );
};

export default OperationsCenter;
