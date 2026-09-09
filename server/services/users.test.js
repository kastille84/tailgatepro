// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
// uuid's `v4` export isn't configurable (its dual CJS/ESM build uses a
// non-writable getter), so it can't be spied on — instead of mocking uuid,
// these tests assert the company id it generates is a real UUID and that the
// same id links both inserts, rather than pinning an exact fake value.
const { supabase } = require("../utility/supabaseClient");
const { createProfile, getUserContext } = require("./users");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `supabase.from` is looked up fresh at call time (not destructured), so a
// single module-scope spy reconfigured per test is enough — no re-spying.
const fromSpy = vi.spyOn(supabase, "from");

describe("users service: createProfile", () => {
  let companiesInsert;
  let companiesEq;
  let companiesDelete;
  let usersSingle;
  let usersSelect;
  let usersInsert;

  const payload = {
    id: "auth-user-1",
    name: "Alex Builder",
    companyName: "Rivera Electric",
    companyType: "subcontractor",
  };

  beforeEach(() => {
    companiesInsert = vi.fn().mockResolvedValue({ error: null });
    companiesEq = vi.fn().mockResolvedValue({ error: null });
    companiesDelete = vi.fn(() => ({ eq: companiesEq }));

    usersSingle = vi.fn().mockResolvedValue({
      data: {
        id: "auth-user-1",
        name: "Alex Builder",
        role: "foreman",
        company_id: "generated-company-id",
      },
      error: null,
    });
    usersSelect = vi.fn(() => ({ single: usersSingle }));
    usersInsert = vi.fn(() => ({ select: usersSelect }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "companies") {
        return { insert: companiesInsert, delete: companiesDelete };
      }
      if (table === "users") {
        return { insert: usersInsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should create a company (with a generated UUID id) then a user row linked by company_id, and return the mapped result", async () => {
    // Arrange — default mocks above already represent the happy path

    // Act
    const result = await createProfile(payload);

    // Assert
    expect(companiesInsert).toHaveBeenCalledTimes(1);
    const companyInsertArgs = companiesInsert.mock.calls[0][0];
    expect(companyInsertArgs.id).toMatch(UUID_RE);
    expect(companyInsertArgs).toEqual({
      id: companyInsertArgs.id,
      name: "Rivera Electric",
      company_type: "subcontractor",
      tier: "basic",
    });

    expect(usersInsert).toHaveBeenCalledWith({
      id: "auth-user-1",
      company_id: companyInsertArgs.id,
      role: "foreman",
      name: "Alex Builder",
    });
    expect(companiesDelete).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "auth-user-1",
      name: "Alex Builder",
      role: "foreman",
      companyId: "generated-company-id",
    });
  });

  it("should throw a 502 AppError and skip the user insert when the company insert fails", async () => {
    // Arrange
    companiesInsert.mockResolvedValue({ error: new Error("db down") });

    // Act & Assert
    await expect(createProfile(payload)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not create your company",
    });
    expect(usersInsert).not.toHaveBeenCalled();
  });

  it("should clean up the company row and throw a 502 AppError on a generic user-insert failure", async () => {
    // Arrange
    usersSingle.mockResolvedValue({
      data: null,
      error: { code: "OTHER", message: "unexpected" },
    });

    // Act & Assert
    await expect(createProfile(payload)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not finish setting up your account",
    });
    expect(companiesDelete).toHaveBeenCalledTimes(1);
    const deletedCompanyId = companiesInsert.mock.calls[0][0].id;
    expect(companiesEq).toHaveBeenCalledWith("id", deletedCompanyId);
  });

  it("should clean up the company row and throw a 409 AppError when the user row already exists", async () => {
    // Arrange
    usersSingle.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });

    // Act & Assert
    await expect(createProfile(payload)).rejects.toMatchObject({
      statusCode: 409,
      message: "Profile already exists for this account",
    });
    expect(companiesDelete).toHaveBeenCalledTimes(1);
    const deletedCompanyId = companiesInsert.mock.calls[0][0].id;
    expect(companiesEq).toHaveBeenCalledWith("id", deletedCompanyId);
  });
});

describe("users service: getUserContext", () => {
  let usersSingle;
  let usersEq;
  let usersSelect;

  beforeEach(() => {
    usersSingle = vi.fn().mockResolvedValue({
      data: {
        id: "auth-user-1",
        name: "Alex Builder",
        role: "foreman",
        company_id: "company-1",
      },
      error: null,
    });
    usersEq = vi.fn(() => ({ single: usersSingle }));
    usersSelect = vi.fn(() => ({ eq: usersEq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "users") {
        return { select: usersSelect };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should look up the user row by id and return the mapped identity fields", async () => {
    // Act
    const result = await getUserContext("auth-user-1");

    // Assert
    expect(usersSelect).toHaveBeenCalledWith("id, name, role, company_id");
    expect(usersEq).toHaveBeenCalledWith("id", "auth-user-1");
    expect(result).toEqual({
      id: "auth-user-1",
      name: "Alex Builder",
      role: "foreman",
      companyId: "company-1",
    });
  });

  it("should throw a 404 AppError when no profile row exists for the auth user", async () => {
    // Arrange
    usersSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });

    // Act & Assert
    await expect(getUserContext("auth-user-1")).rejects.toMatchObject({
      statusCode: 404,
      message: "Profile not found",
    });
  });
});
