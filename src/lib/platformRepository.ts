import {
  getSupabaseAnonKey,
  getSupabaseFunctionUrl,
  getVerifiedSession,
  publicSupabase,
  supabase,
} from "@/lib/supabase";
import {
  normalizeBookingState,
  normalizePaymentState,
  normalizeReviewPublicationState,
  type BookingState,
  type PaymentState,
  type ReviewPublicationState,
} from "@/lib/bookingState";
import {
  normalizeAllowedMarketplaceCity,
  normalizeLegalPracticeAreas,
} from "@/lib/marketplaceTaxonomy";
import { allowLocalCriticalFallback, failClosedCriticalPath } from "@/lib/runtimeGuards";

export type PersistenceSource = "supabase" | "local";

export interface BookingPayload {
  userId?: string;
  lawyerId: string;
  lawyerName: string;
  consultationType: string;
  consultationMode: string;
  price: number;
  duration: string;
  dateLabel: string;
  time: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  issueSummary?: string;
}

export interface StoredBooking extends BookingPayload {
  id: string;
  referenceId: string;
  status: BookingState;
  createdAt: string;
  persistenceSource: PersistenceSource;
}

export interface StoredPayment {
  id: string;
  bookingId: string;
  userId?: string;
  lawyerId: string;
  amount: number;
  currency: "EUR";
  status: PaymentState;
  invoiceNumber: string;
  provider: "stripe";
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  checkoutSessionUrl?: string;
  receiptUrl?: string;
  createdAt: string;
  updatedAt?: string;
  paidAt?: string;
  persistenceSource: PersistenceSource;
}

export interface StoredLawyerReview {
  id: string;
  bookingId: string;
  lawyerId: string;
  clientName: string;
  rating: number;
  clarityRating: number;
  responsivenessRating: number;
  text: string;
  consultationType: string;
  date: string;
  status: ReviewPublicationState;
  reply: string;
  persistenceSource: PersistenceSource;
}

export interface StoredBookingDocument {
  id: string;
  bookingId?: string;
  bookingReference?: string;
  clientName?: string;
  name: string;
  size: number;
  type: string;
  category: string;
  visibleToLawyer: boolean;
  malwareScanStatus?: "pending" | "clean" | "blocked" | "failed";
  uploadedAt: string;
  storagePath?: string;
  downloadUrl?: string;
  persistenceSource: PersistenceSource;
}

export interface PaymentSetupSession {
  provider: "stripe";
  status: "setup_required" | "ready";
  id?: string;
  url?: string;
  clientSecret?: string;
  requestedAt: string;
  persistenceSource: PersistenceSource;
}

export interface BookingRefundResult {
  provider: "stripe";
  status: "refunded" | "pending" | "review_required";
  refundId?: string;
  requestedAt: string;
  persistenceSource: PersistenceSource;
}

export interface PartnerApplicationPayload {
  fullName: string;
  workEmail: string;
  phone: string;
  city: string;
  lawFirmName?: string;
  websiteOrLinkedIn?: string;
  barAssociation: string;
  registrationNumber: string;
  yearsOfExperience: string;
  specialties: string[];
  professionalBio: string;
  documents: Array<{
    name: string;
    size: number;
    type: string;
  }>;
}

export interface StoredPartnerApplication extends PartnerApplicationPayload {
  id: string;
  referenceId: string;
  status: "under_review" | "needs_more_info" | "approved" | "rejected";
  createdAt: string;
  persistenceSource: PersistenceSource;
}

export interface SubmissionResult<T> {
  record: T;
  source: PersistenceSource;
  syncError?: string;
}

export interface BookingMutationResult {
  booking: StoredBooking | null;
  synced: boolean;
  error?: string;
}

export interface PartnerSession {
  email: string;
  sessionToken?: string;
  verifiedAt: string;
  expiresAt: string;
  role: "partner";
  approved: true;
}

const bookingStorageKey = "dikigoros.bookingRequests.v1";
const paymentStorageKey = "dikigoros.bookingPayments.v1";
const applicationStorageKey = "dikigoros.partnerApplications.v1";
const partnerSessionStorageKey = "dikigoros.partnerSession.v1";
const bookingTableName = (import.meta.env.VITE_SUPABASE_BOOKINGS_TABLE as string | undefined) || "booking_requests";
const isTestMode = import.meta.env.MODE === "test";
const requireLivePayments = import.meta.env.VITE_REQUIRE_LIVE_PAYMENTS === "true";
const enableLocalBookingFallback =
  allowLocalCriticalFallback &&
  (isTestMode ||
  (import.meta.env.DEV &&
    !requireLivePayments &&
    import.meta.env.VITE_ENABLE_LOCAL_BOOKING_FALLBACK === "true"));
const enableLocalApplicationFallback =
  allowLocalCriticalFallback &&
  (isTestMode || (import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_PARTNER_APPLICATION_FALLBACK === "true"));
const partnerSessionMaxAgeMs = 2 * 60 * 60 * 1000;

export const isVerifiedBooking = (booking?: Pick<StoredBooking, "persistenceSource"> | null) =>
  booking?.persistenceSource === "supabase";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const readStoredList = <T>(key: string): T[] => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const rawValue = storage.getItem(key);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const writeStoredList = <T>(key: string, records: T[]) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(records));
};

const sortNewestFirst = <T extends { createdAt?: string; uploadedAt?: string; date?: string }>(items: T[]) =>
  [...items].sort((a, b) => {
    const left = new Date(a.createdAt || a.uploadedAt || a.date || 0).getTime();
    const right = new Date(b.createdAt || b.uploadedAt || b.date || 0).getTime();
    return right - left;
  });

const mergeById = <T extends { id: string; createdAt?: string; uploadedAt?: string; date?: string }>(
  remoteItems: T[],
  localItems: T[],
) => {
  const seen = new Set<string>();
  const merged: T[] = [];

  [...remoteItems, ...localItems].forEach((item) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    merged.push(item);
  });

  return sortNewestFirst(merged);
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown persistence error";
};

const getErrorField = (error: unknown, field: "code" | "details" | "hint") => {
  if (typeof error !== "object" || !error || !(field in error)) return "";
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
};

export const isPartnerSessionInvalidError = (error: unknown) => {
  const message = getErrorMessage(error);
  const code = getErrorField(error, "code");
  const details = getErrorField(error, "details");
  const hint = getErrorField(error, "hint");

  return (
    code === "42501" ||
    message.includes("PARTNER_SESSION_INVALID") ||
    details.includes("PARTNER_SESSION_INVALID") ||
    hint.includes("PARTNER_SESSION_INVALID") ||
    message.includes("401") ||
    message.includes("Unauthorized")
  );
};

const isSlotUnavailableError = (error: unknown) => getErrorMessage(error).includes("BOOKING_SLOT_UNAVAILABLE");
const isSelfBookingForbiddenError = (error: unknown) => getErrorMessage(error).includes("SELF_BOOKING_FORBIDDEN");

const getAuthenticatedEdgeSession = async () => {
  const { session, user } = await getVerifiedSession();
  if (!session?.access_token || !user?.id) throw new Error("AUTH_REQUIRED");
  return { session, user };
};

const getEdgeFunctionErrorMessage = (payload: unknown, status: number) => {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (typeof payload === "object" && payload) {
    const candidate = payload as { error?: unknown; message?: unknown };
    if (typeof candidate.error === "string" && candidate.error.trim()) return candidate.error.trim();
    if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message.trim();
  }
  return `EDGE_FUNCTION_${status}`;
};

const parseEdgeFunctionPayload = async (response: Response) => {
  const rawPayload = await response.text();
  if (!rawPayload) return null;

  try {
    return JSON.parse(rawPayload) as unknown;
  } catch {
    return rawPayload;
  }
};

const invokeAuthenticatedEdgeFunction = async <T>(
  functionName: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(getSupabaseFunctionUrl(functionName), {
    method: "POST",
    headers: {
      apikey: getSupabaseAnonKey(),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await parseEdgeFunctionPayload(response);

  if (!response.ok) {
    throw new Error(getEdgeFunctionErrorMessage(payload, response.status));
  }

  return (payload || {}) as T;
};

interface PartnerVerificationResponse {
  ok?: boolean;
  sessionToken?: string;
  session_token?: string;
  expiresAt?: string;
  expires_at?: string;
}

const getPartnerVerificationPayload = (data: unknown): PartnerVerificationResponse | null => {
  if (!data || typeof data !== "object") return null;
  return data as PartnerVerificationResponse;
};

const getRandomSegment = () => {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0].toString(36).slice(0, 5).toUpperCase();
  }

  return Math.random().toString(36).slice(2, 7).toUpperCase();
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value?: string | null) => Boolean(value && uuidPattern.test(value));

const createRecordId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const bytes =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto.getRandomValues(new Uint8Array(16))
      : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const createReferenceId = (prefix: "BK" | "PA") => {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  return `${prefix}-${datePart}-${getRandomSegment()}`;
};

export const getStoredBookings = () =>
  readStoredList<StoredBooking>(bookingStorageKey).map((booking) => ({
    ...booking,
    status: normalizeBookingState(booking.status),
  }));

export const getStoredPayments = () =>
  readStoredList<StoredPayment>(paymentStorageKey).map((payment) => ({
    ...payment,
    status: normalizePaymentState(payment.status, {
      checkoutSessionId: payment.stripeCheckoutSessionId,
      checkoutSessionUrl: payment.checkoutSessionUrl,
    }),
  }));

export const getStoredBookingById = (bookingId?: string | null) =>
  bookingId ? getStoredBookings().find((booking) => booking.id === bookingId) || null : null;

export const getStoredPaymentForBooking = (bookingId?: string | null) =>
  bookingId ? getStoredPayments().find((payment) => payment.bookingId === bookingId) || null : null;

export const getStoredBookingsForUser = (userId?: string | null, email?: string | null) => {
  const normalizedEmail = email?.trim().toLowerCase();

  return getStoredBookings().filter((booking) => {
    if (userId && booking.userId === userId) return true;
    if (normalizedEmail && booking.clientEmail.trim().toLowerCase() === normalizedEmail) return true;
    return false;
  });
};

export const getStoredBookingsForLawyer = (lawyerId?: string | null) => {
  if (!lawyerId) return [];
  return getStoredBookings().filter((booking) => booking.lawyerId === lawyerId);
};

export const getStoredPaymentsForUser = (userId?: string | null, email?: string | null) => {
  const userBookings = getStoredBookingsForUser(userId, email);
  const bookingIds = new Set(userBookings.map((booking) => booking.id));

  return getStoredPayments().filter((payment) => {
    if (userId && payment.userId === userId) return true;
    return bookingIds.has(payment.bookingId);
  });
};

export const getStoredPaymentsForLawyer = (lawyerId?: string | null) => {
  if (!lawyerId) return [];
  return getStoredPayments().filter((payment) => payment.lawyerId === lawyerId);
};

interface BookingRequestRow {
  id: string;
  user_id: string | null;
  reference_id: string;
  lawyer_id: string;
  lawyer_name: string;
  consultation_type: string;
  consultation_mode: string;
  price: number;
  duration: string;
  date_label: string;
  time: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  issue_summary: string | null;
  status: string;
  created_at: string;
}

interface PaymentRow {
  id: string;
  booking_id: string;
  user_id: string | null;
  lawyer_id: string;
  amount: number;
  currency: "EUR";
  status: string;
  invoice_number: string;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  checkout_session_url?: string | null;
  receipt_url?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface PartnerApplicationRow {
  id: string;
  reference_id: string;
  full_name: string;
  work_email: string;
  phone: string;
  city: string;
  law_firm_name?: string | null;
  website_or_linkedin?: string | null;
  bar_association: string;
  registration_number: string;
  years_of_experience: string;
  specialties: unknown;
  professional_bio: string;
  document_metadata: unknown;
  status: string;
  created_at: string;
}

interface ReviewRow {
  id: string;
  booking_id: string;
  user_id: string;
  lawyer_id: string;
  rating: number;
  clarity_rating: number;
  responsiveness_rating: number;
  review_text: string;
  lawyer_reply?: string | null;
  status: string;
  created_at: string;
  client_name?: string | null;
  consultation_type?: string | null;
  booking_requests?: {
    client_name?: string | null;
    consultation_type?: string | null;
  } | null;
}

interface BookingDocumentRow {
  id: string;
  booking_id: string | null;
  name: string;
  size: number;
  mime_type: string | null;
  category: string;
  storage_path: string | null;
  visible_to_lawyer: boolean;
  malware_scan_status?: "pending" | "clean" | "blocked" | "failed" | null;
  created_at: string;
  reference_id?: string | null;
  client_name?: string | null;
  booking_requests?: {
    reference_id?: string | null;
    client_name?: string | null;
  } | null;
}

const bookingFromRow = (row: BookingRequestRow): StoredBooking => ({
  id: row.id,
  userId: row.user_id || undefined,
  referenceId: row.reference_id,
  lawyerId: row.lawyer_id,
  lawyerName: row.lawyer_name,
  consultationType: row.consultation_type,
  consultationMode: row.consultation_mode,
  price: Number(row.price),
  duration: row.duration,
  dateLabel: row.date_label,
  time: row.time,
  clientName: row.client_name,
  clientEmail: row.client_email,
  clientPhone: row.client_phone,
  issueSummary: row.issue_summary || undefined,
  status: normalizeBookingState(row.status),
  createdAt: row.created_at,
  persistenceSource: "supabase",
});

const paymentFromRow = (row: PaymentRow): StoredPayment => ({
  id: row.id,
  bookingId: row.booking_id,
  userId: row.user_id || undefined,
  lawyerId: row.lawyer_id,
  amount: Number(row.amount),
  currency: row.currency || "EUR",
  status: normalizePaymentState(row.status, {
    checkoutSessionId: row.stripe_checkout_session_id,
    checkoutSessionUrl: row.checkout_session_url,
  }),
  invoiceNumber: row.invoice_number,
  provider: "stripe",
  stripeCheckoutSessionId: row.stripe_checkout_session_id || undefined,
  stripePaymentIntentId: row.stripe_payment_intent_id || undefined,
  checkoutSessionUrl: row.checkout_session_url || undefined,
  receiptUrl: row.receipt_url || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at || undefined,
  paidAt: row.paid_at || undefined,
  persistenceSource: "supabase",
});

const reviewFromRow = (row: ReviewRow): StoredLawyerReview => ({
  id: row.id,
  bookingId: row.booking_id,
  lawyerId: row.lawyer_id,
  clientName: row.booking_requests?.client_name || row.client_name || "Επαληθευμένος πελάτης",
  rating: Number(row.rating),
  clarityRating: Number(row.clarity_rating),
  responsivenessRating: Number(row.responsiveness_rating),
  text: row.review_text,
  consultationType: row.booking_requests?.consultation_type || row.consultation_type || "Συνεδρία",
  date: row.created_at,
  status: normalizeReviewPublicationState(row.status),
  reply: row.lawyer_reply || "",
  persistenceSource: "supabase",
});

const documentFromRow = (row: BookingDocumentRow): StoredBookingDocument => ({
  id: row.id,
  bookingId: row.booking_id || undefined,
  bookingReference: row.booking_requests?.reference_id || row.reference_id || undefined,
  clientName: row.booking_requests?.client_name || row.client_name || undefined,
  name: row.name,
  size: Number(row.size),
  type: row.mime_type || "unknown",
  category: row.category,
  visibleToLawyer: row.visible_to_lawyer,
  malwareScanStatus: row.malware_scan_status || "pending",
  uploadedAt: row.created_at,
  storagePath: row.storage_path || undefined,
  persistenceSource: "supabase",
});

const normalizeDocumentMetadata = (value: unknown): PartnerApplicationPayload["documents"] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as { name?: unknown; size?: unknown; type?: unknown };
      if (typeof candidate.name !== "string") return null;
      return {
        name: candidate.name,
        size: Number(candidate.size || 0),
        type: typeof candidate.type === "string" ? candidate.type : "unknown",
      };
    })
    .filter((item): item is PartnerApplicationPayload["documents"][number] => Boolean(item));
};

const partnerApplicationFromRow = (row: PartnerApplicationRow): StoredPartnerApplication => ({
  id: row.id,
  referenceId: row.reference_id,
  fullName: row.full_name,
  workEmail: row.work_email,
  phone: row.phone,
  city: row.city,
  lawFirmName: row.law_firm_name || undefined,
  websiteOrLinkedIn: row.website_or_linkedin || undefined,
  barAssociation: row.bar_association,
  registrationNumber: row.registration_number,
  yearsOfExperience: row.years_of_experience,
  specialties: Array.isArray(row.specialties) ? row.specialties.filter((item): item is string => typeof item === "string") : [],
  professionalBio: row.professional_bio,
  documents: normalizeDocumentMetadata(row.document_metadata),
  status:
    row.status === "needs_more_info" || row.status === "approved" || row.status === "rejected"
      ? row.status
      : "under_review",
  createdAt: row.created_at,
  persistenceSource: "supabase",
});

const fetchSignedDocumentUrl = async (storagePath?: string | null) => {
  if (!storagePath) return undefined;

  try {
    const { data, error } = await supabase.storage
      .from("legal-documents")
      .createSignedUrl(storagePath, 60 * 10);
    if (error) throw error;
    return data?.signedUrl;
  } catch {
    return undefined;
  }
};

const requestPartnerDocumentUrl = async (
  documentId: string,
  partnerSession?: PartnerSession | null,
) => {
  if (!partnerSession?.sessionToken) return undefined;

  try {
    const { data, error } = await publicSupabase.functions.invoke("create-partner-document-url", {
      body: {
        email: normalizeEmail(partnerSession.email),
        sessionToken: partnerSession.sessionToken,
        documentId,
      },
    });

    if (error) throw error;
    return typeof data?.url === "string" ? data.url : undefined;
  } catch {
    return undefined;
  }
};

export const fetchBookingsForUser = async (userId?: string | null, email?: string | null) => {
  const localBookings = enableLocalBookingFallback ? getStoredBookingsForUser(userId, email) : [];
  if (!userId) return localBookings;

  try {
    const { data, error } = await supabase
      .from(bookingTableName)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    const remoteBookings = (data || []).map((row) => bookingFromRow(row as BookingRequestRow));
    return enableLocalBookingFallback ? mergeById(remoteBookings, localBookings) : remoteBookings;
  } catch (error) {
    if (!enableLocalBookingFallback) throw failClosedCriticalPath("Booking history");
    return localBookings;
  }
};

export const fetchPaymentsForUser = async (userId?: string | null, email?: string | null) => {
  const localPayments = enableLocalBookingFallback ? getStoredPaymentsForUser(userId, email) : [];
  if (!userId) return localPayments;

  try {
    const { data, error } = await supabase
      .from("booking_payments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    const remotePayments = (data || []).map((row) => paymentFromRow(row as PaymentRow));
    return enableLocalBookingFallback ? mergeById(remotePayments, localPayments) : remotePayments;
  } catch (error) {
    if (!enableLocalBookingFallback) throw failClosedCriticalPath("Payment history");
    return localPayments;
  }
};

const getPartnerRpcArgs = (lawyerId: string, partnerSession?: PartnerSession | null) => {
  if (!partnerSession?.sessionToken) return null;
  return {
    p_partner_email: normalizeEmail(partnerSession.email),
    p_session_token: partnerSession.sessionToken,
    p_lawyer_id: lawyerId,
  };
};

export const fetchBookingsForLawyer = async (lawyerId?: string | null, partnerSession?: PartnerSession | null) => {
  const localBookings = enableLocalBookingFallback ? getStoredBookingsForLawyer(lawyerId) : [];
  if (!lawyerId) return localBookings;

  try {
    const partnerRpcArgs = getPartnerRpcArgs(lawyerId, partnerSession);
    const { data, error } = partnerRpcArgs
      ? await publicSupabase.rpc("list_bookings_as_partner", partnerRpcArgs)
      : await supabase
          .from(bookingTableName)
          .select("*")
          .eq("lawyer_id", lawyerId)
          .order("created_at", { ascending: false });

    if (error) throw error;
    const remoteBookings = (data || []).map((row) => bookingFromRow(row as BookingRequestRow));
    return enableLocalBookingFallback ? mergeById(remoteBookings, localBookings) : remoteBookings;
  } catch (error) {
    if (partnerSession?.sessionToken && isPartnerSessionInvalidError(error)) {
      throw new Error("PARTNER_SESSION_INVALID");
    }
    if (!enableLocalBookingFallback) throw failClosedCriticalPath("Partner bookings");
    return localBookings;
  }
};

export const fetchPaymentsForLawyer = async (lawyerId?: string | null, partnerSession?: PartnerSession | null) => {
  const localPayments = enableLocalBookingFallback ? getStoredPaymentsForLawyer(lawyerId) : [];
  if (!lawyerId) return localPayments;

  try {
    const partnerRpcArgs = getPartnerRpcArgs(lawyerId, partnerSession);
    const { data, error } = partnerRpcArgs
      ? await publicSupabase.rpc("list_payments_as_partner", partnerRpcArgs)
      : await supabase
          .from("booking_payments")
          .select("*")
          .eq("lawyer_id", lawyerId)
          .order("created_at", { ascending: false });

    if (error) throw error;
    const remotePayments = (data || []).map((row) => paymentFromRow(row as PaymentRow));
    return enableLocalBookingFallback ? mergeById(remotePayments, localPayments) : remotePayments;
  } catch (error) {
    if (partnerSession?.sessionToken && isPartnerSessionInvalidError(error)) {
      throw new Error("PARTNER_SESSION_INVALID");
    }
    if (!enableLocalBookingFallback) throw failClosedCriticalPath("Partner payments");
    return localPayments;
  }
};

export const fetchReviewsForLawyer = async (
  lawyerId?: string | null,
  includeModerated = true,
  partnerSession?: PartnerSession | null,
) => {
  if (!lawyerId) return [];

  try {
    const partnerRpcArgs = getPartnerRpcArgs(lawyerId, partnerSession);
    if (partnerRpcArgs) {
      const { data, error } = await publicSupabase.rpc("list_reviews_as_partner", partnerRpcArgs);
      if (error) throw error;
      return (data || []).map((row) => reviewFromRow(row as ReviewRow));
    }

    let query = supabase
      .from("booking_reviews")
      .select("id,booking_id,user_id,lawyer_id,rating,clarity_rating,responsiveness_rating,review_text,lawyer_reply,status,created_at,booking_requests(client_name,consultation_type)")
      .eq("lawyer_id", lawyerId)
      .order("created_at", { ascending: false });

    if (!includeModerated) query = query.eq("status", "published");

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => reviewFromRow(row as ReviewRow));
  } catch (error) {
    if (partnerSession?.sessionToken && isPartnerSessionInvalidError(error)) {
      throw new Error("PARTNER_SESSION_INVALID");
    }
    if (!enableLocalBookingFallback) throw failClosedCriticalPath("Partner documents");
    return [];
  }
};

export const updateLawyerReview = async (
  reviewId: string,
  updates: Partial<Pick<StoredLawyerReview, "reply" | "status">>,
  partnerSession?: PartnerSession | null,
) => {
  if (!partnerSession?.sessionToken) {
    if (enableLocalBookingFallback) return;
    throw new Error("Λείπει το token συνεδρίας συνεργάτη.");
  }

  try {
    const { error } = await publicSupabase.rpc("update_review_as_partner", {
      p_partner_email: normalizeEmail(partnerSession.email),
      p_session_token: partnerSession.sessionToken,
      p_review_id: reviewId,
      p_lawyer_reply: updates.reply ?? null,
      p_status: updates.status ?? null,
    });
    if (error) throw error;
  } catch (error) {
    if (isPartnerSessionInvalidError(error)) throw new Error("PARTNER_SESSION_INVALID");
    if (!enableLocalBookingFallback) throw error;
    // The partner view remains optimistic when the backend is offline.
  }
};

export const fetchDocumentsForLawyer = async (
  lawyerId?: string | null,
  partnerSession?: PartnerSession | null,
): Promise<StoredBookingDocument[]> => {
  if (!lawyerId) return [];

  try {
    const partnerRpcArgs = getPartnerRpcArgs(lawyerId, partnerSession);
    const { data, error } = partnerRpcArgs
      ? await publicSupabase.rpc("list_documents_as_partner", partnerRpcArgs)
        : await supabase
          .from("user_documents")
          .select("id,booking_id,name,size,mime_type,category,storage_path,visible_to_lawyer,malware_scan_status,created_at,booking_requests!inner(reference_id,client_name,lawyer_id)")
          .eq("visible_to_lawyer", true)
          .eq("malware_scan_status", "clean")
          .eq("booking_requests.lawyer_id", lawyerId)
          .order("created_at", { ascending: false });

    if (error) throw error;
    const documents = (data || []).map((row) => documentFromRow(row as BookingDocumentRow));
    return Promise.all(
      documents.map(async (document) => ({
        ...document,
        downloadUrl: partnerRpcArgs
          ? await requestPartnerDocumentUrl(document.id, partnerSession)
          : document.malwareScanStatus === "clean"
            ? await fetchSignedDocumentUrl(document.storagePath)
            : undefined,
      })),
    );
  } catch (error) {
    if (partnerSession?.sessionToken && isPartnerSessionInvalidError(error)) {
      throw new Error("PARTNER_SESSION_INVALID");
    }
    return [];
  }
};

export const getStoredPartnerApplications = () =>
  readStoredList<StoredPartnerApplication>(applicationStorageKey);

export const getBookingSlotKey = (booking: Pick<BookingPayload, "lawyerId" | "dateLabel" | "time">) =>
  `${booking.lawyerId}::${booking.dateLabel}::${booking.time}`;

export const getReservedBookingSlots = (lawyerId: string) =>
  new Set(
    getStoredBookings()
      .filter((booking) =>
        booking.lawyerId === lawyerId &&
        ["pending_confirmation", "confirmed_unpaid", "confirmed_paid"].includes(booking.status),
      )
      .map(getBookingSlotKey),
  );

export const fetchReservedBookingSlots = async (lawyerId: string) => {
  try {
    const { data, error } = await supabase
      .from(bookingTableName)
      .select("lawyer_id,date_label,time")
      .eq("lawyer_id", lawyerId)
      .in("status", ["pending_confirmation", "confirmed_unpaid", "confirmed_paid", "confirmed"]);

    if (error) throw error;

    const remoteSlots = new Set(
      (data || []).map((booking) =>
        getBookingSlotKey({
          lawyerId: String(booking.lawyer_id),
          dateLabel: String(booking.date_label),
          time: String(booking.time),
        }),
      ),
    );

    if (enableLocalBookingFallback) {
      getReservedBookingSlots(lawyerId).forEach((slot) => remoteSlots.add(slot));
    }
    return remoteSlots;
  } catch {
    if (!enableLocalBookingFallback) throw failClosedCriticalPath("Booking availability");
    return enableLocalBookingFallback ? getReservedBookingSlots(lawyerId) : new Set<string>();
  }
};

const persistLocalBooking = (booking: StoredBooking) => {
  const existing = getStoredBookings();
  const bySlot = existing.filter((record) => getBookingSlotKey(record) !== getBookingSlotKey(booking));
  writeStoredList(bookingStorageKey, [booking, ...bySlot]);
};

const buildInvoiceNumber = (booking: StoredBooking) => `INV-${booking.referenceId.replace(/^BK-/, "")}`;

const createPaymentRecordFromBooking = (
  booking: StoredBooking,
  persistenceSource: PersistenceSource = "local",
): StoredPayment => ({
  id: createRecordId(),
  bookingId: booking.id,
  userId: booking.userId,
  lawyerId: booking.lawyerId,
  amount: booking.price,
  currency: "EUR",
  status: "not_opened",
  invoiceNumber: buildInvoiceNumber(booking),
  provider: "stripe",
  createdAt: new Date().toISOString(),
  persistenceSource,
});

const persistLocalPayment = (payment: StoredPayment) => {
  const existing = getStoredPayments().filter((record) => record.bookingId !== payment.bookingId);
  writeStoredList(paymentStorageKey, [payment, ...existing]);
};

export const recordLocalCheckoutReturn = (
  bookingId: string,
  status: Extract<PaymentState, "paid" | "failed" | "checkout_opened">,
  stripeCheckoutSessionId?: string | null,
) => {
  if (!enableLocalBookingFallback) return null;

  const booking = getStoredBookingById(bookingId);
  if (!booking) return null;

  const existingPayment = getStoredPaymentForBooking(bookingId);
  const now = new Date().toISOString();
  const nextStatus = existingPayment?.status === "paid" ? "paid" : status;
  const payment: StoredPayment = {
    ...(existingPayment || createPaymentRecordFromBooking(booking, booking.persistenceSource)),
    status: nextStatus,
    stripeCheckoutSessionId: stripeCheckoutSessionId || existingPayment?.stripeCheckoutSessionId,
    paidAt: nextStatus === "paid" ? existingPayment?.paidAt || now : existingPayment?.paidAt,
    updatedAt: now,
  };

  persistLocalPayment(payment);
  return payment;
};

const persistBookingPayment = (booking: StoredBooking) => {
  if (!enableLocalBookingFallback) return;
  persistLocalPayment(createPaymentRecordFromBooking(booking, booking.persistenceSource));
};

export const cancelStoredBooking = (bookingId: string) => {
  const existing = getStoredBookings();
  const nextBookings = existing.map((booking) =>
    booking.id === bookingId ? { ...booking, status: "cancelled" as const } : booking,
  );
  writeStoredList(bookingStorageKey, nextBookings);
  const existingPayment = getStoredPayments().find((payment) => payment.bookingId === bookingId);
  if (existingPayment) {
    const nextStatus: PaymentState =
      existingPayment.status === "paid" || existingPayment.status === "refund_requested"
        ? "refund_requested"
        : existingPayment.status === "refunded"
          ? "refunded"
          : existingPayment.status === "checkout_opened"
            ? "failed"
            : existingPayment.status;
    persistLocalPayment({
      ...existingPayment,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
  }
  return nextBookings.find((booking) => booking.id === bookingId) || null;
};

export const cancelBooking = async (bookingId: string) => {
  try {
    const { error } = await supabase.rpc("cancel_booking_as_user", {
      p_booking_id: bookingId,
    });
    if (error) throw error;
    return enableLocalBookingFallback ? cancelStoredBooking(bookingId) : null;
  } catch (error) {
    if (enableLocalBookingFallback) return cancelStoredBooking(bookingId);
    throw error;
  }
};

export const completeStoredBooking = (bookingId: string) => {
  const existing = getStoredBookings();
  const nextBookings = existing.map((booking) =>
    booking.id === bookingId ? { ...booking, status: "completed" as const } : booking,
  );
  writeStoredList(bookingStorageKey, nextBookings);
  const completedBooking = nextBookings.find((booking) => booking.id === bookingId);
  if (completedBooking && !getStoredPayments().some((payment) => payment.bookingId === bookingId)) {
    const existingPayment = getStoredPayments().find((payment) => payment.bookingId === bookingId);
    persistLocalPayment({
      ...(existingPayment || createPaymentRecordFromBooking(completedBooking)),
      status: existingPayment?.status || "not_opened",
    });
  }
  return nextBookings.find((booking) => booking.id === bookingId) || null;
};

export const completeBooking = async (bookingId: string, partnerSession?: PartnerSession | null) => {
  try {
    if (!partnerSession?.sessionToken) {
    throw new Error("Λείπει το token συνεδρίας συνεργάτη.");
    }

    const { error } = await publicSupabase.rpc("complete_booking_as_partner", {
      p_partner_email: normalizeEmail(partnerSession.email),
      p_session_token: partnerSession.sessionToken,
      p_booking_id: bookingId,
    });
    if (error) throw error;
    return enableLocalBookingFallback ? completeStoredBooking(bookingId) : null;
  } catch (error) {
    if (isPartnerSessionInvalidError(error)) throw new Error("PARTNER_SESSION_INVALID");
    if (enableLocalBookingFallback) return completeStoredBooking(bookingId);
    throw error;
  }
};

export const completePartnerBooking = async (
  booking: StoredBooking,
  partnerSession?: PartnerSession | null,
): Promise<BookingMutationResult> => {
  if (!partnerSession?.sessionToken) {
    return {
      booking,
      synced: false,
      error: "Λείπει το token συνεδρίας συνεργάτη. Κάντε αποσύνδεση και ξανά είσοδο στον πίνακα συνεργάτη.",
    };
  }

  try {
    const { error } = await publicSupabase.rpc("complete_booking_as_partner", {
      p_partner_email: normalizeEmail(partnerSession.email),
      p_session_token: partnerSession.sessionToken,
      p_booking_id: booking.id,
    });

    if (error) throw error;

    const syncedBooking = enableLocalBookingFallback
      ? completeStoredBooking(booking.id) || { ...booking, status: "completed" as const }
      : { ...booking, status: "completed" as const };
    return { booking: syncedBooking, synced: true };
  } catch (error) {
    return {
      booking,
      synced: false,
      error: isPartnerSessionInvalidError(error) ? "PARTNER_SESSION_INVALID" : getErrorMessage(error),
    };
  }
};

export const cancelPartnerBooking = async (
  booking: StoredBooking,
  partnerSession?: PartnerSession | null,
  reason = "lawyer_requested_reschedule",
): Promise<BookingMutationResult> => {
  if (!partnerSession?.sessionToken) {
    return {
      booking,
      synced: false,
      error: "Λείπει το token συνεδρίας συνεργάτη. Κάντε αποσύνδεση και ξανά είσοδο στον πίνακα συνεργάτη.",
    };
  }

  try {
    const { error } = await publicSupabase.rpc("cancel_booking_as_partner", {
      p_partner_email: normalizeEmail(partnerSession.email),
      p_session_token: partnerSession.sessionToken,
      p_booking_id: booking.id,
      p_reason: reason,
    });

    if (error) throw error;

    const syncedBooking = enableLocalBookingFallback
      ? cancelStoredBooking(booking.id) || { ...booking, status: "cancelled" as const }
      : { ...booking, status: "cancelled" as const };
    return { booking: syncedBooking, synced: true };
  } catch (error) {
    return {
      booking,
      synced: false,
      error: isPartnerSessionInvalidError(error) ? "PARTNER_SESSION_INVALID" : getErrorMessage(error),
    };
  }
};

const persistLocalApplication = (application: StoredPartnerApplication) => {
  writeStoredList(applicationStorageKey, [application, ...getStoredPartnerApplications()]);
};

export const createBooking = async (payload: BookingPayload): Promise<SubmissionResult<StoredBooking>> => {
  if (!isUuid(payload.userId)) {
    throw new Error("AUTH_REQUIRED_FOR_BOOKING");
  }

  const createdAt = new Date().toISOString();
  const booking: StoredBooking = {
    ...payload,
    id: createRecordId(),
    referenceId: createReferenceId("BK"),
    status: "pending_confirmation",
    createdAt,
    persistenceSource: "local",
  };

  try {
    const { error } = await supabase.rpc("reserve_booking_slot", {
      p_booking_id: booking.id,
      p_user_id: booking.userId,
      p_reference_id: booking.referenceId,
      p_lawyer_id: booking.lawyerId,
      p_lawyer_name: booking.lawyerName,
      p_consultation_type: booking.consultationType,
      p_consultation_mode: booking.consultationMode,
      p_price: booking.price,
      p_duration: booking.duration,
      p_date_label: booking.dateLabel,
      p_time: booking.time,
      p_client_name: booking.clientName,
      p_client_email: booking.clientEmail,
      p_client_phone: booking.clientPhone,
      p_issue_summary: booking.issueSummary || null,
    });

    if (error) throw error;

    const syncedBooking = { ...booking, status: "confirmed_unpaid" as const, persistenceSource: "supabase" as const };
    persistLocalBooking(syncedBooking);
    await persistBookingPayment(syncedBooking);
    return { record: syncedBooking, source: "supabase" };
  } catch (error) {
    if (isSlotUnavailableError(error)) {
      throw new Error("Η συγκεκριμένη ώρα δεν είναι πλέον διαθέσιμη.");
    }

    if (isSelfBookingForbiddenError(error)) {
      throw new Error("Δεν μπορείτε να κλείσετε ραντεβού στον εαυτό σας.");
    }

    if (!enableLocalBookingFallback) {
      throw new Error(getErrorMessage(error));
    }

    persistLocalBooking(booking);
    await persistBookingPayment(booking);
    return { record: booking, source: "local", syncError: getErrorMessage(error) };
  }
};

export const requestPaymentSetupSession = async (
  userId: string | null | undefined,
  email: string | null | undefined,
): Promise<PaymentSetupSession> => {
  const requestedAt = new Date().toISOString();

  try {
    const { session, user } = await getAuthenticatedEdgeSession();
    if (!userId || user.id !== userId) {
      throw new Error("AUTH_REQUIRED");
    }

    const response = await invokeAuthenticatedEdgeFunction<{
      id?: string;
      url?: string;
      clientSecret?: string;
      status?: "setup_required" | "ready";
    }>("create-payment-setup-session", session.access_token, {
      userId,
      email: email?.trim().toLowerCase() || "",
      returnUrl: typeof window !== "undefined" ? `${window.location.origin}/account?tab=payments` : undefined,
    });
    return {
      provider: "stripe",
      status: response.status || "setup_required",
      id: response.id,
      url: response.url,
      clientSecret: response.clientSecret,
      requestedAt,
      persistenceSource: "supabase",
    };
  } catch (error) {
    if (requireLivePayments || !enableLocalBookingFallback) throw error;

    return {
      provider: "stripe",
      status: "setup_required",
      requestedAt,
      persistenceSource: "local",
    };
  }
};

export const requestBookingCheckoutSession = async (
  booking: StoredBooking,
  returnUrl?: string,
): Promise<PaymentSetupSession> => {
  const requestedAt = new Date().toISOString();

  try {
    const { session, user } = await getAuthenticatedEdgeSession();
    const sessionEmail = user.email?.trim().toLowerCase() || "";
    const bookingEmail = booking.clientEmail.trim().toLowerCase();
    const ownsBookingById = Boolean(booking.userId && user.id === booking.userId);
    const canClaimGuestBooking = Boolean(!booking.userId && sessionEmail && sessionEmail === bookingEmail);

    if (!ownsBookingById && !canClaimGuestBooking) {
      throw new Error("BOOKING_OWNER_AUTH_REQUIRED");
    }

    const response = await invokeAuthenticatedEdgeFunction<{
      id?: string;
      url?: string;
      clientSecret?: string;
      status?: "setup_required" | "ready";
    }>("create-booking-checkout-session", session.access_token, {
      bookingId: booking.id,
      lawyerId: booking.lawyerId,
      amount: booking.price,
      currency: "EUR",
      returnUrl:
        returnUrl ||
        (typeof window !== "undefined" ? `${window.location.origin}/account?tab=payments` : undefined),
    });
    if (response.url && enableLocalBookingFallback) {
      const existingPayment = getStoredPayments().find((payment) => payment.bookingId === booking.id);
      persistLocalPayment({
        ...(existingPayment || createPaymentRecordFromBooking(booking)),
        stripeCheckoutSessionId: response.id,
        checkoutSessionUrl: response.url,
        status: "checkout_opened",
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      provider: "stripe",
      status: response.status || "setup_required",
      url: response.url,
      clientSecret: response.clientSecret,
      requestedAt,
      persistenceSource: "supabase",
    };
  } catch (error) {
    if (requireLivePayments || !enableLocalBookingFallback) throw error;

    return {
      provider: "stripe",
      status: "setup_required",
      requestedAt,
      persistenceSource: "local",
    };
  }
};

export const requestBookingRefund = async (
  booking: StoredBooking,
  reason = "requested_by_customer",
): Promise<BookingRefundResult> => {
  const requestedAt = new Date().toISOString();

  try {
    const { session, user } = await getAuthenticatedEdgeSession();
    const sessionEmail = user.email?.trim().toLowerCase() || "";
    const bookingEmail = booking.clientEmail.trim().toLowerCase();
    const ownsBookingById = Boolean(booking.userId && user.id === booking.userId);
    const canClaimGuestBooking = Boolean(!booking.userId && sessionEmail && sessionEmail === bookingEmail);

    if (!ownsBookingById && !canClaimGuestBooking) {
      throw new Error("BOOKING_OWNER_AUTH_REQUIRED");
    }

    const response = await invokeAuthenticatedEdgeFunction<{
      status?: "refunded" | "pending";
      refundId?: string;
    }>("create-booking-refund", session.access_token, {
      bookingId: booking.id,
      reason,
    });

    const existingPayment = enableLocalBookingFallback ? getStoredPaymentForBooking(booking.id) : null;
    if (existingPayment) {
      persistLocalPayment({
        ...existingPayment,
        status: response.status === "refunded" ? "refunded" : "refund_requested",
        updatedAt: requestedAt,
      });
    }

    return {
      provider: "stripe",
      status: response.status || "pending",
      refundId: response.refundId,
      requestedAt,
      persistenceSource: "supabase",
    };
  } catch (error) {
    if (requireLivePayments || !enableLocalBookingFallback) throw error;

    const existingPayment = getStoredPaymentForBooking(booking.id);
    if (existingPayment?.status === "paid") {
      persistLocalPayment({
        ...existingPayment,
        status: "refund_requested",
        updatedAt: requestedAt,
      });
    }
    return {
      provider: "stripe",
      status: "review_required",
      requestedAt,
      persistenceSource: "local",
    };
  }
};

export const createPartnerApplication = async (
  payload: PartnerApplicationPayload,
): Promise<SubmissionResult<StoredPartnerApplication>> => {
  const createdAt = new Date().toISOString();
  const normalizedCity = normalizeAllowedMarketplaceCity(payload.city) || payload.city;
  const normalizedSpecialties = normalizeLegalPracticeAreas(payload.specialties);
  if (!normalizeAllowedMarketplaceCity(normalizedCity) || normalizedSpecialties.length === 0) {
    throw new Error("INVALID_MARKETPLACE_TAXONOMY");
  }
  const application: StoredPartnerApplication = {
    ...payload,
    city: normalizedCity,
    specialties: normalizedSpecialties,
    id: createRecordId(),
    referenceId: createReferenceId("PA"),
    status: "under_review",
    createdAt,
    persistenceSource: "local",
  };

  try {
    const { data, error } = await publicSupabase.rpc("submit_partner_application", {
      p_application_id: application.id,
      p_reference_id: application.referenceId,
      p_full_name: application.fullName,
      p_work_email: application.workEmail,
      p_phone: application.phone,
      p_city: application.city,
      p_law_firm_name: application.lawFirmName || null,
      p_website_or_linkedin: application.websiteOrLinkedIn || null,
      p_bar_association: application.barAssociation,
      p_registration_number: application.registrationNumber,
      p_years_of_experience: application.yearsOfExperience,
      p_specialties: application.specialties,
      p_professional_bio: application.professionalBio,
      p_document_metadata: application.documents,
    });

    if (error || !data) throw error || new Error("Partner application was not persisted.");

    const syncedApplication = partnerApplicationFromRow(data as PartnerApplicationRow);
    persistLocalApplication(syncedApplication);
    return { record: syncedApplication, source: "supabase" };
  } catch (error) {
    if (!enableLocalApplicationFallback) {
      throw failClosedCriticalPath("Partner applications");
    }

    persistLocalApplication(application);
    return { record: application, source: "local", syncError: getErrorMessage(error) };
  }
};

export const createPartnerSession = (email: string, sessionToken?: string, expiresAtOverride?: string): PartnerSession => {
  if (!sessionToken || !expiresAtOverride) {
    throw new Error("PARTNER_SESSION_REQUIRES_BACKEND_TOKEN");
  }

  const verifiedAt = new Date();
  const requestedExpiry = new Date(expiresAtOverride);
  const maxExpiresAt = new Date(verifiedAt.getTime() + partnerSessionMaxAgeMs);
  const expiresAt =
    Number.isFinite(requestedExpiry.getTime()) && requestedExpiry.getTime() <= maxExpiresAt.getTime()
      ? requestedExpiry
      : maxExpiresAt;
  const session: PartnerSession = {
    email: email.trim().toLowerCase(),
    sessionToken,
    verifiedAt: verifiedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    role: "partner",
    approved: true,
  };

  const storage = getStorage();
  storage?.setItem(partnerSessionStorageKey, JSON.stringify(session));
  return session;
};

export const verifyApprovedPartner = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await publicSupabase.rpc("is_approved_partner", {
    p_email: normalizedEmail,
  });

  if (error) throw error;
  return Boolean(data);
};

export const requestPartnerAccessCode = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await publicSupabase.functions.invoke("partner-access-code", {
    body: { email: normalizedEmail },
  });

  if (error) throw error;
  if (!data?.ok) throw new Error("Failed to send partner access code");

  return true;
};
export const verifyPartnerAccessCode = async (email: string, code: string) => {
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await publicSupabase.rpc("verify_partner_access_code", {
    p_email: normalizedEmail,
    p_code: code.trim(),
  });

  if (error) throw error;
  const verificationPayload = getPartnerVerificationPayload(data);
  const sessionToken = verificationPayload?.sessionToken || verificationPayload?.session_token;
  const expiresAt = verificationPayload?.expiresAt || verificationPayload?.expires_at;
  if (!verificationPayload?.ok || !sessionToken || !expiresAt) return null;

  return createPartnerSession(normalizedEmail, sessionToken, expiresAt);
};

export const getPartnerSession = (): PartnerSession | null => {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const rawValue = storage.getItem(partnerSessionStorageKey);
    if (!rawValue) return null;

    const session = JSON.parse(rawValue) as PartnerSession;
    const verifiedAt = new Date(session.verifiedAt).getTime();
    const expiresAt = new Date(session.expiresAt).getTime();
    if (
      !session.email ||
      !session.sessionToken ||
      !session.expiresAt ||
      expiresAt <= Date.now() ||
      !Number.isFinite(verifiedAt) ||
      expiresAt - verifiedAt > partnerSessionMaxAgeMs
    ) {
      storage.removeItem(partnerSessionStorageKey);
      return null;
    }

    return session;
  } catch {
    storage.removeItem(partnerSessionStorageKey);
    return null;
  }
};

export const clearPartnerSession = () => {
  getStorage()?.removeItem(partnerSessionStorageKey);
};
