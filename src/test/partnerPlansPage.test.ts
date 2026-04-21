import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { partnerPlans } from "@/lib/level4Marketplace";

const plansPageSource = readFileSync(join(process.cwd(), "src", "pages", "ForLawyersPlans.tsx"), "utf8");

describe("partner plans page copy", () => {
  it("shows the final Greek partner pricing model", () => {
    [
      "€0 / μήνα",
      "Η χρέωση €7",
      "${formatEuro(plan.completedConsultationFee)} ανά ολοκληρωμένη πρώτη συμβουλευτική",
      "από ${formatEuro(plan.monthlyPrice)} / μήνα",
      "${formatEuro(plan.annualMonthlyPrice)} / μήνα ετησίως",
      "Έως ${plan.includedSeats} δικηγόροι",
      "+${formatEuro(plan.extraSeatMonthlyPrice)} / μήνα ανά επιπλέον δικηγόρο",
      "Πιο δημοφιλές",
      "Επικοινωνήστε για πολλές πόλεις ή προσαρμοσμένη εγκατάσταση.",
    ].forEach((copy) => expect(plansPageSource).toContain(copy));

    expect(partnerPlans.find((plan) => plan.id === "pro")).toMatchObject({
      monthlyPrice: 29,
      annualMonthlyPrice: 23,
    });
    expect(partnerPlans.find((plan) => plan.id === "premium")).toMatchObject({
      monthlyPrice: 99.99,
      annualMonthlyPrice: 83.99,
    });
  });

  it("keeps Basic and team plans out of subscription checkout", () => {
    expect(plansPageSource).toContain("plan.salesOnly");
    expect(plansPageSource).toContain("Το Βασικό πλάνο δεν έχει συνδρομή");
    expect(plansPageSource).toContain("Δεν ανοίγει άμεση πληρωμή στην πρώτη έκδοση.");
    expect(plansPageSource).not.toContain("Ετήσιο σύνολο");
  });
});
