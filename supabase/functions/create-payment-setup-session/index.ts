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

interface AuthUser {
  id: string;
  email?: string;
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

const assertStripeMode = (secretKey: string) => {
  if (requiresLiveStripe() && !secretKey.startsWith("sk_live_")) {
    throw new Error("Live Stripe mode is required for payment setup.");
  }
};

const normalizeReturnUrl = (returnUrl: unknown, request: Request) => {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = request.headers.get("Origin")?.replace(/\/+$/, "") || "";
  const fallbackOrigin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  const fallbackUrl = `${fallbackOrigin}/account?tab=payments`;

  try {
    const parsedUrl = new URL(String(returnUrl || ""), fallbackOrigin);
    return allowedOrigins.includes(parsedUrl.origin)
      ? `${parsedUrl.origin}${parsedUrl.pathname}${parsedUrl.search}`
      : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
};

const getAuthUser = async (request: Request, supabaseUrl: string, anonKey: string): Promise<AuthUser | null> => {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authorization,
    },
  });

  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? { id: String(user.id), email: user.email ? String(user.email) : undefined } : null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const anonKey = getRequiredEnv("SUPABASE_ANON_KEY");
    const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
    assertStripeMode(stripeSecretKey);

    const user = await getAuthUser(request, supabaseUrl, anonKey);
    if (!user) return json(request, { error: "Authentication required" }, 401);

    const { returnUrl } = await request.json().catch(() => ({ returnUrl: "" }));
    const normalizedReturnUrl = normalizeReturnUrl(returnUrl, request);
    const separator = normalizedReturnUrl.includes("?") ? "&" : "?";

    const form = new URLSearchParams();
    form.set("mode", "setup");
    form.set("client_reference_id", user.id);
    if (user.email) form.set("customer_email", user.email);
    form.set("success_url", `${normalizedReturnUrl}${separator}setup=success&session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${normalizedReturnUrl}${separator}setup=cancelled`);
    form.set("metadata[user_id]", user.id);

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
      console.error("Stripe setup failed", payload.error?.message || payload);
      return json(request, { error: "Payment method setup could not be started. Try again or contact support." }, 400);
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
