import { consultationModeLabels, type ConsultationMode, type Lawyer } from "@/data/lawyers";
import { isPartnerSessionInvalidError, type PartnerSession } from "@/lib/platformRepository";
import { publicSupabase } from "@/lib/supabase";

export interface PartnerProfileSettings {
  lawyerId: string;
  displayName: string;
  officeName: string;
  city: string;
  primarySpecialty: string;
  serviceArea: string;
  bestFor: string;
  bio: string;
  experienceYears: number;
  specialties: string[];
  languages: string[];
  consultationModes: ConsultationMode[];
  videoPrice: number;
  phonePrice: number;
  inPersonPrice: number;
  videoDescription: string;
  phoneDescription: string;
  inPersonDescription: string;
  cancellationPolicy: string;
  autoConfirm: boolean;
  bookingWindowDays: number;
  bufferMinutes: number;
}

export interface PartnerAvailabilitySlot {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
  note: string;
}

export interface PartnerReview {
  id: string;
  clientName: string;
  rating: number;
  text: string;
  consultationType: string;
  date: string;
  status: "published" | "flagged";
  reply: string;
}

export interface PartnerWorkspace {
  profile: PartnerProfileSettings;
  availability: PartnerAvailabilitySlot[];
  reviews: PartnerReview[];
  notifications: {
    bookingEmail: boolean;
    bookingSms: boolean;
    weeklyDigest: boolean;
  };
}

const partnerWorkspacePrefix = "dikigoros.partnerWorkspace.v1";

export const defaultPartnerWorkspace: PartnerWorkspace = {
  profile: {
    lawyerId: "maria-papadopoulou",
    primarySpecialty: "Οικογενειακό Δίκαιο",
    bestFor: "Διαζύγια, επιμέλεια τέκνων και οικογενειακές διαφορές.",
    experienceYears: 14,
    videoDescription: "Ασφαλής βιντεοκλήση για πρώτη αξιολόγηση υπόθεσης και άμεσα επόμενα βήματα.",
    phoneDescription: "Τηλεφωνική συνεδρία για γρήγορη καθοδήγηση, αρχική στρατηγική και ορισμό next steps.",
    inPersonDescription: "Συνάντηση στο γραφείο για αναλυτική εξέταση φακέλου και οργάνωση εγγράφων.",
    displayName: "Μαρία Παπαδοπούλου",
    officeName: "Δικηγορικό Γραφείο Παπαδοπούλου",
    city: "Αθήνα",
    serviceArea: "Αθήνα και διαδικτυακά σε όλη την Ελλάδα",
    bio: "Εξειδίκευση σε οικογενειακό δίκαιο, συμβουλευτική πρώτης γραμμής και καθαρό πλάνο επόμενων ενεργειών.",
    specialties: ["Οικογενειακό Δίκαιο", "Διαζύγιο", "Επιμέλεια τέκνων"],
    languages: ["Ελληνικά", "Αγγλικά"],
    consultationModes: ["video", "phone", "inPerson"],
    videoPrice: 60,
    phonePrice: 50,
    inPersonPrice: 80,
    cancellationPolicy: "Δωρεάν ακύρωση ή αλλαγή έως 24 ώρες πριν από το ραντεβού.",
    autoConfirm: true,
    bookingWindowDays: 21,
    bufferMinutes: 15,
  },
  availability: [
    { day: "Δευτέρα", enabled: true, start: "09:00", end: "17:00", note: "" },
    { day: "Τρίτη", enabled: true, start: "10:00", end: "18:00", note: "" },
    { day: "Τετάρτη", enabled: true, start: "12:00", end: "16:00", note: "Δικαστήριο το πρωί" },
    { day: "Πέμπτη", enabled: true, start: "09:30", end: "16:30", note: "" },
    { day: "Παρασκευή", enabled: false, start: "09:00", end: "15:00", note: "Μόνο επείγοντα" },
  ],
  reviews: [
    {
      id: "review-1",
      clientName: "Αλεξάνδρα Μ.",
      rating: 5,
      text: "Πολύ καθαρή καθοδήγηση και άμεση εικόνα για τα επόμενα βήματα.",
      consultationType: "Βιντεοκλήση",
      date: "10 Απριλίου 2026",
      status: "published",
      reply: "",
    },
    {
      id: "review-2",
      clientName: "Δημήτρης Π.",
      rating: 5,
      text: "Η υπόθεση εξετάστηκε χωρίς περιττές γενικότητες.",
      consultationType: "Τηλεφωνική κλήση",
      date: "8 Απριλίου 2026",
      status: "published",
      reply: "Σας ευχαριστώ για την εμπιστοσύνη.",
    },
  ],
  notifications: {
    bookingEmail: true,
    bookingSms: true,
    weeklyDigest: false,
  },
};

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const getPartnerWorkspaceKey = (email?: string | null) =>
  `${partnerWorkspacePrefix}.${email?.trim().toLowerCase() || "default"}`;

const unique = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const normalizePartnerWorkspace = (workspace?: Partial<PartnerWorkspace> | null): PartnerWorkspace => ({
  ...defaultPartnerWorkspace,
  ...workspace,
  profile: {
    ...defaultPartnerWorkspace.profile,
    ...(workspace?.profile || {}),
    primarySpecialty:
      workspace?.profile?.primarySpecialty?.trim() ||
      workspace?.profile?.specialties?.[0] ||
      defaultPartnerWorkspace.profile.primarySpecialty,
    specialties: unique(workspace?.profile?.specialties || defaultPartnerWorkspace.profile.specialties),
    languages: unique(workspace?.profile?.languages || defaultPartnerWorkspace.profile.languages),
    consultationModes: workspace?.profile?.consultationModes || defaultPartnerWorkspace.profile.consultationModes,
  },
  availability: Array.isArray(workspace?.availability)
    ? workspace.availability
    : defaultPartnerWorkspace.availability,
  reviews: Array.isArray(workspace?.reviews) ? workspace.reviews : defaultPartnerWorkspace.reviews,
  notifications: {
    ...defaultPartnerWorkspace.notifications,
    ...(workspace?.notifications || {}),
  },
});

export const getPartnerWorkspace = (email?: string | null): PartnerWorkspace => {
  const storage = getStorage();
  if (!storage) return defaultPartnerWorkspace;

  try {
    const rawValue = storage.getItem(getPartnerWorkspaceKey(email));
    if (!rawValue) return defaultPartnerWorkspace;
    return normalizePartnerWorkspace(JSON.parse(rawValue) as Partial<PartnerWorkspace>);
  } catch {
    return defaultPartnerWorkspace;
  }
};

export const savePartnerWorkspace = (email: string | null | undefined, workspace: PartnerWorkspace) => {
  const storage = getStorage();
  const normalized = normalizePartnerWorkspace(workspace);
  storage?.setItem(getPartnerWorkspaceKey(email), JSON.stringify(normalized));
  return normalized;
};

interface PartnerProfileSettingsRow {
  lawyer_id?: string | null;
  profile?: Partial<PartnerProfileSettings> | null;
  availability?: PartnerAvailabilitySlot[] | null;
  reviews?: PartnerReview[] | null;
  notifications?: PartnerWorkspace["notifications"] | null;
  published_profile?: Partial<PartnerProfileSettings> | null;
  published_availability?: PartnerAvailabilitySlot[] | null;
  is_public?: boolean | null;
}

interface LawyerProfileWorkspaceRow {
  id: string;
  name?: string | null;
  specialty?: string | null;
  specialties?: string[] | null;
  best_for?: string | null;
  city?: string | null;
  price?: number | null;
  experience?: number | null;
  consultation_modes?: string[] | null;
  bio?: string | null;
  languages?: string[] | null;
  consultations?: Array<{
    mode?: string;
    price?: number | null;
    desc?: string | null;
    duration?: string | null;
  }> | null;
}

const isConsultationMode = (value: string): value is ConsultationMode =>
  value === "video" || value === "phone" || value === "inPerson";

const getLawyerModePrice = (
  lawyer: LawyerProfileWorkspaceRow,
  mode: ConsultationMode,
  fallbackPrice: number,
) => {
  const consultation = lawyer.consultations?.find((item) => item.mode === mode);
  const price = consultation?.price ?? lawyer.price ?? fallbackPrice;
  return Number.isFinite(Number(price)) ? Number(price) : fallbackPrice;
};

const getLawyerModeDescription = (
  lawyer: LawyerProfileWorkspaceRow,
  mode: ConsultationMode,
  fallbackDescription: string,
) => {
  const description = lawyer.consultations?.find((item) => item.mode === mode)?.desc?.trim();
  return description || fallbackDescription;
};

const getProfileModeDescription = (
  profile: PartnerProfileSettings,
  mode: ConsultationMode,
  fallbackDescription?: string,
) => {
  const description =
    mode === "phone"
      ? profile.phoneDescription
      : mode === "inPerson"
        ? profile.inPersonDescription
        : profile.videoDescription;

  return description?.trim() || fallbackDescription || profile.bestFor || profile.serviceArea;
};

const getLawyerModeDuration = (
  lawyer: Lawyer,
  mode: ConsultationMode,
  fallbackDuration: string,
) => lawyer.consultations.find((consultation) => consultation.mode === mode)?.duration || fallbackDuration;

const mergeLawyerProfileIntoWorkspace = (
  workspace: PartnerWorkspace,
  lawyer: LawyerProfileWorkspaceRow,
): PartnerWorkspace => {
  const specialties = unique(
    lawyer.specialties?.length ? lawyer.specialties : [lawyer.specialty || workspace.profile.specialties[0]],
  );
  const consultationModes = unique(
    (lawyer.consultation_modes || workspace.profile.consultationModes).filter(isConsultationMode),
  ) as ConsultationMode[];

  return normalizePartnerWorkspace({
    ...workspace,
    profile: {
      ...workspace.profile,
      lawyerId: lawyer.id,
      displayName: lawyer.name || workspace.profile.displayName,
      city: lawyer.city || workspace.profile.city,
      serviceArea: lawyer.best_for || workspace.profile.serviceArea,
      primarySpecialty: lawyer.specialty || workspace.profile.primarySpecialty,
      bestFor: lawyer.best_for || workspace.profile.bestFor,
      bio: lawyer.bio || workspace.profile.bio,
      experienceYears:
        Number.isFinite(Number(lawyer.experience)) && Number(lawyer.experience) > 0
          ? Number(lawyer.experience)
          : workspace.profile.experienceYears,
      specialties: specialties.length ? specialties : workspace.profile.specialties,
      languages: unique(lawyer.languages?.length ? lawyer.languages : workspace.profile.languages),
      consultationModes: consultationModes.length ? consultationModes : workspace.profile.consultationModes,
      videoPrice: getLawyerModePrice(lawyer, "video", workspace.profile.videoPrice),
      phonePrice: getLawyerModePrice(lawyer, "phone", workspace.profile.phonePrice),
      inPersonPrice: getLawyerModePrice(lawyer, "inPerson", workspace.profile.inPersonPrice),
      videoDescription: getLawyerModeDescription(lawyer, "video", workspace.profile.videoDescription),
      phoneDescription: getLawyerModeDescription(lawyer, "phone", workspace.profile.phoneDescription),
      inPersonDescription: getLawyerModeDescription(lawyer, "inPerson", workspace.profile.inPersonDescription),
    },
  });
};

const fetchLawyerProfileForWorkspace = async (lawyerId?: string | null) => {
  if (!lawyerId) return null;

  const { data, error } = await publicSupabase
    .from("lawyer_profiles")
    .select("id,name,specialty,specialties,best_for,city,price,experience,consultation_modes,bio,languages,consultations")
    .eq("id", lawyerId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return (data as LawyerProfileWorkspaceRow | null) || null;
};

export const fetchPartnerWorkspace = async (email?: string | null) => {
  const localWorkspace = getPartnerWorkspace(email);
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return localWorkspace;

  try {
    const { data, error } = await publicSupabase
      .from("partner_profile_settings")
      .select("*")
      .eq("partner_email", normalizedEmail)
      .maybeSingle();

    if (error) throw error;
    if (!data) return localWorkspace;

    const row = data as PartnerProfileSettingsRow;
    let remoteWorkspace = normalizePartnerWorkspace({
      ...localWorkspace,
      profile: {
        ...localWorkspace.profile,
        ...(row.profile || {}),
        lawyerId: row.lawyer_id || localWorkspace.profile.lawyerId,
      },
      availability: row.availability || localWorkspace.availability,
      reviews: row.reviews || localWorkspace.reviews,
      notifications: {
        ...localWorkspace.notifications,
        ...(row.notifications || {}),
      },
    });

    const hasStoredProfile = Boolean(row.profile && Object.keys(row.profile).length > 0);
    const lawyerProfile = hasStoredProfile ? null : await fetchLawyerProfileForWorkspace(row.lawyer_id);
    if (lawyerProfile) {
      remoteWorkspace = mergeLawyerProfileIntoWorkspace(remoteWorkspace, lawyerProfile);
    }

    return savePartnerWorkspace(normalizedEmail, remoteWorkspace);
  } catch {
    return localWorkspace;
  }
};

interface PartnerWorkspaceSyncOptions {
  throwOnRemoteError?: boolean;
}

export const syncPartnerWorkspace = async (
  email: string | null | undefined,
  workspace: PartnerWorkspace,
  partnerSession?: PartnerSession | null,
  options?: PartnerWorkspaceSyncOptions,
) => {
  const normalized = savePartnerWorkspace(email, workspace);
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return normalized;

  try {
    if (partnerSession?.sessionToken) {
      const { error } = await publicSupabase.rpc("save_partner_workspace_as_partner", {
        p_partner_email: normalizedEmail,
        p_session_token: partnerSession.sessionToken,
        p_profile: normalized.profile,
        p_availability: normalized.availability,
        p_notifications: normalized.notifications,
        p_reviews: normalized.reviews,
      });

      if (error) throw error;
    } else {
      const { error } = await publicSupabase.from("partner_profile_settings").upsert({
        partner_email: normalizedEmail,
        lawyer_id: normalized.profile.lawyerId,
        profile: normalized.profile,
        availability: normalized.availability,
        reviews: normalized.reviews,
        notifications: normalized.notifications,
        published_profile: normalized.profile,
        published_availability: normalized.availability,
        is_public: true,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
    }
  } catch (error) {
    if (isPartnerSessionInvalidError(error)) throw new Error("PARTNER_SESSION_INVALID");
    if (options?.throwOnRemoteError) throw error;
    // Local persistence keeps the portal usable while backend wiring catches up.
  }

  return normalized;
};

export const getPublishedPartnerWorkspaceForLawyer = (lawyerId: string) => {
  const storage = getStorage();
  if (!storage) return defaultPartnerWorkspace.profile.lawyerId === lawyerId ? defaultPartnerWorkspace : null;

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(`${partnerWorkspacePrefix}.`)) continue;

    try {
      const workspace = normalizePartnerWorkspace(JSON.parse(storage.getItem(key) || "{}") as PartnerWorkspace);
      if (workspace.profile.lawyerId === lawyerId) return workspace;
    } catch {
      // Ignore malformed local profile drafts.
    }
  }

  return defaultPartnerWorkspace.profile.lawyerId === lawyerId ? defaultPartnerWorkspace : null;
};

export const fetchPublishedPartnerWorkspaceForLawyer = async (lawyerId: string) => {
  const localWorkspace = getPublishedPartnerWorkspaceForLawyer(lawyerId);

  try {
    const { data, error } = await publicSupabase
      .from("partner_profile_settings")
      .select("lawyer_id,profile,availability,reviews,notifications,published_profile,published_availability,is_public")
      .eq("lawyer_id", lawyerId)
      .eq("is_public", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return localWorkspace;

    const row = data as PartnerProfileSettingsRow;
    return normalizePartnerWorkspace({
      ...(localWorkspace || defaultPartnerWorkspace),
      profile: {
        ...(localWorkspace || defaultPartnerWorkspace).profile,
        ...(row.profile || {}),
        ...(row.published_profile || {}),
        lawyerId: row.lawyer_id || lawyerId,
      },
      availability:
        row.published_availability ||
        row.availability ||
        localWorkspace?.availability ||
        defaultPartnerWorkspace.availability,
      reviews: row.reviews || localWorkspace?.reviews || [],
      notifications: {
        ...(localWorkspace || defaultPartnerWorkspace).notifications,
        ...(row.notifications || {}),
      },
    });
  } catch {
    return localWorkspace;
  }
};

const normalizeLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const getAvailabilitySlotForDate = (availability: PartnerAvailabilitySlot[], date: Date) => {
  const weekday = new Intl.DateTimeFormat("el-GR", { weekday: "long" }).format(date);
  const normalizedWeekday = normalizeLabel(weekday);
  return availability.find((slot) => normalizeLabel(slot.day) === normalizedWeekday) || null;
};

const parseTime = (value: string) => {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const formatTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

export const buildAvailabilityTimeSlots = (
  slot: PartnerAvailabilitySlot | null | undefined,
  sessionMinutes = 30,
  bufferMinutes = 0,
) => {
  if (!slot?.enabled) return [];
  const start = parseTime(slot.start);
  const end = parseTime(slot.end);
  if (start === null || end === null || end <= start) return [];

  const step = Math.max(15, sessionMinutes + Math.max(0, bufferMinutes));
  const latestStart = end - Math.max(15, sessionMinutes) - Math.max(0, bufferMinutes);
  const slots: string[] = [];

  for (let minutes = start; minutes <= latestStart; minutes += step) {
    slots.push(formatTime(minutes));
  }

  return slots;
};

export const getPartnerAvailabilityRulesForLawyer = (lawyerId: string) => {
  const workspace = getPublishedPartnerWorkspaceForLawyer(lawyerId);
  return {
    availability: workspace?.availability || defaultPartnerWorkspace.availability,
    bookingWindowDays: workspace?.profile.bookingWindowDays || defaultPartnerWorkspace.profile.bookingWindowDays,
    bufferMinutes: workspace?.profile.bufferMinutes || defaultPartnerWorkspace.profile.bufferMinutes,
  };
};

export const fetchPartnerAvailabilityRulesForLawyer = async (lawyerId: string) => {
  const workspace = await fetchPublishedPartnerWorkspaceForLawyer(lawyerId);
  return {
    availability: workspace?.availability || defaultPartnerWorkspace.availability,
    bookingWindowDays: workspace?.profile.bookingWindowDays || defaultPartnerWorkspace.profile.bookingWindowDays,
    bufferMinutes: workspace?.profile.bufferMinutes || defaultPartnerWorkspace.profile.bufferMinutes,
  };
};

const getModePrice = (profile: PartnerProfileSettings, mode: ConsultationMode) => {
  if (mode === "phone") return profile.phonePrice;
  if (mode === "inPerson") return profile.inPersonPrice;
  return profile.videoPrice;
};

const getNextAvailabilityLabel = (availability: PartnerAvailabilitySlot[]) => {
  const nextSlot = availability.find((slot) => slot.enabled);
  if (!nextSlot) return "Διαθεσιμότητα με ραντεβού";
  return `${nextSlot.day}, ${nextSlot.start}`;
};

export const applyPartnerWorkspaceToLawyer = (lawyer: Lawyer, workspace: PartnerWorkspace): Lawyer => {
  const consultationModes = workspace.profile.consultationModes.length
    ? workspace.profile.consultationModes
    : lawyer.consultationModes;
  const primarySpecialty =
    workspace.profile.primarySpecialty ||
    workspace.profile.specialties[0] ||
    lawyer.specialty;
  const specialties = unique([primarySpecialty, ...workspace.profile.specialties]);
  const consultations = consultationModes.map((mode) => ({
    mode,
    type: consultationModeLabels[mode],
    price: getModePrice(workspace.profile, mode),
    duration: getLawyerModeDuration(lawyer, mode, mode === "inPerson" ? "45 λεπτά" : "30 λεπτά"),
    desc: getProfileModeDescription(
      workspace.profile,
      mode,
      lawyer.consultations.find((consultation) => consultation.mode === mode)?.desc,
    ),
  }));
  const prices = consultations.map((consultation) => consultation.price);

  return {
    ...lawyer,
    name: workspace.profile.displayName || lawyer.name,
    city: workspace.profile.city || lawyer.city,
    specialties: specialties.length ? specialties : lawyer.specialties,
    specialty: primarySpecialty || lawyer.specialty,
    specialtyShort: primarySpecialty || lawyer.specialtyShort,
    bestFor: workspace.profile.bestFor || lawyer.bestFor,
    bio: workspace.profile.bio || lawyer.bio,
    experience: workspace.profile.experienceYears > 0 ? workspace.profile.experienceYears : lawyer.experience,
    languages: workspace.profile.languages.length ? workspace.profile.languages : lawyer.languages,
    consultationModes,
    consultations,
    price: prices.length ? Math.min(...prices) : lawyer.price,
    available: getNextAvailabilityLabel(workspace.availability),
  };
};

export const parseListInput = (value: string) =>
  unique(value.split(",").map((item) => item.trim()));

export const formatListInput = (items: string[]) => items.join(", ");
