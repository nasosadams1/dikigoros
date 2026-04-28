import { lawyers as fallbackLawyers, type ConsultationMode, type Lawyer } from "@/data/lawyers";
import {
  applyPartnerWorkspaceToLawyer,
  fetchPublishedPartnerWorkspaceForLawyer,
  getPublishedPartnerWorkspaceForLawyer,
} from "@/lib/partnerWorkspace";
import {
  normalizeAllowedMarketplaceCity,
  normalizeLegalPracticeArea,
  normalizeLegalPracticeAreas,
} from "@/lib/marketplaceTaxonomy";
import { localizeLawyerProfile, localizeProfileText } from "@/lib/lawyerDisplay";
import { allowLocalCriticalFallback } from "@/lib/runtimeGuards";
import { publicSupabase } from "@/lib/supabase";

interface LawyerProfileRow {
  id: string;
  name: string;
  specialty: string;
  specialty_short: string;
  specialties: string[] | null;
  specialty_keywords: string[] | null;
  best_for: string;
  city: string;
  rating: number;
  reviews: number;
  experience: number;
  price: number;
  available: string;
  response: string;
  response_minutes: number;
  consultation_modes: ConsultationMode[] | null;
  bio: string;
  education: string;
  languages: string[] | null;
  credentials: string[] | null;
  verification: Lawyer["verification"] | null;
  consultations: Lawyer["consultations"] | null;
  image: string;
}

export interface PublicLawyerReview {
  id: string;
  clientName: string;
  rating: number;
  clarityRating: number;
  responsivenessRating: number;
  text: string;
  consultationType: string;
  type: string;
  date: string;
  lawyerReply: string;
}

export interface PublicLawyerProfileReadiness {
  ready: boolean;
  issues: string[];
}

const lawyerTableName = (import.meta.env.VITE_SUPABASE_LAWYERS_TABLE as string | undefined) || "lawyer_profiles";
const genericProfileValues = new Set(["legal consultation", "legal services", "unknown user"]);
const emptyVerification: Lawyer["verification"] = {
  barAssociation: "",
  registryLabel: "",
  checkedAt: "",
  evidence: [],
};

const isConsultationMode = (value: string): value is ConsultationMode =>
  value === "video" || value === "phone" || value === "inPerson";

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || "";

const hasMeaningfulText = (value: string | undefined, minLength: number) => {
  const normalized = normalizeText(value);
  return normalized.length >= minLength && !genericProfileValues.has(normalized);
};

const mapLawyerRow = (row: LawyerProfileRow): Lawyer =>
  localizeLawyerProfile({
    id: row.id,
    name: row.name,
    specialty: normalizeLegalPracticeArea(row.specialty) || row.specialty,
    specialtyShort: normalizeLegalPracticeArea(row.specialty_short) || row.specialty_short,
    specialties: normalizeLegalPracticeAreas(row.specialties || []),
    specialtyKeywords: row.specialty_keywords || [],
    bestFor: row.best_for,
    city: normalizeAllowedMarketplaceCity(row.city) || row.city,
    rating: Number(row.rating),
    reviews: Number(row.reviews),
    experience: Number(row.experience),
    price: Number(row.price),
    available: row.available,
    response: row.response,
    responseMinutes: Number(row.response_minutes),
    consultationModes: (row.consultation_modes || []).filter(isConsultationMode),
    bio: row.bio,
    education: row.education,
    languages: row.languages || [],
    credentials: row.credentials || [],
    verification:
      row.verification ||
      (allowLocalCriticalFallback
        ? fallbackLawyers.find((lawyer) => lawyer.id === row.id)?.verification || fallbackLawyers[0].verification
        : emptyVerification),
    consultations:
      row.consultations ||
      (allowLocalCriticalFallback ? fallbackLawyers.find((lawyer) => lawyer.id === row.id)?.consultations : undefined) ||
      [],
    image: row.image,
  });

export const applyPublishedPartnerProfile = (lawyer: Lawyer): Lawyer => {
  const publishedWorkspace = getPublishedPartnerWorkspaceForLawyer(lawyer.id);
  return publishedWorkspace ? applyPartnerWorkspaceToLawyer(lawyer, publishedWorkspace) : localizeLawyerProfile(lawyer);
};

const applyPublishedPartnerProfileRemote = async (lawyer: Lawyer): Promise<Lawyer> => {
  const publishedWorkspace = await fetchPublishedPartnerWorkspaceForLawyer(lawyer.id);
  return publishedWorkspace ? applyPartnerWorkspaceToLawyer(lawyer, publishedWorkspace) : localizeLawyerProfile(lawyer);
};

export const getPublicLawyerProfileReadiness = (lawyer: Lawyer): PublicLawyerProfileReadiness => {
  const issues: string[] = [];
  const hasPricedConsultation = lawyer.consultations.some(
    (consultation) =>
      Number.isFinite(consultation.price) &&
      consultation.price > 0 &&
      hasMeaningfulText(consultation.type, 3) &&
      hasMeaningfulText(consultation.desc, 8),
  );

  if (!hasMeaningfulText(lawyer.name, 5)) {
    issues.push("Συμπληρώστε εμφανιζόμενο όνομα με τουλάχιστον 5 χαρακτήρες.");
  }

  if (!hasMeaningfulText(lawyer.specialty, 4)) {
    issues.push("Ορίστε κύρια ειδικότητα για να καταλαβαίνουν οι χρήστες σε τι αναλαμβάνετε υποθέσεις.");
  }

  if (!hasMeaningfulText(lawyer.city, 2)) {
    issues.push("Συμπληρώστε πόλη ή έδρα γραφείου.");
  }

  if (!hasMeaningfulText(lawyer.bio, 60)) {
    issues.push("Γράψτε σύντομη περιγραφή τουλάχιστον 60 χαρακτήρων.");
  }

  if (!(lawyer.price > 0)) {
    issues.push("Ορίστε βασική τιμή μεγαλύτερη από 0€.");
  }

  if (!(lawyer.experience > 0)) {
    issues.push("Συμπληρώστε χρόνια εμπειρίας μεγαλύτερα από 0.");
  }

  if (lawyer.consultationModes.length === 0) {
    issues.push("Ενεργοποιήστε τουλάχιστον έναν τρόπο συνεδρίας.");
  }

  if (lawyer.languages.length === 0) {
    issues.push("Προσθέστε τουλάχιστον μία γλώσσα.");
  }

  if (!hasPricedConsultation) {
    issues.push("Συμπληρώστε τουλάχιστον μία συνεδρία με έγκυρη τιμή, τίτλο και περιγραφή.");
  }

  if (
    !hasMeaningfulText(lawyer.verification.barAssociation, 4) ||
    !hasMeaningfulText(lawyer.verification.registryLabel, 4) ||
    lawyer.verification.evidence.length === 0
  ) {
    issues.push("Η δημόσια παρουσία απαιτεί επαληθευμένο σύλλογο, μητρώο και αποδεικτικά ελέγχου.");
  }

  return {
    ready: issues.length === 0,
    issues,
  };
};

export const isPublicLawyerProfileReady = (lawyer: Lawyer) => getPublicLawyerProfileReadiness(lawyer).ready;

export const getLawyerBaseProfileById = async (id?: string) => {
  if (!id) return null;

  try {
    const { data, error } = await publicSupabase
      .from(lawyerTableName)
      .select("*")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    if (data) return mapLawyerRow(data as LawyerProfileRow);
  } catch {
    if (!allowLocalCriticalFallback) return null;
  }

  return allowLocalCriticalFallback ? fallbackLawyers.find((lawyer) => lawyer.id === id) || null : null;
};

export const getLawyers = async () => {
  try {
    const { data, error } = await publicSupabase
      .from(lawyerTableName)
      .select("*")
      .eq("status", "active")
      .order("rating", { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
      return allowLocalCriticalFallback ? Promise.all(fallbackLawyers.map(applyPublishedPartnerProfileRemote)) : [];
    }

    const remoteLawyers = await Promise.all((data as LawyerProfileRow[]).map(mapLawyerRow).map(applyPublishedPartnerProfileRemote));
    return remoteLawyers.filter(isPublicLawyerProfileReady);
  } catch {
    return allowLocalCriticalFallback ? Promise.all(fallbackLawyers.map(applyPublishedPartnerProfileRemote)) : [];
  }
};

export const getLawyerById = async (id?: string) => {
  if (!id) return undefined;

  try {
    const { data, error } = await publicSupabase
      .from(lawyerTableName)
      .select("*")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const fallbackLawyer = allowLocalCriticalFallback ? fallbackLawyers.find((lawyer) => lawyer.id === id) : null;
      return fallbackLawyer ? applyPublishedPartnerProfileRemote(fallbackLawyer) : undefined;
    }

    const lawyer = await applyPublishedPartnerProfileRemote(mapLawyerRow(data as LawyerProfileRow));
    return isPublicLawyerProfileReady(lawyer) ? lawyer : undefined;
  } catch {
    const fallbackLawyer = allowLocalCriticalFallback ? fallbackLawyers.find((lawyer) => lawyer.id === id) : null;
    return fallbackLawyer ? applyPublishedPartnerProfileRemote(fallbackLawyer) : undefined;
  }
};

export const getLawyerReviews = async (lawyerId: string): Promise<PublicLawyerReview[]> => {
  try {
    const { data, error } = await publicSupabase
      .from("booking_reviews")
      .select("id,rating,clarity_rating,responsiveness_rating,review_text,lawyer_reply,created_at,booking_requests(consultation_type)")
      .eq("lawyer_id", lawyerId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return (data || []).map((row) => {
      const review = row as {
        id: string;
        rating: number;
        clarity_rating: number;
        responsiveness_rating: number;
        review_text: string;
        lawyer_reply?: string | null;
        created_at: string;
        booking_requests?: { consultation_type?: string | null } | null;
      };

      return {
        id: review.id,
        clientName: "Επαληθευμένος πελάτης",
        rating: Number(review.rating),
        clarityRating: Number(review.clarity_rating),
        responsivenessRating: Number(review.responsiveness_rating),
        text: review.review_text,
        lawyerReply: review.lawyer_reply || "",
        consultationType: localizeProfileText(review.booking_requests?.consultation_type || "Συνεδρία"),
        type: localizeProfileText(review.booking_requests?.consultation_type || "Συνεδρία"),
        date: new Date(review.created_at).toLocaleDateString("el-GR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      };
    });
  } catch {
    return [];
  }
};
