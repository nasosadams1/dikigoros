import { trackFunnelEvent } from "@/lib/funnelAnalytics";
import { getPartnerPlan, type PartnerPlanId } from "@/lib/level4Marketplace";
import type { PartnerSession } from "@/lib/platformRepository";
import { publicSupabase } from "@/lib/supabase";

export type PartnerBillingInterval = "monthly" | "annual";

export interface PartnerSubscriptionCheckoutResult {
  provider: "stripe";
  status: "not_required" | "sales_only" | "checkout_required";
  planId: PartnerPlanId;
  billingInterval?: PartnerBillingInterval;
  id?: string;
  url?: string;
}

export const createPartnerSubscriptionCheckoutSession = async (
  planId: PartnerPlanId,
  partnerSession: PartnerSession | null,
  returnUrl = "/for-lawyers/portal?view=pipeline",
  billingInterval: PartnerBillingInterval = "monthly",
): Promise<PartnerSubscriptionCheckoutResult> => {
  const plan = getPartnerPlan(planId);
  if (plan.salesOnly) {
    return {
      provider: "stripe",
      status: "sales_only",
      planId,
      billingInterval,
    };
  }

  if (!plan.checkoutRequired) {
    return {
      provider: "stripe",
      status: "not_required",
      planId,
      billingInterval,
    };
  }

  if (!partnerSession?.sessionToken) {
    throw new Error("Απαιτείται σύνδεση συνεργάτη.");
  }

  const { data, error } = await publicSupabase.functions.invoke("create-partner-subscription-checkout-session", {
    body: {
      planId,
      partnerEmail: partnerSession.email,
      sessionToken: partnerSession.sessionToken,
      returnUrl,
      billingInterval,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error("Δεν ήταν δυνατό να ανοίξει η πληρωμή συνδρομής.");

  trackFunnelEvent("partner_plan_checkout_opened", {
    planId,
    billingInterval,
    source: "partner_plans",
  });

  return {
    provider: "stripe",
    status: "checkout_required",
    planId,
    billingInterval,
    id: data.id,
    url: data.url,
  };
};
