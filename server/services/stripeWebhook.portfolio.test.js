// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { handleWebhook } = require("./stripeWebhook");

const fromSpy = vi.spyOn(supabase, "from");

const company = { id: "company-1", company_type: "gc", stripe_subscription_id: null };

// Wires supabase.from() per table:
//   stripe_events: select().eq().maybeSingle(), insert()
//   companies:     select().eq().maybeSingle(), update().eq()
//   jobsites:      select().eq().not().eq() -> { data, error }
const mockDb = ({ companyRow = company, sites = [], sitesError = null } = {}) => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const companyUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  const sitesEq = vi.fn().mockResolvedValue({ data: sites, error: sitesError });
  const sitesNot = vi.fn().mockReturnValue({ eq: sitesEq });
  const sitesSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ not: sitesNot }),
  });

  fromSpy.mockImplementation((table) => {
    if (table === "stripe_events") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert,
      };
    }
    if (table === "companies") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: companyRow, error: null }),
          }),
        }),
        update: companyUpdate,
      };
    }
    if (table === "jobsites") return { select: sitesSelect };
    throw new Error(`unexpected table ${table}`);
  });
  return { companyUpdate, sitesSelect, sitesNot, sitesEq, insert };
};

const portfolioSub = (overrides = {}) => ({
  id: "sub_company_1",
  status: "active",
  customer: "cus_1",
  metadata: { companyId: "company-1" },
  current_period_end: 1800000000,
  items: { data: [{ price: { id: "price_pf10_m" } }] },
  ...overrides,
});

const makeStripe = (sub = portfolioSub(), siteSubs = {}) => ({
  webhooks: {
    constructEvent: vi.fn().mockReturnValue({
      id: "evt_1",
      type: "customer.subscription.updated",
      data: { object: { id: sub.id } },
    }),
  },
  subscriptions: {
    retrieve: vi.fn(async (id) => (id === sub.id ? sub : siteSubs[id] ?? { id, status: "active" })),
    cancel: vi.fn().mockResolvedValue({}),
  },
});

const call = (stripe) =>
  handleWebhook({ rawBody: Buffer.from("{}"), signature: "sig" }, stripe);

describe("stripe webhook: Portfolio absorbs Site Pro subscriptions", () => {
  beforeAll(() => {
    process.env.STRIPE_PRICE_GC_PORTFOLIO_10_SITES_MONTHLY = "price_pf10_m";
    process.env.STRIPE_PRICE_TRADE_PRO_MONTHLY = "price_tp_m";
  });

  beforeEach(() => {
    fromSpy.mockReset();
  });

  it("cancels every paid site subscription, prorated and invoiced now, after writing the tier", async () => {
    const { companyUpdate, sitesSelect, sitesNot, sitesEq, insert } = mockDb({
      sites: [
        { id: "site-1", stripe_subscription_id: "sub_site_1" },
        { id: "site-2", stripe_subscription_id: "sub_site_2" },
      ],
    });
    const stripe = makeStripe();

    await expect(call(stripe)).resolves.toEqual({ duplicate: false });

    expect(companyUpdate).toHaveBeenCalledWith(expect.objectContaining({ tier: "premium" }));
    expect(sitesSelect).toHaveBeenCalledWith("id, stripe_subscription_id");
    expect(sitesNot).toHaveBeenCalledWith("stripe_subscription_id", "is", null);
    expect(sitesEq).toHaveBeenCalledWith("plan", "site_pro");
    expect(stripe.subscriptions.cancel).toHaveBeenCalledTimes(2);
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("sub_site_1", {
      prorate: true,
      invoice_now: true,
    });
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("sub_site_2", {
      prorate: true,
      invoice_now: true,
    });
    expect(insert).toHaveBeenCalled();
  });

  it("does nothing extra when the company has no paid sites", async () => {
    mockDb({ sites: [] });
    const stripe = makeStripe();

    await call(stripe);

    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("skips a site subscription that is already canceled", async () => {
    mockDb({ sites: [{ id: "site-1", stripe_subscription_id: "sub_site_1" }] });
    const stripe = makeStripe(portfolioSub(), {
      sub_site_1: { id: "sub_site_1", status: "canceled" },
    });

    await call(stripe);

    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("does not cancel anything while the Portfolio subscription is past_due", async () => {
    const { sitesSelect } = mockDb();
    const stripe = makeStripe(portfolioSub({ status: "past_due" }));

    await call(stripe);

    expect(sitesSelect).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("does not cancel anything when the Portfolio subscription ends", async () => {
    const { sitesSelect } = mockDb({
      companyRow: { ...company, stripe_subscription_id: "sub_company_1" },
    });
    const stripe = makeStripe(portfolioSub({ status: "canceled" }));

    await call(stripe);

    expect(sitesSelect).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("does not touch site subscriptions for a subcontractor plan", async () => {
    const { sitesSelect } = mockDb({
      companyRow: { ...company, company_type: "subcontractor" },
    });
    const stripe = makeStripe(
      portfolioSub({ items: { data: [{ price: { id: "price_tp_m" } }] } }),
    );

    await call(stripe);

    expect(sitesSelect).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("throws 502 when a site cancel fails, so Stripe retries and the event is not recorded", async () => {
    const { insert } = mockDb({
      sites: [{ id: "site-1", stripe_subscription_id: "sub_site_1" }],
    });
    const stripe = makeStripe();
    stripe.subscriptions.cancel.mockRejectedValue(new Error("stripe down"));

    await expect(call(stripe)).rejects.toMatchObject({ statusCode: 502 });
    expect(insert).not.toHaveBeenCalled();
  });

  it("throws 502 when the paid-site lookup fails", async () => {
    mockDb({ sitesError: { code: "XX000" } });

    await expect(call(makeStripe())).rejects.toMatchObject({ statusCode: 502 });
  });
});
