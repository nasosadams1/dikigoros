import {
  canSubmitReview,
  getCanonicalBookingState,
  getCanonicalPaymentState,
  isBookingScheduled,
} from "@/lib/bookingState";
import { trackFunnelEvent } from "@/lib/funnelAnalytics";
import type { Level4PipelineStatus } from "@/lib/level4Marketplace";
import { allowLocalCriticalFallback, failClosedCriticalPath } from "@/lib/runtimeGuards";
import { publicSupabase } from "@/lib/supabase";
import {
  isPartnerSessionInvalidError,
  type PartnerSession,
  type StoredBooking,
  type StoredBookingDocument,
  type StoredLawyerReview,
  type StoredPayment,
} from "@/lib/platformRepository";

export interface PartnerCaseNote {
  id: string;
  bookingId: string;
  lawyerId: string;
  note: string;
  createdAt: string;
}

export interface PartnerFollowupTask {
  id: string;
  bookingId: string;
  lawyerId: string;
  dueAt: string;
  status: "open" | "done";
  title: string;
  createdAt: string;
}

export interface PartnerPipelineItem {
  booking: StoredBooking;
  payment?: StoredPayment;
  documents: StoredBookingDocument[];
  reviews: StoredLawyerReview[];
  status: Level4PipelineStatus;
  privateNotes: PartnerCaseNote[];
  followups: PartnerFollowupTask[];
}

const crmStorageKey = "dikigoros.partnerCrm.v1";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const readLocalCrm = () => {
  const storage = getStorage();
  if (!storage) return { notes: [] as PartnerCaseNote[], followups: [] as PartnerFollowupTask[] };
  try {
    const parsed = JSON.parse(storage.getItem(crmStorageKey) || "{}");
    return {
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      followups: Array.isArray(parsed.followups) ? parsed.followups : [],
    };
  } catch {
    return { notes: [] as PartnerCaseNote[], followups: [] as PartnerFollowupTask[] };
  }
};

const writeLocalCrm = (state: { notes: PartnerCaseNote[]; followups: PartnerFollowupTask[] }) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(crmStorageKey, JSON.stringify(state));
};

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `crm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const inferPipelineStatus = (
  booking: StoredBooking,
  payment?: StoredPayment,
  reviews: StoredLawyerReview[] = [],
  followups: PartnerFollowupTask[] = [],
): Level4PipelineStatus => {
  const bookingState = getCanonicalBookingState(booking);
  const paymentState = payment ? getCanonicalPaymentState(payment) : "not_opened";
  if (paymentState === "refund_requested" || paymentState === "failed") return "refund_risk";
  if (followups.some((task) => task.status === "open")) return "follow_up_needed";
  if (bookingState === "completed" && reviews.length === 0 && canSubmitReview(booking, payment)) return "review_pending";
  if (bookingState === "completed") return "completed";
  if (isBookingScheduled(booking, payment)) return "upcoming";
  if (paymentState === "paid") return "paid";
  return "booked";
};

export const buildPartnerPipelineItems = ({
  bookings,
  payments,
  documents,
  reviews,
  notes,
  followups,
}: {
  bookings: StoredBooking[];
  payments: StoredPayment[];
  documents: StoredBookingDocument[];
  reviews: StoredLawyerReview[];
  notes: PartnerCaseNote[];
  followups: PartnerFollowupTask[];
}): PartnerPipelineItem[] =>
  bookings.map((booking) => {
    const payment = payments.find((candidate) => candidate.bookingId === booking.id);
    const bookingReviews = reviews.filter((review) => review.bookingId === booking.id);
    const bookingFollowups = followups.filter((task) => task.bookingId === booking.id);
    return {
      booking,
      payment,
      documents: documents.filter((document) => document.bookingId === booking.id),
      reviews: bookingReviews,
      status: inferPipelineStatus(booking, payment, bookingReviews, bookingFollowups),
      privateNotes: notes.filter((note) => note.bookingId === booking.id),
      followups: bookingFollowups,
    };
  });

export const fetchPartnerCrmState = async (
  lawyerId?: string | null,
  partnerSession?: PartnerSession | null,
) => {
  if (!lawyerId || !partnerSession?.sessionToken) return readLocalCrm();

  try {
    const [notesResult, followupsResult] = await Promise.all([
      publicSupabase.rpc("list_partner_case_notes", {
        p_partner_email: partnerSession.email,
        p_session_token: partnerSession.sessionToken,
        p_lawyer_id: lawyerId,
      }),
      publicSupabase.rpc("list_partner_followup_tasks", {
        p_partner_email: partnerSession.email,
        p_session_token: partnerSession.sessionToken,
        p_lawyer_id: lawyerId,
      }),
    ]);

    if (notesResult.error) throw notesResult.error;
    if (followupsResult.error) throw followupsResult.error;

    return {
      notes: ((notesResult.data || []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        bookingId: String(row.booking_id),
        lawyerId: String(row.lawyer_id),
        note: String(row.note || ""),
        createdAt: String(row.created_at || new Date().toISOString()),
      })),
      followups: ((followupsResult.data || []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        bookingId: String(row.booking_id),
        lawyerId: String(row.lawyer_id),
        dueAt: String(row.due_at || ""),
        status: String(row.status || "open") as PartnerFollowupTask["status"],
        title: String(row.title || "Follow up"),
        createdAt: String(row.created_at || new Date().toISOString()),
      })),
    };
  } catch (error) {
    if (partnerSession?.sessionToken && isPartnerSessionInvalidError(error)) {
      throw new Error("PARTNER_SESSION_INVALID");
    }
    if (!allowLocalCriticalFallback) throw failClosedCriticalPath("Partner CRM");
    return readLocalCrm();
  }
};

export const savePartnerCaseNote = async (
  booking: StoredBooking,
  note: string,
  partnerSession?: PartnerSession | null,
) => {
  const record: PartnerCaseNote = {
    id: createId(),
    bookingId: booking.id,
    lawyerId: booking.lawyerId,
    note,
    createdAt: new Date().toISOString(),
  };

  try {
    if (!partnerSession?.sessionToken) throw new Error("PARTNER_SESSION_REQUIRED");
    const { data, error } = await publicSupabase.rpc("save_partner_case_note", {
      p_partner_email: partnerSession.email,
      p_session_token: partnerSession.sessionToken,
      p_note_id: record.id,
      p_booking_id: booking.id,
      p_note: note,
    });
    if (error || !data) throw error || new Error("Partner note was not persisted.");
    const row = data as Record<string, unknown>;
    return {
      ...record,
      id: String(row.id || record.id),
      createdAt: String(row.created_at || record.createdAt),
    };
  } catch (error) {
    if (partnerSession?.sessionToken && isPartnerSessionInvalidError(error)) {
      throw new Error("PARTNER_SESSION_INVALID");
    }
    if (!allowLocalCriticalFallback) throw failClosedCriticalPath("Partner CRM note");
    const state = readLocalCrm();
    writeLocalCrm({ ...state, notes: [record, ...state.notes] });
    return record;
  }
};

export const upsertPartnerFollowupTask = async (
  booking: StoredBooking,
  title: string,
  dueAt: string,
  partnerSession?: PartnerSession | null,
) => {
  const record: PartnerFollowupTask = {
    id: createId(),
    bookingId: booking.id,
    lawyerId: booking.lawyerId,
    title,
    dueAt,
    status: "open",
    createdAt: new Date().toISOString(),
  };

  try {
    if (!partnerSession?.sessionToken) throw new Error("PARTNER_SESSION_REQUIRED");
    const { data, error } = await publicSupabase.rpc("upsert_partner_followup_task", {
      p_partner_email: partnerSession.email,
      p_session_token: partnerSession.sessionToken,
      p_task_id: record.id,
      p_booking_id: booking.id,
      p_title: title,
      p_due_at: dueAt,
      p_status: "open",
    });
    if (error || !data) throw error || new Error("Partner follow-up was not persisted.");
    trackFunnelEvent("followup_task_created", { lawyerId: booking.lawyerId, bookingId: booking.id });
    return record;
  } catch (error) {
    if (partnerSession?.sessionToken && isPartnerSessionInvalidError(error)) {
      throw new Error("PARTNER_SESSION_INVALID");
    }
    if (!allowLocalCriticalFallback) throw failClosedCriticalPath("Partner follow-up");
    const state = readLocalCrm();
    writeLocalCrm({ ...state, followups: [record, ...state.followups] });
    return record;
  }
};

export const updatePartnerPipelineStatus = async (
  booking: StoredBooking,
  status: Level4PipelineStatus,
  partnerSession?: PartnerSession | null,
) => {
  try {
    if (!partnerSession?.sessionToken) throw new Error("PARTNER_SESSION_REQUIRED");
    const { error } = await publicSupabase.rpc("update_partner_pipeline_status", {
      p_partner_email: partnerSession.email,
      p_session_token: partnerSession.sessionToken,
      p_booking_id: booking.id,
      p_status: status,
    });
    if (error) throw error;
    trackFunnelEvent("pipeline_status_updated", { lawyerId: booking.lawyerId, bookingId: booking.id, status });
  } catch (error) {
    if (partnerSession?.sessionToken && isPartnerSessionInvalidError(error)) {
      throw new Error("PARTNER_SESSION_INVALID");
    }
    if (!allowLocalCriticalFallback) throw failClosedCriticalPath("Partner pipeline");
  }
};
