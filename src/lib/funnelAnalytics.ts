import { supabase } from "@/lib/supabase";
import { allowLocalCriticalFallback, failClosedCriticalPath } from "@/lib/runtimeGuards";

export type FunnelEventName =
  | "homepage_search"
  | "search_profile_opened"
  | "profile_booking_start"
  | "booking_start"
  | "booking_created"
  | "payment_opened"
  | "payment_completed"
  | "consultation_completed"
  | "review_submitted"
  | "lawyer_application_submitted"
  | "lawyer_application_approved"
  | "approved_lawyer_first_completed_consultation"
  | "partner_plan_checkout_opened"
  | "partner_subscription_active"
  | "pipeline_status_updated"
  | "followup_task_created";

export interface FunnelEvent {
  id: string;
  name: FunnelEventName;
  occurredAt: string;
  sessionId: string;
  userId?: string | null;
  lawyerId?: string | null;
  bookingId?: string | null;
  city?: string | null;
  category?: string | null;
  source?: string | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface FunnelMetric {
  name: FunnelEventName;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
}

const pendingFunnelStorageKey = "dikigoros.funnelEvents.pending.v1";
const droppedFunnelStorageKey = "dikigoros.funnelEvents.dropped.v1";
const funnelSessionKey = "dikigoros.funnelSession.v1";
const maxStoredEvents = 600;
const funnelContractVersion = 2;

export const funnelSteps: Array<{ name: FunnelEventName; label: string }> = [
  { name: "homepage_search", label: "Αρχική -> αναζήτηση" },
  { name: "search_profile_opened", label: "Αναζήτηση -> προφίλ" },
  { name: "profile_booking_start", label: "Προφίλ -> έναρξη κράτησης" },
  { name: "booking_created", label: "Έναρξη -> κράτηση δημιουργήθηκε" },
  { name: "payment_opened", label: "Κράτηση -> άνοιγμα πληρωμής" },
  { name: "payment_completed", label: "Πληρωμή -> ολοκλήρωση" },
  { name: "consultation_completed", label: "Πληρωμή -> ολοκληρωμένη συμβουλευτική" },
  { name: "review_submitted", label: "Συμβουλευτική -> κριτική" },
  { name: "lawyer_application_submitted", label: "Αίτηση δικηγόρου" },
  { name: "lawyer_application_approved", label: "Έγκριση δικηγόρου" },
  { name: "approved_lawyer_first_completed_consultation", label: "Πρώτη ολοκληρωμένη συμβουλευτική συνεργάτη" },
];

funnelSteps.push(
  { name: "partner_plan_checkout_opened", label: "Partner plan checkout opened" },
  { name: "partner_subscription_active", label: "Partner subscription active" },
  { name: "pipeline_status_updated", label: "Partner pipeline updated" },
  { name: "followup_task_created", label: "Partner follow-up task created" },
);

const canUseStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

const readPendingEvents = (): FunnelEvent[] => {
  if (!canUseStorage()) return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(pendingFunnelStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((event): event is FunnelEvent => Boolean(event?.name && event?.occurredAt)) : [];
  } catch {
    return [];
  }
};

const writePendingEvents = (events: FunnelEvent[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(pendingFunnelStorageKey, JSON.stringify(events.slice(0, maxStoredEvents)));
};

const writeDroppedEvent = (event: FunnelEvent, reason: string) => {
  if (!canUseStorage()) return;
  const droppedEvents = readStoredEvents(droppedFunnelStorageKey);
  window.localStorage.setItem(
    droppedFunnelStorageKey,
    JSON.stringify([{ ...event, metadata: { ...(event.metadata || {}), dropReason: reason } }, ...droppedEvents].slice(0, maxStoredEvents)),
  );
};

const readStoredEvents = (key: string): FunnelEvent[] => {
  if (!canUseStorage()) return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((event): event is FunnelEvent => Boolean(event?.name && event?.occurredAt)) : [];
  } catch {
    return [];
  }
};

const getFunnelSessionId = () => {
  if (!canUseStorage()) return "server";
  const existing = window.localStorage.getItem(funnelSessionKey);
  if (existing) return existing;
  const sessionId = `fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  window.localStorage.setItem(funnelSessionKey, sessionId);
  return sessionId;
};

const getStringMetadata = (metadata: FunnelEvent["metadata"], key: string) => {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const sanitizeMetadata = (metadata: FunnelEvent["metadata"]) =>
  Object.fromEntries(Object.entries(metadata || {}).filter(([, value]) => value !== undefined));

const isInternalOrBotTraffic = (metadata: FunnelEvent["metadata"]) => {
  if (metadata?.internal === true || metadata?.source === "internal" || metadata?.source === "ops") return true;
  if (typeof navigator === "undefined") return false;
  if (navigator.webdriver) return true;
  return /bot|crawler|spider|headless|preview|lighthouse/i.test(navigator.userAgent || "");
};

const funnelEventToRow = (event: FunnelEvent) => ({
  event_name: event.name,
  occurred_at: event.occurredAt,
  session_id: event.sessionId,
  user_id: event.userId || getStringMetadata(event.metadata, "userId"),
  lawyer_id: event.lawyerId || getStringMetadata(event.metadata, "lawyerId"),
  booking_id: event.bookingId || getStringMetadata(event.metadata, "bookingId"),
  city: event.city || getStringMetadata(event.metadata, "city"),
  category: event.category || getStringMetadata(event.metadata, "category") || getStringMetadata(event.metadata, "specialty"),
  source: event.source || getStringMetadata(event.metadata, "source") || getStringMetadata(event.metadata, "surface"),
  metadata: {
    ...sanitizeMetadata(event.metadata),
    contractVersion: funnelContractVersion,
  },
});

const rowToFunnelEvent = (row: Record<string, unknown>): FunnelEvent => ({
  id: String(row.id || `remote-${row.event_name}-${row.occurred_at}`),
  name: row.event_name as FunnelEventName,
  occurredAt: String(row.occurred_at),
  sessionId: String(row.session_id || "backend"),
  userId: typeof row.user_id === "string" ? row.user_id : null,
  lawyerId: typeof row.lawyer_id === "string" ? row.lawyer_id : null,
  bookingId: typeof row.booking_id === "string" ? row.booking_id : null,
  city: typeof row.city === "string" ? row.city : null,
  category: typeof row.category === "string" ? row.category : null,
  source: typeof row.source === "string" ? row.source : null,
  metadata: typeof row.metadata === "object" && row.metadata ? (row.metadata as FunnelEvent["metadata"]) : {},
});

const persistFunnelEvent = async (event: FunnelEvent) => {
  const { error } = await supabase.from("funnel_events").insert(funnelEventToRow(event));
  if (error) throw error;
};

const flushPendingFunnelEvents = async () => {
  if (!allowLocalCriticalFallback) return;

  const pendingEvents = readPendingEvents();
  if (pendingEvents.length === 0) return;

  const remaining: FunnelEvent[] = [];
  for (const event of pendingEvents) {
    try {
      await persistFunnelEvent(event);
    } catch {
      remaining.push(event);
    }
  }
  writePendingEvents(remaining);
};

export const trackFunnelEvent = (name: FunnelEventName, metadata?: FunnelEvent["metadata"]) => {
  if (isInternalOrBotTraffic(metadata)) return null;

  const event: FunnelEvent = {
    id: `fe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    occurredAt: new Date().toISOString(),
    sessionId: getFunnelSessionId(),
    userId: getStringMetadata(metadata, "userId"),
    lawyerId: getStringMetadata(metadata, "lawyerId"),
    bookingId: getStringMetadata(metadata, "bookingId"),
    city: getStringMetadata(metadata, "city"),
    category: getStringMetadata(metadata, "category") || getStringMetadata(metadata, "specialty"),
    source: getStringMetadata(metadata, "source") || getStringMetadata(metadata, "surface"),
    metadata: sanitizeMetadata(metadata),
  };

  void persistFunnelEvent(event)
    .then(flushPendingFunnelEvents)
    .catch(() => {
      if (allowLocalCriticalFallback) {
        writePendingEvents([event, ...readPendingEvents()]);
      } else {
        writeDroppedEvent(event, "backend_write_failed");
      }
    });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dikigoros:funnel-event", { detail: event }));
  }

  return event;
};

export const getFunnelEvents = () => readPendingEvents();

export const getDroppedFunnelEvents = () => readStoredEvents(droppedFunnelStorageKey);

export const fetchFunnelEvents = async (): Promise<FunnelEvent[]> => {
  try {
    const { data, error } = await supabase
      .from("funnel_events")
      .select("id,event_name,occurred_at,session_id,user_id,lawyer_id,booking_id,city,category,source,metadata")
      .order("occurred_at", { ascending: false })
      .limit(2000);

    if (error) throw error;
    return (data || []).map((row) => rowToFunnelEvent(row as Record<string, unknown>));
  } catch {
    if (!allowLocalCriticalFallback) throw failClosedCriticalPath("Funnel analytics");
    return readPendingEvents();
  }
};

export const getFunnelMetrics = (events: FunnelEvent[] = getFunnelEvents()): FunnelMetric[] => {
  const counts = events.reduce<Record<string, number>>((accumulator, event) => {
    accumulator[event.name] = (accumulator[event.name] || 0) + 1;
    return accumulator;
  }, {});

  return funnelSteps.map((step, index) => {
    const count = counts[step.name] || 0;
    const previous = index > 0 ? counts[funnelSteps[index - 1].name] || 0 : 0;

    return {
      ...step,
      count,
      conversionFromPrevious: index === 0 || previous === 0 ? null : Math.round((count / previous) * 100),
    };
  });
};

export const clearFunnelEvents = () => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(pendingFunnelStorageKey);
  window.localStorage.removeItem(droppedFunnelStorageKey);
};
