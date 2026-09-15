// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const pdfGenerationQueue = require("./pdfGenerationQueue");
const storageService = require("./storage");
const {
  create,
  listForCompany,
  getById,
  complete,
  assertNotCompleted,
  uploadCrewPhoto,
  getCrewPhotoUrl,
} = require("./meetingLogs");

const MEETING_LOG_COLUMNS =
  "id, project_id, talk_id, foreman_id, company_id, crew_photo_url, final_pdf_url, completed_at, synced_at, created_at";

const dbRow = {
  id: "meeting-1",
  project_id: "project-1",
  talk_id: "talk-1",
  foreman_id: "user-1",
  company_id: "company-1",
  crew_photo_url: null,
  final_pdf_url: null,
  completed_at: null,
  synced_at: null,
  created_at: "2026-09-14T00:00:00.000Z",
};

const mappedMeetingLog = {
  id: "meeting-1",
  projectId: "project-1",
  talkId: "talk-1",
  foremanId: "user-1",
  companyId: "company-1",
  crewPhotoUrl: null,
  finalPdfUrl: null,
  completedAt: null,
  syncedAt: null,
  createdAt: "2026-09-14T00:00:00.000Z",
};

const fromSpy = vi.spyOn(supabase, "from");

describe("meetingLogs service: create", () => {
  let projectSingle;
  let projectEqCompany;
  let projectEqId;
  let projectSelect;
  let insertSingle;
  let insertSelect;
  let insertFn;

  beforeEach(() => {
    projectSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "project-1" }, error: null });
    projectEqCompany = vi.fn(() => ({ single: projectSingle }));
    projectEqId = vi.fn(() => ({ eq: projectEqCompany }));
    projectSelect = vi.fn(() => ({ eq: projectEqId }));

    insertSingle = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    insertSelect = vi.fn(() => ({ single: insertSingle }));
    insertFn = vi.fn(() => ({ select: insertSelect }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { select: projectSelect };
      if (table === "meeting_logs") return { insert: insertFn };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  const payload = {
    id: "meeting-1",
    companyId: "company-1",
    projectId: "project-1",
    talkId: "talk-1",
    foremanId: "user-1",
  };

  it("should verify the project belongs to the caller's company, insert the meeting log, and map it to camelCase", async () => {
    // Act
    const result = await create(payload);

    // Assert
    expect(projectSelect).toHaveBeenCalledWith("id");
    expect(projectEqId).toHaveBeenCalledWith("id", "project-1");
    expect(projectEqCompany).toHaveBeenCalledWith(
      "owner_company_id",
      "company-1",
    );
    expect(insertFn).toHaveBeenCalledWith({
      id: "meeting-1",
      project_id: "project-1",
      talk_id: "talk-1",
      foreman_id: "user-1",
      company_id: "company-1",
    });
    expect(insertSelect).toHaveBeenCalledWith(MEETING_LOG_COLUMNS);
    expect(result).toEqual(mappedMeetingLog);
  });

  it("should default talkId to null when omitted", async () => {
    // Act
    await create({ ...payload, talkId: undefined });

    // Assert
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ talk_id: null }),
    );
  });

  it("should throw a 404 AppError when the project doesn't exist or isn't owned by the caller's company", async () => {
    // Arrange
    projectSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });

    // Act & Assert
    await expect(create(payload)).rejects.toMatchObject({
      statusCode: 404,
      message: "Project not found",
    });
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError when the project-ownership query fails", async () => {
    // Arrange
    projectSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(create(payload)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not verify the project",
    });
  });

  it("should throw a 409 AppError when the id already exists", async () => {
    // Arrange
    insertSingle.mockResolvedValue({ data: null, error: { code: "23505" } });

    // Act & Assert
    await expect(create(payload)).rejects.toMatchObject({
      statusCode: 409,
      message: "This meeting already exists",
    });
  });

  it("should throw a 502 AppError on any other insert failure", async () => {
    // Arrange
    insertSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(create(payload)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not create the meeting",
    });
  });
});

describe("meetingLogs service: listForCompany", () => {
  let order;
  let builder;
  let select;

  beforeEach(() => {
    order = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    builder = { order };
    builder.eq = vi.fn(() => builder);
    select = vi.fn(() => builder);

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "meeting_logs") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should query every meeting log owned by the caller's company, newest first, mapped to camelCase", async () => {
    // Act
    const result = await listForCompany("company-1");

    // Assert
    expect(select).toHaveBeenCalledWith(MEETING_LOG_COLUMNS);
    expect(builder.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(builder.eq).not.toHaveBeenCalledWith(
      "project_id",
      expect.anything(),
    );
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual([mappedMeetingLog]);
  });

  it("should additionally scope by projectId when given", async () => {
    // Act
    await listForCompany("company-1", { projectId: "project-1" });

    // Assert
    expect(builder.eq).toHaveBeenCalledWith("project_id", "project-1");
  });

  it("should throw a 502 AppError when the query fails", async () => {
    // Arrange
    order.mockResolvedValue({ data: null, error: new Error("db down") });

    // Act & Assert
    await expect(listForCompany("company-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load meetings",
    });
  });
});

describe("meetingLogs service: getById", () => {
  let single;
  let eqCompany;
  let eqId;
  let select;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    eqCompany = vi.fn(() => ({ single }));
    eqId = vi.fn(() => ({ eq: eqCompany }));
    select = vi.fn(() => ({ eq: eqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "meeting_logs") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should fetch one meeting log scoped to the caller's company, mapped to camelCase", async () => {
    // Act
    const result = await getById("meeting-1", "company-1");

    // Assert
    expect(select).toHaveBeenCalledWith(MEETING_LOG_COLUMNS);
    expect(eqId).toHaveBeenCalledWith("id", "meeting-1");
    expect(eqCompany).toHaveBeenCalledWith("company_id", "company-1");
    expect(result).toEqual(mappedMeetingLog);
  });

  it("should throw a 404 AppError when no row matches the id and company", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(getById("missing", "company-1")).rejects.toMatchObject({
      statusCode: 404,
      message: "Meeting not found",
    });
  });

  it("should throw a 502 AppError on any other query failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(getById("meeting-1", "company-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load the meeting",
    });
  });
});

describe("meetingLogs service: assertNotCompleted", () => {
  let single;
  let eqCompany;
  let eqId;
  let select;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({
      data: { id: "meeting-1", talk_id: "talk-1", completed_at: null },
      error: null,
    });
    eqCompany = vi.fn(() => ({ single }));
    eqId = vi.fn(() => ({ eq: eqCompany }));
    select = vi.fn(() => ({ eq: eqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "meeting_logs") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should return the meeting's id/talkId when it exists, is owned by the caller's company, and isn't completed", async () => {
    // Act
    const result = await assertNotCompleted("meeting-1", "company-1");

    // Assert
    expect(select).toHaveBeenCalledWith("id, talk_id, completed_at");
    expect(result).toEqual({ id: "meeting-1", talkId: "talk-1" });
  });

  it("should throw a 409 AppError when the meeting is already completed", async () => {
    // Arrange
    single.mockResolvedValue({
      data: {
        id: "meeting-1",
        talk_id: "talk-1",
        completed_at: "2026-09-13T00:00:00.000Z",
      },
      error: null,
    });

    // Act & Assert
    await expect(
      assertNotCompleted("meeting-1", "company-1"),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "This meeting has already been completed and can't be changed.",
    });
  });

  it("should throw a 404 AppError when no row matches the id and company", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(
      assertNotCompleted("missing", "company-1"),
    ).rejects.toMatchObject({ statusCode: 404, message: "Meeting not found" });
  });

  it("should throw a 502 AppError on any other query failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(
      assertNotCompleted("meeting-1", "company-1"),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not verify the meeting's status",
    });
  });
});

describe("meetingLogs service: complete", () => {
  let guardSingle;
  let guardEqCompany;
  let guardEqId;
  let guardSelect;

  let sigLimit;
  let sigEq;
  let sigSelect;

  let updateSingle;
  let updateSelectAfter;
  let updateEqCompany;
  let updateEqId;
  let updateFn;

  const completedRow = { ...dbRow, completed_at: "2026-09-14T01:00:00.000Z" };
  const mappedCompleted = {
    ...mappedMeetingLog,
    completedAt: "2026-09-14T01:00:00.000Z",
  };

  beforeEach(() => {
    guardSingle = vi.fn().mockResolvedValue({
      data: { id: "meeting-1", talk_id: "talk-1", completed_at: null },
      error: null,
    });
    guardEqCompany = vi.fn(() => ({ single: guardSingle }));
    guardEqId = vi.fn(() => ({ eq: guardEqCompany }));
    guardSelect = vi.fn(() => ({ eq: guardEqId }));

    sigLimit = vi
      .fn()
      .mockResolvedValue({ data: [{ id: "sig-1" }], error: null });
    sigEq = vi.fn(() => ({ limit: sigLimit }));
    sigSelect = vi.fn(() => ({ eq: sigEq }));

    updateSingle = vi.fn().mockResolvedValue({ data: completedRow, error: null });
    updateSelectAfter = vi.fn(() => ({ single: updateSingle }));
    updateEqCompany = vi.fn(() => ({ select: updateSelectAfter }));
    updateEqId = vi.fn(() => ({ eq: updateEqCompany }));
    updateFn = vi.fn(() => ({ eq: updateEqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "meeting_logs") {
        return { select: guardSelect, update: updateFn };
      }
      if (table === "signatures") return { select: sigSelect };
      throw new Error(`Unexpected table: ${table}`);
    });

    vi.spyOn(pdfGenerationQueue, "enqueue").mockReset().mockResolvedValue(undefined);
  });

  it("should complete a meeting with >=1 signature, stamp completed_at, and enqueue PDF generation", async () => {
    // Act
    const result = await complete({ id: "meeting-1", companyId: "company-1" });

    // Assert
    expect(guardEqId).toHaveBeenCalledWith("id", "meeting-1");
    expect(guardEqCompany).toHaveBeenCalledWith("company_id", "company-1");
    expect(sigEq).toHaveBeenCalledWith("meeting_id", "meeting-1");
    expect(updateFn).toHaveBeenCalledWith({ completed_at: expect.any(String) });
    expect(updateEqId).toHaveBeenCalledWith("id", "meeting-1");
    expect(updateEqCompany).toHaveBeenCalledWith("company_id", "company-1");
    expect(pdfGenerationQueue.enqueue).toHaveBeenCalledWith("meeting-1");
    expect(result).toEqual(mappedCompleted);
  });

  it("should throw a 409 AppError when the meeting is already completed, without checking signatures", async () => {
    // Arrange
    guardSingle.mockResolvedValue({
      data: {
        id: "meeting-1",
        talk_id: "talk-1",
        completed_at: "2026-09-13T00:00:00.000Z",
      },
      error: null,
    });

    // Act & Assert
    await expect(
      complete({ id: "meeting-1", companyId: "company-1" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "This meeting has already been completed and can't be changed.",
    });
    expect(sigSelect).not.toHaveBeenCalled();
  });

  it("should throw a 404 AppError when the meeting doesn't exist or isn't owned by the caller's company", async () => {
    // Arrange
    guardSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(
      complete({ id: "meeting-1", companyId: "company-1" }),
    ).rejects.toMatchObject({ statusCode: 404, message: "Meeting not found" });
  });

  it("should throw a 409 AppError when the meeting has zero signatures, without updating meeting_logs", async () => {
    // Arrange
    sigLimit.mockResolvedValue({ data: [], error: null });

    // Act & Assert
    await expect(
      complete({ id: "meeting-1", companyId: "company-1" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "A meeting needs at least one signature before it can be completed.",
    });
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError when the signatures check fails", async () => {
    // Arrange
    sigLimit.mockResolvedValue({ data: null, error: new Error("db down") });

    // Act & Assert
    await expect(
      complete({ id: "meeting-1", companyId: "company-1" }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not verify the meeting has signatures",
    });
  });

  it("should throw a 502 AppError when the final update fails", async () => {
    // Arrange
    updateSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(
      complete({ id: "meeting-1", companyId: "company-1" }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not complete the meeting",
    });
    expect(pdfGenerationQueue.enqueue).not.toHaveBeenCalled();
  });
});

describe("meetingLogs service: uploadCrewPhoto", () => {
  let guardSingle;
  let guardEqCompany;
  let guardEqId;
  let guardSelect;

  let updateSingle;
  let updateSelectAfter;
  let updateEqCompany;
  let updateEqId;
  let updateFn;

  const photoRow = { ...dbRow, crew_photo_url: "meeting-1/photo.jpg" };
  const mappedPhoto = { ...mappedMeetingLog, crewPhotoUrl: "meeting-1/photo.jpg" };

  beforeEach(() => {
    guardSingle = vi.fn().mockResolvedValue({
      data: { id: "meeting-1", talk_id: "talk-1", completed_at: null },
      error: null,
    });
    guardEqCompany = vi.fn(() => ({ single: guardSingle }));
    guardEqId = vi.fn(() => ({ eq: guardEqCompany }));
    guardSelect = vi.fn(() => ({ eq: guardEqId }));

    updateSingle = vi.fn().mockResolvedValue({ data: photoRow, error: null });
    updateSelectAfter = vi.fn(() => ({ single: updateSingle }));
    updateEqCompany = vi.fn(() => ({ select: updateSelectAfter }));
    updateEqId = vi.fn(() => ({ eq: updateEqCompany }));
    updateFn = vi.fn(() => ({ eq: updateEqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "meeting_logs") return { select: guardSelect, update: updateFn };
      throw new Error(`Unexpected table: ${table}`);
    });

    vi.spyOn(storageService, "uploadBlob").mockReset().mockResolvedValue(undefined);
  });

  it("should confirm the meeting isn't completed, upload to its deterministic path, and persist crew_photo_url", async () => {
    // Act
    const result = await uploadCrewPhoto({
      id: "meeting-1",
      companyId: "company-1",
      buffer: Buffer.from("jpg-bytes"),
      contentType: "image/jpeg",
    });

    // Assert
    expect(guardEqId).toHaveBeenCalledWith("id", "meeting-1");
    expect(storageService.uploadBlob).toHaveBeenCalledWith(
      "crew-photos",
      "meeting-1/photo.jpg",
      Buffer.from("jpg-bytes"),
      "image/jpeg",
    );
    expect(updateFn).toHaveBeenCalledWith({ crew_photo_url: "meeting-1/photo.jpg" });
    expect(result).toEqual(mappedPhoto);
  });

  it("should throw a 409 AppError when the meeting is already completed, without uploading", async () => {
    // Arrange
    guardSingle.mockResolvedValue({
      data: {
        id: "meeting-1",
        talk_id: "talk-1",
        completed_at: "2026-09-13T00:00:00.000Z",
      },
      error: null,
    });

    // Act & Assert
    await expect(
      uploadCrewPhoto({
        id: "meeting-1",
        companyId: "company-1",
        buffer: Buffer.from("x"),
        contentType: "image/jpeg",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(storageService.uploadBlob).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError when persisting crew_photo_url fails", async () => {
    // Arrange
    updateSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(
      uploadCrewPhoto({
        id: "meeting-1",
        companyId: "company-1",
        buffer: Buffer.from("x"),
        contentType: "image/jpeg",
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not save the crew photo",
    });
  });
});

describe("meetingLogs service: getCrewPhotoUrl", () => {
  let single;
  let eqCompany;
  let eqId;
  let select;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({
      data: { ...dbRow, crew_photo_url: "meeting-1/photo.jpg" },
      error: null,
    });
    eqCompany = vi.fn(() => ({ single }));
    eqId = vi.fn(() => ({ eq: eqCompany }));
    select = vi.fn(() => ({ eq: eqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "meeting_logs") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });

    vi.spyOn(storageService, "getSignedUrl")
      .mockReset()
      .mockResolvedValue("https://signed.example/photo.jpg");
  });

  it("should return a 5-minute signed URL for an existing crew photo", async () => {
    // Act
    const url = await getCrewPhotoUrl("meeting-1", "company-1");

    // Assert
    expect(storageService.getSignedUrl).toHaveBeenCalledWith(
      "crew-photos",
      "meeting-1/photo.jpg",
      300,
    );
    expect(url).toBe("https://signed.example/photo.jpg");
  });

  it("should throw a 404 AppError when the meeting has no crew photo yet", async () => {
    // Arrange
    single.mockResolvedValue({ data: dbRow, error: null }); // crew_photo_url: null

    // Act & Assert
    await expect(getCrewPhotoUrl("meeting-1", "company-1")).rejects.toMatchObject({
      statusCode: 404,
      message: "No crew photo has been uploaded for this meeting",
    });
    expect(storageService.getSignedUrl).not.toHaveBeenCalled();
  });

  it("should propagate the meeting-not-found error", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(getCrewPhotoUrl("missing", "company-1")).rejects.toMatchObject({
      statusCode: 404,
      message: "Meeting not found",
    });
  });
});
