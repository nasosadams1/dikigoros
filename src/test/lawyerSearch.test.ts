import { describe, expect, it } from "vitest";
import { lawyers } from "@/data/lawyers";
import { searchLawyers, type LawyerSearchFilters } from "@/lib/lawyerSearch";

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

    expect(results.map((lawyer) => lawyer.id).sort()).toEqual(["andreas-georgiou", "nikos-antoniou"]);
  });

  it("filters by price range and sorts by lowest price", () => {
    const results = searchLawyers(lawyers, {
      ...baseFilters,
      priceRange: "50-80",
      sort: "price-low",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].price).toBeLessThanOrEqual(results[results.length - 1].price);
    expect(results.every((lawyer) => lawyer.price > 50 && lawyer.price <= 80)).toBe(true);
  });

  it("sorts by fastest response", () => {
    const results = searchLawyers(lawyers, { ...baseFilters, sort: "response" });

    expect(results[0].id).toBe("eleni-karagianni");
  });
});
