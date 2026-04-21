import type { ConsultationMode, Lawyer } from "@/data/lawyers";
import { rankMarketplaceLawyersWithReasons, type IntakeBudget, type IntakeUrgency } from "@/lib/level4Marketplace";
import { allowLocalCriticalFallback, failClosedCriticalPath } from "@/lib/runtimeGuards";
import { publicSupabase } from "@/lib/supabase";

export interface IntakeRequestPayload {
  city: string;
  category: string;
  urgency: IntakeUrgency;
  budget: IntakeBudget;
  consultationMode: ConsultationMode | "any";
  timing: string;
  issueSummary: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}

export interface StoredIntakeRequest extends IntakeRequestPayload {
  id: string;
  referenceId: string;
  status: "new" | "routed" | "booked" | "closed";
  rankedLawyerIds: string[];
  createdAt: string;
  persistenceSource: "supabase" | "local";
}

const intakeStorageKey = "dikigoros.intakeRequests.v1";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const readStoredIntakes = (): StoredIntakeRequest[] => {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(intakeStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStoredIntakes = (requests: StoredIntakeRequest[]) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(intakeStorageKey, JSON.stringify(requests.slice(0, 100)));
};

const createReferenceId = () => `IN-${Date.now().toString(36).toUpperCase()}`;

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `intake-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const routeIntakeRequest = (lawyers: Lawyer[], payload: IntakeRequestPayload) =>
  rankMarketplaceLawyersWithReasons(lawyers, {
    city: payload.city,
    category: payload.category,
    urgency: payload.urgency,
    budget: payload.budget,
    consultationMode: payload.consultationMode,
    query: payload.issueSummary,
  }).slice(0, 5);

export const createIntakeRequest = async (
  payload: IntakeRequestPayload,
  rankedLawyerIds: string[],
): Promise<StoredIntakeRequest> => {
  const localRequest: StoredIntakeRequest = {
    ...payload,
    id: createId(),
    referenceId: createReferenceId(),
    status: rankedLawyerIds.length > 0 ? "routed" : "new",
    rankedLawyerIds,
    createdAt: new Date().toISOString(),
    persistenceSource: "local",
  };

  try {
    const { data, error } = await publicSupabase.rpc("create_intake_request", {
      p_request_id: localRequest.id,
      p_reference_id: localRequest.referenceId,
      p_city: payload.city,
      p_category: payload.category,
      p_urgency: payload.urgency,
      p_budget: payload.budget,
      p_consultation_mode: payload.consultationMode,
      p_timing: payload.timing,
      p_issue_summary: payload.issueSummary,
      p_client_name: payload.clientName || "",
      p_client_email: payload.clientEmail || "",
      p_client_phone: payload.clientPhone || "",
      p_ranked_lawyer_ids: rankedLawyerIds,
    });

    if (error || !data) throw error || new Error("Intake request was not persisted.");
    const row = data as Record<string, unknown>;
    return {
      ...payload,
      id: String(row.id || localRequest.id),
      referenceId: String(row.reference_id || localRequest.referenceId),
      status: String(row.status || localRequest.status) as StoredIntakeRequest["status"],
      rankedLawyerIds: Array.isArray(row.ranked_lawyer_ids)
        ? row.ranked_lawyer_ids.map(String)
        : rankedLawyerIds,
      createdAt: String(row.created_at || localRequest.createdAt),
      persistenceSource: "supabase",
    };
  } catch {
    if (!allowLocalCriticalFallback) throw failClosedCriticalPath("Guided intake");
    writeStoredIntakes([localRequest, ...readStoredIntakes()]);
    return localRequest;
  }
};
