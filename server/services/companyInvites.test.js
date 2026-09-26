// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const seatsService = require("./seats");
const {
  createInvite,
  previewInvite,
  getInviteForEmail,
  deleteInvite,
} = require("./companyInvites");

const INVITE_COLUMNS = "id, company_id, email, role, token, expires_at";

const dbRow = {
  id: "invite-1",
  company_id: "company-1",
  email: "newhire@example.com",
  role: "foreman",
  token: "a".repeat(64),
  expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
};

const mappedInvite = {
  id: "invite-1",
  companyId: "company-1",
  email: "newhire@example.com",
  role: "foreman",
  token: "a".repeat(64),
  expiresAt: dbRow.expires_at,
};

const fromSpy = vi.spyOn(supabase, "from");
const assertSeatSpy = vi.spyOn(seatsService, "assertSeatAvailable");

describe("companyInvites service: createInvite", () => {
  let single;
  let select;
  let upsert;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    select = vi.fn(() => ({ single }));
    upsert = vi.fn(() => ({ select }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "company_invites") return { upsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    assertSeatSpy.mockReset().mockResolvedValue(undefined);
  });

  it("should check the plan's seats (including pending invites) before writing", async () => {
    // Act
    await createInvite("company-1", "newhire@example.com", "foreman");

    // Assert
    expect(assertSeatSpy).toHaveBeenCalledWith({
      companyId: "company-1",
      role: "foreman",
      email: "newhire@example.com",
      includePending: true,
    });
  });

  it("should not write an invite when the plan's seats are full", async () => {
    // Arrange
    const { AppError } = require("../utility/AppError");
    assertSeatSpy.mockRejectedValue(new AppError("limit", 403, { data: { code: "PLAN_LIMIT" } }));

    // Act & Assert
    await expect(
      createInvite("company-1", "newhire@example.com", "foreman"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("should upsert a new invite row keyed on (company_id, email) and return the mapped result", async () => {
    // Act
    const result = await createInvite("company-1", "newhire@example.com", "foreman");

    // Assert
    const payload = upsert.mock.calls[0][0];
    expect(payload.company_id).toBe("company-1");
    expect(payload.email).toBe("newhire@example.com");
    expect(payload.role).toBe("foreman");
    expect(payload.token).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: "company_id,email" });
    expect(select).toHaveBeenCalledWith(INVITE_COLUMNS);
    expect(result).toEqual(mappedInvite);
  });

  it("should throw a 502 AppError on a query failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(
      createInvite("company-1", "newhire@example.com", "foreman"),
    ).rejects.toMatchObject({ statusCode: 502, message: "Could not create the invite" });
  });
});

describe("companyInvites service: previewInvite / getInviteForEmail (shared active-invite lookup)", () => {
  let single;
  let eq;
  let select;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({
      data: { ...dbRow, companies: { name: "Rivera Electric" } },
      error: null,
    });
    eq = vi.fn(() => ({ single }));
    select = vi.fn(() => ({ eq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "company_invites") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("previewInvite should return { companyName, email, role } for an active invite", async () => {
    // Act
    const result = await previewInvite(dbRow.token);

    // Assert
    expect(select).toHaveBeenCalledWith(`${INVITE_COLUMNS}, companies(name)`);
    expect(eq).toHaveBeenCalledWith("token", dbRow.token);
    expect(result).toEqual({
      companyName: "Rivera Electric",
      email: "newhire@example.com",
      role: "foreman",
    });
  });

  it("previewInvite should throw a 404 AppError when no row matches the token", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(previewInvite("unknown-token")).rejects.toMatchObject({
      statusCode: 404,
      message: "This invite link is invalid or has expired",
    });
  });

  it("previewInvite should throw a 404 AppError when the invite was found but has expired", async () => {
    // Arrange
    single.mockResolvedValue({
      data: {
        ...dbRow,
        expires_at: new Date(Date.now() - 1000).toISOString(),
        companies: { name: "Rivera Electric" },
      },
      error: null,
    });

    // Act & Assert
    await expect(previewInvite(dbRow.token)).rejects.toMatchObject({
      statusCode: 404,
      message: "This invite link is invalid or has expired",
    });
  });

  it("previewInvite should throw a 502 AppError on any other query failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(previewInvite(dbRow.token)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not look up the invite",
    });
  });

  it("getInviteForEmail should return the invite when the email matches, case-insensitively", async () => {
    // Act
    const result = await getInviteForEmail(dbRow.token, "NewHire@Example.com");

    // Assert
    expect(result.companyId).toBe("company-1");
    expect(result.role).toBe("foreman");
  });

  it("getInviteForEmail should throw a 403 AppError when the email does not match", async () => {
    // Act & Assert
    await expect(
      getInviteForEmail(dbRow.token, "someone-else@example.com"),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "This invite was sent to a different email address",
    });
  });

  it("getInviteForEmail should propagate a 404 from the underlying lookup", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(
      getInviteForEmail("unknown-token", "newhire@example.com"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("companyInvites service: deleteInvite", () => {
  let eq;
  let del;

  beforeEach(() => {
    eq = vi.fn().mockResolvedValue({ error: null });
    del = vi.fn(() => ({ eq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "company_invites") return { delete: del };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should delete the invite row by id", async () => {
    // Act
    await deleteInvite("invite-1");

    // Assert
    expect(eq).toHaveBeenCalledWith("id", "invite-1");
  });

  it("should throw a 502 AppError on a delete failure", async () => {
    // Arrange
    eq.mockResolvedValue({ error: { code: "OTHER" } });

    // Act & Assert
    await expect(deleteInvite("invite-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not finish accepting the invite",
    });
  });
});
