import type { ConsultationMode, ConsultationOption, Lawyer } from "@/data/lawyers";
import {
  buildAvailabilityTimeSlots,
  getAvailabilitySlotForDate,
  type PartnerAvailabilitySlot,
} from "@/lib/partnerWorkspace";

export type FeaturedGroupKey = "topRated" | "fastestResponse" | "bestValue" | "availableSoon";
export type AvailabilityIntent = "any" | "today" | "tomorrow";
export type LanguageIntent = "Greek" | "English";

export interface AvailabilityRules {
  availability: PartnerAvailabilitySlot[];
  bookingWindowDays: number;
  bufferMinutes: number;
}

export interface NextAvailabilityOption {
  date: Date;
  dateLabel: string;
  shortDateLabel: string;
  time: string;
}

export const featuredGroupLabels: Record<FeaturedGroupKey, string> = {
  topRated: "Υψηλότερη αξιολόγηση",
  fastestResponse: "Ταχύτερη απάντηση",
  bestValue: "Καλύτερη σχέση τιμής",
  availableSoon: "Πιο άμεση διαθεσιμότητα",
};

export const consultationModeNames: Record<ConsultationMode, string> = {
  video: "Βιντεοκλήση",
  phone: "Τηλέφωνο",
  inPerson: "Στο γραφείο",
};

export const publicTrustMechanics = [
  "Τα δημόσια προφίλ περνούν έλεγχο συνεργάτη πριν εμφανιστούν",
  "Οι αξιολογήσεις δημοσιεύονται μόνο μετά από ολοκληρωμένο ραντεβού",
  "Η διαθεσιμότητα ακολουθεί τους δημοσιευμένους κανόνες κάθε δικηγόρου",
  "Η κράτηση πληρώνεται με ασφαλή ροή Stripe Checkout",
];

export const popularLegalJourneys = [
  {
    title: "Διαζύγιο ή επιμέλεια",
    description: "Συγκρίνετε δικηγόρους οικογενειακού δικαίου για χωρισμό, επιμέλεια, διατροφή και πρώτα βήματα.",
    to: "/lawyers/divorce",
    query: "διαζύγιο",
  },
  {
    title: "Απόλυση ή αποζημίωση",
    description: "Βρείτε δικηγόρους εργατικού δικαίου για αποζημίωση, μισθούς, συμβάσεις και εργασιακές διαφορές.",
    to: "/lawyers/employment",
    query: "απόλυση",
  },
  {
    title: "Κληρονομικά",
    description: "Οργανώστε αποδοχή, αποποίηση, διαθήκη και κληρονομικές διαφορές με ελεγμένα προφίλ δικηγόρων.",
    to: "/lawyers/inheritance",
    query: "κληρονομιά",
  },
  {
    title: "Αγορά ή πώληση ακινήτου",
    description: "Ελέγξτε τίτλους, συμβάσεις, μισθώσεις και κινδύνους πριν από την υπογραφή.",
    to: "/lawyers/property",
    query: "ακίνητα",
  },
  {
    title: "Ποινική υπεράσπιση",
    description: "Κινηθείτε γρήγορα για υπεράσπιση, μηνύσεις, αυτόφωρο και προετοιμασία δικαστηρίου.",
    to: "/lawyers/criminal-defense",
    query: "ποινικό",
  },
];

export const issueDirectory = [
  {
    slug: "divorce",
    title: "Δικηγόροι για διαζύγιο",
    query: "διαζύγιο",
    specialtyHint: "Οικογενειακό δίκαιο",
    description: "Συγκρίνετε δικηγόρους για διαζύγιο, επιμέλεια, διατροφή και οικογενειακές περιουσιακές διαφορές.",
  },
  {
    slug: "employment",
    title: "Δικηγόροι εργατικού δικαίου",
    query: "εργατικό",
    specialtyHint: "Εργατικό δίκαιο",
    description: "Βρείτε δικηγόρους για απόλυση, αποζημίωση, συμβάσεις, οφειλόμενους μισθούς και εργασιακές διαφορές.",
  },
  {
    slug: "property",
    title: "Δικηγόροι για ακίνητα",
    query: "ακίνητα",
    specialtyHint: "Δίκαιο ακινήτων",
    description: "Κλείστε συμβουλευτική για έλεγχο τίτλων, αγορά, πώληση, μισθώσεις και διαφορές ακινήτων.",
  },
  {
    slug: "inheritance",
    title: "Δικηγόροι κληρονομικού δικαίου",
    query: "κληρονομικό",
    specialtyHint: "Κληρονομικό δίκαιο",
    description: "Πάρτε καθοδήγηση για διαθήκες, αποδοχή, αποποίηση, διαδικαστικά βήματα και κληρονομικές συγκρούσεις.",
  },
  {
    slug: "criminal-defense",
    title: "Δικηγόροι ποινικού δικαίου",
    query: "ποινικό",
    specialtyHint: "Ποινικό δίκαιο",
    description: "Συγκρίνετε δικηγόρους για επείγουσα υπεράσπιση, μηνύσεις, ακροάσεις και προετοιμασία δικαστηρίου.",
  },
];

export const cityDirectory = [
  { slug: "athens", title: "Αθήνα", inTitle: "στην Αθήνα", query: "Αθήνα" },
  { slug: "thessaloniki", title: "Θεσσαλονίκη", inTitle: "στη Θεσσαλονίκη", query: "Θεσσαλονίκη" },
  { slug: "patra", title: "Πάτρα", inTitle: "στην Πάτρα", query: "Πάτρα" },
  { slug: "heraklion", title: "Ηράκλειο", inTitle: "στο Ηράκλειο", query: "Ηράκλειο" },
];

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

export const normalizeMarketplaceText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("el-GR")
    .trim();

export const includesMarketplaceText = (source: string, query: string) =>
  normalizeMarketplaceText(source).includes(normalizeMarketplaceText(query));

export const isAvailableToday = (lawyer: Pick<Lawyer, "available">) => {
  const value = normalizeMarketplaceText(lawyer.available);
  return value.includes("today") || value.includes("σημερα");
};

export const isAvailableTomorrow = (lawyer: Pick<Lawyer, "available">) => {
  const value = normalizeMarketplaceText(lawyer.available);
  return value.includes("tomorrow") || value.includes("αυριο");
};

export const hasLanguage = (lawyer: Pick<Lawyer, "languages">, language: LanguageIntent) => {
  const targets =
    language === "Greek"
      ? ["greek", "ελληνικα", "ελληνική", "ελληνικη"]
      : ["english", "αγγλικα", "αγγλική", "αγγλικη"];

  return lawyer.languages.some((item) => {
    const normalized = normalizeMarketplaceText(item);
    return targets.some((target) => normalized.includes(normalizeMarketplaceText(target)));
  });
};

export const getLowestConsultation = (lawyer: Lawyer): ConsultationOption | null => {
  if (lawyer.consultations.length === 0) return null;
  return [...lawyer.consultations].sort((first, second) => first.price - second.price)[0];
};

export const getPriceFrom = (lawyer: Lawyer) => {
  const consultationPrice = getLowestConsultation(lawyer)?.price;
  return consultationPrice && consultationPrice > 0 ? consultationPrice : lawyer.price;
};

export const getLawyerMarketplaceSignals = (lawyer: Lawyer) => {
  const priceFrom = getPriceFrom(lawyer);
  const verified = Boolean(
    lawyer.verification?.barAssociation &&
      lawyer.verification?.registryLabel &&
      lawyer.verification?.evidence?.length,
  );
  const bookable = lawyer.consultations.some(
    (consultation) =>
      consultation.price > 0 &&
      lawyer.consultationModes.includes(consultation.mode),
  );

  return {
    verified,
    available: Boolean(lawyer.available),
    reviewed: lawyer.reviews > 0,
    bookable,
    priceFrom,
    priceFromLabel: `από ${formatCurrency(priceFrom)}`,
    reviewLabel: lawyer.reviews === 1 ? "1 αξιολόγηση" : `${lawyer.reviews} αξιολογήσεις`,
    verifiedLabel: verified ? "Ελεγμένο προφίλ δικηγόρου" : "Σε έλεγχο προφίλ",
    availabilityLabel: lawyer.available || "Διαθεσιμότητα με ραντεβού",
  };
};

export const getMarketplaceStats = (lawyers: Lawyer[]) => {
  const totalReviews = lawyers.reduce((sum, lawyer) => sum + lawyer.reviews, 0);
  const averageRating =
    lawyers.length > 0
      ? lawyers.reduce((sum, lawyer) => sum + lawyer.rating, 0) / lawyers.length
      : 0;
  const prices = lawyers.map(getPriceFrom).filter((price) => Number.isFinite(price) && price > 0);

  return {
    verifiedProfiles: lawyers.length,
    totalReviews,
    averageRating: averageRating.toFixed(1),
    cityCount: new Set(lawyers.map((lawyer) => lawyer.city)).size,
    availableToday: lawyers.filter(isAvailableToday).length,
    fastResponse: lawyers.filter((lawyer) => lawyer.responseMinutes <= 60).length,
    startingPrice: prices.length ? Math.min(...prices) : 0,
  };
};

const scoreRecommended = (lawyer: Lawyer) =>
  lawyer.rating * 100 + lawyer.reviews * 0.2 + lawyer.experience * 1.6 - lawyer.responseMinutes * 0.05 - getPriceFrom(lawyer) * 0.04;

const scoreAvailableSoon = (lawyer: Lawyer) =>
  (isAvailableToday(lawyer) ? 1000 : isAvailableTomorrow(lawyer) ? 700 : 0) -
  lawyer.responseMinutes +
  lawyer.rating * 20 -
  getPriceFrom(lawyer) * 0.1;

export const getFeaturedLawyerGroups = (lawyers: Lawyer[]): Record<FeaturedGroupKey, Lawyer[]> => ({
  topRated: [...lawyers].sort((first, second) => second.rating - first.rating || second.reviews - first.reviews).slice(0, 3),
  fastestResponse: [...lawyers].sort((first, second) => first.responseMinutes - second.responseMinutes || second.rating - first.rating).slice(0, 3),
  bestValue: [...lawyers].sort((first, second) => getPriceFrom(first) - getPriceFrom(second) || second.rating - first.rating || second.reviews - first.reviews).slice(0, 3),
  availableSoon: [...lawyers].sort((first, second) => scoreAvailableSoon(second) - scoreAvailableSoon(first)).slice(0, 3),
});

export const getRecommendedLawyers = (lawyers: Lawyer[], count = 3) =>
  [...lawyers].sort((first, second) => scoreRecommended(second) - scoreRecommended(first)).slice(0, count);

export const getDiscoveryConfig = (issueSlug?: string, citySlug?: string) => {
  const issue = issueDirectory.find((item) => item.slug === issueSlug) || issueDirectory[0];
  const city = cityDirectory.find((item) => item.slug === citySlug);

  return {
    issue,
    city,
    title: city ? `${issue.title} ${city.inTitle}` : issue.title,
    description: city
      ? `${issue.description} Τα αποτελέσματα δίνουν προτεραιότητα σε δικηγόρους που εξυπηρετούν ${city.title}.`
      : issue.description,
    searchPath: `/search?q=${encodeURIComponent(issue.query)}${city ? `&city=${encodeURIComponent(city.query)}` : ""}`,
  };
};

export const getDurationMinutes = (duration?: string) => {
  const match = duration?.match(/\d+/);
  return match ? Number(match[0]) : 30;
};

export const getNextAvailabilityOptions = (
  rules: AvailabilityRules,
  consultation?: Pick<ConsultationOption, "duration"> | null,
  options?: {
    maxOptions?: number;
    reservedSlots?: Set<string>;
    lawyerId?: string;
  },
): NextAvailabilityOption[] => {
  const maxOptions = options?.maxOptions || 4;
  const results: NextAvailabilityOption[] = [];
  const sessionMinutes = getDurationMinutes(consultation?.duration);

  for (let offset = 0; offset < Math.max(1, rules.bookingWindowDays); offset += 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);

    const availabilitySlot = getAvailabilitySlotForDate(rules.availability, date);
    const times = buildAvailabilityTimeSlots(availabilitySlot, sessionMinutes, rules.bufferMinutes);
    const dateLabel = new Intl.DateTimeFormat("el-GR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(date);
    const shortDateLabel =
      offset === 0
        ? "Σήμερα"
        : offset === 1
          ? "Αύριο"
          : new Intl.DateTimeFormat("el-GR", { weekday: "short", day: "numeric", month: "short" }).format(date);

    times.forEach((time) => {
      const slotKey =
        options?.lawyerId && `${options.lawyerId}::${dateLabel}::${time}`;
      if (slotKey && options?.reservedSlots?.has(slotKey)) return;
      if (results.length < maxOptions) {
        results.push({ date, dateLabel, shortDateLabel, time });
      }
    });

    if (results.length >= maxOptions) break;
  }

  return results;
};

export const getSimilarLawyerGroups = (lawyers: Lawyer[], current: Lawyer) => {
  const alternatives = lawyers.filter((lawyer) => lawyer.id !== current.id);
  const currentSpecialtyTokens = new Set(
    [current.specialty, current.specialtyShort, current.bestFor, ...current.specialties, ...current.specialtyKeywords]
      .flatMap((value) => normalizeMarketplaceText(value).split(/\s+/))
      .filter((token) => token.length > 3),
  );
  const currentModes = new Set(current.consultations.map((consultation) => consultation.mode));
  const currentLanguages = new Set(current.languages.map(normalizeMarketplaceText));

  const scoreSimilarity = (lawyer: Lawyer) => {
    const specialtyTokens = [lawyer.specialty, lawyer.specialtyShort, lawyer.bestFor, ...lawyer.specialties, ...lawyer.specialtyKeywords]
      .flatMap((value) => normalizeMarketplaceText(value).split(/\s+/))
      .filter((token) => token.length > 3);
    const specialtyOverlap = specialtyTokens.filter((token) => currentSpecialtyTokens.has(token)).length;
    const modeOverlap = lawyer.consultations.filter((consultation) => currentModes.has(consultation.mode)).length;
    const languageOverlap = lawyer.languages.filter((language) => currentLanguages.has(normalizeMarketplaceText(language))).length;
    const cityMatch = includesMarketplaceText(lawyer.city, current.city) || includesMarketplaceText(current.city, lawyer.city) ? 1 : 0;
    const priceDistance = Math.abs(getPriceFrom(lawyer) - getPriceFrom(current));

    return (
      specialtyOverlap * 28 +
      cityMatch * 18 +
      modeOverlap * 12 +
      languageOverlap * 10 +
      lawyer.rating * 8 +
      Math.min(lawyer.reviews, 80) * 0.4 +
      (isAvailableToday(lawyer) ? 18 : isAvailableTomorrow(lawyer) ? 10 : 0) -
      lawyer.responseMinutes * 0.06 -
      priceDistance * 0.05
    );
  };

  return {
    bestMatch: [...alternatives]
      .sort((first, second) => scoreSimilarity(second) - scoreSimilarity(first))
      .slice(0, 2),
    cheaper: alternatives
      .filter((lawyer) => getPriceFrom(lawyer) <= getPriceFrom(current))
      .sort((first, second) => getPriceFrom(first) - getPriceFrom(second) || second.rating - first.rating)
      .slice(0, 2),
    faster: alternatives
      .filter((lawyer) => lawyer.responseMinutes <= current.responseMinutes)
      .sort((first, second) => first.responseMinutes - second.responseMinutes || second.rating - first.rating)
      .slice(0, 2),
    moreReviewed: alternatives
      .filter((lawyer) => lawyer.reviews >= current.reviews)
      .sort((first, second) => second.reviews - first.reviews || second.rating - first.rating)
      .slice(0, 2),
  };
};
