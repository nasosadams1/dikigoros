import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  fetchActiveCalendarConnections,
  getCorsHeaders,
  getRequiredEnv,
  getValidAccessToken,
  json,
  type CalendarProvider,
} from "../_shared/calendar-sync.ts";

interface BusyInterval {
  start: string;
  end: string;
  provider: CalendarProvider;
}

const toIso = (value: unknown) => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const fetchGoogleBusy = async (accessToken: string, rangeStartIso: string, rangeEndIso: string): Promise<BusyInterval[]> => {
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: rangeStartIso,
      timeMax: rangeEndIso,
      items: [{ id: "primary" }],
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "GOOGLE_FREEBUSY_FAILED");

  const primary = payload?.calendars?.primary?.busy || [];
  return Array.isArray(primary)
    ? primary
        .map((item) => ({ start: toIso(item.start), end: toIso(item.end), provider: "google" as const }))
        .filter((item) => item.start && item.end)
    : [];
};

export const getPartnerCalendarBusy = async (
  lawyerId: string,
  rangeStartIso: string,
  rangeEndIso: string,
) => {
  const connections = await fetchActiveCalendarConnections(lawyerId);
  if (connections.length === 0) return [] as BusyInterval[];

  const tokenSecret = getRequiredEnv("CALENDAR_TOKEN_SECRET");
  const busy: BusyInterval[] = [];

  for (const connection of connections) {
    if (connection.provider !== "google") continue;
    const accessToken = await getValidAccessToken(connection, tokenSecret);
    busy.push(...await fetchGoogleBusy(accessToken, rangeStartIso, rangeEndIso));
  }

  return busy;
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  try {
    const { lawyerId, rangeStartIso, rangeEndIso } = await request.json().catch(() => ({}));
    const normalizedLawyerId = String(lawyerId || "").trim();
    const start = toIso(rangeStartIso);
    const end = toIso(rangeEndIso);

    if (!normalizedLawyerId || !start || !end) {
      return json(request, { error: "lawyerId, rangeStartIso and rangeEndIso are required" }, 400);
    }

    return json(request, { busy: await getPartnerCalendarBusy(normalizedLawyerId, start, end) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar busy lookup failed";
    const status = message.startsWith("Missing ") ? 501 : 500;
    return json(request, { error: message }, status);
  }
});
