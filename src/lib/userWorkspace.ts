import type { ConsultationMode } from "@/data/lawyers";
import { validateLegalDocumentUpload } from "@/lib/documentPolicy";
import { supabase } from "@/lib/supabase";

export type PreferredConsultationMode = ConsultationMode | "any";

export interface UserLegalPreferences {
  legalCategories: string[];
  consultationMode: PreferredConsultationMode;
  city: string;
  budgetRange: string;
  urgency: string;
  language: string;
}

export interface UserPrivacySettings {
  sharePhoneWithBookedLawyers: boolean;
  allowDocumentAccessByBooking: boolean;
  productUpdates: boolean;
}

export interface UserNotificationSettings {
  email: boolean;
  sms: boolean;
  reminders: boolean;
}

export interface UserDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  category: string;
  linkedBookingId?: string;
  visibleToLawyer: boolean;
  uploadedAt: string;
  storagePath?: string;
  downloadUrl?: string;
  persistenceSource?: "supabase" | "local";
}

export interface UserPaymentMethod {
  provider: "stripe";
  status: "not_configured" | "setup_required" | "ready";
  stripeCustomerId: string;
  defaultMethodLabel: string;
  setupRequestedAt: string;
}

export interface UserReview {
  bookingId: string;
  lawyerId: string;
  lawyerName: string;
  rating: number;
  clarityRating: number;
  responsivenessRating: number;
  text: string;
  submittedAt: string;
  status: "published" | "pending_review";
}

export interface UserReviewSubmissionResult {
  workspace: UserWorkspace;
  persisted: boolean;
  reason?: "not_authenticated" | "booking_not_completed" | "sync_failed";
}

export interface UserWorkspace {
  savedLawyerIds: string[];
  comparedLawyerIds: string[];
  lawyerNotes: Record<string, string>;
  documents: UserDocument[];
  paymentMethod: UserPaymentMethod;
  reviews: UserReview[];
  preferences: UserLegalPreferences;
  privacy: UserPrivacySettings;
  notifications: UserNotificationSettings;
}

const workspaceStoragePrefix = "dikigoros.userWorkspace.v1";
const guestWorkspaceId = "guest";
const documentsBucket = "legal-documents";

export const defaultUserWorkspace: UserWorkspace = {
  savedLawyerIds: [],
  comparedLawyerIds: [],
  lawyerNotes: {},
  documents: [],
  paymentMethod: {
    provider: "stripe",
    status: "not_configured",
    stripeCustomerId: "",
    defaultMethodLabel: "",
    setupRequestedAt: "",
  },
  reviews: [],
  preferences: {
    legalCategories: [],
    consultationMode: "any",
    city: "",
    budgetRange: "",
    urgency: "",
    language: "Ελληνικά",
  },
  privacy: {
    sharePhoneWithBookedLawyers: true,
    allowDocumentAccessByBooking: true,
    productUpdates: false,
  },
  notifications: {
    email: true,
    sms: false,
    reminders: true,
  },
};

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const getWorkspaceKey = (userId?: string | null) => `${workspaceStoragePrefix}.${userId || guestWorkspaceId}`;

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

interface UserProfileWorkspaceRow {
  preferred_language?: string | null;
  preferred_consultation_mode?: PreferredConsultationMode | null;
  preferred_legal_categories?: string[] | null;
  city?: string | null;
  budget_range?: string | null;
  urgency_preference?: string | null;
  notification_preferences?: Partial<UserNotificationSettings> | null;
  privacy_settings?: Partial<UserPrivacySettings> | null;
  saved_lawyer_ids?: string[] | null;
  compared_lawyer_ids?: string[] | null;
  lawyer_notes?: Record<string, string> | null;
  payment_preferences?: Partial<UserPaymentMethod> | null;
}

interface UserDocumentRow {
  id: string;
  name: string;
  size: number;
  mime_type: string | null;
  category: string;
  booking_id: string | null;
  visible_to_lawyer: boolean;
  storage_path: string | null;
  created_at: string;
}

interface UserReviewRow {
  booking_id: string;
  lawyer_id: string;
  rating: number;
  clarity_rating: number;
  responsiveness_rating: number;
  review_text: string;
  status: string;
  created_at: string;
  booking_requests?: {
    lawyer_name?: string | null;
  } | null;
}

const normalizeWorkspace = (workspace: Partial<UserWorkspace> | null | undefined): UserWorkspace => ({
  ...defaultUserWorkspace,
  ...workspace,
  savedLawyerIds: unique(workspace?.savedLawyerIds || []),
  comparedLawyerIds: unique(workspace?.comparedLawyerIds || []).slice(0, 3),
  lawyerNotes: workspace?.lawyerNotes || {},
  documents: Array.isArray(workspace?.documents) ? workspace.documents : [],
  paymentMethod: {
    ...defaultUserWorkspace.paymentMethod,
    ...(workspace?.paymentMethod || {}),
  },
  reviews: Array.isArray(workspace?.reviews) ? workspace.reviews : [],
  preferences: {
    ...defaultUserWorkspace.preferences,
    ...(workspace?.preferences || {}),
    legalCategories: unique(workspace?.preferences?.legalCategories || []),
  },
  privacy: {
    ...defaultUserWorkspace.privacy,
    ...(workspace?.privacy || {}),
  },
  notifications: {
    ...defaultUserWorkspace.notifications,
    ...(workspace?.notifications || {}),
  },
});

export const getUserWorkspace = (userId?: string | null): UserWorkspace => {
  const storage = getStorage();
  if (!storage) return defaultUserWorkspace;

  try {
    const rawValue = storage.getItem(getWorkspaceKey(userId));
    if (!rawValue) return defaultUserWorkspace;
    return normalizeWorkspace(JSON.parse(rawValue) as Partial<UserWorkspace>);
  } catch {
    return defaultUserWorkspace;
  }
};

const workspaceFromProfileRow = (row: UserProfileWorkspaceRow, baseWorkspace: UserWorkspace): UserWorkspace =>
  normalizeWorkspace({
    ...baseWorkspace,
    savedLawyerIds: row.saved_lawyer_ids || baseWorkspace.savedLawyerIds,
    comparedLawyerIds: row.compared_lawyer_ids || baseWorkspace.comparedLawyerIds,
    lawyerNotes: row.lawyer_notes || baseWorkspace.lawyerNotes,
    paymentMethod: {
      ...baseWorkspace.paymentMethod,
      ...(row.payment_preferences || {}),
    },
    preferences: {
      ...baseWorkspace.preferences,
      legalCategories: row.preferred_legal_categories || baseWorkspace.preferences.legalCategories,
      consultationMode: row.preferred_consultation_mode || baseWorkspace.preferences.consultationMode,
      city: row.city || baseWorkspace.preferences.city,
      budgetRange: row.budget_range || baseWorkspace.preferences.budgetRange,
      urgency: row.urgency_preference || baseWorkspace.preferences.urgency,
      language: row.preferred_language || baseWorkspace.preferences.language,
    },
    privacy: {
      ...baseWorkspace.privacy,
      ...(row.privacy_settings || {}),
    },
    notifications: {
      ...baseWorkspace.notifications,
      ...(row.notification_preferences || {}),
    },
  });

const documentFromRow = (row: UserDocumentRow): UserDocument => ({
  id: row.id,
  name: row.name,
  size: Number(row.size),
  type: row.mime_type || "unknown",
  category: row.category,
  linkedBookingId: row.booking_id || undefined,
  visibleToLawyer: row.visible_to_lawyer,
  uploadedAt: row.created_at,
  storagePath: row.storage_path || undefined,
  persistenceSource: "supabase",
});

const reviewFromRow = (row: UserReviewRow): UserReview => ({
  bookingId: row.booking_id,
  lawyerId: row.lawyer_id,
  lawyerName: row.booking_requests?.lawyer_name || row.lawyer_id,
  rating: Number(row.rating),
  clarityRating: Number(row.clarity_rating),
  responsivenessRating: Number(row.responsiveness_rating),
  text: row.review_text,
  submittedAt: row.created_at,
  status: row.status === "published" ? "published" : "pending_review",
});

const createSignedDocumentUrl = async (storagePath?: string | null) => {
  if (!storagePath) return undefined;

  try {
    const { data, error } = await supabase.storage.from(documentsBucket).createSignedUrl(storagePath, 60 * 10);
    if (error) throw error;
    return data?.signedUrl;
  } catch {
    return undefined;
  }
};

const workspaceToProfileUpdates = (workspace: UserWorkspace) => ({
  preferred_language: workspace.preferences.language,
  preferred_consultation_mode: workspace.preferences.consultationMode,
  preferred_legal_categories: workspace.preferences.legalCategories,
  city: workspace.preferences.city,
  budget_range: workspace.preferences.budgetRange,
  urgency_preference: workspace.preferences.urgency,
  notification_preferences: workspace.notifications,
  privacy_settings: workspace.privacy,
  saved_lawyer_ids: workspace.savedLawyerIds,
  compared_lawyer_ids: workspace.comparedLawyerIds,
  lawyer_notes: workspace.lawyerNotes,
  payment_preferences: workspace.paymentMethod,
  updated_at: new Date().toISOString(),
});

const resolveRemoteUserId = (userId?: string | null, remoteUserId?: string | null) =>
  remoteUserId === undefined ? userId : remoteUserId;

export const fetchUserWorkspace = async (userId?: string | null, remoteUserId?: string | null) => {
  const localWorkspace = getUserWorkspace(userId);
  const resolvedRemoteUserId = resolveRemoteUserId(userId, remoteUserId);
  if (!resolvedRemoteUserId) return localWorkspace;

  try {
    const [
      { data: profileRow, error: profileError },
      { data: documentRows, error: documentsError },
      { data: reviewRows, error: reviewsError },
    ] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("id", resolvedRemoteUserId).maybeSingle(),
      supabase.from("user_documents").select("*").eq("user_id", resolvedRemoteUserId).order("created_at", { ascending: false }),
      supabase
        .from("booking_reviews")
        .select("booking_id,lawyer_id,rating,clarity_rating,responsiveness_rating,review_text,status,created_at,booking_requests(lawyer_name)")
        .eq("user_id", resolvedRemoteUserId)
        .order("created_at", { ascending: false }),
    ]);

    if (profileError) throw profileError;
    if (documentsError) throw documentsError;
    if (reviewsError) throw reviewsError;

    const documents = await Promise.all(
      (Array.isArray(documentRows) ? (documentRows as UserDocumentRow[]).map(documentFromRow) : []).map(
        async (document) => ({
          ...document,
          downloadUrl: await createSignedDocumentUrl(document.storagePath),
        }),
      ),
    );

    const remoteWorkspace = workspaceFromProfileRow(
      (profileRow || {}) as UserProfileWorkspaceRow,
      localWorkspace,
    );
    const withDocuments = normalizeWorkspace({
      ...remoteWorkspace,
      documents: documents.length ? documents : remoteWorkspace.documents,
      reviews: Array.isArray(reviewRows)
        ? (reviewRows as UserReviewRow[]).map(reviewFromRow)
        : remoteWorkspace.reviews,
    });

    return saveUserWorkspace(userId, withDocuments);
  } catch {
    return localWorkspace;
  }
};

export const saveUserWorkspace = (userId: string | null | undefined, workspace: UserWorkspace) => {
  const storage = getStorage();
  if (!storage) return normalizeWorkspace(workspace);

  const normalized = normalizeWorkspace(workspace);
  storage.setItem(getWorkspaceKey(userId), JSON.stringify(normalized));
  return normalized;
};

export const syncUserWorkspace = async (
  userId: string | null | undefined,
  workspace: UserWorkspace,
  remoteUserId?: string | null,
) => {
  const normalized = saveUserWorkspace(userId, workspace);
  const resolvedRemoteUserId = resolveRemoteUserId(userId, remoteUserId);
  if (!resolvedRemoteUserId) return normalized;

  try {
    await supabase.from("user_profiles").upsert({
      id: resolvedRemoteUserId,
      ...workspaceToProfileUpdates(normalized),
    });
  } catch {
    // Local storage remains the offline fallback; callers keep the optimistic UI.
  }

  return normalized;
};

export const updateUserWorkspace = (
  userId: string | null | undefined,
  updater: (workspace: UserWorkspace) => UserWorkspace,
) => saveUserWorkspace(userId, updater(getUserWorkspace(userId)));

export const toggleSavedLawyer = (userId: string | null | undefined, lawyerId: string) =>
  updateUserWorkspace(userId, (workspace) => {
    const saved = workspace.savedLawyerIds.includes(lawyerId)
      ? workspace.savedLawyerIds.filter((id) => id !== lawyerId)
      : [lawyerId, ...workspace.savedLawyerIds];

    return { ...workspace, savedLawyerIds: unique(saved) };
  });

export const toggleComparedLawyer = (userId: string | null | undefined, lawyerId: string) =>
  updateUserWorkspace(userId, (workspace) => {
    const compared = workspace.comparedLawyerIds.includes(lawyerId)
      ? workspace.comparedLawyerIds.filter((id) => id !== lawyerId)
      : [lawyerId, ...workspace.comparedLawyerIds].slice(0, 3);

    return { ...workspace, comparedLawyerIds: unique(compared).slice(0, 3) };
  });

export const updateLawyerNote = (
  userId: string | null | undefined,
  lawyerId: string,
  note: string,
) =>
  updateUserWorkspace(userId, (workspace) => ({
    ...workspace,
    lawyerNotes: {
      ...workspace.lawyerNotes,
      [lawyerId]: note,
    },
  }));

const createRecordId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
};

export const addUserDocuments = (
  userId: string | null | undefined,
  files: File[],
  category = "Γενικό έγγραφο",
  linkedBookingId?: string,
) =>
  updateUserWorkspace(userId, (workspace) => {
    const { acceptedFiles } = validateLegalDocumentUpload(files);

    return {
      ...workspace,
      documents: [
        ...acceptedFiles.map((file) => ({
          id: createRecordId(),
          name: file.name,
          size: file.size,
          type: file.type || "unknown",
          category,
          linkedBookingId,
          visibleToLawyer: true,
          uploadedAt: new Date().toISOString(),
          persistenceSource: "local" as const,
        })),
        ...workspace.documents,
      ],
    };
  });

export const uploadUserDocuments = async (
  userId: string | null | undefined,
  files: File[],
  category = "Γενικό έγγραφο",
  linkedBookingId?: string,
  remoteUserId?: string | null,
) => {
  const { acceptedFiles } = validateLegalDocumentUpload(files);
  const resolvedRemoteUserId = resolveRemoteUserId(userId, remoteUserId);
  if (!resolvedRemoteUserId) return addUserDocuments(userId, acceptedFiles, category, linkedBookingId);
  if (acceptedFiles.length === 0) return getUserWorkspace(userId);

  const uploadedDocuments: UserDocument[] = [];

  for (const file of acceptedFiles) {
    const id = createRecordId();
    const storagePath = `${resolvedRemoteUserId}/${id}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const document: UserDocument = {
      id,
      name: file.name,
      size: file.size,
      type: file.type || "unknown",
      category,
      linkedBookingId,
      visibleToLawyer: true,
      uploadedAt: new Date().toISOString(),
      storagePath,
      persistenceSource: "local",
    };

    try {
      const { error: uploadError } = await supabase.storage.from(documentsBucket).upload(storagePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (uploadError) throw uploadError;

      const { error: metadataError } = await supabase.from("user_documents").insert({
        id,
        user_id: resolvedRemoteUserId,
        booking_id: linkedBookingId || null,
        name: file.name,
        size: file.size,
        mime_type: file.type || null,
        category,
        storage_path: storagePath,
        visible_to_lawyer: true,
      });
      if (metadataError) throw metadataError;

      uploadedDocuments.push({ ...document, persistenceSource: "supabase" });
    } catch {
      uploadedDocuments.push(document);
    }
  }

  return updateUserWorkspace(userId, (workspace) => ({
    ...workspace,
    documents: [
      ...uploadedDocuments,
      ...workspace.documents.filter(
        (existingDocument) =>
          !uploadedDocuments.some(
            (uploadedDocument) =>
              uploadedDocument.name === existingDocument.name &&
              uploadedDocument.size === existingDocument.size &&
              uploadedDocument.linkedBookingId === existingDocument.linkedBookingId,
          ),
      ),
    ],
  }));
};

export const removeUserDocument = (userId: string | null | undefined, documentId: string) =>
  updateUserWorkspace(userId, (workspace) => ({
    ...workspace,
    documents: workspace.documents.filter((document) => document.id !== documentId),
  }));

export const createUserDocumentDownloadUrl = async (document: UserDocument) =>
  document.downloadUrl || createSignedDocumentUrl(document.storagePath);

export const removeUserDocumentPersisted = async (
  userId: string | null | undefined,
  documentId: string,
  remoteUserId?: string | null,
) => {
  const existingDocument = getUserWorkspace(userId).documents.find((document) => document.id === documentId);
  const nextWorkspace = removeUserDocument(userId, documentId);
  const resolvedRemoteUserId = resolveRemoteUserId(userId, remoteUserId);

  if (resolvedRemoteUserId && existingDocument?.persistenceSource === "supabase") {
    try {
      await supabase.from("user_documents").delete().eq("id", documentId).eq("user_id", resolvedRemoteUserId);
      if (existingDocument.storagePath) {
        await supabase.storage.from(documentsBucket).remove([existingDocument.storagePath]);
      }
    } catch {
      // Keep optimistic local deletion; backend retry can be added by the job queue later.
    }
  }

  return nextWorkspace;
};

export const setUserDocumentVisibility = (
  userId: string | null | undefined,
  documentId: string,
  visibleToLawyer: boolean,
) =>
  updateUserWorkspace(userId, (workspace) => ({
    ...workspace,
    documents: workspace.documents.map((document) =>
      document.id === documentId ? { ...document, visibleToLawyer } : document,
    ),
  }));

export const setUserDocumentVisibilityPersisted = async (
  userId: string | null | undefined,
  documentId: string,
  visibleToLawyer: boolean,
  remoteUserId?: string | null,
) => {
  const nextWorkspace = setUserDocumentVisibility(userId, documentId, visibleToLawyer);
  const resolvedRemoteUserId = resolveRemoteUserId(userId, remoteUserId);
  if (resolvedRemoteUserId) {
    try {
      await supabase
        .from("user_documents")
        .update({ visible_to_lawyer: visibleToLawyer })
        .eq("id", documentId)
        .eq("user_id", resolvedRemoteUserId);
    } catch {
      // Local state is already updated for the user.
    }
  }

  return nextWorkspace;
};

export const updateUserPaymentMethod = (
  userId: string | null | undefined,
  paymentMethod: UserPaymentMethod,
) =>
  updateUserWorkspace(userId, (workspace) => ({
    ...workspace,
    paymentMethod,
  }));

export const upsertUserReview = (
  userId: string | null | undefined,
  review: Omit<UserReview, "submittedAt" | "status">,
) =>
  updateUserWorkspace(userId, (workspace) => ({
    ...workspace,
    reviews: [
      {
        ...review,
        submittedAt: new Date().toISOString(),
        status: "published",
      },
      ...workspace.reviews.filter((item) => item.bookingId !== review.bookingId),
    ],
  }));

export const upsertUserReviewPersisted = async (
  userId: string | null | undefined,
  review: Omit<UserReview, "submittedAt" | "status">,
  remoteUserId?: string | null,
): Promise<UserReviewSubmissionResult> => {
  const resolvedRemoteUserId = resolveRemoteUserId(userId, remoteUserId);
  if (!resolvedRemoteUserId) {
    const workspace = upsertUserReview(userId, review);
    return { workspace, persisted: false, reason: "not_authenticated" };
  }

  try {
    const { error } = await supabase.rpc("submit_booking_review", {
      p_booking_id: review.bookingId,
      p_lawyer_id: review.lawyerId,
      p_rating: review.rating,
      p_clarity_rating: review.clarityRating,
      p_responsiveness_rating: review.responsivenessRating,
      p_review_text: review.text,
    });

    if (error) throw error;

    return { workspace: upsertUserReview(userId, review), persisted: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message?: unknown }).message)
          : String(error);
    if (message.includes("BOOKING_NOT_COMPLETED") || message.includes("BOOKING_NOT_FOUND")) {
      return { workspace: getUserWorkspace(userId), persisted: false, reason: "booking_not_completed" };
    }
    return { workspace: getUserWorkspace(userId), persisted: false, reason: "sync_failed" };
  }
};

export const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
