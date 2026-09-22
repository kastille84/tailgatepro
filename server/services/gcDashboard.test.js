// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const companiesService = require("./companies");
const storageService = require("./storage");
const {
  assertGcLinkedProject,
  getOverview,
  listMeetings,
  getMeeting,
  getMeetingPdfUrl,
} = require("./gcDashboard");

const PROJECT_COLUMNS = "id, owner_company_id, name, status, archived_at, created_at";

const fromSpy = vi.spyOn(supabase, "from");

describe("gcDashboard service: assertGcLinkedProject", () => {
  let single;
  let eqGc;
  let eqId;
  let select;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({
      data: {
        id: "project-1",
        owner_company_id: "sub-1",
        name: "Riverside Tower",
        status: "active",
        archived_at: null,
        created_at: "2026-09-01T00:00:00.000Z",
      },
      error: null,
    });
    eqGc = vi.fn(() => ({ single }));
    eqId = vi.fn(() => ({ eq: eqGc }));
    select = vi.fn(() => ({ eq: eqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should return the mapped project when it is linked to the caller's GC", async () => {
    // Act
    const result = await assertGcLinkedProject("project-1", "gc-1");

    // Assert
    expect(select).toHaveBeenCalledWith(PROJECT_COLUMNS);
    expect(eqId).toHaveBeenCalledWith("id", "project-1");
    expect(eqGc).toHaveBeenCalledWith("gc_company_id", "gc-1");
    expect(result).toEqual({
      id: "project-1",
      ownerCompanyId: "sub-1",
      name: "Riverside Tower",
      status: "active",
      archivedAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
    });
  });

  it("should throw a 404 when the project isn't linked to this GC (unknown, unlinked, or another GC's)", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(assertGcLinkedProject("project-1", "gc-1")).rejects.toMatchObject({
      statusCode: 404,
      message: "Project not found",
    });
  });

  it("should throw a 502 on any other query failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(assertGcLinkedProject("project-1", "gc-1")).rejects.toMatchObject({
      statusCode: 502,
    });
  });
});

describe("gcDashboard service: getOverview", () => {
  let projectsOrder;
  let projectsEq;
  let projectsSelect;
  let logsQuery;
  let companiesIn;
  let companiesSelect;

  const project = (overrides) => ({
    id: "project-1",
    owner_company_id: "sub-1",
    name: "Riverside Tower",
    status: "active",
    archived_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  });

  beforeEach(() => {
    projectsOrder = vi.fn().mockResolvedValue({ data: [project()], error: null });
    projectsEq = vi.fn(() => ({ order: projectsOrder }));
    projectsSelect = vi.fn(() => ({ eq: projectsEq }));

    // meeting_logs: select().in().not().gte().lt() — a self-returning chain
    // whose last link resolves the query.
    logsQuery = { data: [], error: null };
    const logsBuilder = {};
    ["select", "in", "not", "gte"].forEach((method) => {
      logsBuilder[method] = vi.fn(() => logsBuilder);
    });
    logsBuilder.lt = vi.fn().mockImplementation(() => Promise.resolve(logsQuery));

    companiesIn = vi.fn().mockResolvedValue({
      data: [{ id: "sub-1", name: "Acme Roofing" }],
      error: null,
    });
    companiesSelect = vi.fn(() => ({ in: companiesIn }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { select: projectsSelect };
      if (table === "meeting_logs") return { select: logsBuilder.select };
      if (table === "companies") return { select: companiesSelect };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should mark a linked sub with a completed log in the window as logged", async () => {
    // Arrange
    logsQuery.data = [{ project_id: "project-1", held_at: "2026-09-21T14:00:00.000Z" }];

    // Act
    const result = await getOverview("gc-1", { date: "2026-09-21", tzOffset: 0 });

    // Assert
    expect(projectsEq).toHaveBeenCalledWith("gc_company_id", "gc-1");
    expect(result).toEqual({
      jobsites: [
        {
          name: "Riverside Tower",
          subs: [
            {
              companyId: "sub-1",
              companyName: "Acme Roofing",
              projectId: "project-1",
              status: "logged",
              lastLoggedAt: "2026-09-21T14:00:00.000Z",
              count: 1,
            },
          ],
        },
      ],
      totals: { subs: 1, logged: 1, missing: 0 },
    });
  });

  it("should mark a linked sub with no completed log in the window as missing", async () => {
    // Act
    const result = await getOverview("gc-1", { date: "2026-09-21", tzOffset: 0 });

    // Assert
    expect(result.jobsites[0].subs[0]).toMatchObject({ status: "missing", count: 0 });
    expect(result.totals).toEqual({ subs: 1, logged: 0, missing: 1 });
  });

  it("should exclude an inactive project from the roster", async () => {
    // Arrange
    projectsOrder.mockResolvedValue({
      data: [project({ status: "completed" })],
      error: null,
    });

    // Act
    const result = await getOverview("gc-1", { date: "2026-09-21", tzOffset: 0 });

    // Assert
    expect(result.jobsites).toEqual([]);
    expect(result.totals).toEqual({ subs: 0, logged: 0, missing: 0 });
  });

  it("should exclude an archived project from the roster", async () => {
    // Arrange
    projectsOrder.mockResolvedValue({
      data: [project({ archived_at: "2026-09-10T00:00:00.000Z" })],
      error: null,
    });

    // Act
    const result = await getOverview("gc-1", { date: "2026-09-21", tzOffset: 0 });

    // Assert
    expect(result.jobsites).toEqual([]);
  });

  it("should merge two of the same sub's projects under one jobsite name", async () => {
    // Arrange — same owner, same normalized name, two project rows.
    projectsOrder.mockResolvedValue({
      data: [
        project({ id: "project-1", created_at: "2026-09-01T00:00:00.000Z" }),
        project({ id: "project-2", name: "riverside tower", created_at: "2026-09-05T00:00:00.000Z" }),
      ],
      error: null,
    });
    // A log against the second (later) project row only.
    logsQuery.data = [{ project_id: "project-2", held_at: "2026-09-21T14:00:00.000Z" }];

    // Act
    const result = await getOverview("gc-1", { date: "2026-09-21", tzOffset: 0 });

    // Assert — one jobsite, one sub entry, logged via the merged project, and
    // the drill-in id is the sub's earliest project row.
    expect(result.jobsites).toHaveLength(1);
    expect(result.jobsites[0].subs).toEqual([
      {
        companyId: "sub-1",
        companyName: "Acme Roofing",
        projectId: "project-1",
        status: "logged",
        lastLoggedAt: "2026-09-21T14:00:00.000Z",
        count: 1,
      },
    ]);
  });

  it("should return empty jobsites and zero totals for a GC with no linked projects", async () => {
    // Arrange
    projectsOrder.mockResolvedValue({ data: [], error: null });

    // Act
    const result = await getOverview("gc-1", { date: "2026-09-21", tzOffset: 0 });

    // Assert
    expect(result).toEqual({ jobsites: [], totals: { subs: 0, logged: 0, missing: 0 } });
  });

  it("should throw a 502 when the projects query fails", async () => {
    // Arrange
    projectsOrder.mockResolvedValue({ data: null, error: new Error("db down") });

    // Act & Assert
    await expect(
      getOverview("gc-1", { date: "2026-09-21", tzOffset: 0 }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("gcDashboard service: listMeetings", () => {
  let projectsOrder;
  let projectsSingle;
  let projectsEq2;
  let projectsEq;
  let projectsSelect;
  let meetingsLimit;
  let meetingsOrder;
  let meetingsNot;
  let meetingsIn;
  let meetingsSelect;
  let companiesIn;
  let companiesSelect;

  const dbLog = {
    id: "meeting-1",
    project_id: "project-1",
    company_id: "sub-1",
    held_at: "2026-09-21T14:00:00.000Z",
    completed_at: "2026-09-21T14:05:00.000Z",
    final_pdf_url: "meeting-1/report.pdf",
    toolbox_talks: { title: "Fall Protection" },
    signatures: [{ id: "sig-1" }, { id: "sig-2" }],
  };

  beforeEach(() => {
    projectsOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: "project-1",
          owner_company_id: "sub-1",
          name: "Riverside Tower",
          status: "active",
          archived_at: null,
          created_at: "2026-09-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    // A single project row, for assertGcLinkedProject's chain (used when
    // listMeetings is given a projectId).
    projectsSingle = vi.fn().mockResolvedValue({
      data: {
        id: "project-1",
        owner_company_id: "sub-1",
        name: "Riverside Tower",
        status: "active",
        archived_at: null,
        created_at: "2026-09-01T00:00:00.000Z",
      },
      error: null,
    });
    projectsEq2 = vi.fn(() => ({ single: projectsSingle }));
    // The first .eq() call is shared by both listLinkedProjects
    // (`.eq("gc_company_id", ...).order(...)`) and assertGcLinkedProject
    // (`.eq("id", ...).eq("gc_company_id", ...).single()`), so it supports
    // both continuations.
    projectsEq = vi.fn(() => ({ order: projectsOrder, eq: projectsEq2 }));
    projectsSelect = vi.fn(() => ({ eq: projectsEq }));

    meetingsLimit = vi.fn().mockResolvedValue({ data: [dbLog], error: null });
    meetingsOrder = vi.fn(() => ({ limit: meetingsLimit }));
    const meetingsChain = {};
    meetingsChain.gte = vi.fn(() => meetingsChain);
    meetingsChain.lt = vi.fn(() => meetingsChain);
    meetingsChain.order = meetingsOrder;
    meetingsNot = vi.fn(() => meetingsChain);
    meetingsIn = vi.fn(() => ({ not: meetingsNot }));
    meetingsSelect = vi.fn(() => ({ in: meetingsIn }));

    companiesIn = vi.fn().mockResolvedValue({
      data: [{ id: "sub-1", name: "Acme Roofing" }],
      error: null,
    });
    companiesSelect = vi.fn(() => ({ in: companiesIn }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { select: projectsSelect };
      if (table === "meeting_logs") return { select: meetingsSelect };
      if (table === "companies") return { select: companiesSelect };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should list completed meetings across every linked project, mapped without any file paths", async () => {
    // Act
    const result = await listMeetings("gc-1");

    // Assert
    expect(meetingsIn).toHaveBeenCalledWith("project_id", ["project-1"]);
    expect(meetingsNot).toHaveBeenCalledWith("completed_at", "is", null);
    expect(meetingsOrder).toHaveBeenCalledWith("held_at", { ascending: false });
    expect(meetingsLimit).toHaveBeenCalledWith(200);
    expect(result).toEqual([
      {
        id: "meeting-1",
        projectId: "project-1",
        projectName: "Riverside Tower",
        companyId: "sub-1",
        companyName: "Acme Roofing",
        talkTitle: "Fall Protection",
        heldAt: "2026-09-21T14:00:00.000Z",
        completedAt: "2026-09-21T14:05:00.000Z",
        signerCount: 2,
        pdfReady: true,
      },
    ]);
  });

  it("should expose no crewPhotoUrl, finalPdfUrl or signature path fields", async () => {
    // Act
    const result = await listMeetings("gc-1");

    // Assert
    expect(result[0]).not.toHaveProperty("crewPhotoUrl");
    expect(result[0]).not.toHaveProperty("finalPdfUrl");
    expect(result[0]).not.toHaveProperty("signaturePath");
  });

  it("should report pdfReady false when no PDF has been generated yet", async () => {
    // Arrange
    meetingsLimit.mockResolvedValue({
      data: [{ ...dbLog, final_pdf_url: null }],
      error: null,
    });

    // Act
    const result = await listMeetings("gc-1");

    // Assert
    expect(result[0].pdfReady).toBe(false);
  });

  it("should scope to a single project and validate it's linked when projectId is given", async () => {
    // Act
    await listMeetings("gc-1", { projectId: "project-1" });

    // Assert — assertGcLinkedProject's chain, not listLinkedProjects's.
    expect(projectsSelect).toHaveBeenCalledWith(PROJECT_COLUMNS);
    expect(projectsEq).toHaveBeenCalledWith("id", "project-1");
    expect(meetingsIn).toHaveBeenCalledWith("project_id", ["project-1"]);
  });

  it("should 404 when projectId isn't linked to this GC", async () => {
    // Arrange — assertGcLinkedProject's .single() 404s.
    projectsSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(listMeetings("gc-1", { projectId: "project-9" })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("should apply from/to as a held_at range filter", async () => {
    // Act
    await listMeetings("gc-1", { from: "2026-09-01T00:00:00.000Z", to: "2026-09-08T00:00:00.000Z" });

    // Assert
    const chain = meetingsNot.mock.results[0].value;
    expect(chain.gte).toHaveBeenCalledWith("held_at", "2026-09-01T00:00:00.000Z");
    expect(chain.lt).toHaveBeenCalledWith("held_at", "2026-09-08T00:00:00.000Z");
  });

  it("should return an empty array without querying meeting_logs when the GC has no linked projects", async () => {
    // Arrange
    projectsOrder.mockResolvedValue({ data: [], error: null });

    // Act
    const result = await listMeetings("gc-1");

    // Assert
    expect(result).toEqual([]);
    expect(meetingsSelect).not.toHaveBeenCalled();
  });

  it("should throw a 502 when the meetings query fails", async () => {
    // Arrange
    meetingsLimit.mockResolvedValue({ data: null, error: new Error("db down") });

    // Act & Assert
    await expect(listMeetings("gc-1")).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("gcDashboard service: getMeeting / getMeetingPdfUrl", () => {
  let meetingSingle;
  let meetingEq;
  let meetingSelect;
  let projectsSingle;
  let projectsEqGc;
  let projectsEqId;
  let projectsSelect;
  let talkSingle;
  let talkEq;
  let talkSelect;
  let signaturesOrder;
  let signaturesEq;
  let signaturesSelect;

  const dbMeeting = {
    id: "meeting-1",
    project_id: "project-1",
    company_id: "sub-1",
    talk_id: "talk-1",
    held_at: "2026-09-21T14:00:00.000Z",
    completed_at: "2026-09-21T14:05:00.000Z",
    final_pdf_url: "meeting-1/report.pdf",
  };

  beforeEach(() => {
    meetingSingle = vi.fn().mockResolvedValue({ data: dbMeeting, error: null });
    meetingEq = vi.fn(() => ({ single: meetingSingle }));
    meetingSelect = vi.fn(() => ({ eq: meetingEq }));

    projectsSingle = vi.fn().mockResolvedValue({
      data: {
        id: "project-1",
        owner_company_id: "sub-1",
        name: "Riverside Tower",
        status: "active",
        archived_at: null,
        created_at: "2026-09-01T00:00:00.000Z",
      },
      error: null,
    });
    projectsEqGc = vi.fn(() => ({ single: projectsSingle }));
    projectsEqId = vi.fn(() => ({ eq: projectsEqGc }));
    projectsSelect = vi.fn(() => ({ eq: projectsEqId }));

    talkSingle = vi.fn().mockResolvedValue({ data: { title: "Fall Protection" }, error: null });
    talkEq = vi.fn(() => ({ single: talkSingle }));
    talkSelect = vi.fn(() => ({ eq: talkEq }));

    signaturesOrder = vi.fn().mockResolvedValue({
      data: [{ worker_name: "Jane Doe", quiz_passed: true }],
      error: null,
    });
    signaturesEq = vi.fn(() => ({ order: signaturesOrder }));
    signaturesSelect = vi.fn(() => ({ eq: signaturesEq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "meeting_logs") return { select: meetingSelect };
      if (table === "projects") return { select: projectsSelect };
      if (table === "toolbox_talks") return { select: talkSelect };
      if (table === "signatures") return { select: signaturesSelect };
      throw new Error(`Unexpected table: ${table}`);
    });

    vi.spyOn(companiesService, "getById").mockReset().mockResolvedValue({
      id: "sub-1",
      name: "Acme Roofing",
      companyType: "subcontractor",
      tier: "premium",
    });

    vi.spyOn(storageService, "getSignedUrl")
      .mockReset()
      .mockResolvedValue("https://signed.example/report.pdf");
  });

  describe("getMeeting", () => {
    it("should return detail, talk title and signers, exposing no file paths", async () => {
      // Act
      const result = await getMeeting("meeting-1", "gc-1");

      // Assert
      expect(result).toEqual({
        id: "meeting-1",
        projectId: "project-1",
        projectName: "Riverside Tower",
        companyId: "sub-1",
        companyName: "Acme Roofing",
        talkTitle: "Fall Protection",
        heldAt: "2026-09-21T14:00:00.000Z",
        completedAt: "2026-09-21T14:05:00.000Z",
        signerCount: 1,
        pdfReady: true,
        signers: [{ workerName: "Jane Doe", quizPassed: true }],
      });
    });

    it("should 404 when the meeting is still in progress (no completed_at)", async () => {
      // Arrange
      meetingSingle.mockResolvedValue({
        data: { ...dbMeeting, completed_at: null },
        error: null,
      });

      // Act & Assert
      await expect(getMeeting("meeting-1", "gc-1")).rejects.toMatchObject({
        statusCode: 404,
        message: "Meeting not found",
      });
      expect(projectsSelect).not.toHaveBeenCalled();
    });

    it("should 404 when the meeting's project isn't linked to this GC", async () => {
      // Arrange
      projectsSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

      // Act & Assert
      await expect(getMeeting("meeting-1", "gc-1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should 404 when the meeting id doesn't exist", async () => {
      // Arrange
      meetingSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

      // Act & Assert
      await expect(getMeeting("missing", "gc-1")).rejects.toMatchObject({
        statusCode: 404,
        message: "Meeting not found",
      });
    });

    it("should return a null talkTitle when the meeting has no talk_id", async () => {
      // Arrange
      meetingSingle.mockResolvedValue({ data: { ...dbMeeting, talk_id: null }, error: null });

      // Act
      const result = await getMeeting("meeting-1", "gc-1");

      // Assert
      expect(result.talkTitle).toBeNull();
      expect(talkSelect).not.toHaveBeenCalled();
    });

    it("should not expose crewPhotoUrl, finalPdfUrl or a signature's image path", async () => {
      // Act
      const result = await getMeeting("meeting-1", "gc-1");

      // Assert
      expect(result).not.toHaveProperty("crewPhotoUrl");
      expect(result).not.toHaveProperty("finalPdfUrl");
      expect(result.signers[0]).not.toHaveProperty("signaturePath");
    });
  });

  describe("getMeetingPdfUrl", () => {
    it("should return a signed URL named from the meeting's own company, not the caller's", async () => {
      // Act
      const url = await getMeetingPdfUrl("meeting-1", "gc-1");

      // Assert
      expect(companiesService.getById).toHaveBeenCalledWith("sub-1");
      expect(storageService.getSignedUrl).toHaveBeenCalledWith(
        "meeting-pdfs",
        "meeting-1/report.pdf",
        300,
        "acme-roofing-riverside-tower-2026-09-21-meeting1.pdf",
      );
      expect(url).toBe("https://signed.example/report.pdf");
    });

    it("should 404 when no PDF has been generated yet", async () => {
      // Arrange
      meetingSingle.mockResolvedValue({
        data: { ...dbMeeting, final_pdf_url: null },
        error: null,
      });

      // Act & Assert
      await expect(getMeetingPdfUrl("meeting-1", "gc-1")).rejects.toMatchObject({
        statusCode: 404,
        message: "No PDF has been generated for this meeting yet",
      });
    });

    it("should 404 when the meeting's project isn't linked to this GC", async () => {
      // Arrange
      projectsSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

      // Act & Assert
      await expect(getMeetingPdfUrl("meeting-1", "gc-1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
