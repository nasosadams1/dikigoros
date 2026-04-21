import { describe, expect, it } from "vitest";
import type { Lawyer } from "@/data/lawyers";
import {
  getLevel4Coverage,
  partnerPlans,
  rankMarketplaceLawyersWithReasons,
  scoreLawyerForMarketplace,
} from "@/lib/level4Marketplace";
import { allowedMarketplaceCities, legalPracticeAreas } from "@/lib/marketplaceTaxonomy";

const makeLawyer = (
  id: string,
  city: string,
  category: string,
  overrides: Partial<Lawyer> & Record<string, unknown> = {},
): Lawyer =>
  ({
    id,
    name: `Lawyer ${id}`,
    specialty: category,
    specialtyShort: category,
    specialties: [category],
    specialtyKeywords: [category],
    bestFor: `${category} consultation with clear next steps`,
    city,
    rating: 4.8,
    reviews: 12,
    experience: 10,
    price: 70,
    available: "Today, 14:00",
    response: "< 1 hour",
    responseMinutes: 45,
    consultationModes: ["video", "phone"],
    bio: "A verified marketplace-ready lawyer profile with enough public information for consumers to compare and book safely.",
    education: "Law school",
    languages: ["Greek", "English"],
    credentials: ["Bar member"],
    verification: {
      barAssociation: "Athens Bar",
      registryLabel: "Verified registry",
      checkedAt: "2026-04-21",
      evidence: ["identity", "license"],
    },
    consultations: [
      { mode: "video", type: "Video consultation", price: 70, duration: "30 minutes", desc: "Secure video consultation" },
    ],
    image: "https://example.com/lawyer.jpg",
    ...overrides,
  }) as Lawyer;

describe("Level 4 marketplace engine", () => {
  it("requires all 25 city/category routes and three ready lawyers per pair", () => {
    const lawyers = allowedMarketplaceCities.flatMap((city) =>
      legalPracticeAreas.flatMap((category) =>
        [0, 1, 2].map((index) => makeLawyer(`${city.slug}-${category.slug}-${index}`, city.title, category.label)),
      ),
    );

    const coverage = getLevel4Coverage(lawyers);

    expect(coverage.totalPairCount).toBe(25);
    expect(coverage.readyPairCount).toBe(25);
    expect(coverage.ready).toBe(true);
  });

  it("keeps a city/category route blocked below the Level 4 density threshold", () => {
    const city = allowedMarketplaceCities[0];
    const category = legalPracticeAreas[0];
    const coverage = getLevel4Coverage([
      makeLawyer("one", city.title, category.label),
      makeLawyer("two", city.title, category.label),
    ]);

    const pair = coverage.pairs.find((item) => item.citySlug === city.slug && item.categorySlug === category.slug);

    expect(pair?.readyLawyers).toBe(2);
    expect(pair?.ready).toBe(false);
    expect(coverage.ready).toBe(false);
  });

  it("labels sponsored visibility only after verification and readiness pass", () => {
    const readyPro = makeLawyer("ready-pro", "Αθήνα", legalPracticeAreas[0].label, { partnerPlan: "pro" });
    const unreadyPremium = makeLawyer("unready-premium", "Αθήνα", legalPracticeAreas[0].label, {
      partnerPlan: "premium",
      verification: {
        barAssociation: "",
        registryLabel: "",
        checkedAt: "",
        evidence: [],
      },
    });

    expect(scoreLawyerForMarketplace(readyPro).sponsoredLabel).toBe("Ενισχυμένη προβολή: Επαγγελματικό");
    expect(scoreLawyerForMarketplace(unreadyPremium).sponsoredLabel).toBeNull();
  });

  it("does not let paid visibility outrank a ready organic profile when the paid profile is unready", () => {
    const readyBasic = makeLawyer("ready-basic", "Αθήνα", legalPracticeAreas[1].label);
    const unreadyPremium = makeLawyer("unready-premium", "Αθήνα", legalPracticeAreas[1].label, {
      partnerPlan: "premium",
      consultations: [],
    });

    const ranked = rankMarketplaceLawyersWithReasons([unreadyPremium, readyBasic], {
      city: "Αθήνα",
      category: legalPracticeAreas[1].label,
    });

    expect(ranked[0].lawyer.id).toBe("ready-basic");
    expect(ranked[1].sponsoredLabel).toBeNull();
  });

  it("ships the final partner pricing plan metadata", () => {
    const basic = partnerPlans.find((plan) => plan.id === "basic");
    const pro = partnerPlans.find((plan) => plan.id === "pro");
    const premium = partnerPlans.find((plan) => plan.id === "premium");
    const firms = partnerPlans.find((plan) => plan.id === "firms");

    expect(basic?.monthlyPrice).toBe(0);
    expect(basic?.completedConsultationFee).toBe(7);
    expect(basic?.checkoutRequired).toBe(false);

    expect(pro?.monthlyPrice).toBe(29);
    expect(pro?.annualMonthlyPrice).toBe(23);
    expect(pro?.recommended).toBe(true);

    expect(premium?.monthlyPrice).toBe(99.99);
    expect(premium?.annualMonthlyPrice).toBe(83.99);

    expect(firms?.monthlyPrice).toBe(127.99);
    expect(firms?.salesOnly).toBe(true);
    expect(firms?.checkoutRequired).toBe(false);
    expect(firms?.includedSeats).toBe(3);
    expect(firms?.extraSeatMonthlyPrice).toBe(25);
  });
});
