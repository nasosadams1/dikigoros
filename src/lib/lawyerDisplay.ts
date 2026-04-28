import { consultationModeLabels, type Lawyer } from "@/data/lawyers";
import {
  normalizeAllowedMarketplaceCity,
  normalizeLegalPracticeArea,
} from "@/lib/marketplaceTaxonomy";

const normalizeLookupKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("el-GR");

const knownProfileTranslations = new Map(
  [
    ["Maria Papadopoulou", "Μαρία Παπαδοπούλου"],
    ["Athens Bar", "Δικηγορικός Σύλλογος Αθηνών"],
    ["Athens Bar Association", "Δικηγορικός Σύλλογος Αθηνών"],
    ["Thessaloniki Bar Association", "Δικηγορικός Σύλλογος Θεσσαλονίκης"],
    ["Piraeus Bar Association", "Δικηγορικός Σύλλογος Πειραιά"],
    ["Patras Bar Association", "Δικηγορικός Σύλλογος Πατρών"],
    ["Heraklion Bar Association", "Δικηγορικός Σύλλογος Ηρακλείου"],
    ["Verified registry", "Μητρώο επιβεβαιωμένο"],
    ["Verified Registry", "Μητρώο επιβεβαιωμένο"],
    ["Identity", "Ταυτοποίηση"],
    ["identity", "Ταυτοποίηση"],
    ["License", "Άδεια άσκησης"],
    ["license", "Άδεια άσκησης"],
    ["Professional details", "Επαγγελματικά στοιχεία"],
    ["professional details", "Επαγγελματικά στοιχεία"],
    ["Bar member", "Μέλος δικηγορικού συλλόγου"],
    ["500+ cases", "500+ υποθέσεις"],
    ["Greek", "Ελληνικά"],
    ["English", "Αγγλικά"],
    ["Law school", "Νομική σχολή"],
    ["University of Athens Law School", "Νομική Σχολή Αθηνών"],
    ["Video", "Βιντεοκλήση"],
    ["Phone", "Τηλεφωνική κλήση"],
    ["Video consultation", "Βιντεοκλήση"],
    ["Phone consultation", "Τηλεφωνική κλήση"],
    ["In-person consultation", "Στο γραφείο"],
    ["Office consultation", "Στο γραφείο"],
    ["Secure video consultation", "Ασφαλής βιντεοκλήση μέσω της πλατφόρμας"],
    ["Family law", "Οικογενειακό δίκαιο"],
    ["Family law specialist with clear first-consultation guidance.", "Δικηγόρος οικογενειακού δικαίου για διαζύγια, επιμέλεια τέκνων και διατροφές, με σαφή καθοδήγηση για τα έγγραφα και τα επόμενα βήματα από την πρώτη συμβουλευτική."],
    ["Divorces, child custody and family disputes.", "Διαζύγια, επιμέλεια τέκνων και οικογενειακές διαφορές."],
    ["Divorce, custody and family disputes.", "Διαζύγια, επιμέλεια τέκνων και οικογενειακές διαφορές."],
    ["Athens and online across Greece", "Αθήνα και διαδικτυακά σε όλη την Ελλάδα"],
    ["Video consultation for dismissals, severance, unpaid wages, and contract reviews across Greece.", "Βιντεοκλήση για απολύσεις, αποζημιώσεις, οφειλόμενους μισθούς και έλεγχο συμβάσεων σε όλη την Ελλάδα."],
    ["Phone advice for dismissals, unpaid wages, and immediate strategy planning.", "Τηλεφωνική καθοδήγηση για απολύσεις, οφειλόμενους μισθούς και άμεσο πλάνο ενεργειών."],
  ].map(([source, translation]) => [normalizeLookupKey(source), translation]),
);

const formatIsoDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return "";

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("el-GR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

export const localizeProfileText = (value?: string | null) => {
  const trimmed = value?.trim() || "";
  if (!trimmed) return "";

  const knownTranslation = knownProfileTranslations.get(normalizeLookupKey(trimmed));
  if (knownTranslation) return knownTranslation;

  const dateLabel = formatIsoDate(trimmed);
  if (dateLabel) return dateLabel;

  return trimmed
    .replace(/\bToday\b/gi, "Σήμερα")
    .replace(/\bTomorrow\b/gi, "Αύριο")
    .replace(/<\s*(\d+)\s*hours?/gi, (_match, amount: string) => `< ${amount} ${amount === "1" ? "ώρα" : "ώρες"}`)
    .replace(/<\s*(\d+)\s*minutes?/gi, (_match, amount: string) => `< ${amount} λεπτά`)
    .replace(/\b(\d+)\s*minutes?\b/gi, (_match, amount: string) => `${amount} λεπτά`);
};

const localizeSpecialty = (value?: string | null) =>
  normalizeLegalPracticeArea(value) || localizeProfileText(value);

const localizeCity = (value?: string | null) =>
  normalizeAllowedMarketplaceCity(value) || localizeProfileText(value);

const unique = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const localizeLawyerProfile = (lawyer: Lawyer): Lawyer => {
  const specialty = localizeSpecialty(lawyer.specialty);
  const specialtyShort = localizeSpecialty(lawyer.specialtyShort) || specialty;
  const specialties = unique(lawyer.specialties.map(localizeProfileText));

  return {
    ...lawyer,
    name: localizeProfileText(lawyer.name),
    specialty: specialty || lawyer.specialty,
    specialtyShort: specialtyShort || lawyer.specialtyShort,
    specialties: specialties.length ? specialties : lawyer.specialties,
    specialtyKeywords: lawyer.specialtyKeywords.map(localizeProfileText),
    bestFor: localizeProfileText(lawyer.bestFor),
    city: localizeCity(lawyer.city),
    available: localizeProfileText(lawyer.available),
    response: localizeProfileText(lawyer.response),
    bio: localizeProfileText(lawyer.bio),
    education: localizeProfileText(lawyer.education),
    languages: unique(lawyer.languages.map(localizeProfileText)),
    credentials: unique(lawyer.credentials.map(localizeProfileText)),
    verification: {
      barAssociation: localizeProfileText(lawyer.verification.barAssociation),
      registryLabel: localizeProfileText(lawyer.verification.registryLabel),
      checkedAt: localizeProfileText(lawyer.verification.checkedAt),
      evidence: unique(lawyer.verification.evidence.map(localizeProfileText)),
    },
    consultations: lawyer.consultations.map((consultation) => ({
      ...consultation,
      type: consultationModeLabels[consultation.mode] || localizeProfileText(consultation.type),
      duration: localizeProfileText(consultation.duration),
      desc: localizeProfileText(consultation.desc),
    })),
  };
};
