import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

export type CalendarProvider = "google";

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

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const getAllowedOrigins = () => {
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

export const getCorsHeaders = (request: Request) => {
  const requestOrigin = request.headers.get("Origin")?.replace(/\/+$/, "") || "";
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
};

export const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(request), "Content-Type": "application/json" },
  });

export const redirect = (request: Request, url: string) =>
  new Response(null, {
    status: 302,
    headers: { ...getCorsHeaders(request), Location: url },
  });

export const getRequiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

export const getOptionalEnv = (name: string) => Deno.env.get(name) || "";

export const createServiceClient = () =>
  createClient(getRequiredEnv("SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const getHmacKey = async (secret: string) =>
  crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

export interface CalendarOAuthState {
  provider: CalendarProvider;
  partnerEmail: string;
  lawyerId: string;
  returnUrl: string;
  expiresAt: number;
}

export const signState = async (payload: CalendarOAuthState, secret: string) => {
  const encodedPayload = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const key = await getHmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(encodedPayload)));
  return `${encodedPayload}.${toBase64Url(signature)}`;
};

export const verifyState = async (state: string, secret: string): Promise<CalendarOAuthState> => {
  const [encodedPayload, encodedSignature] = state.split(".");
  if (!encodedPayload || !encodedSignature) throw new Error("INVALID_OAUTH_STATE");

  const key = await getHmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(encodedSignature),
    textEncoder.encode(encodedPayload),
  );
  if (!valid) throw new Error("INVALID_OAUTH_STATE");

  const payload = JSON.parse(textDecoder.decode(fromBase64Url(encodedPayload))) as CalendarOAuthState;
  if (!payload.expiresAt || payload.expiresAt < Date.now()) throw new Error("EXPIRED_OAUTH_STATE");
  if (payload.provider !== "google") throw new Error("INVALID_PROVIDER");
  return payload;
};

const getEncryptionKey = async (secret: string) => {
  const hash = await crypto.subtle.digest("SHA-256", textEncoder.encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
};

export const encryptToken = async (token: string, secret: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey(secret);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(token)));
  return `${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
};

export const decryptToken = async (ciphertext: string | null | undefined, secret: string) => {
  if (!ciphertext) return "";
  const [ivText, dataText] = ciphertext.split(".");
  if (!ivText || !dataText) return "";
  const key = await getEncryptionKey(secret);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivText) },
    key,
    fromBase64Url(dataText),
  );
  return textDecoder.decode(plain);
};

export const verifyPartnerSession = async (
  supabase: ReturnType<typeof createServiceClient>,
  partnerEmail: string,
  sessionToken: string,
  lawyerId: string,
) => {
  const { data, error } = await supabase.rpc("get_partner_session_lawyer_id", {
    p_partner_email: partnerEmail,
    p_session_token: sessionToken,
  });
  if (error || data !== lawyerId) throw new Error("PARTNER_SESSION_INVALID");
};

export const getConnectionRedirectUrl = (request: Request, target?: string | null) => {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = request.headers.get("Origin")?.replace(/\/+$/, "") || "";
  const fallbackOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : (Deno.env.get("APP_ORIGIN") || allowedOrigins[0]);
  const fallback = `${fallbackOrigin}/for-lawyers/portal?view=availability`;

  if (!target) return fallback;
  try {
    const parsed = new URL(target, fallbackOrigin);
    return allowedOrigins.includes(parsed.origin)
      ? `${parsed.origin}${parsed.pathname}${parsed.search}`
      : fallback;
  } catch {
    return fallback;
  }
};

export interface StoredCalendarConnection {
  id: string;
  partner_email: string;
  lawyer_id: string;
  provider: CalendarProvider;
  provider_account_email: string | null;
  status: "connected" | "needs_reauth" | "disabled" | "error";
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  expires_at: string | null;
  scope: string[] | null;
}

export const fetchActiveCalendarConnections = async (lawyerId: string) => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("partner_calendar_connections")
    .select("*")
    .eq("lawyer_id", lawyerId)
    .eq("status", "connected");

  if (error) throw error;
  return (data || []) as StoredCalendarConnection[];
};

export const refreshGoogleAccessToken = async (refreshToken: string) => {
  const form = new URLSearchParams();
  form.set("client_id", getRequiredEnv("GOOGLE_CALENDAR_CLIENT_ID"));
  form.set("client_secret", getRequiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET"));
  form.set("refresh_token", refreshToken);
  form.set("grant_type", "refresh_token");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error_description || payload?.error || "GOOGLE_TOKEN_REFRESH_FAILED");
  return payload as { access_token: string; expires_in?: number; scope?: string };
};

export const updateConnectionTokens = async (
  connection: StoredCalendarConnection,
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number | undefined,
  tokenSecret: string,
) => {
  const supabase = createServiceClient();
  const patch: Record<string, unknown> = {
    access_token_ciphertext: await encryptToken(accessToken, tokenSecret),
    expires_at: new Date(Date.now() + Math.max(60, Number(expiresIn || 3600)) * 1000).toISOString(),
    status: "connected",
    last_error: null,
  };
  if (refreshToken) patch.refresh_token_ciphertext = await encryptToken(refreshToken, tokenSecret);

  await supabase.from("partner_calendar_connections").update(patch).eq("id", connection.id);
};

export const getValidAccessToken = async (connection: StoredCalendarConnection, tokenSecret: string) => {
  const accessToken = await decryptToken(connection.access_token_ciphertext, tokenSecret);
  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  if (accessToken && expiresAt > Date.now() + 60_000) return accessToken;

  const refreshToken = await decryptToken(connection.refresh_token_ciphertext, tokenSecret);
  if (!refreshToken) throw new Error("CALENDAR_REAUTH_REQUIRED");

  const refreshed = await refreshGoogleAccessToken(refreshToken);
  await updateConnectionTokens(connection, refreshed.access_token, undefined, refreshed.expires_in, tokenSecret);
  return refreshed.access_token;
};
