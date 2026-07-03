import { allowLocalCriticalFallback, failClosedCriticalPath } from "@/lib/runtimeGuards";
import { trackFunnelEvent } from "@/lib/funnelAnalytics";
import { publicSupabase } from "@/lib/supabase";
import {
  isPartnerSessionInvalidError,
  type PartnerSession,
  type StoredBooking,
} from "@/lib/platformRepository";

export type PartnerCaseStatus =
  | "new"
  | "in_progress"
  | "waiting_documents"
  | "waiting_client"
  | "completed"
  | "archived";

export interface PartnerCase {
  id: string;
  lawyerId: string;
  clientName: string;
  clientEmail?: string;
  title: string;
  practiceArea: string;
  status: PartnerCaseStatus;
  nextStep: string;
  sourceBookingId?: string;
  bookingIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PartnerCasePrivateNote {
  id: string;
  caseId: string;
  lawyerId: string;
  note: string;
  createdAt: string;
}

export interface PartnerCaseHistoryEvent {
  id: string;
  caseId: string;
  lawyerId: string;
  eventType: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PartnerCasesState {
  cases: PartnerCase[];
  notes: PartnerCasePrivateNote[];
  history: PartnerCaseHistoryEvent[];
}

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const mapPartnerCase = (row: Record<string, unknown>): PartnerCase => ({
  id: String(row.id),
  lawyerId: String(row.lawyer_id),
  clientName: String(row.client_name || "Πελάτης"),
  clientEmail: row.client_email ? String(row.client_email) : undefined,
  title: String(row.title || "Υπόθεση"),
  practiceArea: String(row.practice_area || "Γενική υπόθεση"),
  status: String(row.status || "new") as PartnerCaseStatus,
  nextStep: String(row.next_step || ""),
  sourceBookingId: row.source_booking_id ? String(row.source_booking_id) : undefined,
  bookingIds: Array.isArray(row.booking_ids) ? row.booking_ids.map(String) : [],
  createdAt: String(row.created_at || new Date().toISOString()),
  updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
});

const mapCaseNote = (row: Record<string, unknown>): PartnerCasePrivateNote => ({
  id: String(row.id),
  caseId: String(row.case_id),
  lawyerId: String(row.lawyer_id),
  note: String(row.note || ""),
  createdAt: String(row.created_at || new Date().toISOString()),
});

const mapCaseHistoryEvent = (row: Record<string, unknown>): PartnerCaseHistoryEvent => ({
  id: String(row.id),
  caseId: String(row.case_id),
  lawyerId: String(row.lawyer_id),
  eventType: String(row.event_type || "case_updated"),
  message: String(row.message || ""),
  metadata: (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>,
  createdAt: String(row.created_at || new Date().toISOString()),
});

export const fetchPartnerCasesState = async (
  lawyerId?: string | null,
  partnerSession?: PartnerSession | null,
): Promise<PartnerCasesState> => {
  if (!lawyerId) return { cases: [], notes: [], history: [] };
  if (!partnerSession?.sessionToken) {
    if (allowLocalCriticalFallback) return { cases: [], notes: [], history: [] };
    throw failClosedCriticalPath("Partner cases");
  }

  try {
    const args = {
      p_partner_email: normalizeEmail(partnerSession.email),
      p_session_token: partnerSession.sessionToken,
      p_lawyer_id: lawyerId,
    };
    const [casesResult, notesResult, historyResult] = await Promise.all([
      publicSupabase.rpc("list_partner_cases", args),
      publicSupabase.rpc("list_partner_case_private_notes", args),
      publicSupabase.rpc("list_partner_case_history_events", args),
    ]);

    if (casesResult.error) throw casesResult.error;
    if (notesResult.error) throw notesResult.error;
    if (historyResult.error) throw historyResult.error;

    return {
      cases: ((casesResult.data || []) as Record<string, unknown>[]).map(mapPartnerCase),
      notes: ((notesResult.data || []) as Record<string, unknown>[]).map(mapCaseNote),
      history: ((historyResult.data || []) as Record<string, unknown>[]).map(mapCaseHistoryEvent),
    };
  } catch (error) {
    if (isPartnerSessionInvalidError(error)) throw new Error("PARTNER_SESSION_INVALID");
    if (!allowLocalCriticalFallback) throw failClosedCriticalPath("Partner cases");
    return { cases: [], notes: [], history: [] };
  }
};

export const createPartnerCaseFromBooking = async (
  booking: StoredBooking,
  partnerSession?: PartnerSession | null,
  options?: { title?: string; practiceArea?: string; nextStep?: string },
) => {
  if (!partnerSession?.sessionToken) throw new Error("PARTNER_SESSION_REQUIRED");

  try {
    const { data, error } = await publicSupabase.rpc("create_partner_case_from_booking", {
      p_partner_email: normalizeEmail(partnerSession.email),
      p_session_token: partnerSession.sessionToken,
      p_booking_id: booking.id,
      p_title: options?.title || booking.issueSummary || booking.consultationType,
      p_practice_area: options?.practiceArea || booking.consultationType,
      p_next_step: options?.nextStep || "Ορίστε το επόμενο βήμα συνεργασίας.",
    });

    if (error || !data) throw error || new Error("Partner case was not created.");
    const savedCase = mapPartnerCase({
      ...(data as Record<string, unknown>),
      booking_ids: [booking.id],
    });
    trackFunnelEvent("case_created", {
      lawyerId: savedCase.lawyerId,
      bookingId: booking.id,
      caseId: savedCase.id,
    });
    return savedCase;
  } catch (error) {
    if (isPartnerSessionInvalidError(error)) throw new Error("PARTNER_SESSION_INVALID");
    throw error;
  }
};

export const updatePartnerCase = async (
  partnerCase: PartnerCase,
  updates: Partial<Pick<PartnerCase, "title" | "practiceArea" | "status" | "nextStep">>,
  partnerSession?: PartnerSession | null,
) => {
  if (!partnerSession?.sessionToken) throw new Error("PARTNER_SESSION_REQUIRED");

  try {
    const { data, error } = await publicSupabase.rpc("update_partner_case", {
      p_partner_email: normalizeEmail(partnerSession.email),
      p_session_token: partnerSession.sessionToken,
      p_case_id: partnerCase.id,
      p_title: updates.title ?? null,
      p_practice_area: updates.practiceArea ?? null,
      p_status: updates.status ?? null,
      p_next_step: updates.nextStep ?? null,
    });

    if (error || !data) throw error || new Error("Partner case was not updated.");
    const updatedCase = mapPartnerCase({
      ...(data as Record<string, unknown>),
      booking_ids: partnerCase.bookingIds,
    });
    if (updates.status && updates.status !== partnerCase.status) {
      trackFunnelEvent("case_status_updated", {
        lawyerId: updatedCase.lawyerId,
        caseId: updatedCase.id,
        status: updatedCase.status,
      });
    }
    return updatedCase;
  } catch (error) {
    if (isPartnerSessionInvalidError(error)) throw new Error("PARTNER_SESSION_INVALID");
    throw error;
  }
};

export const savePartnerCasePrivateNote = async (
  partnerCase: PartnerCase,
  note: string,
  partnerSession?: PartnerSession | null,
) => {
  if (!partnerSession?.sessionToken) throw new Error("PARTNER_SESSION_REQUIRED");

  try {
    const { data, error } = await publicSupabase.rpc("save_partner_case_private_note", {
      p_partner_email: normalizeEmail(partnerSession.email),
      p_session_token: partnerSession.sessionToken,
      p_note_id: createId(),
      p_case_id: partnerCase.id,
      p_note: note,
    });

    if (error || !data) throw error || new Error("Partner case note was not saved.");
    const savedNote = mapCaseNote(data as Record<string, unknown>);
    trackFunnelEvent("case_note_created", {
      lawyerId: savedNote.lawyerId,
      caseId: savedNote.caseId,
    });
    return savedNote;
  } catch (error) {
    if (isPartnerSessionInvalidError(error)) throw new Error("PARTNER_SESSION_INVALID");
    throw error;
  }
};
