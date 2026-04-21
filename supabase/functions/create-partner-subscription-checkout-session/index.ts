const stripeApiVersion = "2026-02-25.clover";

const defaultAllowedOrigins = [
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const getAllowedOrigins = () => {
  const configuredOrigins = Deno.env.get("ALLOWED_APP_ORIGINS") || Deno.env.get("APP_ORIGIN") || "";
  const origins = configuredOrigins
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return origins.length > 0 ? origins : defaultAllowedOrigins;
};

const getCorsHeaders = (request: Request) => {
  const requestOrigin = request.headers.get("Origin")?.replace(/\/+$/, "") || "";
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(request),
      "Content-Type": "application/json",
    },
  });

const getRequiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const requiresLiveStripe = () =>
  Deno.env.get("REQUIRE_LIVE_STRIPE") === "true" || Deno.env.get("STRIPE_REQUIRE_LIVE_MODE") === "true";

const assertStripeMode = (secretKey: string) => {
  if (requiresLiveStripe() && !secretKey.startsWith("sk_live_")) {
    throw new Error("Live Stripe mode is required for partner subscriptions.");
  }
};

const normalizeReturnUrl = (returnUrl: unknown, request: Request) => {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = request.headers.get("Origin")?.replace(/\/+$/, "") || "";
  const fallbackOrigin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  const fallbackUrl = `${fallbackOrigin}/for-lawyers/portal?view=pipeline`;

  try {
    const parsedUrl = new URL(String(returnUrl || ""), fallbackOrigin);
    return allowedOrigins.includes(parsedUrl.origin)
      ? `${parsedUrl.origin}${parsedUrl.pathname}${parsedUrl.search}`
      : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
};

const serviceHeaders = (serviceRoleKey: string) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
});

const priceConfigs: Record<string, Record<string, {
  envName: string;
  fallbackEnvName?: string;
  expectedUnitAmount: number;
  expectedInterval: "month" | "year";
}>> = {
  pro: {
    monthly: {
      envName: "STRIPE_PARTNER_PRO_MONTHLY_PRICE_ID",
      fallbackEnvName: "STRIPE_PARTNER_PRO_PRICE_ID",
      expectedUnitAmount: 2900,
      expectedInterval: "month",
    },
    annual: {
      envName: "STRIPE_PARTNER_PRO_ANNUAL_PRICE_ID",
      expectedUnitAmount: 27600,
      expectedInterval: "year",
    },
  },
  premium: {
    monthly: {
      envName: "STRIPE_PARTNER_PREMIUM_MONTHLY_PRICE_ID",
      fallbackEnvName: "STRIPE_PARTNER_PREMIUM_PRICE_ID",
      expectedUnitAmount: 9999,
      expectedInterval: "month",
    },
    annual: {
      envName: "STRIPE_PARTNER_PREMIUM_ANNUAL_PRICE_ID",
      expectedUnitAmount: 100788,
      expectedInterval: "year",
    },
  },
};

const normalizeBillingInterval = (billingInterval: unknown) =>
  String(billingInterval || "").trim().toLowerCase() === "annual" ? "annual" : "monthly";

const getPriceConfig = (planId: string, billingInterval: string) =>
  priceConfigs[planId]?.[billingInterval] || null;

const getConfiguredPriceId = (config: { envName: string; fallbackEnvName?: string }) => {
  const priceId = Deno.env.get(config.envName) || (config.fallbackEnvName ? Deno.env.get(config.fallbackEnvName) : "") || "";
  return priceId.includes("...") || priceId.startsWith("price_replace") ? "" : priceId;
};

const assertStripePriceMatchesPlan = async (
  stripeSecretKey: string,
  priceId: string,
  config: { expectedUnitAmount: number; expectedInterval: "month" | "year" },
) => {
  const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Stripe-Version": stripeApiVersion,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error("Stripe price could not be verified.");
  }

  const unitAmount = Number(payload.unit_amount || 0);
  const currency = String(payload.currency || "").toLowerCase();
  const interval = String(payload.recurring?.interval || "");
  if (currency !== "eur" || unitAmount !== config.expectedUnitAmount || interval !== config.expectedInterval) {
    throw new Error("Stripe price does not match the published partner plan.");
  }
};

const fetchPartnerContext = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  partnerEmail: string,
  sessionToken: string,
  planId: string,
  billingInterval: string,
  stripePriceId: string,
  planAmountCents: number,
) => {
  const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/get_partner_subscription_checkout_context`, {
    method: "POST",
    headers: serviceHeaders(serviceRoleKey),
    body: JSON.stringify({
      p_partner_email: partnerEmail,
      p_session_token: sessionToken,
      p_plan_id: planId,
      p_billing_interval: billingInterval,
      p_stripe_price_id: stripePriceId,
      p_plan_amount_cents: planAmountCents,
    }),
  });

  if (!response.ok) throw new Error(`Partner subscription context failed: ${await response.text()}`);
  return response.json();
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
    assertStripeMode(stripeSecretKey);

    const { planId, partnerEmail, sessionToken, returnUrl, billingInterval } = await request.json();
    const normalizedPlanId = String(planId || "").trim().toLowerCase();
    const normalizedBillingInterval = normalizeBillingInterval(billingInterval);
    if (!["basic", "pro", "premium", "firms"].includes(normalizedPlanId)) {
      return json(request, { error: "Unsupported partner plan" }, 400);
    }
    if (!partnerEmail || !sessionToken) return json(request, { error: "Partner session required" }, 401);
    if (normalizedPlanId === "basic") {
      return json(request, { provider: "stripe", status: "not_required", planId: "basic", billingInterval: normalizedBillingInterval });
    }
    if (normalizedPlanId === "firms") {
      return json(request, { provider: "stripe", status: "sales_only", planId: "firms", billingInterval: normalizedBillingInterval });
    }

    const priceConfig = getPriceConfig(normalizedPlanId, normalizedBillingInterval);
    if (!priceConfig) return json(request, { error: "Unsupported billing interval" }, 400);

    const priceId = getConfiguredPriceId(priceConfig);
    if (!priceId) return json(request, { error: `Missing Stripe price for ${normalizedPlanId} ${normalizedBillingInterval}` }, 500);
    await assertStripePriceMatchesPlan(stripeSecretKey, priceId, priceConfig);

    const context = await fetchPartnerContext(
      supabaseUrl,
      serviceRoleKey,
      String(partnerEmail),
      String(sessionToken),
      normalizedPlanId,
      normalizedBillingInterval,
      priceId,
      priceConfig.expectedUnitAmount,
    );
    if (!context?.lawyer_id || !context?.partner_email) {
      return json(request, { error: "Partner account not found" }, 403);
    }

    const normalizedReturnUrl = normalizeReturnUrl(returnUrl, request);
    const separator = normalizedReturnUrl.includes("?") ? "&" : "?";
    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("client_reference_id", String(context.lawyer_id));
    form.set("customer_email", String(context.partner_email));
    form.set("success_url", `${normalizedReturnUrl}${separator}subscription=success&session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${normalizedReturnUrl}${separator}subscription=cancelled`);
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price]", priceId);
    form.set("metadata[subscription_kind]", "partner_plan");
    form.set("metadata[partner_email]", String(context.partner_email));
    form.set("metadata[lawyer_id]", String(context.lawyer_id));
    form.set("metadata[plan_id]", normalizedPlanId);
    form.set("metadata[billing_interval]", normalizedBillingInterval);
    form.set("metadata[stripe_price_id]", priceId);
    form.set("metadata[plan_amount_cents]", String(priceConfig.expectedUnitAmount));
    form.set("subscription_data[metadata][subscription_kind]", "partner_plan");
    form.set("subscription_data[metadata][partner_email]", String(context.partner_email));
    form.set("subscription_data[metadata][lawyer_id]", String(context.lawyer_id));
    form.set("subscription_data[metadata][plan_id]", normalizedPlanId);
    form.set("subscription_data[metadata][billing_interval]", normalizedBillingInterval);
    form.set("subscription_data[metadata][stripe_price_id]", priceId);
    form.set("subscription_data[metadata][plan_amount_cents]", String(priceConfig.expectedUnitAmount));

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": stripeApiVersion,
      },
      body: form,
    });

    const payload = await stripeResponse.json();
    if (!stripeResponse.ok) {
      console.error("Stripe partner subscription checkout failed", payload.error?.message || payload);
      return json(request, { error: "Subscription checkout could not be started." }, 400);
    }

    return json(request, {
      provider: "stripe",
      status: "checkout_required",
      planId: normalizedPlanId,
      billingInterval: normalizedBillingInterval,
      id: payload.id,
      url: payload.url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Partner subscription checkout failed";
    return json(request, { error: message }, 500);
  }
});
