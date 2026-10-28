// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const storageService = require("./storage");
const auditLogService = require("./auditLog");
const meetingLogsService = require("./meetingLogs");
const contentSeal = require("../utility/contentSeal");
const { backfillPdfSeal } = require("./pdfSealBackfill");

process.env.MEETING_LOG_SEAL_SECRET = "test-only-seal-secret";

const pdfBytes = Buffer.from("%PDF-1.3 existing");
const photoBytes = Buffer.from("photo-bytes");
const sigBytes = Buffer.from("sig-bytes");

const baseRow = {
  id: "meeting-1",
  project_id: "project-1",
  talk_id: "talk-1",
  foreman_id: "user-1",
  company_id: "company-1",
  crew_photo_url: "meeting-1/photo.jpg",
  held_at: "2026-09-14T01:00:00.000Z",
  completed_at: "2026-09-14T01:00:00.000Z",
  sealed_at: "2026-09-14T01:00:00.000Z",
  final_pdf_url: "meeting-1/report.pdf",
  pdf_sha256: null,
  pdf_seal: null,
  blob_hashes: null,
};
const sigRows = [
  {
    id: "sig-1",
    worker_name: "Jane Doe",
    quiz_score: 3,
    quiz_passed: true,
    signature_path: "meeting-1/sig-1.png",
  },
  {
    id: "sig-2",
    worker_name: "Bob Roe",
    quiz_score: null,
    quiz_passed: null,
    signature_path: null,
  },
];

const contentSealFor = (row, signatures) =>
  contentSeal.computeSeal(
    contentSeal.buildCanonicalPayload({
      meetingLog: {
        id: row.id,
        projectId: row.project_id,
        talkId: row.talk_id,
        companyId: row.company_id,
        foremanId: row.foreman_id,
        crewPhotoUrl: row.crew_photo_url,
        heldAt: row.held_at,
        completedAt: row.completed_at,
      },
      signatures: signatures.map((s) => ({
        id: s.id,
        workerName: s.worker_name,
        quizScore: s.quiz_score,
        quizPassed: s.quiz_passed,
      })),
    }),
  );

const sealedRow = () => ({
  ...baseRow,
  content_seal: contentSealFor(baseRow, sigRows),
});

describe("pdfSealBackfill service", () => {
  let meetingSingle;
  let signaturesEq;

  beforeEach(() => {
    meetingSingle = vi.fn().mockResolvedValue({ data: sealedRow(), error: null });
    signaturesEq = vi.fn().mockResolvedValue({ data: sigRows, error: null });

    vi.spyOn(supabase, "from")
      .mockReset()
      .mockImplementation((table) => {
        if (table === "meeting_logs") {
          return { select: () => ({ eq: () => ({ single: meetingSingle }) }) };
        }
        if (table === "signatures") return { select: () => ({ eq: signaturesEq }) };
        throw new Error(`Unexpected table: ${table}`);
      });

    vi.spyOn(storageService, "downloadBlob")
      .mockReset()
      .mockImplementation(async (bucket) => {
        if (bucket === "meeting-pdfs") return pdfBytes;
        if (bucket === "crew-photos") return photoBytes;
        return sigBytes;
      });
    vi.spyOn(meetingLogsService, "setPdfSeal").mockReset().mockResolvedValue(undefined);
    vi.spyOn(auditLogService, "record").mockReset().mockResolvedValue(undefined);
  });

  it("should hash the stored PDF and images, seal them, and record a backfilled audit event", async () => {
    // Act
    const result = await backfillPdfSeal("meeting-1");

    // Assert
    const pdfSha256 = contentSeal.sha256Hex(pdfBytes);
    const blobHashes = {
      crewPhoto: contentSeal.sha256Hex(photoBytes),
      signatures: { "sig-1": contentSeal.sha256Hex(sigBytes), "sig-2": null },
    };
    expect(result).toEqual({ status: "backfilled", pdfSha256 });
    expect(meetingLogsService.setPdfSeal).toHaveBeenCalledWith("meeting-1", "company-1", {
      pdfSha256,
      pdfSeal: contentSeal.computePdfSeal(
        contentSeal.buildPdfPayload({ id: "meeting-1", pdfSha256, blobHashes }),
      ),
      blobHashes,
    });
    expect(auditLogService.record).toHaveBeenCalledWith({
      meetingLogId: "meeting-1",
      eventType: "pdf_generated",
      metadata: { path: "meeting-1/report.pdf", sha256: pdfSha256, backfilled: true },
    });
  });

  it("should record a null crew photo hash when the meeting has no crew photo", async () => {
    // Arrange
    const row = { ...baseRow, crew_photo_url: null };
    meetingSingle.mockResolvedValue({
      data: { ...row, content_seal: contentSealFor(row, sigRows) },
      error: null,
    });

    // Act
    await backfillPdfSeal("meeting-1");

    // Assert
    expect(meetingLogsService.setPdfSeal.mock.calls[0][2].blobHashes.crewPhoto).toBeNull();
  });

  it.each([
    ["an unfinished meeting", { completed_at: null }, "not sealed"],
    ["a meeting with no content seal", { content_seal: null }, "not sealed"],
    ["a meeting with no PDF", { final_pdf_url: null }, "no PDF in Storage"],
    ["a meeting already PDF-sealed", { pdf_seal: "abc" }, "already has a PDF seal"],
  ])("should skip %s without touching Storage", async (_label, patch, reason) => {
    // Arrange
    meetingSingle.mockResolvedValue({ data: { ...sealedRow(), ...patch }, error: null });

    // Act
    const result = await backfillPdfSeal("meeting-1");

    // Assert
    expect(result).toEqual({ status: "skipped", reason });
    expect(storageService.downloadBlob).not.toHaveBeenCalled();
    expect(meetingLogsService.setPdfSeal).not.toHaveBeenCalled();
  });

  it("should refuse to vouch for a meeting whose content seal already fails", async () => {
    // Arrange
    meetingSingle.mockResolvedValue({
      data: { ...sealedRow(), talk_id: "talk-tampered" },
      error: null,
    });

    // Act
    const result = await backfillPdfSeal("meeting-1");

    // Assert
    expect(result).toEqual({ status: "skipped", reason: "content seal does not verify" });
    expect(meetingLogsService.setPdfSeal).not.toHaveBeenCalled();
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it("should propagate a Storage failure instead of sealing a missing image as null", async () => {
    // Arrange
    storageService.downloadBlob.mockImplementation(async (bucket) => {
      if (bucket === "signatures") throw new Error("storage down");
      return pdfBytes;
    });

    // Act + Assert
    await expect(backfillPdfSeal("meeting-1")).rejects.toThrow("storage down");
    expect(meetingLogsService.setPdfSeal).not.toHaveBeenCalled();
  });

  it("should throw 404 when the meeting does not exist", async () => {
    // Arrange
    meetingSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act + Assert
    await expect(backfillPdfSeal("meeting-1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("should throw 502 when the meeting lookup fails", async () => {
    // Arrange
    meetingSingle.mockResolvedValue({ data: null, error: { code: "XX000" } });

    // Act + Assert
    await expect(backfillPdfSeal("meeting-1")).rejects.toMatchObject({ statusCode: 502 });
  });
});
