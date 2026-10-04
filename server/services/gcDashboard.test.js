// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
process.env.MEETING_LOG_SEAL_SECRET = "test-only-seal-secret";

const { supabase } = require("../utility/supabaseClient");
const companiesService = require("./companies");
const storageService = require("./storage");
const subAccessService = require("./subAccess");
const jobsitesService = require("./jobsites");
const auditLogService = require("./auditLog");
const contentSeal = require("../utility/contentSeal");
const {
  assertGcLinkedProject,
  getOverview,
  listMeetings,
  getMeeting,
  getMeetingPdfUrl,
  verifySeal,
  getDefenseBundleEntries,
  listCompletedLogsInWindow,
} = require("./gcDashboard");

const PROJECT_COLUMNS =
  "id, owner_company_id, jobsite_id, name, status, archived_at, created_at";

const fromSpy = vi.spyOn(supabase, "from");

// Phase 9d: null = nothing locked (a paid GC plan). Locking has its own describe.
const unlockedSpy = vi.spyOn(subAccessService, "getUnlockedSubIds");
beforeEach(() => {
  unlockedSpy.mockReset().mockResolvedValue(null);
});

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

  it("should 404 a project outside a site-scoped user's assigned jobsites, before any lock check", async () => {
    // Arrange
    single.mockResolvedValue({
      data: { id: "project-1", owner_company_id: "sub-1", jobsite_id: "site-b", name: "Tower" },
      error: null,
    });

    // Act & Assert
    await expect(assertGcLinkedProject("project-1", "gc-1", ["site-a"])).rejects.toMatchObject({
      statusCode: 404,
      message: "Project not found",
    });
    expect(unlockedSpy).not.toHaveBeenCalled();
  });

  it("should return a project inside a site-scoped user's assigned jobsites", async () => {
    // Arrange
    single.mockResolvedValue({
      data: { id: "project-1", owner_company_id: "sub-1", jobsite_id: "site-a", name: "Tower" },
      error: null,
    });

    // Act
    const result = await assertGcLinkedProject("project-1", "gc-1", ["site-a"]);

    // Assert
    expect(result.jobsiteId).toBe("site-a");
  });

  it("should throw a 403 PLAN_LIMIT when the project's sub is locked on the GC's plan", async () => {
    // Arrange
    unlockedSpy.mockResolvedValue(new Set(["someone-else"]));

    // Act & Assert
    await expect(assertGcLinkedProject("project-1", "gc-1")).rejects.toMatchObject({
      statusCode: 403,
      data: { code: "PLAN_LIMIT" },
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
    ["select", "is", "in", "not", "gte", "lt", "order", "range"].forEach((method) => {
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
    origin: "gc",
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
          createdBySub: false,
          subs: [
            {
              companyId: "sub-1",
              companyName: "Acme Roofing",
              projectId: "project-1",
              cadence: "daily",
              status: "logged",
              lastLoggedAt: "2026-09-21T14:00:00.000Z",
              count: 1,
              locked: false,
            },
          ],
        },
      ],
      totals: { subs: 1, logged: 1, missing: 0 },
    });
  });

  it("should score a weekly sub against the whole week and a daily sub against today, and keep roster order", async () => {
    // Arrange — "today" is Wednesday 2026-09-23, so Monday's log is inside
    // this week but outside today.
    jobsitesResult.data = [
      jobsite({
        meeting_cadence: "weekly",
        jobsite_subcontractors: [
          { sub_company_id: "sub-1", accepted_at: "2026-09-01T00:00:00.000Z", meeting_cadence: null },
          { sub_company_id: "sub-2", accepted_at: "2026-09-01T00:00:00.000Z", meeting_cadence: "daily" },
          // A looser override than the jobsite default is ignored.
          { sub_company_id: "sub-3", accepted_at: "2026-09-01T00:00:00.000Z", meeting_cadence: "weekly" },
        ],
      }),
    ];
    projectsResult.data = [
      project({ id: "project-1", owner_company_id: "sub-1" }),
      project({ id: "project-2", owner_company_id: "sub-2" }),
      project({ id: "project-3", owner_company_id: "sub-3" }),
    ];
    // Monday's logs for sub-1 and sub-2: inside the week, outside "today".
    logsResult.data = [
      { project_id: "project-1", held_at: "2026-09-21T14:00:00.000Z" },
      { project_id: "project-2", held_at: "2026-09-21T14:00:00.000Z" },
    ];
    companiesResult.data = [
      { id: "sub-1", name: "A" },
      { id: "sub-2", name: "B" },
      { id: "sub-3", name: "C" },
    ];

    // Act
    const result = await getOverview("gc-1", { date: "2026-09-23", tzOffset: 0 });

    // Assert
    expect(result.jobsites[0].subs.map(({ companyId, cadence, status }) => ({ companyId, cadence, status }))).toEqual([
      { companyId: "sub-1", cadence: "weekly", status: "logged" },
      { companyId: "sub-2", cadence: "daily", status: "missing" },
      { companyId: "sub-3", cadence: "weekly", status: "missing" },
    ]);
  });

  it("should flag a subcontractor-originated jobsite as createdBySub and treat a legacy null origin as false", async () => {
    // Arrange
    jobsitesResult.data = [
      jobsite({ id: "jobsite-1", name: "A Site", origin: "subcontractor" }),
      jobsite({ id: "jobsite-2", name: "B Site", origin: null }),
    ];

    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert
    expect(result.jobsites.map((j) => j.createdBySub)).toEqual([true, false]);
  });

  it("should restrict jobsites and projects to a site-scoped user's assigned jobsites", async () => {
    // Act
    await getOverview("gc-1", { ...overviewArgs, allowedJobsiteIds: ["jobsite-1"] });

    // Assert
    const builderFor = (table) =>
      fromSpy.mock.results[fromSpy.mock.calls.findIndex(([name]) => name === table)].value;
    expect(builderFor("jobsites").in).toHaveBeenCalledWith("id", ["jobsite-1"]);
    expect(builderFor("projects").in).toHaveBeenCalledWith("jobsite_id", ["jobsite-1"]);
  });

  it("should return an empty overview without querying when a site-scoped user has no assigned jobsites", async () => {
    // Act
    const result = await getOverview("gc-1", { ...overviewArgs, allowedJobsiteIds: [] });

    // Assert
    expect(result).toEqual({ jobsites: [], totals: { subs: 0, logged: 0, missing: 0 } });
    expect(fromSpy).not.toHaveBeenCalled();
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
      { id: "jobsite-1", name: "Riverside Tower", createdBySub: false, subs: [] },
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
        cadence: "daily",
        status: "logged",
        lastLoggedAt: "2026-09-21T14:00:00.000Z",
        count: 1,
        locked: false,
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

  it("should mask a locked sub down to a placeholder but still count it in the totals", async () => {
    // Arrange
    unlockedSpy.mockResolvedValue(new Set(["someone-else"]));

    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert
    expect(result.jobsites[0].subs).toEqual([
      {
        companyId: null,
        companyName: null,
        projectId: null,
        cadence: null,
        status: null,
        lastLoggedAt: null,
        count: null,
        locked: true,
      },
    ]);
    expect(result.totals).toEqual({ subs: 1, logged: 0, missing: 1 });
  });

  it("should leave an unlocked sub fully visible when others are locked", async () => {
    // Arrange
    unlockedSpy.mockResolvedValue(new Set(["sub-1"]));

    // Act
    const result = await getOverview("gc-1", overviewArgs);

    // Assert
    expect(result.jobsites[0].subs[0]).toMatchObject({
      companyId: "sub-1",
      companyName: "Acme Roofing",
      locked: false,
    });
  });
});

describe("gcDashboard service: listMeetings", () => {
  let projectsOrder;
  let projectsSingle;
  let projectsEq2;
  let projectsEq;
  let projectsSelect;
  let meetingsRange;
  let meetingsOrder2;
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

    meetingsRange = vi.fn().mockResolvedValue({ data: [dbLog], error: null });
    meetingsOrder2 = vi.fn(() => ({ range: meetingsRange }));
    meetingsOrder = vi.fn(() => ({ order: meetingsOrder2 }));
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

  it("should leave a locked sub's projects out of the unfiltered list", async () => {
    // Arrange
    unlockedSpy.mockResolvedValue(new Set(["someone-else"]));

    // Act
    const result = await listMeetings("gc-1");

    // Assert
    expect(result).toEqual({ meetings: [], hasMore: false });
    expect(meetingsSelect).not.toHaveBeenCalled();
  });

  it("should list completed meetings across every linked project, mapped without any file paths", async () => {
    // Act
    const result = await listMeetings("gc-1");

    // Assert
    expect(meetingsIn).toHaveBeenCalledWith("project_id", ["project-1"]);
    expect(meetingsNot).toHaveBeenCalledWith("completed_at", "is", null);
    expect(meetingsOrder).toHaveBeenCalledWith("held_at", { ascending: false });
    expect(meetingsOrder2).toHaveBeenCalledWith("id", { ascending: false });
    expect(meetingsRange).toHaveBeenCalledWith(0, 20);
    expect(result).toEqual({
      meetings: [
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
          sealed: false,
        },
      ],
      hasMore: false,
    });
  });

  it("should paginate with the given limit/offset and report hasMore when an extra row comes back", async () => {
    // Arrange — one more row than the requested page size.
    meetingsRange.mockResolvedValue({
      data: [dbLog, { ...dbLog, id: "meeting-2" }],
      error: null,
    });

    // Act
    const result = await listMeetings("gc-1", { limit: 1, offset: 5 });

    // Assert
    expect(meetingsRange).toHaveBeenCalledWith(5, 6);
    expect(result.hasMore).toBe(true);
    expect(result.meetings).toHaveLength(1);
    expect(result.meetings[0].id).toBe("meeting-1");
  });

  it("should clamp an oversized limit to the page-size ceiling", async () => {
    // Act
    await listMeetings("gc-1", { limit: 9999 });

    // Assert
    expect(meetingsRange).toHaveBeenCalledWith(0, 100);
  });

  it("should expose no crewPhotoUrl, finalPdfUrl or signature path fields", async () => {
    // Act
    const result = await listMeetings("gc-1");

    // Assert
    expect(result.meetings[0]).not.toHaveProperty("crewPhotoUrl");
    expect(result.meetings[0]).not.toHaveProperty("finalPdfUrl");
    expect(result.meetings[0]).not.toHaveProperty("signaturePath");
  });

  it("should report pdfReady false when no PDF has been generated yet", async () => {
    // Arrange
    meetingsRange.mockResolvedValue({
      data: [{ ...dbLog, final_pdf_url: null }],
      error: null,
    });

    // Act
    const result = await listMeetings("gc-1");

    // Assert
    expect(result.meetings[0].pdfReady).toBe(false);
  });

  it("should report sealed as a boolean, never the raw content_seal, and true once one exists", async () => {
    // Arrange
    meetingsRange.mockResolvedValue({
      data: [{ ...dbLog, content_seal: "abc123" }],
      error: null,
    });

    // Act
    const result = await listMeetings("gc-1");

    // Assert
    expect(result.meetings[0].sealed).toBe(true);
    expect(result.meetings[0]).not.toHaveProperty("content_seal");
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

  it("should return no meetings without querying when a site-scoped user has no assigned jobsites", async () => {
    // Act
    const result = await listMeetings("gc-1", { allowedJobsiteIds: [] });

    // Assert
    expect(result).toEqual({ meetings: [], hasMore: false });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("should 404 a projectId outside a site-scoped user's assigned jobsites", async () => {
    // Act & Assert — the mocked project row carries no jobsite_id in scope.
    await expect(
      listMeetings("gc-1", { projectId: "project-1", allowedJobsiteIds: ["site-a"] }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(meetingsSelect).not.toHaveBeenCalled();
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
    expect(result).toEqual({ meetings: [], hasMore: false });
    expect(meetingsSelect).not.toHaveBeenCalled();
  });

  it("should throw a 502 when the meetings query fails", async () => {
    // Arrange
    meetingsRange.mockResolvedValue({ data: null, error: new Error("db down") });

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
        sealed: false,
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

    it("should 404 when the meeting's project is outside a site-scoped user's assigned jobsites", async () => {
      // Act & Assert
      await expect(getMeeting("meeting-1", "gc-1", ["site-a"])).rejects.toMatchObject({
        statusCode: 404,
        message: "Project not found",
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

    it("should 404 when the meeting's project is outside a site-scoped user's assigned jobsites", async () => {
      // Act & Assert
      await expect(getMeetingPdfUrl("meeting-1", "gc-1", ["site-a"])).rejects.toMatchObject({
        statusCode: 404,
        message: "Project not found",
      });
      expect(storageService.getSignedUrl).not.toHaveBeenCalled();
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

describe("gcDashboard service: verifySeal", () => {
  let meetingSingle;
  let meetingEq;
  let meetingSelect;
  let projectsSingle;
  let projectsEqGc;
  let projectsEqId;
  let projectsSelect;
  let signaturesEq;
  let signaturesSelect;

  const sigRows = [
    { id: "sig-1", worker_name: "Jane Doe", quiz_score: 3, quiz_passed: true },
  ];

  const dbMeeting = {
    id: "meeting-1",
    project_id: "project-1",
    company_id: "sub-1",
    talk_id: "talk-1",
    foreman_id: "user-1",
    crew_photo_url: null,
    held_at: "2026-09-21T14:00:00.000Z",
    completed_at: "2026-09-21T14:05:00.000Z",
    final_pdf_url: "meeting-1/report.pdf",
    content_seal: null, // set per-test
    sealed_at: "2026-09-21T14:05:00.000Z",
  };

  const validSeal = contentSeal.computeSeal(
    contentSeal.buildCanonicalPayload({
      meetingLog: {
        id: "meeting-1",
        projectId: "project-1",
        talkId: "talk-1",
        companyId: "sub-1",
        foremanId: "user-1",
        crewPhotoUrl: null,
        heldAt: "2026-09-21T14:00:00.000Z",
        completedAt: "2026-09-21T14:05:00.000Z",
      },
      signatures: [
        { id: "sig-1", workerName: "Jane Doe", quizScore: 3, quizPassed: true },
      ],
    }),
  );

  beforeEach(() => {
    meetingSingle = vi
      .fn()
      .mockResolvedValue({ data: { ...dbMeeting, content_seal: validSeal }, error: null });
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

    signaturesEq = vi.fn().mockResolvedValue({ data: sigRows, error: null });
    signaturesSelect = vi.fn(() => ({ eq: signaturesEq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "meeting_logs") return { select: meetingSelect };
      if (table === "projects") return { select: projectsSelect };
      if (table === "signatures") return { select: signaturesSelect };
      throw new Error(`Unexpected table: ${table}`);
    });

    vi.spyOn(auditLogService, "record").mockReset().mockResolvedValue(undefined);
  });

  it("should return valid:true and record a seal_verified audit event when the recomputed seal matches", async () => {
    // Act
    const result = await verifySeal("meeting-1", "gc-1", null, "user-2");

    // Assert
    expect(result).toEqual({ valid: true, sealedAt: "2026-09-21T14:05:00.000Z" });
    expect(auditLogService.record).toHaveBeenCalledWith({
      meetingLogId: "meeting-1",
      eventType: "seal_verified",
      actorId: "user-2",
      metadata: { valid: true, via: "gc" },
    });
  });

  it("should return valid:true when held_at/completed_at come back from the DB in a different lexical timestamp format than what was used to compute the stored seal (regression: PostgREST's timestamptz round-trip vs. the JS Date#toISOString() used at seal time must not read as tampering)", async () => {
    // Arrange — same instants as dbMeeting's held_at/completed_at, but
    // formatted the way Postgres/PostgREST actually returns a TIMESTAMPTZ
    // column (offset instead of "Z", no fractional digits since they're
    // exactly zero).
    meetingSingle.mockResolvedValue({
      data: {
        ...dbMeeting,
        content_seal: validSeal,
        held_at: "2026-09-21T14:00:00+00:00",
        completed_at: "2026-09-21T14:05:00+00:00",
      },
      error: null,
    });

    // Act
    const result = await verifySeal("meeting-1", "gc-1");

    // Assert
    expect(result.valid).toBe(true);
  });

  it("should return valid:false when the stored seal no longer matches the row's current fields", async () => {
    // Arrange
    meetingSingle.mockResolvedValue({
      data: { ...dbMeeting, content_seal: validSeal, talk_id: "talk-tampered" },
      error: null,
    });

    // Act
    const result = await verifySeal("meeting-1", "gc-1");

    // Assert
    expect(result.valid).toBe(false);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { valid: false, via: "gc" } }),
    );
  });

  it("should throw a 404 AppError when the meeting hasn't been sealed yet", async () => {
    // Arrange
    meetingSingle.mockResolvedValue({ data: { ...dbMeeting, content_seal: null }, error: null });

    // Act & Assert
    await expect(verifySeal("meeting-1", "gc-1")).rejects.toMatchObject({
      statusCode: 404,
      message: "This meeting hasn't been sealed yet",
    });
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it("should 404 when the meeting's project isn't linked to this GC", async () => {
    // Arrange
    projectsSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(verifySeal("meeting-1", "gc-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("should 404 when the meeting's project is outside a site-scoped user's assigned jobsites", async () => {
    // Act & Assert
    await expect(verifySeal("meeting-1", "gc-1", ["site-a"])).rejects.toMatchObject({
      statusCode: 404,
      message: "Project not found",
    });
  });

  it("should throw a 502 AppError when loading the signatures fails", async () => {
    // Arrange
    signaturesEq.mockResolvedValue({ data: null, error: new Error("db down") });

    // Act & Assert
    await expect(verifySeal("meeting-1", "gc-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not verify the meeting's signatures",
    });
  });
});

describe("gcDashboard service: getDefenseBundleEntries", () => {
  let getOwnedJobsiteSpy;
  let projectsOrder;
  let projectsEq;
  let projectsSelect;
  let logsOrder;
  let logsNot;
  let logsIn;
  let logsSelect;
  let companiesIn;
  let companiesSelect;

  const linkedProject = (overrides) => ({
    id: "project-1",
    owner_company_id: "sub-1",
    jobsite_id: "jobsite-1",
    name: "Riverside Tower",
    status: "active",
    archived_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  });

  const dbLog = (overrides) => ({
    id: "meeting-1",
    project_id: "project-1",
    company_id: "sub-1",
    held_at: "2026-09-21T14:00:00.000Z",
    completed_at: "2026-09-21T14:05:00.000Z",
    final_pdf_url: "meeting-1/report.pdf",
    toolbox_talks: { title: "Fall Protection" },
    ...overrides,
  });

  beforeEach(() => {
    getOwnedJobsiteSpy = vi
      .spyOn(jobsitesService, "getOwnedJobsite")
      .mockReset()
      .mockResolvedValue({
        id: "jobsite-1",
        name: "Riverside Tower",
        plan: "site_pro",
        sitePro: true,
      });

    projectsOrder = vi.fn().mockResolvedValue({ data: [linkedProject()], error: null });
    projectsEq = vi.fn(() => ({ order: projectsOrder }));
    projectsSelect = vi.fn(() => ({ eq: projectsEq }));

    logsOrder = vi.fn().mockResolvedValue({ data: [dbLog()], error: null });
    logsNot = vi.fn(() => ({ order: logsOrder }));
    logsIn = vi.fn(() => ({ not: logsNot }));
    logsSelect = vi.fn(() => ({ in: logsIn }));

    companiesIn = vi.fn().mockResolvedValue({
      data: [{ id: "sub-1", name: "Acme Roofing" }],
      error: null,
    });
    companiesSelect = vi.fn(() => ({ in: companiesIn }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { select: projectsSelect };
      if (table === "meeting_logs") return { select: logsSelect };
      if (table === "companies") return { select: companiesSelect };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should return the jobsite name and one entry per completed log with a PDF, oldest held first", async () => {
    // Act
    const result = await getDefenseBundleEntries("jobsite-1", "gc-1");

    // Assert
    expect(getOwnedJobsiteSpy).toHaveBeenCalledWith("jobsite-1", "gc-1", null);
    expect(logsIn).toHaveBeenCalledWith("project_id", ["project-1"]);
    expect(logsNot).toHaveBeenCalledWith("completed_at", "is", null);
    expect(logsOrder).toHaveBeenCalledWith("held_at", { ascending: true });
    expect(result).toEqual({
      jobsiteName: "Riverside Tower",
      skippedCount: 0,
      entries: [
        {
          path: "meeting-1/report.pdf",
          filename: "acme-roofing-riverside-tower-2026-09-21-meeting1.pdf",
          companyName: "Acme Roofing",
          projectName: "Riverside Tower",
          talkTitle: "Fall Protection",
          heldAt: "2026-09-21T14:00:00.000Z",
        },
      ],
    });
  });

  it("should throw a 403 PLAN_LIMIT when the jobsite isn't on Site Pro, without querying anything else", async () => {
    // Arrange
    getOwnedJobsiteSpy.mockResolvedValue({
      id: "jobsite-1",
      name: "Riverside Tower",
      plan: "free",
      sitePro: false,
    });

    // Act & Assert
    await expect(getDefenseBundleEntries("jobsite-1", "gc-1")).rejects.toMatchObject({
      statusCode: 403,
      data: { code: "PLAN_LIMIT" },
    });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("should propagate a 404 when the jobsite isn't owned/allowed", async () => {
    // Arrange
    const notFound = Object.assign(new Error("Jobsite not found"), { statusCode: 404 });
    getOwnedJobsiteSpy.mockRejectedValue(notFound);

    // Act & Assert
    await expect(getDefenseBundleEntries("jobsite-1", "gc-1")).rejects.toBe(notFound);
  });

  it("should exclude a locked sub's projects and 404 when nothing is left to bundle", async () => {
    // Arrange
    unlockedSpy.mockResolvedValue(new Set(["someone-else"]));

    // Act & Assert
    await expect(getDefenseBundleEntries("jobsite-1", "gc-1")).rejects.toMatchObject({
      statusCode: 404,
      message:
        "No completed meeting logs with a generated PDF are available yet for this job site.",
    });
    expect(logsSelect).not.toHaveBeenCalled();
  });

  it("should 404 when the jobsite has no linked projects at all", async () => {
    // Arrange
    projectsOrder.mockResolvedValue({ data: [], error: null });

    // Act & Assert
    await expect(getDefenseBundleEntries("jobsite-1", "gc-1")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(logsSelect).not.toHaveBeenCalled();
  });

  it("should skip a completed log with no PDF yet and report it in skippedCount", async () => {
    // Arrange
    logsOrder.mockResolvedValue({
      data: [dbLog(), dbLog({ id: "meeting-2", final_pdf_url: null })],
      error: null,
    });

    // Act
    const result = await getDefenseBundleEntries("jobsite-1", "gc-1");

    // Assert
    expect(result.skippedCount).toBe(1);
    expect(result.entries).toHaveLength(1);
  });

  it("should 404 when every completed log is missing a PDF", async () => {
    // Arrange
    logsOrder.mockResolvedValue({ data: [dbLog({ final_pdf_url: null })], error: null });

    // Act & Assert
    await expect(getDefenseBundleEntries("jobsite-1", "gc-1")).rejects.toMatchObject({
      statusCode: 404,
      message:
        "No completed meeting logs with a generated PDF are available yet for this job site.",
    });
  });

  it("should throw a 502 when the meeting_logs query fails", async () => {
    // Arrange
    logsOrder.mockResolvedValue({ data: null, error: new Error("db down") });

    // Act & Assert
    await expect(getDefenseBundleEntries("jobsite-1", "gc-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load meeting logs",
    });
  });
});

describe("gcDashboard service: listCompletedLogsInWindow", () => {
  const window = { start: "2026-09-01T00:00:00.000Z", end: "2026-10-01T00:00:00.000Z" };
  let range;
  let builder;

  const logs = (count) =>
    Array.from({ length: count }, (_, i) => ({ project_id: "project-1", held_at: `row-${i}` }));

  beforeEach(() => {
    range = vi.fn().mockResolvedValue({ data: [], error: null });
    builder = {};
    for (const method of ["select", "in", "not", "gte", "lt", "order"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.range = range;
    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "meeting_logs") return builder;
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should skip the query entirely when there are no projects", async () => {
    // Act
    const result = await listCompletedLogsInWindow([], window);

    // Assert
    expect(result).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("should page past PostgREST's 1,000-row cap instead of silently truncating", async () => {
    // Arrange
    range
      .mockResolvedValueOnce({ data: logs(1000), error: null })
      .mockResolvedValueOnce({ data: logs(1000), error: null })
      .mockResolvedValueOnce({ data: logs(37), error: null });

    // Act
    const result = await listCompletedLogsInWindow(["project-1"], window);

    // Assert
    expect(result).toHaveLength(2037);
    expect(range.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("should filter to completed logs in the window with a stable, tiebroken order", async () => {
    // Act
    await listCompletedLogsInWindow(["project-1"], window);

    // Assert
    expect(builder.in).toHaveBeenCalledWith("project_id", ["project-1"]);
    expect(builder.not).toHaveBeenCalledWith("completed_at", "is", null);
    expect(builder.gte).toHaveBeenCalledWith("held_at", window.start);
    expect(builder.lt).toHaveBeenCalledWith("held_at", window.end);
    expect(builder.order).toHaveBeenNthCalledWith(1, "held_at", { ascending: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
  });

  it("should throw a 502 when a page fails", async () => {
    // Arrange
    range.mockResolvedValue({ data: null, error: { code: "XX000" } });

    // Act & Assert
    await expect(listCompletedLogsInWindow(["project-1"], window)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load meeting logs",
    });
  });
});
