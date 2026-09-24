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

  describe("invited signup (Phase 8c)", () => {
    it("should set req.profile to { name, inviteToken } and not require companyName/companyType", () => {
      req.userMetadata = { name: "  Jamie Foreman  ", inviteToken: "a".repeat(64) };

      requireProfileMetadata(req, res, next);

      expect(req.profile).toEqual({ name: "Jamie Foreman", inviteToken: "a".repeat(64) });
      expect(next).toHaveBeenCalledWith();
    });

    it("should call next with a 422 AppError when name is missing even with an inviteToken present", () => {
      req.userMetadata = { name: "   ", inviteToken: "a".repeat(64) };

      requireProfileMetadata(req, res, next);

      expect(req.profile).toBeUndefined();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(422);
    });
  });
});

describe("requireProfileMetadata: jobsite-invited signup (Phase 8d Case B)", () => {
  let req;
  let next;

  beforeEach(() => {
    req = {
      userMetadata: {
        name: "  Bob Sub  ",
        companyName: "  New Co Roofing  ",
        jobsiteInviteToken: "  " + "b".repeat(64) + "  ",
      },
    };
    next = vi.fn();
  });

  it("should set req.profile with the trimmed company name, the token, and companyType forced to subcontractor", () => {
    requireProfileMetadata(req, {}, next);

    expect(req.profile).toEqual({
      name: "Bob Sub",
      companyName: "New Co Roofing",
      companyType: "subcontractor",
      jobsiteInviteToken: "b".repeat(64),
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("should ignore a self-declared companyType of gc in the metadata", () => {
    req.userMetadata.companyType = "gc";

    requireProfileMetadata(req, {}, next);

    expect(req.profile.companyType).toBe("subcontractor");
  });

  it("should call next with a 422 AppError when companyName is missing", () => {
    delete req.userMetadata.companyName;

    requireProfileMetadata(req, {}, next);

    expect(req.profile).toBeUndefined();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(422);
    expect(error.message).toBe("Profile details are incomplete");
  });

  it("should call next with a 422 AppError when both a team inviteToken and a jobsiteInviteToken are present", () => {
    req.userMetadata.inviteToken = "a".repeat(64);

    requireProfileMetadata(req, {}, next);

    expect(req.profile).toBeUndefined();
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(422);
    expect(error.message).toBe("Profile details are incomplete");
  });

  it("should call next with a 422 AppError when name is missing even with a jobsiteInviteToken present", () => {
    req.userMetadata.name = "   ";

    requireProfileMetadata(req, {}, next);

    expect(req.profile).toBeUndefined();
    expect(next.mock.calls[0][0].statusCode).toBe(422);
  });
});
