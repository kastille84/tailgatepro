// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const stripeWebhookService = require("../services/stripeWebhook");
const { handleStripeWebhook } = require("./stripeWebhook");

const handleWebhookSpy = vi.spyOn(stripeWebhookService, "handleWebhook");

describe("stripe webhook controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    handleWebhookSpy.mockReset();
    req = {
      body: Buffer.from("raw-bytes"),
      get: vi.fn().mockReturnValue("t=1,v1=abc"),
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it("passes the raw body and signature header to the service and acks with 200", async () => {
    handleWebhookSpy.mockResolvedValue({ duplicate: false });

    await handleStripeWebhook(req, res, next);

    expect(req.get).toHaveBeenCalledWith("stripe-signature");
    expect(handleWebhookSpy).toHaveBeenCalledWith({
      rawBody: req.body,
      signature: "t=1,v1=abc",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards service errors to next", async () => {
    const error = new Error("boom");
    handleWebhookSpy.mockRejectedValue(error);

    await handleStripeWebhook(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
