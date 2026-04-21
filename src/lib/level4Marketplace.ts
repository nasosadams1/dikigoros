import type { ConsultationMode, Lawyer } from "@/data/lawyers";
import {
  getLawyerMarketplaceSignals,
  getPriceFrom,
  includesMarketplaceText,
  isAvailableToday,
  isAvailableTomorrow,
} from "@/lib/marketplace";
import { allowedMarketplaceCities, legalPracticeAreas } from "@/lib/marketplaceTaxonomy";

export type PartnerPlanId = "basic" | "pro" | "premium" | "firms";
export type IntakeUrgency = "today" | "this_week" | "flexible";
export type IntakeBudget = "under_50" | "50_80" | "80_120" | "120_plus" | "flexible";

export interface PartnerPlan {
  id: PartnerPlanId;
  name: string;
  monthlyPrice: number;
  annualMonthlyPrice?: number;
  completedConsultationFee: number;
  visibilityBoost: number;
  checkoutRequired: boolean;
  recommended?: boolean;
  salesOnly?: boolean;
  includedSeats?: number;
  extraSeatMonthlyPrice?: number;
  entitlements: {
    verifiedListing: boolean;
    bookings: boolean;
    labeledVisibilityBoost: boolean;
    enhancedAnalytics: boolean;
    profileTools: boolean;
    crmPipeline: boolean;
    followUpTasks: boolean;
    documentRequests: boolean;
    conversionAnalytics: boolean;
  };
}

export interface MarketplaceRankingContext {
  city?: string;
  category?: string;
  consultationMode?: ConsultationMode | "any";
  urgency?: IntakeUrgency;
  budget?: IntakeBudget;
  query?: string;
}

export interface LawyerRankingResult {
  lawyer: Lawyer;
  score: number;
  plan: PartnerPlan;
  level4Ready: boolean;
  sponsoredLabel: string | null;
  readinessIssues: string[];
  reasons: string[];
}

type Level4LawyerFields = Partial<{
  partnerPlan: PartnerPlanId;
  partner_plan: PartnerPlanId;
  partnerTier: PartnerPlanId;
  partner_tier: PartnerPlanId;
  visibilityTier: PartnerPlanId;
  visibility_tier: PartnerPlanId;
  completedConsultations: number;
  completed_consultations: number;
}>;

export const level4LaunchMinimums = {
  lawyersPerCityCategory: 3,
  verified: 3,
  priced: 3,
  bookable: 3,
  availableSoon: 2,
  reviewed: 2,
};

export const partnerPlans: PartnerPlan[] = [
  {
    id: "basic",
    name: "Βασικό",
    monthlyPrice: 0,
    completedConsultationFee: 7,
    visibilityBoost: 0,
    checkoutRequired: false,
    entitlements: {
      verifiedListing: true,
      bookings: true,
      labeledVisibilityBoost: false,
      enhancedAnalytics: false,
      profileTools: false,
      crmPipeline: false,
      followUpTasks: false,
      documentRequests: false,
      conversionAnalytics: false,
    },
  },
  {
    id: "pro",
    name: "Επαγγελματικό",
    monthlyPrice: 29,
    annualMonthlyPrice: 23,
    completedConsultationFee: 0,
    visibilityBoost: 35,
    checkoutRequired: true,
    recommended: true,
    entitlements: {
      verifiedListing: true,
      bookings: true,
      labeledVisibilityBoost: true,
      enhancedAnalytics: true,
      profileTools: true,
      crmPipeline: false,
      followUpTasks: false,
      documentRequests: false,
      conversionAnalytics: true,
    },
  },
  {
    id: "premium",
    name: "Πλήρες",
    monthlyPrice: 99.99,
    annualMonthlyPrice: 83.99,
    completedConsultationFee: 0,
    visibilityBoost: 65,
    checkoutRequired: true,
    entitlements: {
      verifiedListing: true,
      bookings: true,
      labeledVisibilityBoost: true,
      enhancedAnalytics: true,
      profileTools: true,
      crmPipeline: true,
      followUpTasks: true,
      documentRequests: true,
      conversionAnalytics: true,
    },
  },
  {
    id: "firms",
    name: "Γραφεία / Ομάδες",
    monthlyPrice: 127.99,
    completedConsultationFee: 0,
    visibilityBoost: 65,
    checkoutRequired: false,
    salesOnly: true,
    includedSeats: 3,
    extraSeatMonthlyPrice: 25,
    entitlements: {
      verifiedListing: true,
      bookings: true,
      labeledVisibilityBoost: true,
      enhancedAnalytics: true,
      profileTools: true,
      crmPipeline: true,
      followUpTasks: true,
      documentRequests: true,
      conversionAnalytics: true,
    },
  },
];

export const level4FunnelEvents = [
  "homepage_search",
  "search_profile_opened",
  "profile_booking_start",
  "booking_created",
  "payment_opened",
  "payment_completed",
  "consultation_completed",
  "review_submitted",
  "lawyer_application_submitted",
  "lawyer_application_approved",
  "approved_lawyer_first_completed_consultation",
  "intake_submitted",
  "intake_routed",
  "partner_plan_checkout_opened",
  "partner_subscription_active",
  "pipeline_status_updated",
  "followup_task_created",
] as const;

export const level4PipelineStatuses = [
  "booked",
  "paid",
  "upcoming",
  "completed",
  "review_pending",
  "refund_risk",
  "follow_up_needed",
] as const;

export type Level4PipelineStatus = (typeof level4PipelineStatuses)[number];

export const getPartnerPlan = (planId?: string | null) =>
  partnerPlans.find((plan) => plan.id === planId) || partnerPlans[0];

export const getPartnerPlanForLawyer = (lawyer: Lawyer) => {
  const extended = lawyer as Lawyer & Level4LawyerFields;
  return getPartnerPlan(
    extended.partnerPlan ||
      extended.partner_plan ||
      extended.partnerTier ||
      extended.partner_tier ||
      extended.visibilityTier ||
      extended.visibility_tier,
  );
};

const getCompletedConsultations = (lawyer: Lawyer) => {
  const extended = lawyer as Lawyer & Level4LawyerFields;
  return Number(extended.completedConsultations ?? extended.completed_consultations ?? 0) || 0;
};

const hasMeaningfulText = (value: string | undefined, minLength: number) =>
  Boolean(value && value.trim().length >= minLength);

const matchesCategory = (lawyer: Lawyer, category?: string) => {
  if (!category) return true;
  const area = legalPracticeAreas.find(
    (candidate) =>
      candidate.slug === category ||
      includesMarketplaceText(candidate.label, category) ||
      includesMarketplaceText(candidate.shortLabel, category) ||
      includesMarketplaceText(candidate.query, category),
  );
  const queries = area
    ? [area.label, area.shortLabel, area.query, ...area.keywords]
    : [category];
  const haystack = [
    lawyer.specialty,
    lawyer.specialtyShort,
    lawyer.bestFor,
    lawyer.bio,
    ...lawyer.specialties,
    ...lawyer.specialtyKeywords,
  ].join(" ");
  return queries.some((query) => includesMarketplaceText(haystack, query));
};

const matchesCity = (lawyer: Lawyer, city?: string) => {
  if (!city) return true;
  const cityConfig = allowedMarketplaceCities.find(
    (candidate) =>
      candidate.slug === city ||
      includesMarketplaceText(candidate.title, city) ||
      includesMarketplaceText(candidate.query, city) ||
      candidate.aliases.some((alias) => includesMarketplaceText(alias, city)),
  );
  const queries = cityConfig ? [cityConfig.title, cityConfig.query, ...cityConfig.aliases] : [city];
  return queries.some((query) => includesMarketplaceText(lawyer.city, query));
};

const matchesBudget = (price: number, budget?: IntakeBudget) => {
  if (!budget || budget === "flexible") return true;
  if (budget === "under_50") return price <= 50;
  if (budget === "50_80") return price > 50 && price <= 80;
  if (budget === "80_120") return price > 80 && price <= 120;
  return price > 120;
};

export const getLawyerLevel4Readiness = (lawyer: Lawyer) => {
  const signals = getLawyerMarketplaceSignals(lawyer);
  const issues: string[] = [];

  if (!signals.verified) issues.push("verification_missing");
  if (!signals.bookable) issues.push("bookable_consultation_missing");
  if (!(signals.priceFrom > 0)) issues.push("price_missing");
  if (!hasMeaningfulText(lawyer.available, 2)) issues.push("availability_missing");
  if (!(Number.isFinite(lawyer.responseMinutes) && lawyer.responseMinutes > 0)) issues.push("response_time_missing");
  if (!hasMeaningfulText(lawyer.name, 5)) issues.push("name_incomplete");
  if (!hasMeaningfulText(lawyer.city, 2)) issues.push("city_missing");
  if (!hasMeaningfulText(lawyer.specialty, 4)) issues.push("specialty_missing");
  if (!hasMeaningfulText(lawyer.bio, 60)) issues.push("bio_too_short");
  if (lawyer.languages.length === 0) issues.push("languages_missing");

  return {
    ready: issues.length === 0,
    issues,
    signals,
  };
};

export const scoreLawyerForMarketplace = (
  lawyer: Lawyer,
  context: MarketplaceRankingContext = {},
): LawyerRankingResult => {
  const readiness = getLawyerLevel4Readiness(lawyer);
  const plan = getPartnerPlanForLawyer(lawyer);
  const priceFrom = getPriceFrom(lawyer);
  const cityMatch = matchesCity(lawyer, context.city);
  const categoryMatch = matchesCategory(lawyer, context.category || context.query);
  const modeMatch =
    !context.consultationMode ||
    context.consultationMode === "any" ||
    lawyer.consultationModes.includes(context.consultationMode);
  const budgetMatch = matchesBudget(priceFrom, context.budget);
  const reasons: string[] = [];

  let score = readiness.ready ? 0 : -5000;
  if (readiness.signals.verified) {
    score += 1000;
    reasons.push("verified");
  }
  if (cityMatch) {
    score += context.city ? 500 : 80;
    reasons.push("city_fit");
  }
  if (categoryMatch) {
    score += context.category || context.query ? 520 : 80;
    reasons.push("category_fit");
  }
  if (modeMatch) {
    score += context.consultationMode && context.consultationMode !== "any" ? 130 : 40;
    reasons.push("mode_fit");
  }
  if (budgetMatch) {
    score += context.budget && context.budget !== "flexible" ? 100 : 35;
    reasons.push("budget_fit");
  }
  if (isAvailableToday(lawyer)) {
    score += context.urgency === "today" ? 220 : 140;
    reasons.push("available_today");
  } else if (isAvailableTomorrow(lawyer)) {
    score += context.urgency === "today" ? 90 : 120;
    reasons.push("available_tomorrow");
  }
  score += Math.max(0, 180 - lawyer.responseMinutes) * 0.7;
  score += Math.min(lawyer.reviews, 150) * 0.75;
  score += lawyer.rating * 25;
  score += Math.min(getCompletedConsultations(lawyer), 120) * 0.8;
  score -= Math.max(0, priceFrom - 50) * 0.25;

  if (readiness.ready && plan.entitlements.labeledVisibilityBoost) {
    score += plan.visibilityBoost;
    reasons.push(`${plan.id}_visibility`);
  }

  return {
    lawyer,
    score,
    plan,
    level4Ready: readiness.ready,
    sponsoredLabel: readiness.ready && plan.entitlements.labeledVisibilityBoost ? `Ενισχυμένη προβολή: ${plan.name}` : null,
    readinessIssues: readiness.issues,
    reasons,
  };
};

export const rankMarketplaceLawyers = (
  lawyers: Lawyer[],
  context: MarketplaceRankingContext = {},
) =>
  lawyers
    .map((lawyer) => scoreLawyerForMarketplace(lawyer, context))
    .sort((first, second) => second.score - first.score || second.lawyer.rating - first.lawyer.rating)
    .map((result) => result.lawyer);

export const rankMarketplaceLawyersWithReasons = (
  lawyers: Lawyer[],
  context: MarketplaceRankingContext = {},
) =>
  lawyers
    .map((lawyer) => scoreLawyerForMarketplace(lawyer, context))
    .sort((first, second) => second.score - first.score || second.lawyer.rating - first.lawyer.rating);

export const getLevel4Coverage = (lawyers: Lawyer[]) => {
  const pairs = allowedMarketplaceCities.flatMap((city) =>
    legalPracticeAreas.map((category) => {
      const matching = lawyers.filter(
        (lawyer) => matchesCity(lawyer, city.slug) && matchesCategory(lawyer, category.slug),
      );
      const readyLawyers = matching.filter((lawyer) => getLawyerLevel4Readiness(lawyer).ready);
      const withSignals = matching.map((lawyer) => ({
        lawyer,
        signals: getLawyerMarketplaceSignals(lawyer),
      }));
      const verified = withSignals.filter(({ signals }) => signals.verified).length;
      const priced = withSignals.filter(({ signals }) => signals.priceFrom > 0).length;
      const bookable = withSignals.filter(({ signals }) => signals.bookable).length;
      const availableSoon = matching.filter((lawyer) => isAvailableToday(lawyer) || isAvailableTomorrow(lawyer)).length;
      const reviewed = matching.filter((lawyer) => lawyer.reviews > 0).length;
      const ready =
        readyLawyers.length >= level4LaunchMinimums.lawyersPerCityCategory &&
        verified >= level4LaunchMinimums.verified &&
        priced >= level4LaunchMinimums.priced &&
        bookable >= level4LaunchMinimums.bookable &&
        availableSoon >= level4LaunchMinimums.availableSoon &&
        reviewed >= level4LaunchMinimums.reviewed;

      return {
        citySlug: city.slug,
        cityLabel: city.title,
        categorySlug: category.slug,
        categoryLabel: category.label,
        route: `/lawyers/${category.slug}/${city.slug}`,
        total: matching.length,
        readyLawyers: readyLawyers.length,
        verified,
        priced,
        bookable,
        availableSoon,
        reviewed,
        ready,
      };
    }),
  );

  return {
    pairs,
    totalPairCount: pairs.length,
    readyPairCount: pairs.filter((pair) => pair.ready).length,
    missingPairs: pairs.filter((pair) => !pair.ready),
    ready: pairs.every((pair) => pair.ready),
  };
};

export const getAllCityCategoryLaunchRoutes = () =>
  legalPracticeAreas.flatMap((category) =>
    allowedMarketplaceCities.map((city) => `/lawyers/${category.slug}/${city.slug}`),
  );
