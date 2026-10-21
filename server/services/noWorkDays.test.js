// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { create, remove, listForProject, listForJobsites } = require("./noWorkDays");

const fromSpy = vi.spyOn(supabase, "from");

// A self-returning query chain that resolves to `result` when awaited, with
// `single` / `maybeSingle` also resolving to it. Keeps the mocks independent of
// the exact order of .eq/.gte/.order calls.
const chain = (result) => {
  const builder = {};
  [
    "select", "eq", "in", "gte", "lte", "order", "range", "upsert", "delete",
  ].forEach((method) => {
    builder[method] = vi.fn(() => builder);
  });
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
};

// "Today" is pinned to Wednesday 2026-09-23 (UTC) so the date range is fixed:
// 2026-09-15 (8 days back) through 2026-10-08 (15 days ahead).
const NOW = new Date("2026-09-23T12:00:00.000Z");

const dbRow = (overrides) => ({
  id: "nwd-1",
  jobsite_id: "jobsite-1",
  company_id: "sub-1",
  off_date: "2026-09-24",
  reason: "holiday",
  created_by: "user-1",
  created_at: "2026-09-23T12:00:00.000Z",
  ...overrides,
});

const mapped = {
  id: "nwd-1",
  jobsiteId: "jobsite-1",
  companyId: "sub-1",
  offDate: "2026-09-24",
  reason: "holiday",
  createdBy: "user-1",
  createdAt: "2026-09-23T12:00:00.000Z",
};

const payload = {
  id: "nwd-1",
  companyId: "sub-1",
  userId: "user-1",
  projectId: "project-1",
  offDate: "2026-09-24",
  reason: "holiday",
};

describe("noWorkDays service", () => {
  let tables;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    tables = {
      projects: chain({ data: { id: "project-1", jobsite_id: "jobsite-1" }, error: null }),
      no_work_days: chain({ data: [dbRow()], error: null }),
    };
    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (tables[table]) return tables[table];
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("create", () => {
    it("should derive the jobsite from the caller's own project and insert a new mark", async () => {
      // Act
      const result = await create(payload);

      // Assert
      expect(tables.projects.eq).toHaveBeenCalledWith("id", "project-1");
      expect(tables.projects.eq).toHaveBeenCalledWith("owner_company_id", "sub-1");
      expect(tables.no_work_days.upsert).toHaveBeenCalledWith(
        {
          id: "nwd-1",
          jobsite_id: "jobsite-1",
          company_id: "sub-1",
          off_date: "2026-09-24",
          reason: "holiday",
          created_by: "user-1",
        },
        { onConflict: "jobsite_id,company_id,off_date", ignoreDuplicates: true },
      );
      expect(result).toEqual({ noWorkDay: mapped, created: true });
    });

    it("should return the existing mark, not created, when the day was already marked", async () => {
      // Arrange — the ignore-duplicates upsert returns no rows, then the lookup finds the row.
      tables.no_work_days = chain({ data: [], error: null });
      tables.no_work_days.single.mockResolvedValue({ data: dbRow({ id: "older" }), error: null });

      // Act
      const result = await create(payload);

      // Assert
      expect(tables.no_work_days.eq).toHaveBeenCalledWith("off_date", "2026-09-24");
      expect(result).toEqual({ noWorkDay: { ...mapped, id: "older" }, created: false });
    });

    it("should throw a 502 when the existing mark cannot be re-read", async () => {
      // Arrange
      tables.no_work_days = chain({ data: [], error: null });
      tables.no_work_days.single.mockResolvedValue({ data: null, error: new Error("db down") });

      // Act & Assert
      await expect(create(payload)).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not mark the day off",
      });
    });

    it.each(["2026-09-26", "2026-09-27"])("should ignore the weekend date %s without writing", async (offDate) => {
      // Act
      const result = await create({ ...payload, offDate });

      // Assert
      expect(result).toEqual({ ignored: true });
      expect(tables.no_work_days.upsert).not.toHaveBeenCalled();
    });

    it.each([
      ["8 days back", "2026-09-15", false],
      ["9 days back", "2026-09-14", true],
      ["15 days ahead", "2026-10-08", false],
      ["16 days ahead", "2026-10-09", true],
    ])("should treat %s (%s) as ignored=%s", async (_label, offDate, ignored) => {
      // Act
      const result = await create({ ...payload, offDate });

      // Assert — all four are weekdays, so only the range decides.
      expect(Boolean(result.ignored)).toBe(ignored);
      expect(tables.no_work_days.upsert).toHaveBeenCalledTimes(ignored ? 0 : 1);
    });

    it("should throw a 404 for a project the caller doesn't own", async () => {
      // Arrange
      tables.projects = chain({ data: null, error: { code: "PGRST116" } });

      // Act & Assert
      await expect(create(payload)).rejects.toMatchObject({
        statusCode: 404,
        message: "Project not found",
      });
    });

    it("should throw a 502 when the project lookup fails", async () => {
      // Arrange
      tables.projects = chain({ data: null, error: new Error("db down") });

      // Act & Assert
      await expect(create(payload)).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not verify the project",
      });
    });

    it("should throw a 409 for a project that isn't linked to a job site", async () => {
      // Arrange
      tables.projects = chain({ data: { id: "project-1", jobsite_id: null }, error: null });

      // Act & Assert
      await expect(create(payload)).rejects.toMatchObject({ statusCode: 409 });
    });

    it("should throw a 409 when the id already belongs to a different mark", async () => {
      // Arrange
      tables.no_work_days = chain({ data: null, error: { code: "23505" } });

      // Act & Assert
      await expect(create(payload)).rejects.toMatchObject({
        statusCode: 409,
        message: "This day-off id is already in use",
      });
    });

    it("should throw a 502 when the insert fails", async () => {
      // Arrange
      tables.no_work_days = chain({ data: null, error: new Error("db down") });

      // Act & Assert
      await expect(create(payload)).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not mark the day off",
      });
    });
  });

  describe("remove", () => {
    beforeEach(() => {
      tables.no_work_days = chain({ data: { id: "nwd-1", off_date: "2026-09-24" }, error: null });
    });

    it("should delete a mark the caller's company owns", async () => {
      // Act
      const result = await remove({ id: "nwd-1", companyId: "sub-1" });

      // Assert
      expect(tables.no_work_days.delete).toHaveBeenCalled();
      expect(tables.no_work_days.eq).toHaveBeenCalledWith("company_id", "sub-1");
      expect(result).toEqual({ id: "nwd-1" });
    });

    it("should succeed without deleting when the mark is already gone", async () => {
      // Arrange
      tables.no_work_days = chain({ data: null, error: null });

      // Act
      const result = await remove({ id: "nwd-1", companyId: "sub-1" });

      // Assert
      expect(result).toEqual({ id: "nwd-1" });
      expect(tables.no_work_days.delete).not.toHaveBeenCalled();
    });

    it("should throw a 409 for a mark older than the editable range", async () => {
      // Arrange
      tables.no_work_days = chain({ data: { id: "nwd-1", off_date: "2026-09-01" }, error: null });

      // Act & Assert
      await expect(remove({ id: "nwd-1", companyId: "sub-1" })).rejects.toMatchObject({ statusCode: 409 });
      expect(tables.no_work_days.delete).not.toHaveBeenCalled();
    });

    it("should throw a 502 when the lookup fails", async () => {
      // Arrange
      tables.no_work_days = chain({ data: null, error: new Error("db down") });

      // Act & Assert
      await expect(remove({ id: "nwd-1", companyId: "sub-1" })).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not remove the day off",
      });
    });

    it("should throw a 502 when the delete fails", async () => {
      // Arrange — the lookup succeeds (single resolves), the delete chain resolves to an error.
      const builder = chain({ data: null, error: new Error("db down") });
      builder.maybeSingle.mockResolvedValue({ data: { id: "nwd-1", off_date: "2026-09-24" }, error: null });
      tables.no_work_days = builder;

      // Act & Assert
      await expect(remove({ id: "nwd-1", companyId: "sub-1" })).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not remove the day off",
      });
    });
  });

  describe("listForProject", () => {
    it("should list the caller's marks for the project's jobsite from a week back, soonest first", async () => {
      // Act
      const result = await listForProject({ projectId: "project-1", companyId: "sub-1" });

      // Assert
      expect(tables.no_work_days.eq).toHaveBeenCalledWith("jobsite_id", "jobsite-1");
      expect(tables.no_work_days.eq).toHaveBeenCalledWith("company_id", "sub-1");
      expect(tables.no_work_days.gte).toHaveBeenCalledWith("off_date", "2026-09-15");
      expect(tables.no_work_days.order).toHaveBeenCalledWith("off_date", { ascending: true });
      expect(result).toEqual([mapped]);
    });

    it("should throw a 404 for a project the caller doesn't own", async () => {
      // Arrange
      tables.projects = chain({ data: null, error: { code: "PGRST116" } });

      // Act & Assert
      await expect(listForProject({ projectId: "project-1", companyId: "sub-1" })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should throw a 502 when the query fails", async () => {
      // Arrange
      tables.no_work_days = chain({ data: null, error: new Error("db down") });

      // Act & Assert
      await expect(listForProject({ projectId: "project-1", companyId: "sub-1" })).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not load days off",
      });
    });
  });

  describe("listForJobsites", () => {
    it("should return no marks, without querying, for an empty jobsite list", async () => {
      // Act
      const result = await listForJobsites({ jobsiteIds: [], from: "2026-09-01", to: "2026-09-30" });

      // Assert
      expect(result).toEqual([]);
      expect(fromSpy).not.toHaveBeenCalled();
    });

    it("should read the inclusive date range for the jobsites and map rows to camelCase", async () => {
      // Arrange
      tables.no_work_days = chain({
        data: [{ jobsite_id: "jobsite-1", company_id: "sub-1", off_date: "2026-09-24", reason: "weather" }],
        error: null,
      });

      // Act
      const result = await listForJobsites({
        jobsiteIds: ["jobsite-1"],
        from: "2026-09-01",
        to: "2026-09-30",
      });

      // Assert
      expect(tables.no_work_days.in).toHaveBeenCalledWith("jobsite_id", ["jobsite-1"]);
      expect(tables.no_work_days.gte).toHaveBeenCalledWith("off_date", "2026-09-01");
      expect(tables.no_work_days.lte).toHaveBeenCalledWith("off_date", "2026-09-30");
      expect(result).toEqual([
        { jobsiteId: "jobsite-1", companyId: "sub-1", offDate: "2026-09-24", reason: "weather" },
      ]);
    });

    it("should throw a 502 when the query fails", async () => {
      // Arrange
      tables.no_work_days = chain({ data: null, error: new Error("db down") });

      // Act & Assert
      await expect(
        listForJobsites({ jobsiteIds: ["jobsite-1"], from: "2026-09-01", to: "2026-09-30" }),
      ).rejects.toMatchObject({ statusCode: 502, message: "Could not load days off" });
    });
  });
});
