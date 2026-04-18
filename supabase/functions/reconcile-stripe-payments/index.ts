const stripeApiVersion = "2026-02-25.clover";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const requiresLiveStripe = () =>
  Deno.env.get("REQUIRE_LIVE_STRIPE") === "true" || Deno.env.get("STRIPE_REQUIRE_LIVE_MODE") === "true";

const getRequiredEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing ${key}`);
  return value;
};

const assertStripeMode = (secretKey: string) => {
  if (requiresLiveStripe() && !secretKey.startsWith("sk_live_")) {
    throw new Error("Live Stripe mode is required for payment reconciliation.");
  }
};

const supabaseFetch = async (path: string, init: RequestInit = {}) => {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  return response;
};

const stripeFetch = async (path: string) => {
  const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
  assertStripeMode(stripeSecretKey);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Stripe-Version": stripeApiVersion,
    },
  });

  if (!response.ok) throw new Error(`Stripe request failed: ${response.status} ${await response.text()}`);
  return response.json();
};

interface BookingPaymentRow {
  id: string;
  booking_id: string;
  status: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  receipt_url: string | null;
}

const createRun = async () => {
  const response = await supabaseFetch("payment_reconciliation_runs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ provider: "stripe", status: "running" }),
  });
  const rows = await response.json();
  return rows[0]?.id as string;
};

const completeRun = async (runId: string, checkedCount: number, mismatchCount: number, status = "completed", notes?: string) => {
  await supabaseFetch(`payment_reconciliation_runs?id=eq.${encodeURIComponent(runId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status,
      checked_count: checkedCount,
      mismatch_count: mismatchCount,
      completed_at: new Date().toISOString(),
      notes: notes || null,
    }),
  });
};

const recordMismatch = async (
  runId: string,
  payment: BookingPaymentRow,
  mismatchType: string,
  expectedState: string,
  observedState: string,
  details: Record<string, unknown>,
) => {
  await supabaseFetch("payment_reconciliation_mismatches", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      run_id: runId,
      booking_payment_id: payment.id,
      booking_id: payment.booking_id,
      stripe_checkout_session_id: payment.stripe_checkout_session_id,
      stripe_payment_intent_id: payment.stripe_payment_intent_id,
      mismatch_type: mismatchType,
      expected_state: expectedState,
      observed_state: observedState,
      severity: mismatchType === "missing_provider_record" ? "critical" : "high",
      details,
    }),
  });
};

const getProviderState = async (payment: BookingPaymentRow) => {
  if (payment.stripe_checkout_session_id) {
    const session = await stripeFetch(`checkout/sessions/${encodeURIComponent(payment.stripe_checkout_session_id)}`);
    return {
      status:
        session.payment_status === "paid"
          ? "paid"
          : session.status === "expired"
            ? "failed"
            : payment.status,
      receiptUrl: null,
      providerPayload: session,
    };
  }

  if (payment.stripe_payment_intent_id) {
    const intent = await stripeFetch(`payment_intents/${encodeURIComponent(payment.stripe_payment_intent_id)}?expand[]=latest_charge`);
    return {
      status: intent.status === "succeeded" ? "paid" : intent.status === "requires_payment_method" ? "failed" : payment.status,
      receiptUrl: intent.latest_charge?.receipt_url || null,
      providerPayload: intent,
    };
  }

  return {
    status: "not_opened",
    receiptUrl: null,
    providerPayload: null,
  };
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const jobSecret = Deno.env.get("PAYMENT_RECONCILIATION_SECRET");
  if (jobSecret && request.headers.get("authorization") !== `Bearer ${jobSecret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const runId = await createRun();
  let checkedCount = 0;
  let mismatchCount = 0;

  try {
    const response = await supabaseFetch(
      "booking_payments?select=id,booking_id,status,stripe_checkout_session_id,stripe_payment_intent_id,receipt_url&or=(stripe_checkout_session_id.not.is.null,stripe_payment_intent_id.not.is.null)&order=updated_at.desc&limit=500",
    );
    const payments = (await response.json()) as BookingPaymentRow[];

    for (const payment of payments) {
      checkedCount += 1;
      try {
        const providerState = await getProviderState(payment);
        if (providerState.status !== payment.status) {
          mismatchCount += 1;
          await recordMismatch(runId, payment, "state_mismatch", payment.status, providerState.status, {
            stripeApiVersion,
            providerPayload: providerState.providerPayload,
          });
        }

        if (providerState.status === "paid" && !payment.receipt_url && !providerState.receiptUrl) {
          mismatchCount += 1;
          await recordMismatch(runId, payment, "missing_receipt", "receipt_url", "missing", {
            stripeApiVersion,
            providerPayload: providerState.providerPayload,
          });
        }
      } catch (error) {
        mismatchCount += 1;
        await recordMismatch(runId, payment, "missing_provider_record", payment.status, "unavailable", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await completeRun(runId, checkedCount, mismatchCount);
    return json({ ok: true, runId, checkedCount, mismatchCount });
  } catch (error) {
    await completeRun(runId, checkedCount, mismatchCount, "failed", error instanceof Error ? error.message : String(error));
    return json({ error: error instanceof Error ? error.message : String(error), runId }, 500);
  }
});
