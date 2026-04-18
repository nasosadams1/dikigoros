import { describe, expect, it } from "vitest";
import {
  allowedMarketplaceCityNames,
  legalPracticeAreaLabels,
  normalizeAllowedMarketplaceCity,
  normalizeLegalPracticeArea,
} from "@/lib/marketplaceTaxonomy";

describe("marketplace taxonomy", () => {
  it("keeps the public practice areas locked to the active launch set", () => {
    expect(legalPracticeAreaLabels).toEqual([
      "Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής",
      "Οικογενειακό δίκαιο",
      "Τροχαία / αποζημιώσεις / αυτοκίνητα",
      "Εργατικό δίκαιο",
      "Μισθώσεις / ενοίκια / αποδόσεις μισθίου",
    ]);
  });

  it("keeps selectable cities locked to the active launch set", () => {
    expect(allowedMarketplaceCityNames).toEqual([
      "Αθήνα",
      "Θεσσαλονίκη",
      "Πειραιάς",
      "Ηράκλειο",
      "Πάτρα",
    ]);
  });

  it("normalizes older inputs into the active taxonomy", () => {
    expect(normalizeLegalPracticeArea("Employment Law")).toBe("Εργατικό δίκαιο");
    expect(normalizeLegalPracticeArea("Ακίνητα & Μισθώσεις")).toBe("Μισθώσεις / ενοίκια / αποδόσεις μισθίου");
    expect(normalizeAllowedMarketplaceCity("Patras")).toBe("Πάτρα");
    expect(normalizeAllowedMarketplaceCity("Piraeus")).toBe("Πειραιάς");
  });
});
