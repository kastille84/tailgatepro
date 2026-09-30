// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { handleWebhook } = require("./stripeWebhook");

const fromSpy = vi.spyOn(supabase, "from");
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const company = {
  id: "company-1",
  company_type: "subcontractor",
  stripe_subscription_id: null,
};

// Wires supabase.from() per table:
//   stripe_events: select().eq().maybeSingle(), insert()
//   companies:     select().eq().maybeSingle(), update().eq()
const mockDb = ({
  processed = false,
  companyRow = company,
  insertError = null,
  updateError = null,
  companySelectError = null,
  eventSelectError = null,
} = {}) => {
  const eventsMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: processed ? { id: "evt_1" } : null, error: eventSelectError });
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const companiesEq = vi
    .fn()
    .mockReturnValue({
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: companyRow, error: companySelectError }),
    });
  const updateEq = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  fromSpy.mockImplementation((table) =>
    table === "stripe_events"
      ? {
          select: vi
            .fn()
            .mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: eventsMaybeSingle }) }),
          insert,
        }
      : { select: vi.fn().mockReturnValue({ eq: companiesEq }), update },
  );
  return { insert, update, updateEq, companiesEq };
};

const subscription = (overrides = {}) => ({
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  metadata: { companyId: "company-1" },
  current_period_end: 1800000000,
  items: { data: [{ price: { id: "price_tp_m" } }] },
  ...overrides,
});

const makeStripe = (event, sub = subscription()) => ({
  webhooks: { constructEvent: vi.fn().mockReturnValue(event) },
  subscriptions: { retrieve: vi.fn().mockResolvedValue(sub) },
});

const subEvent = (type = "customer.subscription.updated") => ({
  id: "evt_1",
  type,
  data: { object: { id: "sub_1" } },
});

const call = (stripe) =>
  handleWebhook({ rawBody: Buffer.from("{}"), signature: "sig" }, stripe);

describe("stripe webhook service", () => {
  beforeAll(() => {
    process.env.STRIPE_PRICE_TRADE_PRO_MONTHLY = "price_tp_m";
    process.env.STRIPE_PRICE_GC_PORTFOLIO_10_SITES_MONTHLY = "price_g10_m";
  });

  beforeEach(() => {
    fromSpy.mockReset();
    errorSpy.mockClear();
  });

  it("rejects a bad signature with 400 and touches nothing", async () => {
    const cause = new Error("bad sig");
    const stripe = makeStripe(subEvent());
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw cause;
    });

    await expect(call(stripe)).rejects.toMatchObject({ statusCode: 400, cause });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("skips an event that was already processed", async () => {
    const { update, insert } = mockDb({ processed: true });
    const stripe = makeStripe(subEvent());

    await expect(call(stripe)).resolves.toEqual({ duplicate: true });
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("writes the tier, interval and period end for an active subscription, then records the event", async () => {
    const { update, updateEq, insert } = mockDb();
    const stripe = makeStripe(subEvent());

    await expect(call(stripe)).resolves.toEqual({ duplicate: false });

    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
    expect(update).toHaveBeenCalledWith({
      stripe_subscription_id: "sub_1",
      subscription_status: "active",
      current_period_end: new Date(1800000000 * 1000).toISOString(),
      tier: "premium",
      billing_interval: "monthly",
    });
    expect(updateEq).toHaveBeenCalledWith("id", "company-1");
    expect(insert).toHaveBeenCalledWith({
      id: "evt_1",
      type: "customer.subscription.updated",
    });
  });

  it("reads current_period_end from the subscription item when absent on the subscription", async () => {
    const { update } = mockDb();
    const sub = subscription({
      current_period_end: undefined,
      items: { data: [{ price: { id: "price_tp_m" }, current_period_end: 1700000000 }] },
    });

    await call(makeStripe(subEvent(), sub));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        current_period_end: new Date(1700000000 * 1000).toISOString(),
      }),
    );
  });

  it("stores a null period end when Stripe sends none", async () => {
    const { update } = mockDb();
    const sub = subscription({
      current_period_end: undefined,
      items: { data: [{ price: { id: "price_tp_m" } }] },
    });

    await call(makeStripe(subEvent(), sub));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ current_period_end: null }),
    );
  });

  it("handles checkout.session.completed for a subscription checkout", async () => {
    const { update } = mockDb();
    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", subscription: "sub_9" } },
    };
    const stripe = makeStripe(event);

    await call(stripe);

    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_9");
    expect(update).toHaveBeenCalled();
  });

  it("ignores a non-subscription checkout but still records the event", async () => {
    const { update, insert } = mockDb();
    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { mode: "payment", subscription: null } },
    };
    const stripe = makeStripe(event);

    await call(stripe);

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
  });

  it("keeps the tier on payment failure and records past_due", async () => {
    const { update } = mockDb();
    const event = {
      id: "evt_1",
      type: "invoice.payment_failed",
      data: { object: { subscription: "sub_1" } },
    };

    await call(makeStripe(event, subscription({ status: "past_due" })));

    const written = update.mock.calls[0][0];
    expect(written.subscription_status).toBe("past_due");
    expect(written).not.toHaveProperty("tier");
  });

  it("ignores an invoice failure that has no subscription", async () => {
    const { update } = mockDb();
    const event = {
      id: "evt_1",
      type: "invoice.payment_failed",
      data: { object: { subscription: null } },
    };

    await call(makeStripe(event));

    expect(update).not.toHaveBeenCalled();
  });

  it("does not change the tier for an incomplete subscription", async () => {
    const { update } = mockDb();

    await call(makeStripe(subEvent(), subscription({ status: "incomplete" })));

    expect(update.mock.calls[0][0]).not.toHaveProperty("tier");
  });

  it.each(["canceled", "unpaid", "incomplete_expired"])(
    "drops the company back to basic when the subscription is %s",
    async (status) => {
      const { update } = mockDb({
        companyRow: { ...company, stripe_subscription_id: "sub_1" },
      });

      await call(
        makeStripe(subEvent("customer.subscription.deleted"), subscription({ status })),
      );

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ tier: "basic", subscription_status: status }),
      );
    },
  );

  it("does not downgrade when a late event is for an older, replaced subscription", async () => {
    const { update, insert } = mockDb({
      companyRow: { ...company, stripe_subscription_id: "sub_NEW" },
    });

    await call(
      makeStripe(subEvent("customer.subscription.deleted"), subscription({ status: "canceled" })),
    );

    expect(update).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
  });

  it("finds the company by customer id when the metadata is missing", async () => {
    const { companiesEq } = mockDb();

    await call(makeStripe(subEvent(), subscription({ metadata: {} })));

    expect(companiesEq).toHaveBeenCalledWith("stripe_customer_id", "cus_1");
  });

  it("logs and changes nothing when no company matches", async () => {
    const { update, insert } = mockDb({ companyRow: null });

    await call(makeStripe(subEvent()));

    expect(update).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
  });

  it("grants nothing for a price we don't sell", async () => {
    const { update } = mockDb();
    const sub = subscription({ items: { data: [{ price: { id: "price_unknown" } }] } });

    await call(makeStripe(subEvent(), sub));

    expect(update).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("grants nothing when the subscription has no items", async () => {
    const { update } = mockDb();

    await call(makeStripe(subEvent(), subscription({ items: undefined })));

    expect(update).not.toHaveBeenCalled();
  });

  it("grants nothing when the plan's company type doesn't match the company", async () => {
    const { update } = mockDb({ companyRow: { ...company, company_type: "gc" } });

    await call(makeStripe(subEvent()));

    expect(update).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("records an unknown event type without doing anything else", async () => {
    const { update, insert } = mockDb();
    const event = { id: "evt_1", type: "charge.refunded", data: { object: {} } };
    const stripe = makeStripe(event);

    await expect(call(stripe)).resolves.toEqual({ duplicate: false });

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith({ id: "evt_1", type: "charge.refunded" });
  });

  it("does not record the event when the company update fails, so Stripe retries", async () => {
    const { insert } = mockDb({ updateError: { code: "XX000" } });

    await expect(call(makeStripe(subEvent()))).rejects.toMatchObject({ statusCode: 502 });
    expect(insert).not.toHaveBeenCalled();
  });

  it("throws 502 when the subscription can't be fetched from Stripe", async () => {
    const { insert } = mockDb();
    const stripe = makeStripe(subEvent());
    stripe.subscriptions.retrieve.mockRejectedValue(new Error("down"));

    await expect(call(stripe)).rejects.toMatchObject({ statusCode: 502 });
    expect(insert).not.toHaveBeenCalled();
  });

  it("throws 502 when the processed-event check fails", async () => {
    mockDb({ eventSelectError: { code: "XX000" } });
    await expect(call(makeStripe(subEvent()))).rejects.toMatchObject({ statusCode: 502 });
  });

  it("throws 502 when the company lookup fails", async () => {
    mockDb({ companySelectError: { code: "XX000" } });
    await expect(call(makeStripe(subEvent()))).rejects.toMatchObject({ statusCode: 502 });
  });

  it("tolerates a concurrent duplicate insert (unique violation)", async () => {
    mockDb({ insertError: { code: "23505" } });
    await expect(call(makeStripe(subEvent()))).resolves.toEqual({ duplicate: false });
  });

  it("throws 502 when recording the event fails for another reason", async () => {
    mockDb({ insertError: { code: "XX000" } });
    await expect(call(makeStripe(subEvent()))).rejects.toMatchObject({ statusCode: 502 });
  });
});
