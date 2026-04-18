import { supabase } from "@/lib/supabase";

export interface PartnerProfilePhotoReviewItem {
  id: string;
  partnerEmail: string;
  lawyerId: string;
  candidatePublicUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  status: "pending" | "approved" | "rejected" | "superseded";
  submittedAt: string;
  reviewedAt?: string;
  reviewReason?: string;
}

interface PartnerProfilePhotoSubmissionRow {
  id: string;
  partner_email: string;
  lawyer_id: string;
  candidate_public_url: string;
  file_name: string;
  mime_type: string;
  size: number;
  status: PartnerProfilePhotoReviewItem["status"];
  submitted_at: string;
  reviewed_at?: string | null;
  review_reason?: string | null;
}

const mapPhotoSubmissionRow = (row: PartnerProfilePhotoSubmissionRow): PartnerProfilePhotoReviewItem => ({
  id: row.id,
  partnerEmail: row.partner_email,
  lawyerId: row.lawyer_id,
  candidatePublicUrl: row.candidate_public_url,
  fileName: row.file_name,
  mimeType: row.mime_type,
  size: Number(row.size || 0),
  status: row.status,
  submittedAt: row.submitted_at,
  reviewedAt: row.reviewed_at || undefined,
  reviewReason: row.review_reason || undefined,
});

export const fetchPendingPartnerProfilePhotoSubmissions = async () => {
  const { data, error } = await supabase
    .from("partner_profile_photo_submissions")
    .select("id,partner_email,lawyer_id,candidate_public_url,file_name,mime_type,size,status,submitted_at,reviewed_at,review_reason")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => mapPhotoSubmissionRow(row as PartnerProfilePhotoSubmissionRow));
};

export const reviewPartnerProfilePhotoSubmission = async (
  submissionId: string,
  status: "approved" | "rejected",
  reason: string,
) => {
  const { data: userData } = await supabase.auth.getUser();
  const actorEmail = userData.user?.email || "operations";
  const { error } = await supabase.rpc("review_partner_profile_photo_submission", {
    p_submission_id: submissionId,
    p_status: status,
    p_actor_email: actorEmail,
    p_reason: reason,
  });

  if (error) throw error;
};
