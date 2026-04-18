#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const reportDir = join(rootDir, "var");
const jsonReportPath = join(reportDir, "launch-readiness-report.json");
const markdownReportPath = join(reportDir, "launch-readiness-report.md");

const requiredFunnelEvents = [
  "homepage_search",
  "search_profile_opened",
  "profile_booking_start",
  "booking_created",
  "payment_opened",
  "payment_completed",
  "consultation_completed",
  "review_submitted",
  "lawyer_application_submitted",
  "lawyer_application_approved",
  "approved_lawyer_first_completed_consultation",
];

const coreLaunchCities = [
  { label: "Αθήνα", query: "Αθήνα", minimumVerified: 8 },
  { label: "Θεσσαλονίκη", query: "Θεσσαλονίκη", minimumVerified: 5 },
  { label: "Πειραιάς", query: "Πειραιάς", minimumVerified: 3 },
  { label: "Ηράκλειο", query: "Ηράκλειο", minimumVerified: 3 },
  { label: "Πάτρα", query: "Πάτρα", minimumVerified: 3 },
];

const highIntentCategories = [
  {
    label: "Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής",
    queries: ["ενοχ", "οφειλ", "χρε", "συμβ", "διαταγ", "πληρωμ", "contract", "debt"],
  },
  { label: "Οικογενειακό δίκαιο", queries: ["οικογεν", "διαζ", "επιμελ", "διατροφ", "family", "divorce", "custody"] },
  { label: "Τροχαία / αποζημιώσεις / αυτοκίνητα", queries: ["τροχ", "ατυχη", "αποζημι", "αυτοκιν", "traffic", "car", "compensation"] },
  { label: "Εργατικό δίκαιο", queries: ["εργα", "απολυ", "μισθ", "employment", "dismissal"] },
  { label: "Μισθώσεις / ενοίκια / αποδόσεις μισθίου", queries: ["μισθ", "ενοικ", "μισθι", "αποδοσ", "lease", "rent", "eviction"] },
];

const supportWorkflows = [
  { id: "booking_failure", label: "Αποτυχία κράτησης", area: "bookingDisputes" },
  { id: "lawyer_cancellation", label: "Ακύρωση από δικηγόρο", area: "bookingDisputes" },
  { id: "slot_conflict", label: "Σύγκρουση ώρας", area: "bookingDisputes" },
  { id: "payment_failure", label: "Αποτυχία πληρωμής", area: "payments" },
  { id: "refund_request", label: "Αίτημα επιστροφής", area: "payments" },
  { id: "refund_review", label: "Έλεγχος επιστροφής", area: "payments" },
  { id: "account_access", label: "Πρόβλημα πρόσβασης λογαριασμού", area: "support" },
  { id: "document_request", label: "Αίτημα ορατότητας ή διαγραφής εγγράφου", area: "privacyDocuments" },
  { id: "privacy_request", label: "Αίτημα απορρήτου", area: "privacyDocuments" },
  { id: "lawyer_complaint", label: "Παράπονο για δικηγόρο", area: "bookingDisputes" },
  { id: "review_dispute", label: "Διαφωνία κριτικής", area: "reviews" },
  { id: "security_incident", label: "Περιστατικό ασφάλειας", area: "security" },
];

const paymentEvidenceScenarios = [
  { label: "successful live booking", terms: ["successful live booking", "payment succeeded", "receipt visible", "confirmed_paid"] },
  { label: "failed payment", terms: ["failed payment", "checkout failed", "payment failed"] },
  { label: "refunded cancellation", terms: ["refunded cancellation", "refund approved", "refunded"] },
  { label: "lawyer cancelled booking", terms: ["lawyer cancelled", "lawyer cancellation", "reschedule"] },
];

const closedStatuses = new Set(["resolved", "rejected", "suspended"]);

const readEnvFiles = () => {
  const env = { ...process.env };
  [".env", ".env.local"].forEach((fileName) => {
    const filePath = join(rootDir, fileName);
    if (!existsSync(filePath)) return;

    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match) return;
        const [, key, rawValue] = match;
        env[key] = rawValue.trim().replace(/^['"]|['"]$/g, "");
      });
  });
  return env;
};

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("el-GR")
    .trim();

const includesText = (source, query) => normalizeText(source).includes(normalizeText(query));

const restFetch = async ({ supabaseUrl, key, table, query = "", label }) => {
  const url = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/${table}${query}`;
  const response = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`${label || table} fetch failed (${response.status}): ${await response.text()}`);
  }

  return response.json();
};

const getArray = (value) => (Array.isArray(value) ? value : []);

const getPriceFrom = (lawyer) => {
  const consultationPrices = getArray(lawyer.consultations)
    .map((consultation) => Number(consultation?.price || 0))
    .filter((price) => Number.isFinite(price) && price > 0);
  if (consultationPrices.length > 0) return Math.min(...consultationPrices);
  const price = Number(lawyer.price || 0);
  return Number.isFinite(price) ? price : 0;
};

const getLawyerSignals = (lawyer) => {
  const verification = lawyer.verification && typeof lawyer.verification === "object" ? lawyer.verification : {};
  const consultationModes = getArray(lawyer.consultation_modes);
  const consultations = getArray(lawyer.consultations);
  const verified = Boolean(verification.barAssociation && verification.registryLabel && getArray(verification.evidence).length > 0);
  const bookable = consultations.some(
    (consultation) => Number(consultation?.price || 0) > 0 && consultationModes.includes(consultation?.mode),
  );

  return {
    verified,
    priceFrom: getPriceFrom(lawyer),
    availableSoon: includesText(lawyer.available, "today") || includesText(lawyer.available, "σημερα") || includesText(lawyer.available, "tomorrow") || includesText(lawyer.available, "αυριο"),
    reviewed: Number(lawyer.reviews || 0) > 0,
    bookable,
  };
};

const categoryText = (lawyer) =>
  [
    lawyer.specialty,
    lawyer.specialty_short,
    lawyer.best_for,
    lawyer.bio,
    ...getArray(lawyer.specialties),
    ...getArray(lawyer.specialty_keywords),
  ].join(" ");

const getSupplyReadiness = (lawyers) =>
  coreLaunchCities.map((city) => {
    const cityLawyers = lawyers.filter((lawyer) => includesText(lawyer.city, city.query));
    const cityLawyersWithSignals = cityLawyers.map((lawyer) => ({ lawyer, signals: getLawyerSignals(lawyer) }));
    const cityVerifiedCount = cityLawyersWithSignals.filter(({ signals }) => signals.verified).length;
    const categories = highIntentCategories.map((category) => {
      const categoryLawyers = cityLawyersWithSignals.filter(({ lawyer }) =>
        category.queries.some((query) => includesText(categoryText(lawyer), query)),
      );
      const verified = categoryLawyers.filter(({ signals }) => signals.verified).length;
      const withPrice = categoryLawyers.filter(({ signals }) => signals.priceFrom > 0).length;
      const availableSoon = categoryLawyers.filter(({ signals }) => signals.availableSoon).length;
      const reviewed = categoryLawyers.filter(({ signals }) => signals.reviewed).length;
      const bookable = categoryLawyers.filter(({ signals }) => signals.bookable).length;
      return {
        ...category,
        total: categoryLawyers.length,
        verified,
        withPrice,
        availableSoon,
        reviewed,
        bookable,
        ready: verified >= 2 && withPrice >= 2 && availableSoon >= 1 && reviewed >= 1 && bookable >= 2,
      };
    });

    return {
      ...city,
      total: cityLawyers.length,
      verified: cityVerifiedCount,
      ready: cityVerifiedCount >= city.minimumVerified && categories.every((category) => category.ready),
      categories,
    };
  });

const caseText = (operationalCase) =>
  [
    operationalCase.title,
    operationalCase.summary,
    ...(Array.isArray(operationalCase.evidence) ? operationalCase.evidence : []),
  ].join(" ").toLowerCase();

const hasClosedCaseWithAnyTerm = (cases, terms) =>
  cases.some((operationalCase) => {
    if (!closedStatuses.has(String(operationalCase.status))) return false;
    const haystack = caseText(operationalCase);
    return terms.some((term) => haystack.includes(term.toLowerCase()));
  });

const getPaymentEvidenceChecks = (cases) =>
  paymentEvidenceScenarios.map((scenario) => ({
    label: scenario.label,
    ready: hasClosedCaseWithAnyTerm(cases, scenario.terms),
  }));

const getSupportEvidenceChecks = (cases) =>
  supportWorkflows.map((workflow) => ({
    ...workflow,
    ready: cases.some((operationalCase) => {
      if (operationalCase.area !== workflow.area || !closedStatuses.has(String(operationalCase.status))) return false;
      const haystack = caseText(operationalCase);
      return haystack.includes(workflow.id.replace(/_/g, " ")) || haystack.includes(workflow.label.toLowerCase());
    }),
  }));

const getFunnelCoverage = (events) => {
  const counts = events.reduce((accumulator, event) => {
    const name = event.event_name || event.name;
    accumulator[name] = (accumulator[name] || 0) + 1;
    return accumulator;
  }, {});
  const timestamps = events
    .map((event) => new Date(event.occurred_at || event.occurredAt).getTime())
    .filter((timestamp) => Number.isFinite(timestamp));
  const observedDays =
    timestamps.length > 1 ? (Math.max(...timestamps) - Math.min(...timestamps)) / (24 * 60 * 60 * 1000) : 0;

  return {
    observedDays,
    checks: requiredFunnelEvents.map((eventName) => ({
      eventName,
      count: counts[eventName] || 0,
      ready: (counts[eventName] || 0) > 0,
    })),
  };
};

const getPaymentConfigChecks = (env) => {
  const stripeSecret = env.STRIPE_SECRET_KEY || "";
  return [
    {
      label: "Supabase project configured",
      ready: Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY),
      detail: "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY exist.",
    },
    {
      label: "Local booking fallback disabled",
      ready: env.VITE_ENABLE_LOCAL_BOOKING_FALLBACK !== "true",
      detail: "VITE_ENABLE_LOCAL_BOOKING_FALLBACK must not be true for launch.",
    },
    {
      label: "Frontend live payments required",
      ready: env.VITE_REQUIRE_LIVE_PAYMENTS === "true",
      detail: "VITE_REQUIRE_LIVE_PAYMENTS=true.",
    },
    {
      label: "Edge functions require live Stripe",
      ready: env.REQUIRE_LIVE_STRIPE === "true" || env.STRIPE_REQUIRE_LIVE_MODE === "true",
      detail: "REQUIRE_LIVE_STRIPE=true or STRIPE_REQUIRE_LIVE_MODE=true.",
    },
    {
      label: "Live Stripe secret configured",
      ready: stripeSecret.startsWith("sk_live_"),
      detail: "STRIPE_SECRET_KEY starts with sk_live_.",
    },
    {
      label: "Webhook secret configured",
      ready: Boolean(env.STRIPE_WEBHOOK_SECRET),
      detail: "STRIPE_WEBHOOK_SECRET exists.",
    },
  ];
};

const getGateReport = ({ env, lawyers, operationalCases, operationalSource, funnelEvents }) => {
  const paymentConfigChecks = getPaymentConfigChecks(env);
  const paymentEvidenceChecks = getPaymentEvidenceChecks(operationalCases);
  const supportEvidenceChecks = getSupportEvidenceChecks(operationalCases);
  const funnelCoverage = getFunnelCoverage(funnelEvents);
  const supplyReadiness = getSupplyReadiness(lawyers);

  const gates = [
    {
      label: "Booking and payment exception flows tested end to end",
      owner: "Payments operator",
      ready: paymentConfigChecks.every((check) => check.ready) && paymentEvidenceChecks.every((check) => check.ready),
      evidence: `${paymentEvidenceChecks.filter((check) => check.ready).length}/${paymentEvidenceChecks.length} payment scenarios closed with evidence.`,
    },
    {
      label: "Webhook/payment reconciliation working",
      owner: "Payments operator",
      ready: paymentConfigChecks.every((check) => check.ready) && hasClosedCaseWithAnyTerm(operationalCases, ["webhook", "payment reconciliation", "receipt visible"]),
      evidence: "Requires live mode and a closed case proving paid/failed/refunded webhook reconciliation.",
    },
    {
      label: "Account statuses match backend truth",
      owner: "Support lead",
      ready: operationalSource === "backend" && hasClosedCaseWithAnyTerm(operationalCases, ["account statuses", "backend truth", "confirmed_paid", "refund_requested"]),
      evidence: "Requires backend ops source plus closed account-state evidence.",
    },
    {
      label: "Support workflows owned with SLA",
      owner: "Operations lead",
      ready: supportEvidenceChecks.every((check) => check.ready),
      evidence: `${supportEvidenceChecks.filter((check) => check.ready).length}/${supportEvidenceChecks.length} support workflows closed with evidence.`,
    },
    {
      label: "Review publication workflow enforced",
      owner: "Trust reviewer",
      ready: hasClosedCaseWithAnyTerm(operationalCases, ["review publication", "completed confirmed consultation", "under_moderation"]),
      evidence: "Requires closed moderation evidence.",
    },
    {
      label: "Partner verification workflow enforced",
      owner: "Verification reviewer",
      ready: hasClosedCaseWithAnyTerm(operationalCases, ["partner verification", "application review", "approved partner"]),
      evidence: "Requires closed partner-verification evidence.",
    },
    {
      label: "Backend funnel analytics live",
      owner: "Growth operations",
      ready: funnelCoverage.checks.every((check) => check.ready) && funnelCoverage.observedDays >= 7,
      evidence: `${funnelCoverage.checks.filter((check) => check.ready).length}/${funnelCoverage.checks.length} events observed across ${funnelCoverage.observedDays.toFixed(1)} days.`,
    },
    {
      label: "Core city/category density achieved",
      owner: "Marketplace supply lead",
      ready: supplyReadiness.every((city) => city.ready),
      evidence: `${supplyReadiness.filter((city) => city.ready).length}/${supplyReadiness.length} launch cities meet city and category density thresholds.`,
    },
    {
      label: "Lawyer dashboard shows ROI clearly",
      owner: "Partner success",
      ready: hasClosedCaseWithAnyTerm(operationalCases, ["lawyer dashboard", "roi", "completed consultations", "paid bookings"]),
      evidence: "Requires closed partner ROI evidence case backed by live dashboard data.",
    },
    {
      label: "Operations are backend-first",
      owner: "Operations lead",
      ready: operationalSource === "backend",
      evidence: operationalSource === "backend" ? "Operational cases read from Supabase." : "Operational cases could not be read from Supabase.",
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      ready: gates.every((gate) => gate.ready),
      readyGates: gates.filter((gate) => gate.ready).length,
      totalGates: gates.length,
      operationalSource,
      lawyerCount: lawyers.length,
      operationalCaseCount: operationalCases.length,
      funnelEventCount: funnelEvents.length,
    },
    gates,
    paymentConfigChecks,
    paymentEvidenceChecks,
    supportEvidenceChecks,
    funnelCoverage,
    supplyReadiness,
  };
};

const formatMark = (ready) => (ready ? "READY" : "BLOCKED");

const toMarkdown = (report) => {
  const lines = [
    "# Launch Readiness Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Overall: ${formatMark(report.summary.ready)} (${report.summary.readyGates}/${report.summary.totalGates} gates ready)`,
    `Operational source: ${report.summary.operationalSource}`,
    `Lawyers: ${report.summary.lawyerCount}`,
    `Operational cases: ${report.summary.operationalCaseCount}`,
    `Funnel events: ${report.summary.funnelEventCount}`,
    "",
    "## Gates",
    "",
    "| Gate | Status | Evidence |",
    "| --- | --- | --- |",
    ...report.gates.map((gate) => `| ${gate.label} | ${formatMark(gate.ready)} | ${gate.evidence} |`),
    "",
    "## Payment Config",
    "",
    ...report.paymentConfigChecks.map((check) => `- ${formatMark(check.ready)}: ${check.label} - ${check.detail}`),
    "",
    "## Payment Evidence",
    "",
    ...report.paymentEvidenceChecks.map((check) => `- ${formatMark(check.ready)}: ${check.label}`),
    "",
    "## Support Workflow Evidence",
    "",
    ...report.supportEvidenceChecks.map((check) => `- ${formatMark(check.ready)}: ${check.label}`),
    "",
    "## Funnel Coverage",
    "",
    `Observed window: ${report.funnelCoverage.observedDays.toFixed(1)} days`,
    ...report.funnelCoverage.checks.map((check) => `- ${formatMark(check.ready)}: ${check.eventName} (${check.count})`),
    "",
    "## Supply Density",
    "",
    ...report.supplyReadiness.flatMap((city) => [
      `- ${formatMark(city.ready)}: ${city.label} (${city.verified}/${city.minimumVerified} verified, ${city.total} total)`,
      ...city.categories.map(
        (category) =>
          `  - ${formatMark(category.ready)}: ${category.label} (verified ${category.verified}, price ${category.withPrice}, soon ${category.availableSoon}, reviewed ${category.reviewed}, bookable ${category.bookable})`,
      ),
    ]),
    "",
  ];

  return `${lines.join("\n")}\n`;
};

const safeFetch = async (label, fn) => {
  try {
    return { data: await fn(), error: "" };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : String(error) };
  }
};

const main = async () => {
  const env = readEnvFiles();
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL/SUPABASE_URL or VITE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY.");
  }

  const lawyerResult = await safeFetch("lawyer profiles", () =>
    restFetch({
      supabaseUrl,
      key: anonKey,
      table: "lawyer_profiles",
      query:
        "?status=eq.active&select=id,name,specialty,specialty_short,specialties,specialty_keywords,best_for,city,rating,reviews,price,available,consultation_modes,bio,verification,consultations",
      label: "lawyer_profiles",
    }),
  );

  const backendKey = serviceRoleKey || "";
  const protectedResults = backendKey
    ? await Promise.all([
        safeFetch("operational cases", () =>
          restFetch({
            supabaseUrl,
            key: backendKey,
            table: "operational_cases",
            query: "?select=area,title,summary,status,evidence,updated_at&order=updated_at.desc&limit=10000",
            label: "operational_cases",
          }),
        ),
        safeFetch("funnel events", () =>
          restFetch({
            supabaseUrl,
            key: backendKey,
            table: "funnel_events",
            query: "?select=event_name,occurred_at,user_id,lawyer_id,booking_id,city,category,source&order=occurred_at.desc&limit=10000",
            label: "funnel_events",
          }),
        ),
      ])
    : [
        { data: [], error: "SUPABASE_SERVICE_ROLE_KEY is not configured, so protected operational cases cannot be audited." },
        { data: [], error: "SUPABASE_SERVICE_ROLE_KEY is not configured, so protected funnel events cannot be audited." },
      ];

  const [operationalCasesResult, funnelEventsResult] = protectedResults;
  const operationalSource = operationalCasesResult.error ? "blocked" : "backend";

  const report = getGateReport({
    env,
    lawyers: lawyerResult.data,
    operationalCases: operationalCasesResult.data,
    operationalSource,
    funnelEvents: funnelEventsResult.data,
  });

  report.fetchErrors = {
    lawyers: lawyerResult.error,
    operationalCases: operationalCasesResult.error,
    funnelEvents: funnelEventsResult.error,
  };

  mkdirSync(reportDir, { recursive: true });
  writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownReportPath, toMarkdown(report), "utf8");

  console.log(`Launch readiness: ${formatMark(report.summary.ready)} (${report.summary.readyGates}/${report.summary.totalGates} gates ready)`);
  console.log(`Report: ${markdownReportPath}`);
  if (report.fetchErrors.lawyers) console.log(`Lawyer fetch: ${report.fetchErrors.lawyers}`);
  if (report.fetchErrors.operationalCases) console.log(`Operational cases: ${report.fetchErrors.operationalCases}`);
  if (report.fetchErrors.funnelEvents) console.log(`Funnel events: ${report.fetchErrors.funnelEvents}`);

  report.gates.forEach((gate) => {
    console.log(`${formatMark(gate.ready)} - ${gate.label}: ${gate.evidence}`);
  });

  if (process.argv.includes("--strict") && !report.summary.ready) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
