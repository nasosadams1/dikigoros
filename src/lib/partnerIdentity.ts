import { fetchPartnerWorkspace, getPartnerWorkspace } from "@/lib/partnerWorkspace";

const normalizeLawyerId = (value?: string | null) => value?.trim().toLowerCase() || "";

export const areLawyerIdsEqual = (left?: string | null, right?: string | null) =>
  Boolean(normalizeLawyerId(left) && normalizeLawyerId(left) === normalizeLawyerId(right));

export const getStoredPartnerLawyerId = (email?: string | null) => {
  if (!email) return null;
  return getPartnerWorkspace(email).profile.lawyerId || null;
};

export const fetchPartnerLawyerId = async (email?: string | null) => {
  if (!email) return null;
  try {
    const workspace = await fetchPartnerWorkspace(email);
    return workspace.profile.lawyerId || null;
  } catch {
    return null;
  }
};
