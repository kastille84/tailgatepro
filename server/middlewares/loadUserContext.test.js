// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const usersService = require("../services/users");
const { AppError } = require("../utility/AppError");
const { loadUserContext } = require("./loadUserContext");

const getUserContextSpy = vi.spyOn(usersService, "getUserContext");

describe("loadUserContext", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    getUserContextSpy.mockReset();
    req = { userId: "auth-user-1" };
    res = {};
    next = vi.fn();
  });

  it("should set req.user to { id, companyId, role } and call next() with no error", async () => {
    // Arrange
    getUserContextSpy.mockResolvedValue({
      id: "auth-user-1",
      name: "Alex Builder",
      role: "foreman",
      companyId: "company-1",
    });

    // Act
    await loadUserContext(req, res, next);

    // Assert
    expect(getUserContextSpy).toHaveBeenCalledWith("auth-user-1");
    expect(req.user).toEqual({
      id: "auth-user-1",
      companyId: "company-1",
      role: "foreman",
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("should forward the service error to next() and leave req.user unset", async () => {
    // Arrange
    getUserContextSpy.mockRejectedValue(new AppError("Profile not found", 404));

    // Act
    await loadUserContext(req, res, next);

    // Assert
    expect(req.user).toBeUndefined();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Profile not found");
  });
});
