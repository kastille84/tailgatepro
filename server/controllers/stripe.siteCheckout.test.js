// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const stripeService = require("../services/stripe");
const { createSiteCheckoutSession } = require("./stripe");

const serviceSpy = vi.spyOn(stripeService, "createSiteCheckoutSession");

describe("stripe controller: createSiteCheckoutSession", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    serviceSpy.mockReset();
    req = {
      body: { jobsiteId: "site-1", interval: "annual" },
      userEmail: "gc@bigco.com",
      user: { id: "user-1", companyId: "company-1", companyType: "gc" },
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it("passes the caller's verified company and the body's jobsite to the service", async () => {
    serviceSpy.mockResolvedValue({ url: "https://checkout" });

    await createSiteCheckoutSession(req, res, next);

    expect(serviceSpy).toHaveBeenCalledWith({
      companyId: "company-1",
      companyType: "gc",
      email: "gc@bigco.com",
      jobsiteId: "site-1",
      interval: "annual",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { url: "https://checkout" },
    });
  });

  it("forwards service errors to next", async () => {
    const error = new Error("boom");
    serviceSpy.mockRejectedValue(error);

    await createSiteCheckoutSession(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
