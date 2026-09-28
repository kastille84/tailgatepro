// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const siteScopeService = require("./siteScope");
const companiesService = require("./companies");
const talksService = require("./talks");
const gcDashboardService = require("./gcDashboard");
const projectsService = require("./projects");
const {
  listPickerTalks,
  getCurrentPush,
  pushRequiredTopic,
  clearRequiredTopic,
  getComplianceRollup,
  getRequiredTopicForProject,
} = require("./policyPush");

const fromSpy = vi.spyOn(supabase, "from");
const assertPolicyPushSpy = vi.spyOn(siteScopeService, "assertPolicyPushAvailable");
const getCompanySpy = vi.spyOn(companiesService, "getById");
const setRequiredTopicSpy = vi.spyOn(companiesService, "setRequiredTopic");
const clearRequiredTopicSpy = vi.spyOn(companiesService, "clearRequiredTopic");
const listGlobalSpy = vi.spyOn(talksService, "listGlobal");
const listActiveJobsitesSpy = vi.spyOn(gcDashboardService, "listActiveJobsites");
const listLinkedProjectsSpy = vi.spyOn(gcDashboardService, "listLinkedProjects");
const getCompanyNamesByIdsSpy = vi.spyOn(gcDashboardService, "getCompanyNamesByIds");
const getProjectByIdSpy = vi.spyOn(projectsService, "getById");

// A self-returning query chain that resolves to `result` when awaited —
// mirrors scorecards.test.js's own `chain` helper.
const chain = (result) => {
  const builder = {};
  ["select", "eq", "in", "not", "gte"].forEach((method) => {
    builder[method] = vi.fn(() => builder);
  });
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
};

const companyNoPush = {
  id: "gc-1",
  requiredTalkId: null,
  requiredTalkPushedAt: null,
  requiredTalkPushedBy: null,
};
const companyWithPush = {
  id: "gc-1",
  requiredTalkId: "talk-1",
  requiredTalkPushedAt: "2026-09-01T00:00:00.000Z",
  requiredTalkPushedBy: "user-1",
};

describe("policyPush service: listPickerTalks", () => {
  it("delegates to talksService.listGlobal", async () => {
    listGlobalSpy.mockReset().mockResolvedValue([{ id: "talk-1", title: "Fall Protection" }]);

    await expect(listPickerTalks()).resolves.toEqual([
      { id: "talk-1", title: "Fall Protection" },
    ]);
    expect(listGlobalSpy).toHaveBeenCalled();
  });
});

describe("policyPush service: getCurrentPush", () => {
  let talkSingle;
  let talkEqId;
  let talkSelect;
  let userSingle;
  let userEq;
  let userSelect;

  beforeEach(() => {
    assertPolicyPushSpy.mockReset().mockResolvedValue(undefined);
    getCompanySpy.mockReset().mockResolvedValue(companyWithPush);

    talkSingle = vi.fn().mockResolvedValue({ data: { title: "Fall Protection" }, error: null });
    talkEqId = vi.fn(() => ({ single: talkSingle }));
    talkSelect = vi.fn(() => ({ eq: talkEqId }));

    userSingle = vi.fn().mockResolvedValue({ data: { name: "Jane Admin" }, error: null });
    userEq = vi.fn(() => ({ single: userSingle }));
    userSelect = vi.fn(() => ({ eq: userEq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { select: talkSelect };
      if (table === "users") return { select: userSelect };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("returns the no-push shape without querying the talk or user tables", async () => {
    getCompanySpy.mockResolvedValue(companyNoPush);

    await expect(getCurrentPush("gc-1")).resolves.toEqual({
      talkId: null,
      talkTitle: null,
      pushedAt: null,
      pushedByName: null,
    });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("returns the current push with the talk's title and the pusher's name", async () => {
    await expect(getCurrentPush("gc-1")).resolves.toEqual({
      talkId: "talk-1",
      talkTitle: "Fall Protection",
      pushedAt: "2026-09-01T00:00:00.000Z",
      pushedByName: "Jane Admin",
    });
    expect(talkEqId).toHaveBeenCalledWith("id", "talk-1");
    expect(userEq).toHaveBeenCalledWith("id", "user-1");
  });

  it("degrades to a null talk title and pusher name when the referenced rows no longer exist", async () => {
    talkSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    userSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const result = await getCurrentPush("gc-1");

    expect(result.talkTitle).toBeNull();
    expect(result.pushedByName).toBeNull();
    expect(result.talkId).toBe("talk-1");
  });

  it("returns a null pusher name without querying the users table when required_talk_pushed_by is null", async () => {
    getCompanySpy.mockResolvedValue({ ...companyWithPush, requiredTalkPushedBy: null });

    const result = await getCurrentPush("gc-1");

    expect(result.pushedByName).toBeNull();
    expect(fromSpy).not.toHaveBeenCalledWith("users");
  });

  it("propagates a 403 PLAN_LIMIT for a non-Portfolio GC", async () => {
    const planError = Object.assign(new Error("Upgrade to use this"), {
      statusCode: 403,
      data: { code: "PLAN_LIMIT" },
    });
    assertPolicyPushSpy.mockRejectedValue(planError);

    await expect(getCurrentPush("gc-1")).rejects.toBe(planError);
  });

  it("throws a 502 when the talk lookup fails for another reason", async () => {
    talkSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    await expect(getCurrentPush("gc-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load the talk",
    });
  });

  it("throws a 502 when the user lookup fails for another reason", async () => {
    userSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    await expect(getCurrentPush("gc-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load the user",
    });
  });
});

describe("policyPush service: pushRequiredTopic", () => {
  let talkSingle;
  let talkEqGlobal;
  let talkEqId;
  let talkSelect;
  let userSingle;
  let userEq;
  let userSelect;

  beforeEach(() => {
    assertPolicyPushSpy.mockReset().mockResolvedValue(undefined);
    setRequiredTopicSpy.mockReset().mockResolvedValue(companyWithPush);

    talkSingle = vi.fn().mockResolvedValue({ data: { id: "talk-1", title: "Fall Protection" }, error: null });
    talkEqGlobal = vi.fn(() => ({ single: talkSingle }));
    talkEqId = vi.fn(() => ({ single: talkSingle, eq: talkEqGlobal }));
    talkSelect = vi.fn(() => ({ eq: talkEqId }));

    userSingle = vi.fn().mockResolvedValue({ data: { name: "Jane Admin" }, error: null });
    userEq = vi.fn(() => ({ single: userSingle }));
    userSelect = vi.fn(() => ({ eq: userEq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { select: talkSelect };
      if (table === "users") return { select: userSelect };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("pushes the required topic and returns its state", async () => {
    const result = await pushRequiredTopic("gc-1", { talkId: "talk-1", pushedByUserId: "user-1" });

    expect(talkSelect).toHaveBeenCalledWith("id, title");
    expect(talkEqId).toHaveBeenCalledWith("id", "talk-1");
    expect(talkEqGlobal).toHaveBeenCalledWith("is_global", true);
    expect(setRequiredTopicSpy).toHaveBeenCalledWith("gc-1", {
      talkId: "talk-1",
      pushedByUserId: "user-1",
    });
    expect(result).toEqual({
      talkId: "talk-1",
      talkTitle: "Fall Protection",
      pushedAt: "2026-09-01T00:00:00.000Z",
      pushedByName: "Jane Admin",
    });
  });

  it("replacing an existing push is just a second call with the new talkId", async () => {
    setRequiredTopicSpy.mockResolvedValue({
      ...companyWithPush,
      requiredTalkId: "talk-2",
    });
    talkSingle.mockResolvedValue({ data: { id: "talk-2", title: "Ladder Safety" }, error: null });

    const result = await pushRequiredTopic("gc-1", { talkId: "talk-2", pushedByUserId: "user-1" });

    expect(result.talkId).toBe("talk-2");
    expect(result.talkTitle).toBe("Ladder Safety");
  });

  it("throws a 403 PLAN_LIMIT for a non-Portfolio GC, without validating the talk", async () => {
    const planError = Object.assign(new Error("Upgrade to use this"), {
      statusCode: 403,
      data: { code: "PLAN_LIMIT" },
    });
    assertPolicyPushSpy.mockRejectedValue(planError);

    await expect(
      pushRequiredTopic("gc-1", { talkId: "talk-1", pushedByUserId: "user-1" }),
    ).rejects.toBe(planError);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("throws a 404 when talkId isn't a global talk (unknown, or a custom talk)", async () => {
    talkSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    await expect(
      pushRequiredTopic("gc-1", { talkId: "custom-talk", pushedByUserId: "user-1" }),
    ).rejects.toMatchObject({ statusCode: 404, message: "Talk not found" });
    expect(setRequiredTopicSpy).not.toHaveBeenCalled();
  });

  it("throws a 502 when the talk lookup fails for another reason", async () => {
    talkSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    await expect(
      pushRequiredTopic("gc-1", { talkId: "talk-1", pushedByUserId: "user-1" }),
    ).rejects.toMatchObject({ statusCode: 502, message: "Could not load the talk" });
  });
});

describe("policyPush service: clearRequiredTopic", () => {
  beforeEach(() => {
    assertPolicyPushSpy.mockReset().mockResolvedValue(undefined);
    clearRequiredTopicSpy.mockReset().mockResolvedValue(companyNoPush);
  });

  it("clears the topic for a Portfolio GC", async () => {
    await expect(clearRequiredTopic("gc-1")).resolves.toBeUndefined();
    expect(clearRequiredTopicSpy).toHaveBeenCalledWith("gc-1");
  });

  it("is a no-op (still resolves) when nothing is currently pushed", async () => {
    clearRequiredTopicSpy.mockResolvedValue(companyNoPush);

    await expect(clearRequiredTopic("gc-1")).resolves.toBeUndefined();
  });

  it("throws a 403 PLAN_LIMIT for a non-Portfolio GC", async () => {
    const planError = Object.assign(new Error("Upgrade to use this"), {
      statusCode: 403,
      data: { code: "PLAN_LIMIT" },
    });
    assertPolicyPushSpy.mockRejectedValue(planError);

    await expect(clearRequiredTopic("gc-1")).rejects.toBe(planError);
    expect(clearRequiredTopicSpy).not.toHaveBeenCalled();
  });
});

describe("policyPush service: getComplianceRollup", () => {
  let talkSingle;
  let talkEqId;
  let talkSelect;
  let userSingle;
  let userEq;
  let userSelect;

  const args = { date: "2026-09-21", tzOffset: 0 };

  const jobsiteRow = (overrides) => ({
    id: "jobsite-1",
    name: "Riverside Tower",
    createdBySub: false,
    subIds: ["sub-1", "sub-2"],
    ...overrides,
  });

  const project = (overrides) => ({
    id: "project-1",
    ownerCompanyId: "sub-1",
    jobsiteId: "jobsite-1",
    status: "active",
    archivedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    assertPolicyPushSpy.mockReset().mockResolvedValue(undefined);
    getCompanySpy.mockReset().mockResolvedValue(companyWithPush);
    listActiveJobsitesSpy.mockReset().mockResolvedValue([jobsiteRow()]);
    listLinkedProjectsSpy.mockReset().mockResolvedValue([project()]);
    getCompanyNamesByIdsSpy.mockReset().mockResolvedValue(
      new Map([
        ["sub-1", "Acme Roofing"],
        ["sub-2", "Zenith Electric"],
      ]),
    );

    talkSingle = vi.fn().mockResolvedValue({ data: { title: "Fall Protection" }, error: null });
    talkEqId = vi.fn(() => ({ single: talkSingle }));
    talkSelect = vi.fn(() => ({ eq: talkEqId }));

    userSingle = vi.fn().mockResolvedValue({ data: { name: "Jane Admin" }, error: null });
    userEq = vi.fn(() => ({ single: userSingle }));
    userSelect = vi.fn(() => ({ eq: userEq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { select: talkSelect };
      if (table === "users") return { select: userSelect };
      if (table === "meeting_logs") return chain({ data: [], error: null });
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("short-circuits to an empty compliance shape, with no jobsite/project queries, when nothing is currently pushed", async () => {
    getCompanySpy.mockResolvedValue(companyNoPush);

    const result = await getComplianceRollup("gc-1", args);

    expect(result).toEqual({
      talkId: null,
      talkTitle: null,
      pushedAt: null,
      pushedByName: null,
      jobsites: [],
      totals: { subs: 0, logged: 0, missing: 0 },
    });
    expect(listActiveJobsitesSpy).not.toHaveBeenCalled();
    expect(listLinkedProjectsSpy).not.toHaveBeenCalled();
  });

  it("returns a per-jobsite compliance rollup, mixing logged and missing subs across two jobsites", async () => {
    listActiveJobsitesSpy.mockResolvedValue([
      jobsiteRow(),
      jobsiteRow({ id: "jobsite-2", name: "North Site", subIds: ["sub-3"] }),
    ]);
    listLinkedProjectsSpy.mockResolvedValue([
      project(),
      project({ id: "project-2", ownerCompanyId: "sub-2", jobsiteId: "jobsite-1" }),
      project({ id: "project-3", ownerCompanyId: "sub-3", jobsiteId: "jobsite-2" }),
    ]);
    getCompanyNamesByIdsSpy.mockResolvedValue(
      new Map([
        ["sub-1", "Acme Roofing"],
        ["sub-2", "Zenith Electric"],
        ["sub-3", "North Star Plumbing"],
      ]),
    );
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { select: talkSelect };
      if (table === "users") return { select: userSelect };
      if (table === "meeting_logs") {
        return chain({
          data: [{ project_id: "project-1", held_at: "2026-09-05T00:00:00.000Z" }],
          error: null,
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await getComplianceRollup("gc-1", args);

    // North Site sorts before Riverside Tower alphabetically.
    expect(result.jobsites.map((j) => j.id)).toEqual(["jobsite-2", "jobsite-1"]);
    const riverside = result.jobsites.find((j) => j.id === "jobsite-1");
    expect(riverside.subs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ companyId: "sub-1", status: "logged" }),
        expect.objectContaining({ companyId: "sub-2", status: "missing" }),
      ]),
    );
    const northSite = result.jobsites.find((j) => j.id === "jobsite-2");
    expect(northSite.subs).toEqual([
      expect.objectContaining({ companyId: "sub-3", status: "missing" }),
    ]);
    expect(result.totals).toEqual({ subs: 3, logged: 1, missing: 2 });
  });

  it("excludes a log held before the topic was pushed", async () => {
    getCompanySpy.mockResolvedValue({
      ...companyWithPush,
      requiredTalkPushedAt: "2026-09-10T00:00:00.000Z",
    });
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { select: talkSelect };
      if (table === "users") return { select: userSelect };
      if (table === "meeting_logs") {
        return chain({
          data: [{ project_id: "project-1", held_at: "2026-09-05T00:00:00.000Z" }],
          error: null,
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await getComplianceRollup("gc-1", args);

    const sub1 = result.jobsites[0].subs.find((s) => s.companyId === "sub-1");
    expect(sub1.status).toBe("missing");
  });

  it("queries meeting_logs filtered by the pushed talk id and since pushedAt", async () => {
    let logsChain;
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { select: talkSelect };
      if (table === "users") return { select: userSelect };
      if (table === "meeting_logs") {
        logsChain = chain({ data: [], error: null });
        return logsChain;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await getComplianceRollup("gc-1", args);

    expect(logsChain.eq).toHaveBeenCalledWith("talk_id", "talk-1");
    expect(logsChain.gte).toHaveBeenCalledWith("held_at", "2026-09-01T00:00:00.000Z");
  });

  it("propagates a 403 PLAN_LIMIT for a non-Portfolio GC", async () => {
    const planError = Object.assign(new Error("Upgrade to use this"), {
      statusCode: 403,
      data: { code: "PLAN_LIMIT" },
    });
    assertPolicyPushSpy.mockRejectedValue(planError);

    await expect(getComplianceRollup("gc-1", args)).rejects.toBe(planError);
  });

  it("throws a 502 when the meeting_logs query fails", async () => {
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { select: talkSelect };
      if (table === "users") return { select: userSelect };
      if (table === "meeting_logs") return chain({ data: null, error: new Error("db down") });
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(getComplianceRollup("gc-1", args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load meeting logs",
    });
  });
});

describe("policyPush service: getRequiredTopicForProject", () => {
  let jobsiteSingle;
  let jobsiteEq;
  let jobsiteSelect;
  let talkSingle;
  let talkEqId;
  let talkSelect;

  const activeJobsiteRow = {
    gc_company_id: "gc-1",
    status: "active",
    archived_at: null,
  };

  beforeEach(() => {
    getProjectByIdSpy.mockReset().mockResolvedValue({ id: "project-1", jobsiteId: "jobsite-1" });
    getCompanySpy.mockReset().mockResolvedValue(companyWithPush);
    assertPolicyPushSpy.mockReset().mockResolvedValue(undefined);

    jobsiteSingle = vi.fn().mockResolvedValue({ data: activeJobsiteRow, error: null });
    jobsiteEq = vi.fn(() => ({ single: jobsiteSingle }));
    jobsiteSelect = vi.fn(() => ({ eq: jobsiteEq }));

    talkSingle = vi.fn().mockResolvedValue({ data: { title: "Fall Protection" }, error: null });
    talkEqId = vi.fn(() => ({ single: talkSingle }));
    talkSelect = vi.fn(() => ({ eq: talkEqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "jobsites") return { select: jobsiteSelect };
      if (table === "toolbox_talks") return { select: talkSelect };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("returns the null shape for an unlinked project, without querying jobsites", async () => {
    getProjectByIdSpy.mockResolvedValue({ id: "project-1", jobsiteId: null });

    await expect(getRequiredTopicForProject("project-1", "sub-1")).resolves.toEqual({
      talkId: null,
      talkTitle: null,
      pushedAt: null,
    });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("returns the null shape when the jobsite no longer exists", async () => {
    jobsiteSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    await expect(getRequiredTopicForProject("project-1", "sub-1")).resolves.toEqual({
      talkId: null,
      talkTitle: null,
      pushedAt: null,
    });
  });

  it("returns the null shape when the jobsite is inactive", async () => {
    jobsiteSingle.mockResolvedValue({ data: { ...activeJobsiteRow, status: "completed" }, error: null });

    await expect(getRequiredTopicForProject("project-1", "sub-1")).resolves.toEqual({
      talkId: null,
      talkTitle: null,
      pushedAt: null,
    });
  });

  it("returns the null shape when the jobsite is archived", async () => {
    jobsiteSingle.mockResolvedValue({
      data: { ...activeJobsiteRow, archived_at: "2026-01-01T00:00:00.000Z" },
      error: null,
    });

    await expect(getRequiredTopicForProject("project-1", "sub-1")).resolves.toEqual({
      talkId: null,
      talkTitle: null,
      pushedAt: null,
    });
  });

  it("returns the null shape when the linked GC has no current push", async () => {
    getCompanySpy.mockResolvedValue(companyNoPush);

    await expect(getRequiredTopicForProject("project-1", "sub-1")).resolves.toEqual({
      talkId: null,
      talkTitle: null,
      pushedAt: null,
    });
  });

  it("returns the required topic for an in-scope project, with no plan gate", async () => {
    const result = await getRequiredTopicForProject("project-1", "sub-1");

    expect(result).toEqual({
      talkId: "talk-1",
      talkTitle: "Fall Protection",
      pushedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(assertPolicyPushSpy).not.toHaveBeenCalled();
  });

  it("propagates a 404 when the project isn't the caller's own", async () => {
    getProjectByIdSpy.mockRejectedValue(
      Object.assign(new Error("Project not found"), { statusCode: 404 }),
    );

    await expect(getRequiredTopicForProject("project-1", "sub-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws a 502 when the jobsite lookup fails for another reason", async () => {
    jobsiteSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    await expect(getRequiredTopicForProject("project-1", "sub-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load the job site",
    });
  });
});
