// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const projectsService = require("./projects");
const companiesService = require("./companies");
const subAccessService = require("./subAccess");
const {
  create,
  listForGc,
  update: updateJobsite,
  createInvite,
  previewInvite,
  acceptInvite,
  removeSubcontractor,
} = require("./jobsites");

const JOBSITE_COLUMNS =
  "id, gc_company_id, name, status, archived_at, origin, created_at";
const LIST_SELECT = `${JOBSITE_COLUMNS}, jobsite_subcontractors(id, sub_company_id, invited_email, accepted_at, companies(name))`;
const ROSTER_COLUMNS =
  "id, jobsite_id, sub_company_id, invited_email, token, expires_at, accepted_at";

const dbRow = {
  id: "jobsite-1",
  gc_company_id: "gc-1",
  name: "Riverside Tower",
  status: "active",
  archived_at: null,
  origin: "gc",
  created_at: "2026-01-01T00:00:00.000Z",
};

const mappedJobsite = {
  id: "jobsite-1",
  gcCompanyId: "gc-1",
  name: "Riverside Tower",
  status: "active",
  archivedAt: null,
  createdBySub: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const fromSpy = vi.spyOn(supabase, "from");
const getCompanySpy = vi.spyOn(companiesService, "getById");
const unlockedSpy = vi.spyOn(subAccessService, "getUnlockedSubIds");

// Phase 9d defaults: nothing locked; a GC Free company (cap of 1 live jobsite).
beforeEach(() => {
  unlockedSpy.mockReset().mockResolvedValue(null);
  getCompanySpy.mockReset().mockResolvedValue({ id: "gc-1", companyType: "gc", tier: "basic" });
});

// A chainable, awaitable count query. Each await resolves to the next value in
// `counts` (the cap check awaits the paid-site count first, then the live count).
const countQuery = (counts, error = null) => {
  const query = {};
  ["select", "eq", "is"].forEach((method) => {
    query[method] = vi.fn(() => query);
  });
  query.then = (resolve, reject) =>
    Promise.resolve({ count: counts.shift(), error }).then(resolve, reject);
  return query;
};

describe("jobsites service: create", () => {
  let single;
  let select;
  let insert;
  let capQuery;

  const routeJobsites = () =>
    fromSpy.mockImplementation((table) => {
      if (table !== "jobsites") throw new Error(`Unexpected table: ${table}`);
      // Cap counts start with select(..., { head: true }); the insert chain is separate.
      return { insert, select: capQuery.select };
    });

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    select = vi.fn(() => ({ single }));
    insert = vi.fn(() => ({ select }));
    capQuery = countQuery([0, 0]);

    fromSpy.mockReset();
    routeJobsites();
  });

  it("should throw a 403 PLAN_LIMIT and insert nothing when GC Free already has its one live jobsite", async () => {
    // Arrange
    capQuery = countQuery([0, 1]);
    fromSpy.mockReset();
    routeJobsites();

    // Act & Assert
    await expect(create({ gcCompanyId: "gc-1", name: "Second Site" })).rejects.toMatchObject({
      statusCode: 403,
      data: { code: "PLAN_LIMIT", limit: 1 },
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("should count only live (active, not archived) jobsites", async () => {
    // Act
    await create({ gcCompanyId: "gc-1", name: "Riverside Tower" });

    // Assert
    expect(capQuery.eq).toHaveBeenCalledWith("gc_company_id", "gc-1");
    expect(capQuery.eq).toHaveBeenCalledWith("status", "active");
    expect(capQuery.is).toHaveBeenCalledWith("archived_at", null);
    expect(capQuery.eq).toHaveBeenCalledWith("plan", "site_pro");
  });

  it("should raise a GC Free cap by one per live Site Pro jobsite", async () => {
    // Arrange: one paid site and two live sites -> limit 2, so a third is refused
    capQuery = countQuery([1, 2]);
    fromSpy.mockReset();
    routeJobsites();

    // Act & Assert
    await expect(create({ gcCompanyId: "gc-1", name: "Third" })).rejects.toMatchObject({
      statusCode: 403,
      data: { code: "PLAN_LIMIT", limit: 2 },
    });
  });

  it("should allow a Portfolio GC below its 10-site cap and refuse it at the cap", async () => {
    // Arrange
    getCompanySpy.mockResolvedValue({ id: "gc-1", companyType: "gc", tier: "premium" });
    capQuery = countQuery([0, 9]);
    fromSpy.mockReset();
    routeJobsites();

    // Act & Assert
    await expect(create({ gcCompanyId: "gc-1", name: "Tenth" })).resolves.toEqual(mappedJobsite);

    capQuery = countQuery([0, 10]);
    fromSpy.mockReset();
    routeJobsites();
    await expect(create({ gcCompanyId: "gc-1", name: "Eleventh" })).rejects.toMatchObject({
      statusCode: 403,
      data: { code: "PLAN_LIMIT", limit: 10 },
    });
  });

  it("should skip the live count for an unlimited Portfolio GC", async () => {
    // Arrange
    getCompanySpy.mockResolvedValue({ id: "gc-1", companyType: "gc", tier: "enterprise" });
    capQuery = countQuery([0]);
    fromSpy.mockReset();
    routeJobsites();

    // Act & Assert
    await expect(create({ gcCompanyId: "gc-1", name: "Any" })).resolves.toEqual(mappedJobsite);
  });

  it("should throw a 502 when the cap check fails", async () => {
    // Arrange
    capQuery = countQuery([null], { code: "X" });
    fromSpy.mockReset();
    routeJobsites();

    // Act & Assert
    await expect(create({ gcCompanyId: "gc-1", name: "Any" })).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not check your plan's job sites",
    });
  });

  it("should insert a server-generated id and the given gc_company_id/name, returning the mapped row", async () => {
    // Act
    const result = await create({ gcCompanyId: "gc-1", name: "Riverside Tower" });

    // Assert
    const payload = insert.mock.calls[0][0];
    expect(payload.gc_company_id).toBe("gc-1");
    expect(payload.name).toBe("Riverside Tower");
    expect(payload.origin).toBe("gc");
    expect(payload.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(select).toHaveBeenCalledWith(JOBSITE_COLUMNS);
    expect(result).toEqual(mappedJobsite);
  });

  it("should map a subcontractor-originated row to createdBySub true and a legacy null origin to false", async () => {
    // Arrange
    single.mockResolvedValueOnce({ data: { ...dbRow, origin: "subcontractor" }, error: null });
    single.mockResolvedValueOnce({ data: { ...dbRow, origin: null }, error: null });

    // Act
    const subCreated = await create({ gcCompanyId: "gc-1", name: "Riverside Tower" });
    const legacy = await create({ gcCompanyId: "gc-1", name: "Riverside Tower" });

    // Assert
    expect(subCreated.createdBySub).toBe(true);
    expect(legacy.createdBySub).toBe(false);
  });

  it("should throw a 502 AppError on a query failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(create({ gcCompanyId: "gc-1", name: "Riverside Tower" })).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not create the jobsite",
    });
  });
});

describe("jobsites service: listForGc", () => {
  let order;
  let eq;
  let select;

  beforeEach(() => {
    order = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    eq = vi.fn(() => ({ order }));
    select = vi.fn(() => ({ eq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "jobsites") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should list the caller's GC company's jobsites, newest first", async () => {
    // Act
    const result = await listForGc("gc-1");

    // Assert
    expect(select).toHaveBeenCalledWith(LIST_SELECT);
    expect(eq).toHaveBeenCalledWith("gc_company_id", "gc-1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual([{ ...mappedJobsite, subcontractors: [] }]);
  });

  it("should embed each jobsite's roster as pending/accepted subs and never expose a token", async () => {
    // Arrange
    order.mockResolvedValue({
      data: [
        {
          ...dbRow,
          jobsite_subcontractors: [
            { id: "sub-1", invited_email: "a@acme.com", accepted_at: null, companies: null },
            {
              id: "sub-2",
              invited_email: "b@roof.com",
              accepted_at: "2026-02-01T00:00:00.000Z",
              companies: { name: "Roof Co" },
              token: "leaked",
            },
          ],
        },
      ],
      error: null,
    });

    // Act
    const [jobsite] = await listForGc("gc-1");

    // Assert
    expect(jobsite.subcontractors).toEqual([
      { id: "sub-1", email: "a@acme.com", status: "pending", companyName: null, locked: false },
      { id: "sub-2", email: "b@roof.com", status: "accepted", companyName: "Roof Co", locked: false },
    ]);
  });

  it("should hide a locked sub's email and company name but never lock a pending invite", async () => {
    // Arrange
    unlockedSpy.mockResolvedValue(new Set(["sub-co-1"]));
    order.mockResolvedValue({
      data: [
        {
          ...dbRow,
          jobsite_subcontractors: [
            { id: "r-1", sub_company_id: "sub-co-1", invited_email: "a@acme.com", accepted_at: "2026-02-01T00:00:00.000Z", companies: { name: "Acme" } },
            { id: "r-2", sub_company_id: "sub-co-2", invited_email: "b@roof.com", accepted_at: "2026-03-01T00:00:00.000Z", companies: { name: "Roof Co" } },
            { id: "r-3", sub_company_id: null, invited_email: "c@new.com", accepted_at: null, companies: null },
          ],
        },
      ],
      error: null,
    });

    // Act
    const [jobsite] = await listForGc("gc-1");

    // Assert
    expect(jobsite.subcontractors).toEqual([
      { id: "r-1", email: "a@acme.com", status: "accepted", companyName: "Acme", locked: false },
      { id: "r-2", email: null, status: "accepted", companyName: null, locked: true },
      { id: "r-3", email: "c@new.com", status: "pending", companyName: null, locked: false },
    ]);
  });

  it("should return an empty array when the GC has no jobsites", async () => {
    // Arrange
    order.mockResolvedValue({ data: [], error: null });

    // Act
    const result = await listForGc("gc-1");

    // Assert
    expect(result).toEqual([]);
  });

  it("should throw a 502 AppError on a query failure", async () => {
    // Arrange
    order.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(listForGc("gc-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load jobsites",
    });
  });
});

describe("jobsites service: update", () => {
  let single;
  let select;
  let eqGc;
  let eqId;
  let update;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    select = vi.fn(() => ({ single }));
    eqGc = vi.fn(() => ({ select }));
    eqId = vi.fn(() => ({ eq: eqGc }));
    update = vi.fn(() => ({ eq: eqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "jobsites") return { update };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should write only the name key when only name is patched", async () => {
    // Act
    await updateJobsite({ id: "jobsite-1", gcCompanyId: "gc-1", patch: { name: "New Name" } });

    // Assert
    expect(update).toHaveBeenCalledWith({ name: "New Name" });
    expect(eqId).toHaveBeenCalledWith("id", "jobsite-1");
    expect(eqGc).toHaveBeenCalledWith("gc_company_id", "gc-1");
  });

  it("should write the status key when status is patched", async () => {
    // Act
    await updateJobsite({ id: "jobsite-1", gcCompanyId: "gc-1", patch: { status: "completed" } });

    // Assert
    expect(update).toHaveBeenCalledWith({ status: "completed" });
  });

  it("should stamp archived_at when archived is true", async () => {
    // Act
    await updateJobsite({ id: "jobsite-1", gcCompanyId: "gc-1", patch: { archived: true } });

    // Assert
    const payload = update.mock.calls[0][0];
    expect(payload.archived_at).toEqual(expect.any(String));
  });

  describe("restoring a dormant jobsite (plan cap)", () => {
    let lookup;
    let capQuery;

    // First jobsites call is the ownership lookup (select..eq..eq..single), then
    // the cap counts, then the update itself.
    const wire = (currentRow, counts) => {
      lookup = chain({ data: { ...currentRow, companies: { name: "Turner" } }, error: null });
      capQuery = countQuery(counts);
      fromSpy.mockReset();
      fromSpy.mockImplementationOnce(() => lookup);
      fromSpy.mockImplementation(() => ({ update, select: capQuery.select }));
    };

    it("should clear archived_at when archived is false and a slot is free", async () => {
      // Arrange
      wire({ ...dbRow, archived_at: "2026-02-01T00:00:00.000Z" }, [0, 0]);

      // Act
      await updateJobsite({ id: "jobsite-1", gcCompanyId: "gc-1", patch: { archived: false } });

      // Assert
      expect(update).toHaveBeenCalledWith({ archived_at: null });
    });

    it("should refuse with a 403 PLAN_LIMIT when restoring would exceed the cap", async () => {
      // Arrange
      wire({ ...dbRow, archived_at: "2026-02-01T00:00:00.000Z" }, [0, 1]);

      // Act & Assert
      await expect(
        updateJobsite({ id: "jobsite-1", gcCompanyId: "gc-1", patch: { archived: false } }),
      ).rejects.toMatchObject({ statusCode: 403, data: { code: "PLAN_LIMIT", limit: 1 } });
      expect(update).not.toHaveBeenCalled();
    });

    it("should cap re-activating a completed jobsite the same way", async () => {
      // Arrange
      wire({ ...dbRow, status: "completed" }, [0, 1]);

      // Act & Assert
      await expect(
        updateJobsite({ id: "jobsite-1", gcCompanyId: "gc-1", patch: { status: "active" } }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("should not count a jobsite that is already live", async () => {
      // Arrange: cap is full, but this row is already live so nothing changes
      wire(dbRow, [0, 1]);

      // Act
      await updateJobsite({ id: "jobsite-1", gcCompanyId: "gc-1", patch: { archived: false } });

      // Assert
      expect(update).toHaveBeenCalledWith({ archived_at: null });
    });

    it("should not re-check when the jobsite stays archived", async () => {
      // Arrange: un-completing an archived jobsite leaves it dormant
      wire({ ...dbRow, status: "completed", archived_at: "2026-02-01T00:00:00.000Z" }, [0, 1]);

      // Act
      await updateJobsite({
        id: "jobsite-1",
        gcCompanyId: "gc-1",
        patch: { status: "active" },
      });

      // Assert
      expect(update).toHaveBeenCalledWith({ status: "active" });
    });
  });

  it("should return the mapped row on success", async () => {
    // Act
    const result = await updateJobsite({ id: "jobsite-1", gcCompanyId: "gc-1", patch: { name: "Riverside Tower" } });

    // Assert
    expect(result).toEqual(mappedJobsite);
  });

  it("should throw a 404 AppError when no row matches (missing or another GC's jobsite)", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(
      updateJobsite({ id: "missing", gcCompanyId: "gc-1", patch: { name: "New Name" } }),
    ).rejects.toMatchObject({ statusCode: 404, message: "Jobsite not found" });
  });

  it("should throw a 502 AppError on any other query failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(
      updateJobsite({ id: "jobsite-1", gcCompanyId: "gc-1", patch: { name: "New Name" } }),
    ).rejects.toMatchObject({ statusCode: 502, message: "Could not update the jobsite" });
  });
});

// A chainable, awaitable stand-in for a supabase-js query builder: every
// builder method returns the same object, `.single()` resolves to `result`,
// and awaiting the chain itself (no `.single()`) resolves to `result` too.
const chain = (result) => {
  const c = {};
  ["select", "eq", "is", "not", "limit", "update", "insert", "delete"].forEach((method) => {
    c[method] = vi.fn(() => c);
  });
  c.single = vi.fn().mockResolvedValue(result);
  c.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return c;
};

// Queues one builder per `from(table)` call, in call order, so a test can
// script a multi-query flow (owned-jobsite lookup, then roster read, then write).
const queueFrom = (...steps) => {
  fromSpy.mockReset();
  steps.forEach(([table, builder]) => {
    fromSpy.mockImplementationOnce((requested) => {
      if (requested !== table) {
        throw new Error(`Expected from("${table}"), got from("${requested}")`);
      }
      return builder;
    });
  });
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = "a".repeat(64);
const FUTURE = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

const ownedJobsiteRow = { ...dbRow, companies: { name: "Turner Construction" } };

const rosterRow = {
  id: "roster-1",
  jobsite_id: "jobsite-1",
  sub_company_id: null,
  invited_email: "jane@acme.com",
  token: TOKEN,
  expires_at: FUTURE,
  accepted_at: null,
};

describe("jobsites service: createInvite", () => {
  const args = { jobsiteId: "jobsite-1", gcCompanyId: "gc-1", email: "jane@acme.com" };

  it("should insert a fresh pending roster row for a new email and return it with the GC and jobsite names", async () => {
    // Arrange
    const owned = chain({ data: ownedJobsiteRow, error: null });
    const existing = chain({ data: [], error: null });
    const write = chain({ data: rosterRow, error: null });
    queueFrom(["jobsites", owned], ["jobsite_subcontractors", existing], ["jobsite_subcontractors", write]);

    // Act
    const result = await createInvite(args);

    // Assert
    expect(owned.eq).toHaveBeenCalledWith("id", "jobsite-1");
    expect(owned.eq).toHaveBeenCalledWith("gc_company_id", "gc-1");
    const payload = write.insert.mock.calls[0][0];
    expect(payload.id).toMatch(UUID_RE);
    expect(payload.jobsite_id).toBe("jobsite-1");
    expect(payload.invited_email).toBe("jane@acme.com");
    expect(payload.token).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(payload.expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(write.select).toHaveBeenCalledWith(ROSTER_COLUMNS);
    expect(result).toEqual({
      id: "roster-1",
      jobsiteId: "jobsite-1",
      email: "jane@acme.com",
      token: TOKEN,
      expiresAt: FUTURE,
      jobsiteName: "Riverside Tower",
      gcCompanyName: "Turner Construction",
    });
  });

  it("should regenerate the token on the existing pending row, guarded on accepted_at IS NULL", async () => {
    // Arrange
    const owned = chain({ data: ownedJobsiteRow, error: null });
    const existing = chain({ data: [{ id: "roster-1", accepted_at: null }], error: null });
    const write = chain({ data: rosterRow, error: null });
    queueFrom(["jobsites", owned], ["jobsite_subcontractors", existing], ["jobsite_subcontractors", write]);

    // Act
    await createInvite(args);

    // Assert
    expect(existing.eq).toHaveBeenCalledWith("jobsite_id", "jobsite-1");
    expect(existing.eq).toHaveBeenCalledWith("invited_email", "jane@acme.com");
    expect(write.insert).not.toHaveBeenCalled();
    expect(write.update.mock.calls[0][0].token).toMatch(/^[0-9a-f]{64}$/);
    expect(write.eq).toHaveBeenCalledWith("id", "roster-1");
    expect(write.is).toHaveBeenCalledWith("accepted_at", null);
  });

  it("should throw a 409 AppError and write nothing when the email is already an accepted sub", async () => {
    // Arrange
    const owned = chain({ data: ownedJobsiteRow, error: null });
    const existing = chain({
      data: [{ id: "roster-1", accepted_at: "2026-02-01T00:00:00.000Z" }],
      error: null,
    });
    queueFrom(["jobsites", owned], ["jobsite_subcontractors", existing]);

    // Act & Assert
    await expect(createInvite(args)).rejects.toMatchObject({
      statusCode: 409,
      message: "That subcontractor is already on this job site",
    });
    expect(fromSpy).toHaveBeenCalledTimes(2);
  });

  it("should throw a 404 AppError when the jobsite is missing or another GC's", async () => {
    // Arrange
    queueFrom(["jobsites", chain({ data: null, error: { code: "PGRST116" } })]);

    // Act & Assert
    await expect(createInvite(args)).rejects.toMatchObject({
      statusCode: 404,
      message: "Jobsite not found",
    });
  });

  it("should throw a 502 AppError when the jobsite lookup fails for any other reason", async () => {
    // Arrange
    queueFrom(["jobsites", chain({ data: null, error: { code: "OTHER" } })]);

    // Act & Assert
    await expect(createInvite(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load the jobsite",
    });
  });

  it("should throw a 502 AppError when reading the existing roster row fails", async () => {
    // Arrange
    queueFrom(
      ["jobsites", chain({ data: ownedJobsiteRow, error: null })],
      ["jobsite_subcontractors", chain({ data: null, error: { code: "OTHER" } })],
    );

    // Act & Assert
    await expect(createInvite(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not create the invite",
    });
  });

  it.each([["PGRST116"], ["23505"]])(
    "should throw a 409 AppError when a concurrent request wins the race (%s)",
    async (code) => {
      // Arrange
      queueFrom(
        ["jobsites", chain({ data: ownedJobsiteRow, error: null })],
        ["jobsite_subcontractors", chain({ data: [], error: null })],
        ["jobsite_subcontractors", chain({ data: null, error: { code } })],
      );

      // Act & Assert
      await expect(createInvite(args)).rejects.toMatchObject({
        statusCode: 409,
        message: "This invite was just changed. Reload and try again.",
      });
    },
  );

  it("should throw a 502 AppError when the write fails for any other reason", async () => {
    // Arrange
    queueFrom(
      ["jobsites", chain({ data: ownedJobsiteRow, error: null })],
      ["jobsite_subcontractors", chain({ data: [], error: null })],
      ["jobsite_subcontractors", chain({ data: null, error: { code: "OTHER" } })],
    );

    // Act & Assert
    await expect(createInvite(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not create the invite",
    });
  });
});

describe("jobsites service: previewInvite (shared active-invite lookup)", () => {
  const inviteRow = {
    ...rosterRow,
    jobsites: { name: "Riverside Tower", gc_company_id: "gc-1", companies: { name: "Turner Construction" } },
  };

  it("should return only the GC name, jobsite name and invited email, never the token", async () => {
    // Arrange
    const lookup = chain({ data: inviteRow, error: null });
    queueFrom(["jobsite_subcontractors", lookup]);

    // Act
    const result = await previewInvite(TOKEN);

    // Assert
    expect(lookup.select).toHaveBeenCalledWith(
      `${ROSTER_COLUMNS}, jobsites(name, gc_company_id, companies(name))`,
    );
    expect(lookup.eq).toHaveBeenCalledWith("token", TOKEN);
    expect(result).toEqual({
      gcCompanyName: "Turner Construction",
      jobsiteName: "Riverside Tower",
      email: "jane@acme.com",
    });
  });

  it("should fall back to null names when the embedded jobsite is missing", async () => {
    // Arrange
    queueFrom(["jobsite_subcontractors", chain({ data: { ...rosterRow, jobsites: null }, error: null })]);

    // Act
    const result = await previewInvite(TOKEN);

    // Assert
    expect(result).toEqual({ gcCompanyName: null, jobsiteName: null, email: "jane@acme.com" });
  });

  it("should throw a 404 AppError when no roster row carries the token (not found or already accepted)", async () => {
    // Arrange
    queueFrom(["jobsite_subcontractors", chain({ data: null, error: { code: "PGRST116" } })]);

    // Act & Assert
    await expect(previewInvite(TOKEN)).rejects.toMatchObject({
      statusCode: 404,
      message: "This invite link is invalid or has expired",
    });
  });

  it("should throw the same 404 AppError when the invite has expired", async () => {
    // Arrange
    queueFrom([
      "jobsite_subcontractors",
      chain({ data: { ...inviteRow, expires_at: new Date(Date.now() - 1000).toISOString() }, error: null }),
    ]);

    // Act & Assert
    await expect(previewInvite(TOKEN)).rejects.toMatchObject({
      statusCode: 404,
      message: "This invite link is invalid or has expired",
    });
  });

  it("should throw a 502 AppError on any other lookup failure", async () => {
    // Arrange
    queueFrom(["jobsite_subcontractors", chain({ data: null, error: { code: "OTHER" } })]);

    // Act & Assert
    await expect(previewInvite(TOKEN)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not look up the invite",
    });
  });
});

describe("jobsites service: acceptInvite", () => {
  const inviteRow = {
    ...rosterRow,
    jobsites: { name: "Riverside Tower", gc_company_id: "gc-1", companies: { name: "Turner Construction" } },
  };
  const project = { id: "project-9", jobsiteId: "jobsite-1", gcCompanyId: "gc-1" };
  const args = { token: TOKEN, email: "jane@acme.com", companyId: "company-9" };

  let createSpy;
  let errorSpy;

  beforeEach(() => {
    createSpy = vi.spyOn(projectsService, "create").mockResolvedValue(project);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    createSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("should stamp the roster row accepted first, then create the sub's project through the admission-gated projects service", async () => {
    // Arrange
    const lookup = chain({ data: inviteRow, error: null });
    const stamp = chain({ data: { id: "roster-1" }, error: null });
    queueFrom(["jobsite_subcontractors", lookup], ["jobsite_subcontractors", stamp]);

    // Act
    const result = await acceptInvite(args);

    // Assert
    expect(stamp.update).toHaveBeenCalledWith({
      sub_company_id: "company-9",
      accepted_at: expect.any(String),
      token: null,
      expires_at: null,
    });
    expect(stamp.eq).toHaveBeenCalledWith("id", "roster-1");
    expect(stamp.is).toHaveBeenCalledWith("accepted_at", null);
    expect(createSpy).toHaveBeenCalledWith({
      id: expect.stringMatching(UUID_RE),
      ownerCompanyId: "company-9",
      name: "Riverside Tower",
      jobsiteId: "jobsite-1",
    });
    expect(stamp.update.mock.invocationCallOrder[0]).toBeLessThan(createSpy.mock.invocationCallOrder[0]);
    expect(result).toEqual(project);
  });

  it("should match the invited email case-insensitively", async () => {
    // Arrange
    queueFrom(
      ["jobsite_subcontractors", chain({ data: inviteRow, error: null })],
      ["jobsite_subcontractors", chain({ data: { id: "roster-1" }, error: null })],
    );

    // Act
    await acceptInvite({ ...args, email: "JANE@Acme.com" });

    // Assert
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it.each([["a different address", "bob@other.com"], ["a missing address", undefined]])(
    "should throw a 403 AppError and change nothing for %s",
    async (_label, email) => {
      // Arrange
      queueFrom(["jobsite_subcontractors", chain({ data: inviteRow, error: null })]);

      // Act & Assert
      await expect(acceptInvite({ ...args, email })).rejects.toMatchObject({
        statusCode: 403,
        message: "This invite was sent to a different email address",
      });
      expect(fromSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).not.toHaveBeenCalled();
    },
  );

  it("should propagate the 404 for an invalid, expired or already-accepted token", async () => {
    // Arrange
    queueFrom(["jobsite_subcontractors", chain({ data: null, error: { code: "PGRST116" } })]);

    // Act & Assert
    await expect(acceptInvite(args)).rejects.toMatchObject({ statusCode: 404 });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("should throw a 409 AppError when another request accepted the invite after it was read", async () => {
    // Arrange
    queueFrom(
      ["jobsite_subcontractors", chain({ data: inviteRow, error: null })],
      ["jobsite_subcontractors", chain({ data: null, error: { code: "PGRST116" } })],
    );

    // Act & Assert
    await expect(acceptInvite(args)).rejects.toMatchObject({
      statusCode: 409,
      message: "This invite was just accepted. Reload and try again.",
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("should throw a 409 AppError when the company already holds a membership on the jobsite", async () => {
    // Arrange
    queueFrom(
      ["jobsite_subcontractors", chain({ data: inviteRow, error: null })],
      ["jobsite_subcontractors", chain({ data: null, error: { code: "23505" } })],
    );

    // Act & Assert
    await expect(acceptInvite(args)).rejects.toMatchObject({
      statusCode: 409,
      message: "Your company is already on this job site",
    });
  });

  it("should throw a 502 AppError when stamping the roster row fails for any other reason", async () => {
    // Arrange
    queueFrom(
      ["jobsite_subcontractors", chain({ data: inviteRow, error: null })],
      ["jobsite_subcontractors", chain({ data: null, error: { code: "OTHER" } })],
    );

    // Act & Assert
    await expect(acceptInvite(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not accept the invite",
    });
  });

  it("should roll the roster row back to a pending invite with its token and rethrow when the project insert fails", async () => {
    // Arrange
    const projectError = new Error("insert failed");
    createSpy.mockRejectedValue(projectError);
    const rollback = chain({ data: null, error: null });
    queueFrom(
      ["jobsite_subcontractors", chain({ data: inviteRow, error: null })],
      ["jobsite_subcontractors", chain({ data: { id: "roster-1" }, error: null })],
      ["jobsite_subcontractors", rollback],
    );

    // Act & Assert
    await expect(acceptInvite(args)).rejects.toBe(projectError);
    expect(rollback.update).toHaveBeenCalledWith({
      sub_company_id: null,
      accepted_at: null,
      token: TOKEN,
      expires_at: expect.any(String),
    });
    expect(rollback.eq).toHaveBeenCalledWith("id", "roster-1");
  });

  it("should log a failed rollback but still rethrow the original project error", async () => {
    // Arrange
    const projectError = new Error("insert failed");
    createSpy.mockRejectedValue(projectError);
    queueFrom(
      ["jobsite_subcontractors", chain({ data: inviteRow, error: null })],
      ["jobsite_subcontractors", chain({ data: { id: "roster-1" }, error: null })],
      ["jobsite_subcontractors", chain({ data: null, error: { code: "OTHER" } })],
    );

    // Act & Assert
    await expect(acceptInvite(args)).rejects.toBe(projectError);
    expect(errorSpy).toHaveBeenCalledWith(
      "jobsites: failed to roll back an accepted invite",
      expect.anything(),
    );
  });
});

describe("jobsites service: removeSubcontractor", () => {
  const args = { jobsiteId: "jobsite-1", subId: "roster-1", gcCompanyId: "gc-1" };
  const owned = () => ["jobsites", chain({ data: ownedJobsiteRow, error: null })];

  it("should detach the sub's projects from the jobsite and GC before deleting the roster row", async () => {
    // Arrange
    const read = chain({ data: { id: "roster-1", sub_company_id: "company-9" }, error: null });
    const detach = chain({ data: null, error: null });
    const del = chain({ data: null, error: null });
    queueFrom(owned(), ["jobsite_subcontractors", read], ["projects", detach], ["jobsite_subcontractors", del]);

    // Act
    const result = await removeSubcontractor(args);

    // Assert
    expect(read.eq).toHaveBeenCalledWith("id", "roster-1");
    expect(read.eq).toHaveBeenCalledWith("jobsite_id", "jobsite-1");
    expect(detach.update).toHaveBeenCalledWith({ jobsite_id: null, gc_company_id: null });
    expect(detach.eq).toHaveBeenCalledWith("jobsite_id", "jobsite-1");
    expect(detach.eq).toHaveBeenCalledWith("owner_company_id", "company-9");
    expect(del.delete).toHaveBeenCalled();
    expect(del.eq).toHaveBeenCalledWith("id", "roster-1");
    expect(detach.update.mock.invocationCallOrder[0]).toBeLessThan(del.delete.mock.invocationCallOrder[0]);
    expect(result).toEqual({ id: "roster-1" });
  });

  it("should skip the project detach for a pending invite that has no company yet", async () => {
    // Arrange
    const del = chain({ data: null, error: null });
    queueFrom(
      owned(),
      ["jobsite_subcontractors", chain({ data: { id: "roster-1", sub_company_id: null }, error: null })],
      ["jobsite_subcontractors", del],
    );

    // Act
    await removeSubcontractor(args);

    // Assert
    expect(fromSpy).toHaveBeenCalledTimes(3);
    expect(del.delete).toHaveBeenCalled();
  });

  it("should throw a 404 AppError when the jobsite is not the caller's", async () => {
    // Arrange
    queueFrom(["jobsites", chain({ data: null, error: { code: "PGRST116" } })]);

    // Act & Assert
    await expect(removeSubcontractor(args)).rejects.toMatchObject({
      statusCode: 404,
      message: "Jobsite not found",
    });
  });

  it("should throw a 404 AppError when the roster row is not on this jobsite", async () => {
    // Arrange
    queueFrom(owned(), ["jobsite_subcontractors", chain({ data: null, error: { code: "PGRST116" } })]);

    // Act & Assert
    await expect(removeSubcontractor(args)).rejects.toMatchObject({
      statusCode: 404,
      message: "Subcontractor not found",
    });
  });

  it("should throw a 502 AppError when reading the roster row fails", async () => {
    // Arrange
    queueFrom(owned(), ["jobsite_subcontractors", chain({ data: null, error: { code: "OTHER" } })]);

    // Act & Assert
    await expect(removeSubcontractor(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not remove the subcontractor",
    });
  });

  it("should throw a 502 AppError and leave the roster row in place when detaching the projects fails", async () => {
    // Arrange
    queueFrom(
      owned(),
      ["jobsite_subcontractors", chain({ data: { id: "roster-1", sub_company_id: "company-9" }, error: null })],
      ["projects", chain({ data: null, error: { code: "OTHER" } })],
    );

    // Act & Assert
    await expect(removeSubcontractor(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not remove the subcontractor",
    });
    expect(fromSpy).toHaveBeenCalledTimes(3);
  });

  it("should throw a 502 AppError when deleting the roster row fails", async () => {
    // Arrange
    queueFrom(
      owned(),
      ["jobsite_subcontractors", chain({ data: { id: "roster-1", sub_company_id: null }, error: null })],
      ["jobsite_subcontractors", chain({ data: null, error: { code: "OTHER" } })],
    );

    // Act & Assert
    await expect(removeSubcontractor(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not remove the subcontractor",
    });
  });
});
