const stripeApiVersion = "2026-02-25.clover";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const toHex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
};

const verifyStripeSignature = async (payload: string, signatureHeader: string, secret: string) => {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 5 * 60) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  return timingSafeEqual(toHex(digest), signature);
};

const requiresLiveStripe = () =>
  Deno.env.get("REQUIRE_LIVE_STRIPE") === "true" || Deno.env.get("STRIPE_REQUIRE_LIVE_MODE") === "true";

const getStripeModeError = () => {
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (requiresLiveStripe() && !stripeSecretKey.startsWith("sk_live_")) {
    return "Live Stripe mode is required for payment webhooks.";
  }
  return "";
};

const patchPayment = async (bookingId: string, updates: Record<string, unknown>) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase service credentials");

  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_payments?booking_id=eq.${encodeURIComponent(bookingId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        ...updates,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Payment update failed: ${await response.text()}`);
  }
};

const recordPaymentEvent = async (bookingId: string, event: Record<string, unknown>, type: string, object: Record<string, unknown>) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return;

  const stripeEventId = String(event.id || "");
  if (!stripeEventId) return;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_payment_events?on_conflict=stripe_event_id`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({
        booking_id: bookingId,
        stripe_event_id: stripeEventId,
        event_type: type,
        payment_status: String(object.payment_status || object.status || ""),
        provider_payload: {
          stripeApiVersion,
          objectId: object.id || "",
          mode: object.mode || "",
          paymentIntent: object.payment_intent || "",
        },
      }),
    },
  );

  if (!response.ok) {
    console.error("Payment event record failed", await response.text());
  }
};

const patchUserPaymentPreferences = async (userId: string, preferences: Record<string, unknown>) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase service credentials");

  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        payment_preferences: preferences,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Payment preference update failed: ${await response.text()}`);
  }
};

const fetchReceiptUrl = async (paymentIntentId?: string | null) => {
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey || !paymentIntentId) return null;

  const response = await fetch(
    `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge`,
    {
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Stripe-Version": stripeApiVersion,
      },
    },
  );
  if (!response.ok) return null;

  const paymentIntent = await response.json();
  return paymentIntent.latest_charge?.receipt_url || null;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) return json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, 500);
  const stripeModeError = getStripeModeError();
  if (stripeModeError) return json({ error: stripeModeError }, 500);

  const signatureHeader = request.headers.get("stripe-signature") || "";
  const payload = await request.text();
  const verified = await verifyStripeSignature(payload, signatureHeader, webhookSecret);
  if (!verified) return json({ error: "Invalid signature" }, 400);

  const event = JSON.parse(payload);
  const type = String(event.type || "");
  const object = event.data?.object || {};
  const mode = String(object.mode || "");

  if (type === "checkout.session.completed" && mode === "setup") {
    const userId = String(object.client_reference_id || object.metadata?.user_id || "");
    if (!userId) return json({ received: true, ignored: "missing setup user id" });

    await patchUserPaymentPreferences(userId, {
      provider: "stripe",
      status: "ready",
      stripeCustomerId: object.customer || "",
      defaultMethodLabel: "Stripe payment method",
      setupRequestedAt: new Date().toISOString(),
      stripeSetupIntentId: object.setup_intent || "",
    });

    return json({ received: true });
  }

  const bookingId = String(object.client_reference_id || object.metadata?.booking_id || "");
  if (!bookingId) return json({ received: true, ignored: "missing booking id" });

  await recordPaymentEvent(bookingId, event, type, object);

  if (type === "charge.refunded" || (type === "refund.updated" && object.status === "succeeded")) {
    await patchPayment(bookingId, {
      status: "refunded",
      stripe_payment_intent_id: object.payment_intent,
      receipt_url: object.receipt_url || null,
      provider_payload: {
        stripeApiVersion,
        eventId: event.id,
        refundStatus: object.status || "refunded",
      },
    });

    return json({ received: true });
  }

  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    const receiptUrl = await fetchReceiptUrl(object.payment_intent);

    await patchPayment(bookingId, {
      status: "paid",
      stripe_checkout_session_id: object.id,
      stripe_payment_intent_id: object.payment_intent,
      receipt_url: receiptUrl,
      paid_at: new Date().toISOString(),
      provider_payload: {
        stripeApiVersion,
        eventId: event.id,
        paymentStatus: object.payment_status,
      },
    });
  }

  if (type === "checkout.session.expired" || type === "checkout.session.async_payment_failed") {
    await patchPayment(bookingId, {
      status: "failed",
      stripe_checkout_session_id: object.id,
      stripe_payment_intent_id: object.payment_intent,
      provider_payload: {
        stripeApiVersion,
        eventId: event.id,
        paymentStatus: object.payment_status,
      },
    });
  }

  return json({ received: true });
});
