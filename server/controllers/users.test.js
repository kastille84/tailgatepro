// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const usersService = require("../services/users");
const { createProfile } = require("./users");

const createProfileSpy = vi.spyOn(usersService, "createProfile");

describe("users controller: createProfile", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    createProfileSpy.mockReset();
    req = {
      userId: "auth-user-1",
      body: {
        name: "Alex Builder",
        companyName: "Rivera Electric",
        companyType: "subcontractor",
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it("should call the service with req.userId, never a body-supplied id, and respond 201", async () => {
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
      name: "Alex Builder",
      companyName: "Rivera Electric",
      companyType: "subcontractor",
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

  it("should ignore any id present in req.body and still use req.userId", async () => {
    // Arrange
    req.body.id = "attacker-supplied-id";
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
