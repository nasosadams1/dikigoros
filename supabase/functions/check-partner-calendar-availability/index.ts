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

const getAthensOffset = (dateIso: string) => {
  const reference = new Date(`${dateIso}T12:00:00Z`);
  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Athens",
    timeZoneName: "longOffset",
  })
    .formatToParts(reference)
    .find((part) => part.type === "timeZoneName")?.value;

  return offsetPart?.replace("GMT", "") || "+02:00";
};

const getSlotRange = (dateIso: string, time: string, durationMinutes: number) => {
  const [hours, minutes] = time.split(":").map(Number);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso) || !Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw new Error("INVALID_SLOT_TIME");
  }
  const offset = getAthensOffset(dateIso);
  const start = new Date(`${dateIso}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00${offset}`);
  const end = new Date(start.getTime() + Math.max(20, durationMinutes || 30) * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
};

const overlaps = (slotStart: string, slotEnd: string, busy: BusyInterval) => {
  const start = new Date(slotStart);
  const end = new Date(slotEnd);
  const busyStart = new Date(busy.start);
  const busyEnd = new Date(busy.end);
  return start < busyEnd && end > busyStart;
};

const fetchGoogleBusy = async (accessToken: string, rangeStartIso: string, rangeEndIso: string): Promise<BusyInterval[]> => {
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: rangeStartIso, timeMax: rangeEndIso, items: [{ id: "primary" }] }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "GOOGLE_FREEBUSY_FAILED");
  return Array.isArray(payload?.calendars?.primary?.busy)
    ? payload.calendars.primary.busy
        .map((item) => ({ start: toIso(item.start), end: toIso(item.end), provider: "google" as const }))
        .filter((item) => item.start && item.end)
    : [];
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  try {
    const { lawyerId, dateIso, time, durationMinutes } = await request.json().catch(() => ({}));
    const normalizedLawyerId = String(lawyerId || "").trim();
    if (!normalizedLawyerId) return json(request, { error: "lawyerId is required" }, 400);

    const connections = await fetchActiveCalendarConnections(normalizedLawyerId);
    if (connections.length === 0) return json(request, { ok: true, checked: false });

    const slot = getSlotRange(String(dateIso || ""), String(time || ""), Number(durationMinutes || 30));
    const tokenSecret = getRequiredEnv("CALENDAR_TOKEN_SECRET");

    for (const connection of connections) {
      if (connection.provider !== "google") continue;
      const accessToken = await getValidAccessToken(connection, tokenSecret);
      const busy = await fetchGoogleBusy(accessToken, slot.start, slot.end);
      if (busy.some((interval) => overlaps(slot.start, slot.end, interval))) {
        return json(request, { ok: false, reason: "BOOKING_SLOT_UNAVAILABLE", provider: connection.provider }, 409);
      }
    }

    return json(request, { ok: true, checked: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar availability check failed";
    const status = message.startsWith("Missing ") ? 501 : 500;
    return json(request, { error: message }, status);
  }
});
