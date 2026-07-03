import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const defaultAllowedOrigins = [
  "https://dikigoros.gr",
  "https://www.dikigoros.gr",
  "https://dikigoros.vercel.app",
  "https://dikigoros-oud1.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
];

const getAllowedOrigins = () => {
  const configuredOrigins = Deno.env.get("ALLOWED_APP_ORIGINS") || "";
  const appOrigin = Deno.env.get("APP_ORIGIN") || "";
  const origins = configuredOrigins
    .split(",")
    .concat(appOrigin)
    .concat(defaultAllowedOrigins)
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return Array.from(new Set(origins));
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

const createCode = () => String(Math.floor(100000 + Math.random() * 900000));

const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(request), "Content-Type": "application/json" },
  });

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(request) });
  }

  if (request.method !== "POST") {
    return json(request, { error: "Method not allowed" }, 405);
  }

  const { email } = await request.json().catch(() => ({ email: "" }));
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return json(request, { error: "Invalid email" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json(request, { error: "Server is not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const code = createCode();
  const { data: created, error } = await supabase.rpc("create_partner_access_code", {
    p_email: normalizedEmail,
    p_code: code,
  });

  if (error || !created) {
    return json(request, { error: "Partner account is not approved" }, 403);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("PARTNER_AUTH_FROM_EMAIL");

  if (!resendApiKey || !fromEmail) {
    return json(request, { error: "Resend email delivery is not configured" }, 500);
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: normalizedEmail,
      subject: "Κωδικός πρόσβασης στο Dikigoros partner portal",
      text: `Ο κωδικός πρόσβασης στο Dikigoros partner portal είναι ${code}. Ισχύει για 10 λεπτά. Χρησιμοποιήστε μόνο τον πιο πρόσφατο κωδικό.`,
      html: `<p>Ο κωδικός πρόσβασης στο Dikigoros partner portal είναι:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>Ισχύει για 10 λεπτά. Χρησιμοποιήστε μόνο τον πιο πρόσφατο κωδικό.</p>`,
    }),
  });

  const resendPayload = await resendResponse.json().catch(() => null);

  if (!resendResponse.ok) {
    const providerMessage = resendPayload?.message || resendPayload?.error || "Resend rejected the message";
    console.error("Partner access code email failed", providerMessage);
    return json(request, { error: providerMessage }, 502);
  }

  return json(request, { ok: true, id: resendPayload?.id || null }, 202);
});
