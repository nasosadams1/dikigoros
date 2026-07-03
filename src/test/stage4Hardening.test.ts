import { existsSync, readFileSync } from "node:fs";
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
    const bookingPage = readRepoFile("src/pages/Booking.tsx");
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
    expect(bookingPage).toContain("allowLocalCheckoutReturnRecording");
    expect(bookingPage).toContain("payment_completed_local_fallback");
    expect(bookingPage).not.toContain("payment_completed_local_demo");
    expect(bookingPage).toContain("formatLocalDateIso(dates[selectedDate].dateObject)");
    expect(bookingPage).not.toContain("dateObject.toISOString().slice(0, 10)");
  });

  it("does not keep copied auth implementations in the production source tree", () => {
    expect(existsSync(join(process.cwd(), "src", "components", "auth - Copy"))).toBe(false);
  });

  it("keeps production bundles split instead of hiding oversized chunk warnings", () => {
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain("manualChunks");
    expect(viteConfig).toContain("vendor-react");
    expect(viteConfig).toContain("vendor-supabase");
    expect(viteConfig).toContain("vendor-ui");
    expect(viteConfig).toContain("vendor-icons");
    expect(viteConfig).not.toContain("chunkSizeWarningLimit");
  });

  it("keeps Vercel deep links routed through the SPA entrypoint", () => {
    const vercelConfig = readRepoFile("vercel.json");
    const launchReadiness = readRepoFile("scripts/launch-readiness.mjs");

    expect(vercelConfig).toContain('"source": "/(.*)"');
    expect(vercelConfig).toContain('"destination": "/index.html"');
    expect(launchReadiness).toContain("Vercel serves React deep links through the SPA entrypoint");
    expect(launchReadiness).toContain('"destination": "/index.html"');
  });

  it("checks current browser origins before launch", () => {
    const launchReadiness = readRepoFile("scripts/launch-readiness.mjs");

    expect(launchReadiness).toContain("Browser-callable Edge Functions trust the current app origins");
    expect(launchReadiness).toContain("https://dikigoros.vercel.app");
    expect(launchReadiness).toContain("http://localhost:8081");
    expect(launchReadiness).toContain("browserCallableEdgeFunctions.every");
    expect(launchReadiness).toContain('!source.includes(\'"Access-Control-Allow-Origin": "*"\')');
  });

  it("does not advertise an unrouted intake workflow as a launch feature", () => {
    const app = readRepoFile("src/App.tsx");
    const sitemap = readRepoFile("public/sitemap.xml");
    const launchReadiness = readRepoFile("scripts/launch-readiness.mjs");

    expect(app).not.toContain('path="/intake"');
    expect(sitemap).not.toContain("/intake");
    expect(launchReadiness).not.toContain("intakeRepository");
    expect(launchReadiness).not.toContain("intake_submitted");
    expect(launchReadiness).not.toContain("intake_routed");
  });

  it("keeps public profile slot links tied to the booking step", () => {
    const lawyerProfile = readRepoFile("src/pages/LawyerProfile.tsx");
    const bookingPage = readRepoFile("src/pages/Booking.tsx");

    expect(lawyerProfile).toContain("buildBookingLink");
    expect(lawyerProfile).toContain('params.set("date", formatLocalDateIso(slot.date))');
    expect(lawyerProfile).toContain('params.set("time", slot.time)');
    expect(lawyerProfile).toContain('params.set("mode", consultationMode)');
    expect(bookingPage).toContain("requestedDateIso");
    expect(bookingPage).toContain("requestedTime");
    expect(bookingPage).toContain("requestedMode");
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

  it("keeps client account workspace tied to authenticated users only", () => {
    const userProfile = readRepoFile("src/pages/UserProfile.tsx");

    expect(userProfile).toContain("const workspaceKey = userId || undefined");
    expect(userProfile).toContain("const hasAccountAccess = Boolean(user)");
    expect(userProfile).toContain("profileDraftDirty");
    expect(userProfile).not.toContain("getPartnerWorkspace");
    expect(userProfile).not.toContain("getUserWorkspace(user?.id || getPartnerSession()?.email)");
    expect(userProfile).not.toContain("partnerSession?.email || undefined");
  });

  it("keeps document sharing private by default and gated by scan, booking, and consent", () => {
    const desiredSchema = readRepoFile("supabase/desired_supabase_from_scratch.sql");
    const hardeningMigration = readRepoFile("supabase/migrations/20260422203000_user_profile_privacy_hardening.sql");
    const userWorkspace = readRepoFile("src/lib/userWorkspace.ts");
    const userProfile = readRepoFile("src/pages/UserProfile.tsx");

    expect(desiredSchema).toContain("visible_to_lawyer boolean not null default false");
    expect(hardeningMigration).toContain("alter column visible_to_lawyer set default false");

    [desiredSchema, hardeningMigration].forEach((source) => {
      expect(source).toContain('create policy "Users can create private pending documents"');
      expect(source).toContain("and malware_scan_status = 'clean'");
      expect(source).toContain("and coalesce(deletion_status,'active') = 'active'");
      expect(source).toContain("privacy_settings ->> 'allowDocumentAccessByBooking'");
      expect(source).toContain("grant update (visible_to_lawyer, deletion_status, visibility_history) on public.user_documents to authenticated");
    });

    expect(desiredSchema).not.toContain('create policy "Users can manage own documents" on public.user_documents\n  for all');
    expect(userWorkspace).toContain("allowDocumentAccessByBooking: false");
    expect(userWorkspace).toContain("documents,");
    expect(userWorkspace).toContain("visible_to_lawyer: document.visibleToLawyer");
    expect(userWorkspace).toContain("allowDocumentAccessByBooking?: boolean");
    expect(userWorkspace).toContain('throw failClosedCriticalPath("Document visibility")');
    expect(userWorkspace).not.toContain("documents: documents.length ? documents : remoteWorkspace.documents");
    expect(userWorkspace).not.toContain("visible_to_lawyer: true");
    expect(userProfile).not.toContain('activeView === "documents"');
    expect(userProfile).not.toContain("handleDocumentUpload");
  });

  it("submits reviews into moderation instead of immediate publication", () => {
    const desiredSchema = readRepoFile("supabase/desired_supabase_from_scratch.sql");
    const hardeningMigration = readRepoFile("supabase/migrations/20260422203000_user_profile_privacy_hardening.sql");

    expect(desiredSchema).toContain("status text not null default 'pending_review'");
    expect(hardeningMigration).toContain("alter column status set default 'pending_review'");

    [desiredSchema, hardeningMigration].forEach((source) => {
      expect(source).toContain("trim(p_review_text),\n    'pending_review'");
      expect(source).toContain("status = 'pending_review'");
    });
  });

  it("does not mark refunds requested before Stripe accepts the refund", () => {
    const refundFunction = readRepoFile("supabase/functions/create-booking-refund/index.ts");
    const stripeRefundCall = refundFunction.indexOf('const stripeResponse = await fetch("https://api.stripe.com/v1/refunds"');
    const firstPaymentPatchAfterStripe = refundFunction.indexOf("await patchPayment", stripeRefundCall);

    expect(refundFunction).toContain('"Idempotency-Key": `booking-refund-${bookingId}`');
    expect(stripeRefundCall).toBeGreaterThan(-1);
    expect(refundFunction.slice(0, stripeRefundCall)).not.toContain("await patchPayment");
    expect(firstPaymentPatchAfterStripe).toBeGreaterThan(stripeRefundCall);
    expect(refundFunction.slice(stripeRefundCall)).toContain('"refund_requested"');
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

  it("keeps the partner portal focused on operational tabs", () => {
    const app = readRepoFile("src/App.tsx");
    const navbar = readRepoFile("src/components/Navbar.tsx");
    const partnerTopBar = readRepoFile("src/components/partner/PartnerTopBar.tsx");
    const partnerPortal = readRepoFile("src/pages/PartnerPortal.tsx");

    expect(app).not.toContain('const PartnerProfile = lazy(() => import("./pages/PartnerProfile"))');
    expect(app).toContain('path="/for-lawyers/profile"');
    expect(app).toContain('<PartnerPortal chrome="profile" />');
    expect(navbar).toContain('const partnerProfilePath = "/for-lawyers/profile"');
    expect(navbar).toContain('const profilePath = isPartnerSignedIn ? partnerProfilePath : "/account"');
    expect(navbar).not.toContain("Πίνακας");
    expect(partnerTopBar).toContain('to={partnerSession ? "/" : "/for-lawyers"}');
    expect(partnerTopBar).toContain("Αρχική");
    expect(partnerTopBar).not.toContain("Προφίλ");
    expect(partnerTopBar).not.toContain('to="/for-lawyers/profile"');
    expect(partnerPortal).toContain('chrome?: "partner" | "profile"');
    expect(partnerPortal).not.toContain('label: "Απόδοση αναζήτησης"');
    expect(partnerPortal).toContain('label: "Ραντεβού"');
    expect(partnerPortal).toContain("Νέο αίτημα");
    expect(partnerPortal).toContain("Επιβεβαιωμένο");
    expect(partnerPortal).toContain("Ακυρωμένο");
    expect(partnerPortal).toContain("Άνοιγμα");
    expect(partnerPortal).toContain("Αποδοχή");
    expect(partnerPortal).toContain("Χρήματα σε έλεγχο");
    expect(partnerPortal).toContain("Πληρωμή και επόμενο βήμα");
    expect(partnerPortal).toContain("Πληρωμές που χρειάζονται πλαίσιο");
    expect(partnerPortal).toContain("paymentRequiresPartnerAction");
    expect(partnerPortal).toContain("attentionRevenueCents");
    expect(partnerPortal).toContain("failedReviewRevenueCents");
    expect(partnerPortal).toContain("formatGreekUnitCount");
    expect(partnerPortal).toContain("Άνοιγμα πληρωμής");
    expect(partnerPortal).toContain("Email πρόταση νέας ώρας");
    expect(partnerPortal).toContain("Email στον πελάτη");
    expect(partnerPortal).toContain("Email υπενθύμιση πληρωμής");
    expect(partnerPortal).toContain("UnavailableAppointmentAction");
    expect(partnerPortal).toContain("Πελάτης");
    expect(partnerPortal).toContain("Θέμα");
    expect(partnerPortal).toContain("Περιγραφή");
    expect(partnerPortal).toContain('id: "profile"');
    expect(partnerPortal).toContain('id: "availability"');
    expect(partnerPortal).toContain('id: "bookings"');
    expect(partnerPortal).toContain('id: "casePayments"');
    expect(partnerPortal).toContain('id: "account"');
    expect(partnerPortal).not.toContain('id: "cases"');
    expect(partnerPortal).not.toContain('id: "reviews"');
    expect(partnerPortal).not.toContain('id: "payments"');
    expect(partnerPortal).not.toContain('id: "notifications"');
    expect(partnerPortal).toContain('if (value === "appointments") return "bookings"');
    expect(partnerPortal).toContain('value === "pipeline" || value === "cases" || value === "payments"');
    expect(partnerPortal).toContain('return "casePayments"');
    expect(partnerPortal).toContain('if (value === "settings" || value === "notifications") return "account"');
    expect(partnerPortal).toContain("const ProfileView");
    expect(partnerPortal).toContain("const ReviewsView");
    expect(partnerPortal).toContain("const NotificationsView");
    expect(partnerPortal).toContain("const CasesPaymentsView");
    expect(partnerPortal).toContain("createPartnerCaseFromBooking");
    expect(partnerPortal).toContain("fetchPartnerCalendarConnections");
    expect(partnerPortal).toContain("createPartnerCalendarOAuthLink");
    expect(partnerPortal).toContain("markPartnerBookingNoShow");
    expect(partnerPortal).toContain("acceptPartnerBooking");
    expect(partnerPortal).toContain("fetchReviewsForLawyer");
    expect(partnerPortal).toContain("updateLawyerReview");
    expect(partnerPortal).toContain("border-amber-500/55 bg-amber-50");
    expect(partnerPortal).toContain("border-red-500/55 bg-red-50");
    expect(partnerPortal).toContain("border-emerald-600/35 bg-emerald-50");
    expect(partnerPortal).toContain("appointmentPageSize");
    expect(partnerPortal).toContain("Αναζήτηση πελάτη");
    expect(partnerPortal).not.toContain("bg-gold/10");
    expect(partnerPortal).not.toContain("bg-destructive/10");
    expect(partnerPortal).not.toContain('key: "needs-action"');
    expect(partnerPortal).not.toContain('key: "lawyer-profile"');
    expect(partnerPortal).not.toContain('label: "Προφίλ"');
    expect(partnerPortal).not.toContain('settingsFocus === "profile"');
    expect(partnerPortal).not.toContain('section", "profile"');
    expect(partnerPortal).not.toContain("Έλεγχος δημόσιας καταχώρισης");
    expect(partnerPortal).not.toContain("Ουρά ενεργειών");
    expect(partnerPortal).not.toContain("const PipelineView");
    expect(partnerPortal).not.toContain("const EarningsView");
    expect(partnerPortal).not.toContain("fetchPartnerCrmState");
    expect(partnerPortal).not.toContain("buildPartnerPipelineItems");
    expect(partnerPortal).not.toContain("Προτεινόμενη ενέργεια");
    expect(partnerPortal).not.toContain("Ολοκλήρωση ενέργειας");
    expect(partnerPortal).not.toContain("Δραστηριότητα υπόθεσης");
    expect(partnerPortal).not.toContain("fetchFunnelEvents");
    expect(partnerPortal).not.toContain("level4PipelineStatuses.map");
    expect(partnerPortal).not.toContain("Πιθανή επιστροφή");
    expect(partnerPortal).not.toContain("Πληρωμή σε εκκρεμότητα");
  });

  it("collects search listing, availability, and payment readiness during partner signup", () => {
    const partnerApply = readRepoFile("src/pages/PartnerApply.tsx");
    const forLawyersPlans = readRepoFile("src/pages/ForLawyersPlans.tsx");
    const platformRepository = readRepoFile("src/lib/platformRepository.ts");
    const partnerPortal = readRepoFile("src/pages/PartnerPortal.tsx");

    expect(partnerApply).toContain("publicProfile");
    expect(partnerApply).toContain("availability");
    expect(partnerApply).toContain("paymentDetails");
    expect(partnerApply).toContain('const initialPartnerPlanId = "basic"');
    expect(partnerApply).toContain("minimumPartnerConsultationPrices");
    expect(partnerApply).toContain("sessionDurationMinutes");
    expect(partnerApply).toContain("Η ελάχιστη διάρκεια ραντεβού είναι 20 λεπτά.");
    expect(partnerApply).toContain("availabilityBusinessHours.start");
    expect(partnerApply).toContain("validateAvailabilitySlot");
    expect(partnerApply).toContain("validateAvailabilitySchedule");
    expect(partnerApply).toContain("Οι τιμές εμφανίζονται δημόσια μετά την έγκριση.");
    expect(partnerApply).toContain("Απαραίτητα στοιχεία για απόδοση πληρωμών και παραστατικά.");
    expect(partnerApply).toContain("τουλάχιστον τρεις ενεργές ημέρες");
    expect(partnerApply).toContain('<option value="" disabled hidden>Επιλέξτε πόλη</option>');
    expect(partnerApply).toContain("Όλοι οι νέοι συνεργάτες ξεκινούν στο Βασικό πλάνο");
    expect(partnerApply).toContain("preferredPlanId: initialPartnerPlanId");
    expect(partnerApply).toContain("step === 3");
    expect(partnerApply).toContain("onClick={() => setStep(index)}");
    expect(partnerApply).not.toContain("index <= step && setStep(index)");
    expect(partnerApply).not.toContain("useSearchParams");
    expect(partnerApply).not.toContain("getInitialApplicationPlanId");
    expect(partnerApply).not.toContain('title: "Πλάνο"');
    expect(partnerApply).not.toContain("Πλάνο συνεργασίας");
    expect(partnerApply).not.toContain("PlanAnalysisPanel");
    expect(partnerApply).not.toContain("PlanChoiceCard");
    expect(partnerApply).not.toContain("modeDescriptionLabels");
    expect(partnerApply).not.toContain("videoDescription");
    expect(partnerApply).not.toContain("phoneDescription");
    expect(partnerApply).not.toContain("inPersonDescription");
    expect(partnerApply).not.toContain("Οικονομική ρύθμιση");
    expect(partnerApply).toContain('type="time"');
    expect(partnerApply).toContain("availabilityBusinessHours.end");
    expect(partnerApply).toContain("getAvailabilityValidationMessage");
    expect(partnerApply).toContain("step={1}");
    expect(forLawyersPlans).toContain("Κάθε νέος συνεργάτης ξεκινά στο Βασικό πλάνο");
    expect(forLawyersPlans).toContain("Αίτηση συνεργάτη");
    expect(forLawyersPlans).not.toContain("getPlanApplicationPath");
    expect(forLawyersPlans).not.toContain("/for-lawyers/apply?plan=");
    expect(forLawyersPlans).not.toContain("Συνέχεια στην αίτηση");
    expect(forLawyersPlans).not.toContain("/for-lawyers/login");
    expect(forLawyersPlans).not.toContain("Σύνδεση για επιλογή πλάνου");
    expect(platformRepository).toContain('preferredPlanId: "basic"');
    expect(platformRepository).toContain('p_preferred_plan_id: "basic"');
    expect(partnerPortal).toContain('id: "profile"');
    expect(partnerPortal).toContain("const ProfileView");
    expect(partnerPortal).toContain("fetchReviewsForLawyer");
    expect(partnerPortal).toContain("updateLawyerReview");
    expect(partnerPortal).not.toContain("get_partner_profile_photo_state");
  });
});
