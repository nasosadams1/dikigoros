import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const productionSchema = readFileSync(
  join(process.cwd(), "supabase", "desired_supabase_from_scratch.sql"),
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
const partnerCodeFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "partner-access-code", "index.ts"),
  "utf8",
);
const partnerDocumentUrlFunction = readFileSync(
  join(process.cwd(), "supabase", "functions", "create-partner-document-url", "index.ts"),
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
  });

  it("ships a partner-session RPC for saving lawyer profile workspaces", () => {
    expect(productionSchema).toContain("create or replace function public.save_partner_workspace_as_partner");
    expect(productionSchema).toContain("LAWYER_PROFILE_NOT_FOUND");
    expect(productionSchema).toContain("grant execute on function public.save_partner_workspace_as_partner");
  });

  it("keeps browser mutations behind RPCs instead of direct table updates", () => {
    expect(productionSchema).toContain("create or replace function public.cancel_booking_as_user");
    expect(productionSchema).toContain("create or replace function public.update_review_as_partner");
    expect(productionSchema).toContain("create or replace function public.get_partner_document_storage_path");
    expect(productionSchema).toContain("SELF_BOOKING_FORBIDDEN");
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
    [checkoutFunction, setupFunction, partnerCodeFunction, partnerDocumentUrlFunction].forEach((source) => {
      expect(source).toContain("ALLOWED_APP_ORIGINS");
      expect(source).toContain("http://localhost:8080");
      expect(source).not.toContain('"Access-Control-Allow-Origin": "*"');
    });
  });
});
