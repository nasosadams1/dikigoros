import { operatingRules, type OperationalArea } from "@/lib/operations";
import { supabase } from "@/lib/supabase";

export type OperationalCaseStatus =
  | "new"
  | "assigned"
  | "waiting_evidence"
  | "in_review"
  | "escalated"
  | "resolved"
  | "rejected"
  | "suspended";

export type OperationalCasePriority = "urgent" | "high" | "normal" | "low";

export type OperationalSlaState = "closed" | "overdue" | "due_soon" | "on_track";
export type OperationalCasesSource = "backend" | "fallback";

export interface OperationalCaseTimelineEntry {
  at: string;
  actor: string;
  action: string;
  note?: string;
}

export interface OperationalCase {
  id: string;
  referenceId: string;
  area: OperationalArea;
  title: string;
  summary: string;
  status: OperationalCaseStatus;
  priority: OperationalCasePriority;
  owner: string;
  requesterEmail?: string;
  relatedReference?: string;
  evidence: string[];
  createdAt: string;
  updatedAt: string;
  slaDueAt: string;
  timeline: OperationalCaseTimelineEntry[];
}

export interface OperationalCasesSnapshot {
  cases: OperationalCase[];
  source: OperationalCasesSource;
}

export interface CreateOperationalCaseInput {
  area: OperationalArea;
  title: string;
  summary: string;
  priority?: OperationalCasePriority;
  owner?: string;
  requesterEmail?: string;
  relatedReference?: string;
  evidence?: string[];
  status?: OperationalCaseStatus;
}

interface OperationalCaseRow {
  id: string;
  reference_id: string;
  area: string;
  title: string;
  summary: string;
  status: string;
  priority: string;
  owner: string;
  requester_email: string | null;
  related_reference: string | null;
  evidence: unknown;
  timeline: unknown;
  sla_due_at: string;
  created_at: string;
  updated_at: string;
}

type OperationalCaseUpdates = Partial<
  Pick<OperationalCase, "status" | "priority" | "owner" | "summary" | "relatedReference" | "evidence">
>;

const operationsStorageKey = "dikigoros.operationalCases.cache.v2";
const legacyOperationsStorageKey = "dikigoros.operationalCases.v1";
const legacySupportStorageKey = "dikigoros.supportCases.v1";

const operationalCaseSelect = [
  "id",
  "reference_id",
  "area",
  "title",
  "summary",
  "status",
  "priority",
  "owner",
  "requester_email",
  "related_reference",
  "evidence",
  "timeline",
  "sla_due_at",
  "created_at",
  "updated_at",
].join(",");

export const operationalAreaLabels: Record<OperationalArea, string> = {
  payments: "Πληρωμές",
  supply: "Πυκνότητα αγοράς",
  verification: "Επαλήθευση",
  reviews: "Έλεγχος κριτικών",
  bookingDisputes: "Θέματα κρατήσεων",
  support: "Υποστήριξη",
  privacyDocuments: "Απόρρητο και έγγραφα",
  security: "Ασφάλεια",
};

export const operationalStatusLabels: Record<OperationalCaseStatus, string> = {
  new: "Νέα",
  assigned: "Ανατέθηκε",
  waiting_evidence: "Αναμονή στοιχείων",
  in_review: "Σε έλεγχο",
  escalated: "Κλιμακώθηκε",
  resolved: "Έκλεισε",
  rejected: "Απορρίφθηκε",
  suspended: "Ανεστάλη",
};

export const operationalPriorityLabels: Record<OperationalCasePriority, string> = {
  urgent: "Επείγον",
  high: "Υψηλή",
  normal: "Κανονική",
  low: "Χαμηλή",
};

const casePrefixes: Record<OperationalArea, string> = {
  payments: "PAY",
  supply: "SUPPLY",
  verification: "VER",
  reviews: "REV",
  bookingDisputes: "DSP",
  support: "CASE",
  privacyDocuments: "PRV",
  security: "SEC",
};

const operationalAreas = new Set<OperationalArea>([
  "payments",
  "supply",
  "verification",
  "reviews",
  "bookingDisputes",
  "support",
  "privacyDocuments",
  "security",
]);

const operationalStatuses = new Set<OperationalCaseStatus>([
  "new",
  "assigned",
  "waiting_evidence",
  "in_review",
  "escalated",
  "resolved",
  "rejected",
  "suspended",
]);

const operationalPriorities = new Set<OperationalCasePriority>(["urgent", "high", "normal", "low"]);
const closedStatuses = new Set<OperationalCaseStatus>(["resolved", "rejected", "suspended"]);

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

const writeStoredCases = (cases: OperationalCase[]) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(operationsStorageKey, JSON.stringify(sortCases(cases)));
};

const dispatchOperationsUpdate = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("dikigoros:operational-case"));
};

const getRandomSegment = () => {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0].toString(36).slice(0, 5).toUpperCase();
  }

  return Math.random().toString(36).slice(2, 7).toUpperCase();
};

const createRecordId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${getRandomSegment().toLowerCase()}`;
};

export const createOperationalCaseReference = (area: OperationalArea) => {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  return `${casePrefixes[area]}-${datePart}-${getRandomSegment()}`;
};

const defaultOwnerForArea = (area: OperationalArea) =>
  operatingRules.find((rule) => rule.area === area)?.owner ||
  (area === "supply" ? "Υπεύθυνος προσφοράς αγοράς" : "Υπεύθυνος λειτουργίας");

const slaHoursFor = (area: OperationalArea, priority: OperationalCasePriority) => {
  if (area === "security") return priority === "urgent" ? 2 : 8;
  if (area === "payments" || area === "bookingDisputes") return priority === "urgent" ? 4 : 24;
  if (area === "privacyDocuments") return priority === "urgent" ? 4 : 48;
  if (priority === "urgent") return 8;
  if (priority === "high") return 24;
  if (priority === "low") return 120;
  return 48;
};

const buildSlaDueAt = (area: OperationalArea, priority: OperationalCasePriority, createdAt: string) =>
  new Date(new Date(createdAt).getTime() + slaHoursFor(area, priority) * 60 * 60 * 1000).toISOString();

const normalizeArea = (value: string): OperationalArea => (operationalAreas.has(value as OperationalArea) ? (value as OperationalArea) : "support");
const normalizeStatus = (value: string): OperationalCaseStatus =>
  operationalStatuses.has(value as OperationalCaseStatus) ? (value as OperationalCaseStatus) : "new";
const normalizePriority = (value: string): OperationalCasePriority =>
  operationalPriorities.has(value as OperationalCasePriority) ? (value as OperationalCasePriority) : "normal";

const normalizeEvidence = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

const normalizeTimeline = (value: unknown): OperationalCaseTimelineEntry[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<OperationalCaseTimelineEntry>;
      if (!candidate.at || !candidate.actor || !candidate.action) return null;
      return {
        at: candidate.at,
        actor: candidate.actor,
        action: candidate.action,
        note: candidate.note,
      };
    })
    .filter((item): item is OperationalCaseTimelineEntry => Boolean(item));
};

const createCase = (input: CreateOperationalCaseInput, createdAt = new Date().toISOString()): OperationalCase => {
  const priority = input.priority || (input.area === "security" ? "urgent" : "normal");
  const status = input.status || "new";
  const owner = input.owner || defaultOwnerForArea(input.area);

  return {
    id: createRecordId(),
    referenceId: createOperationalCaseReference(input.area),
    area: input.area,
    title: input.title,
    summary: input.summary,
    status,
    priority,
    owner,
    requesterEmail: input.requesterEmail,
    relatedReference: input.relatedReference,
    evidence: input.evidence || [],
    createdAt,
    updatedAt: createdAt,
    slaDueAt: buildSlaDueAt(input.area, priority, createdAt),
    timeline: [
      {
        at: createdAt,
        actor: "Λειτουργία",
        action: status === "new" ? "Άνοιγμα υπόθεσης" : `Η υπόθεση σημάνθηκε ως ${operationalStatusLabels[status]}`,
        note: input.summary,
      },
    ],
  };
};

const launchReadinessCases = (): OperationalCase[] => [
  createCase(
    {
      area: "payments",
      title: "Επιβεβαίωση live διαδρομής Stripe settlement",
      summary: "Έλεγχος live Checkout key, webhook secret, εγγραφής πληρωμής κράτησης, URL απόδειξης και διαδρομής επιστροφής πριν το launch.",
      priority: "urgent",
      evidence: ["Checkout Sessions για πληρωμές κράτησης", "Το webhook ενημερώνει πληρωμένη, αποτυχημένη και επιστραφείσα κατάσταση"],
    },
    new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  ),
  createCase(
    {
      area: "supply",
      title: "Έλεγχος πυκνότητας 5 πόλεων και 5 δικαίων",
      summary: "Παρακολούθηση επαληθευμένης κρατήσιμης κάλυψης σε Αθήνα, Θεσσαλονίκη, Πειραιά, Ηράκλειο και Πάτρα για τα 5 ενεργά δίκαια.",
      priority: "high",
      evidence: ["Τα ελάχιστα thresholds πόλης και δικαίου υπολογίζονται από live δημόσια προφίλ"],
    },
    new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
  ),
  createCase(
    {
      area: "verification",
      title: "Ουρά ελέγχου αιτήσεων συνεργατών",
      summary: "Ανάθεση ελέγχου για ταυτότητα, άδεια, δικηγορικό σύλλογο, επαγγελματικά στοιχεία και ετοιμότητα προφίλ.",
      priority: "normal",
      evidence: ["Τα προφίλ μένουν δημόσια μόνο αφού περάσουν οι έλεγχοι ετοιμότητας"],
    },
    new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  ),
  createCase(
    {
      area: "reviews",
      title: "Έλεγχος κριτικής μετά από ολοκληρωμένη κράτηση",
      summary: "Κράτημα νέων κριτικών για απόδειξη ολοκληρωμένης κράτησης, έλεγχο λεπτομερειών υπόθεσης, έλεγχο απάτης και χειρισμό απάντησης δικηγόρου.",
      priority: "normal",
      evidence: ["Το αίτημα κριτικής ανοίγει μόνο μετά την ολοκλήρωση της κράτησης"],
    },
    new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
  ),
  createCase(
    {
      area: "bookingDisputes",
      title: "Διαδρομή απόφασης για αλλαγή ώρας και μη εμφάνιση",
      summary: "Επιβεβαίωση παραθύρου ακύρωσης, κατάστασης πληρωμής, ιστορικού επικοινωνίας και αποτελέσματος επιστροφής ή αλλαγής ώρας.",
      priority: "high",
      evidence: ["Δωρεάν ακύρωση ή αλλαγή ώρας πριν από το παράθυρο 24 ωρών"],
    },
    new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
  ),
  createCase(
    {
      area: "privacyDocuments",
      title: "Ροή διατήρησης και διαγραφής εγγράφων",
      summary: "Δρομολόγηση αιτημάτων πρόσβασης, διαγραφής, ορατότητας και διατήρησης με context κράτησης/λογαριασμού.",
      priority: "normal",
      evidence: ["Τα έγγραφα είναι ορατά στον δικηγόρο της κράτησης μόνο όταν ο χρήστης επιτρέπει την ορατότητα"],
    },
    new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
  ),
  createCase(
    {
      area: "security",
      title: "Runbook περιστατικού ευαίσθητων νομικών δεδομένων",
      summary: "Επιβεβαίωση περιορισμού, audit context, απόφασης ενημέρωσης, διορθωτικών μέτρων και καταγραφής κλεισίματος.",
      priority: "urgent",
      evidence: ["Θέματα ασφάλειας και απορρήτου κλιμακώνονται πριν από τον κανονικό χειρισμό υποστήριξης"],
    },
    new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  ),
];

interface LegacySupportCase {
  type?: string;
  urgency?: string;
  reference?: string;
  email?: string;
  message?: string;
  createdAt?: string;
  status?: string;
}

const areaFromLegacySupportType = (type?: string): OperationalArea => {
  if (type === "payment") return "payments";
  if (type === "documents") return "privacyDocuments";
  if (type === "complaint") return "bookingDisputes";
  if (type === "security") return "security";
  return "support";
};

const priorityFromLegacySupportUrgency = (urgency?: string): OperationalCasePriority => {
  if (urgency === "urgent" || urgency === "privacy") return "urgent";
  return "normal";
};

const migrateLegacySupportCases = () =>
  readStoredList<LegacySupportCase>(legacySupportStorageKey).map((item) => {
    const area = areaFromLegacySupportType(item.type);
    const createdAt = item.createdAt || new Date().toISOString();
    const migrated = createCase(
      {
        area,
        title: `${operationalAreaLabels[area]} support request`,
        summary: item.message || "Support request created from the help center.",
        priority: priorityFromLegacySupportUrgency(item.urgency),
        requesterEmail: item.email,
        relatedReference: item.reference,
        status: item.status === "received" ? "new" : "assigned",
      },
      createdAt,
    );

    return {
      ...migrated,
      referenceId: item.reference?.startsWith("SUP-") ? item.reference : migrated.referenceId,
    };
  });

const ensureFallbackOperationalCases = () => {
  const cachedCases = readStoredList<OperationalCase>(operationsStorageKey);
  if (cachedCases.length > 0) return cachedCases;

  const legacyCases = readStoredList<OperationalCase>(legacyOperationsStorageKey);
  if (legacyCases.length > 0) {
    writeStoredCases(legacyCases);
    return legacyCases;
  }

  const cases = [...migrateLegacySupportCases(), ...launchReadinessCases()];
  writeStoredCases(cases);
  return cases;
};

const sortCases = (cases: OperationalCase[]) =>
  [...cases].sort((first, second) => {
    const firstOpen = closedStatuses.has(first.status) ? 1 : 0;
    const secondOpen = closedStatuses.has(second.status) ? 1 : 0;
    if (firstOpen !== secondOpen) return firstOpen - secondOpen;
    return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
  });

const mapRowToOperationalCase = (row: OperationalCaseRow): OperationalCase => {
  const area = normalizeArea(row.area);
  const priority = normalizePriority(row.priority);
  const createdAt = row.created_at || new Date().toISOString();
  const timeline = normalizeTimeline(row.timeline);

  return {
    id: row.id,
    referenceId: row.reference_id,
    area,
    title: row.title,
    summary: row.summary,
    status: normalizeStatus(row.status),
    priority,
    owner: row.owner || defaultOwnerForArea(area),
    requesterEmail: row.requester_email || undefined,
    relatedReference: row.related_reference || undefined,
    evidence: normalizeEvidence(row.evidence),
    createdAt,
    updatedAt: row.updated_at || createdAt,
    slaDueAt: row.sla_due_at || buildSlaDueAt(area, priority, createdAt),
    timeline:
      timeline.length > 0
        ? timeline
        : [
            {
              at: createdAt,
              actor: "Operations",
              action: "Case opened",
              note: row.summary,
            },
          ],
  };
};

const toBackendPayload = (operationalCase: OperationalCase) => ({
  id: operationalCase.id,
  reference_id: operationalCase.referenceId,
  area: operationalCase.area,
  title: operationalCase.title,
  summary: operationalCase.summary,
  status: operationalCase.status,
  priority: operationalCase.priority,
  owner: operationalCase.owner,
  requester_email: operationalCase.requesterEmail || null,
  related_reference: operationalCase.relatedReference || null,
  evidence: operationalCase.evidence,
  timeline: operationalCase.timeline,
  sla_due_at: operationalCase.slaDueAt,
  created_at: operationalCase.createdAt,
  updated_at: operationalCase.updatedAt,
});

const cacheCase = (operationalCase: OperationalCase) => {
  const cases = ensureFallbackOperationalCases();
  const withoutCurrent = cases.filter((item) => item.id !== operationalCase.id);
  writeStoredCases([operationalCase, ...withoutCurrent]);
};

const fetchBackendCase = async (caseId: string): Promise<OperationalCase> => {
  const { data, error } = await supabase
    .from("operational_cases")
    .select(operationalCaseSelect)
    .eq("id", caseId)
    .single();

  if (error || !data) throw error || new Error("Operational case was not found.");
  return mapRowToOperationalCase(data as OperationalCaseRow);
};

const fetchBackendCases = async (area?: OperationalArea): Promise<OperationalCase[]> => {
  let query = supabase.from("operational_cases").select(operationalCaseSelect).order("updated_at", { ascending: false });
  if (area) query = query.eq("area", area);

  const { data, error } = await query;
  if (error) throw error;

  const cases = sortCases((data || []).map((row) => mapRowToOperationalCase(row as OperationalCaseRow)));
  writeStoredCases(cases);
  return cases;
};

const insertAuditEvent = async (
  operationalCase: OperationalCase,
  entry: OperationalCaseTimelineEntry,
  payload: Record<string, unknown>,
) => {
  await supabase.from("operational_audit_events").insert({
    operational_case_id: operationalCase.id,
    actor_label: entry.actor,
    event_type: entry.action,
    note: entry.note || null,
    payload,
    created_at: entry.at,
  });
};

const getFallbackOperationalCases = (area?: OperationalArea) => {
  const cases = ensureFallbackOperationalCases();
  return sortCases(area ? cases.filter((item) => item.area === area) : cases);
};

export const getOperationalCases = (area?: OperationalArea) => getFallbackOperationalCases(area);

export const fetchOperationalCasesSnapshot = async (area?: OperationalArea): Promise<OperationalCasesSnapshot> => {
  try {
    return { cases: await fetchBackendCases(area), source: "backend" };
  } catch {
    return { cases: getFallbackOperationalCases(area), source: "fallback" };
  }
};

export const fetchOperationalCases = async (area?: OperationalArea) =>
  (await fetchOperationalCasesSnapshot(area)).cases;

export const createOperationalCase = async (input: CreateOperationalCaseInput) => {
  const nextCase = createCase(input);

  try {
    const { data, error } = await supabase
      .from("operational_cases")
      .insert(toBackendPayload(nextCase))
      .select(operationalCaseSelect)
      .single();

    if (error || !data) throw error || new Error("Operational case was not persisted.");

    const persistedCase = mapRowToOperationalCase(data as OperationalCaseRow);
    cacheCase(persistedCase);
    void insertAuditEvent(persistedCase, persistedCase.timeline[0], { source: "case_created", area: persistedCase.area }).catch(() => undefined);
    dispatchOperationsUpdate();
    return persistedCase;
  } catch {
    cacheCase(nextCase);
    dispatchOperationsUpdate();
    return nextCase;
  }
};

const buildUpdatedCase = (
  operationalCase: OperationalCase,
  updates: OperationalCaseUpdates,
  actor: string,
  note?: string,
) => {
  const now = new Date().toISOString();
  const nextStatus = updates.status || operationalCase.status;
  const nextPriority = updates.priority || operationalCase.priority;
  const action =
    updates.status && updates.status !== operationalCase.status
      ? `Η κατάσταση άλλαξε σε ${operationalStatusLabels[updates.status]}`
      : updates.owner && updates.owner !== operationalCase.owner
        ? `Ανατέθηκε σε ${updates.owner}`
        : "Η υπόθεση ενημερώθηκε";
  const timelineEntry: OperationalCaseTimelineEntry = {
    at: now,
    actor,
    action,
    note,
  };

  return {
    updatedCase: {
      ...operationalCase,
      ...updates,
      status: nextStatus,
      priority: nextPriority,
      slaDueAt: updates.priority ? buildSlaDueAt(operationalCase.area, nextPriority, operationalCase.createdAt) : operationalCase.slaDueAt,
      updatedAt: now,
      timeline: [timelineEntry, ...operationalCase.timeline],
    },
    timelineEntry,
  };
};

const updateFallbackCase = (
  caseId: string,
  updates: OperationalCaseUpdates,
  actor: string,
  note?: string,
) => {
  let updatedCase: OperationalCase | null = null;
  const cases = ensureFallbackOperationalCases().map((item) => {
    if (item.id !== caseId) return item;
    const result = buildUpdatedCase(item, updates, actor, note);
    updatedCase = result.updatedCase;
    return result.updatedCase;
  });

  writeStoredCases(cases);
  return updatedCase;
};

export const updateOperationalCase = async (
  caseId: string,
  updates: OperationalCaseUpdates,
  actor = "Λειτουργία",
  note?: string,
) => {
  try {
    const currentCase = await fetchBackendCase(caseId);
    const { updatedCase, timelineEntry } = buildUpdatedCase(currentCase, updates, actor, note);
    const { data, error } = await supabase
      .from("operational_cases")
      .update(toBackendPayload(updatedCase))
      .eq("id", caseId)
      .select(operationalCaseSelect)
      .single();

    if (error || !data) throw error || new Error("Operational case was not updated.");

    const persistedCase = mapRowToOperationalCase(data as OperationalCaseRow);
    cacheCase(persistedCase);
    void insertAuditEvent(persistedCase, timelineEntry, { source: "case_updated", updates }).catch(() => undefined);
    dispatchOperationsUpdate();
    return persistedCase;
  } catch {
    const fallbackCase = updateFallbackCase(caseId, updates, actor, note);
    dispatchOperationsUpdate();
    return fallbackCase;
  }
};

export const assignOperationalCase = (caseId: string, owner: string) =>
  updateOperationalCase(caseId, { owner, status: "assigned" }, "Λειτουργία", "Ορίστηκε υπεύθυνος από το κέντρο λειτουργίας.");

export const setOperationalCaseStatus = (caseId: string, status: OperationalCaseStatus, note?: string) =>
  updateOperationalCase(caseId, { status }, "Λειτουργία", note);

export const getOperationalSlaState = (operationalCase: Pick<OperationalCase, "status" | "slaDueAt">): OperationalSlaState => {
  if (closedStatuses.has(operationalCase.status)) return "closed";

  const hoursRemaining = (new Date(operationalCase.slaDueAt).getTime() - Date.now()) / (60 * 60 * 1000);
  if (hoursRemaining < 0) return "overdue";
  if (hoursRemaining <= 8) return "due_soon";
  return "on_track";
};

export const getOperationalCaseMetrics = (cases: OperationalCase[]) => {
  const openCases = cases.filter((item) => !closedStatuses.has(item.status));
  const overdueCases = openCases.filter((item) => getOperationalSlaState(item) === "overdue");
  const urgentCases = openCases.filter((item) => item.priority === "urgent");

  return {
    total: cases.length,
    open: openCases.length,
    overdue: overdueCases.length,
    urgent: urgentCases.length,
    closed: cases.length - openCases.length,
  };
};
