import { useMemo, useState } from "react";
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
import { getLawyers } from "@/lib/lawyerRepository";
import {
  getOperationalRulesByArea,
  getPaymentReadinessChecks,
  getSupplyReadiness,
  type OperationalArea,
} from "@/lib/operations";
import {
  assignOperationalCase,
  createOperationalCase,
  getOperationalCaseMetrics,
  getOperationalCases,
  getOperationalSlaState,
  operationalAreaLabels,
  operationalPriorityLabels,
  operationalStatusLabels,
  setOperationalCaseStatus,
  type OperationalCase,
  type OperationalCaseStatus,
} from "@/lib/operationsRepository";
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

const OperationsCenter = () => {
  const [activeArea, setActiveArea] = useState<OperationalArea>("payments");
  const [caseVersion, setCaseVersion] = useState(0);
  const { data: lawyers = [] } = useQuery({ queryKey: ["lawyers"], queryFn: getLawyers });
  const supplyReadiness = useMemo(() => getSupplyReadiness(lawyers), [lawyers]);
  const rules = activeArea === "supply" ? [] : getOperationalRulesByArea(activeArea);
  const paymentReadinessChecks = useMemo(() => getPaymentReadinessChecks(), []);
  const operationalCases = useMemo(() => getOperationalCases(), [caseVersion]);
  const activeCases = useMemo(
    () => operationalCases.filter((operationalCase) => operationalCase.area === activeArea),
    [activeArea, operationalCases],
  );
  const activeMetrics = useMemo(() => getOperationalCaseMetrics(activeCases), [activeCases]);

  const refreshCases = () => setCaseVersion((version) => version + 1);

  const openOperationalCase = (
    area: OperationalArea,
    title?: string,
    summary?: string,
    priority: "urgent" | "high" | "normal" | "low" = area === "security" || area === "payments" ? "urgent" : "normal",
  ) => {
    const rule = getOperationalRulesByArea(area)[0];
    createOperationalCase({
      area,
      title: title || `${operationalAreaLabels[area]} operations review`,
      summary: summary || rule?.trigger || "Operational review opened from the production control center.",
      priority,
      evidence: rule?.actions.slice(0, 2) || [],
    });
    refreshCases();
  };

  const updateCaseStatus = (caseId: string, status: OperationalCaseStatus, note?: string) => {
    setOperationalCaseStatus(caseId, status, note);
    refreshCases();
  };

  const assignCase = (caseId: string, owner: string) => {
    assignOperationalCase(caseId, owner);
    refreshCases();
  };

  return (
    <div className="min-h-screen bg-background">
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
            </div>
          </aside>
        </div>

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
                            openOperationalCase(
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
                onClick={() => openOperationalCase(activeArea)}
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
              onClick={() => openOperationalCase(activeArea)}
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
                  onAssign={() => assignCase(operationalCase.id, operationalCase.owner || defaultQueueOwner(activeArea))}
                  onStatus={(status) =>
                    updateCaseStatus(
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
