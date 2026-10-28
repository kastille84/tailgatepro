// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const storageService = require("./storage");
const auditLogService = require("./auditLog");
const contentSeal = require("../utility/contentSeal");
const { verifyRecord, verifyFile } = require("./publicVerify");

process.env.MEETING_LOG_SEAL_SECRET = "test-only-seal-secret";

const photoBytes = Buffer.from("photo-bytes");
const sigBytes = Buffer.from("sig-bytes");
const pdfSha256 = contentSeal.sha256Hex(Buffer.from("%PDF-1.3 original"));
const blobHashes = {
  crewPhoto: contentSeal.sha256Hex(photoBytes),
  signatures: { "sig-1": contentSeal.sha256Hex(sigBytes) },
};

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
};
const sigRows = [
  {
    id: "sig-1",
    worker_name: "Jane Doe",
    quiz_score: 3,
    quiz_passed: true,
    signature_path: "meeting-1/sig-1.png",
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
  pdf_sha256: pdfSha256,
  pdf_seal: contentSeal.computePdfSeal(
    contentSeal.buildPdfPayload({ id: "meeting-1", pdfSha256, blobHashes }),
  ),
  blob_hashes: blobHashes,
});

describe("publicVerify service", () => {
  let meetingSingle;
  let signaturesEq;
  let auditEq2;
  let auditHashes;
  let fromSpy;

  beforeEach(() => {
    meetingSingle = vi.fn().mockResolvedValue({ data: sealedRow(), error: null });
    signaturesEq = vi.fn().mockResolvedValue({ data: sigRows, error: null });
    auditHashes = [{ metadata: { sha256: pdfSha256 } }];
    auditEq2 = vi.fn(() => Promise.resolve({ data: auditHashes, error: null }));

    fromSpy = vi.spyOn(supabase, "from").mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "meeting_logs") {
        return { select: () => ({ eq: () => ({ single: meetingSingle }) }) };
      }
      if (table === "signatures") return { select: () => ({ eq: signaturesEq }) };
      if (table === "meeting_log_audit_events") {
        return { select: () => ({ eq: () => ({ eq: auditEq2 }) }) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    vi.spyOn(storageService, "downloadBlob")
      .mockReset()
      .mockImplementation(async (bucket) =>
        bucket === "crew-photos" ? photoBytes : sigBytes,
      );
    vi.spyOn(auditLogService, "record").mockReset().mockResolvedValue(undefined);
  });

  describe("verifyRecord", () => {
    it("should report valid and audit it as a public check when records and images are untouched", async () => {
      // Act
      const result = await verifyRecord("meeting-1");

      // Assert
      expect(result).toEqual({
        sealed: true,
        valid: true,
        sealedAt: "2026-09-14T01:00:00.000Z",
        fileFingerprint: true,
        imageMismatchCount: 0,
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        meetingLogId: "meeting-1",
        eventType: "seal_verified",
        actorId: null,
        metadata: { valid: true, via: "public", imageMismatchCount: 0 },
      });
    });

    it("should report invalid when a DB field changed after sealing", async () => {
      // Arrange
      meetingSingle.mockResolvedValue({
        data: { ...sealedRow(), talk_id: "talk-tampered" },
        error: null,
      });

      // Act
      const result = await verifyRecord("meeting-1");

      // Assert
      expect(result.valid).toBe(false);
    });

    it("should count a swapped signature image and report invalid", async () => {
      // Arrange — Storage now returns different bytes for the signature
      storageService.downloadBlob.mockImplementation(async (bucket) =>
        bucket === "crew-photos" ? photoBytes : Buffer.from("swapped"),
      );

      // Act
      const result = await verifyRecord("meeting-1");

      // Assert
      expect(result.valid).toBe(false);
      expect(result.imageMismatchCount).toBe(1);
    });

    it("should count a swapped crew photo and report invalid", async () => {
      // Arrange
      storageService.downloadBlob.mockImplementation(async (bucket) =>
        bucket === "crew-photos" ? Buffer.from("swapped") : sigBytes,
      );

      // Act
      const result = await verifyRecord("meeting-1");

      // Assert
      expect(result.valid).toBe(false);
      expect(result.imageMismatchCount).toBe(1);
    });

    it("should report invalid when the stored pdf fingerprint no longer matches its HMAC", async () => {
      // Arrange — a DB-only writer edited pdf_sha256 without the secret
      meetingSingle.mockResolvedValue({
        data: { ...sealedRow(), pdf_sha256: contentSeal.sha256Hex(Buffer.from("x")) },
        error: null,
      });

      // Act
      const result = await verifyRecord("meeting-1");

      // Assert
      expect(result.valid).toBe(false);
    });

    it("should skip blobs sealed as null and never download them", async () => {
      // Arrange — the crew photo failed to download at render time
      const hashes = { ...blobHashes, crewPhoto: null };
      meetingSingle.mockResolvedValue({
        data: {
          ...sealedRow(),
          blob_hashes: hashes,
          pdf_seal: contentSeal.computePdfSeal(
            contentSeal.buildPdfPayload({ id: "meeting-1", pdfSha256, blobHashes: hashes }),
          ),
        },
        error: null,
      });

      // Act
      const result = await verifyRecord("meeting-1");

      // Assert
      expect(result.valid).toBe(true);
      expect(storageService.downloadBlob).not.toHaveBeenCalledWith(
        "crew-photos",
        expect.anything(),
      );
    });

    it("should report no file fingerprint, and make no storage calls, for a meeting sealed before the PDF seal shipped", async () => {
      // Arrange
      meetingSingle.mockResolvedValue({
        data: { ...sealedRow(), pdf_sha256: null, pdf_seal: null, blob_hashes: null },
        error: null,
      });

      // Act
      const result = await verifyRecord("meeting-1");

      // Assert
      expect(result.valid).toBe(true);
      expect(result.fileFingerprint).toBe(false);
      expect(storageService.downloadBlob).not.toHaveBeenCalled();
    });

    it("should propagate a storage failure instead of reporting tampering", async () => {
      // Arrange
      storageService.downloadBlob.mockRejectedValue(new Error("storage down"));

      // Act & Assert
      await expect(verifyRecord("meeting-1")).rejects.toThrow("storage down");
    });

    it("should 404 for an unknown meeting, an in-progress meeting and an unsealed meeting", async () => {
      // Arrange & Act & Assert
      meetingSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
      await expect(verifyRecord("meeting-1")).rejects.toMatchObject({ statusCode: 404 });

      meetingSingle.mockResolvedValueOnce({
        data: { ...sealedRow(), completed_at: null },
        error: null,
      });
      await expect(verifyRecord("meeting-1")).rejects.toMatchObject({ statusCode: 404 });

      meetingSingle.mockResolvedValueOnce({
        data: { ...sealedRow(), content_seal: null },
        error: null,
      });
      await expect(verifyRecord("meeting-1")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should 502 when the meeting or its signatures can't be read", async () => {
      // Arrange & Act & Assert
      meetingSingle.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
      await expect(verifyRecord("meeting-1")).rejects.toMatchObject({ statusCode: 502 });

      signaturesEq.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
      await expect(verifyRecord("meeting-1")).rejects.toMatchObject({ statusCode: 502 });
    });
  });

  describe("verifyFile", () => {
    it("should return current when the hash matches the latest render", async () => {
      // Act
      const result = await verifyFile("meeting-1", pdfSha256);

      // Assert
      expect(result).toEqual({ matches: true, status: "current" });
      expect(auditLogService.record).toHaveBeenCalledWith({
        meetingLogId: "meeting-1",
        eventType: "seal_verified",
        actorId: null,
        metadata: { valid: true, via: "public", file: true, status: "current" },
      });
    });

    it("should return superseded when the hash matches an earlier render only", async () => {
      // Arrange
      const older = contentSeal.sha256Hex(Buffer.from("%PDF-1.3 older"));
      auditHashes.push({ metadata: { sha256: older } }, { metadata: {} });

      // Act
      const result = await verifyFile("meeting-1", older);

      // Assert
      expect(result).toEqual({ matches: true, status: "superseded" });
    });

    it("should return no-match for an edited file", async () => {
      // Act
      const result = await verifyFile(
        "meeting-1",
        contentSeal.sha256Hex(Buffer.from("%PDF-1.3 edited in acrobat")),
      );

      // Assert
      expect(result).toEqual({ matches: false, status: "no-match" });
    });

    it("should return record-altered when the stored fingerprint fails its HMAC", async () => {
      // Arrange
      meetingSingle.mockResolvedValue({
        data: { ...sealedRow(), pdf_sha256: contentSeal.sha256Hex(Buffer.from("x")) },
        error: null,
      });

      // Act
      const result = await verifyFile("meeting-1", pdfSha256);

      // Assert
      expect(result).toEqual({ matches: false, status: "record-altered" });
    });

    it("should 404 when the meeting has no file fingerprint on record", async () => {
      // Arrange
      meetingSingle.mockResolvedValue({
        data: { ...sealedRow(), pdf_sha256: null, pdf_seal: null, blob_hashes: null },
        error: null,
      });

      // Act & Assert
      await expect(verifyFile("meeting-1", pdfSha256)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should 502 when the render history can't be read", async () => {
      // Arrange
      auditEq2.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });

      // Act & Assert
      await expect(
        verifyFile("meeting-1", contentSeal.sha256Hex(Buffer.from("other"))),
      ).rejects.toMatchObject({ statusCode: 502 });
    });
  });
});
