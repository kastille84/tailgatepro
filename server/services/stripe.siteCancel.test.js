// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { setSiteCancelAtPeriodEnd } = require("./stripe");

const fromSpy = vi.spyOn(supabase, "from");

// jobsites: select().eq().maybeSingle()
const mockJobsite = (data, error = null) => {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  fromSpy.mockImplementation(() => ({
    select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
  }));
};

const makeStripe = (subscription = {}) => ({
  subscriptions: {
    retrieve: vi
      .fn()
      .mockResolvedValue({ status: "active", cancel_at_period_end: false, ...subscription }),
    update: vi.fn().mockResolvedValue({}),
  },
});

describe("stripe service: setSiteCancelAtPeriodEnd", () => {
  beforeEach(() => {
    fromSpy.mockReset();
  });

  it("should schedule the subscription to end with the paid period", async () => {
    mockJobsite({ stripe_subscription_id: "sub_1" });
    const stripe = makeStripe();

    await setSiteCancelAtPeriodEnd("site-1", true, stripe);

    expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_1", {
      cancel_at_period_end: true,
    });
  });

  it("should un-schedule the cancellation when the jobsite is restored", async () => {
    mockJobsite({ stripe_subscription_id: "sub_1" });
    const stripe = makeStripe({ cancel_at_period_end: true });

    await setSiteCancelAtPeriodEnd("site-1", false, stripe);

    expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_1", {
      cancel_at_period_end: false,
    });
  });

  it("should do nothing when the jobsite has no subscription", async () => {
    mockJobsite({ stripe_subscription_id: null });
    const stripe = makeStripe();

    await setSiteCancelAtPeriodEnd("site-1", true, stripe);

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("should do nothing when the jobsite row is missing", async () => {
    mockJobsite(null);
    const stripe = makeStripe();

    await setSiteCancelAtPeriodEnd("site-1", true, stripe);

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("should leave an already-canceled subscription alone", async () => {
    mockJobsite({ stripe_subscription_id: "sub_1" });
    const stripe = makeStripe({ status: "canceled" });

    await setSiteCancelAtPeriodEnd("site-1", true, stripe);

    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it("should not update a subscription that already has the requested flag", async () => {
    mockJobsite({ stripe_subscription_id: "sub_1" });
    const stripe = makeStripe({ cancel_at_period_end: true });

    await setSiteCancelAtPeriodEnd("site-1", true, stripe);

    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it("should throw a 502 when the jobsite cannot be loaded", async () => {
    mockJobsite(null, { message: "db down" });

    await expect(setSiteCancelAtPeriodEnd("site-1", true, makeStripe())).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load the jobsite",
    });
  });

  it("should throw a 502 when Stripe fails", async () => {
    mockJobsite({ stripe_subscription_id: "sub_1" });
    const stripe = makeStripe();
    stripe.subscriptions.update.mockRejectedValue(new Error("stripe down"));

    await expect(setSiteCancelAtPeriodEnd("site-1", true, stripe)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not update the Site Pro subscription",
    });
  });
});
