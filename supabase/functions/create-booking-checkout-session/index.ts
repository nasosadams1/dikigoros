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

interface BookingRow {
  id: string;
  user_id: string | null;
  reference_id: string;
  lawyer_id: string;
  lawyer_name: string;
  consultation_type: string;
  price: number;
  status: "confirmed" | "cancelled" | "completed";
}

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
    throw new Error("Live Stripe mode is required for booking checkout.");
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

const serviceHeaders = (serviceRoleKey: string) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
});

const fetchBooking = async (supabaseUrl: string, serviceRoleKey: string, bookingId: string) => {
  const select = [
    "id",
    "user_id",
    "reference_id",
    "lawyer_id",
    "lawyer_name",
    "consultation_type",
    "price",
    "status",
  ].join(",");
  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_requests?id=eq.${encodeURIComponent(bookingId)}&select=${select}`,
    { headers: serviceHeaders(serviceRoleKey) },
  );

  if (!response.ok) throw new Error(`Booking lookup failed: ${await response.text()}`);
  const rows = (await response.json()) as BookingRow[];
  return rows[0] || null;
};

const patchPaymentRecord = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  booking: BookingRow,
  updates: Record<string, unknown>,
) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_payments?on_conflict=booking_id`,
    {
      method: "POST",
      headers: {
        ...serviceHeaders(serviceRoleKey),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        booking_id: booking.id,
        user_id: booking.user_id,
        lawyer_id: booking.lawyer_id,
        amount: booking.price,
        currency: "EUR",
        invoice_number: `INV-${booking.reference_id.replace(/^BK-/, "")}`,
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

    const { bookingId, currency = "EUR", returnUrl } = await request.json();
    if (!bookingId) return json(request, { error: "bookingId is required" }, 400);
    if (String(currency).toUpperCase() !== "EUR") {
      return json(request, { error: "Only EUR payments are supported" }, 400);
    }

    const booking = await fetchBooking(supabaseUrl, serviceRoleKey, String(bookingId));
    if (!booking) return json(request, { error: "Booking not found" }, 404);
    if (booking.user_id !== user.id) return json(request, { error: "Booking does not belong to this user" }, 403);
    if (booking.status !== "confirmed") return json(request, { error: "Only confirmed bookings can be paid" }, 400);

    const amountInCents = Math.round(Number(booking.price || 0) * 100);
    if (amountInCents <= 0) return json(request, { error: "Booking amount must be positive" }, 400);

    const normalizedReturnUrl = normalizeReturnUrl(returnUrl, request);
    const separator = normalizedReturnUrl.includes("?") ? "&" : "?";
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("client_reference_id", booking.id);
    if (user.email) form.set("customer_email", user.email);
    form.set("success_url", `${normalizedReturnUrl}${separator}checkout=success&session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${normalizedReturnUrl}${separator}checkout=cancelled`);
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "eur");
    form.set("line_items[0][price_data][unit_amount]", String(amountInCents));
    form.set(
      "line_items[0][price_data][product_data][name]",
      `${booking.consultation_type} - ${booking.lawyer_name}`,
    );
    form.set("metadata[booking_id]", booking.id);
    form.set("metadata[reference_id]", booking.reference_id);
    form.set("metadata[lawyer_id]", booking.lawyer_id);
    form.set("metadata[user_id]", user.id);
    form.set("payment_intent_data[metadata][booking_id]", booking.id);
    form.set("payment_intent_data[metadata][reference_id]", booking.reference_id);
    form.set("payment_intent_data[metadata][lawyer_id]", booking.lawyer_id);
    form.set("payment_intent_data[metadata][user_id]", user.id);

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
      console.error("Stripe checkout failed", payload.error?.message || payload);
      return json(request, { error: "Payment could not be started. Try again or contact support." }, 400);
    }

    await patchPaymentRecord(supabaseUrl, serviceRoleKey, booking, {
      stripe_checkout_session_id: payload.id,
      checkout_session_url: payload.url,
      status: "pending",
    });

    return json(request, {
      provider: "stripe",
      status: "setup_required",
      id: payload.id,
      url: payload.url,
      clientSecret: payload.client_secret,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout session failed";
    return json(request, { error: message }, 500);
  }
});
