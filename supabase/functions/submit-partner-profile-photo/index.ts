import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const photosBucket = "lawyer-profile-photos";
const maxPhotoSize = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
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

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const sanitizeFileName = (fileName: string, mimeType: string) => {
  const fallbackExtension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const cleanName = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (!cleanName) return `profile-photo.${fallbackExtension}`;
  return /\.[a-z0-9]+$/.test(cleanName) ? cleanName : `${cleanName}.${fallbackExtension}`;
};

const buildPublicObjectUrl = (supabaseUrl: string, storagePath: string) =>
  `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${photosBucket}/${storagePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const { email, sessionToken, fileName, mimeType, size, contentBase64 } = await request.json().catch(() => ({}));
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedMimeType = String(mimeType || "").trim().toLowerCase();
    const normalizedFileName = String(fileName || "profile-photo");
    const normalizedSize = Number(size || 0);

    if (!normalizedEmail || !sessionToken || !contentBase64) {
      return json(request, { error: "email, sessionToken and contentBase64 are required" }, 400);
    }

    if (!allowedMimeTypes.has(normalizedMimeType)) {
      return json(request, { error: "PROFILE_PHOTO_UNSUPPORTED_TYPE" }, 400);
    }

    if (!Number.isFinite(normalizedSize) || normalizedSize <= 0 || normalizedSize > maxPhotoSize) {
      return json(request, { error: "PROFILE_PHOTO_TOO_LARGE" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: currentState, error: stateError } = await supabase.rpc("get_partner_profile_photo_state", {
      p_partner_email: normalizedEmail,
      p_session_token: String(sessionToken),
    });

    if (stateError || !currentState?.lawyerId) {
      return json(request, { error: "PARTNER_SESSION_INVALID" }, 403);
    }

    const bytes = decodeBase64(String(contentBase64));
    if (bytes.byteLength > maxPhotoSize || bytes.byteLength !== normalizedSize) {
      return json(request, { error: "PROFILE_PHOTO_SIZE_MISMATCH" }, 400);
    }

    const storagePath = `${currentState.lawyerId}/${crypto.randomUUID()}-${sanitizeFileName(normalizedFileName, normalizedMimeType)}`;
    const publicUrl = buildPublicObjectUrl(supabaseUrl, storagePath);
    const { error: uploadError } = await supabase.storage.from(photosBucket).upload(storagePath, bytes, {
      contentType: normalizedMimeType,
      upsert: false,
    });

    if (uploadError) {
      return json(request, { error: "PROFILE_PHOTO_UPLOAD_FAILED" }, 500);
    }

    const { data: photoState, error: submitError } = await supabase.rpc("submit_partner_profile_photo", {
      p_partner_email: normalizedEmail,
      p_session_token: String(sessionToken),
      p_file_name: normalizedFileName,
      p_mime_type: normalizedMimeType,
      p_size: normalizedSize,
      p_storage_path: storagePath,
      p_candidate_public_url: publicUrl,
    });

    if (submitError) {
      await supabase.storage.from(photosBucket).remove([storagePath]);
      return json(request, { error: submitError.message || "PROFILE_PHOTO_SUBMIT_FAILED" }, 403);
    }

    return json(request, { ok: true, photoState }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROFILE_PHOTO_SUBMIT_FAILED";
    return json(request, { error: message }, 500);
  }
});
