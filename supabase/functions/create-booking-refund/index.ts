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

interface PaymentRow {
  booking_id: string;
  user_id: string | null;
  lawyer_id: string;
  amount: number;
  status: "not_opened" | "checkout_opened" | "paid" | "failed" | "refund_requested" | "refunded" | "pending";
  stripe_payment_intent_id: string | null;
  provider_payload?: Record<string, unknown> | null;
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
    throw new Error("Live Stripe mode is required for booking refunds.");
  }
};

const serviceHeaders = (serviceRoleKey: string) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
});

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

const fetchPayment = async (supabaseUrl: string, serviceRoleKey: string, bookingId: string) => {
  const select = [
    "booking_id",
    "user_id",
    "lawyer_id",
    "amount",
    "status",
    "stripe_payment_intent_id",
    "provider_payload",
  ].join(",");
  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_payments?booking_id=eq.${encodeURIComponent(bookingId)}&select=${select}`,
    { headers: serviceHeaders(serviceRoleKey) },
  );

  if (!response.ok) throw new Error(`Payment lookup failed: ${await response.text()}`);
  const rows = (await response.json()) as PaymentRow[];
  return rows[0] || null;
};

const patchPayment = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  bookingId: string,
  updates: Record<string, unknown>,
) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_payments?booking_id=eq.${encodeURIComponent(bookingId)}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(serviceRoleKey),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        ...updates,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!response.ok) throw new Error(`Payment update failed: ${await response.text()}`);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const anonKey = getRequiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
    assertStripeMode(stripeSecretKey);

    const user = await getAuthUser(request, supabaseUrl, anonKey);
    if (!user) return json(request, { error: "Authentication required" }, 401);

    const { bookingId, reason = "requested_by_customer" } = await request.json();
    if (!bookingId) return json(request, { error: "bookingId is required" }, 400);

    const payment = await fetchPayment(supabaseUrl, serviceRoleKey, String(bookingId));
    if (!payment) return json(request, { error: "Payment not found" }, 404);
    if (payment.user_id !== user.id) return json(request, { error: "Payment does not belong to this user" }, 403);
    if (payment.status === "refunded") return json(request, { status: "refunded" });
    if (payment.status === "refund_requested") return json(request, { status: "pending" });
    if (payment.status !== "paid" || !payment.stripe_payment_intent_id) {
      return json(request, { error: "Refund is available only after payment has completed." }, 400);
    }

    await patchPayment(supabaseUrl, serviceRoleKey, String(bookingId), {
      status: "refund_requested",
      provider_payload: {
        ...(payment.provider_payload || {}),
        refundRequestedAt: new Date().toISOString(),
        refundReason: reason,
      },
    });

    const form = new URLSearchParams();
    form.set("payment_intent", payment.stripe_payment_intent_id);
    form.set("reason", String(reason));
    form.set("metadata[booking_id]", String(bookingId));
    form.set("metadata[user_id]", user.id);
    form.set("metadata[lawyer_id]", payment.lawyer_id);

    const stripeResponse = await fetch("https://api.stripe.com/v1/refunds", {
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
      console.error("Stripe refund failed", payload.error?.message || payload);
      return json(request, { error: "Refund could not be started. Support can review the payment." }, 400);
    }

    await patchPayment(supabaseUrl, serviceRoleKey, String(bookingId), {
      status: payload.status === "succeeded" ? "refunded" : "refund_requested",
      provider_payload: {
        ...(payment.provider_payload || {}),
        refundRequestedAt: new Date().toISOString(),
        refundId: payload.id,
        refundStatus: payload.status,
        refundReason: reason,
      },
    });

    return json(request, {
      provider: "stripe",
      status: payload.status === "succeeded" ? "refunded" : "pending",
      refundId: payload.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed";
    return json(request, { error: message }, 500);
  }
});
