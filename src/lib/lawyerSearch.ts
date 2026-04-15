import type { ConsultationMode, Lawyer } from "@/data/lawyers";

export type PriceRange = "all" | "30-50" | "50-80" | "80-120" | "120+";
export type LawyerSort = "recommended" | "rating" | "price-low" | "experience" | "response";

export interface LawyerSearchFilters {
  query: string;
  city: string;
  specialties: string[];
  appointmentTypes: ConsultationMode[];
  priceRange: PriceRange;
  sort: LawyerSort;
}

export const defaultLawyerSearchFilters: LawyerSearchFilters = {
  query: "",
  city: "",
  specialties: [],
  appointmentTypes: [],
  priceRange: "all",
  sort: "recommended",
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
  lawyer.rating * 100 + lawyer.reviews * 0.18 + lawyer.experience * 1.8 - lawyer.responseMinutes * 0.04 - lawyer.price * 0.05;

export const filterLawyers = (lawyers: Lawyer[], filters: LawyerSearchFilters) =>
  lawyers.filter((lawyer) => {
    const cityMatches = !filters.city.trim() || includesNormalized(lawyer.city, filters.city);
    const specialtyMatches =
      filters.specialties.length === 0 ||
      filters.specialties.some((specialty) => lawyer.specialty === specialty || lawyer.specialties.includes(specialty));
    const appointmentMatches =
      filters.appointmentTypes.length === 0 ||
      filters.appointmentTypes.every((type) => lawyer.consultationModes.includes(type));

    return (
      matchesQuery(lawyer, filters.query) &&
      cityMatches &&
      specialtyMatches &&
      appointmentMatches &&
      matchesPriceRange(lawyer.price, filters.priceRange)
    );
  });

export const sortLawyers = (lawyers: Lawyer[], sort: LawyerSort) =>
  [...lawyers].sort((first, second) => {
    if (sort === "rating") return second.rating - first.rating || second.reviews - first.reviews;
    if (sort === "price-low") return first.price - second.price || second.rating - first.rating;
    if (sort === "experience") return second.experience - first.experience || second.rating - first.rating;
    if (sort === "response") return first.responseMinutes - second.responseMinutes || second.rating - first.rating;
    return getRecommendationScore(second) - getRecommendationScore(first);
  });

export const searchLawyers = (lawyers: Lawyer[], filters: LawyerSearchFilters) =>
  sortLawyers(filterLawyers(lawyers, filters), filters.sort);
