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
  | "approved_lawyer_first_completed_consultation";

export interface FunnelEvent {
  id: string;
  name: FunnelEventName;
  occurredAt: string;
  sessionId: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface FunnelMetric {
  name: FunnelEventName;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
}

const funnelStorageKey = "dikigoros.funnelEvents.v1";
const funnelSessionKey = "dikigoros.funnelSession.v1";
const maxStoredEvents = 600;

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

const canUseStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

const readStoredEvents = (): FunnelEvent[] => {
  if (!canUseStorage()) return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(funnelStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((event): event is FunnelEvent => Boolean(event?.name && event?.occurredAt)) : [];
  } catch {
    return [];
  }
};

const writeStoredEvents = (events: FunnelEvent[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(funnelStorageKey, JSON.stringify(events.slice(0, maxStoredEvents)));
};

const getFunnelSessionId = () => {
  if (!canUseStorage()) return "server";
  const existing = window.localStorage.getItem(funnelSessionKey);
  if (existing) return existing;
  const sessionId = `fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  window.localStorage.setItem(funnelSessionKey, sessionId);
  return sessionId;
};

export const trackFunnelEvent = (
  name: FunnelEventName,
  metadata?: FunnelEvent["metadata"],
) => {
  const event: FunnelEvent = {
    id: `fe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    occurredAt: new Date().toISOString(),
    sessionId: getFunnelSessionId(),
    metadata,
  };

  const nextEvents = [event, ...readStoredEvents()];
  writeStoredEvents(nextEvents);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dikigoros:funnel-event", { detail: event }));
  }

  return event;
};

export const getFunnelEvents = () => readStoredEvents();

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
  window.localStorage.removeItem(funnelStorageKey);
};
