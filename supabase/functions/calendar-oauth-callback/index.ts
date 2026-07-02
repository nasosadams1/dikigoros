import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceClient,
  encryptToken,
  getCorsHeaders,
  getRequiredEnv,
  json,
  redirect,
  verifyState,
} from "../_shared/calendar-sync.ts";

const exchangeOAuthCode = async (code: string) => {
  const form = new URLSearchParams();
  form.set("code", code);
  form.set("grant_type", "authorization_code");
  form.set("client_id", getRequiredEnv("GOOGLE_CALENDAR_CLIENT_ID"));
  form.set("client_secret", getRequiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET"));
  form.set("redirect_uri", getRequiredEnv("GOOGLE_CALENDAR_REDIRECT_URI"));

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error_description || payload?.error || "GOOGLE_TOKEN_EXCHANGE_FAILED");
  return payload as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
};

const fetchGoogleAccountEmail = async (accessToken: string) => {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  return payload?.email ? String(payload.email) : null;
};

const appendCalendarStatus = (returnUrl: string, value: "connected" | "error") => {
  const url = new URL(returnUrl);
  url.searchParams.set("calendar", value);
  return url.toString();
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(request) });
  if (request.method !== "GET") return json(request, { error: "Method not allowed" }, 405);

  let fallbackReturnUrl = `${Deno.env.get("APP_ORIGIN") || "https://dikigoros.gr"}/for-lawyers/portal?view=availability`;

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const stateText = url.searchParams.get("state");
    const providerError = url.searchParams.get("error");

    if (providerError) throw new Error(providerError);
    if (!code || !stateText) throw new Error("Missing OAuth code or state");

    const tokenSecret = getRequiredEnv("CALENDAR_TOKEN_SECRET");
    const state = await verifyState(stateText, tokenSecret);
    fallbackReturnUrl = state.returnUrl;

    const tokenPayload = await exchangeOAuthCode(code);
    if (!tokenPayload.access_token) throw new Error("Calendar provider did not return an access token");

    const supabase = createServiceClient();
    const { data: existingRows } = await supabase
      .from("partner_calendar_connections")
      .select("refresh_token_ciphertext")
      .eq("partner_email", state.partnerEmail)
      .eq("lawyer_id", state.lawyerId)
      .eq("provider", state.provider)
      .limit(1);
    const existingRefreshToken = existingRows?.[0]?.refresh_token_ciphertext || null;

    const providerAccountEmail = await fetchGoogleAccountEmail(tokenPayload.access_token);
    const accessTokenCiphertext = await encryptToken(tokenPayload.access_token, tokenSecret);
    const refreshTokenCiphertext = tokenPayload.refresh_token
      ? await encryptToken(tokenPayload.refresh_token, tokenSecret)
      : existingRefreshToken;

    if (!refreshTokenCiphertext) throw new Error("Calendar provider did not return a refresh token");

    const { error } = await supabase
      .from("partner_calendar_connections")
      .upsert(
        {
          partner_email: state.partnerEmail,
          lawyer_id: state.lawyerId,
          provider: state.provider,
          provider_account_email: providerAccountEmail,
          status: "connected",
          access_token_ciphertext: accessTokenCiphertext,
          refresh_token_ciphertext: refreshTokenCiphertext,
          expires_at: new Date(Date.now() + Math.max(60, Number(tokenPayload.expires_in || 3600)) * 1000).toISOString(),
          scope: String(tokenPayload.scope || "").split(/\s+/).filter(Boolean),
          last_error: null,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "partner_email,lawyer_id,provider" },
      );

    if (error) throw error;
    return redirect(request, appendCalendarStatus(state.returnUrl, "connected"));
  } catch (error) {
    console.error("Calendar OAuth callback failed", error);
    return redirect(request, appendCalendarStatus(fallbackReturnUrl, "error"));
  }
});
