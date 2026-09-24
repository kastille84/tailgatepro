// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { requireRole } = require("./requireRole");

describe("requireRole", () => {
  let res;
  let next;

  beforeEach(() => {
    res = {};
    next = vi.fn();
  });

  it("should call next() with no error when the caller's role is the single allowed role", () => {
    // Arrange
    const req = { user: { role: "admin" } };
    const middleware = requireRole("admin");

    // Act
    middleware(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith();
  });

  it("should call next() with no error when the caller's role is any of several allowed roles", () => {
    // Arrange
    const req = { user: { role: "safety_manager" } };
    const middleware = requireRole("admin", "safety_manager");

    // Act
    middleware(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith();
  });

  it("should forward a 403 AppError when the caller's role isn't in the allowed list", () => {
    // Arrange
    const req = { user: { role: "foreman" } };
    const middleware = requireRole("admin", "safety_manager");

    // Act
    middleware(req, res, next);

    // Assert
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it("should forward a 403 AppError when role is null", () => {
    // Arrange
    const req = { user: { role: null } };
    const middleware = requireRole("admin");

    // Act
    middleware(req, res, next);

    // Assert
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it("should forward a 403 AppError when req.user is missing", () => {
    // Arrange
    const req = {};
    const middleware = requireRole("admin");

    // Act
    middleware(req, res, next);

    // Assert
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });
});
