export interface LegalDocumentCandidate {
  name: string;
  size: number;
  type?: string;
}

export interface LegalDocumentRejection<T extends LegalDocumentCandidate = LegalDocumentCandidate> {
  file: T;
  reason: "too_large" | "unsupported_type" | "too_many_files";
  message: string;
}

export interface LegalDocumentValidationResult<T extends LegalDocumentCandidate = LegalDocumentCandidate> {
  acceptedFiles: T[];
  rejectedFiles: Array<LegalDocumentRejection<T>>;
}

const megabyte = 1024 * 1024;

export const legalDocumentPolicy = {
  maxFilesPerUpload: 8,
  maxFileSizeBytes: 15 * megabyte,
  allowedMimeTypes: new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
  ]),
  allowedExtensions: new Set(["pdf", "doc", "docx", "jpg", "jpeg", "png"]),
  acceptAttribute: ".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png",
};

const getExtension = (fileName: string) => fileName.split(".").pop()?.trim().toLowerCase() || "";

export const isAllowedLegalDocument = (file: LegalDocumentCandidate) => {
  const fileType = (file.type || "").trim().toLowerCase();
  const extension = getExtension(file.name);
  return legalDocumentPolicy.allowedMimeTypes.has(fileType) || legalDocumentPolicy.allowedExtensions.has(extension);
};

export const validateLegalDocumentUpload = <T extends LegalDocumentCandidate>(files: T[]): LegalDocumentValidationResult<T> => {
  const acceptedFiles: T[] = [];
  const rejectedFiles: Array<LegalDocumentRejection<T>> = [];

  files.forEach((file, index) => {
    if (index >= legalDocumentPolicy.maxFilesPerUpload) {
      rejectedFiles.push({
        file,
        reason: "too_many_files",
        message: `Μπορούν να ανέβουν έως ${legalDocumentPolicy.maxFilesPerUpload} αρχεία κάθε φορά.`,
      });
      return;
    }

    if (file.size > legalDocumentPolicy.maxFileSizeBytes) {
      rejectedFiles.push({
        file,
        reason: "too_large",
        message: "Το αρχείο ξεπερνά το όριο των 15 MB.",
      });
      return;
    }

    if (!isAllowedLegalDocument(file)) {
      rejectedFiles.push({
        file,
        reason: "unsupported_type",
        message: "Επιτρέπονται μόνο PDF, Word, JPG και PNG.",
      });
      return;
    }

    acceptedFiles.push(file);
  });

  return { acceptedFiles, rejectedFiles };
};

export const summarizeDocumentValidation = (result: LegalDocumentValidationResult) => {
  if (result.rejectedFiles.length === 0) return "";

  const rejectedNames = result.rejectedFiles
    .slice(0, 3)
    .map(({ file }) => file.name)
    .join(", ");
  const extraCount = result.rejectedFiles.length > 3 ? ` +${result.rejectedFiles.length - 3}` : "";

  return `Παραλείφθηκαν ${result.rejectedFiles.length} αρχεία: ${rejectedNames}${extraCount}.`;
};
