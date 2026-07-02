import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const productionSchema = readFileSync(
  join(process.cwd(), "supabase", "desired_supabase_from_scratch.sql"),
  "utf8",
);
const supabaseConfig = readFileSync(
  join(process.cwd(), "supabase", "config.toml"),
  "utf8",
);
const packageJson = readFileSync(join(process.cwd(), "package.json"), "utf8");
const simpleContractMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260414170000_simple_production_contract.sql"),
  "utf8",
);
const checkoutFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "create-booking-checkout-session", "index.ts"),
  "utf8",
);
const setupFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "create-payment-setup-session", "index.ts"),
  "utf8",
);
const refundFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "create-booking-refund", "index.ts"),
  "utf8",
);
const webhookFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "stripe-webhook", "index.ts"),
  "utf8",
);
const partnerCodeFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "partner-access-code", "index.ts"),
  "utf8",
);
const partnerDocumentUrlFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "create-partner-document-url", "index.ts"),
  "utf8",
);
const partnerProfilePhotoFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "submit-partner-profile-photo", "index.ts"),
  "utf8",
);
const partnerSubscriptionCheckoutFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "create-partner-subscription-checkout-session", "index.ts"),
  "utf8",
);
const calendarOAuthLinkFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "create-calendar-oauth-link", "index.ts"),
  "utf8",
);
const calendarOAuthCallbackFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "calendar-oauth-callback", "index.ts"),
  "utf8",
);
const partnerCalendarBusyFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "get-partner-calendar-busy", "index.ts"),
  "utf8",
);
const partnerCalendarAvailabilityFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "check-partner-calendar-availability", "index.ts"),
  "utf8",
);
const calendarSyncShared = readFileSync(
  join(process.cwd(), "supabase", "functions", "_shared", "calendar-sync.ts"),
  "utf8",
);
const reconciliationFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "reconcile-stripe-payments", "index.ts"),
  "utf8",
);
const partnerSignupReadinessMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260501120000_partner_signup_public_readiness.sql"),
  "utf8",
);

describe("Supabase production contracts", () => {
  it("ships the verified review RPC used by the account profile", () => {
    expect(productionSchema).toContain("create or replace function public.submit_booking_review");
    expect(productionSchema).toContain("BOOKING_NOT_COMPLETED");
  });

  it("requires partner session tokens for partner-only booking mutations", () => {
    expect(productionSchema).toContain("create table if not exists public.partner_sessions");
    expect(productionSchema).toContain("ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)");
    expect(productionSchema).toContain("create or replace function public.complete_booking_as_partner");
    expect(productionSchema).toContain("now() + interval '2 hours'");
    expect(productionSchema).toContain("create table if not exists public.partner_session_audit_events");
    expect(productionSchema).toContain("'session_issued'");
    expect(productionSchema).not.toContain("'742913'");
  });

  it("ships a partner-session RPC for saving lawyer profile workspaces", () => {
    expect(productionSchema).toContain("create or replace function public.save_partner_workspace_as_partner");
    expect(productionSchema).toContain("LAWYER_PROFILE_NOT_FOUND");
    expect(productionSchema).toContain("grant execute on function public.save_partner_workspace_as_partner");
  });

  it("keeps browser mutations behind RPCs instead of direct table updates", () => {
    expect(productionSchema).toContain("create or replace function public.cancel_booking_as_user");
    expect(productionSchema).toContain("AUTH_REQUIRED_FOR_BOOKING");
    expect(productionSchema).toContain("create or replace function public.create_operational_case");
    expect(productionSchema).toContain("create or replace function public.submit_partner_application");
    expect(productionSchema).toContain("create or replace function public.update_review_as_partner");
    expect(productionSchema).toContain("create or replace function public.get_partner_document_storage_path");
    expect(productionSchema).toContain("SELF_BOOKING_FORBIDDEN");
    expect(productionSchema).toContain("OPERATIONAL_CASE_FORBIDDEN");
    expect(productionSchema).toContain("INVALID_PARTNER_APPLICATION_EMAIL");
    expect(simpleContractMigration).toContain('drop policy if exists "Users can update own booking requests"');
    expect(productionSchema).not.toContain('create policy "Users can update own booking requests"');
    expect(productionSchema).not.toContain('create policy "Partners can update own review replies"');
  });

  it("stores public search and payment readiness during partner signup", () => {
    [
      "public_profile jsonb not null default '{}'::jsonb",
      "availability jsonb not null default '[]'::jsonb",
      "payment_details jsonb not null default '{}'::jsonb",
      "p_public_profile jsonb default '{}'::jsonb",
      "p_availability jsonb default '[]'::jsonb",
      "p_payment_details jsonb default '{}'::jsonb",
      "INVALID_PARTNER_PUBLIC_PROFILE",
      "INVALID_PARTNER_AVAILABILITY",
      "INVALID_PARTNER_PAYMENT_DETAILS",
      "nomos_is_valid_partner_availability",
      "nomos_validate_partner_profile_settings_availability",
      "before insert or update of profile, availability, published_availability, is_public",
      "start_minutes < 480",
      "end_minutes > 1320",
      "normalized_preferred_plan_id text := 'basic'",
      "normalized_public_profile jsonb := coalesce(p_public_profile, '{}'::jsonb)",
      "normalized_availability jsonb := coalesce(p_availability, '[]'::jsonb)",
      "normalized_payment_details jsonb := coalesce(p_payment_details, '{}'::jsonb)",
      "public_profile = normalized_public_profile",
      "availability = normalized_availability",
      "payment_details = normalized_payment_details",
    ].forEach((contract) => expect(productionSchema).toContain(contract));

    expect(partnerSignupReadinessMigration).toContain("add column if not exists public_profile jsonb not null default '{}'::jsonb");
    expect(partnerSignupReadinessMigration).toContain("add column if not exists availability jsonb not null default '[]'::jsonb");
    expect(partnerSignupReadinessMigration).toContain("add column if not exists payment_details jsonb not null default '{}'::jsonb");
    expect(partnerSignupReadinessMigration).toContain("nomos_is_valid_partner_availability");
    expect(partnerSignupReadinessMigration).toContain("nomos_validate_partner_profile_settings_availability");
    expect(partnerSignupReadinessMigration).toContain("normalized_preferred_plan_id text := 'basic'");
    expect(partnerSignupReadinessMigration).toContain("drop function if exists public.submit_partner_application");
    expect(partnerSignupReadinessMigration).toContain("notify pgrst, 'reload schema'");
  });

  it("removes client-side payment mutation policies", () => {
    expect(productionSchema).toContain('drop policy if exists "Users can create own pending payments"');
    expect(productionSchema).toContain('drop policy if exists "Users can update own pending payments"');
    expect(productionSchema).not.toContain('create policy "Users can create own pending payments"');
  });

  it("restricts browser-callable Edge Functions to configured app origins", () => {
    [
      checkoutFunction,
      setupFunction,
      refundFunction,
      partnerCodeFunction,
      partnerDocumentUrlFunction,
      partnerProfilePhotoFunction,
      partnerSubscriptionCheckoutFunction,
    ].forEach((source) => {
      expect(source).toContain("ALLOWED_APP_ORIGINS");
      expect(source).toContain("https://dikigoros-oud1.vercel.app");
      expect(source).toContain("http://127.0.0.1:5173");
      expect(source).toContain(".concat(defaultAllowedOrigins)");
      expect(source).toContain("http://localhost:8080");
      expect(source).not.toContain('"Access-Control-Allow-Origin": "*"');
    });
  });

  it("enforces live Stripe mode and prevents multiple active checkout paths", () => {
    [checkoutFunction, setupFunction, refundFunction, webhookFunction].forEach((source) => {
      expect(source).toContain("REQUIRE_LIVE_STRIPE");
      expect(source).toContain("sk_live_");
    });
    [checkoutFunction, setupFunction, refundFunction].forEach((source) => {
      expect(source).toContain("supabase.auth.getUser(token)");
      expect(source).not.toContain("/auth/v1/user");
    });
    expect(supabaseConfig).toContain("[functions.create-booking-checkout-session]");
    expect(supabaseConfig).toContain("[functions.create-payment-setup-session]");
    expect(supabaseConfig).toContain("[functions.create-booking-refund]");
    expect(supabaseConfig.match(/verify_jwt = false/g)?.length).toBeGreaterThanOrEqual(3);
    expect(checkoutFunction).toContain('existingPayment?.status === "checkout_opened"');
    expect(checkoutFunction).toContain("existingPayment.checkout_session_url");
    expect(checkoutFunction).toContain("This booking has already been paid.");
    expect(checkoutFunction).toContain("claimGuestBookingForUser");
    expect(checkoutFunction).toContain("client_email");
    expect(setupFunction).toContain("getOrCreateStripeCustomer");
    expect(setupFunction).toContain("isInvalidStripeCustomerError");
    expect(setupFunction).toContain("replacementCustomerId");
    expect(setupFunction).toContain("requiresHttpsReturnUrl");
    expect(setupFunction).toContain("isLocalReturnOrigin");
    expect(setupFunction).toContain("https://api.stripe.com/v1/customers");
    expect(setupFunction).toContain('form.append("payment_method_types[]", "card")');
    expect(setupFunction).toContain('form.set("customer", stripeCustomerId)');
    expect(setupFunction).not.toContain('form.set("customer_email"');
  });

  it("keeps Stripe settlement replay-safe and reconciled", () => {
    expect(productionSchema).toContain("create table if not exists public.booking_payment_events");
    expect(productionSchema).toContain("create table if not exists public.payment_reconciliation_runs");
    expect(productionSchema).toContain("create table if not exists public.payment_reconciliation_mismatches");
    expect(webhookFunction).toContain("verifyStripeSignature");
    expect(webhookFunction).toContain('request.headers.get("stripe-signature")');
    expect(webhookFunction).toContain("replay: true");
    expect(webhookFunction).toContain("orphan_stripe_event");
    expect(reconciliationFunction).toContain("state_mismatch");
    expect(reconciliationFunction).toContain("missing_receipt");
  });

  it("blocks document access until malware scan is clean and audit logged", () => {
    expect(productionSchema).toContain("malware_scan_status text not null default 'pending'");
    expect(productionSchema).toContain("create table if not exists public.document_access_audit_events");
    expect(productionSchema).toContain("ud.malware_scan_status = 'clean'");
    expect(productionSchema).toContain("insert into public.document_access_audit_events");
  });

  it("keeps partner profile photos pending until operations approval", () => {
    expect(productionSchema).toContain("create table if not exists public.partner_profile_photo_submissions");
    expect(productionSchema).toContain("status text not null default 'pending'");
    expect(productionSchema).toContain("create or replace function public.submit_partner_profile_photo");
    expect(productionSchema).toContain("create or replace function public.review_partner_profile_photo_submission");
    expect(productionSchema).toContain("update public.lawyer_profiles");
    expect(productionSchema).toContain("set image = target_submission.candidate_public_url");
    expect(partnerProfilePhotoFunction).toContain("get_partner_profile_photo_state");
    expect(partnerProfilePhotoFunction).toContain("submit_partner_profile_photo");
    expect(partnerProfilePhotoFunction).toContain("PARTNER_SESSION_INVALID");
  });

  it("supports partner cancellation and requires payment before partner completion", () => {
    expect(productionSchema).toContain("create or replace function public.cancel_booking_as_partner");
    expect(productionSchema).toContain("cancellation_actor = 'lawyer'");
    expect(productionSchema).toContain("reschedule_requested = true");
    expect(productionSchema).toContain("and status = 'confirmed_paid'");
    expect(productionSchema).toContain("BOOKING_NOT_FOUND_OR_NOT_PAID");
  });

  it("ships real partner cases and calendar sync contracts", () => {
    [
      "create table if not exists public.partner_cases",
      "create table if not exists public.partner_case_booking_links",
      "create table if not exists public.partner_case_private_notes",
      "create table if not exists public.partner_calendar_connections",
      "status text not null default 'new'",
      "access_token_ciphertext text",
      "refresh_token_ciphertext text",
      "time_off jsonb not null default '[]'::jsonb",
      "grant execute on function public.accept_booking_as_partner",
      "grant execute on function public.mark_booking_no_show_as_partner",
      "grant execute on function public.create_partner_case_from_booking",
      "grant execute on function public.list_partner_calendar_connections",
      "grant execute on function public.disconnect_partner_calendar_connection",
    ].forEach((contract) => expect(productionSchema).toContain(contract));

    [
      "[functions.create-calendar-oauth-link]",
      "[functions.calendar-oauth-callback]",
      "[functions.get-partner-calendar-busy]",
      "[functions.check-partner-calendar-availability]",
    ].forEach((contract) => expect(supabaseConfig).toContain(contract));

    [
      "create-calendar-oauth-link",
      "calendar-oauth-callback",
      "get-partner-calendar-busy",
      "check-partner-calendar-availability",
    ].forEach((functionName) => expect(packageJson).toContain(functionName));

    expect(calendarOAuthLinkFunction).toContain("calendar.freebusy");
    expect(calendarOAuthLinkFunction).not.toContain("MICROSOFT_CALENDAR");
    expect(calendarOAuthCallbackFunction).not.toContain("MICROSOFT_CALENDAR");
    expect(calendarOAuthCallbackFunction).toContain("partner_calendar_connections");
    expect(calendarOAuthCallbackFunction).toContain("CALENDAR_TOKEN_SECRET");
    expect(partnerCalendarBusyFunction).toContain("https://www.googleapis.com/calendar/v3/freeBusy");
    expect(partnerCalendarBusyFunction).not.toContain("/me/calendar/calendarView");
    expect(partnerCalendarAvailabilityFunction).toContain("BOOKING_SLOT_UNAVAILABLE");
    expect(partnerCalendarAvailabilityFunction).toContain("Europe/Athens");
    expect(partnerCalendarAvailabilityFunction).not.toContain("MICROSOFT_CALENDAR");
    expect(calendarSyncShared).toContain("refresh_token");
    expect(calendarSyncShared).toContain("crypto.subtle.encrypt");
    expect(calendarSyncShared).toContain("crypto.subtle.decrypt");
    expect(calendarSyncShared).not.toContain("refreshMicrosoftAccessToken");
  });

  it("ships Level 4 marketplace engine contracts", () => {
    [
      "create table if not exists public.partner_subscriptions",
      "create table if not exists public.partner_pipeline_items",
      "create table if not exists public.partner_case_notes",
      "create table if not exists public.partner_followup_tasks",
      "partner_plan text not null default 'basic'",
      "visibility_tier text not null default 'basic'",
      "completed_consultations integer not null default 0",
      "partner_platform_fee_cents integer not null default 0",
      "partner_net_amount_cents integer",
      "partner_fee_status text not null default 'not_applicable'",
      "billing_interval text not null default 'monthly'",
      "stripe_price_id text",
      "plan_amount_cents integer not null default 0",
      "platform_fee_cents := case when active_partner_plan_id = 'basic' then 700 else 0 end",
      "completed_consultations = completed_consultations + 1",
    ].forEach((contract) => expect(productionSchema).toContain(contract));

    [
      "create or replace function public.save_partner_case_note",
      "create or replace function public.upsert_partner_followup_task",
      "create or replace function public.update_partner_pipeline_status",
      "create or replace function public.get_partner_subscription_checkout_context",
      "create or replace function public.get_partner_workspace_as_partner",
    ].forEach((contract) => expect(productionSchema).toContain(contract));

    const checkoutContextStart = productionSchema.indexOf("create or replace function public.get_partner_subscription_checkout_context");
    const checkoutContextEnd = productionSchema.indexOf("grant execute on function public.get_partner_subscription_checkout_context", checkoutContextStart);
    const checkoutContext = productionSchema.slice(checkoutContextStart, checkoutContextEnd);
    expect(checkoutContext).toContain("public.get_partner_session_lawyer_id(p_partner_email, p_session_token)");
    expect(checkoutContext).toContain("PARTNER_SESSION_INVALID");

    expect(supabaseConfig).toContain("[functions.create-partner-subscription-checkout-session]");
    expect(partnerSubscriptionCheckoutFunction).toContain("ALLOWED_APP_ORIGINS");
    expect(partnerSubscriptionCheckoutFunction).toContain("REQUIRE_LIVE_STRIPE");
    expect(partnerSubscriptionCheckoutFunction).toContain("sk_live_");
    expect(partnerSubscriptionCheckoutFunction).toContain("STRIPE_PARTNER_PRO_MONTHLY_PRICE_ID");
    expect(partnerSubscriptionCheckoutFunction).toContain("STRIPE_PARTNER_PRO_ANNUAL_PRICE_ID");
    expect(partnerSubscriptionCheckoutFunction).toContain("STRIPE_PARTNER_PREMIUM_MONTHLY_PRICE_ID");
    expect(partnerSubscriptionCheckoutFunction).toContain("STRIPE_PARTNER_PREMIUM_ANNUAL_PRICE_ID");
    expect(partnerSubscriptionCheckoutFunction).toContain("assertStripePriceMatchesPlan");
    expect(partnerSubscriptionCheckoutFunction).toContain("expectedUnitAmount: 2900");
    expect(partnerSubscriptionCheckoutFunction).toContain("expectedUnitAmount: 27600");
    expect(partnerSubscriptionCheckoutFunction).toContain("expectedUnitAmount: 9999");
    expect(partnerSubscriptionCheckoutFunction).toContain("expectedUnitAmount: 100788");
    expect(partnerSubscriptionCheckoutFunction).toContain("billing_interval");
    expect(partnerSubscriptionCheckoutFunction).toContain("sales_only");
    expect(partnerSubscriptionCheckoutFunction).toContain('form.set("mode", "subscription")');
    expect(webhookFunction).toContain("on_conflict=partner_email,lawyer_id");
    expect(webhookFunction).toContain("billing_interval");
    expect(webhookFunction).toContain("stripe_price_id");
    expect(webhookFunction).toContain("plan_amount_cents");
    expect(webhookFunction).toContain("partner_subscriptions");
    expect(webhookFunction).toContain("partner_plan");
    expect(webhookFunction).toContain("customer.subscription.updated");
  });
});
