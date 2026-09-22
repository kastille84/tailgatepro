// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
// Every dependency is a sibling service (or pdfGeneration.js's pure
// renderer), spied on directly rather than mocking Supabase — same pattern
// meetingLogs.test.js already uses for storageService/pdfGenerationQueue.
const meetingLogsService = require("./meetingLogs");
const projectsService = require("./projects");
const talksService = require("./talks");
const signaturesService = require("./signatures");
const storageService = require("./storage");
const companiesService = require("./companies");
const usersService = require("./users");
const pdfGeneration = require("./pdfGeneration");
const emailService = require("./email");
const { enqueue } = require("./pdfGenerationQueue");

const meetingLog = {
  id: "meeting-1",
  projectId: "project-1",
  talkId: "talk-1",
  foremanId: "user-1",
  companyId: "company-1",
  crewPhotoUrl: "meeting-1/photo.jpg",
  finalPdfUrl: null,
  completedAt: "2026-09-14T01:00:00.000Z",
  // Held the previous evening, synced/completed after midnight UTC — distinct
  // from completedAt so the tests below can prove which one is used.
  heldAt: "2026-09-13T22:30:00.000Z",
  syncedAt: null,
  createdAt: "2026-09-14T00:00:00.000Z",
};

const project = {
  id: "project-1",
  ownerCompanyId: "company-1",
  name: "Downtown Highrise",
  gcCompanyId: null,
  gcNameCustom: "Acme GC",
  gcContactEmail: null,
  status: "active",
  archivedAt: null,
  createdAt: "2026-09-09T00:00:00.000Z",
};

const talk = {
  id: "talk-1",
  slug: "fall-protection",
  title: "Fall Protection",
  tradeTag: "roofing",
  tradeTags: ["roofing"],
  content: "...",
  structured: { summary: "...", talking_points: [] },
  attribution: null,
  quiz: null,
  translations: null,
  isGlobal: true,
  companyId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
};

const company = {
  id: "company-1",
  name: "Acme Roofing",
  companyType: "subcontractor",
  tier: "basic",
  logoPath: null,
};

const companyWithLogo = {
  ...company,
  tier: "premium",
  logoPath: "company-1/logo",
};

const signatures = [
  {
    id: "sig-1",
    meetingId: "meeting-1",
    workerName: "Jane Doe",
    signaturePath: "meeting-1/sig-1.png",
    quizPassed: true,
    quizScore: 3,
    quizAnswers: [],
    createdAt: "2026-09-14T00:30:00.000Z",
  },
];

const pdfBuffer = Buffer.from("%PDF-1.3\n...");

// Distinguishes crew-photo vs. signature downloads by bucket/path so
// assertions can tell them apart, rather than one shared buffer for both.
const downloadBlobImpl = async (bucket, path) => {
  if (bucket === "crew-photos") return Buffer.from("photo-bytes");
  if (bucket === "signatures") return Buffer.from(`sig-bytes:${path}`);
  if (bucket === "company-logos") return Buffer.from("logo-bytes");
  throw new Error(`Unexpected bucket: ${bucket}`);
};

describe("pdfGenerationQueue: enqueue", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.spyOn(meetingLogsService, "getById").mockReset().mockResolvedValue(meetingLog);
    vi.spyOn(meetingLogsService, "pdfPath")
      .mockReset()
      .mockReturnValue("meeting-1/report.pdf");
    vi.spyOn(meetingLogsService, "setFinalPdfUrl").mockReset().mockResolvedValue(undefined);
    vi.spyOn(projectsService, "getById").mockReset().mockResolvedValue(project);
    vi.spyOn(talksService, "getById").mockReset().mockResolvedValue(talk);
    vi.spyOn(signaturesService, "listForMeeting").mockReset().mockResolvedValue(signatures);
    vi.spyOn(companiesService, "getById").mockReset().mockResolvedValue(company);
    vi.spyOn(usersService, "getAdminEmail").mockReset().mockResolvedValue(null);
    vi.spyOn(storageService, "downloadBlob").mockReset().mockImplementation(downloadBlobImpl);
    vi.spyOn(storageService, "uploadBlob").mockReset().mockResolvedValue(undefined);
    vi.spyOn(storageService, "getSignedUrl")
      .mockReset()
      .mockResolvedValue("https://signed.example/report.pdf");
    vi.spyOn(pdfGeneration, "renderMeetingLogPdf").mockReset().mockResolvedValue(pdfBuffer);
    vi.spyOn(emailService, "sendMeetingLogEmail").mockReset().mockResolvedValue(undefined);

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should fetch every input (including the company and each signature's image), render the PDF, upload it, and persist its path", async () => {
    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(meetingLogsService.getById).toHaveBeenCalledWith("meeting-1", "company-1");
    expect(projectsService.getById).toHaveBeenCalledWith("project-1", "company-1");
    expect(talksService.getById).toHaveBeenCalledWith("talk-1", "company-1");
    expect(signaturesService.listForMeeting).toHaveBeenCalledWith(
      "meeting-1",
      "company-1",
    );
    expect(companiesService.getById).toHaveBeenCalledWith("company-1");
    expect(storageService.downloadBlob).toHaveBeenCalledWith(
      "crew-photos",
      "meeting-1/photo.jpg",
    );
    expect(storageService.downloadBlob).toHaveBeenCalledWith(
      "signatures",
      "meeting-1/sig-1.png",
    );
    expect(pdfGeneration.renderMeetingLogPdf).toHaveBeenCalledWith({
      meetingLog,
      project,
      talk,
      signatures: [
        { ...signatures[0], imageBuffer: Buffer.from("sig-bytes:meeting-1/sig-1.png") },
      ],
      crewPhotoBuffer: Buffer.from("photo-bytes"),
      company,
      logoBuffer: null,
    });
    expect(storageService.uploadBlob).toHaveBeenCalledWith(
      "meeting-pdfs",
      "meeting-1/report.pdf",
      pdfBuffer,
      "application/pdf",
    );
    expect(meetingLogsService.setFinalPdfUrl).toHaveBeenCalledWith(
      "meeting-1",
      "company-1",
      "meeting-1/report.pdf",
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should not build a signed URL or send an email when the project is unlinked and has no gc_contact_email", async () => {
    // Act — the default fixture project has gcCompanyId: null, gcContactEmail: null
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(usersService.getAdminEmail).not.toHaveBeenCalled();
    expect(storageService.getSignedUrl).not.toHaveBeenCalled();
    expect(emailService.sendMeetingLogEmail).not.toHaveBeenCalled();
  });

  it("should build a signed URL and email the GC contact when the project has a gc_contact_email", async () => {
    // Arrange
    projectsService.getById.mockResolvedValue({ ...project, gcContactEmail: "gc@example.com" });

    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    // The filename carries the date the meeting was held (2026-09-13), not the
    // server-receipt date (2026-09-14).
    expect(storageService.getSignedUrl).toHaveBeenCalledWith(
      "meeting-pdfs",
      "meeting-1/report.pdf",
      60 * 60 * 24 * 30,
      expect.stringContaining("2026-09-13"),
    );
    expect(emailService.sendMeetingLogEmail).toHaveBeenCalledWith({
      to: "gc@example.com",
      projectName: project.name,
      companyName: company.name,
      pdfUrl: "https://signed.example/report.pdf",
      meetingDate: meetingLog.heldAt,
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should email the linked GC company's admin (Phase 8b) instead of gc_contact_email when both resolve", async () => {
    // Arrange
    projectsService.getById.mockResolvedValue({
      ...project,
      gcCompanyId: "gc-company-1",
      gcContactEmail: "stale-manual@example.com",
    });
    usersService.getAdminEmail.mockResolvedValue("gc-admin@example.com");

    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(usersService.getAdminEmail).toHaveBeenCalledWith("gc-company-1");
    expect(emailService.sendMeetingLogEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "gc-admin@example.com" }),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should fall back to gc_contact_email when the project is linked but the GC company has no admin yet", async () => {
    // Arrange
    projectsService.getById.mockResolvedValue({
      ...project,
      gcCompanyId: "gc-company-1",
      gcContactEmail: "fallback@example.com",
    });
    usersService.getAdminEmail.mockResolvedValue(null);

    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(emailService.sendMeetingLogEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "fallback@example.com" }),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should fall back to gc_contact_email, logging the error, when resolving the linked GC's admin email fails", async () => {
    // Arrange
    projectsService.getById.mockResolvedValue({
      ...project,
      gcCompanyId: "gc-company-1",
      gcContactEmail: "fallback@example.com",
    });
    usersService.getAdminEmail.mockRejectedValue(new Error("boom"));

    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(emailService.sendMeetingLogEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "fallback@example.com" }),
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should skip the email entirely when the project is linked with no admin and has no gc_contact_email either", async () => {
    // Arrange
    projectsService.getById.mockResolvedValue({
      ...project,
      gcCompanyId: "gc-company-1",
      gcContactEmail: null,
    });
    usersService.getAdminEmail.mockResolvedValue(null);

    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(storageService.getSignedUrl).not.toHaveBeenCalled();
    expect(emailService.sendMeetingLogEmail).not.toHaveBeenCalled();
  });

  it("should pass talk: null and skip fetching a talk when the meeting has none attached", async () => {
    // Arrange
    meetingLogsService.getById.mockResolvedValue({ ...meetingLog, talkId: null });

    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(talksService.getById).not.toHaveBeenCalled();
    expect(pdfGeneration.renderMeetingLogPdf).toHaveBeenCalledWith(
      expect.objectContaining({ talk: null }),
    );
  });

  it("should pass crewPhotoBuffer: null and skip downloading when the meeting has no crew photo", async () => {
    // Arrange
    meetingLogsService.getById.mockResolvedValue({ ...meetingLog, crewPhotoUrl: null });

    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(storageService.downloadBlob).not.toHaveBeenCalledWith(
      "crew-photos",
      expect.anything(),
    );
    expect(pdfGeneration.renderMeetingLogPdf).toHaveBeenCalledWith(
      expect.objectContaining({ crewPhotoBuffer: null }),
    );
  });

  it("should still generate and upload the PDF when the crew-photo download fails", async () => {
    // Arrange
    storageService.downloadBlob.mockImplementation(async (bucket, path) => {
      if (bucket === "crew-photos") throw new Error("not found");
      return downloadBlobImpl(bucket, path);
    });

    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(pdfGeneration.renderMeetingLogPdf).toHaveBeenCalledWith(
      expect.objectContaining({ crewPhotoBuffer: null }),
    );
    expect(storageService.uploadBlob).toHaveBeenCalled();
    expect(meetingLogsService.setFinalPdfUrl).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should download and pass through the company logo when the company has one uploaded", async () => {
    // Arrange
    companiesService.getById.mockResolvedValue(companyWithLogo);

    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(storageService.downloadBlob).toHaveBeenCalledWith(
      "company-logos",
      "company-1/logo",
    );
    expect(pdfGeneration.renderMeetingLogPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        company: companyWithLogo,
        logoBuffer: Buffer.from("logo-bytes"),
      }),
    );
  });

  it("should not attempt a logo download when the company has no logoPath", async () => {
    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(storageService.downloadBlob).not.toHaveBeenCalledWith(
      "company-logos",
      expect.anything(),
    );
    expect(pdfGeneration.renderMeetingLogPdf).toHaveBeenCalledWith(
      expect.objectContaining({ logoBuffer: null }),
    );
  });

  it("should still generate and upload the PDF when the logo download fails", async () => {
    // Arrange
    companiesService.getById.mockResolvedValue(companyWithLogo);
    storageService.downloadBlob.mockImplementation(async (bucket, path) => {
      if (bucket === "company-logos") throw new Error("not found");
      return downloadBlobImpl(bucket, path);
    });

    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(pdfGeneration.renderMeetingLogPdf).toHaveBeenCalledWith(
      expect.objectContaining({ logoBuffer: null }),
    );
    expect(storageService.uploadBlob).toHaveBeenCalled();
    expect(meetingLogsService.setFinalPdfUrl).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should still generate the PDF when one signature's image fails to download, without affecting the others", async () => {
    // Arrange
    const secondSignature = {
      id: "sig-2",
      meetingId: "meeting-1",
      workerName: "John Smith",
      signaturePath: "meeting-1/sig-2.png",
      quizPassed: false,
      quizScore: 1,
      quizAnswers: [],
      createdAt: "2026-09-14T00:31:00.000Z",
    };
    signaturesService.listForMeeting.mockResolvedValue([signatures[0], secondSignature]);
    storageService.downloadBlob.mockImplementation(async (bucket, path) => {
      if (bucket === "signatures" && path === "meeting-1/sig-2.png") {
        throw new Error("not found");
      }
      return downloadBlobImpl(bucket, path);
    });

    // Act
    await enqueue("meeting-1", "company-1");

    // Assert
    expect(pdfGeneration.renderMeetingLogPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        signatures: [
          { ...signatures[0], imageBuffer: Buffer.from("sig-bytes:meeting-1/sig-1.png") },
          { ...secondSignature, imageBuffer: null },
        ],
      }),
    );
    expect(storageService.uploadBlob).toHaveBeenCalled();
    expect(meetingLogsService.setFinalPdfUrl).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it.each([
    ["meetingLogsService.getById", () => meetingLogsService.getById.mockRejectedValue(new Error("boom"))],
    ["projectsService.getById", () => projectsService.getById.mockRejectedValue(new Error("boom"))],
    ["talksService.getById", () => talksService.getById.mockRejectedValue(new Error("boom"))],
    [
      "signaturesService.listForMeeting",
      () => signaturesService.listForMeeting.mockRejectedValue(new Error("boom")),
    ],
    [
      "companiesService.getById",
      () => companiesService.getById.mockRejectedValue(new Error("boom")),
    ],
    [
      "pdfGeneration.renderMeetingLogPdf",
      () => pdfGeneration.renderMeetingLogPdf.mockRejectedValue(new Error("boom")),
    ],
    ["storageService.uploadBlob", () => storageService.uploadBlob.mockRejectedValue(new Error("boom"))],
    [
      "meetingLogsService.setFinalPdfUrl",
      () => meetingLogsService.setFinalPdfUrl.mockRejectedValue(new Error("boom")),
    ],
    [
      "storageService.getSignedUrl",
      () => {
        projectsService.getById.mockResolvedValue({ ...project, gcContactEmail: "gc@example.com" });
        storageService.getSignedUrl.mockRejectedValue(new Error("boom"));
      },
    ],
    [
      "emailService.sendMeetingLogEmail",
      () => {
        projectsService.getById.mockResolvedValue({ ...project, gcContactEmail: "gc@example.com" });
        emailService.sendMeetingLogEmail.mockRejectedValue(new Error("boom"));
      },
    ],
  ])("should never throw when %s fails — it catches and logs instead", async (_label, arrange) => {
    // Arrange
    arrange();

    // Act & Assert
    await expect(enqueue("meeting-1", "company-1")).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
