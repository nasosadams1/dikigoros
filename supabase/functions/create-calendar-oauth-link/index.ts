import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceClient,
  getConnectionRedirectUrl,
  getCorsHeaders,
  getRequiredEnv,
  json,
  signState,
  verifyPartnerSession,
} from "../_shared/calendar-sync.ts";

const googleConfig = {
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  scopes: ["https://www.googleapis.com/auth/calendar.freebusy", "email"],
  extra: {
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  },
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  try {
    const { provider, email, sessionToken, lawyerId, returnUrl } = await request.json().catch(() => ({}));
    const normalizedProvider = String(provider || "google");
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedLawyerId = String(lawyerId || "").trim();

    if (normalizedProvider !== "google") {
      return json(request, { error: "Google Calendar is the only supported calendar provider" }, 400);
    }
    if (!normalizedEmail || !sessionToken || !normalizedLawyerId) {
      return json(request, { error: "email, sessionToken and lawyerId are required" }, 400);
    }

    const supabase = createServiceClient();
    await verifyPartnerSession(supabase, normalizedEmail, String(sessionToken), normalizedLawyerId);

    const state = await signState(
      {
        provider: "google",
        partnerEmail: normalizedEmail,
        lawyerId: normalizedLawyerId,
        returnUrl: getConnectionRedirectUrl(request, typeof returnUrl === "string" ? returnUrl : null),
        expiresAt: Date.now() + 10 * 60_000,
      },
      getRequiredEnv("CALENDAR_TOKEN_SECRET"),
    );

    const url = new URL(googleConfig.authUrl);
    url.searchParams.set("client_id", getRequiredEnv("GOOGLE_CALENDAR_CLIENT_ID"));
    url.searchParams.set("redirect_uri", getRequiredEnv("GOOGLE_CALENDAR_REDIRECT_URI"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", googleConfig.scopes.join(" "));
    url.searchParams.set("state", state);
    Object.entries(googleConfig.extra).forEach(([key, value]) => url.searchParams.set(key, value));

    return json(request, { url: url.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar connection could not start";
    const status = message.includes("PARTNER_SESSION_INVALID") ? 403 : message.startsWith("Missing ") ? 501 : 500;
    return json(request, { error: message }, status);
  }
});
