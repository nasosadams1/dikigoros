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

const getSupabaseCredentials = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase service credentials");
  return { supabaseUrl, serviceRoleKey };
};

const patchPayment = async (bookingId: string, updates: Record<string, unknown>) => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseCredentials();
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

const patchBooking = async (bookingId: string, updates: Record<string, unknown>) => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseCredentials();

  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_requests?id=eq.${encodeURIComponent(bookingId)}&status=in.(confirmed_unpaid,confirmed_paid,confirmed)`,
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
    throw new Error(`Booking update failed: ${await response.text()}`);
  }
};

const recordPaymentEvent = async (bookingId: string, event: Record<string, unknown>, type: string, object: Record<string, unknown>) => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseCredentials();
  const stripeEventId = String(event.id || "");
  if (!stripeEventId) return false;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_payment_events?on_conflict=stripe_event_id`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=representation",
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
    throw new Error(`Payment event record failed: ${await response.text()}`);
  }

  const insertedRows = await response.json().catch(() => []);
  return Array.isArray(insertedRows) && insertedRows.length > 0;
};

const recordPaymentMismatch = async (
  mismatchType: string,
  object: Record<string, unknown>,
  event: Record<string, unknown>,
  details: Record<string, unknown> = {},
) => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseCredentials();
  const response = await fetch(`${supabaseUrl}/rest/v1/payment_reconciliation_mismatches`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      booking_id: details.bookingId || null,
      stripe_checkout_session_id: object.object === "checkout.session" ? object.id || null : null,
      stripe_payment_intent_id: object.payment_intent || object.id || null,
      mismatch_type: mismatchType,
      expected_state: details.expectedState || null,
      observed_state: details.observedState || String(object.payment_status || object.status || ""),
      severity: details.severity || "high",
      details: {
        stripeApiVersion,
        eventId: event.id || "",
        eventType: event.type || "",
        objectId: object.id || "",
        ...details,
      },
    }),
  });

  if (!response.ok) {
    console.error("Payment mismatch record failed", await response.text());
  }
};

const findBookingIdForStripeObject = async (object: Record<string, unknown>) => {
  const metadata =
    typeof object.metadata === "object" && object.metadata ? (object.metadata as Record<string, unknown>) : {};
  const directBookingId = String(object.client_reference_id || metadata.booking_id || "");
  if (directBookingId) return directBookingId;

  const paymentIntentId = String(object.payment_intent || (object.object === "payment_intent" ? object.id : "") || "");
  const checkoutSessionId = String(object.object === "checkout.session" ? object.id || "" : "");
  if (!paymentIntentId && !checkoutSessionId) return "";

  const { supabaseUrl, serviceRoleKey } = getSupabaseCredentials();
  const filters = paymentIntentId
    ? `stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}`
    : `stripe_checkout_session_id=eq.${encodeURIComponent(checkoutSessionId)}`;
  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_payments?select=booking_id&${filters}&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) return "";
  const rows = await response.json().catch(() => []);
  return String(rows?.[0]?.booking_id || "");
};

const patchUserPaymentPreferences = async (userId: string, preferences: Record<string, unknown>) => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseCredentials();

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

const getPartnerSubscriptionMetadata = (object: Record<string, unknown>) => {
  const metadata =
    typeof object.metadata === "object" && object.metadata ? (object.metadata as Record<string, unknown>) : {};
  if (metadata.subscription_kind !== "partner_plan") return null;

  return {
    partnerEmail: String(metadata.partner_email || ""),
    lawyerId: String(metadata.lawyer_id || object.client_reference_id || ""),
    planId: String(metadata.plan_id || "basic"),
    billingInterval: String(metadata.billing_interval || "monthly") === "annual" ? "annual" : "monthly",
    stripePriceId: String(metadata.stripe_price_id || ""),
    planAmountCents: Number(metadata.plan_amount_cents || 0) || 0,
  };
};

const upsertPartnerSubscription = async (
  metadata: {
    partnerEmail: string;
    lawyerId: string;
    planId: string;
    billingInterval: string;
    stripePriceId: string;
    planAmountCents: number;
  },
  status: string,
  object: Record<string, unknown>,
  event: Record<string, unknown>,
) => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseCredentials();
  if (!metadata.partnerEmail || !metadata.lawyerId) {
    throw new Error("Missing partner subscription metadata");
  }

  const subscriptionId = String(object.subscription || object.id || "");
  const currentPeriodEnd = Number(object.current_period_end || 0);
  const response = await fetch(`${supabaseUrl}/rest/v1/partner_subscriptions?on_conflict=partner_email,lawyer_id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      partner_email: metadata.partnerEmail.toLowerCase(),
      lawyer_id: metadata.lawyerId,
      plan_id: metadata.planId,
      billing_interval: metadata.billingInterval,
      stripe_price_id: metadata.stripePriceId || null,
      plan_amount_cents: metadata.planAmountCents,
      status,
      stripe_customer_id: object.customer || null,
      stripe_subscription_id: subscriptionId || null,
      stripe_checkout_session_id: object.object === "checkout.session" ? object.id || null : null,
      current_period_end: currentPeriodEnd > 0 ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      cancel_at_period_end: Boolean(object.cancel_at_period_end),
      provider_payload: {
        stripeApiVersion,
        eventId: event.id || "",
        eventType: event.type || "",
        objectId: object.id || "",
        billingInterval: metadata.billingInterval,
        stripePriceId: metadata.stripePriceId,
        planAmountCents: metadata.planAmountCents,
      },
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Partner subscription update failed: ${await response.text()}`);
  }

  const lawyerResponse = await fetch(`${supabaseUrl}/rest/v1/lawyer_profiles?id=eq.${encodeURIComponent(metadata.lawyerId)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      partner_plan: status === "active" ? metadata.planId : "basic",
      visibility_tier: status === "active" ? metadata.planId : "basic",
      updated_at: new Date().toISOString(),
    }),
  });

  if (!lawyerResponse.ok) {
    console.error("Partner plan profile sync failed", await lawyerResponse.text());
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

  if (type === "checkout.session.completed" && mode === "subscription") {
    const subscriptionMetadata = getPartnerSubscriptionMetadata(object);
    if (subscriptionMetadata) {
      await upsertPartnerSubscription(subscriptionMetadata, "active", object, event);
      return json({ received: true, partnerSubscription: true });
    }
  }

  if (
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted"
  ) {
    const subscriptionMetadata = getPartnerSubscriptionMetadata(object);
    if (subscriptionMetadata) {
      const subscriptionStatus =
        type === "customer.subscription.deleted" ? "canceled" : String(object.status || "active");
      await upsertPartnerSubscription(subscriptionMetadata, subscriptionStatus, object, event);
      return json({ received: true, partnerSubscription: true });
    }
  }

  const bookingId = await findBookingIdForStripeObject(object);
  if (!bookingId) {
    await recordPaymentMismatch("orphan_stripe_event", object, event, { severity: "critical" });
    return json({ received: true, queued: "orphan_stripe_event" });
  }

  const isNewEvent = await recordPaymentEvent(bookingId, event, type, object);
  if (!isNewEvent) return json({ received: true, replay: true });

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

  if (
    type === "checkout.session.completed" ||
    type === "checkout.session.async_payment_succeeded" ||
    type === "payment_intent.succeeded"
  ) {
    const receiptUrl = await fetchReceiptUrl(object.payment_intent);

    await patchPayment(bookingId, {
      status: "paid",
      stripe_checkout_session_id: object.id,
      stripe_payment_intent_id: object.payment_intent || object.id,
      receipt_url: receiptUrl,
      paid_at: new Date().toISOString(),
      provider_payload: {
        stripeApiVersion,
        eventId: event.id,
        paymentStatus: object.payment_status,
      },
    });
    await patchBooking(bookingId, {
      status: "confirmed_paid",
    });
  }

  if (
    type === "checkout.session.expired" ||
    type === "checkout.session.async_payment_failed" ||
    type === "payment_intent.payment_failed"
  ) {
    await patchPayment(bookingId, {
      status: "failed",
      stripe_checkout_session_id: object.object === "checkout.session" ? object.id : undefined,
      stripe_payment_intent_id: object.payment_intent || object.id,
      provider_payload: {
        stripeApiVersion,
        eventId: event.id,
        paymentStatus: object.payment_status,
      },
    });
  }

  return json({ received: true });
});
