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
const reconciliationFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "reconcile-stripe-payments", "index.ts"),
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

  it("removes client-side payment mutation policies", () => {
    expect(productionSchema).toContain('drop policy if exists "Users can create own pending payments"');
    expect(productionSchema).toContain('drop policy if exists "Users can update own pending payments"');
    expect(productionSchema).not.toContain('create policy "Users can create own pending payments"');
  });

  it("restricts browser-callable Edge Functions to configured app origins", () => {
    [checkoutFunction, setupFunction, partnerCodeFunction, partnerDocumentUrlFunction, partnerProfilePhotoFunction].forEach((source) => {
      expect(source).toContain("ALLOWED_APP_ORIGINS");
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
    ].forEach((contract) => expect(productionSchema).toContain(contract));

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
