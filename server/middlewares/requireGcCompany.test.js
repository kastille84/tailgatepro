// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { requireGcCompany } = require("./requireGcCompany");

describe("requireGcCompany", () => {
  let res;
  let next;

  beforeEach(() => {
    res = {};
    next = vi.fn();
  });

  it("should call next() with no error for a GC company", () => {
    // Arrange
    const req = { user: { companyType: "gc" } };

    // Act
    requireGcCompany(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith();
  });

  it("should forward a 403 AppError for a subcontractor company", () => {
    // Arrange
    const req = { user: { companyType: "subcontractor" } };

    // Act
    requireGcCompany(req, res, next);

    // Assert
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
  });

  it("should forward a 403 AppError when companyType is null", () => {
    // Arrange
    const req = { user: { companyType: null } };

    // Act
    requireGcCompany(req, res, next);

    // Assert
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it("should forward a 403 AppError when req.user is missing", () => {
    // Arrange
    const req = {};

    // Act
    requireGcCompany(req, res, next);

    // Assert
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });
});
