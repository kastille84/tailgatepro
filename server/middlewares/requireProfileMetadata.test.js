// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { requireProfileMetadata } = require("./requireProfileMetadata");

describe("requireProfileMetadata", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      userMetadata: {
        name: "  Alex Builder  ",
        companyName: "  Rivera Electric  ",
        companyType: "subcontractor",
      },
    };
    res = {};
    next = vi.fn();
  });

  it("should normalize the metadata into req.profile and call next() with no error", () => {
    requireProfileMetadata(req, res, next);

    expect(req.profile).toEqual({
      name: "Alex Builder",
      companyName: "Rivera Electric",
      companyType: "subcontractor",
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("should call next with a 422 AppError when name is missing", () => {
    req.userMetadata.name = "   ";

    requireProfileMetadata(req, res, next);

    expect(req.profile).toBeUndefined();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(422);
    expect(error.message).toBe("Profile details are incomplete");
  });

  it("should call next with a 422 AppError when companyName is missing", () => {
    delete req.userMetadata.companyName;

    requireProfileMetadata(req, res, next);

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(422);
  });

  it("should call next with a 422 AppError when companyType is not a known value", () => {
    req.userMetadata.companyType = "freelancer";

    requireProfileMetadata(req, res, next);

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(422);
  });

  it("should call next with a 422 AppError when req.userMetadata is undefined", () => {
    req.userMetadata = undefined;

    requireProfileMetadata(req, res, next);

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(422);
  });
});
