// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const gcDashboardService = require("./gcDashboard");
const jobsitesService = require("./jobsites");
const smsService = require("./sms");
const smsNudges = require("./smsNudges");

const fromSpy = vi.spyOn(supabase, "from");
const listLinkedProjectsSpy = vi.spyOn(gcDashboardService, "listLinkedProjects");
const listLogsSpy = vi.spyOn(gcDashboardService, "listCompletedLogsInWindow");
const getOwnedJobsiteSpy = vi.spyOn(jobsitesService, "getOwnedJobsite");
const sendSmsSpy = vi.spyOn(smsService, "sendSms");

// A self-returning query chain that resolves to `result` when awaited.
const chain = (result) => {
  const builder = {};
  [
    "select", "eq", "in", "not", "is", "or", "order", "insert", "update", "upsert", "delete",
    "single", "maybeSingle",
  ].forEach((method) => {
    builder[method] = vi.fn(() => builder);
  });
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
};

// Routes supabase.from(table) to a queue of results per table.
const mockTables = (tables) => {
  const builders = {};
  fromSpy.mockImplementation((table) => {
    const queue = tables[table];
    const result = queue.length > 1 ? queue.shift() : queue[0];
    builders[table] = [...(builders[table] ?? []), chain(result)];
    return builders[table].at(-1);
  });
  return builders;
};

const ok = (data) => ({ data, error: null });
const fail = (code = "X") => ({ data: null, error: { code, message: "boom" } });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  sendSmsSpy.mockResolvedValue({ sent: true });
});

afterEach(() => {
  vi.clearAllMocks();
  fromSpy.mockReset();
});

const recipientRow = {
  id: "r1",
  sub_company_id: "sub1",
  user_id: "u1",
  jobsite_id: null,
  phone: "+15125550123",
  source: "foreman",
  consented_at: "2026-10-01T00:00:00Z",
  confirmed_at: "2026-10-01T00:00:00Z",
  opted_out_at: null,
};

describe("foreman opt-in", () => {
  it("getMine maps the row, or null when none", async () => {
    mockTables({ sms_recipients: [ok(recipientRow)] });
    expect(await smsNudges.getMine("u1")).toMatchObject({
      id: "r1",
      phone: "+15125550123",
      optedOut: false,
    });

    mockTables({ sms_recipients: [ok(null)] });
    expect(await smsNudges.getMine("u1")).toBeNull();
  });

  it("getMine surfaces a query failure as 502", async () => {
    mockTables({ sms_recipients: [fail()] });
    await expect(smsNudges.getMine("u1")).rejects.toMatchObject({ statusCode: 502 });
  });

  it("setMine stores the normalized E.164 number, confirmed and not opted out", async () => {
    const builders = mockTables({ sms_recipients: [ok(recipientRow)] });
    await smsNudges.setMine({ userId: "u1", subCompanyId: "sub1", phone: "(512) 555-0123" });

    const [row, options] = builders.sms_recipients[0].upsert.mock.calls[0];
    expect(row).toMatchObject({
      user_id: "u1",
      sub_company_id: "sub1",
      phone: "+15125550123",
      source: "foreman",
      opted_out_at: null,
    });
    expect(row.confirmed_at).toBe(row.consented_at);
    expect(options).toEqual({ onConflict: "user_id" });
  });

  it("setMine rejects an invalid phone with 400", async () => {
    await expect(
      smsNudges.setMine({ userId: "u1", subCompanyId: "sub1", phone: "123" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("setMine surfaces a write failure as 502", async () => {
    mockTables({ sms_recipients: [fail()] });
    await expect(
      smsNudges.setMine({ userId: "u1", subCompanyId: "sub1", phone: "5125550123" }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("clearMine deletes the caller's row and surfaces failures", async () => {
    const builders = mockTables({ sms_recipients: [ok(null)] });
    await smsNudges.clearMine("u1");
    expect(builders.sms_recipients[0].eq).toHaveBeenCalledWith("user_id", "u1");

    mockTables({ sms_recipients: [fail()] });
    await expect(smsNudges.clearMine("u1")).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("GC-entered numbers", () => {
  const siteProJobsite = { id: "j1", name: "Tower", sitePro: true, gcCompanyName: "Acme GC" };

  it("listForJobsite returns mapped GC rows", async () => {
    getOwnedJobsiteSpy.mockResolvedValue(siteProJobsite);
    mockTables({
      sms_recipients: [
        ok([{ ...recipientRow, source: "gc", jobsite_id: "j1", companies: { name: "Acme Electric" } }]),
      ],
    });
    const list = await smsNudges.listForJobsite({ jobsiteId: "j1", gcCompanyId: "gc1" });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ jobsiteId: "j1", source: "gc", subCompanyName: "Acme Electric" });
  });

  it("listForJobsite surfaces a failure as 502", async () => {
    getOwnedJobsiteSpy.mockResolvedValue(siteProJobsite);
    mockTables({ sms_recipients: [fail()] });
    await expect(
      smsNudges.listForJobsite({ jobsiteId: "j1", gcCompanyId: "gc1" }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  const add = (overrides = {}) =>
    smsNudges.addForJobsite({
      jobsiteId: "j1",
      gcCompanyId: "gc1",
      rosterId: "m1",
      phone: "512-555-0123",
      ...overrides,
    });

  it("addForJobsite inserts an unconfirmed row and texts a YES request", async () => {
    getOwnedJobsiteSpy.mockResolvedValue(siteProJobsite);
    const builders = mockTables({
      jobsite_subcontractors: [ok({ sub_company_id: "sub1" })],
      sms_recipients: [ok({ ...recipientRow, source: "gc", confirmed_at: null })],
    });

    const result = await add();

    const [row] = builders.sms_recipients[0].insert.mock.calls[0];
    expect(builders.jobsite_subcontractors[0].eq).toHaveBeenCalledWith("id", "m1");
    expect(row).toMatchObject({ jobsite_id: "j1", sub_company_id: "sub1", phone: "+15125550123", source: "gc" });
    expect(row).not.toHaveProperty("confirmed_at");
    expect(sendSmsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+15125550123", body: expect.stringContaining("Reply YES") }),
    );
    expect(result.confirmedAt).toBeNull();
  });

  it("addForJobsite is a 403 PLAN_LIMIT without Site Pro access", async () => {
    getOwnedJobsiteSpy.mockResolvedValue({ ...siteProJobsite, sitePro: false });
    await expect(add()).rejects.toMatchObject({ statusCode: 403, data: { code: "PLAN_LIMIT" } });
  });

  it("addForJobsite rejects an invalid phone with 400", async () => {
    getOwnedJobsiteSpy.mockResolvedValue(siteProJobsite);
    await expect(add({ phone: "nope" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("addForJobsite is a 404 when the sub is not an accepted member", async () => {
    getOwnedJobsiteSpy.mockResolvedValue(siteProJobsite);
    mockTables({ jobsite_subcontractors: [ok(null)] });
    await expect(add()).rejects.toMatchObject({ statusCode: 404 });
  });

  it("addForJobsite surfaces a roster lookup failure as 502", async () => {
    getOwnedJobsiteSpy.mockResolvedValue(siteProJobsite);
    mockTables({ jobsite_subcontractors: [fail()] });
    await expect(add()).rejects.toMatchObject({ statusCode: 502 });
  });

  it("addForJobsite maps a duplicate to 409 and other failures to 502", async () => {
    getOwnedJobsiteSpy.mockResolvedValue(siteProJobsite);
    mockTables({ jobsite_subcontractors: [ok({ sub_company_id: "sub1" })], sms_recipients: [fail("23505")] });
    await expect(add()).rejects.toMatchObject({ statusCode: 409 });

    mockTables({ jobsite_subcontractors: [ok({ sub_company_id: "sub1" })], sms_recipients: [fail()] });
    await expect(add()).rejects.toMatchObject({ statusCode: 502 });
  });

  it("addForJobsite falls back to a generic GC name in the confirmation text", async () => {
    getOwnedJobsiteSpy.mockResolvedValue({ ...siteProJobsite, gcCompanyName: null });
    mockTables({ jobsite_subcontractors: [ok({ sub_company_id: "sub1" })], sms_recipients: [ok(recipientRow)] });
    await add();
    expect(sendSmsSpy.mock.calls[0][0].body).toContain("A general contractor");
  });

  it("removeForJobsite deletes only the GC row for that site, 404 when nothing matched", async () => {
    getOwnedJobsiteSpy.mockResolvedValue(siteProJobsite);
    const builders = mockTables({ sms_recipients: [ok([{ id: "r1" }])] });
    await smsNudges.removeForJobsite({ jobsiteId: "j1", recipientId: "r1", gcCompanyId: "gc1" });
    expect(builders.sms_recipients[0].eq).toHaveBeenCalledWith("source", "gc");

    mockTables({ sms_recipients: [ok([])] });
    await expect(
      smsNudges.removeForJobsite({ jobsiteId: "j1", recipientId: "r1", gcCompanyId: "gc1" }),
    ).rejects.toMatchObject({ statusCode: 404 });

    mockTables({ sms_recipients: [fail()] });
    await expect(
      smsNudges.removeForJobsite({ jobsiteId: "j1", recipientId: "r1", gcCompanyId: "gc1" }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("handleInbound", () => {
  const from = "+15125550123";

  it("STOP opts every row with that phone out, with no reply", async () => {
    const builders = mockTables({ sms_recipients: [ok(null)] });
    expect(await smsNudges.handleInbound({ from, body: " stop " })).toBeNull();
    const [patch] = builders.sms_recipients[0].update.mock.calls[0];
    expect(patch.opted_out_at).toEqual(expect.any(String));
    expect(builders.sms_recipients[0].eq).toHaveBeenCalledWith("phone", from);
  });

  it("START clears the opt-out, with no reply", async () => {
    const builders = mockTables({ sms_recipients: [ok(null)] });
    expect(await smsNudges.handleInbound({ from, body: "START" })).toBeNull();
    expect(builders.sms_recipients[0].update).toHaveBeenCalledWith({ opted_out_at: null });
  });

  it("YES confirms only unconfirmed rows and answers", async () => {
    const builders = mockTables({ sms_recipients: [ok(null)] });
    const reply = await smsNudges.handleInbound({ from, body: "Yes" });
    expect(reply).toContain("confirmed");
    expect(builders.sms_recipients[0].is).toHaveBeenCalledWith("confirmed_at", null);
  });

  it("ignores any other message", async () => {
    expect(await smsNudges.handleInbound({ from, body: "hello" })).toBeNull();
    expect(await smsNudges.handleInbound({ from, body: undefined })).toBeNull();
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("surfaces write failures as 502", async () => {
    mockTables({ sms_recipients: [fail()] });
    await expect(smsNudges.handleInbound({ from, body: "STOP" })).rejects.toMatchObject({
      statusCode: 502,
    });
    mockTables({ sms_recipients: [fail()] });
    await expect(smsNudges.handleInbound({ from, body: "YES" })).rejects.toMatchObject({
      statusCode: 502,
    });
  });
});

describe("runNudgeTick", () => {
  // Mon 2026-10-05 12:00 UTC = 07:00 in Chicago (CDT).
  const MONDAY_7AM_CHICAGO = new Date("2026-10-05T12:00:00Z");

  const jobsiteRow = (overrides = {}) => ({
    id: "j1",
    gc_company_id: "gc1",
    name: "Tower",
    plan: "site_pro",
    timezone: "America/Chicago",
    sms_last_nudged_on: null,
    companies: { tier: "basic" },
    jobsite_subcontractors: [
      { sub_company_id: "subA", accepted_at: "2026-01-01T00:00:00Z" },
      { sub_company_id: "subB", accepted_at: "2026-01-01T00:00:00Z" },
      { sub_company_id: null, accepted_at: null },
    ],
    ...overrides,
  });

  const project = (id, owner, extra = {}) => ({
    id,
    ownerCompanyId: owner,
    jobsiteId: "j1",
    status: "active",
    archivedAt: null,
    ...extra,
  });

  // Defaults: subA logged last week, subB did not; subB has one confirmed phone.
  const setup = ({ jobsites = [jobsiteRow()], claim = [{ id: "j1" }], phones = [{ phone: "+15125550123" }] } = {}) => {
    listLinkedProjectsSpy.mockResolvedValue([project("pA", "subA"), project("pB", "subB")]);
    listLogsSpy.mockResolvedValue([{ project_id: "pA", held_at: "2026-09-30T15:00:00Z" }]);
    return mockTables({
      jobsites: [ok(jobsites), ok(claim)],
      sms_recipients: [ok(phones)],
    });
  };

  it("texts the missing sub's confirmed phones at Monday 7:00 local", async () => {
    const builders = setup();

    const sent = await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO);

    expect(sent).toBe(1);
    expect(sendSmsSpy).toHaveBeenCalledTimes(1);
    expect(sendSmsSpy).toHaveBeenCalledWith({
      to: "+15125550123",
      body: expect.stringContaining("Tower"),
    });
    // Looked only at the sub with no log last week.
    expect(builders.sms_recipients[0].in).toHaveBeenCalledWith("sub_company_id", ["subB"]);
    // Scored last week's Monday-Sunday window: Sep 28 00:00 -> Oct 5 00:00 CDT.
    expect(listLogsSpy).toHaveBeenCalledWith(["pA", "pB"], {
      start: "2026-09-28T05:00:00.000Z",
      end: "2026-10-05T05:00:00.000Z",
    });
    // Claimed this local Monday before sending.
    expect(builders.jobsites[1].update).toHaveBeenCalledWith({ sms_last_nudged_on: "2026-10-05" });
  });

  it("de-duplicates a phone shared by several rows", async () => {
    setup({ phones: [{ phone: "+15125550123" }, { phone: "+15125550123" }] });
    expect(await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).toBe(1);
  });

  it("counts only messages that were actually sent", async () => {
    setup();
    sendSmsSpy.mockResolvedValue({ sent: false });
    expect(await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).toBe(0);
  });

  it("does nothing outside Monday 7:00 local", async () => {
    setup();
    expect(await smsNudges.runNudgeTick(new Date("2026-10-05T13:00:00Z"))).toBe(0); // 08:00
    expect(await smsNudges.runNudgeTick(new Date("2026-10-06T12:00:00Z"))).toBe(0); // Tuesday
    expect(sendSmsSpy).not.toHaveBeenCalled();
  });

  it("skips a site with no timezone, a bad timezone, or no Site Pro access", async () => {
    setup({
      jobsites: [
        jobsiteRow({ id: "j1", timezone: null }),
        jobsiteRow({ id: "j2", timezone: "Not/AZone" }),
        jobsiteRow({ id: "j3", plan: "free", companies: { tier: "basic" } }),
      ],
    });
    expect(await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).toBe(0);
    expect(sendSmsSpy).not.toHaveBeenCalled();
  });

  it("treats a GC Portfolio company as entitled on a free site", async () => {
    setup({ jobsites: [jobsiteRow({ plan: "free", companies: { tier: "premium" } })] });
    expect(await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).toBe(1);
  });

  it("skips a site already nudged this local Monday", async () => {
    setup({ jobsites: [jobsiteRow({ sms_last_nudged_on: "2026-10-05" })] });
    expect(await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).toBe(0);
  });

  it("sends nothing when another tick already claimed the week", async () => {
    setup({ claim: [] });
    expect(await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).toBe(0);
    expect(sendSmsSpy).not.toHaveBeenCalled();
  });

  it("sends nothing when every sub logged last week", async () => {
    setup();
    listLogsSpy.mockResolvedValue([
      { project_id: "pA", held_at: "2026-09-30T15:00:00Z" },
      { project_id: "pB", held_at: "2026-10-01T15:00:00Z" },
    ]);
    expect(await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).toBe(0);
  });

  it("ignores subs that joined after last week ended and sites with an empty roster", async () => {
    setup({
      jobsites: [
        jobsiteRow({
          jobsite_subcontractors: [{ sub_company_id: "subC", accepted_at: "2026-10-05T10:00:00Z" }],
        }),
      ],
    });
    expect(await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).toBe(0);
    expect(listLinkedProjectsSpy).not.toHaveBeenCalled();
  });

  it("ignores archived or inactive projects and nothing-to-text when no phones are on file", async () => {
    setup({ phones: [] });
    listLinkedProjectsSpy.mockResolvedValue([
      project("pA", "subA"),
      project("pB", "subB", { archivedAt: "2026-09-01T00:00:00Z" }),
    ]);
    listLogsSpy.mockResolvedValue([]);
    expect(await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).toBe(0);
    expect(listLogsSpy).toHaveBeenCalledWith(["pA"], expect.any(Object));
  });

  it("logs a failure on one site and carries on with the next", async () => {
    setup({ jobsites: [jobsiteRow({ id: "j1" }), jobsiteRow({ id: "j2" })] });
    listLinkedProjectsSpy.mockRejectedValueOnce(new Error("db down"));
    listLinkedProjectsSpy.mockResolvedValueOnce([project("pB", "subB", { jobsiteId: "j2" })]);
    listLogsSpy.mockResolvedValue([]);

    expect(await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });

  it("throws a 502 when the jobsite list cannot be loaded", async () => {
    mockTables({ jobsites: [fail()] });
    await expect(smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it("logs a claim failure, a recipient-lookup failure and moves on", async () => {
    setup({ jobsites: [jobsiteRow()] });
    mockTables({ jobsites: [ok([jobsiteRow()]), fail()] });
    expect(await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).toBe(0);

    mockTables({ jobsites: [ok([jobsiteRow()]), ok([{ id: "j1" }])], sms_recipients: [fail()] });
    expect(await smsNudges.runNudgeTick(MONDAY_7AM_CHICAGO)).toBe(0);
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it("defaults to the current time", async () => {
    mockTables({ jobsites: [ok([])] });
    expect(await smsNudges.runNudgeTick()).toBe(0);
  });
});
