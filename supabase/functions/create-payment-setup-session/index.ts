import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const stripeApiVersion = "2026-02-25.clover";

const defaultAllowedOrigins = [
  "https://dikigoros.gr",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const getAllowedOrigins = () => {
  const configuredOrigins = Deno.env.get("ALLOWED_APP_ORIGINS") || "";
  const appOrigin = Deno.env.get("APP_ORIGIN") || "";
  const origins = configuredOrigins
    .split(",")
    .concat(appOrigin)
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return origins.length > 0 ? Array.from(new Set(origins)) : defaultAllowedOrigins;
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

interface AuthUser {
  id: string;
  email?: string;
}

interface UserProfileRow {
  email?: string | null;
  payment_preferences?: Record<string, unknown> | null;
}

interface StripeCustomerResponse {
  id?: string;
  error?: {
    message?: string;
    code?: string;
    param?: string;
  };
}

interface StripeCheckoutSessionResponse {
  id?: string;
  url?: string;
  client_secret?: string;
  error?: {
    message?: string;
    code?: string;
    param?: string;
  };
}

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

const usesLiveStripeKey = () => (Deno.env.get("STRIPE_SECRET_KEY") || "").startsWith("sk_live_");

const requiresHttpsReturnUrl = () => requiresLiveStripe() || usesLiveStripeKey();

const isLocalReturnOrigin = (origin: string) => {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const assertStripeMode = (secretKey: string) => {
  if (requiresLiveStripe() && !secretKey.startsWith("sk_live_")) {
    throw new Error("Live Stripe mode is required for payment setup.");
  }
};

const normalizeReturnUrl = (returnUrl: unknown, request: Request) => {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = request.headers.get("Origin")?.replace(/\/+$/, "") || "";
  const liveReturnUrl = requiresHttpsReturnUrl();
  const httpsAllowedOrigin =
    allowedOrigins.find((origin) => {
      try {
        return new URL(origin).protocol === "https:";
      } catch {
        return false;
      }
    }) || allowedOrigins[0];
  const fallbackOrigin =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : liveReturnUrl
        ? httpsAllowedOrigin
        : allowedOrigins[0];
  const fallbackUrl = `${fallbackOrigin}/account?tab=payments`;

  try {
    const parsedUrl = new URL(String(returnUrl || ""), fallbackOrigin);
    const trustedOrigin = allowedOrigins.includes(parsedUrl.origin);
    const secureReturn = !liveReturnUrl || parsedUrl.protocol === "https:" || isLocalReturnOrigin(parsedUrl.origin);
    return trustedOrigin && secureReturn
      ? `${parsedUrl.origin}${parsedUrl.pathname}${parsedUrl.search}`
      : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
};

const getAuthUser = async (
  request: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<AuthUser | null> => {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;

  const token = authorization.replace(/^bearer\s+/i, "").trim();
  if (!token) return null;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.id) return null;

  return { id: user.id, email: user.email || undefined };
};

const getStripeCustomerId = (paymentPreferences: Record<string, unknown> | null | undefined) => {
  const candidate = paymentPreferences?.stripeCustomerId || paymentPreferences?.stripe_customer_id;
  return typeof candidate === "string" && candidate.startsWith("cus_") ? candidate : "";
};

const isInvalidStripeCustomerError = (payload: StripeCheckoutSessionResponse) => {
  const message = payload.error?.message?.toLowerCase() || "";
  return payload.error?.code === "resource_missing" && (payload.error?.param === "customer" || message.includes("customer"));
};

const createStripeCustomer = async (stripeSecretKey: string, user: AuthUser, profileEmail?: string | null) => {
  const form = new URLSearchParams();
  const email = user.email || profileEmail || "";
  if (email) form.set("email", email);
  form.set("metadata[user_id]", user.id);

  const response = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": stripeApiVersion,
    },
    body: form,
  });

  const payload = (await response.json()) as StripeCustomerResponse;
  if (!response.ok || !payload.id) {
    console.error("Stripe customer creation failed", payload.error?.message || payload);
    throw new Error("Payment customer could not be created.");
  }

  return payload.id;
};

const persistStripeCustomerId = async (
  supabase: ReturnType<typeof createClient>,
  user: AuthUser,
  stripeCustomerId: string,
  profileEmail?: string | null,
  paymentPreferences: Record<string, unknown> = {},
) => {
  const { error: upsertError } = await supabase.from("user_profiles").upsert({
    id: user.id,
    email: user.email || profileEmail || "",
    payment_preferences: {
      ...paymentPreferences,
      provider: "stripe",
      stripeCustomerId,
      status: "setup_required",
      setupRequestedAt: new Date().toISOString(),
    },
  });
  if (upsertError) throw upsertError;
};

const getOrCreateStripeCustomer = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  stripeSecretKey: string,
  user: AuthUser,
) => {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: profileRow, error: profileError } = await supabase
    .from("user_profiles")
    .select("email,payment_preferences")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const profile = (profileRow || {}) as UserProfileRow;
  const paymentPreferences = profile.payment_preferences || {};
  const existingStripeCustomerId = getStripeCustomerId(paymentPreferences);
  if (existingStripeCustomerId) {
    return {
      stripeCustomerId: existingStripeCustomerId,
      profileEmail: profile.email,
      paymentPreferences,
    };
  }

  const stripeCustomerId = await createStripeCustomer(stripeSecretKey, user, profile.email);
  await persistStripeCustomerId(supabase, user, stripeCustomerId, profile.email, paymentPreferences);

  return {
    stripeCustomerId,
    profileEmail: profile.email,
    paymentPreferences,
  };
};

const createSetupCheckoutSession = async (
  stripeSecretKey: string,
  user: AuthUser,
  stripeCustomerId: string,
  normalizedReturnUrl: string,
  separator: string,
) => {
  const form = new URLSearchParams();
  form.set("mode", "setup");
  form.append("payment_method_types[]", "card");
  form.set("client_reference_id", user.id);
  form.set("customer", stripeCustomerId);
  form.set("success_url", `${normalizedReturnUrl}${separator}setup=success&session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${normalizedReturnUrl}${separator}setup=cancelled`);
  form.set("metadata[user_id]", user.id);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": stripeApiVersion,
    },
    body: form,
  });

  const payload = (await response.json()) as StripeCheckoutSessionResponse;
  return { ok: response.ok, payload };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
    assertStripeMode(stripeSecretKey);

    const user = await getAuthUser(request, supabaseUrl, serviceRoleKey);
    if (!user) return json(request, { error: "Authentication required" }, 401);

    const { returnUrl } = await request.json().catch(() => ({ returnUrl: "" }));
    const normalizedReturnUrl = normalizeReturnUrl(returnUrl, request);
    const separator = normalizedReturnUrl.includes("?") ? "&" : "?";
    const customerContext = await getOrCreateStripeCustomer(supabaseUrl, serviceRoleKey, stripeSecretKey, user);
    let setupSession = await createSetupCheckoutSession(
      stripeSecretKey,
      user,
      customerContext.stripeCustomerId,
      normalizedReturnUrl,
      separator,
    );

    if (!setupSession.ok && isInvalidStripeCustomerError(setupSession.payload)) {
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      const replacementCustomerId = await createStripeCustomer(stripeSecretKey, user, customerContext.profileEmail);
      await persistStripeCustomerId(
        supabase,
        user,
        replacementCustomerId,
        customerContext.profileEmail,
        customerContext.paymentPreferences,
      );
      setupSession = await createSetupCheckoutSession(
        stripeSecretKey,
        user,
        replacementCustomerId,
        normalizedReturnUrl,
        separator,
      );
    }

    const payload = setupSession.payload;
    if (!setupSession.ok) {
      console.error("Stripe setup failed", payload.error?.message || payload);
      return json(
        request,
        {
          error: payload.error?.message || "Payment method setup could not be started. Try again or contact support.",
          code: payload.error?.code || "stripe_setup_failed",
          param: payload.error?.param || null,
        },
        400,
      );
    }

    return json(request, {
      provider: "stripe",
      status: "setup_required",
      id: payload.id,
      url: payload.url,
      clientSecret: payload.client_secret,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe setup failed";
    return json(request, { error: message }, 500);
  }
});
