import { describe, expect, it } from "vitest";
import { legalDocumentPolicy, summarizeDocumentValidation, validateLegalDocumentUpload } from "@/lib/documentPolicy";

const file = (name: string, size: number, type = "") => ({ name, size, type });

describe("legal document policy", () => {
  it("accepts only supported legal document formats", () => {
    const result = validateLegalDocumentUpload([
      file("contract.pdf", 1024, "application/pdf"),
      file("scan.png", 2048, "image/png"),
      file("script.exe", 512, "application/x-msdownload"),
    ]);

    expect(result.acceptedFiles.map((item) => item.name)).toEqual(["contract.pdf", "scan.png"]);
    expect(result.rejectedFiles[0]).toMatchObject({
      reason: "unsupported_type",
      file: { name: "script.exe" },
    });
  });

  it("rejects oversized documents before upload", () => {
    const result = validateLegalDocumentUpload([
      file("large.pdf", legalDocumentPolicy.maxFileSizeBytes + 1, "application/pdf"),
    ]);

    expect(result.acceptedFiles).toHaveLength(0);
    expect(result.rejectedFiles[0]?.reason).toBe("too_large");
  });

  it("limits the number of files per upload batch", () => {
    const result = validateLegalDocumentUpload(
      Array.from({ length: legalDocumentPolicy.maxFilesPerUpload + 1 }, (_, index) =>
        file(`doc-${index}.pdf`, 512, "application/pdf"),
      ),
    );

    expect(result.acceptedFiles).toHaveLength(legalDocumentPolicy.maxFilesPerUpload);
    expect(result.rejectedFiles[0]?.reason).toBe("too_many_files");
  });

  it("summarizes rejected files without dumping the whole batch", () => {
    const result = validateLegalDocumentUpload([
      file("one.exe", 512, "application/x-msdownload"),
      file("two.exe", 512, "application/x-msdownload"),
      file("three.exe", 512, "application/x-msdownload"),
      file("four.exe", 512, "application/x-msdownload"),
    ]);

    expect(summarizeDocumentValidation(result)).toContain("+1");
  });
});
