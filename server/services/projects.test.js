// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
// `supabase.from` is looked up fresh at call time (not destructured), so a
// single module-scope spy reconfigured per test is enough — no re-spying.
const { supabase } = require("../utility/supabaseClient");
const companiesService = require("./companies");
const {
  listForCompany,
  getById,
  create,
  update,
  remove,
  linkGc,
  unlinkGc,
} = require("./projects");

const PROJECT_COLUMNS =
  "id, owner_company_id, name, gc_company_id, jobsite_id, gc_name_custom, gc_contact_email, status, archived_at, created_at";

const dbRow = {
  id: "project-1",
  owner_company_id: "company-1",
  name: "Downtown Highrise",
  gc_company_id: null,
  jobsite_id: null,
  gc_name_custom: "Acme GC",
  gc_contact_email: null,
  status: "active",
  archived_at: null,
  created_at: "2026-09-09T00:00:00.000Z",
};

const mappedProject = {
  id: "project-1",
  ownerCompanyId: "company-1",
  name: "Downtown Highrise",
  gcCompanyId: null,
  jobsiteId: null,
  gcNameCustom: "Acme GC",
  gcContactEmail: null,
  status: "active",
  archivedAt: null,
  createdAt: "2026-09-09T00:00:00.000Z",
};

const fromSpy = vi.spyOn(supabase, "from");
const getByJoinCodeSpy = vi.spyOn(companiesService, "getByJoinCode");

describe("projects service: listForCompany", () => {
  let order;
  let is;
  let or;
  let select;

  beforeEach(() => {
    order = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    is = vi.fn(() => ({ order }));
    or = vi.fn(() => ({ is, order }));
    select = vi.fn(() => ({ or }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should query owned-or-GC live projects newest first and map rows to camelCase", async () => {
    // Act
    const result = await listForCompany("company-1");

    // Assert
    expect(select).toHaveBeenCalledWith(PROJECT_COLUMNS);
    expect(or).toHaveBeenCalledWith(
      "owner_company_id.eq.company-1,gc_company_id.eq.company-1",
    );
    expect(is).toHaveBeenCalledWith("archived_at", null);
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual([mappedProject]);
  });

  it("should not filter out archived projects when includeArchived is set", async () => {
    // Act
    await listForCompany("company-1", { includeArchived: true });

    // Assert
    expect(is).not.toHaveBeenCalled();
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("should throw a 502 AppError when the query fails", async () => {
    // Arrange
    order.mockResolvedValue({ data: null, error: new Error("db down") });

    // Act & Assert
    await expect(listForCompany("company-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load projects",
    });
  });
});

describe("projects service: getById", () => {
  let single;
  let eqOwner;
  let eqId;
  let select;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    eqOwner = vi.fn(() => ({ single }));
    eqId = vi.fn(() => ({ eq: eqOwner }));
    select = vi.fn(() => ({ eq: eqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should fetch one project scoped to the owning company, mapped to camelCase", async () => {
    // Act
    const result = await getById("project-1", "company-1");

    // Assert
    expect(select).toHaveBeenCalledWith(PROJECT_COLUMNS);
    expect(eqId).toHaveBeenCalledWith("id", "project-1");
    expect(eqOwner).toHaveBeenCalledWith("owner_company_id", "company-1");
    expect(result).toEqual(mappedProject);
  });

  it("should throw a 404 AppError when no row matches the id and owning company", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(getById("missing", "company-1")).rejects.toMatchObject({
      statusCode: 404,
      message: "Project not found",
    });
  });

  it("should throw a 502 AppError on any other query failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(getById("project-1", "company-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load the project",
    });
  });
});

describe("projects service: create", () => {
  let single;
  let select;
  let insert;

  const payload = {
    id: "project-1",
    ownerCompanyId: "company-1",
    name: "Downtown Highrise",
    gcNameCustom: "Acme GC",
  };

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    select = vi.fn(() => ({ single }));
    insert = vi.fn(() => ({ select }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { insert };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should insert the client id and owner company, coalescing a missing contact email to null, and return the mapped row", async () => {
    // Act
    const result = await create(payload);

    // Assert
    expect(insert).toHaveBeenCalledWith({
      id: "project-1",
      owner_company_id: "company-1",
      name: "Downtown Highrise",
      gc_name_custom: "Acme GC",
      gc_contact_email: null,
    });
    expect(select).toHaveBeenCalledWith(PROJECT_COLUMNS);
    expect(result).toEqual(mappedProject);
  });

  it("should never write gc_company_id, even if a caller passes gcCompanyId", async () => {
    // Act
    await create({ ...payload, gcCompanyId: "gc-9" });

    // Assert
    expect(insert.mock.calls[0][0]).not.toHaveProperty("gc_company_id");
  });

  it("should insert a given gcContactEmail rather than coalescing it to null", async () => {
    // Act
    await create({ ...payload, gcContactEmail: "gc@example.com" });

    // Assert
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ gc_contact_email: "gc@example.com" }),
    );
  });

  it("should throw a 409 AppError when the project id is already used", async () => {
    // Arrange
    single.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });

    // Act & Assert
    await expect(create(payload)).rejects.toMatchObject({
      statusCode: 409,
      message: "This project already exists",
    });
  });

  it("should throw a 422 AppError when the check_gc_info constraint is violated", async () => {
    // Arrange
    single.mockResolvedValue({
      data: null,
      error: { code: "23514", message: "check_gc_info" },
    });

    // Act & Assert
    await expect(create(payload)).rejects.toMatchObject({
      statusCode: 422,
      message: "A general contractor is required",
    });
  });

  it("should throw a 502 AppError on any other insert failure", async () => {
    // Arrange
    single.mockResolvedValue({
      data: null,
      error: { code: "OTHER", message: "unexpected" },
    });

    // Act & Assert
    await expect(create(payload)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not create the project",
    });
  });
});

describe("projects service: update", () => {
  let single;
  let select;
  let eqOwner;
  let eqId;
  let updateFn;
  let readSingle;
  let readSelect;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({
      data: { ...dbRow, status: "completed" },
      error: null,
    });
    select = vi.fn(() => ({ single }));
    eqOwner = vi.fn(() => ({ select }));
    eqId = vi.fn(() => ({ eq: eqOwner }));
    updateFn = vi.fn(() => ({ eq: eqId }));

    // The GC-managed-fields pre-read (select().eq().eq().single()) — an
    // unlinked project by default, so it never blocks.
    readSingle = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    readSelect = vi.fn(() => ({
      eq: () => ({ eq: () => ({ single: readSingle }) }),
    }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { update: updateFn, select: readSelect };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  describe("GC-managed fields on a linked project", () => {
    const jobsiteRow = {
      ...dbRow,
      gc_company_id: "gc-1",
      jobsite_id: "jobsite-1",
      gc_name_custom: "Turner Construction",
    };
    const joinCodeRow = { ...jobsiteRow, jobsite_id: null };

    it("should not read the row when the patch touches none of the managed fields", async () => {
      await update({
        id: "project-1",
        companyId: "company-1",
        patch: { status: "completed" },
      });

      expect(readSelect).not.toHaveBeenCalled();
    });

    it("should reject renaming a project attached to a jobsite", async () => {
      readSingle.mockResolvedValue({ data: jobsiteRow, error: null });

      await expect(
        update({
          id: "project-1",
          companyId: "company-1",
          patch: { name: "Something else" },
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "This project's name is set by the general contractor's job site",
      });
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("should allow resending the unchanged name, GC name, and an empty email", async () => {
      readSingle.mockResolvedValue({ data: jobsiteRow, error: null });

      await update({
        id: "project-1",
        companyId: "company-1",
        patch: {
          name: jobsiteRow.name,
          gcNameCustom: "Turner Construction",
          gcContactEmail: null,
          status: "completed",
        },
      });

      expect(updateFn).toHaveBeenCalled();
    });

    it("should still allow renaming a join-code-linked project that has no jobsite", async () => {
      readSingle.mockResolvedValue({ data: joinCodeRow, error: null });

      await update({
        id: "project-1",
        companyId: "company-1",
        patch: { name: "Renamed" },
      });

      expect(updateFn).toHaveBeenCalledWith({ name: "Renamed" });
    });

    it("should reject changing the GC name on any GC-linked project", async () => {
      readSingle.mockResolvedValue({ data: joinCodeRow, error: null });

      await expect(
        update({
          id: "project-1",
          companyId: "company-1",
          patch: { gcNameCustom: "Other GC" },
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("should reject setting a contact email on any GC-linked project", async () => {
      readSingle.mockResolvedValue({ data: joinCodeRow, error: null });

      await expect(
        update({
          id: "project-1",
          companyId: "company-1",
          patch: { gcContactEmail: "someone@gc.com" },
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("should leave an unlinked project fully editable", async () => {
      await update({
        id: "project-1",
        companyId: "company-1",
        patch: {
          name: "Renamed",
          gcNameCustom: "New GC",
          gcContactEmail: "new@gc.com",
        },
      });

      expect(updateFn).toHaveBeenCalledWith({
        name: "Renamed",
        gc_name_custom: "New GC",
        gc_contact_email: "new@gc.com",
      });
    });

    it("should throw a 404 when the pre-read finds no row for this company", async () => {
      readSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "no rows" },
      });

      await expect(
        update({ id: "project-1", companyId: "company-1", patch: { name: "x" } }),
      ).rejects.toMatchObject({ statusCode: 404, message: "Project not found" });
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("should throw a 502 when the pre-read fails for any other reason", async () => {
      readSingle.mockResolvedValue({
        data: null,
        error: { code: "OTHER", message: "unexpected" },
      });

      await expect(
        update({ id: "project-1", companyId: "company-1", patch: { name: "x" } }),
      ).rejects.toMatchObject({
        statusCode: 502,
        message: "Could not update the project",
      });
    });
  });

  it("should write only the provided patch keys, scoped to the owning company, and return the mapped row", async () => {
    // Act
    const result = await update({
      id: "project-1",
      companyId: "company-1",
      patch: { status: "completed", name: undefined },
    });

    // Assert
    expect(updateFn).toHaveBeenCalledWith({ status: "completed" });
    expect(eqId).toHaveBeenCalledWith("id", "project-1");
    expect(eqOwner).toHaveBeenCalledWith("owner_company_id", "company-1");
    expect(result).toEqual({ ...mappedProject, status: "completed" });
  });

  it("should map gcNameCustom / gcContactEmail patch keys to their DB column names", async () => {
    // Act
    await update({
      id: "project-1",
      companyId: "company-1",
      patch: {
        gcNameCustom: "New GC",
        gcContactEmail: "new@gc.com",
      },
    });

    // Assert
    expect(updateFn).toHaveBeenCalledWith({
      gc_name_custom: "New GC",
      gc_contact_email: "new@gc.com",
    });
  });

  it("should ignore a gcCompanyId patch key — only linkGc may set gc_company_id", async () => {
    // Act
    await update({
      id: "project-1",
      companyId: "company-1",
      patch: { name: "Renamed", gcCompanyId: "gc-9" },
    });

    // Assert
    expect(updateFn).toHaveBeenCalledWith({ name: "Renamed" });
  });

  it("should stamp archived_at when archived is true and the caller is an admin", async () => {
    // Act
    await update({
      id: "project-1",
      companyId: "company-1",
      role: "admin",
      patch: { archived: true },
    });

    // Assert
    const written = updateFn.mock.calls[0][0];
    expect(typeof written.archived_at).toBe("string");
    expect(Number.isNaN(Date.parse(written.archived_at))).toBe(false);
  });

  it("should clear archived_at when archived is false (restore) and the caller is a safety_manager", async () => {
    // Act
    await update({
      id: "project-1",
      companyId: "company-1",
      role: "safety_manager",
      patch: { archived: false },
    });

    // Assert
    expect(updateFn).toHaveBeenCalledWith({ archived_at: null });
  });

  it("should throw a 403 AppError when archiving/restoring without a manager role", async () => {
    // Act & Assert
    await expect(
      update({
        id: "project-1",
        companyId: "company-1",
        role: "foreman",
        patch: { archived: true },
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Only an admin or safety manager can archive or restore a project",
    });
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("should throw a 404 AppError when no row matches the id and owning company", async () => {
    // Arrange
    single.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });

    // Act & Assert
    await expect(
      update({ id: "project-1", companyId: "company-1", patch: { name: "x" } }),
    ).rejects.toMatchObject({ statusCode: 404, message: "Project not found" });
  });

  it("should throw a 422 AppError when the check_gc_info constraint is violated", async () => {
    // Arrange
    single.mockResolvedValue({
      data: null,
      error: { code: "23514", message: "check_gc_info" },
    });

    // Act & Assert
    await expect(
      update({
        id: "project-1",
        companyId: "company-1",
        patch: { gcNameCustom: null },
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: "A general contractor is required",
    });
  });

  it("should throw a 502 AppError on any other update failure", async () => {
    // Arrange
    single.mockResolvedValue({
      data: null,
      error: { code: "OTHER", message: "unexpected" },
    });

    // Act & Assert
    await expect(
      update({ id: "project-1", companyId: "company-1", patch: { name: "x" } }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not update the project",
    });
  });
});

describe("projects service: remove", () => {
  let limit;
  let logsEq;
  let logsSelect;
  let single;
  let deleteSelect;
  let eqOwner;
  let eqId;
  let deleteFn;

  beforeEach(() => {
    // meeting_logs guard chain: .select("id").eq("project_id", id).limit(1)
    limit = vi.fn().mockResolvedValue({ data: [], error: null });
    logsEq = vi.fn(() => ({ limit }));
    logsSelect = vi.fn(() => ({ eq: logsEq }));

    // projects delete chain: .delete().eq("id").eq("owner_company_id").select("id").single()
    single = vi.fn().mockResolvedValue({ data: { id: "project-1" }, error: null });
    deleteSelect = vi.fn(() => ({ single }));
    eqOwner = vi.fn(() => ({ select: deleteSelect }));
    eqId = vi.fn(() => ({ eq: eqOwner }));
    deleteFn = vi.fn(() => ({ eq: eqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "meeting_logs") return { select: logsSelect };
      if (table === "projects") return { delete: deleteFn };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should delete a project with no meeting logs, scoped to the owning company", async () => {
    // Act
    const result = await remove({
      id: "project-1",
      companyId: "company-1",
      role: "admin",
    });

    // Assert
    expect(logsSelect).toHaveBeenCalledWith("id");
    expect(logsEq).toHaveBeenCalledWith("project_id", "project-1");
    expect(eqId).toHaveBeenCalledWith("id", "project-1");
    expect(eqOwner).toHaveBeenCalledWith("owner_company_id", "company-1");
    expect(result).toEqual({ id: "project-1" });
  });

  it("should throw a 403 AppError when the caller isn't an admin or safety_manager", async () => {
    // Act & Assert
    await expect(
      remove({ id: "project-1", companyId: "company-1", role: "foreman" }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Only an admin or safety manager can delete a project",
    });
    expect(logsSelect).not.toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("should throw a 409 AppError when the project has logged safety talks", async () => {
    // Arrange
    limit.mockResolvedValue({ data: [{ id: "log-1" }], error: null });

    // Act & Assert
    await expect(
      remove({ id: "project-1", companyId: "company-1", role: "admin" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "This project has logged safety talks and can't be deleted. Archive it instead.",
    });
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError when the meeting_logs guard query fails", async () => {
    // Arrange
    limit.mockResolvedValue({ data: null, error: new Error("db down") });

    // Act & Assert
    await expect(
      remove({ id: "project-1", companyId: "company-1", role: "admin" }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not delete the project",
    });
  });

  it("should throw a 404 AppError when no row matches the id and owning company", async () => {
    // Arrange
    single.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });

    // Act & Assert
    await expect(
      remove({ id: "project-1", companyId: "company-1", role: "admin" }),
    ).rejects.toMatchObject({ statusCode: 404, message: "Project not found" });
  });

  it("should throw a 502 AppError on any other delete failure", async () => {
    // Arrange
    single.mockResolvedValue({
      data: null,
      error: { code: "OTHER", message: "unexpected" },
    });

    // Act & Assert
    await expect(
      remove({ id: "project-1", companyId: "company-1", role: "admin" }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not delete the project",
    });
  });
});

// A recording, thenable query chain per `from()` call. Each call resolves to the
// next queued result for `<table>.<first operation>` (default: no rows, no
// error), so tests state outcomes without depending on chain order.
const mockDb = (results = {}) => {
  const calls = [];
  const queues = new Map(
    Object.entries(results).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : [value],
    ]),
  );

  const resolveFor = (record) => {
    const key = `${record.table}.${record.ops[0]?.[0]}`;
    const queue = queues.get(key);
    if (!queue) return { data: [], error: null };
    return queue.length > 1 ? queue.shift() : queue[0];
  };

  fromSpy.mockReset();
  fromSpy.mockImplementation((table) => {
    const record = { table, ops: [] };
    calls.push(record);
    const builder = new Proxy(
      {},
      {
        get: (_, method) => {
          if (method === "then") {
            return (resolve, reject) =>
              Promise.resolve(resolveFor(record)).then(resolve, reject);
          }
          return (...args) => {
            record.ops.push([method, args]);
            return builder;
          };
        },
      },
    );
    return builder;
  });

  const find = (table, op) =>
    calls.filter((c) => c.table === table && c.ops[0]?.[0] === op);
  const argsOf = (record, method) =>
    record.ops.find(([name]) => name === method)?.[1];

  return { calls, find, argsOf };
};

describe("projects service: linkGc", () => {
  const gc = { id: "gc-1", name: "Turner Construction Inc." };
  const linkedRow = {
    ...dbRow,
    gc_company_id: "gc-1",
    gc_name_custom: "Turner Construction Inc.",
    jobsite_id: "jobsite-1",
  };
  const args = {
    projectId: "project-1",
    companyId: "company-1",
    joinCode: "ABCD2345",
  };
  const ok = (data) => ({ data, error: null });
  const fail = (code) => ({ data: null, error: { code } });

  beforeEach(() => {
    getByJoinCodeSpy.mockReset();
    getByJoinCodeSpy.mockResolvedValue(gc);
  });

  it("should create the GC's jobsite when none matches, add an accepted roster row, and link the project to it", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": ok(dbRow),
      "jobsites.select": ok([]),
      "projects.update": ok(linkedRow),
    });

    // Act
    const result = await linkGc(args);

    // Assert
    expect(getByJoinCodeSpy).toHaveBeenCalledWith("ABCD2345");
    const [jobsiteInsert] = db.find("jobsites", "insert");
    const newJobsite = db.argsOf(jobsiteInsert, "insert")[0];
    expect(newJobsite).toMatchObject({
      gc_company_id: "gc-1",
      name: "Downtown Highrise",
      origin: "subcontractor",
    });

    const [rosterInsert] = db.find("jobsite_subcontractors", "insert");
    expect(db.argsOf(rosterInsert, "insert")[0]).toMatchObject({
      jobsite_id: newJobsite.id,
      sub_company_id: "company-1",
      invited_email: "backfill+company-1@backfill.invalid",
    });
    expect(db.argsOf(rosterInsert, "insert")[0].accepted_at).toEqual(
      expect.any(String),
    );

    const [update] = db.find("projects", "update");
    expect(db.argsOf(update, "update")[0]).toEqual({
      gc_company_id: "gc-1",
      gc_name_custom: "Turner Construction Inc.",
      jobsite_id: newJobsite.id,
    });
    expect(db.argsOf(update, "is")).toEqual(["gc_company_id", null]);
    expect(db.argsOf(update, "select")).toEqual([PROJECT_COLUMNS]);
    expect(result).toEqual({
      ...mappedProject,
      gcCompanyId: "gc-1",
      gcNameCustom: "Turner Construction Inc.",
      jobsiteId: "jobsite-1",
    });
  });

  it("should reuse the GC's oldest live jobsite whose normalized name matches", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": ok(dbRow),
      "jobsites.select": ok([
        { id: "jobsite-other", name: "Elsewhere" },
        { id: "jobsite-a", name: "  downtown   HIGHRISE " },
        { id: "jobsite-b", name: "Downtown Highrise" },
      ]),
      "projects.update": ok(linkedRow),
    });

    // Act
    await linkGc(args);

    // Assert
    expect(db.find("jobsites", "insert")).toHaveLength(0);
    const [select] = db.find("jobsites", "select");
    expect(db.argsOf(select, "eq")).toEqual(["gc_company_id", "gc-1"]);
    expect(db.argsOf(select, "is")).toEqual(["archived_at", null]);
    const [rosterInsert] = db.find("jobsite_subcontractors", "insert");
    expect(db.argsOf(rosterInsert, "insert")[0].jobsite_id).toBe("jobsite-a");
    const [update] = db.find("projects", "update");
    expect(db.argsOf(update, "update")[0].jobsite_id).toBe("jobsite-a");
  });

  it("should not add a second roster row when the sub is already a member", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": ok(dbRow),
      "jobsites.select": ok([{ id: "jobsite-1", name: "Downtown Highrise" }]),
      "jobsite_subcontractors.select": ok([{ id: "member-1" }]),
      "projects.update": ok(linkedRow),
    });

    // Act
    await linkGc(args);

    // Assert
    expect(db.find("jobsite_subcontractors", "insert")).toHaveLength(0);
  });

  it("should treat a duplicate-membership race (23505) on the roster insert as success", async () => {
    // Arrange
    mockDb({
      "projects.select": ok(dbRow),
      "jobsites.select": ok([{ id: "jobsite-1", name: "Downtown Highrise" }]),
      "jobsite_subcontractors.insert": fail("23505"),
      "projects.update": ok(linkedRow),
    });

    // Act & Assert
    await expect(linkGc(args)).resolves.toMatchObject({ gcCompanyId: "gc-1" });
  });

  it("should be idempotent when already linked to the same GC's jobsite: re-ensure membership but skip the project update", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": ok(linkedRow),
      "jobsite_subcontractors.select": ok([{ id: "member-1" }]),
    });

    // Act
    const result = await linkGc(args);

    // Assert
    expect(db.find("jobsites", "select")).toHaveLength(0);
    expect(db.find("projects", "update")).toHaveLength(0);
    expect(result.jobsiteId).toBe("jobsite-1");
  });

  it("should heal a legacy link (this GC, no jobsite) by attaching a jobsite, guarded on the existing GC", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": ok({
        ...dbRow,
        gc_company_id: "gc-1",
        jobsite_id: null,
      }),
      "jobsites.select": ok([{ id: "jobsite-1", name: "Downtown Highrise" }]),
      "projects.update": ok(linkedRow),
    });

    // Act
    await linkGc(args);

    // Assert
    const [update] = db.find("projects", "update");
    expect(db.argsOf(update, "update")[0].jobsite_id).toBe("jobsite-1");
    expect(update.ops.filter(([name]) => name === "eq")).toContainEqual([
      "eq",
      ["gc_company_id", "gc-1"],
    ]);
    expect(db.argsOf(update, "is")).toBeUndefined();
  });

  it("should throw a 409 AppError when the project is linked to a different GC, writing nothing", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": ok({ ...dbRow, gc_company_id: "gc-other" }),
    });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 409,
      message:
        "This project is already linked to a different general contractor. Unlink it first.",
    });
    expect(db.find("projects", "update")).toHaveLength(0);
    expect(db.find("jobsites", "insert")).toHaveLength(0);
    expect(db.find("jobsite_subcontractors", "insert")).toHaveLength(0);
  });

  it("should throw a 422 AppError when the join code belongs to the caller's own company", async () => {
    // Arrange
    const db = mockDb({ "projects.select": ok(dbRow) });
    getByJoinCodeSpy.mockResolvedValue({ id: "company-1", name: "Own Co" });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 422,
      message: "That is your own company's join code",
    });
    expect(db.find("projects", "update")).toHaveLength(0);
  });

  it("should throw a 404 AppError, without resolving the code, when the project isn't owned by the caller's company", async () => {
    // Arrange
    mockDb({ "projects.select": fail("PGRST116") });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 404,
      message: "Project not found",
    });
    expect(getByJoinCodeSpy).not.toHaveBeenCalled();
  });

  it("should propagate the 404 from an unknown join code without writing", async () => {
    // Arrange
    const db = mockDb({ "projects.select": ok(dbRow) });
    const notFound = Object.assign(new Error("Join code not found"), {
      statusCode: 404,
    });
    getByJoinCodeSpy.mockRejectedValue(notFound);

    // Act & Assert
    await expect(linkGc(args)).rejects.toBe(notFound);
    expect(db.find("projects", "update")).toHaveLength(0);
    expect(db.find("jobsite_subcontractors", "insert")).toHaveLength(0);
  });

  it("should throw a 502 AppError when loading the GC's jobsites fails", async () => {
    // Arrange
    mockDb({
      "projects.select": ok(dbRow),
      "jobsites.select": fail("OTHER"),
    });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not link the project",
    });
  });

  it("should throw a 502 AppError when creating the jobsite fails", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": ok(dbRow),
      "jobsites.select": ok([]),
      "jobsites.insert": fail("OTHER"),
    });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not link the project",
    });
    expect(db.find("projects", "update")).toHaveLength(0);
  });

  it("should throw a 502 AppError when the membership lookup fails", async () => {
    // Arrange
    mockDb({
      "projects.select": ok(dbRow),
      "jobsites.select": ok([{ id: "jobsite-1", name: "Downtown Highrise" }]),
      "jobsite_subcontractors.select": fail("OTHER"),
    });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not link the project",
    });
  });

  it("should throw a 502 AppError, without linking the project, when the roster insert fails", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": ok(dbRow),
      "jobsites.select": ok([{ id: "jobsite-1", name: "Downtown Highrise" }]),
      "jobsite_subcontractors.insert": fail("OTHER"),
    });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not link the project",
    });
    expect(db.find("projects", "update")).toHaveLength(0);
  });

  it("should throw a 409 AppError when no row matches the guarded update (linked concurrently)", async () => {
    // Arrange
    mockDb({
      "projects.select": ok(dbRow),
      "jobsites.select": ok([{ id: "jobsite-1", name: "Downtown Highrise" }]),
      "projects.update": fail("PGRST116"),
    });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 409,
      message: "This project was just changed. Reload and try again.",
    });
  });

  it("should throw a 502 AppError on any other update failure", async () => {
    // Arrange
    mockDb({
      "projects.select": ok(dbRow),
      "jobsites.select": ok([{ id: "jobsite-1", name: "Downtown Highrise" }]),
      "projects.update": fail("OTHER"),
    });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not link the project",
    });
  });
});

describe("projects service: unlinkGc", () => {
  const linkedRow = {
    ...dbRow,
    gc_company_id: "gc-1",
    gc_name_custom: "Turner Construction Inc.",
    jobsite_id: "jobsite-1",
  };
  const unlinkedRow = { ...linkedRow, gc_company_id: null, jobsite_id: null };
  const args = { projectId: "project-1", companyId: "company-1" };
  const ok = (data) => ({ data, error: null });
  const fail = (code) => ({ data: null, error: { code } });

  it("should detach gc_company_id and jobsite_id (keeping the GC name), delete the roster row when no other project remains, and return the mapped project", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": [ok(linkedRow), ok([])],
      "projects.update": ok(unlinkedRow),
    });

    // Act
    const result = await unlinkGc(args);

    // Assert
    const [update] = db.find("projects", "update");
    expect(db.argsOf(update, "update")[0]).toEqual({
      gc_company_id: null,
      jobsite_id: null,
    });
    expect(update.ops.filter(([name]) => name === "eq")).toEqual([
      ["eq", ["id", "project-1"]],
      ["eq", ["owner_company_id", "company-1"]],
    ]);
    expect(db.argsOf(update, "select")).toEqual([PROJECT_COLUMNS]);

    const [roster] = db.find("jobsite_subcontractors", "delete");
    expect(roster.ops.filter(([name]) => name === "eq")).toEqual([
      ["eq", ["jobsite_id", "jobsite-1"]],
      ["eq", ["sub_company_id", "company-1"]],
    ]);
    expect(result).toEqual({
      ...mappedProject,
      gcCompanyId: null,
      jobsiteId: null,
      gcNameCustom: "Turner Construction Inc.",
    });
  });

  it("should keep the roster row while another of the sub's projects is still on the jobsite", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": [ok(linkedRow), ok([{ id: "project-2" }])],
      "projects.update": ok(unlinkedRow),
    });

    // Act
    await unlinkGc(args);

    // Assert
    expect(db.find("jobsite_subcontractors", "delete")).toHaveLength(0);
  });

  it("should skip the roster entirely for a project with no jobsite", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": ok({ ...linkedRow, jobsite_id: null }),
      "projects.update": ok(unlinkedRow),
    });

    // Act
    await unlinkGc(args);

    // Assert
    expect(db.calls.filter((c) => c.table === "jobsite_subcontractors")).toEqual(
      [],
    );
  });

  it("should throw a 404 AppError, without updating, when the project isn't owned by the caller's company", async () => {
    // Arrange
    const db = mockDb({ "projects.select": fail("PGRST116") });

    // Act & Assert
    await expect(unlinkGc(args)).rejects.toMatchObject({
      statusCode: 404,
      message: "Project not found",
    });
    expect(db.find("projects", "update")).toHaveLength(0);
  });

  it("should throw a 404 AppError when the update matches no row", async () => {
    // Arrange
    mockDb({
      "projects.select": ok(linkedRow),
      "projects.update": fail("PGRST116"),
    });

    // Act & Assert
    await expect(unlinkGc(args)).rejects.toMatchObject({
      statusCode: 404,
      message: "Project not found",
    });
  });

  it("should throw a 422 AppError when check_gc_info leaves no GC name to fall back on", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": ok(linkedRow),
      "projects.update": fail("23514"),
    });

    // Act & Assert
    await expect(unlinkGc(args)).rejects.toMatchObject({
      statusCode: 422,
      message: "Add a general contractor name before unlinking",
    });
    expect(db.find("jobsite_subcontractors", "delete")).toHaveLength(0);
  });

  it("should throw a 502 AppError on any other update failure", async () => {
    // Arrange
    const db = mockDb({
      "projects.select": ok(linkedRow),
      "projects.update": fail("OTHER"),
    });

    // Act & Assert
    await expect(unlinkGc(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not unlink the project",
    });
    expect(db.find("jobsite_subcontractors", "delete")).toHaveLength(0);
  });

  it("should throw a 502 AppError when checking for remaining projects fails", async () => {
    // Arrange
    mockDb({
      "projects.select": [ok(linkedRow), fail("OTHER")],
      "projects.update": ok(unlinkedRow),
    });

    // Act & Assert
    await expect(unlinkGc(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not unlink the project",
    });
  });

  it("should throw a 502 AppError when the roster delete fails", async () => {
    // Arrange
    mockDb({
      "projects.select": [ok(linkedRow), ok([])],
      "projects.update": ok(unlinkedRow),
      "jobsite_subcontractors.delete": fail("OTHER"),
    });

    // Act & Assert
    await expect(unlinkGc(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not unlink the project",
    });
  });
});

// Phase 8d admission gate: a project may only attach to a jobsite when an
// accepted jobsite_subcontractors row exists for (jobsiteId, the caller's
// company) — the accepted roster row is the only writer of jobsite_id /
// gc_company_id besides link-gc.
describe("projects service: create with a jobsiteId (admission gate)", () => {
  let rosterSingle;
  let rosterNot;
  let rosterEqCompany;
  let rosterEqJobsite;
  let rosterSelect;
  let insert;
  let single;
  let select;

  const payload = {
    id: "project-2",
    ownerCompanyId: "company-1",
    name: "Riverside Tower",
    gcNameCustom: "typed by the sub",
    jobsiteId: "jobsite-1",
  };

  beforeEach(() => {
    rosterSingle = vi.fn().mockResolvedValue({
      data: { jobsites: { gc_company_id: "gc-1", companies: { name: "Turner Construction" } } },
      error: null,
    });
    rosterNot = vi.fn(() => ({ single: rosterSingle }));
    rosterEqCompany = vi.fn(() => ({ not: rosterNot }));
    rosterEqJobsite = vi.fn(() => ({ eq: rosterEqCompany }));
    rosterSelect = vi.fn(() => ({ eq: rosterEqJobsite }));

    single = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    select = vi.fn(() => ({ single }));
    insert = vi.fn(() => ({ select }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "jobsite_subcontractors") return { select: rosterSelect };
      if (table === "projects") return { insert };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should look up an accepted roster row for the caller's own company and copy jobsite_id, gc_company_id and the GC's registered name onto the project", async () => {
    // Act
    await create(payload);

    // Assert
    expect(rosterEqJobsite).toHaveBeenCalledWith("jobsite_id", "jobsite-1");
    expect(rosterEqCompany).toHaveBeenCalledWith("sub_company_id", "company-1");
    expect(rosterNot).toHaveBeenCalledWith("accepted_at", "is", null);
    expect(insert).toHaveBeenCalledWith({
      id: "project-2",
      owner_company_id: "company-1",
      name: "Riverside Tower",
      gc_name_custom: "Turner Construction",
      gc_contact_email: null,
      jobsite_id: "jobsite-1",
      gc_company_id: "gc-1",
    });
  });

  it("should throw a 404 AppError and insert nothing when the company has no accepted roster row", async () => {
    // Arrange
    rosterSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(create(payload)).rejects.toMatchObject({
      statusCode: 404,
      message: "Jobsite not found",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError when the roster lookup fails for any other reason", async () => {
    // Arrange
    rosterSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(create(payload)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not verify the jobsite",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("should fall back to a null GC name when the jobsite's company has no name embedded", async () => {
    // Arrange
    rosterSingle.mockResolvedValue({
      data: { jobsites: { gc_company_id: "gc-1", companies: null } },
      error: null,
    });

    // Act
    await create(payload);

    // Assert
    expect(insert.mock.calls[0][0].gc_name_custom).toBeNull();
  });
});
