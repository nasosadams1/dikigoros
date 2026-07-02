import { allowLocalCriticalFallback, failClosedCriticalPath } from "@/lib/runtimeGuards";
import { getSupabaseAnonKey, getSupabaseFunctionUrl, publicSupabase } from "@/lib/supabase";
import { isPartnerSessionInvalidError, type PartnerSession } from "@/lib/platformRepository";

export type PartnerCalendarProvider = "google";
export type PartnerCalendarStatus = "connected" | "needs_reauth" | "disabled" | "error";

export interface PartnerCalendarConnection {
  provider: PartnerCalendarProvider;
  providerAccountEmail?: string;
  status: PartnerCalendarStatus;
  scope: string[];
  connectedAt: string;
  updatedAt: string;
  lastError?: string;
}

export interface PartnerCalendarBusyInterval {
  start: string;
  end: string;
  provider: PartnerCalendarProvider;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const mapConnection = (row: Record<string, unknown>): PartnerCalendarConnection => ({
  provider: String(row.provider || "google") as PartnerCalendarProvider,
  providerAccountEmail: row.provider_account_email ? String(row.provider_account_email) : undefined,
  status: String(row.status || "disabled") as PartnerCalendarStatus,
  scope: Array.isArray(row.scope) ? row.scope.map(String) : [],
  connectedAt: String(row.connected_at || new Date().toISOString()),
  updatedAt: String(row.updated_at || row.connected_at || new Date().toISOString()),
  lastError: row.last_error ? String(row.last_error) : undefined,
});

const parseJsonResponse = async (response: Response) => {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { error: raw };
  }
};

const postCalendarFunction = async <T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(getSupabaseFunctionUrl(name), {
    method: "POST",
    headers: {
      apikey: getSupabaseAnonKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : `EDGE_FUNCTION_${response.status}`;
    throw new Error(message);
  }

  return (payload || {}) as T;
};

export const fetchPartnerCalendarConnections = async (
  lawyerId?: string | null,
  partnerSession?: PartnerSession | null,
): Promise<PartnerCalendarConnection[]> => {
  if (!lawyerId) return [];
  if (!partnerSession?.sessionToken) {
    if (allowLocalCriticalFallback) return [];
    throw failClosedCriticalPath("Partner calendar connections");
  }

  try {
    const { data, error } = await publicSupabase.rpc("list_partner_calendar_connections", {
      p_partner_email: normalizeEmail(partnerSession.email),
      p_session_token: partnerSession.sessionToken,
      p_lawyer_id: lawyerId,
    });
    if (error) throw error;
    return ((data || []) as Record<string, unknown>[]).map(mapConnection);
  } catch (error) {
    if (isPartnerSessionInvalidError(error)) throw new Error("PARTNER_SESSION_INVALID");
    if (!allowLocalCriticalFallback) throw failClosedCriticalPath("Partner calendar connections");
    return [];
  }
};

export const createPartnerCalendarOAuthLink = async (
  provider: PartnerCalendarProvider,
  lawyerId: string,
  partnerSession?: PartnerSession | null,
) => {
  if (!partnerSession?.sessionToken) throw new Error("PARTNER_SESSION_REQUIRED");

  const response = await postCalendarFunction<{ url?: string }>("create-calendar-oauth-link", {
    provider,
    lawyerId,
    email: normalizeEmail(partnerSession.email),
    sessionToken: partnerSession.sessionToken,
  });

  if (!response.url) throw new Error("Calendar OAuth URL was not returned.");
  return response.url;
};

export const disconnectPartnerCalendarConnection = async (
  provider: PartnerCalendarProvider,
  lawyerId: string,
  partnerSession?: PartnerSession | null,
) => {
  if (!partnerSession?.sessionToken) throw new Error("PARTNER_SESSION_REQUIRED");

  const { error } = await publicSupabase.rpc("disconnect_partner_calendar_connection", {
    p_partner_email: normalizeEmail(partnerSession.email),
    p_session_token: partnerSession.sessionToken,
    p_lawyer_id: lawyerId,
    p_provider: provider,
  });
  if (error) throw error;
};

export const fetchPartnerCalendarBusyIntervals = async (
  lawyerId: string,
  rangeStartIso: string,
  rangeEndIso: string,
) => {
  try {
    const response = await postCalendarFunction<{
      busy?: Array<{ start?: string; end?: string; provider?: string }>;
    }>("get-partner-calendar-busy", {
      lawyerId,
      rangeStartIso,
      rangeEndIso,
    });

    return (response.busy || [])
      .map((item) => ({
        start: String(item.start || ""),
        end: String(item.end || ""),
      provider: String(item.provider || "google") as PartnerCalendarProvider,
    }))
    .filter((item): item is PartnerCalendarBusyInterval =>
        Boolean(item.start && item.end && item.provider === "google"),
    );
  } catch {
    if (!allowLocalCriticalFallback) throw failClosedCriticalPath("Partner calendar busy check");
    return [];
  }
};

export const isSlotBlockedByBusyIntervals = (
  date: Date,
  time: string,
  durationMinutes: number,
  busyIntervals: PartnerCalendarBusyInterval[],
) => {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;

  const start = new Date(date);
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  return busyIntervals.some((interval) => {
    const busyStart = new Date(interval.start);
    const busyEnd = new Date(interval.end);
    if (Number.isNaN(busyStart.getTime()) || Number.isNaN(busyEnd.getTime())) return false;
    return start < busyEnd && end > busyStart;
  });
};
