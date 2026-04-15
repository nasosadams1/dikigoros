import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const documentsBucket = "legal-documents";
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

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const { email, sessionToken, documentId } = await request.json().catch(() => ({}));

    if (!email || !sessionToken || !documentId) {
      return json(request, { error: "email, sessionToken and documentId are required" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: storagePath, error: pathError } = await supabase.rpc("get_partner_document_storage_path", {
      p_partner_email: String(email).trim().toLowerCase(),
      p_session_token: String(sessionToken),
      p_document_id: String(documentId),
    });

    if (pathError || !storagePath) {
      return json(request, { error: "Document not found or forbidden" }, 403);
    }

    const { data, error } = await supabase.storage
      .from(documentsBucket)
      .createSignedUrl(String(storagePath), 60 * 10);

    if (error || !data?.signedUrl) {
      return json(request, { error: "Could not create document URL" }, 500);
    }

    return json(request, { url: data.signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document URL request failed";
    return json(request, { error: message }, 500);
  }
});
