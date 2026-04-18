import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("stage 4 hardening contracts", () => {
  it("keeps partner access backend-only in production source", () => {
    const platformRepository = readRepoFile("src/lib/platformRepository.ts");
    const productionBypassMarkers = [
      "localPartnerAccessCode",
      "approvedLocalPartnerEmails",
      "isLocalApprovedPartner",
      "createLocalPartnerAccessCode",
      "VITE_ENABLE_LOCAL_PARTNER_FALLBACK",
      "requirePartnerBackend",
      "742913",
    ];

    productionBypassMarkers.forEach((marker) => {
      expect(platformRepository).not.toContain(marker);
    });
    expect(platformRepository).toContain("PARTNER_SESSION_REQUIRES_BACKEND_TOKEN");
    expect(platformRepository).toContain("partnerSessionMaxAgeMs = 2 * 60 * 60 * 1000");
  });

  it("keeps production fallbacks behind the shared local/demo runtime guard", () => {
    const runtimeGuards = readRepoFile("src/lib/runtimeGuards.ts");
    const platformRepository = readRepoFile("src/lib/platformRepository.ts");
    const userWorkspace = readRepoFile("src/lib/userWorkspace.ts");
    const partnerWorkspace = readRepoFile("src/lib/partnerWorkspace.ts");
    const operationsRepository = readRepoFile("src/lib/operationsRepository.ts");
    const funnelAnalytics = readRepoFile("src/lib/funnelAnalytics.ts");

    expect(runtimeGuards).toContain("allowLocalCriticalFallback");
    [platformRepository, userWorkspace, partnerWorkspace, operationsRepository, funnelAnalytics].forEach((source) => {
      expect(source).toContain("allowLocalCriticalFallback");
    });
    expect(platformRepository).toContain('failClosedCriticalPath("Payment');
    expect(userWorkspace).toContain('failClosedCriticalPath("Document');
    expect(partnerWorkspace).toContain('failClosedCriticalPath("Partner');
    expect(operationsRepository).toContain('source: "unavailable"');
    expect(funnelAnalytics).toContain("backend_write_failed");
  });

  it("removes seeded launch operational cases from canonical production setup", () => {
    const operationsRepository = readRepoFile("src/lib/operationsRepository.ts");
    const desiredSchema = readRepoFile("supabase/desired_supabase_from_scratch.sql");
    const cleanupMigration = readRepoFile("supabase/migrations/20260418162000_remove_synthetic_launch_cases.sql");

    expect(operationsRepository).not.toContain("launchReadinessCases");
    expect(desiredSchema).not.toContain("PAY-LAUNCH-STRIPE");
    expect(desiredSchema).not.toContain("insert into public.operational_cases");
    expect(cleanupMigration).toContain("delete from public.operational_cases");
    expect(cleanupMigration).toContain("PAY-LAUNCH-STRIPE");
  });

  it("ships durable Stripe evidence storage and reconciliation controls", () => {
    const desiredSchema = readRepoFile("supabase/desired_supabase_from_scratch.sql");
    const webhookFunction = readRepoFile("supabase/functions/stripe-webhook/index.ts");
    const reconciliationFunction = readRepoFile("supabase/functions/reconcile-stripe-payments/index.ts");
    const reconciliationWorkflow = readRepoFile(".github/workflows/daily-stripe-reconciliation.yml");

    expect(desiredSchema).toContain("payment_reconciliation_runs");
    expect(desiredSchema).toContain("payment_reconciliation_mismatches");
    expect(desiredSchema).toContain("booking_payment_events");
    expect(webhookFunction).toContain("verifyStripeSignature");
    expect(webhookFunction).toContain('request.headers.get("stripe-signature")');
    expect(webhookFunction).toContain("replay: true");
    expect(webhookFunction).toContain("orphan_stripe_event");
    expect(reconciliationFunction).toContain("payment_reconciliation_runs");
    expect(reconciliationFunction).toContain("state_mismatch");
    expect(reconciliationFunction).toContain("missing_receipt");
    expect(reconciliationWorkflow).toContain("reconcile-stripe-payments");
    expect(reconciliationWorkflow).toContain("schedule:");
  });

  it("keeps documents inaccessible until backend malware scanning and audit rules pass", () => {
    const desiredSchema = readRepoFile("supabase/desired_supabase_from_scratch.sql");
    const userWorkspace = readRepoFile("src/lib/userWorkspace.ts");
    const platformRepository = readRepoFile("src/lib/platformRepository.ts");

    expect(desiredSchema).toContain("malware_scan_status");
    expect(desiredSchema).toContain("document_access_audit_events");
    expect(desiredSchema).toContain("ud.malware_scan_status = 'clean'");
    expect(userWorkspace).toContain('document.malwareScanStatus === "clean"');
    expect(platformRepository).toContain('document.malwareScanStatus === "clean"');
  });

  it("audits and revokes partner sessions on backend verification", () => {
    const desiredSchema = readRepoFile("supabase/desired_supabase_from_scratch.sql");
    const partnerAuditMigration = readRepoFile("supabase/migrations/20260418163000_partner_session_audit.sql");

    expect(desiredSchema).toContain("partner_session_audit_events");
    expect(desiredSchema).toContain("access_code_failed");
    expect(desiredSchema).toContain("previous_sessions_revoked");
    expect(desiredSchema).toContain("session_issued");
    expect(desiredSchema).toContain("set revoked_at = now()");
    expect(partnerAuditMigration).toContain("create table if not exists public.partner_session_audit_events");
  });

  it("does not infer partner ROI traffic metrics in the dashboard", () => {
    const partnerPortal = readRepoFile("src/pages/PartnerPortal.tsx");

    expect(partnerPortal).toContain("profileViews={null}");
    expect(partnerPortal).toContain("μόνο από backend analytics");
    expect(partnerPortal).not.toContain("partnerReviews.length * 18");
    expect(partnerPortal).not.toContain("workspace.availability.filter((slot) => slot.enabled).length * 22");
  });
});
