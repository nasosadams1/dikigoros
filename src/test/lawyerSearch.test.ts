import { describe, expect, it } from "vitest";
import { lawyers } from "@/data/lawyers";
import { searchLawyers, type LawyerSearchFilters } from "@/lib/lawyerSearch";
import { getPriceFrom } from "@/lib/marketplace";

const baseFilters: LawyerSearchFilters = {
  query: "",
  city: "",
  specialties: [],
  appointmentTypes: [],
  priceRange: "all",
  sort: "recommended",
};

describe("lawyer search", () => {
  it("matches Greek legal terms without requiring exact accents", () => {
    const results = searchLawyers(lawyers, { ...baseFilters, query: "διαζυγιο" });

    expect(results.map((lawyer) => lawyer.id)).toContain("maria-papadopoulou");
  });

  it("combines city and appointment type filters", () => {
    const results = searchLawyers(lawyers, {
      ...baseFilters,
      city: "Θεσσαλονίκη",
      appointmentTypes: ["inPerson"],
    });

    expect(results.map((lawyer) => lawyer.id)).toEqual(["nikos-antoniou"]);
  });

  it("filters by price range and sorts by lowest price", () => {
    const results = searchLawyers(lawyers, {
      ...baseFilters,
      priceRange: "50-80",
      sort: "price-low",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(getPriceFrom(results[0])).toBeLessThanOrEqual(getPriceFrom(results[results.length - 1]));
    expect(results.every((lawyer) => getPriceFrom(lawyer) > 50 && getPriceFrom(lawyer) <= 80)).toBe(true);
  });

  it("uses the lowest consultation as the public price-from definition", () => {
    const maria = lawyers.find((lawyer) => lawyer.id === "maria-papadopoulou");

    expect(maria).toBeDefined();
    expect(getPriceFrom(maria!)).toBe(50);
  });

  it("sorts by fastest response", () => {
    const results = searchLawyers(lawyers, { ...baseFilters, sort: "response" });

    expect(results[0].id).toBe("eleni-karagianni");
  });
});
