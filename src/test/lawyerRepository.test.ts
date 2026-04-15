import { describe, expect, it } from "vitest";
import { lawyers, type Lawyer } from "@/data/lawyers";
import { getPublicLawyerProfileReadiness, isPublicLawyerProfileReady } from "@/lib/lawyerRepository";
import { applyPartnerWorkspaceToLawyer, defaultPartnerWorkspace } from "@/lib/partnerWorkspace";

const buildInvalidLawyer = (): Lawyer => ({
  ...lawyers[0],
  id: "draft-lawyer",
  name: "asdsadas",
  specialty: "Εργατικό Δίκαιο",
  bestFor: "Legal consultation",
  city: "Athina",
  experience: 0,
  price: 0,
  bio: "short bio",
  education: "",
  languages: ["Ελληνικά"],
  credentials: [],
  consultations: [
    {
      mode: "video",
      type: "Βιντεοκλήση",
      price: 0,
      duration: "30 λεπτά",
      desc: "Legal consultation",
    },
  ],
});

const buildPartnerReadyLawyer = (): Lawyer => ({
  ...lawyers[0],
  id: "partner-ready-lawyer",
  name: "Alexandros Example",
  specialty: "Employment Law",
  specialtyShort: "Employment",
  bestFor: "",
  city: "Athens",
  experience: 8,
  price: 70,
  bio: "Employment lawyer focused on contract reviews, dismissals, severance claims, and practical next steps for employees and small businesses across Greece.",
  education: "",
  languages: ["Greek", "English"],
  credentials: [],
  consultationModes: ["video", "phone"],
  consultations: [
    {
      mode: "video",
      type: "Video consultation",
      price: 70,
      duration: "30 minutes",
      desc: "Athens and online consultations for employment disputes, contract reviews, and urgent workplace issues.",
    },
    {
      mode: "phone",
      type: "Phone consultation",
      price: 60,
      duration: "30 minutes",
      desc: "Phone advice for dismissals, unpaid wages, and immediate strategy planning.",
    },
  ],
});

describe("public lawyer profile readiness", () => {
  it("keeps production-ready fallback lawyers public", () => {
    expect(isPublicLawyerProfileReady(lawyers[0])).toBe(true);
  });

  it("keeps partner-published profiles public without legacy education fields", () => {
    expect(isPublicLawyerProfileReady(buildPartnerReadyLawyer())).toBe(true);
  });

  it("lets partner-editable profile fields make a lawyer search-ready", () => {
    const baseLawyer = buildInvalidLawyer();
    const partnerLawyer = applyPartnerWorkspaceToLawyer(baseLawyer, {
      ...defaultPartnerWorkspace,
      profile: {
        ...defaultPartnerWorkspace.profile,
        displayName: "Alexandros Example",
        primarySpecialty: "Employment Law",
        bestFor: "Dismissals, workplace disputes, and contract reviews for employees and small businesses.",
        city: "Athens",
        bio: "Employment lawyer focused on dismissals, unpaid wages, contract reviews, and practical next steps for employees and small businesses across Greece.",
        experienceYears: 8,
        specialties: ["Employment Law", "Dismissals", "Contract Reviews"],
        languages: ["Greek", "English"],
        consultationModes: ["video"],
        videoPrice: 70,
        videoDescription: "Video consultation for dismissals, severance, unpaid wages, and contract reviews across Greece.",
      },
    });

    expect(getPublicLawyerProfileReadiness(partnerLawyer).ready).toBe(true);
  });

  it("hides incomplete placeholder profiles from public listings", () => {
    expect(isPublicLawyerProfileReady(buildInvalidLawyer())).toBe(false);
  });
});
