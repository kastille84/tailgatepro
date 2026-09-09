// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
// `supabase.from` is looked up fresh at call time (not destructured), so a
// single module-scope spy reconfigured per test is enough — no re-spying.
const { supabase } = require("../utility/supabaseClient");
const { listForCompany, create, update } = require("./projects");

const PROJECT_COLUMNS =
  "id, owner_company_id, name, gc_company_id, gc_name_custom, status, created_at";

const dbRow = {
  id: "project-1",
  owner_company_id: "company-1",
  name: "Downtown Highrise",
  gc_company_id: null,
  gc_name_custom: "Acme GC",
  status: "active",
  created_at: "2026-09-09T00:00:00.000Z",
};

const mappedProject = {
  id: "project-1",
  ownerCompanyId: "company-1",
  name: "Downtown Highrise",
  gcCompanyId: null,
  gcNameCustom: "Acme GC",
  status: "active",
  createdAt: "2026-09-09T00:00:00.000Z",
};

const fromSpy = vi.spyOn(supabase, "from");

describe("projects service: listForCompany", () => {
  let order;
  let or;
  let select;

  beforeEach(() => {
    order = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    or = vi.fn(() => ({ order }));
    select = vi.fn(() => ({ or }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "projects") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should query owned-or-GC projects newest first and map rows to camelCase", async () => {
    // Act
    const result = await listForCompany("company-1");

    // Assert
    expect(select).toHaveBeenCalledWith(PROJECT_COLUMNS);
    expect(or).toHaveBeenCalledWith(
      "owner_company_id.eq.company-1,gc_company_id.eq.company-1",
    );
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual([mappedProject]);
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

  it("should insert the client id and owner company, coalescing missing GC fields to null, and return the mapped row", async () => {
    // Act
    const result = await create(payload);

    // Assert
    expect(insert).toHaveBeenCalledWith({
      id: "project-1",
      owner_company_id: "company-1",
      name: "Downtown Highrise",
      gc_company_id: null,
      gc_name_custom: "Acme GC",
    });
    expect(select).toHaveBeenCalledWith(PROJECT_COLUMNS);
    expect(result).toEqual(mappedProject);
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

  it("should map gcCompanyId / gcNameCustom patch keys to their DB column names", async () => {
    // Act
    await update({
      id: "project-1",
      companyId: "company-1",
      patch: { gcCompanyId: "gc-9", gcNameCustom: "New GC" },
    });

    // Assert
    expect(updateFn).toHaveBeenCalledWith({
      gc_company_id: "gc-9",
      gc_name_custom: "New GC",
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
        patch: { gcNameCustom: "" },
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
