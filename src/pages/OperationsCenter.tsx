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
  launchGates,
  supportWorkflows,
  type OperationalArea,
} from "@/lib/operations";
import {
  assignOperationalCase,
  createOperationalCase,
  fetchOperationalCases,
  getOperationalCaseMetrics,
  getOperationalSlaState,
  operationalAreaLabels,
  operationalPriorityLabels,
  operationalStatusLabels,
  setOperationalCaseStatus,
  type OperationalCase,
  type OperationalCaseStatus,
} from "@/lib/operationsRepository";
import { fetchFunnelEvents, getFunnelMetrics } from "@/lib/funnelAnalytics";
import { cn } from "@/lib/utils";

const areaTabs: Array<{ area: OperationalArea; label: string; icon: LucideIcon }> = [
  { area: "payments", label: "Payments", icon: CreditCard },
  { area: "supply", label: "Supply density", icon: UsersRound },
  { area: "verification", label: "Verification", icon: ShieldCheck },
  { area: "reviews", label: "Review moderation", icon: Star },
  { area: "bookingDisputes", label: "Booking disputes", icon: MessageSquareWarning },
  { area: "support", label: "Support", icon: SearchCheck },
  { area: "privacyDocuments", label: "Privacy/documents", icon: FileText },
  { area: "security", label: "Security", icon: LockKeyhole },
];

const paymentChecklist = [
  "Stripe Checkout creates one payment session per confirmed booking.",
  "Webhook marks booking payment paid, failed, or refunded in booking_payments.",
  "Booking page returns from Stripe with booking context and human-readable status.",
  "Account payments tab exposes receipt, retry payment, and payment state.",
  "Refund decisions follow support policy before processor action.",
];

const operationsQueues: Array<{ label: string; area: OperationalArea; priority: "urgent" | "high" | "normal" | "low"; summary: string }> = [
  { label: "Urgent bookings", area: "bookingDisputes", priority: "urgent", summary: "Slot conflict, booking failure, lawyer cancellation, or no-show within 24 hours." },
  { label: "Failed payments", area: "payments", priority: "urgent", summary: "Checkout failed, payment abandoned with confusion, duplicate-charge concern, or missing receipt." },
  { label: "Refund reviews", area: "payments", priority: "high", summary: "Paid cancellation, lawyer cancellation, no-show dispute, or processor refund issue." },
  { label: "Review moderation", area: "reviews", priority: "normal", summary: "Submitted review needs completion proof, private-detail screening, publication, rejection, or lawyer reply handling." },
  { label: "Verification pending", area: "verification", priority: "normal", summary: "Partner application or profile change needs identity, license, bar association, and readiness check." },
  { label: "Complaints pending", area: "bookingDisputes", priority: "high", summary: "Complaint against lawyer, profile accuracy issue, booking disagreement, or behavior report." },
  { label: "Privacy/security pending", area: "security", priority: "urgent", summary: "Document exposure, account access concern, privacy request, or security incident." },
];

const OperationsCenter = () => {
  const [activeArea, setActiveArea] = useState<OperationalArea>("payments");
  const [funnelVersion, setFunnelVersion] = useState(0);
  const { data: lawyers = [] } = useQuery({ queryKey: ["lawyers"], queryFn: getLawyers });
  const { data: funnelEvents = [] } = useQuery({
    queryKey: ["funnel-events", funnelVersion],
    queryFn: fetchFunnelEvents,
  });
  const {
    data: operationalCases = [],
    refetch: refetchOperationalCases,
    isFetching: operationalCasesFetching,
  } = useQuery({
    queryKey: ["operational-cases"],
    queryFn: () => fetchOperationalCases(),
  });
  const supplyReadiness = useMemo(() => getSupplyReadiness(lawyers), [lawyers]);
  const rules = activeArea === "supply" ? [] : getOperationalRulesByArea(activeArea);
  const paymentReadinessChecks = useMemo(() => getPaymentReadinessChecks(), []);
  const activeCases = useMemo(
    () => operationalCases.filter((operationalCase) => operationalCase.area === activeArea),
    [activeArea, operationalCases],
  );
  const activeMetrics = useMemo(() => getOperationalCaseMetrics(activeCases), [activeCases]);
  const funnelMetrics = useMemo(() => getFunnelMetrics(funnelEvents), [funnelEvents]);
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
    await createOperationalCase({
      area,
      title: title || `${operationalAreaLabels[area]} operations review`,
      summary: summary || rule?.trigger || "Operational review opened from the production control center.",
      priority,
      evidence: rule?.actions.slice(0, 2) || [],
    });
    await refetchOperationalCases();
  };

  const updateCaseStatus = async (caseId: string, status: OperationalCaseStatus, note?: string) => {
    await setOperationalCaseStatus(caseId, status, note);
    await refetchOperationalCases();
  };

  const assignCase = async (caseId: string, owner: string) => {
    await assignOperationalCase(caseId, owner);
    await refetchOperationalCases();
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Production operations | Dikigoros"
        description="Operational workflows for live payments, supply density, verification, reviews, booking disputes, support, privacy, documents, and security."
        path="/operations"
      />
      <Navbar />
      <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Production operations</p>
            <h1 className="mt-3 font-serif text-4xl tracking-tight text-foreground">National launch control center</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
              Concrete operating rules for payments, public truth, supply density, verification, reviews, disputes, support, privacy, and security.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-lg font-bold">
                <Link to="/trust/verification-standards">
                  Public trust center
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-lg font-bold">
                <Link to="/help">Support center</Link>
              </Button>
            </div>
          </section>

          <aside className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-bold text-foreground">Launch readiness snapshot</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ReadinessMetric label="Public profiles" value={String(lawyers.length)} ready={lawyers.length >= 10} notReadyLabel="Needs supply" />
              <ReadinessMetric label="Core cities ready" value={`${supplyReadiness.filter((city) => city.ready).length}/${supplyReadiness.length}`} ready={supplyReadiness.some((city) => city.ready)} notReadyLabel="Needs supply" />
              <ReadinessMetric label="Open ops cases" value={String(getOperationalCaseMetrics(operationalCases).open)} ready={getOperationalCaseMetrics(operationalCases).overdue === 0} />
              <ReadinessMetric label="Payment model" value="Full payment" ready={paymentReadinessChecks.every((check) => check.ready)} />
              <ReadinessMetric label="Funnel events" value={String(funnelMetrics.reduce((sum, metric) => sum + metric.count, 0))} ready={funnelMetrics.some((metric) => metric.count > 0)} notReadyLabel="No data" />
              <ReadinessMetric label="Ops source" value={operationalCasesFetching ? "Syncing" : "Backend"} ready={!operationalCasesFetching} notReadyLabel="Syncing" />
            </div>
          </aside>
        </div>

        <section className="mt-10 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Marketplace funnel</p>
              <h2 className="mt-2 text-xl font-bold text-foreground">Where demand is being won or lost</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                First-party events from the public journey, booking flow, reviews, and lawyer onboarding.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm font-bold text-foreground">
              Bottleneck: {funnelBottleneck ? `${funnelBottleneck.label} (${funnelBottleneck.conversionFromPrevious}%)` : "waiting for data"}
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
                      {city.count}/{city.minimumVerified} verified bookable profiles
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
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">{category.count}/2 category coverage</p>
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
                              `${city.label} ${category.label} supply gap`,
                              `Recruit and verify enough bookable ${category.label.toLowerCase()} lawyers in ${city.label}. Current coverage is ${category.count}/2.`,
                              "high",
                            )
                          }
                          className="mt-3 h-8 rounded-lg text-xs font-bold"
                        >
                          Open supply case
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
              {rules.map((rule) => (
                <article key={rule.title} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{rule.title}</h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">Owner: {rule.owner} - SLA: {rule.sla}</p>
                    </div>
                    <StatusBadge ready />
                  </div>
                  <p className="mt-4 rounded-lg bg-secondary/50 px-3 py-2 text-sm font-semibold text-foreground">
                    Trigger: {rule.trigger}
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <RuleDetail title="Evidence" items={rule.evidenceNeeded} />
                    <RuleDetail title="User outcome" items={[rule.userOutcome]} />
                    <RuleDetail title="Escalation" items={[rule.escalation]} />
                  </div>
                  <p className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground">
                    Close condition: {rule.closeCondition}
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
                    Client copy: {rule.clientCopy}
                  </p>
                </article>
              ))}
            </div>

            <aside className="rounded-lg border border-border bg-card p-5 lg:sticky lg:top-24 lg:self-start">
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Operational gates
              </h2>
              <div className="mt-4 space-y-3">
                {(activeArea === "payments" ? paymentChecklist : [
                  "Every case has an owner and SLA.",
                  "Client-facing copy stays human-readable.",
                  "Evidence and status changes are recorded.",
                  "Privacy or security concerns escalate immediately.",
                  "Public claims must match live marketplace behavior.",
                ]).map((item) => (
                  <p key={item} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                    <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-sage" />
                    {item}
                  </p>
                ))}
              </div>
              {activeArea === "payments" ? (
                <div className="mt-5 border-t border-border pt-5">
                  <h3 className="text-sm font-bold text-foreground">Live payment gates</h3>
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
                Open {operationalAreaLabels[activeArea].toLowerCase()} case
              </Button>
            </aside>
          </section>
        )}

        <section className="mt-8 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
          <aside className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Workflow queue</p>
            <h2 className="mt-2 text-xl font-bold text-foreground">{operationalAreaLabels[activeArea]}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ReadinessMetric label="Open" value={String(activeMetrics.open)} ready={activeMetrics.overdue === 0} />
              <ReadinessMetric label="Urgent" value={String(activeMetrics.urgent)} ready={activeMetrics.urgent === 0} />
              <ReadinessMetric label="Overdue" value={String(activeMetrics.overdue)} ready={activeMetrics.overdue === 0} />
              <ReadinessMetric label="Closed" value={String(activeMetrics.closed)} ready />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void openOperationalCase(activeArea)}
              className="mt-4 w-full rounded-lg font-bold"
            >
              New case
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
                      status === "resolved" ? "Resolved from the operations center." : undefined,
                    )
                  }
                />
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm leading-6 text-muted-foreground">
                No active cases for this area. Open one when a launch gate, support request, dispute, verification issue, review flag, privacy request, or security concern needs ownership.
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Production queues</p>
              <h2 className="mt-2 text-xl font-bold text-foreground">Work that cannot be improvised</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Refunds, moderation, verification, complaints, privacy, and booking exceptions have dedicated queues with owners and SLAs.
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
                  Open queue case
                </Button>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Support workflows</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">Owner, SLA, evidence, escalation, close condition</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {supportWorkflows.map((workflow) => (
              <article key={workflow.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <h3 className="text-sm font-bold text-foreground">{workflow.label}</h3>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{workflow.owner}</span>
                </div>
                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-primary">{workflow.sla}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{workflow.userFacingResponse}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">Evidence: {workflow.requiredEvidence.join(", ")}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">Escalation: {workflow.escalationRule}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">Close: {workflow.closeCondition}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Hard launch gates</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">Ready is a checklist, not a feeling</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {launchGates.map((gate) => (
              <article key={gate.label} className="rounded-lg border border-border bg-background p-4">
                <StatusBadge ready={gate.ready} notReadyLabel="Gate open" />
                <h3 className="mt-3 text-sm font-bold text-foreground">{gate.label}</h3>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Owner: {gate.owner}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{gate.evidence}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const ReadinessMetric = ({ label, value, ready, notReadyLabel = "Needs work" }: { label: string; value: string; ready: boolean; notReadyLabel?: string }) => (
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

const StatusBadge = ({ ready, notReadyLabel = "Needs supply" }: { ready: boolean; notReadyLabel?: string }) => (
  <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold", ready ? "bg-sage/15 text-sage-foreground" : "bg-secondary text-muted-foreground")}>
    {ready ? "Operational" : notReadyLabel}
  </span>
);

const defaultQueueOwner = (area: OperationalArea) =>
  getOperationalRulesByArea(area)[0]?.owner || (area === "supply" ? "Marketplace supply lead" : "Operations lead");

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

const slaBadgeClasses: Record<ReturnType<typeof getOperationalSlaState>, string> = {
  closed: "bg-sage/15 text-sage-foreground",
  overdue: "bg-destructive/10 text-destructive",
  due_soon: "bg-primary/10 text-primary",
  on_track: "bg-secondary text-muted-foreground",
};

const slaBadgeLabels: Record<ReturnType<typeof getOperationalSlaState>, string> = {
  closed: "Closed",
  overdue: "Overdue",
  due_soon: "Due soon",
  on_track: "On track",
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
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Owner: {operationalCase.owner}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">SLA due: {dueLabel}</p>
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
          Assign owner
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onStatus("in_review")} className="rounded-lg text-xs font-bold">
          Start review
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onStatus("waiting_evidence")} className="rounded-lg text-xs font-bold">
          Need evidence
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onStatus("escalated")} className="rounded-lg text-xs font-bold">
          Escalate
        </Button>
        <Button type="button" size="sm" onClick={() => onStatus("resolved")} className="rounded-lg text-xs font-bold">
          Resolve
        </Button>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Latest activity</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {operationalCase.timeline[0]?.action}
          {operationalCase.timeline[0]?.note ? ` - ${operationalCase.timeline[0].note}` : ""}
        </p>
      </div>
    </article>
  );
};

export default OperationsCenter;
