import type { ConsultationMode, Lawyer } from "@/data/lawyers";
import {
  getPriceFrom,
  hasLanguage,
  isAvailableToday,
  isAvailableTomorrow,
  type AvailabilityIntent,
  type LanguageIntent,
} from "@/lib/marketplace";
import { rankMarketplaceLawyers } from "@/lib/level4Marketplace";

export type PriceRange = "all" | "30-50" | "50-80" | "80-120" | "120+";
export type LawyerSort = "recommended" | "rating" | "price-low" | "experience" | "response" | "value" | "available";

export interface LawyerSearchFilters {
  query: string;
  city: string;
  specialties: string[];
  appointmentTypes: ConsultationMode[];
  priceRange: PriceRange;
  sort: LawyerSort;
  availability?: AvailabilityIntent;
  responseUnderMinutes?: number | null;
  minRating?: number | null;
  minReviews?: number | null;
  languages?: LanguageIntent[];
}

export const defaultLawyerSearchFilters: LawyerSearchFilters = {
  query: "",
  city: "",
  specialties: [],
  appointmentTypes: [],
  priceRange: "all",
  sort: "recommended",
  availability: "any",
  responseUnderMinutes: null,
  minRating: null,
  minReviews: null,
  languages: [],
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("el-GR")
    .trim();

const includesNormalized = (source: string, query: string) => normalize(source).includes(normalize(query));

const matchesPriceRange = (price: number, range: PriceRange) => {
  if (range === "all") return true;
  if (range === "30-50") return price >= 30 && price <= 50;
  if (range === "50-80") return price > 50 && price <= 80;
  if (range === "80-120") return price > 80 && price <= 120;
  return price > 120;
};

const matchesQuery = (lawyer: Lawyer, query: string) => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;

  return [
    lawyer.name,
    lawyer.specialty,
    lawyer.specialtyShort,
    lawyer.city,
    lawyer.bio,
    lawyer.bestFor,
    ...lawyer.specialties,
    ...lawyer.specialtyKeywords,
  ].some((value) => includesNormalized(value, trimmedQuery));
};

const getRecommendationScore = (lawyer: Lawyer) =>
  lawyer.rating * 100 + lawyer.reviews * 0.18 + lawyer.experience * 1.8 - lawyer.responseMinutes * 0.04 - getPriceFrom(lawyer) * 0.05;

const getAvailabilityScore = (lawyer: Lawyer) =>
  (isAvailableToday(lawyer) ? 1000 : isAvailableTomorrow(lawyer) ? 700 : 0) +
  lawyer.rating * 20 -
  lawyer.responseMinutes * 0.5 -
  getPriceFrom(lawyer) * 0.1;

const matchesAvailabilityIntent = (lawyer: Lawyer, availability?: AvailabilityIntent) => {
  if (!availability || availability === "any") return true;
  if (availability === "today") return isAvailableToday(lawyer);
  return isAvailableTomorrow(lawyer);
};

const getBudgetIntent = (filters?: LawyerSearchFilters) => {
  if (!filters || filters.priceRange === "all") return "flexible";
  if (filters.priceRange === "30-50") return "under_50";
  if (filters.priceRange === "50-80") return "50_80";
  if (filters.priceRange === "80-120") return "80_120";
  return "120_plus";
};

export const filterLawyers = (lawyers: Lawyer[], filters: LawyerSearchFilters) =>
  lawyers.filter((lawyer) => {
    const cityMatches = !filters.city.trim() || includesNormalized(lawyer.city, filters.city);
    const specialtyMatches =
      filters.specialties.length === 0 ||
      filters.specialties.some((specialty) => lawyer.specialty === specialty || lawyer.specialties.includes(specialty));
    const appointmentMatches =
      filters.appointmentTypes.length === 0 ||
      filters.appointmentTypes.every((type) => lawyer.consultationModes.includes(type));
    const responseMatches =
      !filters.responseUnderMinutes || lawyer.responseMinutes <= filters.responseUnderMinutes;
    const ratingMatches = !filters.minRating || lawyer.rating >= filters.minRating;
    const reviewMatches = !filters.minReviews || lawyer.reviews >= filters.minReviews;
    const languageMatches =
      !filters.languages?.length ||
      filters.languages.every((language) => hasLanguage(lawyer, language));

    return (
      matchesQuery(lawyer, filters.query) &&
      cityMatches &&
      specialtyMatches &&
      appointmentMatches &&
      matchesPriceRange(getPriceFrom(lawyer), filters.priceRange) &&
      matchesAvailabilityIntent(lawyer, filters.availability) &&
      responseMatches &&
      ratingMatches &&
      reviewMatches &&
      languageMatches
    );
  });

export const sortLawyers = (lawyers: Lawyer[], sort: LawyerSort, filters?: LawyerSearchFilters) => {
  if (sort === "recommended") {
    return rankMarketplaceLawyers(lawyers, {
      city: filters?.city,
      category: filters?.specialties[0] || filters?.query,
      query: filters?.query,
      consultationMode: filters?.appointmentTypes[0] || "any",
      budget: getBudgetIntent(filters),
      urgency: filters?.availability === "today" ? "today" : filters?.availability === "tomorrow" ? "this_week" : "flexible",
    });
  }

  return [...lawyers].sort((first, second) => {
    if (sort === "rating") return second.rating - first.rating || second.reviews - first.reviews;
    if (sort === "price-low") return getPriceFrom(first) - getPriceFrom(second) || second.rating - first.rating;
    if (sort === "value") return getPriceFrom(first) - getPriceFrom(second) || second.rating - first.rating || second.reviews - first.reviews;
    if (sort === "available") return getAvailabilityScore(second) - getAvailabilityScore(first);
    if (sort === "experience") return second.experience - first.experience || second.rating - first.rating;
    if (sort === "response") return first.responseMinutes - second.responseMinutes || second.rating - first.rating;
    return getRecommendationScore(second) - getRecommendationScore(first);
  });
};

export const searchLawyers = (lawyers: Lawyer[], filters: LawyerSearchFilters) =>
  sortLawyers(filterLawyers(lawyers, filters), filters.sort, filters);
