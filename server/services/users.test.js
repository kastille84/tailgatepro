// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
// uuid's `v4` export isn't configurable (its dual CJS/ESM build uses a
// non-writable getter), so it can't be spied on — instead of mocking uuid,
// these tests assert the company id it generates is a real UUID and that the
// same id links both inserts, rather than pinning an exact fake value.
const { supabase } = require("../utility/supabaseClient");
const companyInvitesService = require("./companyInvites");
const crewJoinLinksService = require("./crewJoinLinks");
const jobsitesService = require("./jobsites");
const seatsService = require("./seats");
const { createProfile, getUserContext, getAdminEmail } = require("./users");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `supabase.from` is looked up fresh at call time (not destructured), so a
// single module-scope spy reconfigured per test is enough — no re-spying.
const fromSpy = vi.spyOn(supabase, "from");
// Same reasoning for the Auth Admin API call getAdminEmail makes.
const getUserByIdSpy = vi.spyOn(supabase.auth.admin, "getUserById");
const getInviteForEmailSpy = vi.spyOn(companyInvitesService, "getInviteForEmail");
const deleteInviteSpy = vi.spyOn(companyInvitesService, "deleteInvite");
const assertSeatSpy = vi.spyOn(seatsService, "assertSeatAvailable");

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
        role: "admin",
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
      role: "admin",
      name: "Alex Builder",
    });
    expect(companiesDelete).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "auth-user-1",
      name: "Alex Builder",
      role: "admin",
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

describe("users service: createProfile (invite branch)", () => {
  let usersSingle;
  let usersSelect;
  let usersInsert;
  let companiesInsert;

  const payload = {
    id: "auth-user-1",
    email: "jamie@example.com",
    name: "Jamie Foreman",
    inviteToken: "a".repeat(64),
  };

  beforeEach(() => {
    companiesInsert = vi.fn();

    usersSingle = vi.fn().mockResolvedValue({
      data: {
        id: "auth-user-1",
        name: "Jamie Foreman",
        role: "foreman",
        company_id: "company-1",
      },
      error: null,
    });
    usersSelect = vi.fn(() => ({ single: usersSingle }));
    usersInsert = vi.fn(() => ({ select: usersSelect }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "companies") return { insert: companiesInsert };
      if (table === "users") return { insert: usersInsert };
      throw new Error(`Unexpected table: ${table}`);
    });

    getInviteForEmailSpy.mockReset().mockResolvedValue({
      id: "invite-1",
      companyId: "company-1",
      email: "jamie@example.com",
      role: "foreman",
    });
    deleteInviteSpy.mockReset().mockResolvedValue(undefined);
    assertSeatSpy.mockReset().mockResolvedValue(undefined);
  });

  it("should re-check the plan's seats (without pending invites) before inserting the user", async () => {
    // Act
    await createProfile(payload);

    // Assert
    expect(assertSeatSpy).toHaveBeenCalledWith({
      companyId: "company-1",
      role: "foreman",
      email: "jamie@example.com",
      includePending: false,
    });
  });

  it("should propagate a PLAN_LIMIT 403 without inserting a user row or consuming the invite", async () => {
    // Arrange
    const { AppError } = require("../utility/AppError");
    assertSeatSpy.mockRejectedValue(new AppError("limit", 403, { data: { code: "PLAN_LIMIT" } }));

    // Act & Assert
    await expect(createProfile(payload)).rejects.toMatchObject({ statusCode: 403 });
    expect(usersInsert).not.toHaveBeenCalled();
    expect(deleteInviteSpy).not.toHaveBeenCalled();
  });

  it("should look up the invite by token+email, insert the user at the invite's company/role, and consume the invite", async () => {
    // Act
    const result = await createProfile(payload);

    // Assert
    expect(getInviteForEmailSpy).toHaveBeenCalledWith("a".repeat(64), "jamie@example.com");
    expect(usersInsert).toHaveBeenCalledWith({
      id: "auth-user-1",
      company_id: "company-1",
      role: "foreman",
      name: "Jamie Foreman",
    });
    expect(companiesInsert).not.toHaveBeenCalled();
    expect(deleteInviteSpy).toHaveBeenCalledWith("invite-1");
    expect(result).toEqual({
      id: "auth-user-1",
      name: "Jamie Foreman",
      role: "foreman",
      companyId: "company-1",
    });
  });

  it("should throw a 409 AppError and not consume the invite when the user row already exists", async () => {
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
    expect(deleteInviteSpy).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError and not consume the invite on any other insert failure", async () => {
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
    expect(deleteInviteSpy).not.toHaveBeenCalled();
  });

  it("should propagate a mismatched-email 403 from getInviteForEmail without inserting a user row", async () => {
    // Arrange
    const { AppError } = require("../utility/AppError");
    getInviteForEmailSpy.mockRejectedValue(
      new AppError("This invite was sent to a different email address", 403),
    );

    // Act & Assert
    await expect(createProfile(payload)).rejects.toMatchObject({ statusCode: 403 });
    expect(usersInsert).not.toHaveBeenCalled();
  });

  it("should swallow a failed invite cleanup and still return the created profile", async () => {
    // Arrange
    deleteInviteSpy.mockRejectedValue(new Error("delete failed"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    const result = await createProfile(payload);

    // Assert
    expect(result).toEqual({
      id: "auth-user-1",
      name: "Jamie Foreman",
      role: "foreman",
      companyId: "company-1",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
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
        companies: { tier: "premium", company_type: "subcontractor" },
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

  it("should look up the user row by id and return the mapped identity fields, including the embedded company tier and type", async () => {
    // Act
    const result = await getUserContext("auth-user-1");

    // Assert
    expect(usersSelect).toHaveBeenCalledWith(
      "id, name, role, company_id, companies!users_company_id_fkey(tier, company_type, parent_gc_company_id, parent:parent_gc_company_id(tier))",
    );
    expect(usersEq).toHaveBeenCalledWith("id", "auth-user-1");
    expect(result).toEqual({
      id: "auth-user-1",
      name: "Alex Builder",
      role: "foreman",
      companyId: "company-1",
      tier: "premium",
      companyType: "subcontractor",
      parentGcCompanyId: null,
    });
  });

  it("should resolve an in-house crew's tier from its parent GC and expose the parent id", async () => {
    // Arrange
    usersSingle.mockResolvedValue({
      data: {
        id: "auth-user-1",
        name: "Alex Builder",
        role: "foreman",
        company_id: "crew-1",
        companies: {
          tier: "basic",
          company_type: "subcontractor",
          parent_gc_company_id: "gc-1",
          parent: { tier: "premium" },
        },
      },
      error: null,
    });

    // Act
    const result = await getUserContext("auth-user-1");

    // Assert
    expect(result.tier).toBe("premium");
    expect(result.parentGcCompanyId).toBe("gc-1");
  });

  it("should resolve a sponsored Free subcontractor's tier as premium", async () => {
    // Arrange
    usersSingle.mockResolvedValue({
      data: {
        id: "auth-user-1",
        name: "Alex Builder",
        role: "foreman",
        company_id: "company-1",
        companies: { tier: "basic", company_type: "subcontractor" },
      },
      error: null,
    });
    const sponsorQuery = {
      then: (resolve) =>
        Promise.resolve({ data: [{ jobsites: { plan: "site_pro" } }], error: null }).then(resolve),
    };
    ["select", "eq", "not", "is"].forEach((method) => {
      sponsorQuery[method] = vi.fn(() => sponsorQuery);
    });
    fromSpy.mockImplementation((table) => {
      if (table === "users") return { select: usersSelect };
      if (table === "jobsite_subcontractors") return sponsorQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    // Act
    const result = await getUserContext("auth-user-1");

    // Assert
    expect(result.tier).toBe("premium");
  });

  it("should default tier and companyType to null when the company embed is missing", async () => {
    // Arrange
    usersSingle.mockResolvedValue({
      data: {
        id: "auth-user-1",
        name: "Alex Builder",
        role: "foreman",
        company_id: "company-1",
        companies: null,
      },
      error: null,
    });

    // Act
    const result = await getUserContext("auth-user-1");

    // Assert
    expect(result.tier).toBeNull();
    expect(result.companyType).toBeNull();
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

  it("should throw a 404 AppError when the query returns neither data nor an error", async () => {
    // Arrange
    usersSingle.mockResolvedValue({ data: null, error: null });

    // Act & Assert
    await expect(getUserContext("auth-user-1")).rejects.toMatchObject({
      statusCode: 404,
      message: "Profile not found",
    });
  });

  it("should throw a 502 AppError carrying the original cause when the query fails for any reason other than no rows", async () => {
    // Arrange
    const queryError = { code: "PGRST201", message: "ambiguous embed" };
    usersSingle.mockResolvedValue({ data: null, error: queryError });

    // Act & Assert
    await expect(getUserContext("auth-user-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load your profile",
      cause: queryError,
    });
  });
});

describe("users service: getAdminEmail", () => {
  let usersLimit;
  let usersOrder;
  let usersEqRole;
  let usersEqCompany;
  let usersSelect;

  beforeEach(() => {
    usersLimit = vi.fn().mockResolvedValue({
      data: [{ id: "admin-user-1" }],
      error: null,
    });
    usersOrder = vi.fn(() => ({ limit: usersLimit }));
    usersEqRole = vi.fn(() => ({ order: usersOrder }));
    usersEqCompany = vi.fn(() => ({ eq: usersEqRole }));
    usersSelect = vi.fn(() => ({ eq: usersEqCompany }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "users") return { select: usersSelect };
      throw new Error(`Unexpected table: ${table}`);
    });

    getUserByIdSpy.mockReset().mockResolvedValue({
      data: { user: { email: "admin@example.com" } },
      error: null,
    });
  });

  it("should return the earliest-created admin's email, looked up via the Auth Admin API", async () => {
    // Act
    const result = await getAdminEmail("company-1");

    // Assert
    expect(usersSelect).toHaveBeenCalledWith("id");
    expect(usersEqCompany).toHaveBeenCalledWith("company_id", "company-1");
    expect(usersEqRole).toHaveBeenCalledWith("role", "admin");
    expect(usersOrder).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(usersLimit).toHaveBeenCalledWith(1);
    expect(getUserByIdSpy).toHaveBeenCalledWith("admin-user-1");
    expect(result).toBe("admin@example.com");
  });

  it("should return null when the company has no admin yet", async () => {
    // Arrange
    usersLimit.mockResolvedValue({ data: [], error: null });

    // Act
    const result = await getAdminEmail("company-1");

    // Assert
    expect(getUserByIdSpy).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("should return null when the auth user has no email on file", async () => {
    // Arrange
    getUserByIdSpy.mockResolvedValue({ data: { user: {} }, error: null });

    // Act
    const result = await getAdminEmail("company-1");

    // Assert
    expect(result).toBeNull();
  });

  it("should throw a 502 AppError when the users lookup fails", async () => {
    // Arrange
    usersLimit.mockResolvedValue({
      data: null,
      error: new Error("db down"),
    });

    // Act & Assert
    await expect(getAdminEmail("company-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not look up the company's admin",
    });
    expect(getUserByIdSpy).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError when the Auth Admin API call fails", async () => {
    // Arrange
    getUserByIdSpy.mockResolvedValue({
      data: null,
      error: new Error("auth service down"),
    });

    // Act & Assert
    await expect(getAdminEmail("company-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not look up the admin's email",
    });
  });
});

describe("users service: createProfile (jobsite invite branch, Phase 8d Case B)", () => {
  let companiesInsert;
  let companiesEq;
  let companiesDelete;
  let usersSingle;
  let usersInsert;
  let acceptInviteSpy;
  let errorSpy;

  const payload = {
    id: "auth-user-2",
    email: "bob@newco.com",
    name: "Bob Sub",
    companyName: "New Co Roofing",
    companyType: "subcontractor",
    jobsiteInviteToken: "b".repeat(64),
  };

  beforeEach(() => {
    companiesInsert = vi.fn().mockResolvedValue({ error: null });
    companiesEq = vi.fn().mockResolvedValue({ error: null });
    companiesDelete = vi.fn(() => ({ eq: companiesEq }));

    usersSingle = vi.fn().mockResolvedValue({
      data: { id: "auth-user-2", name: "Bob Sub", role: "admin", company_id: "generated-company-id" },
      error: null,
    });
    usersInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: usersSingle })) }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "companies") return { insert: companiesInsert, delete: companiesDelete };
      if (table === "users") return { insert: usersInsert };
      throw new Error(`Unexpected table: ${table}`);
    });

    acceptInviteSpy = vi.spyOn(jobsitesService, "acceptInvite").mockResolvedValue({ id: "project-9" });
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    acceptInviteSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("should create the company and admin user first, then accept the jobsite invite for the new company with the token-verified email", async () => {
    // Act
    const result = await createProfile(payload);

    // Assert
    const companyId = companiesInsert.mock.calls[0][0].id;
    expect(companyId).toMatch(UUID_RE);
    expect(companiesInsert.mock.calls[0][0].company_type).toBe("subcontractor");
    expect(usersInsert).toHaveBeenCalledWith({
      id: "auth-user-2",
      company_id: companyId,
      role: "admin",
      name: "Bob Sub",
    });
    expect(acceptInviteSpy).toHaveBeenCalledWith({
      token: "b".repeat(64),
      email: "bob@newco.com",
      companyId,
    });
    expect(usersInsert.mock.invocationCallOrder[0]).toBeLessThan(acceptInviteSpy.mock.invocationCallOrder[0]);
    expect(result).toEqual({
      id: "auth-user-2",
      name: "Bob Sub",
      role: "admin",
      companyId: "generated-company-id",
    });
  });

  it("should not accept anything when no jobsiteInviteToken is present", async () => {
    // Act
    await createProfile({ ...payload, jobsiteInviteToken: undefined });

    // Assert
    expect(acceptInviteSpy).not.toHaveBeenCalled();
  });

  it("should not attempt the accept when the user insert fails", async () => {
    // Arrange
    usersSingle.mockResolvedValue({ data: null, error: { code: "OTHER", message: "unexpected" } });

    // Act & Assert
    await expect(createProfile(payload)).rejects.toMatchObject({ statusCode: 502 });
    expect(acceptInviteSpy).not.toHaveBeenCalled();
  });

  it("should log and swallow a failed accept, still returning the created profile", async () => {
    // Arrange
    const acceptError = new Error("This invite was sent to a different email address");
    acceptInviteSpy.mockRejectedValue(acceptError);

    // Act
    const result = await createProfile(payload);

    // Assert
    expect(errorSpy).toHaveBeenCalledWith("users: failed to accept a jobsite invite", acceptError);
    expect(result.id).toBe("auth-user-2");
    expect(companiesDelete).not.toHaveBeenCalled();
  });
});

describe("users service: createProfile (jobsite QR/join-link branch, Phase 9e)", () => {
  let companiesInsert;
  let companiesEq;
  let companiesDelete;
  let usersSingle;
  let usersInsert;
  let acceptJoinLinkSpy;
  let errorSpy;

  const payload = {
    id: "auth-user-3",
    email: "carla@newco.com",
    name: "Carla Sub",
    companyName: "Newer Co Roofing",
    companyType: "subcontractor",
    jobsiteJoinToken: "c".repeat(64),
  };

  beforeEach(() => {
    companiesInsert = vi.fn().mockResolvedValue({ error: null });
    companiesEq = vi.fn().mockResolvedValue({ error: null });
    companiesDelete = vi.fn(() => ({ eq: companiesEq }));

    usersSingle = vi.fn().mockResolvedValue({
      data: { id: "auth-user-3", name: "Carla Sub", role: "admin", company_id: "generated-company-id" },
      error: null,
    });
    usersInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: usersSingle })) }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "companies") return { insert: companiesInsert, delete: companiesDelete };
      if (table === "users") return { insert: usersInsert };
      throw new Error(`Unexpected table: ${table}`);
    });

    acceptJoinLinkSpy = vi.spyOn(jobsitesService, "acceptJoinLink").mockResolvedValue({ id: "project-9" });
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    acceptJoinLinkSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("should create the company and admin user first, then accept the jobsite join link for the new company (no email involved)", async () => {
    // Act
    const result = await createProfile(payload);

    // Assert
    const companyId = companiesInsert.mock.calls[0][0].id;
    expect(companyId).toMatch(UUID_RE);
    expect(companiesInsert.mock.calls[0][0].company_type).toBe("subcontractor");
    expect(usersInsert).toHaveBeenCalledWith({
      id: "auth-user-3",
      company_id: companyId,
      role: "admin",
      name: "Carla Sub",
    });
    expect(acceptJoinLinkSpy).toHaveBeenCalledWith({ token: "c".repeat(64), companyId });
    expect(usersInsert.mock.invocationCallOrder[0]).toBeLessThan(
      acceptJoinLinkSpy.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({
      id: "auth-user-3",
      name: "Carla Sub",
      role: "admin",
      companyId: "generated-company-id",
    });
  });

  it("should not accept anything when no jobsiteJoinToken is present", async () => {
    // Act
    await createProfile({ ...payload, jobsiteJoinToken: undefined });

    // Assert
    expect(acceptJoinLinkSpy).not.toHaveBeenCalled();
  });

  it("should not attempt the accept when the user insert fails", async () => {
    // Arrange
    usersSingle.mockResolvedValue({ data: null, error: { code: "OTHER", message: "unexpected" } });

    // Act & Assert
    await expect(createProfile(payload)).rejects.toMatchObject({ statusCode: 502 });
    expect(acceptJoinLinkSpy).not.toHaveBeenCalled();
  });

  it("should log and swallow a failed accept, still returning the created profile", async () => {
    // Arrange
    const acceptError = new Error("boom");
    acceptJoinLinkSpy.mockRejectedValue(acceptError);

    // Act
    const result = await createProfile(payload);

    // Assert
    expect(errorSpy).toHaveBeenCalledWith("users: failed to accept a jobsite join link", acceptError);
    expect(result.id).toBe("auth-user-3");
    expect(companiesDelete).not.toHaveBeenCalled();
  });
});

describe("users service: createProfile (crew join-link branch, Phase 13f-join)", () => {
  let usersSingle;
  let usersInsert;
  const getActiveSpy = vi.spyOn(crewJoinLinksService, "getActiveByToken");
  const claimSpy = vi.spyOn(crewJoinLinksService, "claimSlot");
  const releaseSpy = vi.spyOn(crewJoinLinksService, "releaseSlot");
  const link = { id: "link-1", companyId: "crew-1", uses: 2, crewName: "Crew", gcName: "GC" };

  const payload = {
    id: "auth-user-1",
    email: "jamie@example.com",
    name: "Jamie Foreman",
    crewJoinToken: "a".repeat(64),
    // A client cannot pick a role or company: these must be ignored.
    role: "admin",
    companyName: "Evil Co",
    companyType: "gc",
  };

  beforeEach(() => {
    usersSingle = vi.fn().mockResolvedValue({
      data: { id: "auth-user-1", name: "Jamie Foreman", role: "foreman", company_id: "crew-1" },
      error: null,
    });
    usersInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: usersSingle })) }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "users") return { insert: usersInsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    getActiveSpy.mockReset().mockResolvedValue(link);
    claimSpy.mockReset().mockResolvedValue(undefined);
    releaseSpy.mockReset().mockResolvedValue(undefined);
    assertSeatSpy.mockReset().mockResolvedValue(undefined);
  });

  it("should join the crew as a foreman, whatever role or company the client claims", async () => {
    // Act
    const result = await createProfile(payload);

    // Assert
    expect(getActiveSpy).toHaveBeenCalledWith("a".repeat(64));
    expect(usersInsert).toHaveBeenCalledWith({
      id: "auth-user-1",
      company_id: "crew-1",
      role: "foreman",
      name: "Jamie Foreman",
    });
    expect(result).toEqual({
      id: "auth-user-1",
      name: "Jamie Foreman",
      role: "foreman",
      companyId: "crew-1",
    });
  });

  it("should check the crew's seats without pending invites, before taking a spot", async () => {
    // Act
    await createProfile(payload);

    // Assert
    expect(assertSeatSpy).toHaveBeenCalledWith({
      companyId: "crew-1",
      role: "foreman",
      email: "jamie@example.com",
      includePending: false,
    });
    expect(assertSeatSpy.mock.invocationCallOrder[0]).toBeLessThan(
      claimSpy.mock.invocationCallOrder[0],
    );
    expect(claimSpy).toHaveBeenCalledWith(link);
  });

  it("should propagate a PLAN_LIMIT 403 without taking a spot or inserting a user row", async () => {
    // Arrange
    const { AppError } = require("../utility/AppError");
    assertSeatSpy.mockRejectedValue(new AppError("limit", 403, { data: { code: "PLAN_LIMIT" } }));

    // Act & Assert
    await expect(createProfile(payload)).rejects.toMatchObject({ statusCode: 403 });
    expect(claimSpy).not.toHaveBeenCalled();
    expect(usersInsert).not.toHaveBeenCalled();
  });

  it("should propagate an invalid-link 404 without touching users", async () => {
    // Arrange
    const { AppError } = require("../utility/AppError");
    getActiveSpy.mockRejectedValue(new AppError("This join link is invalid or has expired", 404));

    // Act & Assert
    await expect(createProfile(payload)).rejects.toMatchObject({ statusCode: 404 });
    expect(assertSeatSpy).not.toHaveBeenCalled();
    expect(usersInsert).not.toHaveBeenCalled();
  });

  it("should propagate a lost-race 409 from claiming a spot without inserting a user row", async () => {
    // Arrange
    const { AppError } = require("../utility/AppError");
    claimSpy.mockRejectedValue(new AppError("Someone else just joined", 409));

    // Act & Assert
    await expect(createProfile(payload)).rejects.toMatchObject({ statusCode: 409 });
    expect(usersInsert).not.toHaveBeenCalled();
  });

  it("should hand the spot back and throw a 409 when the profile already exists", async () => {
    // Arrange
    usersSingle.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });

    // Act & Assert
    await expect(createProfile(payload)).rejects.toMatchObject({
      statusCode: 409,
      message: "Profile already exists for this account",
    });
    expect(releaseSpy).toHaveBeenCalledWith(link);
  });

  it("should hand the spot back and throw a 502 on any other insert failure", async () => {
    // Arrange
    usersSingle.mockResolvedValue({ data: null, error: { code: "OTHER", message: "boom" } });

    // Act & Assert
    await expect(createProfile(payload)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not finish setting up your account",
    });
    expect(releaseSpy).toHaveBeenCalledWith(link);
  });
});
