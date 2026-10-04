// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const stripeService = require("../services/stripe");
const {
  getBilling,
  createCheckoutSession,
  createPortalSession,
} = require("./stripe");

const getSummarySpy = vi.spyOn(stripeService, "getBillingSummary");
const createCheckoutSpy = vi.spyOn(stripeService, "createCheckoutSession");
const createPortalSpy = vi.spyOn(stripeService, "createPortalSession");

describe("stripe controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    getSummarySpy.mockReset();
    createCheckoutSpy.mockReset();
    createPortalSpy.mockReset();
    req = {
      body: { planId: "trade-pro", interval: "annual" },
      userEmail: "boss@acme.com",
      user: { id: "user-1", companyId: "company-1", companyType: "subcontractor" },
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  describe("getBilling", () => {
    it("returns the summary for the caller's company", async () => {
      const summary = { hasBillingAccount: true, subscriptionStatus: "active" };
      getSummarySpy.mockResolvedValue(summary);

      await getBilling(req, res, next);

      expect(getSummarySpy).toHaveBeenCalledWith("company-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: summary });
    });

    it("forwards service errors to next", async () => {
      const error = new Error("boom");
      getSummarySpy.mockRejectedValue(error);

      await getBilling(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("createCheckoutSession", () => {
    it("passes the caller's verified company and body to the service", async () => {
      createCheckoutSpy.mockResolvedValue({ url: "https://checkout" });

      await createCheckoutSession(req, res, next);

      expect(createCheckoutSpy).toHaveBeenCalledWith({
        companyId: "company-1",
        companyType: "subcontractor",
        email: "boss@acme.com",
        planKey: "trade-pro",
        interval: "annual",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { url: "https://checkout" },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("forwards service errors to next", async () => {
      const error = new Error("boom");
      createCheckoutSpy.mockRejectedValue(error);

      await createCheckoutSession(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("createPortalSession", () => {
    it("returns the portal url for the caller's company", async () => {
      createPortalSpy.mockResolvedValue({ url: "https://portal" });

      await createPortalSession(req, res, next);

      expect(createPortalSpy).toHaveBeenCalledWith({ companyId: "company-1" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { url: "https://portal" },
      });
    });

    it("forwards service errors to next", async () => {
      const error = new Error("boom");
      createPortalSpy.mockRejectedValue(error);

      await createPortalSession(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
