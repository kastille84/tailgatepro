// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const usersService = require("../services/users");
const { createProfile, getCurrentUser } = require("./users");

const createProfileSpy = vi.spyOn(usersService, "createProfile");

describe("users controller: createProfile", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    createProfileSpy.mockReset();
    req = {
      userId: "auth-user-1",
      userEmail: "alex@example.com",
      profile: {
        name: "Alex Builder",
        companyName: "Rivera Electric",
        companyType: "subcontractor",
      },
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it("should call the service with req.userId/req.userEmail and req.profile fields, and respond 201", async () => {
    // Arrange
    createProfileSpy.mockResolvedValue({
      id: "auth-user-1",
      name: "Alex Builder",
      role: "foreman",
      companyId: "company-1",
    });

    // Act
    await createProfile(req, res, next);

    // Assert
    expect(createProfileSpy).toHaveBeenCalledWith({
      id: "auth-user-1",
      email: "alex@example.com",
      name: "Alex Builder",
      companyName: "Rivera Electric",
      companyType: "subcontractor",
      inviteToken: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        id: "auth-user-1",
        name: "Alex Builder",
        role: "foreman",
        companyId: "company-1",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should pass an invited signup's inviteToken through to the service (Phase 8c)", async () => {
    // Arrange
    req.profile = { name: "Jamie Foreman", inviteToken: "a".repeat(64) };
    createProfileSpy.mockResolvedValue({
      id: "auth-user-1",
      name: "Jamie Foreman",
      role: "foreman",
      companyId: "company-1",
    });

    // Act
    await createProfile(req, res, next);

    // Assert
    expect(createProfileSpy).toHaveBeenCalledWith({
      id: "auth-user-1",
      email: "alex@example.com",
      name: "Jamie Foreman",
      companyName: undefined,
      companyType: undefined,
      inviteToken: "a".repeat(64),
    });
  });

  it("should ignore any id present in req.body or req.profile and still use req.userId", async () => {
    // Arrange
    req.body.id = "attacker-supplied-id";
    req.profile.id = "attacker-supplied-id";
    createProfileSpy.mockResolvedValue({
      id: "auth-user-1",
      name: "Alex Builder",
      role: "foreman",
      companyId: "company-1",
    });

    // Act
    await createProfile(req, res, next);

    // Assert
    expect(createProfileSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: "auth-user-1" }),
    );
  });

  it("should forward a service error to next() instead of responding", async () => {
    // Arrange
    const error = new Error("insert failed");
    createProfileSpy.mockRejectedValue(error);

    // Act
    await createProfile(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("users controller: createProfile (jobsite invite, Phase 8d)", () => {
  it("should pass a jobsite-invited signup's jobsiteInviteToken and forced companyType through to the service", async () => {
    // Arrange
    createProfileSpy.mockReset().mockResolvedValue({
      id: "auth-user-2",
      name: "Bob Sub",
      role: "admin",
      companyId: "company-9",
    });
    const req = {
      userId: "auth-user-2",
      userEmail: "bob@newco.com",
      profile: {
        name: "Bob Sub",
        companyName: "New Co Roofing",
        companyType: "subcontractor",
        jobsiteInviteToken: "b".repeat(64),
      },
      body: {},
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    // Act
    await createProfile(req, res, next);

    // Assert
    expect(createProfileSpy).toHaveBeenCalledWith({
      id: "auth-user-2",
      email: "bob@newco.com",
      name: "Bob Sub",
      companyName: "New Co Roofing",
      companyType: "subcontractor",
      inviteToken: undefined,
      jobsiteInviteToken: "b".repeat(64),
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("users controller: getCurrentUser", () => {
  it("should respond 200 with req.user plus the resolved plan and limits", () => {
    const req = {
      user: {
        id: "u1",
        companyId: "c1",
        role: "admin",
        tier: "premium",
        companyType: "subcontractor",
      },
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    getCurrentUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { success, data } = res.json.mock.calls[0][0];
    expect(success).toBe(true);
    expect(data).toMatchObject({ ...req.user, plan: "trade-pro" });
    expect(data.limits.foremanSeats).toBe(8);
  });
});
