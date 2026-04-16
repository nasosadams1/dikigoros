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
  topRated: "Top rated",
  fastestResponse: "Fastest response",
  bestValue: "Best value",
  availableSoon: "Available soon",
};

export const consultationModeNames: Record<ConsultationMode, string> = {
  video: "Video",
  phone: "Phone",
  inPerson: "Office",
};

export const publicTrustMechanics = [
  "Verified partner profiles before public listing",
  "Reviews only after a completed booking",
  "Availability follows each lawyer's published rules",
  "Secure booking and Stripe-backed payment flow",
];

export const popularLegalJourneys = [
  {
    title: "Divorce or custody",
    description: "Compare family lawyers for separation, custody, support, and first-step strategy.",
    to: "/lawyers/divorce",
    query: "διαζύγιο",
  },
  {
    title: "Dismissal or compensation",
    description: "Find employment lawyers for severance, unpaid wages, and workplace disputes.",
    to: "/lawyers/employment",
    query: "απόλυση",
  },
  {
    title: "Inheritance",
    description: "Plan acceptance, refusal, wills, and inheritance disputes with verified lawyers.",
    to: "/lawyers/inheritance",
    query: "κληρονομιά",
  },
  {
    title: "Property sale or purchase",
    description: "Check titles, contracts, leases, and purchase risks before signing.",
    to: "/lawyers/property",
    query: "ακίνητα",
  },
  {
    title: "Criminal defense",
    description: "Move quickly on urgent criminal defense, complaints, and court appearances.",
    to: "/lawyers/criminal-defense",
    query: "ποινικό",
  },
];

export const issueDirectory = [
  {
    slug: "divorce",
    title: "Divorce lawyers",
    query: "διαζύγιο",
    specialtyHint: "Family law",
    description: "Compare lawyers for divorce, custody, support, and family property questions.",
  },
  {
    slug: "employment",
    title: "Employment lawyers",
    query: "εργατικό",
    specialtyHint: "Employment law",
    description: "Find lawyers for dismissal, compensation, contracts, unpaid wages, and workplace disputes.",
  },
  {
    slug: "property",
    title: "Property lawyers",
    query: "ακίνητα",
    specialtyHint: "Property law",
    description: "Book help for title checks, purchases, sales, leases, and property disputes.",
  },
  {
    slug: "inheritance",
    title: "Inheritance lawyers",
    query: "κληρονομικό",
    specialtyHint: "Inheritance law",
    description: "Get guidance on wills, acceptance, refusal, probate steps, and inheritance conflicts.",
  },
  {
    slug: "criminal-defense",
    title: "Criminal defense lawyers",
    query: "ποινικό",
    specialtyHint: "Criminal law",
    description: "Compare lawyers for urgent defense, complaints, hearings, and court preparation.",
  },
];

export const cityDirectory = [
  { slug: "athens", title: "Athens", query: "Αθήνα" },
  { slug: "thessaloniki", title: "Thessaloniki", query: "Θεσσαλονίκη" },
  { slug: "patra", title: "Patra", query: "Πάτρα" },
  { slug: "heraklion", title: "Heraklion", query: "Ηράκλειο" },
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

export const getMarketplaceStats = (lawyers: Lawyer[]) => {
  const totalReviews = lawyers.reduce((sum, lawyer) => sum + lawyer.reviews, 0);
  const averageRating =
    lawyers.length > 0
      ? lawyers.reduce((sum, lawyer) => sum + lawyer.rating, 0) / lawyers.length
      : 0;
  const prices = lawyers.map((lawyer) => lawyer.price).filter((price) => Number.isFinite(price) && price > 0);

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
  lawyer.rating * 100 + lawyer.reviews * 0.2 + lawyer.experience * 1.6 - lawyer.responseMinutes * 0.05 - lawyer.price * 0.04;

const scoreAvailableSoon = (lawyer: Lawyer) =>
  (isAvailableToday(lawyer) ? 1000 : isAvailableTomorrow(lawyer) ? 700 : 0) -
  lawyer.responseMinutes +
  lawyer.rating * 20 -
  lawyer.price * 0.1;

export const getFeaturedLawyerGroups = (lawyers: Lawyer[]): Record<FeaturedGroupKey, Lawyer[]> => ({
  topRated: [...lawyers].sort((first, second) => second.rating - first.rating || second.reviews - first.reviews).slice(0, 3),
  fastestResponse: [...lawyers].sort((first, second) => first.responseMinutes - second.responseMinutes || second.rating - first.rating).slice(0, 3),
  bestValue: [...lawyers].sort((first, second) => first.price - second.price || second.rating - first.rating || second.reviews - first.reviews).slice(0, 3),
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
    title: city ? `${issue.title} in ${city.title}` : issue.title,
    description: city
      ? `${issue.description} Filtered for lawyers serving ${city.title}.`
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
        ? "Today"
        : offset === 1
          ? "Tomorrow"
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

  return {
    cheaper: alternatives
      .filter((lawyer) => lawyer.price <= current.price)
      .sort((first, second) => first.price - second.price || second.rating - first.rating)
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
