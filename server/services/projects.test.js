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
  "id, owner_company_id, name, gc_company_id, gc_name_custom, gc_contact_email, status, archived_at, created_at";

const dbRow = {
  id: "project-1",
  owner_company_id: "company-1",
  name: "Downtown Highrise",
  gc_company_id: null,
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

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({
      data: { ...dbRow, status: "completed" },
      error: null,
    });
    select = vi.fn(() => ({ single }));
    eqOwner = vi.fn(() => ({ select }));
    eqId = vi.fn(() => ({ eq: eqOwner }));
    updateFn = vi.fn(() => ({ eq: eqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { update: updateFn };
      throw new Error(`Unexpected table: ${table}`);
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

  it("should stamp archived_at when archived is true", async () => {
    // Act
    await update({
      id: "project-1",
      companyId: "company-1",
      patch: { archived: true },
    });

    // Assert
    const written = updateFn.mock.calls[0][0];
    expect(typeof written.archived_at).toBe("string");
    expect(Number.isNaN(Date.parse(written.archived_at))).toBe(false);
  });

  it("should clear archived_at when archived is false (restore)", async () => {
    // Act
    await update({
      id: "project-1",
      companyId: "company-1",
      patch: { archived: false },
    });

    // Assert
    expect(updateFn).toHaveBeenCalledWith({ archived_at: null });
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
    const result = await remove({ id: "project-1", companyId: "company-1" });

    // Assert
    expect(logsSelect).toHaveBeenCalledWith("id");
    expect(logsEq).toHaveBeenCalledWith("project_id", "project-1");
    expect(eqId).toHaveBeenCalledWith("id", "project-1");
    expect(eqOwner).toHaveBeenCalledWith("owner_company_id", "company-1");
    expect(result).toEqual({ id: "project-1" });
  });

  it("should throw a 409 AppError when the project has logged safety talks", async () => {
    // Arrange
    limit.mockResolvedValue({ data: [{ id: "log-1" }], error: null });

    // Act & Assert
    await expect(
      remove({ id: "project-1", companyId: "company-1" }),
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
      remove({ id: "project-1", companyId: "company-1" }),
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
      remove({ id: "project-1", companyId: "company-1" }),
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
      remove({ id: "project-1", companyId: "company-1" }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not delete the project",
    });
  });
});

describe("projects service: linkGc", () => {
  // getById chain: select().eq("id").eq("owner_company_id").single()
  let getSingle;
  let getEqOwner;
  let getEqId;
  let getSelect;
  // link update chain: update().eq("id").eq("owner_company_id").is("gc_company_id", null).select().single()
  let updSingle;
  let updSelect;
  let updIs;
  let updEqOwner;
  let updEqId;
  let updateFn;
  // roster upsert
  let upsert;

  const gc = { id: "gc-1", name: "Turner Construction Inc." };
  const linkedRow = {
    ...dbRow,
    gc_company_id: "gc-1",
    gc_name_custom: "Turner Construction Inc.",
  };
  const args = {
    projectId: "project-1",
    companyId: "company-1",
    joinCode: "ABCD2345",
  };

  beforeEach(() => {
    getSingle = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    getEqOwner = vi.fn(() => ({ single: getSingle }));
    getEqId = vi.fn(() => ({ eq: getEqOwner }));
    getSelect = vi.fn(() => ({ eq: getEqId }));

    updSingle = vi.fn().mockResolvedValue({ data: linkedRow, error: null });
    updSelect = vi.fn(() => ({ single: updSingle }));
    updIs = vi.fn(() => ({ select: updSelect }));
    updEqOwner = vi.fn(() => ({ is: updIs }));
    updEqId = vi.fn(() => ({ eq: updEqOwner }));
    updateFn = vi.fn(() => ({ eq: updEqId }));

    upsert = vi.fn().mockResolvedValue({ error: null });

    getByJoinCodeSpy.mockReset();
    getByJoinCodeSpy.mockResolvedValue(gc);

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { select: getSelect, update: updateFn };
      if (table === "project_subcontractors") return { upsert };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should link the project, overwrite gc_name_custom with the GC's registered name, upsert the roster row and return the mapped project", async () => {
    // Act
    const result = await linkGc(args);

    // Assert
    expect(getByJoinCodeSpy).toHaveBeenCalledWith("ABCD2345");
    expect(updateFn).toHaveBeenCalledWith({
      gc_company_id: "gc-1",
      gc_name_custom: "Turner Construction Inc.",
    });
    expect(updEqId).toHaveBeenCalledWith("id", "project-1");
    expect(updEqOwner).toHaveBeenCalledWith("owner_company_id", "company-1");
    expect(updIs).toHaveBeenCalledWith("gc_company_id", null);
    expect(updSelect).toHaveBeenCalledWith(PROJECT_COLUMNS);
    expect(upsert).toHaveBeenCalledWith(
      { project_id: "project-1", sub_id: "company-1" },
      { onConflict: "project_id,sub_id", ignoreDuplicates: true },
    );
    expect(result).toEqual({
      ...mappedProject,
      gcCompanyId: "gc-1",
      gcNameCustom: "Turner Construction Inc.",
    });
  });

  it("should overwrite a GC name the sub had typed with the registered name", async () => {
    // Arrange — dbRow already carries the sub-typed name "Acme GC"
    // Act
    await linkGc(args);

    // Assert
    expect(updateFn.mock.calls[0][0].gc_name_custom).toBe(
      "Turner Construction Inc.",
    );
    expect(updateFn.mock.calls[0][0].gc_name_custom).not.toBe(
      dbRow.gc_name_custom,
    );
  });

  it("should be idempotent when already linked to the same GC: skip the project update but still upsert the roster row", async () => {
    // Arrange
    getSingle.mockResolvedValue({ data: linkedRow, error: null });

    // Act
    const result = await linkGc(args);

    // Assert
    expect(updateFn).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(result.gcCompanyId).toBe("gc-1");
  });

  it("should throw a 409 AppError when the project is linked to a different GC, writing nothing", async () => {
    // Arrange
    getSingle.mockResolvedValue({
      data: { ...dbRow, gc_company_id: "gc-other" },
      error: null,
    });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 409,
      message:
        "This project is already linked to a different general contractor. Unlink it first.",
    });
    expect(updateFn).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("should throw a 422 AppError when the join code belongs to the caller's own company", async () => {
    // Arrange
    getByJoinCodeSpy.mockResolvedValue({ id: "company-1", name: "Own Co" });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 422,
      message: "That is your own company's join code",
    });
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("should throw a 404 AppError, without resolving the code, when the project isn't owned by the caller's company", async () => {
    // Arrange
    getSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 404,
      message: "Project not found",
    });
    expect(getByJoinCodeSpy).not.toHaveBeenCalled();
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("should propagate the 404 from an unknown join code without writing", async () => {
    // Arrange
    const notFound = Object.assign(new Error("Join code not found"), {
      statusCode: 404,
    });
    getByJoinCodeSpy.mockRejectedValue(notFound);

    // Act & Assert
    await expect(linkGc(args)).rejects.toBe(notFound);
    expect(updateFn).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("should throw a 409 AppError when no row matches the guarded update (linked concurrently)", async () => {
    // Arrange
    updSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 409,
      message: "This project was just changed. Reload and try again.",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError on any other update failure", async () => {
    // Arrange
    updSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not link the project",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError when the roster upsert fails", async () => {
    // Arrange
    upsert.mockResolvedValue({ error: { code: "OTHER" } });

    // Act & Assert
    await expect(linkGc(args)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not link the project",
    });
  });
});

describe("projects service: unlinkGc", () => {
  let single;
  let select;
  let eqOwner;
  let eqId;
  let updateFn;
  let rosterEqSub;
  let rosterEqProject;
  let deleteFn;

  const linkedRow = {
    ...dbRow,
    gc_company_id: "gc-1",
    gc_name_custom: "Turner Construction Inc.",
  };

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({
      data: { ...linkedRow, gc_company_id: null },
      error: null,
    });
    select = vi.fn(() => ({ single }));
    eqOwner = vi.fn(() => ({ select }));
    eqId = vi.fn(() => ({ eq: eqOwner }));
    updateFn = vi.fn(() => ({ eq: eqId }));

    rosterEqSub = vi.fn().mockResolvedValue({ error: null });
    rosterEqProject = vi.fn(() => ({ eq: rosterEqSub }));
    deleteFn = vi.fn(() => ({ eq: rosterEqProject }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { update: updateFn };
      if (table === "project_subcontractors") return { delete: deleteFn };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should clear gc_company_id (keeping the GC name), delete the roster row and return the mapped project", async () => {
    // Act
    const result = await unlinkGc({
      projectId: "project-1",
      companyId: "company-1",
    });

    // Assert
    expect(updateFn).toHaveBeenCalledWith({ gc_company_id: null });
    expect(eqId).toHaveBeenCalledWith("id", "project-1");
    expect(eqOwner).toHaveBeenCalledWith("owner_company_id", "company-1");
    expect(select).toHaveBeenCalledWith(PROJECT_COLUMNS);
    expect(rosterEqProject).toHaveBeenCalledWith("project_id", "project-1");
    expect(rosterEqSub).toHaveBeenCalledWith("sub_id", "company-1");
    expect(result).toEqual({
      ...mappedProject,
      gcCompanyId: null,
      gcNameCustom: "Turner Construction Inc.",
    });
  });

  it("should throw a 404 AppError, without touching the roster, when the project isn't owned by the caller's company", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(
      unlinkGc({ projectId: "project-1", companyId: "company-1" }),
    ).rejects.toMatchObject({ statusCode: 404, message: "Project not found" });
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("should throw a 422 AppError when check_gc_info leaves no GC name to fall back on", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "23514" } });

    // Act & Assert
    await expect(
      unlinkGc({ projectId: "project-1", companyId: "company-1" }),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: "Add a general contractor name before unlinking",
    });
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError on any other update failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(
      unlinkGc({ projectId: "project-1", companyId: "company-1" }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not unlink the project",
    });
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError when the roster delete fails", async () => {
    // Arrange
    rosterEqSub.mockResolvedValue({ error: { code: "OTHER" } });

    // Act & Assert
    await expect(
      unlinkGc({ projectId: "project-1", companyId: "company-1" }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not unlink the project",
    });
  });
});
