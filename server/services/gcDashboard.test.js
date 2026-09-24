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

const PROJECT_COLUMNS =
  "id, owner_company_id, jobsite_id, name, status, archived_at, created_at";

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
  let jobsitesResult;
  let projectsResult;
  let logsResult;
  let companiesResult;
  let jobsitesEqs;
  let projectsEq;

  // A self-returning query chain that resolves to `result` when awaited, so
  // the mocks don't depend on the order of .eq/.is/.order/.in calls.
  const chain = (getResult, onEq) => {
    const builder = {};
    ["select", "is", "in", "not", "gte", "lt", "order"].forEach((method) => {
      builder[method] = vi.fn(() => builder);
    });
    builder.eq = vi.fn((...eqArgs) => {
      if (onEq) onEq(...eqArgs);
      return builder;
    });
    builder.then = (resolve, reject) =>
      Promise.resolve(getResult()).then(resolve, reject);
    return builder;
  };

  const project = (overrides) => ({
    id: "project-1",
    owner_company_id: "sub-1",
    jobsite_id: "jobsite-1",
    name: "Riverside Tower",
    status: "active",
    archived_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  });

  const jobsite = (overrides) => ({
    id: "jobsite-1",
    name: "Riverside Tower",
    jobsite_subcontractors: [
      { sub_company_id: "sub-1", accepted_at: "2026-09-01T00:00:00.000Z" },
    ],
    ...overrides,
  });

  const overviewArgs = { date: "2026-09-21", tzOffset: 0 };

  beforeEach(() => {
    jobsitesResult = { data: [jobsite()], error: null };
    projectsResult = { data: [project()], error: null };
    logsResult = { data: [], error: null };
    companiesResult = {
      data: [{ id: "sub-1", name: "Acme Roofing" }],
      error: null,
    };
    jobsitesEqs = [];
    projectsEq = [];

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "jobsites")
        return chain(() => jobsitesResult, (...a) => jobsitesEqs.push(a));
      if (table === "projects")
        return chain(() => projectsResult, (...a) => projectsEq.push(a));
      if (table === "meeting_logs") return chain(() => logsResult);
      if (table === "companies") return chain(() => companiesResult);
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should mark an accepted sub with a completed log in the window as logged", async () => {
    // Arrange
    logsResult.data = [
      { project_id: "project-1", held_at: "2026-09-21T14:00:00.000Z" },
    ];

    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert
    expect(jobsitesEqs).toContainEqual(["gc_company_id", "gc-1"]);
    expect(jobsitesEqs).toContainEqual(["status", "active"]);
    expect(projectsEq).toContainEqual(["gc_company_id", "gc-1"]);
    expect(result).toEqual({
      jobsites: [
        {
          id: "jobsite-1",
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

  it("should mark an accepted sub with no completed log in the window as missing", async () => {
    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert
    expect(result.jobsites[0].subs[0]).toMatchObject({
      status: "missing",
      count: 0,
    });
    expect(result.totals).toEqual({ subs: 1, logged: 0, missing: 1 });
  });

  it("should show an accepted sub with no project as missing with a null projectId", async () => {
    // Arrange
    projectsResult.data = [];

    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert
    expect(result.jobsites[0].subs[0]).toMatchObject({
      companyId: "sub-1",
      projectId: null,
      status: "missing",
    });
  });

  it("should not list a pending invite (no sub company yet) on the roster", async () => {
    // Arrange
    jobsitesResult.data = [
      jobsite({
        jobsite_subcontractors: [{ sub_company_id: null, accepted_at: null }],
      }),
    ];

    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert
    expect(result.jobsites).toEqual([
      { id: "jobsite-1", name: "Riverside Tower", subs: [] },
    ]);
    expect(result.totals).toEqual({ subs: 0, logged: 0, missing: 0 });
  });

  it("should treat a jobsite without embedded roster rows as having no subs", async () => {
    // Arrange
    jobsitesResult.data = [jobsite({ jobsite_subcontractors: undefined })];

    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert
    expect(result.jobsites[0].subs).toEqual([]);
  });

  it("should ignore inactive and archived projects and projects with no jobsite", async () => {
    // Arrange
    projectsResult.data = [
      project({ id: "p-done", status: "completed" }),
      project({ id: "p-archived", archived_at: "2026-09-10T00:00:00.000Z" }),
      project({ id: "p-legacy", jobsite_id: null }),
    ];

    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert — the roster still shows the sub, but with no drill-in project.
    expect(result.jobsites[0].subs[0].projectId).toBeNull();
  });

  it("should merge a sub's several projects in one jobsite, drilling into the earliest", async () => {
    // Arrange
    projectsResult.data = [
      project({ id: "project-1", created_at: "2026-09-01T00:00:00.000Z" }),
      project({ id: "project-2", created_at: "2026-09-05T00:00:00.000Z" }),
    ];
    logsResult.data = [
      { project_id: "project-2", held_at: "2026-09-21T14:00:00.000Z" },
    ];

    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert
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

  it("should sort jobsites by name", async () => {
    // Arrange
    jobsitesResult.data = [
      jobsite({ id: "jobsite-z", name: "Zenith Site" }),
      jobsite({ id: "jobsite-a", name: "Alpha Site" }),
    ];
    projectsResult.data = [];

    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert
    expect(result.jobsites.map((j) => j.id)).toEqual([
      "jobsite-a",
      "jobsite-z",
    ]);
  });

  it("should fall back to a null company name when the sub's company row is missing", async () => {
    // Arrange
    companiesResult.data = [];

    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert
    expect(result.jobsites[0].subs[0].companyName).toBeNull();
  });

  it("should return empty jobsites and zero totals for a GC with no jobsites", async () => {
    // Arrange
    jobsitesResult.data = [];
    projectsResult.data = [];

    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert
    expect(result).toEqual({
      jobsites: [],
      totals: { subs: 0, logged: 0, missing: 0 },
    });
  });

  it("should throw a 502 when the jobsites query fails", async () => {
    // Arrange
    jobsitesResult = { data: null, error: new Error("db down") };

    // Act & Assert
    await expect(getOverview("gc-1", overviewArgs)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load jobsites",
    });
  });

  it("should throw a 502 when the projects query fails", async () => {
    // Arrange
    projectsResult = { data: null, error: new Error("db down") };

    // Act & Assert
    await expect(getOverview("gc-1", overviewArgs)).rejects.toMatchObject({
      statusCode: 502,
    });
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
