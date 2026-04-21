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
  "intake_submitted",
  "intake_routed",
  "partner_plan_checkout_opened",
  "partner_subscription_active",
  "pipeline_status_updated",
  "followup_task_created",
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
  { label: "επιτυχής live κράτηση", terms: ["successful live booking", "payment succeeded", "receipt visible", "confirmed_paid", "επιτυχής live κράτηση", "επιτυχής πληρωμή", "ορατή απόδειξη", "πληρωμένη κράτηση"] },
  { label: "αποτυχημένη πληρωμή", terms: ["failed payment", "checkout failed", "payment failed", "αποτυχημένη πληρωμή", "αποτυχία checkout", "η πληρωμή απέτυχε"] },
  { label: "ακύρωση με επιστροφή", terms: ["refunded cancellation", "refund approved", "refunded", "ακύρωση με επιστροφή", "εγκρίθηκε επιστροφή", "επιστραφείσα"] },
  { label: "ακύρωση από δικηγόρο", terms: ["lawyer cancelled", "lawyer cancellation", "reschedule", "ακύρωση από δικηγόρο", "αλλαγή ώρας", "νέα ώρα"] },
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
        ready: verified >= 3 && withPrice >= 3 && availableSoon >= 2 && reviewed >= 2 && bookable >= 3,
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
      label: "Το Supabase project είναι ρυθμισμένο",
      ready: Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY),
      detail: "Υπάρχουν VITE_SUPABASE_URL και VITE_SUPABASE_ANON_KEY.",
    },
    {
      label: "Τοπικό fallback κρατήσεων απενεργοποιημένο",
      ready: env.VITE_ENABLE_LOCAL_BOOKING_FALLBACK !== "true",
      detail: "Το VITE_ENABLE_LOCAL_BOOKING_FALLBACK δεν πρέπει να είναι true για launch.",
    },
    {
      label: "Το frontend απαιτεί live πληρωμές",
      ready: env.VITE_REQUIRE_LIVE_PAYMENTS === "true",
      detail: "VITE_REQUIRE_LIVE_PAYMENTS=true.",
    },
    {
      label: "Οι edge functions απαιτούν live Stripe",
      ready: env.REQUIRE_LIVE_STRIPE === "true" || env.STRIPE_REQUIRE_LIVE_MODE === "true",
      detail: "REQUIRE_LIVE_STRIPE=true or STRIPE_REQUIRE_LIVE_MODE=true.",
    },
    {
      label: "Live Stripe secret ρυθμισμένο",
      ready: stripeSecret.startsWith("sk_live_"),
      detail: "Το STRIPE_SECRET_KEY ξεκινά με sk_live_.",
    },
    {
      label: "Webhook secret ρυθμισμένο",
      ready: Boolean(env.STRIPE_WEBHOOK_SECRET),
      detail: "Υπάρχει STRIPE_WEBHOOK_SECRET.",
    },
  ];
};

const readRepoFile = (relativePath) => {
  try {
    return readFileSync(join(rootDir, relativePath), "utf8");
  } catch {
    return "";
  }
};

const getSourceHardeningChecks = () => {
  const platformRepository = readRepoFile("src/lib/platformRepository.ts");
  const operationsRepository = readRepoFile("src/lib/operationsRepository.ts");
  const level4Marketplace = readRepoFile("src/lib/level4Marketplace.ts");
  const intakeRepository = readRepoFile("src/lib/intakeRepository.ts");
  const partnerCrmRepository = readRepoFile("src/lib/partnerCrmRepository.ts");
  const desiredSchema = readRepoFile("supabase/desired_supabase_from_scratch.sql");
  const syntheticLaunchCleanupMigration = readRepoFile("supabase/migrations/20260418162000_remove_synthetic_launch_cases.sql");
  const webhookFunction = readRepoFile("supabase/functions/stripe-webhook/index.ts");
  const partnerSubscriptionFunction = readRepoFile("supabase/functions/create-partner-subscription-checkout-session/index.ts");
  const reconciliationFunction = readRepoFile("supabase/functions/reconcile-stripe-payments/index.ts");
  const reconciliationWorkflow = readRepoFile(".github/workflows/daily-stripe-reconciliation.yml");
  const workflow = readRepoFile(".github/workflows/stage4-release-gate.yml");
  const sitemap = readRepoFile("public/sitemap.xml");

  return [
    {
      label: "Δεν υπάρχει τοπικό partner auth bypass",
      ready:
        !platformRepository.includes("localPartnerAccessCode") &&
        !platformRepository.includes("isLocalApprovedPartner") &&
        !platformRepository.includes("VITE_ENABLE_LOCAL_PARTNER_FALLBACK") &&
        !platformRepository.includes("742913") &&
        platformRepository.includes("PARTNER_SESSION_REQUIRES_BACKEND_TOKEN") &&
        desiredSchema.includes("partner_session_audit_events") &&
        desiredSchema.includes("session_issued"),
    },
    {
      label: "Οι λειτουργίες δεν σπέρνουν fallback launch cases στην παραγωγή",
      ready:
        operationsRepository.includes("allowLocalCriticalFallback") &&
        operationsRepository.includes('source: "unavailable"') &&
        !operationsRepository.includes("launchReadinessCases") &&
        !desiredSchema.includes("insert into public.operational_cases") &&
        syntheticLaunchCleanupMigration.includes("PAY-LAUNCH-STRIPE"),
    },
    {
      label: "Το Stripe webhook είναι replay-safe και κρατά mismatch queue",
      ready:
        webhookFunction.includes("replay: true") &&
        webhookFunction.includes("payment_reconciliation_mismatches") &&
        webhookFunction.includes("orphan_stripe_event"),
    },
    {
      label: "Υπάρχει daily reconciliation worker για Stripe",
      ready:
        reconciliationFunction.includes("payment_reconciliation_runs") &&
        reconciliationFunction.includes("state_mismatch") &&
        reconciliationFunction.includes("missing_receipt") &&
        reconciliationWorkflow.includes("reconcile-stripe-payments") &&
        reconciliationWorkflow.includes("schedule:"),
    },
    {
      label: "Το CI τρέχει strict launch audit ως release gate",
      ready:
        workflow.includes("npm run release:gate") &&
        workflow.includes("REQUIRE_LIVE_STRIPE") &&
        readRepoFile("package.json").includes("npm run test:e2e"),
    },
    {
      label: "Level 4 ranking and coverage are shared across the marketplace",
      ready:
        level4Marketplace.includes("rankMarketplaceLawyers") &&
        level4Marketplace.includes("getLevel4Coverage") &&
        level4Marketplace.includes("lawyersPerCityCategory: 3") &&
        level4Marketplace.includes("sponsoredLabel"),
    },
    {
      label: "Guided intake persists through backend RPCs",
      ready:
        intakeRepository.includes("create_intake_request") &&
        intakeRepository.includes("routeIntakeRequest") &&
        desiredSchema.includes("create table if not exists public.intake_requests") &&
        desiredSchema.includes("create or replace function public.create_intake_request"),
    },
    {
      label: "Partner CRM is backed by pipeline, notes, and follow-up contracts",
      ready:
        partnerCrmRepository.includes("update_partner_pipeline_status") &&
        partnerCrmRepository.includes("save_partner_case_note") &&
        partnerCrmRepository.includes("upsert_partner_followup_task") &&
        desiredSchema.includes("create table if not exists public.partner_pipeline_items") &&
        desiredSchema.includes("create table if not exists public.partner_case_notes") &&
        desiredSchema.includes("create table if not exists public.partner_followup_tasks"),
    },
    {
      label: "Partner subscriptions run through Edge Functions and Stripe webhooks",
      ready:
        partnerSubscriptionFunction.includes('form.set("mode", "subscription")') &&
        webhookFunction.includes("partner_subscriptions") &&
        webhookFunction.includes("customer.subscription.updated") &&
        desiredSchema.includes("create table if not exists public.partner_subscriptions"),
    },
    {
      label: "All current city/category discovery pages are in the public sitemap",
      ready:
        ["civil-debts-contracts", "family-law", "traffic-compensation-cars", "employment-law", "leases-rent-evictions"].every((category) =>
          ["athens", "thessaloniki", "piraeus", "heraklion", "patra"].every((city) =>
            sitemap.includes(`/lawyers/${category}/${city}`),
          ),
        ) &&
        sitemap.includes("/intake") &&
        sitemap.includes("/for-lawyers/plans"),
    },
  ];
};

const getGateReport = ({ env, lawyers, operationalCases, operationalSource, funnelEvents }) => {
  const paymentConfigChecks = getPaymentConfigChecks(env);
  const sourceHardeningChecks = getSourceHardeningChecks();
  const paymentEvidenceChecks = getPaymentEvidenceChecks(operationalCases);
  const supportEvidenceChecks = getSupportEvidenceChecks(operationalCases);
  const funnelCoverage = getFunnelCoverage(funnelEvents);
  const supplyReadiness = getSupplyReadiness(lawyers);

  const gates = [
    {
      label: "Οι εξαιρέσεις κράτησης και πληρωμής έχουν ελεγχθεί end-to-end",
      owner: "Υπεύθυνος πληρωμών",
      ready: paymentConfigChecks.every((check) => check.ready) && sourceHardeningChecks.every((check) => check.ready) && paymentEvidenceChecks.every((check) => check.ready),
      evidence: `${paymentEvidenceChecks.filter((check) => check.ready).length}/${paymentEvidenceChecks.length} σενάρια πληρωμής έχουν κλείσει με στοιχεία.`,
    },
    {
      label: "Το webhook και η συμφωνία πληρωμών λειτουργούν",
      owner: "Υπεύθυνος πληρωμών",
      ready: paymentConfigChecks.every((check) => check.ready) && hasClosedCaseWithAnyTerm(operationalCases, ["webhook", "payment reconciliation", "receipt visible", "συμφωνία πληρωμών", "ορατή απόδειξη"]),
      evidence: "Απαιτεί live λειτουργία και κλειστή υπόθεση που αποδεικνύει συμφωνία webhook για πληρωμή, αποτυχία και επιστροφή.",
    },
    {
      label: "Οι καταστάσεις λογαριασμού συμφωνούν με το backend",
      owner: "Υπεύθυνος υποστήριξης",
      ready: operationalSource === "backend" && hasClosedCaseWithAnyTerm(operationalCases, ["account statuses", "backend truth", "confirmed_paid", "refund_requested", "καταστάσεις λογαριασμού", "αλήθεια backend"]),
      evidence: "Απαιτεί backend πηγή λειτουργίας και κλειστή απόδειξη κατάστασης λογαριασμού.",
    },
    {
      label: "Οι ροές υποστήριξης έχουν υπεύθυνο και χρόνο απόκρισης",
      owner: "Υπεύθυνος λειτουργίας",
      ready: supportEvidenceChecks.every((check) => check.ready),
      evidence: `${supportEvidenceChecks.filter((check) => check.ready).length}/${supportEvidenceChecks.length} ροές υποστήριξης έχουν κλείσει με στοιχεία.`,
    },
    {
      label: "Η δημοσίευση κριτικών ακολουθεί υποχρεωτική ροή ελέγχου",
      owner: "Έλεγχος εμπιστοσύνης",
      ready: hasClosedCaseWithAnyTerm(operationalCases, ["review publication", "completed confirmed consultation", "under_moderation", "δημοσίευση κριτικής", "επιβεβαιωμένη ολοκληρωμένη συμβουλευτική", "υπό έλεγχο"]),
      evidence: "Απαιτεί κλειστή απόδειξη ελέγχου κριτικών.",
    },
    {
      label: "Η επαλήθευση συνεργατών εφαρμόζεται πριν τη δημόσια παρουσία",
      owner: "Έλεγχος συνεργατών",
      ready: hasClosedCaseWithAnyTerm(operationalCases, ["partner verification", "application review", "approved partner", "επαλήθευση συνεργάτη", "έλεγχος αίτησης", "εγκεκριμένος συνεργάτης"]),
      evidence: "Απαιτεί κλειστή απόδειξη επαλήθευσης συνεργάτη.",
    },
    {
      label: "Τα funnel analytics γράφονται στο backend",
      owner: "Λειτουργία ανάπτυξης",
      ready: funnelCoverage.checks.every((check) => check.ready) && funnelCoverage.observedDays >= 7,
      evidence: `${funnelCoverage.checks.filter((check) => check.ready).length}/${funnelCoverage.checks.length} συμβάντα καταγράφηκαν σε ${funnelCoverage.observedDays.toFixed(1)} ημέρες.`,
    },
    {
      label: "Η βασική πυκνότητα πόλης/δικαίου έχει επιτευχθεί",
      owner: "Υπεύθυνος προσφοράς αγοράς",
      ready: supplyReadiness.every((city) => city.ready),
      evidence: `${supplyReadiness.filter((city) => city.ready).length}/${supplyReadiness.length} πόλεις launch καλύπτουν όρια πόλης και δικαίου.`,
    },
    {
      label: "Το dashboard δικηγόρου δείχνει καθαρά την απόδοση",
      owner: "Επιτυχία συνεργατών",
      ready: hasClosedCaseWithAnyTerm(operationalCases, ["lawyer dashboard", "roi", "completed consultations", "paid bookings", "dashboard δικηγόρου", "απόδοση", "ολοκληρωμένες συμβουλευτικές", "πληρωμένες κρατήσεις"]),
      evidence: "Απαιτεί κλειστή υπόθεση απόδειξης απόδοσης συνεργάτη με live δεδομένα dashboard.",
    },
    {
      label: "Οι λειτουργίες είναι backend-first",
      owner: "Υπεύθυνος λειτουργίας",
      ready: operationalSource === "backend",
      evidence: operationalSource === "backend" ? "Οι υποθέσεις λειτουργίας διαβάζονται από Supabase." : "Οι υποθέσεις λειτουργίας δεν διαβάστηκαν από Supabase.",
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
    sourceHardeningChecks,
    paymentEvidenceChecks,
    supportEvidenceChecks,
    funnelCoverage,
    supplyReadiness,
  };
};

const formatMark = (ready) => (ready ? "ΕΤΟΙΜΟ" : "ΜΠΛΟΚΑΡΕΙ");

const toMarkdown = (report) => {
  const lines = [
    "# Αναφορά ετοιμότητας launch",
    "",
    `Δημιουργήθηκε: ${report.generatedAt}`,
    "",
    `Σύνολο: ${formatMark(report.summary.ready)} (${report.summary.readyGates}/${report.summary.totalGates} κανόνες έτοιμοι)`,
    `Πηγή λειτουργίας: ${report.summary.operationalSource}`,
    `Δικηγόροι: ${report.summary.lawyerCount}`,
    `Λειτουργικές υποθέσεις: ${report.summary.operationalCaseCount}`,
    `Συμβάντα διαδρομής: ${report.summary.funnelEventCount}`,
    "",
    "## Κανόνες launch",
    "",
    "| Κανόνας | Κατάσταση | Απόδειξη |",
    "| --- | --- | --- |",
    ...report.gates.map((gate) => `| ${gate.label} | ${formatMark(gate.ready)} | ${gate.evidence} |`),
    "",
    "## Ρύθμιση πληρωμών",
    "",
    ...report.paymentConfigChecks.map((check) => `- ${formatMark(check.ready)}: ${check.label} - ${check.detail}`),
    "",
    "## Στατικός έλεγχος hardening",
    "",
    ...report.sourceHardeningChecks.map((check) => `- ${formatMark(check.ready)}: ${check.label}`),
    "",
    "## Αποδείξεις πληρωμών",
    "",
    ...report.paymentEvidenceChecks.map((check) => `- ${formatMark(check.ready)}: ${check.label}`),
    "",
    "## Αποδείξεις ροών υποστήριξης",
    "",
    ...report.supportEvidenceChecks.map((check) => `- ${formatMark(check.ready)}: ${check.label}`),
    "",
    "## Κάλυψη διαδρομής",
    "",
    `Παράθυρο παρατήρησης: ${report.funnelCoverage.observedDays.toFixed(1)} ημέρες`,
    ...report.funnelCoverage.checks.map((check) => `- ${formatMark(check.ready)}: ${check.eventName} (${check.count})`),
    "",
    "## Πυκνότητα προσφοράς",
    "",
    ...report.supplyReadiness.flatMap((city) => [
      `- ${formatMark(city.ready)}: ${city.label} (${city.verified}/${city.minimumVerified} επαληθευμένοι, ${city.total} σύνολο)`,
      ...city.categories.map(
        (category) =>
          `  - ${formatMark(category.ready)}: ${category.label} (επαληθευμένοι ${category.verified}, τιμή ${category.withPrice}, κοντινή διαθεσιμότητα ${category.availableSoon}, με κριτικές ${category.reviewed}, κρατήσιμοι ${category.bookable})`,
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
        { data: [], error: "Δεν έχει ρυθμιστεί SUPABASE_SERVICE_ROLE_KEY, άρα οι προστατευμένες λειτουργικές υποθέσεις δεν μπορούν να ελεγχθούν." },
        { data: [], error: "Δεν έχει ρυθμιστεί SUPABASE_SERVICE_ROLE_KEY, άρα τα προστατευμένα συμβάντα διαδρομής δεν μπορούν να ελεγχθούν." },
      ];

  const [operationalCasesResult, funnelEventsResult] = protectedResults;
  const operationalSource = operationalCasesResult.error ? "unavailable" : "backend";

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

  console.log(`Ετοιμότητα launch: ${formatMark(report.summary.ready)} (${report.summary.readyGates}/${report.summary.totalGates} κανόνες έτοιμοι)`);
  console.log(`Αναφορά: ${markdownReportPath}`);
  if (report.fetchErrors.lawyers) console.log(`Ανάκτηση δικηγόρων: ${report.fetchErrors.lawyers}`);
  if (report.fetchErrors.operationalCases) console.log(`Λειτουργικές υποθέσεις: ${report.fetchErrors.operationalCases}`);
  if (report.fetchErrors.funnelEvents) console.log(`Συμβάντα διαδρομής: ${report.fetchErrors.funnelEvents}`);

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
